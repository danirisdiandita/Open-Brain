# API Key — External Note Ingest

## Concept

Users can create **API keys** bound to an organization. External services present the key as a Bearer token to `POST /notes/ingest` and create a note without a browser session. The payload controls folder routing via three modes: `auto` (AI picks), `manual` (explicit folder_id), or `create` (AI creates if nothing scores ≥7/10).

---

## Backend

### 1. Model — `backend/app/models/apikey.py`

Follow the exact pattern in `app/models/folder.py`.

```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False, default="Default")
    token_hash: Mapped[str] = mapped_column(
        String(256), unique=True, nullable=False
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

Then import in:
- `backend/app/models/__init__.py` — add `from app.models.apikey import ApiKey` + `"ApiKey"` to `__all__`
- `backend/app/alembic/env.py` — add `from app.models.apikey import ApiKey  # noqa: F401`

### 2. Schema — `backend/app/schemas/apikey.py`

Follow the pattern in `app/schemas/folder.py`.

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ApiKeyCreate(BaseModel):
    name: str = Field(default="Default", max_length=128)


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    last_used_at: datetime | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreatedResponse(ApiKeyResponse):
    """Same as response, but includes raw token shown once."""
    raw_token: str


class IngestNoteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    content: str | None = None
    content_type: str = Field(default="markdown", max_length=16)
    # Folder routing
    folder_mode: str | None = Field(
        default=None,
        description='"auto" | "manual" | "create" — omit for uncategorized'
    )
    folder_id: str | None = Field(
        default=None,
        description='UUID string, required when folder_mode = "manual"'
    )
    tags: list[str] | None = None


class IngestNoteResponse(BaseModel):
    id: uuid.UUID
    title: str
    folder_id: uuid.UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

### 3. Service — `backend/app/services/apikey.py`

Follow the pattern in `app/services/folder.py` and `app/services/note.py`.

```python
import uuid
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apikey import ApiKey
from app.models.user import User
from app.models.user_organization import UserOrganization
from app.utils.security import hash_password, verify_password


class ApiKeyError(Exception):
    pass


async def _require_admin(db, org_id, user_id):
    """Raises if user is not an admin of the org."""
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user_id,
            UserOrganization.role == "admin",
        )
    )
    if result.scalar_one_or_none() is None:
        raise ApiKeyError("Only admins can manage API keys")


async def generate_raw_token() -> str:
    """48-char hex token with `ob_` prefix."""
    return "ob_" + secrets.token_hex(24)


async def create_api_key(
    db: AsyncSession,
    org_id: uuid.UUID,
    user: User,
    name: str = "Default",
) -> tuple[ApiKey, str]:
    """Create an API key. Returns (key_record, raw_token)."""
    await _require_admin(db, org_id, user.id)

    raw = await generate_raw_token()
    token_hash = hash_password(raw)  # reuse bcrypt from security.py

    key = ApiKey(
        organization_id=org_id,
        created_by=user.id,
        name=name,
        token_hash=token_hash,
    )
    db.add(key)
    await db.flush()
    return key, raw


async def list_api_keys(
    db: AsyncSession,
    org_id: uuid.UUID,
    user: User,
) -> list[ApiKey]:
    await _require_admin(db, org_id, user.id)
    result = await db.execute(
        select(ApiKey)
        .where(
            ApiKey.organization_id == org_id,
            ApiKey.is_active == True,
        )
        .order_by(ApiKey.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_api_key(
    db: AsyncSession,
    org_id: uuid.UUID,
    key_id: uuid.UUID,
    user: User,
) -> None:
    await _require_admin(db, org_id, user.id)
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.organization_id == org_id,
        )
    )
    key = result.scalar_one_or_none()
    if key is None:
        raise ApiKeyError("API key not found")
    key.is_active = False


async def authenticate_api_key(
    db: AsyncSession,
    token: str,
) -> ApiKey:
    """Find a matching active key or raise."""
    result = await db.execute(
        select(ApiKey).where(ApiKey.is_active == True)
    )
    for key in result.scalars().all():
        # bcrypt verify — iterate because we don't know which key
        if verify_password(token, key.token_hash):
            key.last_used_at = func.now()
            return key
    # If no key matched, fall back to a fast constant-time check
    # on a dummy hash to prevent timing enumeration.
    verify_password(token, "$2b$12$" + "x" * 53)
    raise ApiKeyError("Invalid or inactive API key")
```

### 4. API Dependencies — `backend/app/api/deps.py`

Add alongside `get_current_user` and `require_role`:

```python
from app.models.apikey import ApiKey
from app.services.apikey import authenticate_api_key
from app.services.member import get_member_role, get_member_record


async def get_api_key(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> ApiKey:
    """Authenticate via API key (Bearer token)."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        key = await authenticate_api_key(db, credentials.credentials)
    except ApiKeyError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    return key
```

### 5. Endpoints — `backend/app/api/v1/apikey.py`

Two groups:

**Management endpoints** (behind `get_current_user` + `require_role("admin")`):

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/organizations/{org_id}/api-keys` | `list_api_keys` |
| `POST` | `/organizations/{org_id}/api-keys` | `create_api_key` |
| `DELETE` | `/organizations/{org_id}/api-keys/{key_id}` | `revoke_api_key` |

```python
router = APIRouter(prefix="/organizations/{org_id}/api-keys", tags=["api-keys"])

@router.get("", response_model=list[ApiKeyResponse])
async def list_org_api_keys(
    org_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await list_api_keys(db, org_id, user)
    except ApiKeyError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

@router.post("", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_org_api_key(
    org_id: uuid.UUID,
    body: ApiKeyCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        key, raw = await create_api_key(db, org_id, user, body.name)
        await db.commit()
        return ApiKeyCreatedResponse(
            id=key.id,
            name=key.name,
            last_used_at=key.last_used_at,
            is_active=key.is_active,
            created_at=key.created_at,
            raw_token=raw,
        )
    except ApiKeyError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_org_api_key(
    org_id: uuid.UUID,
    key_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        await revoke_api_key(db, org_id, key_id, user)
        await db.commit()
    except ApiKeyError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
```

**Ingest endpoint** (uses `get_api_key` dependency instead of `get_current_user`):

| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/notes/ingest` | `ingest_note` |

This goes on a **separate router** with a different prefix (no `/{org_id}` in path — org is derived from the API key):

```python
ingest_router = APIRouter(prefix="/notes", tags=["ingest"])


class FolderRouter:
    """Resolve folder_id from the request's routing configuration."""

    def __init__(self, mode: str | None, folder_id: str | None):
        self.mode = mode
        self.folder_id = folder_id

    async def resolve(
        self,
        db: AsyncSession,
        api_key: ApiKey,
        note_title: str,
        note_content: str | None,
    ) -> uuid.UUID | None:
        org_id = api_key.organization_id

        # mode omitted → uncategorized
        if not self.mode:
            return None

        # manual mode
        if self.mode == "manual":
            if not self.folder_id:
                raise ApiKeyError('folder_mode "manual" requires folder_id')
            # verify folder exists and belongs to org
            result = await db.execute(
                select(Folder).where(
                    Folder.id == self.folder_id,
                    Folder.organization_id == org_id,
                )
            )
            folder = result.scalar_one_or_none()
            if not folder:
                raise ApiKeyError("Folder not found")
            return folder.id

        # auto or create mode — AI picks the best folder
        from app.services.ai import suggest_folder_for_note
        from app.services.folder import build_folder_tree, list_folders
        from app.services.prompts import get_org_ai_config

        # Build folder tree for AI context
        result = await db.execute(
            select(Folder).where(Folder.organization_id == org_id)
        )
        folders = list(result.scalars().all())
        tree = build_folder_tree(folders)
        org_config = await get_org_ai_config(db, org_id)

        suggestion = await suggest_folder_for_note(
            note_title=note_title,
            note_content=note_content,
            folder_tree=tree,
            org_config=org_config,
            allow_new=(self.mode == "create"),
        )

        # If best suggestion has score >= 7, use it
        if suggestion.suggestions and suggestion.suggestions[0].score >= 7:
            best = suggestion.suggestions[0]
            if best.is_new:
                # Create the new folder
                from app.services.folder import create_folder
                path_parts = best.folder_path.split(" > ")
                parent_id = None
                for part in path_parts:
                    new_name = part.replace("NEW: ", "").strip()
                    slug = new_name.lower().replace(" ", "-")
                    folder = await create_folder(
                        db, org_id, None,  # no user context — api key
                        name=new_name, slug=slug,
                        description=best.new_folder_description,
                        parent_id=parent_id,
                    )
                    parent_id = folder.id
                return parent_id
            else:
                # Find folder by path in existing tree
                return await _find_folder_by_path(db, org_id, best.folder_path)

        # No good match → uncategorized
        return None
```

### 6. Router Registration — `backend/app/api/v1/router.py`

```python
from app.api.v1.apikey import router as apikey_router
from app.api.v1.apikey import ingest_router

router.include_router(apikey_router)     # /v1/organizations/{org_id}/api-keys
router.include_router(ingest_router)     # /v1/notes/ingest
```

### 7. Config — `backend/app/config.py`

Add:

```python
api_key_token_length: int = Field(default=48, description="Byte length of raw API key tokens")
```

### 8. Alembic Migration

```bash
alembic revision --autogenerate -m "add api_keys table"
alembic upgrade head
```

---

## Frontend — Settings Page

Add a new card section in `frontend/src/pages/dashboard/SettingsPage.tsx` below the AI Config section. Only shown when `currentRole === "admin"`.

### API Client — `frontend/src/api/apikey.ts`

```typescript
import { client } from "./client"
import type { ApiKey, ApiKeyCreated } from "@/types/apikey"

export async function listApiKeys(orgId: string): Promise<ApiKey[]> {
  const { data } = await client.get(`/api/v1/organizations/${orgId}/api-keys`)
  return data
}

export async function createApiKey(orgId: string, name: string): Promise<ApiKeyCreated> {
  const { data } = await client.post(`/api/v1/organizations/${orgId}/api-keys`, { name })
  return data
}

export async function revokeApiKey(orgId: string, keyId: string): Promise<void> {
  await client.delete(`/api/v1/organizations/${orgId}/api-keys/${keyId}`)
}
```

### Types — `frontend/src/types/apikey.ts`

```typescript
export interface ApiKey {
  id: string
  name: string
  last_used_at: string | null
  is_active: boolean
  created_at: string
}

export interface ApiKeyCreated extends ApiKey {
  raw_token: string
}
```

### Hooks — `frontend/src/hooks/useApiKeys.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listApiKeys, createApiKey, revokeApiKey } from "@/api/apikey"

export function useApiKeys(orgId: string | undefined) {
  return useQuery({
    queryKey: ["api-keys", orgId],
    queryFn: () => listApiKeys(orgId!),
    enabled: !!orgId,
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orgId, name }: { orgId: string; name: string }) =>
      createApiKey(orgId, name),
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] })
    },
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orgId, keyId }: { orgId: string; keyId: string }) =>
      revokeApiKey(orgId, keyId),
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] })
    },
  })
}
```

### UI — Settings Card

Following the existing SettingsPage pattern (cards with CardHeader + CardTitle + CardContent):

```
┌─ API Keys ──────────────────────────────────────────────────┐
│                                                               │
│  [Dialog: "Create New API Key"]                               │
│    - Input: name (default "Default")                          │
│    - On create → dialog shows raw token once:                 │
│        ┌──────────────────────────────────────────────┐       │
│        │ ob_abc123...                                  │       │
│        │ [Copy] [Done]                                 │       │
│        └──────────────────────────────────────────────┘       │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Slack Bot    ···   Created May 18   [Revoke]           │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  Zapier       ···   Never used       [Revoke]           │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

Implementation notes:
- "Create New Key" button opens a small dialog (name + submit)
- On success, dialog swaps to show `raw_token` with a "Copy" button and "Done" button
- "Done" dismisses the dialog and refetches the list
- Each row has a "Revoke" button → `confirm()` → `revokeApiKey()` mutation
- Empty state: "No API keys yet. Create one to get started."

---

## Open Questions

1. **Rate limiting** — Not for v1. Could be added later with separate config.
2. **Content type** — v1 accepts `"markdown"`. The backend will store it as-is; the frontend NotePage already handles rendering markdown (via tiptap markdown extension). Could extend to `"tiptap"` (ProseMirror JSON) later.
3. **Chunking & RAG** — Every note created via ingest is automatically reindexed via `_reindex_note()` just like the existing `POST /notes` endpoint. The `ingest_note` handler will call `_reindex_note(db, note)` at the end.
4. **Webhook on creation** — Out of scope for v1.
5. **Tags** — The payload schema includes `tags` but they are not persisted yet. Could be a future addition (tags table, note_tags junction).
6. **Last used refresh** — `authenticate_api_key()` sets `last_used_at` but does not commit — the ingest endpoint will need to commit it.
