# Access Scope Modes

When inviting a team member, the admin chooses one of three access scopes. This controls what folders and notes the member can see.

## All Folders (`access_scope = "all"`)

**What it does:** Member sees every folder and note in the organization — current and future.

**Use for:** Core team members, co-founders, anyone who needs full visibility.

**Under the hood:** No rows in `folder_member_access` needed. The permission check (`get_accessible_folder_ids()`) returns `None` — sentinel meaning "no filter".

```
user_organization.access_scope = "all"
→ can_access_folder() returns True for every folder
→ can_access_note() returns True for every note
```

---

## Selected Folders (`access_scope = "selected"`)

**What it does:** Member ONLY sees folders and notes that were explicitly granted to them.

**Use for:** Contractors, freelancers, external collaborators who should only access specific projects.

**Under the hood:** Rows in `folder_member_access` and/or `note_member_access` define what's visible. Nothing else is.

```
user_organization.access_scope = "selected"
folder_member_access: { Engineering, Marketing }
note_member_access: { Onboarding Guide }

→ sees Engineering folder + all notes inside it
→ sees Marketing folder + all notes inside it
→ sees Onboarding Guide note (even if in a folder they can't access)
→ sees NOTHING else
```

**Important:** Granting a parent folder grants all its children (via cascade on folder create + Share dialog). No need to manually add each subfolder.

**Admin can grant/revoke at any time** via:
- Share dialog on folder/note pages
- Team Members → member's `...` menu → access management endpoints
- `PATCH /members/{id}/access-scope` to switch between modes

---

## No Access / Blocked (`access_scope = "blocked"`)

**What it does:** Member sees nothing initially. Admin grants folder/note access later.

**Use for:** New hires during onboarding, temporary access that needs manual approval, "read-only until trained" scenarios.

**Under the hood:** Same as `selected` but with an empty grant set by default.

```
user_organization.access_scope = "blocked"
folder_member_access: (empty)
note_member_access: (empty)

→ sees nothing
→ Dashboard shows "No folders yet. Admin will grant access."
```

Admin can grant individual folders/notes over time, or switch the scope to `all`/`selected` when ready.

---

## Comparison

| | All Folders | Selected Folders | No Access |
|---|:---:|:---:|:---:|
| Default folders visible | All | Only granted | None |
| New folders auto-visible | Yes | Only if parent was shared | No |
| Notes in granted folders | All visible | All visible | None |
| Notes in non-granted folders | All visible | Hidden | None |
| Direct note grants | Not needed | Supported | **Ignored** |
| Folder grants honored | N/A (sees all) | Yes | **Ignored** |
| Admin setup effort | None | Grant each folder once | Switch scope first, then grant |

### Key Difference: `blocked` Overrides Grants

`selected` and `blocked` are NOT the same. Both checkpoints in `app/services/authorization.py`:

**Folder check** (line 70-71):
```python
if member.access_scope == "blocked":
    return set()  # ← ignores all folder_member_access rows
```

**Note check** (line 107):
```python
if member.access_scope == "blocked":
    return False  # ← blocks even if direct note grants exist
```

This means:
- When someone is `blocked`, even if an admin grants them folders/notes via the Share dialog, those grants are **silently ignored** until the scope is changed to `selected`.
- `blocked` is a hard block — "this user should not see anything, period."
- `selected` is a soft filter — "this user sees what they're granted."

---

## Where It's Stored

- **`user_organization.access_scope`** — one row per member per org
- **`organization_invitations.access_scope`** — set at invite time, copied on accept
- **`folder_member_access`** — one row per user per folder (only for `selected`/`blocked`)
- **`note_member_access`** — one row per user per note (only for `selected`/`blocked`)

---

## Known Issue: Invite Dialog Missing Folder Picker

The invite dialog (`TeamMembersPage.tsx`) correctly sends `access_scope` to the backend, but when "Selected Folders" is chosen, **no folder IDs are sent**. The `folder_ids` parameter remains `null/undefined`.

### What happens today

| Scope chosen | What's sent | Result after accept |
|-------------|-------------|---------------------|
| All Folders | `access_scope: "all"` | User sees everything ✅ |
| Selected Folders | `access_scope: "selected"`, `folder_ids: null` | User sees NOTHING ❌ (scope is `selected` but zero grants) |
| No Access | `access_scope: "blocked"` | User sees NOTHING ✅ (by design, but redundant since `selected` with no grants does the same) |

### Why

The `Send Invitation` button calls:
```ts
inviteMutation.mutate({ email: inviteEmail, role: inviteRole, access_scope: inviteScope })
```

No `folder_ids` or `note_ids` are included. The backend receives them as `None`.

### What's needed

1. **Folder picker UI** in the invite dialog — appears when "Selected Folders" is chosen
2. **Send `folder_ids`** with the mutation
3. **On accept** — the pending folder IDs are already handled by `accept_invitation()` (code exists, just needs data)

### Implementation Plan

| Step | File | What |
|------|------|------|
| 1 | `TeamMembersPage.tsx` | Add folder picker (tree with checkboxes) inside the invite dialog |
| 2 | `TeamMembersPage.tsx` | Pass `folder_ids` to `inviteMutation.mutate()` |
| 3 | `TeamMembersPage.tsx` | Show picker only when `inviteScope === "selected"` |
| 4 | `organization.py` (backend) | Already handles `folder_ids` — no change needed |
| 5 | `invitation.py` (backend) | Already applies pending folders on accept — no change needed |

**Status:** ✅ Implemented 2026-05-18. Folder picker added to invite dialog. `folder_ids` sent with mutation. Backend accept flow auto-grants.
