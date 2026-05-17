"""Vector store abstraction layer.

Swappable backends via VECTOR_STORE_PROVIDER env var.
Postgres is always the source of truth for chunk metadata.
"""

import uuid
from abc import ABC, abstractmethod

from sqlalchemy import text, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.chunk import Chunk


class VectorStore(ABC):
    @abstractmethod
    async def upsert(self, db: AsyncSession, chunks: list[Chunk]) -> None:
        """Store chunks with their embeddings."""
        ...

    @abstractmethod
    async def search(
        self, db: AsyncSession, embedding: list[float], org_id: uuid.UUID, top_k: int = 10
    ) -> list[dict]:
        """Return top-K chunks with similarity scores and note_title joined."""
        ...

    @abstractmethod
    async def delete_by_note(self, db: AsyncSession, note_id: uuid.UUID) -> None:
        """Delete all chunks for a given note."""
        ...


class PgVectorStore(VectorStore):
    """Stores embeddings in Postgres via native pgvector extension."""

    async def upsert(self, db: AsyncSession, chunks: list[Chunk]) -> None:
        from app.services.embedding import embed_batch

        texts = [c.content for c in chunks]
        embeddings = await embed_batch(texts)

        for chunk, emb in zip(chunks, embeddings):
            chunk.embedding = emb
            db.add(chunk)
        await db.flush()

    async def search(
        self, db: AsyncSession, embedding: list[float], org_id: uuid.UUID, top_k: int = 10,
        query_text: str | None = None,
    ) -> list[dict]:
        settings = get_settings()

        if settings.rag_hybrid_enabled and query_text:
            return await self._hybrid_search(db, embedding, org_id, top_k, query_text)
        return await self._vector_search(db, embedding, org_id, top_k)

    async def _vector_search(
        self, db: AsyncSession, embedding: list[float], org_id: uuid.UUID, top_k: int = 10
    ) -> list[dict]:
        settings = get_settings()
        limit = settings.rag_coarse_top_k if settings.rag_rerank_enabled else top_k

        emb_str = f"[{','.join(str(x) for x in embedding)}]"
        query = text("""
            SELECT id, content, note_id, heading_path, note_title, similarity
            FROM (
                SELECT DISTINCT ON (c.note_id)
                    c.id, c.content, c.note_id, c.heading_path,
                    n.title AS note_title,
                    1 - (c.embedding <=> :emb) AS similarity
                FROM chunks c
                JOIN notes n ON n.id = c.note_id
                WHERE c.organization_id = :org_id
                  AND c.embedding IS NOT NULL
                ORDER BY c.note_id, c.embedding <=> :emb
            ) ranked
            ORDER BY similarity DESC
            LIMIT :top_k
        """)
        result = await db.execute(query, {
            "emb": emb_str,
            "org_id": org_id,
            "top_k": limit,
        })
        return result.mappings().all()

    async def _hybrid_search(
        self, db: AsyncSession, embedding: list[float], org_id: uuid.UUID,
        top_k: int = 10, query_text: str = "",
    ) -> list[dict]:
        settings = get_settings()

        emb_str = f"[{','.join(str(x) for x in embedding)}]"
        query = text("""
            SELECT id, content, note_id, heading_path, note_title,
                   (:vw * (1 - (embedding <=> :emb))) +
                   (:kw * COALESCE(ts_rank(search_vector, plainto_tsquery('english', :q)), 0))
                   AS similarity
            FROM (
                SELECT DISTINCT ON (c.note_id)
                    c.id, c.content, c.note_id, c.heading_path,
                    n.title AS note_title,
                    c.embedding, c.search_vector
                FROM chunks c
                JOIN notes n ON n.id = c.note_id
                WHERE c.organization_id = :org_id
                  AND c.embedding IS NOT NULL
                ORDER BY c.note_id, c.embedding <=> :emb
            ) ranked
            ORDER BY similarity DESC
            LIMIT :top_k
        """)
        result = await db.execute(query, {
            "emb": emb_str,
            "org_id": org_id,
            "top_k": top_k,
            "vw": settings.rag_hybrid_vector_weight,
            "kw": settings.rag_hybrid_keyword_weight,
            "q": query_text,
        })
        return result.mappings().all()

    async def delete_by_note(self, db: AsyncSession, note_id: uuid.UUID) -> None:
        await db.execute(
            delete(Chunk).where(Chunk.note_id == note_id)
        )
        await db.flush()


# ── Factory ──

VECTOR_STORES: dict[str, type[VectorStore]] = {
    "pg_vector": PgVectorStore,
}

_vector_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        provider = get_settings().vector_store_provider
        store_cls = VECTOR_STORES.get(provider)
        if store_cls is None:
            raise ValueError(
                f"Unknown VECTOR_STORE_PROVIDER '{provider}'. "
                f"Must be one of: {', '.join(VECTOR_STORES)}"
            )
        _vector_store = store_cls()
    return _vector_store
