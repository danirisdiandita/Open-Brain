import os
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.chunk import Chunk
from app.models.user import User
from app.schemas.note import NoteCreate, NoteResponse, NoteUpdate
from app.services.ai import suggest_folder_for_note
from app.services.authorization import get_accessible_folder_ids, get_accessible_note_ids
from app.services.chunking import chunk_text
from app.services.document import DocumentParseError, parse_document
from app.services.embedding import embed_batch
from app.services.folder import build_folder_tree, list_folders
from app.services.note import (
    NoteError,
    create_note,
    delete_note,
    get_note,
    list_notes,
    update_note,
)
from app.services.prompts import get_org_ai_config
from app.services.vector_store import get_vector_store

router = APIRouter(prefix="/organizations/{org_id}/notes", tags=["notes"])


@router.get("", response_model=list[NoteResponse])
async def list_org_notes(
    org_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        notes = await list_notes(db, org_id, folder_id, user, skip, limit)
        allowed_folders = await get_accessible_folder_ids(db, org_id, user.id)
        allowed_notes = await get_accessible_note_ids(db, org_id, user.id)
        if allowed_folders is not None or allowed_notes is not None:
            fids = allowed_folders or set()
            nids = allowed_notes or set()
            notes = [n for n in notes if (n.folder_id and n.folder_id in fids) or n.id in nids]
        return notes
    except NoteError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/upload", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def upload_note(
    org_id: uuid.UUID,
    folder_id: uuid.UUID | None = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    suffix = Path(file.filename).suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        content = await parse_document(tmp_path)
        title = Path(file.filename).stem
        slug = title.lower().replace(" ", "-").replace("/", "-")

        note = await create_note(
            db, org_id, user, title, slug, content, folder_id
        )
        await _reindex_note(db, note)
        return note
    except DocumentParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    finally:
        os.unlink(tmp_path)


@router.post("/{note_id}/suggest-folder")
async def suggest_note_folder(
    org_id: uuid.UUID,
    note_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        note = await get_note(db, note_id, org_id, user)
        folders = await list_folders(db, org_id, user)
        tree = build_folder_tree(folders)
        org_config = await get_org_ai_config(db, org_id)

        result = await suggest_folder_for_note(
            note_title=note.title,
            note_content=note.content,
            folder_tree=tree,
            org_config=org_config,
        )
        return result
    except NoteError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


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
        await _reindex_note(db, note)
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
        updated = await update_note(
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
        await _reindex_note(db, updated)
        return updated
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


async def _reindex_note(db, note) -> None:
    """Reindex a single note's chunks using the given db session."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        store = get_vector_store()
        await store.delete_by_note(db, note.id)

        texts = chunk_text(note.content or "")
        if not texts:
            return

        embeddings = await embed_batch(texts)

        chunks: list[Chunk] = []
        for i, (text, emb) in enumerate(zip(texts, embeddings)):
            chunks.append(Chunk(
                note_id=note.id,
                organization_id=note.organization_id,
                content=text,
                embedding=emb,
                chunk_index=i,
                token_count=len(text.split()),
            ))

        await store.upsert(db, chunks)
    except Exception as exc:
        logger.error(f"Failed to reindex note {note.id}: {exc}")
