# Notes Table — Suggested Schema

The `notes` table stores the actual wiki pages / knowledge base articles within folders.

## Table: `notes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, gen_random_uuid() |
| `organization_id` | UUID → organizations.id | FK, NOT NULL, `ON DELETE CASCADE` |
| `folder_id` | UUID → folders.id | FK, nullable — `null` = root-level note |
| `title` | varchar(512) | NOT NULL |
| `slug` | varchar(512) | NOT NULL, URL-friendly |
| `content` | text | Markdown or rich text body |
| `content_type` | varchar(16) | DEFAULT `'markdown'` — `markdown` / `richtext` |
| `is_published` | boolean | DEFAULT `false` |
| `order_index` | integer | DEFAULT `0`, manual ordering within folder |
| `created_by` | UUID → users.id | FK, NOT NULL |
| `updated_by` | UUID → users.id | FK, nullable |
| `created_at` | timestamptz | DEFAULT `now()` |
| `updated_at` | timestamptz | DEFAULT `now()`, auto-updated |

## Constraints

```sql
UNIQUE (folder_id, slug)   -- no duplicate slugs within the same folder
```

For root-level notes (`folder_id IS NULL`), slug uniqueness should be scoped to `organization_id`:

```sql
-- Optional: enforce globally unique root slugs per org
CREATE UNIQUE INDEX uq_note_org_root_slug
  ON notes (organization_id, slug)
  WHERE folder_id IS NULL;
```

## RAG / Indexing Columns (future)

Once you add document indexing:

| Column | Type | Notes |
|--------|------|-------|
| `embedding_status` | varchar(16) | DEFAULT `'pending'` — `pending` / `processing` / `indexed` / `error` |
| `last_indexed_at` | timestamptz | nullable |
| `chunk_count` | integer | nullable — number of text chunks after splitting |

## Why This Design

- **folder_id nullable** — notes can live at the org root (no folder), or nested inside any folder
- **slug scoped to folder** — `/docs/api/rest` is the path, each segment is a slug unique within its parent folder
- **content_type** — allows future rich-text / WYSIWYG editing alongside Markdown
- **is_published** — draft/publish workflow without deleting
- **embedding_status** — async indexing pipeline: create note → queue for embedding → mark as indexed
