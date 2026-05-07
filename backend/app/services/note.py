import uuid
import secrets

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.models.user import User
from app.models.user_organization import UserOrganization


class NoteError(Exception):
    pass


async def _check_membership(db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise NoteError("You do not have access to this organization")


async def _ensure_unique_note_slug(
    db: AsyncSession, org_id: uuid.UUID, folder_id: uuid.UUID | None, base_slug: str
) -> str:
    query = select(Note).where(Note.organization_id == org_id, Note.folder_id == folder_id, Note.slug == base_slug)
    result = await db.execute(query)
    if result.scalar_one_or_none() is None:
        return base_slug
    suffix = secrets.token_hex(2)
    return f"{base_slug}-{suffix}"


async def list_notes(
    db: AsyncSession, org_id: uuid.UUID, folder_id: uuid.UUID | None, user: User
) -> list[Note]:
    await _check_membership(db, org_id, user.id)
    query = (
        select(Note)
        .where(Note.organization_id == org_id, Note.folder_id == folder_id)
        .order_by(Note.order_index, Note.created_at)
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_note(db: AsyncSession, note_id: uuid.UUID, org_id: uuid.UUID, user: User) -> Note:
    await _check_membership(db, org_id, user.id)
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.organization_id == org_id)
    )
    note = result.scalar_one_or_none()
    if note is None:
        raise NoteError("Note not found")
    return note


async def create_note(
    db: AsyncSession,
    org_id: uuid.UUID,
    user: User,
    title: str,
    slug: str,
    content: str | None = None,
    folder_id: uuid.UUID | None = None,
) -> Note:
    await _check_membership(db, org_id, user.id)
    slug = await _ensure_unique_note_slug(db, org_id, folder_id, slug)

    note = Note(
        organization_id=org_id,
        folder_id=folder_id,
        title=title,
        slug=slug,
        content=content,
        created_by=user.id,
    )
    db.add(note)
    await db.flush()
    return note


async def update_note(
    db: AsyncSession,
    note_id: uuid.UUID,
    org_id: uuid.UUID,
    user: User,
    title: str | None = None,
    slug: str | None = None,
    content: str | None = None,
    is_published: bool | None = None,
    folder_id: uuid.UUID | None = None,
) -> Note:
    note = await get_note(db, note_id, org_id, user)

    if title is not None:
        note.title = title
    if slug is not None and slug != note.slug:
        note.slug = await _ensure_unique_note_slug(db, org_id, folder_id or note.folder_id, slug)
    if content is not None:
        note.content = content
    if is_published is not None:
        note.is_published = is_published
    if folder_id is not None:
        note.folder_id = folder_id

    await db.flush()
    return note


async def delete_note(db: AsyncSession, note_id: uuid.UUID, org_id: uuid.UUID, user: User) -> None:
    note = await get_note(db, note_id, org_id, user)
    await db.delete(note)
    await db.flush()
