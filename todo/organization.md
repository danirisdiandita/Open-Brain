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

1. Admin invites user via email
2. User receives invitation link
3. User accepts → assigned role
4. Existing users can be added directly by admin

## Future Considerations

- **Custom roles** — allow admins to create roles with granular permissions
- **Team/Group nesting** — sub-groups within an organization
- **Page-level permissions** — restrict specific pages to certain roles/members
- **Approval workflow** — writer submits page; editor approves before publishing
- **Guest links** — share a page publicly with a temporary link (no account required)
