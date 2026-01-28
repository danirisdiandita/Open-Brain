# OpenBrain Dashboard

Welcome to the **OpenBrain** dashboard project. This is an open-source "Second Brain" designed for modern thinkers, focusing on privacy, decentralization, and speed.

## 🚀 Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescript.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) with [Shadcn UI](https://ui.shadcn.com/)
- **Authentication**: [Better Auth](https://better-auth.com/)
- **Database**: [Prisma](https://www.prisma.io/) with PostgreSQL (Neon/Local)
- **Email**: [Resend](https://resend.com/)
- **Icons**: [Material Symbols Outlined](https://fonts.google.com/icons) & [Lucide React](https://lucide.dev/)

## 🎨 Design System

We follow a **Premium Light Mode** aesthetic (Zinc/Slate base) with the following characteristics:
- **Primary Color**: Sky Blue (`#0ea5e9` or `#2b9dee`)
- **Typography**: 
  - Display: **Manrope**
  - Body: **Inter** / **Outfit**
- **Aesthetics**: Glassmorphism, subtle micro-animations, and clean, high-contrast layouts.
- **Components**: Always prioritize **Shadcn UI** components.

## 📁 Key Directories

- `app/`: Next.js pages and layouts.
- `components/ui/`: Shadcn UI components.
- `lib/`: Utility functions and client/server initialization (auth, prisma).
- `constants/`: Configuration and global constants.
- `prisma/`: Database schema and migrations.

## 🛠 Project Status & Rules

### Current State
- **Landing Page**: Redesigned with a v2.0 premium look (Split-screen hero, interactive graph).
- **Auth**: Fully functional with Better Auth, styled with Shadcn.
- **Dashboard**: Simple overview dashboard implemented.
- **Infrastructure**: Connected to Resend for email verification (verified key in `.env`).

### Engineering Principles (OpenBrain Standard)
1. **Interactive State Management**: 
   - When a button triggers a data-fetching or mutation event, it **MUST** be disabled immediately.
   - A **Shadcn Spinner** must be displayed within the button or context during the operation.
   - Upon completion, a **Sonner Toast** must be triggered to notify the user of success or failure.
2. **Data Mutations**:
   - All mutations must use **TanStack Query** (`useMutation`).
   - Mutations **MUST** be encapsulated in a custom hook located in the `hooks/` directory.
   - Direct `fetch` calls within components are prohibited for mutations.
   - Use Standard `fetch` instead of `axios` 
3. **Shadcn First**: When creating new UI, always use or install Shadcn components.
4. **Light Mode Only**: The user prefers a clean, bright aesthetic over dark mode for this project.
5. **Icons consistency**: Use Material Symbols for core branding/hero sections and Lucide for standard dashboard UI.
6. **Data Sovereignty**: Keep privacy-first principles in mind when adding features.

## 📝 Ongoing Tasks

- [x] Integrate Yjs & Tiptap for real-time notes.
- [ ] Connect persistence to Hocuspocus server (PostgreSQL/LevelDB).
- [ ] Implement "Knowledge Tags" management.
- [ ] Implement end-to-end encryption for notes.

## 🚀 Running the App
1. **Frontend**: `npm run dev`
2. **Collaboration**: `npm run collaboration` (Starts the WebSocket server on port 1234)

---
*Created and maintained by Antigravity AI.*
