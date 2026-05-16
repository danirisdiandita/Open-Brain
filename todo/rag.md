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

Already exists: `chunks` table from migration `52d4d8373271`.

```sql
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536),          -- pgvector type (only for pgvector option)
    chunk_index INT NOT NULL,
    token_count INT NOT NULL,
    heading_path TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**For Weaviate/Pinecone:** the `embedding` column stays NULL or is removed. Embeddings live in the external service.

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
    from langchain.text_splitter import RecursiveCharacterTextSplitter

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

**What it is:** PostgreSQL extension. Embeddings stored directly in the `chunks` table.

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

**What it is:** Dedicated vector database with built-in embedding support.

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
from weaviate.classes.config import Configure, Property, DataType

client = weaviate.connect_to_local()

# Create collection on startup
chunks = client.collections.create(
    name="Chunk",
    properties=[
        Property(name="content", data_type=DataType.TEXT),
        Property(name="note_id", data_type=DataType.UUID),
        Property(name="org_id", data_type=DataType.UUID),
        Property(name="heading_path", data_type=DataType.TEXT),
    ],
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

**What it is:** Fully managed vector database as a service. No infrastructure to run.

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

**Upsert:**
```python
index.upsert(vectors=[
    {
        "id": str(chunk.id),
        "values": embedding,
        "metadata": {
            "content": chunk.content,
            "note_id": str(chunk.note_id),
            "org_id": str(chunk.organization_id),
            "heading_path": chunk.heading_path,
        },
    }
    for chunk in chunks
])
```

**Query:**
```python
results = index.query(
    vector=query_embedding,
    filter={"org_id": str(org_id)},
    top_k=10,
    include_metadata=True,
)
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
All callers use the abstract interface — they never know which backend is active. */

