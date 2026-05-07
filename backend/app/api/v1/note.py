import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse
from app.services.note import (
    NoteError,
    create_note,
    delete_note,
    get_note,
    list_notes,
    update_note,
)

router = APIRouter(prefix="/organizations/{org_id}/notes", tags=["notes"])


@router.get("", response_model=list[NoteResponse])
async def list_org_notes(
    org_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await list_notes(db, org_id, folder_id, user)
    except NoteError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/{note_id}", response_model=NoteResponse)
async def get_org_note(
    org_id: uuid.UUID,
    note_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_note(db, note_id, org_id, user)
    except NoteError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_org_note(
    org_id: uuid.UUID,
    body: NoteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        note = await create_note(
            db, org_id, user, body.title, body.slug, body.content, uuid.UUID(body.folder_id) if body.folder_id else None
        )
        return note
    except NoteError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_org_note(
    org_id: uuid.UUID,
    note_id: uuid.UUID,
    body: NoteUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await update_note(
            db,
            note_id,
            org_id,
            user,
            title=body.title,
            slug=body.slug,
            content=body.content,
            is_published=body.is_published,
            folder_id=uuid.UUID(body.folder_id) if body.folder_id else None,
        )
    except NoteError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org_note(
    org_id: uuid.UUID,
    note_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await delete_note(db, note_id, org_id, user)
    except NoteError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
