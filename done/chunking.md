# Chunking Strategy — OpenBrain

## Approach: Hierarchical Chunking

Split notes by document structure first (headings), then fall back to paragraph-level splits. Store a `chunks` table that each chunk links to its parent note and knows its heading path for context retrieval.

### Chunking Rules

| Note Size | Strategy |
|-----------|----------|
| < 1000 tokens | One chunk — embed the entire note |
| 1000–4000 tokens | Split by `##` headings, embed each section |
| Section > 500 tokens | Split further by `\n\n` (paragraphs), 10% overlap |

### Pseudo-Algorithm

```text
1. Count tokens in note.content
2. If token_count < 1000 → single chunk (whole note)
3. Else:
   a. Split by markdown headings (##, ###)
   b. For each section:
      - If section < 500 tokens → one chunk
      - Else → split by paragraphs with 10 token overlap between adjacent chunks
4. Each chunk stores:
   - chunk_index (order within the note)
   - heading_path (concatenated heading chain, e.g. "API > Endpoints > Auth")
   - content (the text to embed)
   - token_count (for filtering/retrieval)
```

### Overlap

At each paragraph boundary, include the last 1-2 sentences of the previous chunk as context. This prevents information loss at split points.

```text
Chunk 1: "Lorem ipsum dolor sit amet. Consectetur adipiscing elit. Sed do eiusmod."
Chunk 2: "Sed do eiusmod. Tempor incididunt ut labore et dolore magna aliqua."
                                    ^^^^^^^^^^^^^ overlap
```

## Chunks Table

```sql
CREATE TABLE chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content     TEXT NOT NULL,
  heading_path TEXT,                           -- e.g. "Getting Started > Installation"
  token_count INTEGER NOT NULL DEFAULT 0,
  embedding   vector(1536),                    -- pgvector — depends on model dimension
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chunks_note ON chunks (note_id);
```

| Column | Purpose |
|--------|---------|
| `note_id` | Parent note |
| `chunk_index` | Ordering — reconstruct the note from chunks |
| `content` | The chunk text to embed |
| `heading_path` | Context breadcrumb for the LLM ("from the Installation section...") |
| `token_count` | Filter out tiny/empty chunks |
| `embedding` | pgvector — the actual vector for similarity search |

## Retrieval Flow (RAG Pipeline)

1. **User asks a question** → embed the question
2. **Search** → `SELECT * FROM chunks ORDER BY embedding <=> question_embedding LIMIT 10`
3. **Context assembly** → for each chunk, include `heading_path` + `content`
4. **LLM prompt** → system message + retrieved chunks + user question
5. **Response** → grounded in the user's own knowledge base

## Why Not Fixed-Size?

| Method | Issue |
|--------|-------|
| Fixed 512 tokens | Cuts sentences in half, destroys meaning |
| Recursive (`\n`, `.`, ` `) | Better boundaries, but ignores document structure |
| Semantic (similarity) | Most coherent, but slow and expensive to run on every note |
| **Hierarchical** | Respects document structure, fast, meaningful chunks |

## Re-Indexing Triggers

- **Note created** → auto-chunk + queue embeddings
- **Note updated** → delete old chunks, re-chunk, re-embed
- **Note deleted** → cascade delete all chunks
- **Batch** — mark chunks as stale, process in background via job queue (Celery / Redis)
