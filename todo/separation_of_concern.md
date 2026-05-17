# Separation of Concern — Authorized Folders

## Problem

Currently, any member of an organization can access **all folders and notes** (based on their role). There is no way to restrict a member to only specific folders. This is a problem for:

- **External collaborators** who should only see one project folder
- **New hires** who need progressive access as they onboard
- **Agencies/contractors** who should only access their engagement folder
- **Read-only stakeholders** who only need visibility into one area

## Solution: Folder-Level Authorization

Extend the invitation/member system with a **folder access scope** that controls which folders a member can see and interact with.

---

## Access Scope Modes

| Mode | Name | Behavior |
|------|------|----------|
| `all` | **Full Access** | Member sees all folders in the organization (current behavior) |
| `selected` | **Selected Folders** | Member only sees folders explicitly granted |
| `blocked` | **No Access (Deferred)** | Member sees nothing initially — admin grants folder access later |

The mode is set at invitation time and can be changed later by an admin.

---

## Database Changes

### New Table: `folder_member_access`

Grants a member access to a specific folder.

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

### New Table: `note_member_access`

Grants a member access to a specific note (file). Useful when a note lives in a folder they can't access, or for granular file-level sharing.

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

### Access Precedence

When checking if a user can access a **note**:
1. If `access_scope == "all"` → **allowed**
2. If `note_member_access` has a row for this user + note → **allowed**
3. If `folder_member_access` has a row for this user + note's parent folder → **allowed**
4. Otherwise → **denied**

This means a user with `selected` scope can be granted:
- An entire folder (gets all notes inside)
- A specific note inside a folder they can't otherwise access
- Both (redundant but harmless)

### Changes to `organization_invitations`

Add `access_scope` column:

```sql
ALTER TABLE organization_invitations
ADD COLUMN access_scope VARCHAR(16) DEFAULT 'all' NOT NULL
CHECK (access_scope IN ('all', 'selected', 'blocked'));
```

### Changes to `user_organization`

Add `access_scope` column:

```sql
ALTER TABLE user_organization
ADD COLUMN access_scope VARCHAR(16) DEFAULT 'all' NOT NULL
CHECK (access_scope IN ('all', 'selected', 'blocked'));
```

---

## Backend API

### Invitation Changes

Extend `POST /organizations/{org_id}/invitations` to accept `access_scope` and optional `folder_ids`:

```json
{
  "email": "contractor@example.com",
  "role": "writer",
  "access_scope": "selected",
  "folder_ids": ["uuid-1", "uuid-2"]
}
```

When `access_scope` is `selected`, the invitation stores the granted folder IDs. On acceptance, those folders are inserted into `folder_member_access`.

### Member Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/organizations/{org_id}/members/{user_id}/folders` | List folders this member can access |
| `POST` | `/organizations/{org_id}/members/{user_id}/folders` | Grant access to a folder |
| `DELETE` | `/organizations/{org_id}/members/{user_id}/folders/{folder_id}` | Revoke access to a folder |
| `GET` | `/organizations/{org_id}/members/{user_id}/notes` | List notes this member can access |
| `POST` | `/organizations/{org_id}/members/{user_id}/notes` | Grant access to a specific note |
| `DELETE` | `/organizations/{org_id}/members/{user_id}/notes/{note_id}` | Revoke access to a note |
| `PATCH` | `/organizations/{org_id}/members/{user_id}/access-scope` | Change access scope (`all` / `selected` / `blocked`) |

### Folder/Notes API Enforcement

All existing endpoints that list folders or notes must filter by the user's `access_scope`:

```python
# Pseudocode
if access_scope == "all":
    # current behavior — return all folders
elif access_scope == "selected":
    # JOIN folder_member_access — only return granted folders
elif access_scope == "blocked":
    # return empty list
```

**Affected endpoints:**
- `GET /organizations/{org_id}/folders`
- `GET /organizations/{org_id}/folders/tree`
- `GET /organizations/{org_id}/notes`
- `GET /organizations/{org_id}/folders/{id}` (return 403 if not granted)
- `GET /organizations/{org_id}/notes/{id}` (return 403 if parent folder not granted)
- `POST /organizations/{org_id}/rag/search` (only search chunks in accessible folders)
- `POST /organizations/{org_id}/rag/chat` (same)

---

## Backend Service Layer

### `app/services/folder_authorization.py`

```python
async def get_accessible_folder_ids(
    db: AsyncSession, org_id: UUID, user_id: UUID,
) -> set[UUID] | None:
    """Return folder IDs this user can access, or None for full access."""
    member = await get_member(db, org_id, user_id)
    if member is None:
        return set()
    if member.access_scope == "all":
        return None  # sentinel: no restriction
    if member.access_scope == "blocked":
        return set()
    # selected
    result = await db.execute(
        select(FolderMemberAccess.folder_id)
        .where(FolderMemberAccess.user_id == user_id)
    )
    return {row[0] for row in result.all()}


async def get_accessible_note_ids(
    db: AsyncSession, org_id: UUID, user_id: UUID,
) -> set[UUID] | None:
    """Return note IDs this user can access directly, or None for full access."""
    member = await get_member(db, org_id, user_id)
    if member is None:
        return set()
    if member.access_scope == "all":
        return None
    if member.access_scope == "blocked":
        return set()
    result = await db.execute(
        select(NoteMemberAccess.note_id)
        .where(NoteMemberAccess.user_id == user_id)
    )
    return {row[0] for row in result.all()}


async def can_access_note(
    db: AsyncSession, org_id: UUID, user_id: UUID, note_id: UUID,
) -> bool:
    """Check if user can access a specific note."""
    member = await get_member(db, org_id, user_id)
    if member is None:
        return False
    if member.access_scope == "all":
        return True

    # Check direct note access
    result = await db.execute(
        select(NoteMemberAccess).where(
            NoteMemberAccess.user_id == user_id,
            NoteMemberAccess.note_id == note_id,
        )
    )
    if result.scalar_one_or_none():
        return True

    # Check parent folder access
    note = await db.get(Note, note_id)
    if note and note.folder_id:
        result = await db.execute(
            select(FolderMemberAccess).where(
                FolderMemberAccess.user_id == user_id,
                FolderMemberAccess.folder_id == note.folder_id,
            )
        )
        if result.scalar_one_or_none():
            return True

    return False


async def filter_notes_by_access(
    db: AsyncSession, org_id: UUID, user_id: UUID,
) -> tuple[set[UUID] | None, set[UUID] | None]:
    """Return (allowed_folder_ids, allowed_note_ids). None = no restriction."""
    folder_ids = await get_accessible_folder_ids(db, org_id, user_id)
    note_ids = await get_accessible_note_ids(db, org_id, user_id)
    return folder_ids, note_ids
```

### Modify existing services

Each `list_folders`, `list_notes`, `build_folder_tree` should accept optional
`allowed_folder_ids` and `allowed_note_ids` and filter results.

For note listing, the filter becomes:
```sql
WHERE (
    -- Either the note's folder is in the allowed list
    note.folder_id = ANY(:allowed_folder_ids)
    -- Or the note itself is directly granted
    OR note.id = ANY(:allowed_note_ids)
)
```

---

## Frontend Changes

### Invite Dialog

Add access scope selector (before the submit button):

```
[ ] Select specific folders  → dropdown to choose folders
[ ] No access (grant later)
```

Default is the current behavior (full access).

### Team Members Page

Add a "Folders" column showing `scope` badge:
- **All folders** — green badge
- **3 folders** — blue badge with count, click to manage
- **Blocked** — red badge

### Admin: Folder & Note Access Manager

New dialog opened from the member row. Shows:
1. Current access scope with radio/toggle
2. **Folders tab** — folder tree with checkboxes
3. **Notes tab** — searchable note list with checkboxes (for granting access to specific files outside granted folders)
4. "Grant All" / "Revoke All" quick actions

### Sidebar / Navigation

For users with `selected` or `blocked` scope:
- FolderTree in sidebar only shows accessible folders
- Uncategorized notes are hidden (they'd need per-note access, which is out of scope — notes must be in folders for restricted users)

---

## Migration Plan

| Step | Task |
|------|------|
| 1 | Add `access_scope` column to `user_organization` (default `"all"` — no breaking change) |
| 2 | Add `access_scope` column to `organization_invitations` |
| 3 | Create `folder_member_access` table |
| 4 | Add `folder_authorization.py` service |
| 5 | Update `invitations` API to accept scope + folder_ids |
| 6 | Add member folder management endpoints |
| 7 | Add access scope filter to folder/notes list endpoints |
| 8 | Add access scope enforcement to note detail endpoints |
| 9 | Frontend: invite dialog with scope selector |
| 10 | Frontend: team members page — folder access column + management dialog |
| 11 | Frontend: conditional sidebar (restricted users see limited tree) |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Admin revokes a folder that a member is currently viewing | Next request returns 403; UI redirects to dashboard |
| A folder is deleted | Cascade via FK — `folder_member_access` rows auto-deleted |
| Member with `selected` scope creates a new note | It must be in one of their accessible folders; folder selector enforced |
| Member with `blocked` scope | Dashboard shows "No folders yet. Admin will grant access." |
| Invited user has `selected` scope but folder list is empty | Invitation rejected with error "At least one folder required for selected scope" |
| User's scope changed from `all` to `selected` | All previous access revoked — must explicitly grant folders |
| Note is moved to an inaccessible folder | Member loses access unless they have direct note access |
| Member has access to a note but not its parent folder | Access is still granted — note appears in "Shared with me" section |
| A note is deleted | Cascade via FK — `note_member_access` rows auto-deleted |
