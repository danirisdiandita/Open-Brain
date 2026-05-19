# Folder Access Management — How It Works

## Overview

Users in an organization have an **`access_scope`** that controls which folders and notes
they can see. The scope is stored on `user_organization.access_scope`.

Three modes:

| Scope | Behavior |
|-------|----------|
| `all` (default) | User sees everything — no restrictions |
| `selected` | User only sees folders/notes explicitly granted via `folder_member_access` / `note_member_access` |
| `blocked` | User sees nothing — admin grants access later |

---

## Database Schema

### `user_organization.access_scope`

```sql
ALTER TABLE user_organization ADD COLUMN access_scope VARCHAR(16) NOT NULL DEFAULT 'all';
-- Values: 'all', 'selected', 'blocked'
```

Every member of an org has exactly one access scope. Set at invitation time, changeable by admin.

### `folder_member_access` — Folder Grants

```sql
CREATE TABLE folder_member_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, folder_id)
);
```

Each row = one user has access to one folder.

**Cascade behavior:**
- User deleted → their folder grants deleted
- Folder deleted → grants for that folder deleted (all affected users lose access)
- Organization deleted → all grants in that org deleted

### `note_member_access` — Note Grants

```sql
CREATE TABLE note_member_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, note_id)
);
```

Each row = one user has access to one specific note (even if they can't see its parent folder).

---

## Permission Check Flow

### When listing folders (`GET /organizations/{org_id}/folders`)

```
app/api/v1/folder.py:43
  ↓
get_accessible_folder_ids(db, org_id, user.id)   ← app/services/authorization.py:45
  ↓
get_member(db, org_id, user_id)                   ← app/services/authorization.py:13
  ↓
  ├─ member = None          → return set()          (not a member → empty)
  ├─ access_scope = "all"   → return None           (sentinel: no filter needed)
  ├─ access_scope = "blocked" → return set()        (empty = nothing)
  └─ access_scope = "selected" → _get_allowed_folder_ids(db, user_id)
       ↓
       SELECT folder_id FROM folder_member_access WHERE user_id = ?
```

**In the endpoint:**
```python
folders = await list_folders(db, org_id, user)
allowed = await get_accessible_folder_ids(db, org_id, user.id)
if allowed is not None:
    folders = [f for f in folders if f.id in allowed]
```

### When listing notes (`GET /organizations/{org_id}/notes`)

```
app/api/v1/note.py:59
  ↓
get_accessible_folder_ids() + get_accessible_note_ids()
  ↓
notes are filtered by: (note.folder_id IN allowed_folder_ids) OR (note.id IN allowed_note_ids)
```

```python
notes = [n for n in notes if (n.folder_id and n.folder_id in fids) or n.id in nids]
```

### When accessing a single note (`can_access_note`)

```
app/services/authorization.py:82
  ↓
1. Check access_scope
   ├─ not member → False
   ├─ "all" → True
   └─ "selected"/"blocked" → continue
2. Check direct note grant
   → SELECT FROM note_member_access WHERE user_id=? AND note_id=?
3. Check parent folder grant
   → Get note's folder_id → SELECT FROM folder_member_access WHERE user_id=? AND folder_id=?
```

**Precedence:**
```
scope="all" > direct note grant > parent folder grant > denied
```

---

## Invitation Flow with Access Scope

When an admin invites someone:

1. Admin sets `access_scope` + optional `folder_ids`/`note_ids` in the invite dialog
2. Backend stores `access_scope` on `organization_invitations.access_scope`
3. If `access_scope = "selected"` and folder_ids/note_ids are provided:
   - Stored as JSON on `organization_invitations.pending_folder_ids` / `pending_note_ids`
4. When invitee accepts (`POST /invitations/{token}/accept`):
   - `user_organization` row created with `access_scope` from invitation
   - Pending folder_ids/note_ids are inserted into `folder_member_access` / `note_member_access`

**Code:** `app/services/invitation.py:accept_invitation()` lines 34-48

---

## Admin Management API

| Method | Path | Purpose |
|--------|------|---------|
| `PATCH` | `/members/{user_id}/access-scope` | Change scope (`all`/`selected`/`blocked`) |
| `GET` | `/members/{user_id}/folders` | List granted folders |
| `POST` | `/members/{user_id}/folders/{folder_id}` | Grant folder access |
| `DELETE` | `/members/{user_id}/folders/{folder_id}` | Revoke folder access |
| `GET` | `/members/{user_id}/notes` | List granted notes |
| `POST` | `/members/{user_id}/notes/{note_id}` | Grant note access |
| `DELETE` | `/members/{user_id}/notes/{note_id}` | Revoke note access |

All endpoints require `require_role("admin")`.

---

## Folder Parent-Child Relationship

The folder hierarchy is stored via `folders.parent_id`:

```
Engineering/          (parent_id = NULL)
├── Frontend/         (parent_id = Engineering.id)
│   └── Components/   (parent_id = Frontend.id)
└── Backend/          (parent_id = Engineering.id)
```

**Granting access to a parent folder does NOT automatically grant access to children.**
Each folder ID must be explicitly added to `folder_member_access`.

For the sidebar tree (`FolderTree`), `list_folders` returns all folders, then the
access filter is applied at the API level. The tree only shows folders the user can access.

When a user with `selected` scope navigates into a folder they CAN access, the
`FolderContent` page only shows child folders and notes they have access to.

---

## Key Files

| File | Purpose |
|------|---------|
| `app/models/access.py` | `FolderMemberAccess`, `NoteMemberAccess` models |
| `app/models/user_organization.py` | `access_scope` column |
| `app/services/authorization.py` | All permission check logic |
| `app/services/invitation.py` | `accept_invitation()` — grants pending access on accept |
| `app/api/v1/organization.py` | Member management + invitation endpoints |
| `app/api/v1/folder.py` | Folder list + tree endpoints — enforce access filter |
| `app/api/v1/note.py` | Note list endpoint — enforce access filter |

---

## Feature Request: Cascade Folder Access

> "If granting a parent folder, automatically grant all child folders too."

### Why Not Currently

The `grant_folder_access()` function inserts a **single row** into `folder_member_access`:

```python
# app/services/authorization.py:106
async def grant_folder_access(db, org_id, user_id, folder_id, granted_by):
    row = FolderMemberAccess(organization_id=org_id, user_id=user_id,
                             folder_id=folder_id, granted_by=granted_by)
    db.add(row)
```

The `POST /members/{user_id}/folders/{folder_id}` endpoint calls this once. No recursive logic.

### What Needs to Change

**3 files, ~30 lines of code total.**

#### 1. `app/services/authorization.py` — Add helper + cascade functions

```python
from app.models.folder import Folder  # already imported by Note

async def _get_descendant_folder_ids(
    db: AsyncSession, folder_id: uuid.UUID,
) -> list[uuid.UUID]:
    """Recursively find all children, grandchildren, etc. of a folder."""
    ids: list[uuid.UUID] = []
    result = await db.execute(
        select(Folder.id).where(Folder.parent_id == folder_id)
    )
    for child_id in result.scalars().all():
        ids.append(child_id)
        ids.extend(await _get_descendant_folder_ids(db, child_id))
    return ids

async def grant_folder_access_cascade(
    db, org_id, user_id, folder_id, granted_by,
) -> int:
    """Grant access to a folder AND all its descendants. Returns count created."""
    all_ids = [folder_id] + await _get_descendant_folder_ids(db, folder_id)
    count = 0
    for fid in all_ids:
        existing = await db.execute(
            select(FolderMemberAccess).where(
                FolderMemberAccess.user_id == user_id,
                FolderMemberAccess.folder_id == fid,
            )
        )
        if existing.scalar_one_or_none() is None:
            db.add(FolderMemberAccess(
                organization_id=org_id, user_id=user_id,
                folder_id=fid, granted_by=granted_by,
            ))
            count += 1
    await db.flush()
    return count

async def revoke_folder_access_cascade(
    db, user_id, folder_id,
) -> int:
    """Revoke access to a folder AND all its descendants. Returns count deleted."""
    all_ids = [folder_id] + await _get_descendant_folder_ids(db, folder_id)
    result = await db.execute(
        delete(FolderMemberAccess).where(
            FolderMemberAccess.user_id == user_id,
            FolderMemberAccess.folder_id.in_(all_ids),
        )
    )
    await db.flush()
    return result.rowcount
```

#### 2. `app/api/v1/organization.py` — Update the grant/revoke endpoints

Change the grant endpoint from `grant_folder_access()` → `grant_folder_access_cascade()`:

```python
@router.post("/{org_id}/members/{user_id}/folders/{folder_id}")
async def grant_folder_access_endpoint(...):
    count = await grant_folder_access_cascade(db, org_id, user_id, folder_id, admin.id)
    return {"granted": str(folder_id), "descendants": count - 1}
```

Change the revoke endpoint from `revoke_folder_access()` → `revoke_folder_access_cascade()`:

```python
@router.delete("/{org_id}/members/{user_id}/folders/{folder_id}")
async def revoke_folder_access_endpoint(...):
    await revoke_folder_access_cascade(db, user_id, folder_id)
```

#### 3. `app/services/invitation.py` — Cascade on accept

In `accept_invitation()`, when granting pending folder access, use cascade:

```python
# Line ~34-41 in accept_invitation:
if invitation.pending_folder_ids:
    for fid in json.loads(invitation.pending_folder_ids):
        await grant_folder_access_cascade(
            db, invitation.organization_id, user.id,
            uuid.UUID(fid), invitation.created_by,
        )
```

### Complexity Assessment

| Aspect | Rating |
|--------|--------|
| Lines of code | ~30 new lines |
| Files touched | 3 |
| Database changes | None (same table, just more rows) |
| Risk of breaking existing grants | None — old single-folder grants still work |
| Performance impact | O(n) where n = descendant count. Typical: <50 folders, negligible |
| Edge cases | Circular parent references (impossible due to FK), very deep trees |

**Verdict: Trivial.** The folder tree is already in the DB. Just collect all children recursively and insert multiple rows instead of one.

### Behavior After Implementation

- **Grant "Engineering"** → user can see Engineering, Frontend, Backend, Components
- **Revoke "Engineering"** → user loses access to all of them
- **Grant "Components" only** → user sees Components but NOT Frontend or Engineering
- **Existing single-folder grants** — still work, no migration needed
- **`grant_folder_access()` kept** — internal use, no breaking change

---

## Feature: Share Folder / Note Access from UI

> "Add 'Share Access' button on folder pages, note pages, and in the sidebar tree menu."

### Where to Add

| Location | Trigger | Target |
|----------|---------|--------|
| **Folder page** | "Share Access" button (left of "New") | Open dialog to grant folder access to existing members |
| **Note page** | "Share" button in the header/actions | Open dialog to grant note access to existing members |
| **Sidebar folder tree** | "Share" in `...` dropdown menu | Same dialog as folder page |

### Who Can Share

Only **admins** can share. The button/dropdown item is hidden for non-admins.

### Who Can Be Shared With

Only members with **`selected`** or **`blocked`** access scope. Users with `all` scope already see everything — sharing would be redundant.

The dialog shows:
- A member picker (list of all org members except the sharing user)
- Each member's current access scope badge
- A checkbox/toggle to grant access
- For folders: "Include subfolders?" checkbox (triggers cascade)
- "Grant Access" button

### Backend Endpoints (Reuse Existing)

No new endpoints needed — the existing member access endpoints already do the job:

| Action | Endpoint |
|--------|----------|
| Grant folder | `POST /organizations/{org_id}/members/{user_id}/folders/{folder_id}` |
| Grant note | `POST /organizations/{org_id}/members/{user_id}/notes/{note_id}` |
| List members | `GET /organizations/{org_id}/members` (already exists) |
| Check member scope | `GET /organizations/{org_id}/members` includes `access_scope` |

**Add one new endpoint** to get all members who already have access to a folder/note (for the "already shared with" list):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/organizations/{org_id}/folders/{folder_id}/members` | List members who have access to this folder |
| `GET` | `/organizations/{org_id}/notes/{note_id}/members` | List members who have access to this note |

These return `{ user_id, email, full_name, access_scope, has_folder_access: bool }`.

### Frontend Changes

#### 1. Folder Page — Share Access Button

**File:** `frontend/src/pages/dashboard/FolderPage.tsx`  
**File:** `frontend/src/components/FolderContent.tsx`

In the header row (where "New Note" button lives), add a "Share Access" button:

```
[Share Access] [table|grid] [New Note ▼]
```

The button opens a `ShareAccessDialog` component.

#### 2. Sidebar Folder Tree — Share Menu Item

**File:** `frontend/src/components/FolderTree.tsx`

In the `...` dropdown menu (the `DropdownMenuContent` in `NodeRenderer`), add a "Share" item:

```
Add subfolder
Edit
Share          ← NEW
─────────────
Delete
```

On click, opens the same `ShareAccessDialog` with the folder pre-selected.

#### 3. Note Page — Share Button

**File:** `frontend/src/pages/NotePage.tsx`

In the header row (next to Save button), add a "Share" button:

```
[← Back] [Title input] [Share] [Save]
```

On click, opens the same `ShareAccessDialog` with the note pre-selected.

#### 4. New Component: `ShareAccessDialog`

**File:** `frontend/src/components/ShareAccessDialog.tsx`

Props:
```tsx
interface ShareAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: {
    type: "folder" | "note"
    id: string
    name: string
  }
}
```

Dialog layout:
```
┌─────────────────────────────────────────┐
│  Share "Engineering"                    │
│  Grant folder access to team members    │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Member List ─────────────────────┐  │
│  │  [x] Norma (admin) — All access    │  │  ← disabled, "Already has full access"
│  │  [x] John (editor) — Selected     │  │  ← already shared
│  │  [✓] Jane (writer) — Selected     │  │  ← checked = will grant
│  │  [ ] Bob  (viewer) — Blocked      │  │  ← can be granted
│  │  [x] Alice (editor) — All access  │  │  ← disabled
│  └────────────────────────────────────┘  │
│                                         │
│  [ ] Include subfolders (cascade)       │  ← only for folders
│                                         │
│  [Cancel]  [Grant Access]               │
└─────────────────────────────────────────┘
```

UX rules:
- Members with `all` scope are shown but disabled with "Already has full access"
- Members who already have access show checked + "Already shared" muted text
- Checking a member + clicking "Grant Access" calls the grant endpoint
- Unchecking a member + clicking "Grant Access" calls the revoke endpoint
- "Include subfolders" only shown for folders — enables cascade
- After granting, the dialog stays open so admin can verify

### What Already Exists (No Backend Changes Needed)

- `GET /organizations/{org_id}/members` — returns all members with roles + scopes
- `POST /organizations/{org_id}/members/{user_id}/folders/{folder_id}` — grant folder
- `POST /organizations/{org_id}/members/{user_id}/notes/{note_id}` — grant note
- `DELETE` equivalents for revoke
- `useOrganization()` — gives current user's role (to hide button for non-admins)

### Implementation Order

| Step | File | Effort |
|------|------|--------|
| 1 | `app/api/v1/organization.py` — add `GET /folders/{id}/members` + `GET /notes/{id}/members` | 30 min |
| 2 | `app/services/authorization.py` — add `list_folder_access_users()`, `list_note_access_users()` | 15 min |
| 3 | `frontend/src/components/ShareAccessDialog.tsx` — new dialog component | 1.5 hr |
| 4 | `frontend/src/pages/dashboard/FolderPage.tsx` — "Share Access" button | 15 min |
| 5 | `frontend/src/components/FolderTree.tsx` — "Share" menu item | 10 min |
| 6 | `frontend/src/pages/NotePage.tsx` — "Share" button | 15 min |
| 7 | Typecheck + lint | 10 min |

**Total: ~3 hours**
