"""Folder and note authorization service."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_organization import UserOrganization
from app.models.access import FolderMemberAccess, NoteMemberAccess
from app.models.note import Note


async def get_member(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID,
) -> UserOrganization | None:
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _get_allowed_folder_ids(
    db: AsyncSession, user_id: uuid.UUID,
) -> set[uuid.UUID]:
    result = await db.execute(
        select(FolderMemberAccess.folder_id)
        .where(FolderMemberAccess.user_id == user_id)
    )
    return {row[0] for row in result.all()}


async def _get_allowed_note_ids(
    db: AsyncSession, user_id: uuid.UUID,
) -> set[uuid.UUID]:
    result = await db.execute(
        select(NoteMemberAccess.note_id)
        .where(NoteMemberAccess.user_id == user_id)
    )
    return {row[0] for row in result.all()}


async def get_accessible_folder_ids(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID,
) -> set[uuid.UUID] | None:
    """Return folder IDs this user can access, or None for full access."""
    member = await get_member(db, org_id, user_id)
    if member is None:
        return set()
    if member.access_scope == "all":
        return None
    if member.access_scope == "blocked":
        return set()
    return await _get_allowed_folder_ids(db, user_id)


async def get_accessible_note_ids(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID,
) -> set[uuid.UUID] | None:
    """Return note IDs directly granted, or None for full access."""
    member = await get_member(db, org_id, user_id)
    if member is None:
        return set()
    if member.access_scope == "all":
        return None
    if member.access_scope == "blocked":
        return set()
    return await _get_allowed_note_ids(db, user_id)


async def can_access_folder(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID, folder_id: uuid.UUID,
) -> bool:
    folder_ids = await get_accessible_folder_ids(db, org_id, user_id)
    if folder_ids is None:
        return True
    return folder_id in folder_ids


async def can_access_note(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID, note_id: uuid.UUID,
) -> bool:
    member = await get_member(db, org_id, user_id)
    if member is None:
        return False
    if member.access_scope == "all":
        return True

    # Direct note grant
    note_ids = await _get_allowed_note_ids(db, user_id)
    if note_id in note_ids:
        return True

    # Parent folder grant
    note = await db.get(Note, note_id)
    if note and note.folder_id:
        folder_ids = await _get_allowed_folder_ids(db, user_id)
        if note.folder_id in folder_ids:
            return True

    return False


async def grant_folder_access(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID,
    folder_id: uuid.UUID, granted_by: uuid.UUID,
) -> FolderMemberAccess:
    existing = await db.execute(
        select(FolderMemberAccess).where(
            FolderMemberAccess.user_id == user_id,
            FolderMemberAccess.folder_id == folder_id,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        return row
    row = FolderMemberAccess(
        organization_id=org_id, user_id=user_id,
        folder_id=folder_id, granted_by=granted_by,
    )
    db.add(row)
    await db.flush()
    return row


async def grant_note_access(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID,
    note_id: uuid.UUID, granted_by: uuid.UUID,
) -> NoteMemberAccess:
    existing = await db.execute(
        select(NoteMemberAccess).where(
            NoteMemberAccess.user_id == user_id,
            NoteMemberAccess.note_id == note_id,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        return row
    row = NoteMemberAccess(
        organization_id=org_id, user_id=user_id,
        note_id=note_id, granted_by=granted_by,
    )
    db.add(row)
    await db.flush()
    return row


async def revoke_folder_access(
    db: AsyncSession, user_id: uuid.UUID, folder_id: uuid.UUID,
) -> bool:
    from sqlalchemy import delete
    result = await db.execute(
        delete(FolderMemberAccess).where(
            FolderMemberAccess.user_id == user_id,
            FolderMemberAccess.folder_id == folder_id,
        )
    )
    await db.flush()
    return result.rowcount > 0


async def revoke_note_access(
    db: AsyncSession, user_id: uuid.UUID, note_id: uuid.UUID,
) -> bool:
    from sqlalchemy import delete
    result = await db.execute(
        delete(NoteMemberAccess).where(
            NoteMemberAccess.user_id == user_id,
            NoteMemberAccess.note_id == note_id,
        )
    )
    await db.flush()
    return result.rowcount > 0


async def list_member_folders(
    db: AsyncSession, user_id: uuid.UUID,
) -> list[FolderMemberAccess]:
    result = await db.execute(
        select(FolderMemberAccess)
        .where(FolderMemberAccess.user_id == user_id)
        .order_by(FolderMemberAccess.created_at)
    )
    return list(result.scalars().all())


async def list_member_notes(
    db: AsyncSession, user_id: uuid.UUID,
) -> list[NoteMemberAccess]:
    result = await db.execute(
        select(NoteMemberAccess)
        .where(NoteMemberAccess.user_id == user_id)
        .order_by(NoteMemberAccess.created_at)
    )
    return list(result.scalars().all())


async def update_access_scope(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID, scope: str,
) -> bool:
    from sqlalchemy import update
    result = await db.execute(
        update(UserOrganization)
        .where(UserOrganization.organization_id == org_id, UserOrganization.user_id == user_id)
        .values(access_scope=scope)
    )
    await db.flush()
    return result.rowcount > 0
