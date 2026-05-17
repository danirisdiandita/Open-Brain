"""Chat service — session CRUD + RAG chat with conversation history."""

import json
import uuid

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatSession, ChatMessage


async def create_session(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID,
) -> ChatSession:
    session = ChatSession(organization_id=org_id, user_id=user_id)
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def list_sessions(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID,
) -> list[ChatSession]:
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.organization_id == org_id, ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_session(
    db: AsyncSession, session_id: uuid.UUID, org_id: uuid.UUID,
) -> ChatSession | None:
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session_id, ChatSession.organization_id == org_id)
    )
    return result.scalar_one_or_none()


async def get_messages(
    db: AsyncSession, session_id: uuid.UUID,
) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    return list(result.scalars().all())


async def add_message(
    db: AsyncSession, session_id: uuid.UUID, role: str, content: str,
    sources: list[dict] | None = None,
) -> ChatMessage:
    msg = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        sources=json.dumps(sources) if sources else None,
    )
    db.add(msg)

    await db.execute(
        update(ChatSession)
        .where(ChatSession.id == session_id)
        .values(updated_at=func.now())
    )

    await db.flush()
    return msg


async def delete_session(
    db: AsyncSession, session_id: uuid.UUID, org_id: uuid.UUID,
) -> bool:
    session = await get_session(db, session_id, org_id)
    if session is None:
        return False
    await db.delete(session)
    await db.flush()
    return True


async def update_session_title(
    db: AsyncSession, session_id: uuid.UUID, title: str,
) -> None:
    await db.execute(
        update(ChatSession)
        .where(ChatSession.id == session_id)
        .values(title=title)
    )
    await db.flush()
