# Invitation System — Files Reference

## Backend

| File | Role |
|------|------|
| `backend/app/models/invitation.py` | `OrganizationInvitation` ORM model (id, org_id, email, role, token, created_by, expires_at, access_scope, pending_folder_ids, pending_note_ids) |
| `backend/app/schemas/organization.py:44` | `InvitationResponse` Pydantic schema (id, email, role, created_at, expires_at, invite_link) |
| `backend/app/services/invitation.py` | Business logic: `create_invitation`, `list_invitations`, `get_invitation_by_token`, `accept_invitation`, `revoke_invitation` |
| `backend/app/api/v1/organization.py:118-218` | API endpoints: `POST /invitations/{token}/accept`, `GET /{org}/invitations`, `POST /{org}/invitations`, `DELETE /{org}/invitations/{id}` |
| `backend/app/utils/email.py:47` | `send_invitation_email()` — sends HTML email with accept link |
| `backend/app/services/authorization.py` | Called during `accept_invitation` to grant folder/note access when `access_scope == "selected"` |
| `backend/alembic/versions/e04cb3f23106_*.py` | Migration adding `access_scope`, `pending_folder_ids`, `pending_note_ids` to `organization_invitations` |

## Frontend

| File | Role |
|------|------|
| `frontend/src/pages/dashboard/TeamMembersPage.tsx` | Full UI: invite dialog, pending invitations table, revoke confirm dialog, role/scope selection, invite link copy |
| `frontend/src/App.tsx:81` | Route: `/dashboard/:orgSlug/team-members` → `TeamMembersPage` |

## Key Concepts

- **Token**: `secrets.token_urlsafe(32)`, unique per invitation, expires after 7 days
- **Roles**: `admin | editor | writer | viewer`
- **access_scope**: `all` (full org access) or `selected` (specific folders/notes via `pending_folder_ids` / `pending_note_ids` JSON)
- **Email flow**: if user is registered → link to accept; if not registered → link to register with `?invitation={token}`
- **Accept validation**: token must be valid/unexpired AND user email must match invitation email
