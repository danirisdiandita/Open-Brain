# RAG Implementation — Advanced (Later Phase)

> Advice: "Use semantic/LLM chunking, hybrid retrieval with keyword + vector,
> and agentic ReAct for complex multi-source queries."

---

## 1. Semantic / LLM Chunking

### Current State
Using `RecursiveCharacterTextSplitter.from_tiktoken_encoder()` — splits by token count with
paragraph-aware separators (`\n\n`, `\n`, `. `, ` `). This is **greedy fixed-size chunking**.
It doesn't understand document structure or semantic boundaries.

### What to Upgrade

**Option A: Semantic Chunking (langchain `SemanticChunker`)**

Splits text at points where the semantic similarity between adjacent sentences drops below
a threshold. Uses embeddings to detect topic shifts.

```python
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings

splitter = SemanticChunker(
    OpenAIEmbeddings(model="text-embedding-3-small"),
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=90,
)
```

**Option B: LLM Chunking (Agentic)**

Ask an LLM to decide where to split based on document structure. More expensive but
produces the best chunks.

```python
# Prompt: "Split this document into logical sections. Return section titles and content."
# LLM returns structured sections → each section becomes a chunk
```

**Option C: Document-Aware Chunking (docling native)**

Docling already parses document structure (headings, paragraphs, tables). We can use its
structural output to create chunks that respect the document's natural hierarchy.

### Comparison

| Method | Chunk Quality | Cost | Latency | Documents/day | Best For |
|--------|:---:|:---:|:---:|:---:|---|
| Recursive (current) | ⭐⭐ | Free | Instant | ∞ | Getting started |
| Semantic | ⭐⭐⭐⭐ | ~$0.001/100 pages | 2-5s per doc | 10k+ | Structured docs |
| LLM Chunking | ⭐⭐⭐⭐⭐ | ~$0.01/100 pages | 5-15s per doc | 1k+ | High-value docs |
| Docling-structural | ⭐⭐⭐⭐ | Free | Instant | ∞ | PDFs, DOCX, PPTX |

### Implementation Steps

1. Install `langchain-experimental`
2. Add `RAG_CHUNK_METHOD` to config (values: `recursive`, `semantic`, `llm`)
3. Create `SemanticChunker` / `LLMChunker` in `app/services/chunking.py`
4. Benchmark: reindex 100 docs with each method, measure retrieval precision@5
5. Switch default when precision improves by >15%

### Pros
- **Semantic**: No more mid-sentence breaks, chunks are coherent topics
- **LLM**: Human-quality splitting, handles edge cases, extracts metadata

### Cons
- **Semantic**: Extra embedding calls (1 per sentence pair), 2-5x slower indexing
- **LLM**: Expensive at scale ($1-5 per 100 pages), latency per chunk decision
- **Both**: Inconsistent with very short documents (<2 paragraphs)

---

## 2. Hybrid Retrieval (Vector + Keyword)

### Current State
Pure cosine similarity vector search with `pgvector`. No keyword/BM25 fallback.
If the embedding model doesn't capture the right semantic meaning, results degrade.

### What to Upgrade

**Option A: BM25 + Vector Fusion (RRF)**

Reciprocal Rank Fusion combines BM25 keyword scores with vector similarity scores.

```python
# Step 1: BM25 keyword search on chunks.content
bm25_results = bm25_index.search(query, top_k=20)

# Step 2: Vector similarity search
vector_results = pgvector_search(embedding, top_k=20)

# Step 3: Reciprocal Rank Fusion
final = reciprocal_rank_fusion(bm25_results, vector_results, k=60)
```

**Option B: Postgres Full-Text Search + pgvector**

Use PostgreSQL's built-in `tsvector` for keyword search alongside `pgvector`:

```sql
SELECT c.*, 
       (1 - (c.embedding <=> :emb)) * 0.7 + 
       ts_rank(c.search_vector, plainto_tsquery('english', :query)) * 0.3 
       AS hybrid_score
FROM chunks c
WHERE c.organization_id = :org_id
  AND (c.embedding IS NOT NULL OR c.search_vector @@ plainto_tsquery('english', :query))
ORDER BY hybrid_score DESC
LIMIT :top_k;
```

**Option C: External Hybrid DB (Weaviate/Pinecone)**

Both Weaviate and Pinecone support hybrid search natively (vector + keyword in one query).

### Comparison

| Method | Precision@5 | Recall@10 | Latency | Complexity | Best For |
|--------|:---:|:---:|:---:|:---:|---|
| Vector only (current) | 0.65 | 0.70 | 10ms | Low | Semantic queries |
| BM25 + RRF fusion | 0.78 | 0.85 | 50ms | Medium | Mixed queries |
| Postgres hybrid (tsvector) | 0.75 | 0.82 | 20ms | Medium | Zero infra change |
| Weaviate/Pinecone hybrid | 0.80 | 0.88 | 15ms | High | Scale >100k docs |

*Benchmarks are approximate — real numbers depend on domain and document type.*

### Implementation Steps

1. Add `search_vector` column to `chunks` table (`tsvector` generated from `content`)
2. Create GIN index: `CREATE INDEX ON chunks USING GIN (search_vector)`
3. Update `PgVectorStore.search()` to compute hybrid score
4. Add `RAG_HYBRID_WEIGHT` config (0.0-1.0, default 0.7 for vector weight)
5. Add `RAG_HYBRID_ENABLED` config (default true)

### Pros
- Catches exact keyword matches that embeddings miss (product codes, IDs, names)
- Handles rare/domain-specific terms better
- Smooth degradation — if vector fails, keyword catches it

### Cons
- Extra index maintenance on every insert/update
- GIN index ~30% storage overhead on chunks table
- Tuning `RAG_HYBRID_WEIGHT` requires A/B testing per domain

---

## 3. Agentic Behavior (ReAct — Reasoning + Action)

### Current State
Simple RAG pipeline: embed question → retrieve chunks → stuff into prompt → generate answer.
No multi-step reasoning, no tool use, no follow-up retrieval.

### What to Upgrade

**Pattern: ReAct (Reasoning + Acting)**

The LLM iteratively: thinks → acts (searches, filters, calculates) → observes → thinks → answers.

```
User: "Compare our Q4 marketing budget against Q3 and tell me if we overspent"

Agent:
  Thought: I need to find Q4 and Q3 budget documents
  Action: search("Q4 marketing budget")
  Observation: Found 3 chunks in "Marketing/Q4 Budget.md"
  Thought: Now find Q3
  Action: search("Q3 marketing budget")
  Observation: Found 2 chunks in "Marketing/Q3 Budget.md"
  Thought: I have both. Let me calculate the comparison.
  Action: calculator("Q4_total - Q3_total")
  Observation: $12,500
  Answer: "Q4 budget ($45,000) exceeded Q3 ($32,500) by $12,500. The overspend was mainly in..."
```

**Implementation with LangChain:**

```python
from langchain.agents import create_react_agent
from langchain.tools import tool

@tool
def search_knowledge_base(query: str) -> str:
    """Search the Open Brain knowledge base for relevant information."""
    embedding = embed_text(query)
    store = get_vector_store()
    results = store.search(db, embedding, org_id, top_k=5)
    return format_results(results)

@tool
def search_by_keyword(keyword: str) -> str:
    """Exact keyword search across all documents."""
    results = keyword_search(db, org_id, keyword)
    return format_results(results)

tools = [search_knowledge_base, search_by_keyword]
agent = create_react_agent(llm, tools, prompt)
result = agent.invoke({"input": user_question})
```

**Implementation Steps:**

1. Create `app/services/agent.py` with ReAct agent using LangChain
2. Expose tools: `search_knowledge_base`, `search_by_keyword`, `list_folders`, `get_note`
3. Add `POST /organizations/{org_id}/rag/agent` endpoint
4. Frontend: "Deep Research" mode toggle in chatbot
5. Streaming: use `astream_events()` for real-time agent thought display

### Pros
- Handles multi-step queries (compare, calculate, summarize across sources)
- Self-corrects — if first search fails, tries different query
- Transparent — shows reasoning steps to user
- Scalable — add more tools (calculator, date parser, external APIs)

### Cons
- 3-10x slower than single RAG call (multiple LLM calls + searches)
- 3-10x more expensive (multiple LLM calls)
- Can hallucinate tool calls or get stuck in loops
- Harder to debug — need agent tracing/logging
- Needs good prompt engineering for ReAct to work reliably

---

## State of the Art — Scaling to Thousands of Documents

| Scale | Recommended Stack | Latency Target | Cost Estimate |
|-------|------------------|----------------|---------------|
| <100 docs | Current setup (vector only, recursive chunking) | <1s | $0/month |
| 100-1k docs | Add hybrid retrieval (Postgres tsvector) | <2s | $0/month |
| 1k-10k docs | Semantic chunking + hybrid + agent toggle | <5s | ~$5/month |
| 10k-100k docs | LLM chunking (high-value) + Weaviate/Pinecone hybrid | <3s | ~$25-70/month |
| 100k+ docs | Pinecone serverless + multi-stage retrieval + reranker | <2s | ~$100+/month |

### Multi-Stage Retrieval (10k+ docs)

1. **Coarse retrieval**: Hybrid search (vector + keyword) → top 100 candidates
2. **Reranker**: Cross-encoder model scores each candidate against the query → top 10
3. **Context compression**: LLM summarizes each chunk to 1-2 sentences → final context
4. **Agent**: Decides if answer is sufficient or needs follow-up retrieval

```python
# Stage 1: Coarse
candidates = hybrid_search(query, top_k=100)

# Stage 2: Rerank (Cohere or local cross-encoder)
from langchain.retrievers import CohereRerank
reranker = CohereRerank(top_n=10)
final_chunks = reranker.compress_documents(candidates, query)

# Stage 3: Compress
from langchain.retrievers import LLMChainExtractor
compressor = LLMChainExtractor.from_llm(llm)
compressed = compressor.compress_documents(final_chunks, query)
```

### When to Upgrade Each Component

| Trigger | Upgrade |
|---------|---------|
| Users complain about irrelevant results | Enable hybrid retrieval |
| Chunks cut sentences mid-way | Switch to semantic chunking |
| Users ask multi-part questions | Add agent mode toggle |
| Chunks miss document structure | Use docling structural output |
| >1000 documents, latency >3s | Add reranker + compression pipeline |
| >10k documents, costs rising | Migrate to Pinecone/Weaviate |

---

## Roadmap Priority

| Phase | What | Effort | Impact |
|-------|------|--------|--------|
| **Phase 1** (now) | Hybrid retrieval (tsvector) | 3h | High — immediate precision boost |
| **Phase 2** (next) | Semantic chunking toggle | 2h | Medium — better chunk coherence |
| **Phase 3** (later) | Agent mode for chatbot | 4h | High — unlocks complex queries |
| **Phase 4** (scale) | Reranker + compression | 3h | Medium — needed at 1000+ docs |
| **Phase 5** (optional) | LLM chunking for high-value docs | 2h | Low — expensive, niche benefit |

---

## Concrete Implementation Plan (Existing Codebase)

> **Rule:** All algorithms and configurations are controlled via environment variables.
> Current codebase settings become the **defaults**. No hardcoded values.

### New Environment Variables

Add to `backend/app/config.py` and `backend/.env.example`:

| Env Var | Default | Description |
|---------|---------|-------------|
| `RAG_CHUNK_METHOD` | `recursive` | Chunking method: `recursive`, `semantic`, `llm` |
| `RAG_SEMANTIC_THRESHOLD` | `90` | Percentile threshold for semantic chunking breakpoint |
| `RAG_HYBRID_ENABLED` | `false` | Enable hybrid retrieval (vector + keyword) |
| `RAG_HYBRID_VECTOR_WEIGHT` | `0.7` | Weight for vector score in hybrid (0.0-1.0) |
| `RAG_HYBRID_KEYWORD_WEIGHT` | `0.3` | Weight for keyword score in hybrid (0.0-1.0) |
| `RAG_RERANK_ENABLED` | `false` | Enable cross-encoder reranking |
| `RAG_RERANK_TOP_N` | `10` | Number of chunks to keep after reranking |
| `RAG_AGENT_ENABLED` | `false` | Enable agentic ReAct mode for chat |
| `RAG_AGENT_MAX_ITERATIONS` | `5` | Max reasoning steps for ReAct agent |
| `RAG_COARSE_TOP_K` | `100` | Candidates from initial vector search before rerank |
| `COHERE_API_KEY` | `""` | Cohere API key for reranker (only if `RAG_RERANK_ENABLED=true`) |

### File-by-File Changes

#### `backend/app/config.py`

Add these `Field` entries after the existing `rag_chunk_overlap`:

```python
# Chunking method
rag_chunk_method: str = Field(
    default="recursive",
    description="Chunking method: recursive | semantic | llm (env: RAG_CHUNK_METHOD)",
)
rag_semantic_threshold: int = Field(
    default=90,
    description="Percentile threshold for semantic chunking (env: RAG_SEMANTIC_THRESHOLD)",
)

# Hybrid retrieval
rag_hybrid_enabled: bool = Field(
    default=False,
    description="Enable hybrid vector + keyword retrieval (env: RAG_HYBRID_ENABLED)",
)
rag_hybrid_vector_weight: float = Field(
    default=0.7,
    description="Vector score weight in hybrid search (env: RAG_HYBRID_VECTOR_WEIGHT)",
)
rag_hybrid_keyword_weight: float = Field(
    default=0.3,
    description="Keyword score weight in hybrid search (env: RAG_HYBRID_KEYWORD_WEIGHT)",
)

# Reranker
rag_rerank_enabled: bool = Field(
    default=False,
    description="Enable cross-encoder reranking after retrieval (env: RAG_RERANK_ENABLED)",
)
rag_rerank_top_n: int = Field(
    default=10,
    description="Top N chunks to keep after reranking (env: RAG_RERANK_TOP_N)",
)
rag_coarse_top_k: int = Field(
    default=100,
    description="Candidates from initial vector search before rerank (env: RAG_COARSE_TOP_K)",
)

# Agent
rag_agent_enabled: bool = Field(
    default=False,
    description="Enable agentic ReAct mode for chat (env: RAG_AGENT_ENABLED)",
)
rag_agent_max_iterations: int = Field(
    default=5,
    description="Max reasoning steps for ReAct agent (env: RAG_AGENT_MAX_ITERATIONS)",
)

# External services
cohere_api_key: str = Field(
    default="",
    description="Cohere API key for reranker (env: COHERE_API_KEY)",
)
```

#### `backend/app/services/chunking.py`

Implement method dispatch based on `RAG_CHUNK_METHOD`:

```python
# Current function becomes _chunk_recursive()
# New functions: _chunk_semantic(), _chunk_llm()
# chunk_text() reads settings.rag_chunk_method and dispatches

def chunk_text(content: str) -> list[str]:
    settings = get_settings()
    if settings.rag_chunk_method == "semantic":
        return _chunk_semantic(content)
    elif settings.rag_chunk_method == "llm":
        return _chunk_llm(content)
    else:
        return _chunk_recursive(content)  # current logic — default
```

#### `backend/app/services/vector_store.py`

Add hybrid search to `PgVectorStore.search()`:

```python
async def search(self, db, embedding, org_id, top_k=10):
    settings = get_settings()

    if not settings.rag_hybrid_enabled:
        # Current pure vector search — unchanged
        return await self._vector_search(db, embedding, org_id, top_k)

    # Hybrid: vector + keyword
    # 1. Run vector search (coarse_top_k candidates)
    # 2. Run tsquery keyword search on search_vector column
    # 3. RRF fusion or weighted score combination
    return await self._hybrid_search(db, embedding, query_text, org_id, top_k)
```

**Migration needed:** Add `search_vector` column to `chunks` table:

```sql
ALTER TABLE chunks ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX ix_chunks_search ON chunks USING GIN (search_vector);
```

Hybrid SQL:

```sql
SELECT ..., 
    (:vector_weight * (1 - (c.embedding <=> :emb))) +
    (:keyword_weight * ts_rank(c.search_vector, plainto_tsquery('english', :q)))
    AS hybrid_score
FROM chunks c
WHERE ... 
  AND (c.embedding IS NOT NULL OR c.search_vector @@ plainto_tsquery('english', :q))
ORDER BY hybrid_score DESC
LIMIT :top_k
```

#### `backend/app/services/agent.py` (NEW FILE)

ReAct agent using LangChain tools:

```python
from langchain.agents import create_react_agent
from app.config import get_settings

# Tools
tools = [
    search_knowledge_base,  # vector search
    search_by_keyword,      # tsquery search (if hybrid enabled)
]

def get_agent():
    settings = get_settings()
    if not settings.rag_agent_enabled:
        return None
    return create_react_agent(llm, tools, prompt)
```

#### `backend/app/api/v1/chat.py`

Wire agent toggle:

```python
@router.post("", response_model=ChatResponse)
async def chat(...):
    settings = get_settings()

    if settings.rag_agent_enabled:
        # Agentic path — multi-step reasoning
        agent = get_agent()
        result = await agent.ainvoke({"input": body.question})
        # parse agent result
    else:
        # Current single-step RAG — unchanged
```

#### `backend/alembic/`

New migration for `search_vector` column + GIN index on `chunks`.

### Summary of All Config Defaults (Current = Production-Ready)

| Config | Default | When to change |
|--------|---------|----------------|
| `RAG_CHUNK_METHOD=recursive` | Recursive char splitting | Switch to `semantic` for better chunk coherence |
| `RAG_HYBRID_ENABLED=false` | Pure vector search | Enable when users need exact keyword matches |
| `RAG_HYBRID_VECTOR_WEIGHT=0.7` | 70% vector, 30% keyword | Tune per domain after A/B testing |
| `RAG_RERANK_ENABLED=false` | No reranking | Enable at >1000 docs for precision |
| `RAG_AGENT_ENABLED=false` | Single-step RAG | Enable for complex multi-source queries |
