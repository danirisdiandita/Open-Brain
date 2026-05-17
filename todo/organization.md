# Organization & Roles — OpenBrain Wiki

## Roles

| Role | Description |
|------|-------------|
| **Admin** | Full control over the organization, members, and all content |
| **Editor** | Can create, edit, delete, and organize wiki content |
| **Writer** | Can create and edit their own pages; cannot delete or organize |
| **Viewer** | Read-only access to the organization's wiki |

---

## Permissions Matrix

### Organization Management

| Action | Admin | Editor | Writer | Viewer |
|--------|:-----:|:------:|:------:|:------:|
| Update org name / logo / settings | x | | | |
| Delete organization | x | | | |
| View org info | x | x | x | x |

### Member Management

| Action | Admin | Editor | Writer | Viewer |
|--------|:-----:|:------:|:------:|:------:|
| Invite members | x | | | |
| Remove members | x | | | |
| Change member roles | x | | | |
| View member list | x | x | x | |

### Wiki Pages

| Action | Admin | Editor | Writer | Viewer |
|--------|:-----:|:------:|:------:|:------:|
| Create pages | x | x | x | |
| Edit any page | x | x | | |
| Edit own pages | x | x | x | |
| Delete any page | x | x | | |
| Delete own pages | x | x | x | |
| Restore deleted pages | x | x | | |
| View pages | x | x | x | x |

### Document & Knowledge Base

| Action | Admin | Editor | Writer | Viewer |
|--------|:-----:|:------:|:------:|:------:|
| Upload documents | x | x | x | |
| Delete documents | x | x | | |
| Re-index / reprocess documents | x | x | | |
| View documents | x | x | x | x |
| Download documents | x | x | x | x |

### Content Organization

| Action | Admin | Editor | Writer | Viewer |
|--------|:-----:|:------:|:------:|:------:|
| Create/edit categories / tags | x | x | | |
| Delete categories / tags | x | x | | |
| Move pages between categories | x | x | | |
| Set page hierarchy / parent | x | x | | |
| Pin / feature pages | x | x | | |

### Access & Security

| Action | Admin | Editor | Writer | Viewer |
|--------|:-----:|:------:|:------:|:------:|
| Set org visibility (public / private) | x | | | |
| Manage API keys | x | | | |
| View audit log | x | | | |
| Manage SSO / OAuth integrations | x | | | |
| Export all data | x | x | | |

### Billing & Limits

| Action | Admin | Editor | Writer | Viewer |
|--------|:-----:|:------:|:------:|:------:|
| View subscription / billing | x | | | |
| Upgrade / downgrade plan | x | | | |
| View storage usage | x | x | | |

---

## Invitation Flow

1. Admin invites user via email + assigns a role
2. System checks if the email is already registered:
   - **Already registered** → user gets an in-app notification + email. They can accept or decline.
   - **Not registered** → a **pending invitation** is created. The invitee receives an email with a sign-up link. Once they register, they are automatically added to the organization with the assigned role.
3. Pending invitations expire after 7 days.
4. Admin can view / resend / revoke pending invitations.
5. Existing users can be added directly by admin without invitation.

---

## What Already Exists

| Component | Status | Notes |
|-----------|--------|-------|
| `UserOrganization` model | ✅ Done | Has `role` field (default `"viewer"`, max 16 chars) |
| Org CRUD (create/read/update/delete) | ✅ Done | Admin-only create, membership check on access |
| `_check_membership()` | ✅ Done | Used across folders, notes, RAG endpoints to verify org access |
| Organization list with role | ✅ Done | `GET /organizations` returns each org with the user's role |
| Team Members page (frontend) | ✅ Mock only | `/dashboard/<org>/team-members` — shows hardcoded data |
| Role-permission enforcement | ❌ Missing | No check beyond membership — anyone in the org can do anything |

## What to Build

### 1. Invitation Model & Table

**New file:** `backend/app/models/invitation.py`

```python
class OrganizationInvitation(Base):
    __tablename__ = "organization_invitations"

    id: UUID (PK)
    organization_id: UUID (FK → organizations.id, CASCADE)
    email: str (320)            # invitee email
    role: str (16)              # "admin" | "editor" | "writer" | "viewer"
    token: str (256)            # random hex, used in accept URL
    created_by: UUID (FK → users.id)
    expires_at: datetime (timestamptz)   # created_at + 7 days
    created_at: datetime
```

**Migration:** `alembic revision --autogenerate -m "add organization_invitations table"`

### 2. Invitation API

**New file or extend:** `backend/app/api/v1/organization.py`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/organizations/{org_id}/invitations` | Admin creates invitation (email + role). Sends email if registered, stores pending if not. |
| `GET` | `/organizations/{org_id}/invitations` | Admin lists pending invitations |
| `DELETE` | `/organizations/{org_id}/invitations/{invitation_id}` | Admin revokes invitation |
| `POST` | `/invitations/{token}/accept` | User accepts invitation (must be authenticated) |

**Email service:** extend `app/utils/email.py` with invitation email template (sign-up link with token).

### 3. Member Management API

**Extend:** `backend/app/api/v1/organization.py`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/organizations/{org_id}/members` | List members with roles (admin/editor can view) |
| `PATCH` | `/organizations/{org_id}/members/{user_id}` | Change a member's role (admin only) |
| `DELETE` | `/organizations/{org_id}/members/{user_id}` | Remove member from org (admin only) |

### 4. Role-Based Permission Dependency

**New file or extend:** `backend/app/api/deps.py`

```python
def require_role(*roles: str):
    """FastAPI dependency: only allow specified roles."""
    async def checker(user: User = Depends(get_current_user),
                      org_id: UUID = Path(...),
                      db: AsyncSession = Depends(get_db)):
        membership = await get_membership(db, org_id, user.id)
        if not membership or membership.role not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return checker
```

**Apply to existing endpoints:**
- `DELETE /folders/{id}` → `require_role("admin", "editor")`
- `POST /folders` → `require_role("admin", "editor", "writer")`
- `DELETE /notes/{id}` → `require_role("admin", "editor")` (for any note)
- `GET /chat/sessions` → any member (already checked via `_check_membership`)

### 5. Frontend: Wire Real API to Team Members Page

**File:** `frontend/src/pages/dashboard/TeamMembersPage.tsx`

Replace hardcoded `MOCK_MEMBERS` / `MOCK_PENDING` with API calls:
- `useQuery(["members", orgId])` → fetches member list
- `useMutation` for invite, remove, change role, revoke
- Loading + empty states (currently mock has no loading state)

### 6. Frontend: Hide Admin-Only Actions

Wrap invite/remove/role-change buttons in role checks:
```tsx
{currentUserRole === "admin" && <Button onClick={invite}>Invite</Button>}
{currentUserRole !== "viewer" && <DropdownMenu>...</DropdownMenu>}
```

Current user's role is already available via `useOrganization()` context (returns `selectedOrg` with role).

---

## Implementation Order

| Step | What | Effort |
|------|------|--------|
| 1 | `OrganizationInvitation` model + migration | 30 min |
| 2 | Invitation API (create, list, revoke, accept) | 1.5 hr |
| 3 | Member list + management API | 1 hr |
| 4 | `require_role` dependency | 30 min |
| 5 | Apply role checks to existing endpoints | 1 hr |
| 6 | Wire frontend Team Members to real API | 1.5 hr |
| 7 | Hide admin-only UI in frontend | 30 min |

## Future Considerations

- **Custom roles** — allow admins to create roles with granular permissions
- **Team/Group nesting** — sub-groups within an organization
- **Page-level permissions** — restrict specific pages to certain roles/members
- **Approval workflow** — writer submits page; editor approves before publishing
- **Guest links** — share a page publicly with a temporary link (no account required)
