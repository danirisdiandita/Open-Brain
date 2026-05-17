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
