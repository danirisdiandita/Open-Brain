# OpenBrain Design System

> For React + Tailwind + AI-agent-friendly implementation

## 1. Design Principles

**Core Philosophy:**
- **Minimal** — nothing unnecessary
- **Fast** — instant navigation, no waiting
- **Structured** — predictable patterns everywhere
- **AI-native** — AI feels embedded, not bolted on
- **Low cognitive load** — engineers hate noisy UIs

**UX Goals:**
- Documentation first — content is the hero
- Tree navigation always visible — sidebar is persistent
- AI feels integrated — subtle purple, contextual
- Dense but breathable — Notion-like information density
- Keyboard-first UX — `Cmd+K` search, `Cmd+S` save, arrows for tree

---

## 2. Color System

Mostly neutral. One strong accent (indigo). AI-specific accent (purple).

### Light Mode

| Token | Hex | Tailwind |
|-------|-----|----------|
| Background | `#FAFAFA` | `bg-stone-50` |
| Surface | `#FFFFFF` | `bg-white` |
| Border | `#E5E7EB` | `border-gray-200` |
| Text Primary | `#111827` | `text-gray-900` |
| Text Secondary | `#6B7280` | `text-gray-500` |
| Text Muted | `#9CA3AF` | `text-gray-400` |
| Primary | `#4F46E5` | `bg-indigo-600` |
| Primary Hover | `#4338CA` | `hover:bg-indigo-700` |
| Primary Soft | `#EEF2FF` | `bg-indigo-50` |
| Success | `#22C55E` | `text-green-500` |
| Warning | `#F59E0B` | `text-amber-500` |
| Danger | `#EF4444` | `text-red-500` |
| AI Accent | `#7C3AED` | `bg-purple-600` |
| AI Soft | `#F3E8FF` | `bg-purple-50` |

### Dark Mode (Sidebar)

| Token | Hex | Tailwind |
|-------|-----|----------|
| Sidebar Background | `#021b33` | Navy |
| Sidebar Text | `#e2e8f0` | Slate-200 |
| Sidebar Accent | `#383782` | Indigo |
| Sidebar Active | `bg-sidebar-accent` | shadcn token |

---

## 3. Typography

**Font:** Inter (body), Geist or DM Sans (editor)

**Scale:**

| Role | Class | Usage |
|------|-------|-------|
| Page Title | `text-4xl font-semibold` | Dashboard, "Engineering" |
| Section Title | `text-xl font-semibold` | "Workspace Structure" |
| Card Title | `text-sm font-semibold` | Note/folder card names |
| Body | `text-[15px]` | Editor content |
| Sidebar Item | `text-sm` | Folder tree items |
| Caption | `text-xs text-muted-foreground` | Dates, file sizes |
| Badge | `text-[10px]` | Role badges, format badges |

---

## 4. Layout System

```
┌───────────┐ ┌─────────────────────┐ ┌──────────┐
│  Sidebar  │ │      Content         │ │  Panel   │
│   280px   │ │      fluid          │ │  320px   │
│           │ │                     │ │  (chat,  │
│  nav      │ │  editor / table     │ │  AI)     │
│  tree     │ │                     │ │          │
│  footer   │ │                     │ │          │
└───────────┘ └─────────────────────┘ └──────────┘
```

**Widths:**
- Sidebar: `280px` (shadcn `--sidebar-width`)
- Content: flex-1 (fluid)
- Right Panel: `320px` (chat, context)

**Spacing scale** — use ONLY these: `1(4px), 2(8px), 3(12px), 4(16px), 6(24px), 8(32px)`. No arbitrary `space-y-5`, `p-7`, etc.

---

## 5. Sidebar Tree Design

### Tree Item Anatomy

```
[Chevron] [Icon] [Title] [Actions]
```

### States

| State | Classes |
|-------|---------|
| Default | `text-sidebar-foreground/70` |
| Hover | `hover:bg-sidebar-accent/20` |
| Selected | `bg-sidebar-accent text-sidebar-accent-foreground` |
| Dragging | `opacity-50 border border-dashed` |

### Indentation

```
Level 0 → pl-2
Level 1 → pl-6
Level 2 → pl-10
Level 3 → pl-14
```

### Tailwind Example

```tsx
<div className="
  flex items-center gap-2 h-8 px-2 rounded-md
  hover:bg-gray-100 cursor-pointer transition-colors
">
  <ChevronRight className="h-4 w-4" />
  <Folder className="h-4 w-4" />
  <span className="text-sm truncate">Engineering</span>
</div>
```

---

## 6. AI Assistant Design Language

**Do NOT make it look like a ChatGPT clone.**

### AI Components Should:
- Feel contextual — embedded into docs, not floating
- Use subtle purple accents — NOT the primary indigo
- Have minimal shadows — AI is quiet, not loud

### AI Accent Rules

Use AI purple **ONLY** for:
- AI assistant (chat, suggestions)
- Semantic search / RAG responses
- AI-generated content badges

**NOT** for: navigation, buttons, folders, general UI.

### AI Card

```tsx
<div className="
  bg-purple-50 border border-purple-200
  rounded-2xl p-4
">
  <Sparkles className="h-4 w-4 text-purple-600" />
  <p>AI suggestion...</p>
</div>
```

---

## 7. Card System

### All Cards

```
rounded-2xl border bg-white shadow-sm
```

### Hoverable Cards

```
hover:shadow-md transition-all cursor-pointer
```

### Example

```tsx
<Card className="cursor-pointer hover:shadow-md transition-shadow p-4 group">
  <div className="flex items-start gap-3">
    <Folder className="h-5 w-5 shrink-0 text-indigo-400" />
    <div className="min-w-0">
      <h3 className="font-semibold text-sm truncate">Engineering</h3>
      <p className="text-[10px] text-muted-foreground">Yesterday</p>
    </div>
    <div className="ml-auto opacity-0 group-hover:opacity-100">
      {/* actions */}
    </div>
  </div>
</Card>
```

---

## 8. Button System

| Variant | Classes |
|---------|---------|
| **Primary** | `bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-4 font-medium` |
| **Ghost** | `hover:bg-gray-100 text-gray-700 rounded-lg` |
| **AI** | `bg-purple-600 hover:bg-purple-700 text-white rounded-xl` |
| **Icon** | `h-7 w-7 rounded-md hover:bg-muted` |
| **Danger** | `bg-red-500 hover:bg-red-600 text-white` |

### Size Variants

| Size | Height | Padding | Font |
|------|--------|---------|------|
| `sm` | `h-8` | `px-3` | `text-xs` |
| `md` | `h-10` | `px-4` | `text-sm` |
| `lg` | `h-12` | `px-6` | `text-base` |

---

## 9. Content Editor Design

Clean markdown feel. NOT a Google Docs clone.

### Content Width

```tsx
max-w-4xl  // 896px — critical for readability
```

### Headings in Editor

```
H1 → text-3xl font-bold
H2 → text-2xl font-semibold
H3 → text-xl font-medium
```

### Code Blocks

```tsx
<div className="
  bg-gray-50 border rounded-xl
  font-mono text-sm p-4
  overflow-x-auto
">
```

### Editor Container

```tsx
<div className="
  bg-background rounded-lg shadow-lg
  flex-1 flex flex-col
">
  <EditorContent className="prose prose-sm max-w-none p-6" />
</div>
```

---

## 10. Component Architecture

AI agents LOVE predictable systems. Follow this structure:

```
/components
  /ui          — shadcn primitives (Button, Input, Card, Dialog, etc.)
  /layout      — Sidebar, Header, Breadcrumbs
  /tree        — FolderTree, TreeItem
  /editor      — SimpleEditor, NoteEditor
  /ai          — Chatbot, AIAnswerCard, AISuggestion
  /wiki        — FolderContent, FolderFlow, NotePage
```

### Naming Convention

- `SidebarTree.tsx` — the whole tree
- `TreeItem.tsx` — single tree node
- `WikiEditor.tsx` — the editor
- `AIAnswerCard.tsx` — RAG answer with sources
- `Breadcrumbs.tsx` — navigation path

### Component Rules

Components MUST:
- Have deterministic props (no magic strings)
- Avoid hidden styling logic
- Use variant system for visual choices

**Good:**
```tsx
<Button variant="primary" size="sm">Save</Button>
```

**Bad:**
```tsx
<button className="bg-indigo-600 text-white px-3 py-1">Save</button>
```

---

## 11. Icons

Use `lucide-react` exclusively.

| Context | Icon |
|---------|------|
| Folder | `Folder` |
| Note/Document | `FileText` |
| Expand tree | `ChevronRight` |
| AI/Sparkle | `Sparkles` |
| Chat | `MessageCircle` |
| Add | `Plus` |
| More actions | `MoreHorizontal` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| Move | `ArrowRightLeft` |
| Upload | `Upload`, `FileUp` |
| Team | `Users` |
| Admin | `Crown` |
| Editor | `Shield` |
| Link | `ExternalLink` |
| Drag | `GripVertical` |
| Copy | `Copy` |

---

## 12. Motion Rules

Subtle only. Use `framer-motion` or CSS transitions.

### Good
- Fade in (`opacity 0→1, 150ms`)
- Expand/collapse (`max-height transition`)
- Hover elevation (`shadow-sm → shadow-md, 200ms`)
- Chevron rotation (`rotate-0 → rotate-90, 200ms`)

### Bad
- Bouncing animations
- Flashy AI sparkle animation
- Heavy parallax
- Auto-scrolling carousels

---

## 13. Accessibility Rules

**Mandatory:**
- Keyboard tree navigation (arrows to expand/collapse, Enter to select)
- Visible focus rings (`focus-visible:ring-2`)
- `Cmd+K` search (command palette)
- `aria-expanded` on tree nodes
- `role="tree"` on sidebar folder list
- All interactive elements reachable via Tab

---

## 14. Engineering Rules

### Never
- ❌ Hardcode colors (`#4F46E5` → use `bg-indigo-600`)
- ❌ Inline styles (`style={{ color: 'red' }}`)
- ❌ Arbitrary spacing (`mb-7`, `p-[13px]`)
- ❌ Component-specific color systems

### Always
- ✅ Use Tailwind tokens / shadcn CSS variables
- ✅ Reusable variants (CVA or shadcn pattern)
- ✅ Semantic naming (`bg-muted` not `bg-gray-100`)
- ✅ Centralized theme in `index.css` / tailwind config

---

## 15. AI-Agent-Friendly Rules

If AI agents will generate UI, components MUST:
- Have deterministic, typed props
- Avoid hidden/conditional styling logic
- Use a variant system for all visual choices
- Export clear interfaces

**Good:**
```tsx
interface ButtonProps {
  variant: "primary" | "ghost" | "ai" | "danger"
  size: "sm" | "md" | "lg"
  children: ReactNode
}
```

**Bad:**
```tsx
// "Make it purple if AI, indigo otherwise" — not deterministic
```

---

## 16. Recommended Stack

| Layer | Library | Why |
|-------|---------|-----|
| UI | Tailwind CSS 3 | Utility-first, fast |
| Components | shadcn/ui | Headless, customizable |
| Icons | lucide-react | Consistent, beautiful |
| State | Zustand | Simple, no boilerplate |
| Forms | React Hook Form + Zod | Type-safe validation |
| Editor | TipTap | ProseMirror-based, extensible |
| Tree | react-arborist | Drag-drop, keyboard nav |
| AI | Vercel AI SDK | Streaming, tool calling |
| Animation | CSS transitions | No heavy deps needed |

---

## 17. Final Visual Direction

Your UI should feel like:

```
Notion
+ Linear
+ GitHub Docs
+ AI-native workspace
```

**NOT:**
- ChatGPT clone (chat-first)
- Super colorful startup SaaS (noisy)
- Traditional wiki (boring)

**Because:**
- Engineers hate noisy UIs
- Documentation needs clarity
- AI should assist quietly — not dominate the interface