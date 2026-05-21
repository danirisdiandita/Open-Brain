import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_api_key, require_role
from app.database import get_db
from app.models.apikey import ApiKey
from app.models.user import User
from app.schemas.apikey import ApiKeyCreate, ApiKeyCreatedResponse, ApiKeyResponse, IngestNoteRequest
from app.services.apikey import ApiKeyError, create_api_key, list_api_keys, revoke_api_key, resolve_folder
from app.services.note import NoteError, create_note
from app.api.v1.note import _reindex_note

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


ingest_router = APIRouter(prefix="/notes", tags=["ingest"])


@ingest_router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_note(
    body: IngestNoteRequest,
    api_key: ApiKey = Depends(get_api_key),
    db: AsyncSession = Depends(get_db),
):
    org_id = api_key.organization_id
    slug = body.title.lower().replace(" ", "-").replace("/", "-")[:512]

    creator = await db.get(User, api_key.created_by)
    if creator is None or not creator.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key creator is inactive")

    try:
        folder_id = await resolve_folder(
            db, org_id, body.title, body.content,
            body.folder_mode, body.folder_id,
        )

        note = await create_note(
            db, org_id, creator, body.title, slug, body.content, folder_id,
        )
        note.content_type = body.content_type

        api_key.last_used_at = datetime.now(timezone.utc)

        await _reindex_note(db, note)
        await db.commit()
        return {
            "id": str(note.id),
            "title": note.title,
            "folder_id": str(note.folder_id) if note.folder_id else None,
            "created_at": note.created_at.isoformat(),
        }
    except (NoteError, ApiKeyError) as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
