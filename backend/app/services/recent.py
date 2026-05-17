"""Recent documents service."""

import uuid

from sqlalchemy import select, text, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recent import RecentDocument

MAX_ENTRIES = 15


async def track_open(
    db: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID, note_id: uuid.UUID,
) -> None:
    await db.execute(
        text("""
            INSERT INTO recent_documents (user_id, organization_id, note_id, opened_at)
            VALUES (:uid, :oid, :nid, now())
            ON CONFLICT (user_id, note_id)
            DO UPDATE SET opened_at = now()
        """),
        {"uid": user_id, "oid": org_id, "nid": note_id},
    )

    # Cleanup: keep only last MAX_ENTRIES per user
    await db.execute(
        text("""
            DELETE FROM recent_documents
            WHERE user_id = :uid AND id NOT IN (
                SELECT id FROM recent_documents
                WHERE user_id = :uid
                ORDER BY opened_at DESC
                LIMIT :max
            )
        """),
        {"uid": user_id, "max": MAX_ENTRIES},
    )
    await db.flush()


async def get_recent(
    db: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID, limit: int = 8,
) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT n.id AS note_id, n.title, n.folder_id,
                   f.name AS folder_name, rd.opened_at
            FROM recent_documents rd
            JOIN notes n ON n.id = rd.note_id
            LEFT JOIN folders f ON f.id = n.folder_id
            WHERE rd.user_id = :uid AND rd.organization_id = :oid
            ORDER BY rd.opened_at DESC
            LIMIT :lim
        """),
        {"uid": user_id, "oid": org_id, "lim": limit},
    )
    return result.mappings().all()
