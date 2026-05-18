"""Recent documents API."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.recent import track_open, get_recent

router = APIRouter(prefix="/organizations/{org_id}/recent", tags=["recent"])


class TrackRequest(BaseModel):
    note_id: uuid.UUID


@router.get("")
async def list_recent(
    org_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await get_recent(db, user.id, org_id)
    return [
        {
            "note_id": str(r.note_id),
            "title": r.title,
            "folder_id": str(r.folder_id) if r.folder_id else None,
            "folder_name": r.folder_name or "Uncategorized",
            "opened_at": r.opened_at.isoformat(),
        }
        for r in rows
    ]


@router.post("")
async def track_recent(
    org_id: uuid.UUID,
    body: TrackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await track_open(db, user.id, org_id, body.note_id)
    return {"tracked": True}
