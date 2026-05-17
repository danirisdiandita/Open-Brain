"""Chat API — session management + RAG chat."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatSessionDetailResponse,
    ChatSourceSchema,
    SessionListResponse,
)
from app.services.chat import (
    add_message,
    create_session,
    delete_session,
    get_messages,
    get_session,
    list_sessions,
    update_session_title,
)
from app.services.embedding import embed_text
from app.services.prompts import get_org_ai_config, get_prompt
from app.services.vector_store import get_vector_store

router = APIRouter(prefix="/organizations/{org_id}/chat", tags=["chat"])


@router.get("/sessions", response_model=SessionListResponse)
async def list_chat_sessions(
    org_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sessions = await list_sessions(db, org_id, user.id)
    return SessionListResponse(sessions=sessions)


@router.post("/sessions", response_model=ChatSessionDetailResponse)
async def create_chat_session(
    org_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await create_session(db, org_id, user.id)
    return ChatSessionDetailResponse(
        id=session.id, title=session.title,
        created_at=session.created_at, updated_at=session.updated_at,
        messages=[],
    )


@router.get("/sessions/{session_id}", response_model=ChatSessionDetailResponse)
async def get_chat_session(
    org_id: uuid.UUID,
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await get_session(db, session_id, org_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = await get_messages(db, session_id)
    return ChatSessionDetailResponse(
        id=session.id, title=session.title,
        created_at=session.created_at, updated_at=session.updated_at,
        messages=messages,
    )


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    org_id: uuid.UUID,
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await delete_session(db, session_id, org_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"deleted": True}


@router.post("", response_model=ChatResponse)
async def chat(
    org_id: uuid.UUID,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Create or load session
    if body.session_id:
        session = await get_session(db, body.session_id, org_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = await create_session(db, org_id, user.id)

    # Save user message
    await add_message(db, session.id, "user", body.question)

    # Set title from first question if still default
    if session.title == "New Chat":
        title = body.question[:50]
        if len(body.question) > 50:
            title += "..."
        await update_session_title(db, session.id, title)

    # Build conversation history for context
    past = await get_messages(db, session.id)
    history_parts: list[str] = []
    for m in past[:-1]:  # exclude the user message we just saved
        prefix = "User" if m.role == "user" else "Assistant"
        history_parts.append(f"{prefix}: {m.content}")
    history = "\n".join(history_parts[-10:])  # last 10 messages

    # RAG search
    embedding = await embed_text(body.question)
    store = get_vector_store()
    rows = await store.search(db, embedding, org_id, top_k=body.top_k)

    context_parts: list[str] = []
    sources: list[ChatSourceSchema] = []
    for r in rows:
        ctx = f"[{r.note_title or 'Note'}] {r.content}"
        context_parts.append(ctx)
        sources.append(ChatSourceSchema(
            note_id=r.note_id,
            title=r.note_title or "",
            heading=r.heading_path,
        ))

    # Load org AI config
    org_config = await get_org_ai_config(db, org_id)

    history_section = f"Conversation history:\n{history}\n\n" if history else ""

    system = get_prompt("chat_system", org_config,
        history_section=history_section,
        context="\n".join(context_parts),
    )

    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_openai import ChatOpenAI

    from app.config import get_settings
    from app.services.prompts import get_effective_config

    settings = get_settings()
    config = get_effective_config(org_config)
    llm = ChatOpenAI(
        model=config["ai_model"],
        api_key=settings.openai_api_key,
        temperature=config["temperature"],
    )

    response = await llm.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=body.question),
    ])
    answer = str(response.content) if response.content else "I couldn't generate an answer."

    # Save assistant message
    await add_message(
        db, session.id, "assistant", answer,
        [{"note_id": str(s.note_id), "title": s.title, "heading": s.heading} for s in sources],
    )

    return ChatResponse(session_id=session.id, answer=answer, sources=sources)
