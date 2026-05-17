# RAG Implementation Plan for Open Brain

## Architecture Overview

```
┌──────────┐    ┌───────────────┐    ┌──────────────┐    ┌──────────┐
│  Upload   │───▶│  Docling      │───▶│  Chunking +   │───▶│  Vector  │
│  PDF/DOCX │    │  (parse)      │    │  Embedding    │    │  Store   │
└──────────┘    └───────────────┘    └──────────────┘    └──────────┘
                                                              │
┌──────────┐    ┌───────────────┐    ┌──────────────┐         │
│  User     │───▶│  Query        │───▶│  Similarity   │◀────────┘
│  Question │    │  Embedding    │    │  Search       │
└──────────┘    └───────────────┘    └──────┬────────┘
                                            │
                                     ┌──────▼────────┐
                                     │  LLM Response  │
                                     │  (with context)│
                                     └───────────────┘
```

**Pipeline:**
1. Document uploaded → parsed by Docling (already implemented)
2. Content split into overlapping chunks (~512 tokens, 64 overlap)
3. Each chunk embedded via OpenAI `text-embedding-3-small` (1536d)
4. Chunks + embeddings stored in vector DB with metadata (note_id, folder_id, org_id)
5. User query → embedded → top-K similarity search → context injected into LLM prompt

## Phase 1: Shared Infrastructure

### 1.1 Database Schema (Chunks Table)

The `chunks` table **always lives in Postgres**, regardless of which vector store
provider is selected. Postgres is the source of truth for chunk metadata.

```sql
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536),          -- populated only when provider = pg_vector
    chunk_index INT NOT NULL,
    token_count INT NOT NULL,
    heading_path TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Per-provider behavior:**

| Provider | `chunks.embedding` | What lives in Postgres | What lives in external store |
|----------|-------------------|------------------------|------------------------------|
| `pg_vector` | **Populated** (1536d vector) | Everything (metadata + embedding) | Nothing |
| `weaviate` | **NULL** | Metadata only (id, content, note_id, org_id, etc.) | Pointer (`chunk_id`) + embedding vector |
| `pinecone` | **NULL** | Metadata only | Pointer (`chunk_id`) + embedding vector |

**Why this design:**
- Postgres is always the source of truth — if Weaviate/Pinecone go down, no data is lost
- Reindexing: drop external vectors, re-embed, re-upsert pointers — metadata untouched
- The `embedding` column stays `NULL` for Weaviate/Pinecone — no wasted storage
- Relationships (note → chunks, org → chunks) are normal SQL joins — no sync needed
- Switching providers requires only: (a) change env var, (b) reindex pointers to new store

## Architecture Decision: Postgres as Metadata Source

**Golden rule:** ALL chunk metadata (id, content, note_id, org_id, chunk_index,
heading_path, token_count) lives in Postgres — always. The vector store (whether
pgvector, Weaviate, or Pinecone) is an **index**, not a database.

```
                    ┌─────────────────────┐
                    │      Postgres        │
                    │  chunks table        │
                    │  id, content, note_id│
                    │  org_id, heading...  │
                    │  embedding (nullable)│
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
         ┌─────────┐  ┌──────────┐  ┌──────────┐
         │pgvector │  │ Weaviate │  │ Pinecone │
         │(col in  │  │chunk_id  │  │chunk_id  │
         │ Postgres│  │+ vector  │  │+ vector  │
         │ already)│  │          │  │          │
         └─────────┘  └──────────┘  └──────────┘
```

**Search flow:**
1. Embed query
2. Vector store returns ranked `[chunk_id, score]` pairs
3. Postgres fetches full metadata for those `chunk_id`s
4. Re-sort by vector score, return results

### 1.2 Embedding Service

```python
# backend/app/services/embedding.py
from openai import AsyncOpenAI
from app.config import get_settings

EMBEDDING_MODEL = "text-embedding-3-small"   # 1536 dims, $0.02/1M tokens

async def embed_text(text: str) -> list[float]:
    client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    response = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding

async def embed_batch(texts: list[str]) -> list[list[float]]:
    client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    response = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    return [d.embedding for d in response.data]
```

### 1.3 Chunking Strategy

```python
# backend/app/services/chunking.py
def chunk_text(content: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
    """Split text into overlapping chunks, respecting paragraph boundaries."""
    # Use langchain's RecursiveCharacterTextSplitter or a simple sliding window
    # from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(content)
```

### 1.4 Ingestion API

```
POST /organizations/{org_id}/notes/{note_id}/reindex
```
- Deletes existing chunks for this note
- Splits content into chunks
- Embeds each chunk
- Stores chunks + embeddings in vector store
- Returns chunk count

Called automatically after note creation/update (via docling upload or manual edit).

## Phase 2: Vector Store Options

### Option A: pgvector (Recommended — Zero Infrastructure)

**What it is:** PostgreSQL extension. Embeddings stored directly in the `chunks.embedding`
column — **no external service at all**. Metadata + vectors in one table, one transaction.

**Setup:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE chunks ADD COLUMN embedding vector(1536);
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Query:**
```sql
SELECT c.id, c.content, c.note_id, c.heading_path,
       1 - (c.embedding <=> $query_embedding) AS similarity
FROM chunks c
WHERE c.organization_id = $org_id
ORDER BY c.embedding <=> $query_embedding
LIMIT 10;
```

**Pros:**
- Zero additional infrastructure (same Postgres instance)
- Strong consistency (same transactions as note data)
- Simple deployment — no external service to manage
- Good enough for < 1M chunks
- Metadata filtering (by org_id, folder_id) is trivial — same SQL WHERE clause
- Alembic migrations handle schema changes naturally

**Cons:**
- Slower at scale (>10M chunks) vs dedicated vector DBs
- `ivfflat` index is approximate, not exact
- Increases Postgres CPU/memory load

**Best for:** Solo dev, small teams, < 100k documents. The pragmatic default.

**Monthly cost:** $0 (no additional service)

---

### Option B: Weaviate (Self-Hosted or Cloud)

**What it is:** Dedicated vector database. Postgres holds all chunk metadata;
Weaviate stores only `chunk_id` → embedding for fast similarity search.

**Setup:**
```yaml
# docker-compose.yml
weaviate:
  image: semitechnologies/weaviate:latest
  environment:
    AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
    PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
    ENABLE_MODULES: ''
  ports:
    - "8080:8080"
```

```python
# backend/app/services/vector_weaviate.py
import weaviate

client = weaviate.connect_to_local()

# Minimal collection — only stores the chunk pointer
chunks = client.collections.create(
    name="Chunk",
    properties=[
        Property(name="chunk_id", data_type=DataType.UUID),  # PK from Postgres
        Property(name="org_id", data_type=DataType.UUID),    # for filtering
    ],
)
```

**Upsert (pointer only):**
```python
chunks_collection = client.collections.get("Chunk")
for chunk in postgres_chunks:
    chunks_collection.data.insert(
        properties={"chunk_id": chunk.id, "org_id": chunk.organization_id},
        vector=embedding,
    )
```

**Pros:**
- Purpose-built for vector search — fast at scale
- Built-in embedding integration (can call OpenAI directly)
- Hybrid search (vector + keyword) out of the box
- GraphQL API
- Self-hosted option (no vendor lock-in)

**Cons:**
- Additional service to deploy, monitor, back up
- Self-hosted: ~2-4 GB RAM minimum
- Cloud: $25/month starter
- Data in two places (Postgres + Weaviate) — sync complexity

**Best for:** Medium scale, teams wanting hybrid search, self-hosted preference.

**Monthly cost:** $0 (self-hosted) or ~$25+ (Weaviate Cloud)

---

### Option C: Pinecone (Managed, Serverless)

**What it is:** Fully managed serverless vector DB. Postgres holds all chunk metadata;
Pinecone stores only `chunk_id` → embedding.

**Setup:**
```bash
pip install pinecone-client
```

```python
# backend/app/services/vector_pinecone.py
from pinecone import Pinecone

pc = Pinecone(api_key=get_settings().pinecone_api_key)

# Create index once (via script or startup)
pc.create_index(
    name="openbrain-chunks",
    dimension=1536,
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
)

index = pc.Index("openbrain-chunks")
```

**Upsert (pointer only):**
```python
index.upsert(vectors=[
    {
        "id": str(chunk.id),
        "values": embedding,
        "metadata": {
            "chunk_id": str(chunk.id),
            "org_id": str(chunk.organization_id),
        },
    }
    for chunk in chunks
])
```

**Query (two-step: vector search → Postgres metadata fetch):**
```python
async def search(embedding, org_id, top_k=10):
    # Step 1: semantic search in Pinecone (returns chunk_ids + scores)
    results = index.query(
        vector=embedding,
        filter={"org_id": str(org_id)},
        top_k=top_k,
    )

    # Step 2: fetch full metadata from Postgres
    chunk_ids = [r["id"] for r in results["matches"]]
    scores = {r["id"]: r["score"] for r in results["matches"]}

    rows = await db.execute(
        select(Chunk).where(Chunk.id.in_(chunk_ids))
    )
    chunks = rows.scalars().all()
    chunks.sort(key=lambda c: scores.get(str(c.id), 0), reverse=True)
    return chunks
```

**Query (two-step: vector search → Postgres metadata fetch):**
```python
async def search(embedding, org_id, top_k=10):
    # Step 1: semantic search in Weaviate (returns chunk_ids + scores)
    response = chunks_collection.query.near_vector(
        near_vector=embedding,
        limit=top_k,
        filters=Filter.by_property("org_id").equal(org_id),
        return_metadata=["distance"],
    )
    chunk_ids = [o.properties["chunk_id"] for o in response.objects]
    scores = {o.properties["chunk_id"]: 1 - o.metadata.distance for o in response.objects}

    # Step 2: fetch full metadata from Postgres
    rows = await db.execute(
        select(Chunk).where(Chunk.id.in_(chunk_ids))
    )
    chunks = rows.scalars().all()
    chunks.sort(key=lambda c: scores.get(str(c.id), 0), reverse=True)
    return chunks
```

**Pros:**
- Zero operational overhead — fully managed
- Extremely fast at any scale
- Serverless: pay per request, no idle cost
- Built-in metadata filtering

**Cons:**
- Vendor lock-in
- Free tier: 1 index, 100K vectors — outgrown quickly
- Standard: ~$70/month for 1M vectors
- Data leaves your infrastructure
- Latency depends on cloud region proximity

**Best for:** Production scale, teams that don't want to manage infra, cost is acceptable.

**Monthly cost:** Free (starter) → $70+ (production)

---

## Phase 3: Query & Retrieval

### 3.1 Search Endpoint

```
POST /organizations/{org_id}/rag/search
```

```json
// Request
{
  "query": "What's our deployment process?",
  "top_k": 5
}

// Response
{
  "chunks": [
    {
      "id": "uuid",
      "content": "We deploy via GitHub Actions to AWS ECS...",
      "note_id": "uuid",
      "note_title": "Deployment Guide",
      "heading_path": "Engineering > DevOps",
      "similarity": 0.92
    }
  ]
}
```

### 3.2 Chat / Q&A Endpoint

```
POST /organizations/{org_id}/rag/chat
```

```json
// Request
{
  "question": "How do we handle database migrations?",
  "top_k": 5
}

// Response
{
  "answer": "We use Alembic for migrations. Run `alembic upgrade head`...",
  "sources": [
    {"note_id": "uuid", "title": "Backend Guide", "heading": "Migrations"}
  ]
}
```

**Implementation:**
1. Embed the user question
2. Retrieve top-K chunks from vector store
3. Build prompt: system message + retrieved context + user question
4. Call LLM (same OpenAI client) for answer
5. Return answer + source citations

### 3.3 Prompt Template

```python
RAG_SYSTEM_PROMPT = """You are an assistant for Open Brain, a knowledge base.
Answer the user's question using ONLY the provided context chunks below.
If the context doesn't contain the answer, say "I couldn't find that in the knowledge base."
Always cite the source note title and heading when answering.

Context:
{context}
"""
```

## Phase 4: Reindexing & Maintenance

- **On note create/update:** trigger reindex for that note
- **On note delete:** cascade delete chunks (already handled by FK)
- **Batch reindex:** `POST /organizations/{org_id}/rag/reindex-all` for initial ingestion
- **Embedding model change:** reindex all chunks (rare — `text-embedding-3-small` is stable)
- **Chunk size change:** reindex all chunks

## Phase 5: Implementation Priority

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Chunking service + embedding service | 2h |
| 2 | pgvector setup + search endpoint | 3h |
| 3 | Reindex trigger on note save | 1h |
| 4 | RAG chat endpoint | 2h |
| 5 | Frontend: chat/search UI | 4h |
| 6 | (Optional) Weaviate/Pinecone adapter | 3h each |

**Recommended start:** pgvector — smallest operational footprint. Abstract the vector store behind an interface so Weaviate/Pinecone can be swapped in later.

```python
# backend/app/services/vector_store.py
from abc import ABC, abstractmethod
from app.config import get_settings

class VectorStore(ABC):
    @abstractmethod
    async def upsert(self, chunks: list[Chunk]) -> None: ...
    @abstractmethod
    async def search(self, embedding: list[float], org_id: UUID,
                     top_k: int = 10) -> list[SearchResult]: ...
    @abstractmethod
    async def delete(self, note_id: UUID) -> None: ...


# Concrete implementations:
class PgVectorStore(VectorStore): ...
class WeaviateStore(VectorStore): ...
class PineconeStore(VectorStore): ...


# ── Factory: config-driven selection ─────────────────────

VECTOR_STORES = {
    "pg_vector": PgVectorStore,
    "weaviate": WeaviateStore,
    "pinecone": PineconeStore,
}

def get_vector_store() -> VectorStore:
    """Return the configured vector store instance.

    Reads VECTOR_STORE_PROVIDER from settings (env: VECTOR_STORE_PROVIDER).
    Supported values: pg_vector | weaviate | pinecone
    """
    settings = get_settings()
    store_cls = VECTOR_STORES.get(settings.vector_store_provider)
    if store_cls is None:
        raise ValueError(
            f"Unknown VECTOR_STORE_PROVIDER '{settings.vector_store_provider}'. "
            f"Must be one of: {', '.join(VECTOR_STORES)}"
        )
    return store_cls()
```

## Environment Variables

All configuration lives in `app/config.py` with matching entries in `.env` / environment.

### AI / LLM
| Env Var | Default | Description |
|---------|---------|-------------|
| `OPENAI_API_KEY` | `""` | OpenAI API key (required for AI features) |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Chat model for generation |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for RAG (1536 dims) |

### RAG / Vector Store Selection
| Env Var | Default | Description |
|---------|---------|-------------|
| `VECTOR_STORE_PROVIDER` | `pg_vector` | Which store to use: `pg_vector`, `weaviate`, or `pinecone` |
| `PINECONE_API_KEY` | `""` | API key for Pinecone (only needed when `VECTOR_STORE_PROVIDER=pinecone`) |
| `WEAVIATE_URL` | `http://localhost:8080` | Weaviate instance URL (only needed when `VECTOR_STORE_PROVIDER=weaviate`) |
| `WEAVIATE_API_KEY` | `""` | Weaviate API key — leave empty for anonymous access |

### Switching Providers

The vector store is determined by a single env var. No code changes needed:

```bash
# Use pgvector (default — zero extra infra)
VECTOR_STORE_PROVIDER=pg_vector

# Use Weaviate
VECTOR_STORE_PROVIDER=weaviate
WEAVIATE_URL=http://localhost:8080

# Use Pinecone
VECTOR_STORE_PROVIDER=pinecone
PINECONE_API_KEY=pcsk_...
```

At startup, `get_vector_store()` reads `VECTOR_STORE_PROVIDER` and returns the matching implementation.
All callers use the abstract interface — they never know which backend is active.

## Concrete Implementation for Existing Codebase

Below is the file-by-file plan. Each file path is relative to `backend/app/`.

### Files to Create

```
backend/app/
├── services/
│   ├── embedding.py          # OpenAI embedding calls
│   ├── chunking.py           # Text → chunks via LangChain
│   └── vector_store.py       # ABC + pgvector/weaviate/pinecone impls
├── schemas/
│   └── rag.py                # Pydantic request/response schemas
└── api/v1/
    └── rag.py                # FastAPI router: /search, /chat, /reindex
```

### Files to Modify

```
backend/app/
├── config.py                 # (already done: VECTOR_STORE_PROVIDER, OPENAI_EMBEDDING_MODEL, etc.)
├── api/v1/note.py            # trigger reindex after note create/update
├── api/v1/router.py          # mount rag_router
└── models/__init__.py        # ensure Chunk model is imported
```

### Step-by-Step

#### Step 1: Alembic migration for `chunks` embedding column

```bash
cd backend
alembic revision --autogenerate -m "add pgvector extension and chunks embedding column"
```

**Manual edits to the generated migration:**

```python
# alembic/versions/xxxx_add_pgvector.py

def upgrade():
    # Enable extension (safe to run even if already enabled)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Add nullable embedding column to existing chunks table
    op.add_column("chunks",
        sa.Column("embedding", sa.NullType(), nullable=True))
    # Note: sqlalchemy doesn't have a native VECTOR type.
    # sa.NullType() lets pgvector handle it via the extension.

    # Create IVFFlat index for cosine similarity search
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_chunks_embedding
        ON chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding")
    op.drop_column("chunks", "embedding")
```

```bash
alembic upgrade head
```

#### Step 2: Create `app/services/embedding.py`

```python
"""OpenAI embedding service."""
from openai import AsyncOpenAI
from app.config import get_settings


async def embed_text(text: str) -> list[float]:
    """Embed a single text. Returns 1536-dimensional vector."""
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    resp = await client.embeddings.create(
        model=settings.openai_embedding_model,
        input=text,
    )
    return resp.data[0].embedding


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in one API call (cheaper + faster)."""
    if not texts:
        return []
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    resp = await client.embeddings.create(
        model=settings.openai_embedding_model,
        input=texts,
    )
    return [d.embedding for d in resp.data]
```

#### Step 3: Create `app/services/chunking.py`

```python
"""Text chunking for RAG ingestion."""
# from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHUNK_SIZE = 512      # tokens (approximate via chars)
CHUNK_OVERLAP = 64


def chunk_text(content: str) -> list[str]:
    """Split content into overlapping chunks."""
    if not content:
        return []
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(content)
```

#### Step 4: Create `app/schemas/rag.py`

```python
"""Pydantic schemas for RAG search / chat endpoints."""
import uuid
from pydantic import BaseModel, Field


class RAGSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=50)


class RAGChunkResponse(BaseModel):
    id: uuid.UUID
    content: str
    note_id: uuid.UUID
    note_title: str = ""
    heading_path: str | None = None
    similarity: float


class RAGSearchResponse(BaseModel):
    chunks: list[RAGChunkResponse]


class RAGChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


class RAGChatSource(BaseModel):
    note_id: uuid.UUID
    title: str
    heading: str | None = None


class RAGChatResponse(BaseModel):
    answer: str
    sources: list[RAGChatSource]
```

#### Step 5: Create `app/services/vector_store.py`

This is the abstract interface + factory. See the full code in the
**"Abstract Interface"** section above (lines 458–499).

For the **pgvector implementation** specifically:

```python
class PgVectorStore(VectorStore):
    def __init__(self):
        self._store = None  # initialized lazily

    async def upsert(self, db, chunks: list[Chunk]) -> None:
        from app.services.embedding import embed_batch

        texts = [c.content for c in chunks]
        embeddings = await embed_batch(texts)

        for chunk, emb in zip(chunks, embeddings):
            chunk.embedding = emb
            db.add(chunk)
        await db.flush()

    async def search(self, db, embedding, org_id, top_k=10):
        from sqlalchemy import text

        query = text("""
            SELECT c.id, c.content, c.note_id, c.heading_path,
                   n.title AS note_title,
                   1 - (c.embedding <=> :emb) AS similarity
            FROM chunks c
            JOIN notes n ON n.id = c.note_id
            WHERE c.organization_id = :org_id
              AND c.embedding IS NOT NULL
            ORDER BY c.embedding <=> :emb
            LIMIT :top_k
        """)
        result = await db.execute(query, {
            "emb": embedding,
            "org_id": org_id,
            "top_k": top_k,
        })
        return result.mappings().all()

    async def delete(self, db, note_id):
        from sqlalchemy import delete
        from app.models.note import Note  # Chunk — assumes Chunk model exists

        await db.execute(
            delete(Chunk).where(Chunk.note_id == note_id)
        )
        await db.flush()
```

#### Step 6: Create `app/api/v1/rag.py`

```python
"""RAG search and chat endpoints."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.rag import (
    RAGSearchRequest, RAGSearchResponse, RAGChunkResponse,
    RAGChatRequest, RAGChatResponse, RAGChatSource,
)
from app.services.embedding import embed_text
from app.services.vector_store import get_vector_store

router = APIRouter(
    prefix="/organizations/{org_id}/rag",
    tags=["rag"],
)


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
                note_title=getattr(r, "note_title", ""),
                heading_path=r.heading_path,
                similarity=r.similarity,
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
    # 1. Embed question
    embedding = await embed_text(body.question)

    # 2. Retrieve top-K chunks
    store = get_vector_store()
    rows = await store.search(db, embedding, org_id, top_k=body.top_k)

    if not rows:
        return RAGChatResponse(
            answer="I couldn't find relevant information in the knowledge base.",
            sources=[],
        )

    # 3. Build context
    context_parts = []
    sources = []
    for r in rows:
        src = f"[{getattr(r, 'note_title', 'Note')}] {r.content}"
        context_parts.append(src)
        sources.append(RAGChatSource(
            note_id=r.note_id,
            title=getattr(r, "note_title", ""),
            heading=r.heading_path,
        ))

    # 4. Call LLM
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import SystemMessage, HumanMessage
    from app.config import get_settings

    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.3,
    )

    system = (
        "You are an assistant for Open Brain, a knowledge base. "
        "Answer using ONLY the context below. "
        "If the context doesn't contain the answer, say so. "
        "Always cite which note the information comes from.\n\n"
        f"Context:\n{chr(10).join(context_parts)}"
    )

    response = await llm.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=body.question),
    ])

    return RAGChatResponse(
        answer=str(response.content),
        sources=sources,
    )


@router.post("/reindex-all")
async def reindex_all(
    org_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reindex all notes in an organization. Use for initial ingestion or model change."""
    from sqlalchemy import select
    from app.models.note import Note
    from app.services.chunking import chunk_text
    from app.services.embedding import embed_batch

    store = get_vector_store()

    result = await db.execute(
        select(Note).where(Note.organization_id == org_id)
    )
    notes = result.scalars().all()

    total_chunks = 0
    for note in notes:
        await store.delete(db, note.id)

        texts = chunk_text(note.content or "")
        if not texts:
            continue

        embeddings = await embed_batch(texts)

        chunks = []
        for i, (text, emb) in enumerate(zip(texts, embeddings)):
            chunk = Chunk(
                note_id=note.id,
                organization_id=org_id,
                content=text,
                embedding=emb,
                chunk_index=i,
                token_count=len(text.split()),
            )
            chunks.append(chunk)

        await store.upsert(db, chunks)
        total_chunks += len(chunks)

    return {"reindexed_notes": len(notes), "total_chunks": total_chunks}
```

#### Step 7: Wire into `app/api/v1/router.py`

```python
# app/api/v1/router.py — add:
from app.api.v1.rag import router as rag_router

# inside the router = APIRouter(...) block, add:
router.include_router(rag_router)
```

#### Step 8: Auto-reindex on note save

In `app/api/v1/note.py`, add reindex call after note create/update:

```python
# after note is created:
await reindex_note(db, note)

# after note is updated:
await reindex_note(db, updated_note)


async def reindex_note(db: AsyncSession, note):
    """Reindex a single note's chunks."""
    from app.services.chunking import chunk_text
    from app.services.embedding import embed_batch
    from app.services.vector_store import get_vector_store

    store = get_vector_store()
    await store.delete(db, note.id)

    texts = chunk_text(note.content or "")
    if not texts:
        return

    embeddings = await embed_batch(texts)
    chunks = [
        Chunk(
            note_id=note.id,
            organization_id=note.organization_id,
            content=text,
            embedding=emb,
            chunk_index=i,
            token_count=len(text.split()),
        )
        for i, (text, emb) in enumerate(zip(texts, embeddings))
    ]
    await store.upsert(db, chunks)
```

### Summary of New Files

| File | Purpose |
|------|---------|
| `app/services/embedding.py` | Call OpenAI to embed text → vector |
| `app/services/chunking.py` | Split note content into overlapping chunks |
| `app/services/vector_store.py` | ABC + factory + pgvector/weaviate/pinecone impls |
| `app/schemas/rag.py` | Pydantic models for search/chat request/response |
| `app/api/v1/rag.py` | FastAPI router: `/search`, `/chat`, `/reindex-all` |

### Summary of Modified Files

| File | Change |
|------|--------|
| `app/api/v1/router.py` | Mount `rag_router` |
| `app/api/v1/note.py` | Call `reindex_note()` after create/update |
| Alembic migration | Add `vector` extension + `embedding` column + index |
