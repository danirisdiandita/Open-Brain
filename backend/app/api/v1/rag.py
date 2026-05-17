"""RAG search and chat endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.chunk import Chunk
from app.models.note import Note
from app.models.user import User
from app.schemas.rag import (
    RAGChatRequest,
    RAGChatResponse,
    RAGChatSource,
    RAGChunkResponse,
    RAGSearchRequest,
    RAGSearchResponse,
)
from app.services.chunking import chunk_text
from app.services.embedding import embed_batch, embed_text
from app.services.prompts import get_effective_config, get_org_ai_config, get_prompt
from app.services.vector_store import get_vector_store

router = APIRouter(prefix="/organizations/{org_id}/rag", tags=["rag"])


@router.post("/search", response_model=RAGSearchResponse)
async def rag_search(
    org_id: uuid.UUID,
    body: RAGSearchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    embedding = await embed_text(body.query)
    store = get_vector_store()
    rows = await store.search(db, embedding, org_id, top_k=body.top_k)

    return RAGSearchResponse(
        chunks=[
            RAGChunkResponse(
                id=r.id,
                content=r.content,
                note_id=r.note_id,
                note_title=r.note_title or "",
                heading_path=r.heading_path,
                similarity=round(r.similarity, 4) if r.similarity else 0,
            )
            for r in rows
        ]
    )


@router.post("/chat", response_model=RAGChatResponse)
async def rag_chat(
    org_id: uuid.UUID,
    body: RAGChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    embedding = await embed_text(body.question)
    store = get_vector_store()
    rows = await store.search(db, embedding, org_id, top_k=body.top_k)

    if not rows:
        return RAGChatResponse(
            answer="I couldn't find relevant information in the knowledge base.",
            sources=[],
        )

    context_parts: list[str] = []
    sources: list[RAGChatSource] = []
    for r in rows:
        ctx = f"[{r.note_title or 'Note'}] {r.content}"
        context_parts.append(ctx)
        sources.append(RAGChatSource(
            note_id=r.note_id,
            title=r.note_title or "",
            heading=r.heading_path,
        ))

    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_openai import ChatOpenAI

    from app.config import get_settings

    org_config = await get_org_ai_config(db, org_id)

    settings = get_settings()
    config = get_effective_config(org_config)
    llm = ChatOpenAI(
        model=config["ai_model"],
        api_key=settings.openai_api_key,
        temperature=config["temperature"],
    )

    system = get_prompt("rag_system", org_config,
        context="\n".join(context_parts),
    )

    response = await llm.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=body.question),
    ])

    answer = str(response.content) if response.content else "I couldn't generate an answer."

    return RAGChatResponse(answer=answer, sources=sources)


@router.post("/notes/{note_id}/reindex")
async def reindex_note(
    org_id: uuid.UUID,
    note_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.organization_id == org_id)
    )
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    store = get_vector_store()
    await store.delete_by_note(db, note_id)

    texts = chunk_text(note.content or "")
    if not texts:
        return {"chunks": 0}

    embeddings = await embed_batch(texts)

    chunks: list[Chunk] = []
    for i, (text, emb) in enumerate(zip(texts, embeddings)):
        chunks.append(Chunk(
            note_id=note_id,
            organization_id=org_id,
            content=text,
            embedding=emb,
            chunk_index=i,
            token_count=len(text.split()),
        ))

    await store.upsert(db, chunks)
    return {"chunks": len(chunks)}
