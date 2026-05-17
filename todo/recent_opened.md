# Recent Opened Files

## Feature

Show a "Recently Opened" section on the Dashboard page (`/dashboard/<org>`) that tracks which notes the user has recently viewed and displays them for quick access.

## Approach Decision

**Initial plan (deprecated):** localStorage — per-browser, no backend, simple.

**Final plan (this doc):** Database table — per-user, persists across devices/browsers, survives cache clears. Only tracks which note was opened and when. The note metadata (title, folder path) is JOINed at query time — no stale data.

---

## Database Schema

### New Table: `recent_documents`

```sql
CREATE TABLE recent_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id, note_id)
);
```

**Why UNIQUE(user_id, note_id):** Each user tracks only the latest open for a note. Re-opening the same note updates `opened_at` via `ON CONFLICT`. No duplicate rows.

### Query (Get top 8 recent)

```sql
SELECT n.id, n.title, n.folder_id, rd.opened_at
FROM recent_documents rd
JOIN notes n ON n.id = rd.note_id
WHERE rd.user_id = $1 AND rd.organization_id = $2
ORDER BY rd.opened_at DESC
LIMIT 8;
```

### Upsert (Track a note open)

```sql
INSERT INTO recent_documents (user_id, organization_id, note_id, opened_at)
VALUES ($1, $2, $3, now())
ON CONFLICT (user_id, note_id)
DO UPDATE SET opened_at = now();
```

### Cleanup (Keep only last 15 per user)

```sql
DELETE FROM recent_documents
WHERE user_id = $1 AND id NOT IN (
    SELECT id FROM recent_documents
    WHERE user_id = $1
    ORDER BY opened_at DESC
    LIMIT 15
);
```

Cleanup runs on every insert (after upsert) as a lightweight background task.

---

## Backend Files to Create

| File | Purpose |
|------|---------|
| `app/models/recent.py` | `RecentDocument` SQLAlchemy model |
| `app/services/recent.py` | `track_open()`, `get_recent()` service functions |
| `app/api/v1/recent.py` | `GET /organizations/{org_id}/recent` + `POST` track endpoint |

## Backend Files to Modify

| File | Change |
|------|--------|
| `app/api/v1/router.py` | Mount `recent_router` |
| `alembic/env.py` | Import `RecentDocument` model |
| Alembic migration | Create `recent_documents` table |

## Backend API

### `GET /organizations/{org_id}/recent`

Returns last 8 recently opened notes with title + folder info.

```json
[
  {
    "note_id": "uuid",
    "title": "Deployment Guide",
    "folder_id": "uuid or null",
    "folder_name": "Engineering",
    "opened_at": "2026-05-17T15:42:00Z"
  }
]
```

### `POST /organizations/{org_id}/recent`

Records that the current user opened a note. Called by frontend whenever a note page mounts.

```json
{ "note_id": "uuid" }
```

Returns `{"tracked": true}`.

---

## Frontend Changes

### Files to Create

| File | Purpose |
|------|---------|
| `hooks/useRecentNotes.ts` | TanStack Query hook: fetch recent, mutate track |

### Files to Modify

| File | Change |
|------|--------|
| `pages/NotePage.tsx` | Call `trackRecentNote()` mutation on mount |
| `pages/dashboard/DashboardPage.tsx` | Show "Recently Opened" card strip |
| `components/FolderContent.tsx` | Call `trackRecentNote()` when clicking a note row |
| `pages/dashboard/UncategorizedPage.tsx` | Same as FolderContent |

### Hook (`hooks/useRecentNotes.ts`)

```ts
export function useRecentNotes(orgId?: string) {
  const queryClient = useQueryClient()

  const { data: recentNotes } = useQuery({
    queryKey: ["recent", orgId],
    queryFn: () => api.get(`/organizations/${orgId}/recent`).then((r) => r.data),
    enabled: !!orgId,
  })

  const trackMutation = useMutation({
    mutationFn: (noteId: string) =>
      api.post(`/organizations/${orgId}/recent`, { note_id: noteId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recent", orgId] }),
  })

  return { recentNotes: (recentNotes ?? []) as RecentNote[], trackRecentNote: trackMutation.mutate }
}
```

### Placement on DashboardPage

Between the header row (title + buttons) and the Root section (table/grid). Appears as an `overflow-x-auto` horizontal card strip with 4-8 cards. Hidden when no recent notes exist.

```
Dashboard header (title + buttons)
──────────────────────────────────
Recently Opened (card strip)      ← NEW
──────────────────────────────────
Root (folders + notes table/grid)
```

### UX Card

Same as the original localStorage plan — horizontal scrollable cards with: FileText icon, title (truncated), relative time ("2 min ago"), folder name.

---

## Comparison: localStorage vs Database

| | localStorage | Database |
|---|:---:|:---:|
| Persists across devices | ❌ | ✅ |
| Survives cache clear | ❌ | ✅ |
| Unique per user | ❌ (per browser) | ✅ |
| Needs backend | ❌ | ✅ |
| Complexity | Low | Medium |
| Fresh title/folder data | Stale after rename | Always current (JOIN) |
| **Chosen** | | ✅ |

---

## Testing

| Test | Expected |
|------|----------|
| Open 3 notes → GET /recent | Returns 3, most recent first |
| Re-open same note | `opened_at` updates, count stays 3 |
| Open 20 notes | Only last 15 kept |
| Open note in different org | Only shows for that org |
| Click recent card on Dashboard | Navigates to that note |
| Delete a note | `ON DELETE CASCADE` removes the row |

## UX

```
┌─────────────────────────────────────────────────────────┐
│  Recently Opened                              See All → │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 📝 Doc A  │ │ 📝 Doc B  │ │ 📝 Doc C  │ │ 📝 Doc D  │   │
│  │ 2 min ago │ │ 1 hr ago  │ │ Yesterday │ │ 3 days ago│   │
│  │ Engineering│ │ Marketing │ │ Uncategor.│ │ Product   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Behavior

- **Track**: Every time a user opens a note (clicks to view), record it
- **Display**: Show last 4-8 recently opened notes as cards on the Dashboard
- **Persist**: Store in localStorage (no backend needed — it's per-user, per-browser)
- **Deduplicate**: Same note opened multiple times → only the most recent entry
- **Order**: Most recent first
- **Click**: Navigate to the note
- **See All**: Link to a full history page (future) or expand the list

## Data Structure

```ts
// Stored in localStorage key: "recentNotes:<orgId>"
interface RecentNote {
  noteId: string
  title: string
  folderPath: string   // e.g. "Engineering > Backend" or "Uncategorized"
  openedAt: number      // Date.now() timestamp
}
```

Max entries: 8 (configurable). Oldest dropped when exceeding limit.

## When to Track

Record an entry when the user navigates to:
- `/dashboard/<org>/note/<noteId>` — NotePage opens
- Any click on a note card/row in FolderContent, Dashboard Root, Uncategorized

Do NOT track:
- AI-generated navigation (auto-redirects)

## Where to Place

On the Dashboard page, between the header buttons row and the Root table. Or as a horizontal scrollable card strip at the top of the content area.

```
Dashboard header (title + buttons)
──────────────────────────────────
Recently Opened (card strip)
──────────────────────────────────
Root (folders + uncategorized notes table/grid)
```

## Implementation — Concrete File-by-File

> **Audit date:** 2026-05-17. All file paths are relative to `frontend/src/`.

### Files to Create (1)

| File | Purpose |
|------|---------|
| `hooks/useRecentNotes.ts` | Hook: read/write localStorage, expose `recentNotes`, `addRecentNote()`, `clearRecent()` |

### Files to Modify (4)

| File | What changes |
|------|-------------|
| `pages/NotePage.tsx` | Call `addRecentNote()` when the note is fully loaded (line 24, inside `useEffect([note])`) |
| `pages/dashboard/DashboardPage.tsx` | Add "Recently Opened" card strip between header and Root section (around line 154) |
| `components/FolderContent.tsx` | Call `addRecentNote()` inside `handleRowClick` when clicking a note row |
| `pages/dashboard/UncategorizedPage.tsx` | Call `addRecentNote()` inside the note table row `onClick` + note card `onClick` |

### Step-by-Step

#### Step 1: Create `hooks/useRecentNotes.ts`

```ts
// NEW FILE: frontend/src/hooks/useRecentNotes.ts
import { useState, useEffect, useCallback } from "react"

interface RecentNote {
  noteId: string
  title: string
  folderPath: string
  openedAt: number
}

const MAX_ENTRIES = 8

export function useRecentNotes(orgId?: string) {
  const key = orgId ? `recentNotes:${orgId}` : null

  const [notes, setNotes] = useState<RecentNote[]>(() => {
    if (!key) return []
    try {
      return JSON.parse(localStorage.getItem(key) || "[]")
    } catch { return [] }
  })

  useEffect(() => {
    if (!key) return
    const stored = localStorage.getItem(key)
    if (stored) {
      try { setNotes(JSON.parse(stored)) } catch {}
    }
  }, [key])

  const addNote = useCallback((note: { id: string; title: string; folderPath: string }) => {
    if (!key) return
    setNotes((prev) => {
      const filtered = prev.filter((n) => n.noteId !== note.id)
      const next = [
        { noteId: note.id, title: note.title, folderPath: note.folderPath, openedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_ENTRIES)
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }, [key])

  const clearAll = useCallback(() => {
    if (!key) return
    setNotes([])
    localStorage.removeItem(key)
  }, [key])

  return { recentNotes: notes, addRecentNote: addNote, clearRecent: clearAll }
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return new Date(ts).toLocaleDateString()
}
```

#### Step 2: Update `pages/NotePage.tsx` (line ~24)

**Current code** (lines 23-28):
```tsx
useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content ?? "")
    }
  }, [note])
```

**Add after** `setContent(note.content ?? "")`:
```tsx
addRecentNote({ id: note.id, title: note.title, folderPath: note.folder_id ? "..." : "Uncategorized" })
```

Need to import `useRecentNotes` and get the folder path. The folder path can be derived from the folder tree or a simpler lookup. Since `useRecentNotes` accepts `orgId` which `NotePage` already has via `useOrganization()`, just add:

```tsx
const { addRecentNote } = useRecentNotes(orgId)
```

For `folderPath`, use a simple fallback: `note.folder_id ? "In folder" : "Uncategorized"`. Or fetch the folder name if easily available.

#### Step 3: Update `pages/dashboard/DashboardPage.tsx` (around line 154)

Insert the "Recently Opened" card strip **after** the header row (`</div>` closing the `flex items-start justify-between` div) and **before** the `registered` card check (or after it).

```tsx
const { recentNotes } = useRecentNotes(orgId)
```

**Insert this block:**
```tsx
{recentNotes.length > 0 && (
  <div className="space-y-2">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recently Opened</h3>
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
      {recentNotes.map((n) => (
        <Card
          key={n.noteId}
          className="shrink-0 w-44 cursor-pointer hover:shadow-md transition-shadow p-3"
          onClick={() => navigate(`/dashboard/${selectedOrg?.slug}/note/${n.noteId}`)}
        >
          <FileText className="h-4 w-4 text-slate-400 mb-1.5" />
          <p className="text-sm font-medium truncate">{n.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime(n.openedAt)}</p>
          <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">{n.folderPath}</p>
        </Card>
      ))}
    </div>
  </div>
)}
```

#### Step 4: Update `components/FolderContent.tsx`

In `handleRowClick`, when the row is a note, call `addRecentNote()`:

```tsx
const handleRowClick = (row: TableRow) => {
    if (!selectedOrg) return
    if (row.kind === "folder") {
      // ... existing folder navigation
    } else {
      addRecentNote({
        id: row.data.id,
        title: row.data.title,
        folderPath: currentFolderName || "In folder",
      })
      navigate(`/dashboard/${selectedOrg.slug}/note/${row.data.id}`)
    }
  }
```

Need to import `useRecentNotes` and call `const { addRecentNote } = useRecentNotes(orgId)`.

#### Step 5: Update `pages/dashboard/UncategorizedPage.tsx`

Same as FolderContent — call `addRecentNote()` in the table row and card `onClick` handlers before navigating to the note.

### Folder Path Resolution

For accurate folder paths, use the existing `getFolderPath()` helper in DashboardPage or a simple lookup:

```tsx
// Fast fallback — no additional query needed
const folderPath = note.folder_id
  ? folders?.find((f) => f.id === note.folder_id)?.name ?? "In folder"
  : "Uncategorized"
```

Or for deeper paths, reuse `getFolderPath(folderId, folders)` if `folders` are available.

### Testing

| Test | Expected |
|------|----------|
| Open a note → go to Dashboard | Note appears in "Recently Opened" |
| Open same note twice | Only one entry (most recent) |
| Open 10 different notes | Only 8 shown (oldest dropped) |
| Open note in different org | Only shows notes for current org |
| Clear browser storage | "Recently Opened" disappears |
| Click a recent note card | Navigates to that note |
| No notes opened yet | Section hidden entirely |
