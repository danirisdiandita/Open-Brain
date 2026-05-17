# Prompt & System Instruction Configuration — Implementation Plan

## 1. Problem

Hardcoded system prompts across 3 backend files, no per-organization customization:

| Location | Prompt | Lines |
|---|---|---|
| `backend/app/services/ai.py` | Folder suggestion system prompt | 20-26 |
| `backend/app/services/ai.py` | Folder tree generation system prompt | 57-63 |
| `backend/app/api/v1/chat.py` | Chat assistant system prompt | 130-138 |
| `backend/app/api/v1/rag.py` | RAG search system prompt | 94-99 |

Sidebar already links to `/settings` but no page exists. All AI config is global (`config.py` env vars only).

---

## 2. Database — New Model

**File:** `backend/app/models/organization_ai_config.py`

```python
class OrganizationAIConfig(Base):
    __tablename__ = "organization_ai_config"

    id: Mapped[uuid.UUID]        # PK
    organization_id: Mapped[uuid.UUID]  # FK → organizations.id, unique=True

    # Prompt overrides (NULL = use hardcoded default from ai.py / chat.py / rag.py)
    folder_suggestion_system: Mapped[str | None]   # override for ai.py:suggest_folder_for_note
    folder_tree_system: Mapped[str | None]          # override for ai.py:generate_folder_tree
    chat_system: Mapped[str | None]                 # override for chat.py system prompt
    rag_system: Mapped[str | None]                  # override for rag.py system prompt

    # Optional AI model overrides
    ai_model: Mapped[str | None]                    # e.g. "gpt-4.1"
    temperature: Mapped[float | None]               # 0.0–2.0

    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    organization: Mapped["Organization"]  # relationship, back_populates
```

**Rationale:** Separate table over JSONB column on Organization because:
- Clean separation of concerns
- Proper NULL semantics (JSONB can't distinguish "null = use default" from "absent")
- Easier to extend with audit trails later
- Single-row indexable by `organization_id` (FK + unique constraint)

**Relationship on `Organization`:**
```python
# In organization.py, add:
ai_config: Mapped["OrganizationAIConfig | None"] = relationship(
    back_populates="organization", uselist=False, cascade="all, delete-orphan"
)
```

**Migration:** Alembic auto-generate — add table + unique constraint on `organization_id`.

---

## 3. Backend — Default Prompts & Merge Strategy

**File:** `backend/app/services/prompts.py` (**NEW**)

Extract hardcoded prompts into named constants. This becomes the single source of truth for defaults.

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class DefaultPrompts:
    FOLDER_SUGGESTION_SYSTEM = """\
You are an expert at organizing knowledge bases. Given a note and a folder tree,
suggest the best folder(s) where this note should be placed.

Rules:
- Return 3-5 suggestions sorted by relevance (best first).
- Use full folder paths like "Engineering > Backend > API".
- Only suggest folders that EXIST in the provided tree.
- Score 10 means perfect match, 1 means barely relevant.
- Consider the note title and content to determine the best fit."""

    FOLDER_TREE_SYSTEM = """\
You are an expert at designing knowledge base folder structures for organizations.
Based on the user's description, return the COMPLETE suggested folder tree.

Rules:
- Include BOTH existing folders (marked is_existing=true) AND new folders (marked is_existing=false).
- Keep slugs lowercase, hyphenated, clean.
- Names should be concise (1-3 words).
- Maximum 3 levels deep.
- Preserve existing folder names/slugs exactly as provided."""

    CHAT_SYSTEM = """\
You are an assistant for Open Brain, a knowledge base. 
Answer using ONLY the context below. 
If the context doesn't contain the answer, say so. 
Always cite which note the information comes from. 
Be concise and helpful.
"""

    RAG_SYSTEM = """\
You are an assistant for Open Brain, a knowledge base. 
Answer using ONLY the context below. 
If the context doesn't contain the answer, say so. 
Always cite which note the information comes from.
"""
```

**Merge function** — returns effective prompt for a given key:

```python
from app.models.organization_ai_config import OrganizationAIConfig

def get_prompt(
    key: str,
    org_config: OrganizationAIConfig | None,
    **template_vars
) -> str:
    """Get the effective prompt: org override > default, with template substitution."""
    defaults = {
        "folder_suggestion_system": DefaultPrompts.FOLDER_SUGGESTION_SYSTEM,
        "folder_tree_system": DefaultPrompts.FOLDER_TREE_SYSTEM,
        "chat_system": DefaultPrompts.CHAT_SYSTEM,
        "rag_system": DefaultPrompts.RAG_SYSTEM,
    }

    base = None
    if org_config:
        base = getattr(org_config, key, None)

    if not base:
        base = defaults.get(key, "")

    # Substitute template variables like {org_name}, {date}, {note_title}, etc.
    return base.format(**template_vars) if template_vars else base


def get_effective_config(
    org_config: OrganizationAIConfig | None,
    settings,
) -> dict:
    """Merged config: org override falls back to global settings."""
    return {
        "ai_model": (org_config.ai_model if org_config else None) or settings.openai_model,
        "temperature": org_config.temperature if (org_config and org_config.temperature is not None) else 0.3,
    }
```

**Refactor `ai.py`** to use the new module:

```python
from app.services.prompts import DefaultPrompts, get_prompt, get_effective_config

async def suggest_folder_for_note(note_title, note_content, folder_tree, org_config=None):
    settings = get_settings()
    config = get_effective_config(org_config, settings)

    system = get_prompt("folder_suggestion_system", org_config,
        org_name=org_config.organization.name if org_config else "Open Brain")

    # ... use system prompt + config["ai_model"], config["temperature"]
```

**Same refactor for `chat.py` and `rag.py`** — accept optional `org_config` parameter and use `get_prompt()`.

---

## 4. API Endpoints

**File:** `backend/app/api/v1/organization.py` (add routes)

### `GET /api/v1/organizations/{org_id}/ai-config`

Returns effective (merged) configuration. Always returns defaults even if no override exists — so the frontend always has something to show.

```json
{
  "folder_suggestion_system": {
    "value": "You are an expert at organizing...",
    "is_default": true
  },
  "folder_tree_system": {
    "value": "You are an expert at designing...",
    "is_default": false
  },
  "chat_system": { "value": "...", "is_default": true },
  "rag_system": { "value": "...", "is_default": true },
  "ai_model": { "value": "gpt-4.1-mini", "is_default": true },
  "temperature": { "value": 0.2, "is_default": true }
}
```

### `PATCH /api/v1/organizations/{org_id}/ai-config`

Accepts partial overrides. Only fields present in the request body are updated. Set a field to `null` to clear the override and fall back to default.

```json
{
  "folder_suggestion_system": "Custom prompt text...",
  "temperature": 0.5,
  "chat_system": null
}
```

Response: same shape as GET, with updated `is_default` flags.

**Authorization:** `require_role("admin", "editor")` — only admins and editors can modify AI config.

### Pydantic schemas — `backend/app/schemas/ai_config.py` (**NEW**)

```python
class AIConfigField(BaseModel):
    value: str | float | None
    is_default: bool

class AIConfigResponse(BaseModel):
    folder_suggestion_system: AIConfigField
    folder_tree_system: AIConfigField
    chat_system: AIConfigField
    rag_system: AIConfigField
    ai_model: AIConfigField
    temperature: AIConfigField

class AIConfigUpdate(BaseModel):
    folder_suggestion_system: str | None = None  # None = no change, explicit null = reset
    folder_tree_system: str | None = None
    chat_system: str | None = None
    rag_system: str | None = None
    ai_model: str | None = None
    temperature: float | None = None
```

---

## 5. Frontend

### 5a. New Page — `frontend/src/pages/dashboard/SettingsPage.tsx`

Layout:
```
┌────────────────────────────────────────────────┐
│  Settings                                      │
│                                                │
│  ┌── AI Configuration ────────────────────────┐│
│  │                                             ││
│  │  Model                                      ││
│  │  ┌──────────────────────────────┐ [Reset]  ││
│  │  │ gpt-4.1-mini                │           ││
│  │  └──────────────────────────────┘           ││
│  │                                             ││
│  │  Temperature                                ││
│  │  ┌───────[0.3]──────────────────────┐       ││
│  │   0.0                           2.0         ││
│  │                                             ││
│  │  Folder Suggestion System Prompt            ││
│  │  ┌──────────────────────────────┐ [Default]││
│  │  │ (Textarea with monospace)    │ [Reset]  ││
│  │  │                              │           ││
│  │  └──────────────────────────────┘           ││
│  │  is_default badge: Custom / Default         ││
│  │                                             ││
│  │  Folder Tree System Prompt                  ││
│  │  ┌──────────────────────────────┐           ││
│  │  │ ...                          │           ││
│  │  └──────────────────────────────┘           ││
│  │                                             ││
│  │  Chat System Prompt                         ││
│  │  ┌──────────────────────────────┐           ││
│  │  │ ...                          │           ││
│  │  └──────────────────────────────┘           ││
│  │                                             ││
│  │  RAG System Prompt                          ││
│  │  ┌──────────────────────────────┐           ││
│  │  │ ...                          │           ││
│  │  └──────────────────────────────┘           ││
│  │                                             ││
│  │                    [Save Changes] [Discard]  ││
│  └─────────────────────────────────────────────┘│
│                                                │
│  ┌── Template Variables ──────────────────────┐│
│  │  Available variables in prompts:            ││
│  │  `{org_name}` — Organization name           ││
│  │  `{date}` — Current date                    ││
│  │  `{note_title}` — Note title (folder sugg.) ││
│  └─────────────────────────────────────────────┘│
└────────────────────────────────────────────────┘
```

**Components:**
- `PromptEditor` — reusable textarea card with "Use Default" toggle and reset button
- Uses `useForm` + `useMutation` for save
- Fetches config with `useQuery`, shows skeleton while loading
- Dirty tracking: show "Unsaved changes" indicator

### 5b. API Client — `frontend/src/api/organization.ts` (add functions)

```typescript
export const organizationApi = {
  // ... existing ...
  getAIConfig: (orgId: string) =>
    api.get<AIConfigResponse>(`/organizations/${orgId}/ai-config`).then(r => r.data),
  updateAIConfig: (orgId: string, body: AIConfigUpdate) =>
    api.patch<AIConfigResponse>(`/organizations/${orgId}/ai-config`, body).then(r => r.data),
}
```

### 5c. Hooks — `frontend/src/hooks/useAIConfig.ts` (**NEW**)

```typescript
export function useAIConfig(orgId?: string) {
  return useQuery({
    queryKey: ["ai-config", orgId],
    queryFn: () => organizationApi.getAIConfig(orgId!),
    enabled: !!orgId,
  })
}

export function useUpdateAIConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orgId, ...body }: { orgId: string } & AIConfigUpdate) =>
      organizationApi.updateAIConfig(orgId, body),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ai-config", vars.orgId] })
    },
  })
}
```

### 5d. Route Registration — `frontend/src/App.tsx`

Add route BEFORE the `*` (catch-all) route:

```tsx
<Route path="settings" element={<SettingsPage />} />
```

So the dashboard routes become:
```
/dashboard/:orgSlug/*
  ├── index           → DashboardPage
  ├── flow            → WorkspaceFlowPage
  ├── uncategorized   → UncategorizedPage
  ├── team-members    → TeamMembersPage
  ├── settings        → SettingsPage          ← NEW
  └── *               → FolderPage (catch-all)
```

The `Settings` link in `AppSidebar.tsx` (line already exists) will now resolve to a real page.

---

## 6. Template Variable System

Prompts support `{variable}` placeholders that are substituted at runtime:

| Variable | Available In | Description |
|---|---|---|
| `{org_name}` | All prompts | Organization name from org context |
| `{date}` | All prompts | Current date (ISO format) |
| `{note_title}` | Folder suggestion | Note being classified |
| `{note_content}` | Folder suggestion | Note content preview |

Variables are always substituted from runtime context, never from the database. Users see available variables in a reference panel on the Settings page.

---

## 7. Access Control

| Role | View Config | Edit Config |
|---|---|---|
| Admin | Yes | Yes |
| Editor | Yes | Yes |
| Viewer | Yes (read-only) | No |

Backend: `PATCH` endpoint decorated with `require_role("admin", "editor")`.
Frontend: Settings page renders fields as `disabled` when user role is "viewer".

---

## 8. Implementation Order

| Step | File(s) | Effort |
|---|---|---|
| 1 | `backend/app/models/organization_ai_config.py` (new) + update `organization.py` relationship | Small |
| 2 | Alembic migration for new table | Auto |
| 3 | `backend/app/schemas/ai_config.py` (new) | Small |
| 4 | `backend/app/services/prompts.py` (new) — extract defaults | Medium |
| 5 | Refactor `backend/app/services/ai.py` to use prompts module | Small |
| 6 | Refactor `backend/app/api/v1/chat.py` to use prompts module | Small |
| 7 | Refactor `backend/app/api/v1/rag.py` to use prompts module | Small |
| 8 | Add GET/PATCH routes to `backend/app/api/v1/organization.py` | Medium |
| 9 | `frontend/src/api/organization.ts` — add getAIConfig/updateAIConfig | Small |
| 10 | `frontend/src/hooks/useAIConfig.ts` (new) | Small |
| 11 | `frontend/src/pages/dashboard/SettingsPage.tsx` (new) | Large |
| 12 | `frontend/src/App.tsx` — add settings route | Tiny |

**Total:** ~1 day of focused work, backend-heavy in first half, frontend-heavy in second.

---

## 9. Testing Strategy

**Backend:**
- Unit test `get_prompt()` merge logic (org override → default fallback → NULL reset)
- API test: GET returns defaults for org without config
- API test: PATCH creates config, GET returns merged values
- API test: PATCH with `null` resets field to default
- API test: Viewer role gets 403 on PATCH

**Frontend:**
- Render test: Settings page loads with default values
- Interaction test: Type in prompt editor, see "unsaved changes" indicator
- Interaction test: Click "Use Default" resets textarea to default value
- Integration test: Save → refetch shows updated values
- Role test: Viewer sees disabled fields

---

## 10. Future Enhancements (out of scope for v1)

- **Prompt versioning** — track history of changes, ability to revert
- **A/B testing** — run multiple prompt variants and compare results
- **Prompt library** — share/reuse prompts across organizations
- **Multi-provider support** — Anthropic, Google, etc. per organization
- **Custom template variables** — user-defined variables from note metadata
- **Prompt cost estimation** — show token count and estimated cost per prompt
