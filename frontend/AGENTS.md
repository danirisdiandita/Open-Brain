# AGENTS.md — Open Brain Frontend

Vite + React + TypeScript frontend consuming the FastAPI backend.

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts            # Axios instance with auth interceptors + token refresh
│   │   └── auth.ts              # Auth API functions (register, login, refresh, verify, reset, etc.)
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives (Button, Input, Card, Form, Label, Sidebar, etc.)
│   │   └── AppSidebar.tsx       # Main sidebar navigation component
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state provider (tokens, setTokens, logout, isAuthenticated)
│   ├── hooks/
│   │   ├── index.ts             # Barrel export for all hooks
│   │   ├── use-mobile.tsx       # Mobile breakpoint detection
│   │   ├── useLogin.ts          # POST /auth/login mutation
│   │   ├── useRegister.ts       # POST /auth/register mutation
│   │   ├── useLogout.ts         # Clear tokens + navigate to /login
│   │   ├── useForgotPassword.ts # POST /auth/forgot-password mutation
│   │   ├── useResetPassword.ts  # POST /auth/reset-password mutation
│   │   ├── useVerifyEmail.ts    # POST /auth/verify-email mutation
│   │   └── useResendVerification.ts # POST /auth/resend-verification mutation
│   ├── lib/
│   │   └── utils.ts             # cn() utility (clsx + tailwind-merge)
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── index.ts             # Barrel export for auth pages
│   │   │   ├── LoginPage.tsx        # Sign-in form
│   │   │   ├── RegisterPage.tsx     # Sign-up form
│   │   │   ├── ForgotPasswordPage.tsx   # Request password reset
│   │   │   ├── ResetPasswordPage.tsx    # Set new password
│   │   │   └── VerifyEmailPage.tsx      # Email verification landing
│   │   ├── dashboard/
│   │   │   ├── index.ts             # Barrel export for dashboard pages
│   │   │   ├── DashboardLayout.tsx  # Authenticated layout (sidebar/header + Outlet)
│   │   │   └── DashboardPage.tsx    # Main dashboard (protected)
│   │   ├── LandingPage.tsx      # Public landing page
│   │   └── NotFoundPage.tsx     # 404 fallback
│   ├── App.tsx                  # Routes + GuestRoute/ProtectedRoute wrappers
│   ├── main.tsx                 # Entry: QueryClientProvider + App
│   └── index.css                # Tailwind directives + shadcn CSS variables
├── components.json              # shadcn/ui configuration
├── tailwind.config.js           # Tailwind v3 config (shadcn theme colors)
├── postcss.config.js            # PostCSS (autoprefixer + tailwind)
├── vite.config.ts               # Vite config (@/ alias, proxy /api → localhost:8000)
├── tsconfig.app.json            # TypeScript config with @/* path alias
└── package.json
```

## Code Conventions

### File Organization

- **`src/pages/auth/`** — authentication pages (login, register, password reset, email verify)
- **`src/pages/dashboard/`** — authenticated dashboard pages (layout, dashboard)
- **`src/pages/` (root)** — top-level pages (landing, 404)
- **`src/components/AppSidebar.tsx`** — sidebar navigation (reused in dashboard layout)
- **`src/components/ui/`** — shadcn/ui primitives (auto-generated)

### Naming

- Page components use `PascalCase` with `Page` suffix (e.g. `LoginPage.tsx`)
- Barrel exports in `index.ts` use named exports
- Hooks use `use` prefix (e.g. `useLogin`)
- API functions use noun + action naming

### Imports

- Use `@/` path alias (`@/components`, `@/hooks`, `@/lib`, `@/contexts`, `@/pages`, `@/api`)
- Group imports: React/routing → UI components → hooks/context → lib
- Always import from barrel exports when available

### Styling

- Tailwind CSS utility classes with shadcn CSS variables
- Colors: Navy (`#021b33`) primary, Indigo (`#383782`) accent, white dominant background
- shadcn components use default variants (modify via CSS vars, not overrides)

## Quick Start

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173 — proxies /api to backend at :8000
```

## Commands

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Type check | `npx tsc -b` |
| Lint | `npm run lint` |
| Build | `npm run build` |

## Routing

| Path | Auth | Page |
|------|------|------|
| `/` | Any | LandingPage |
| `/login` | Guest only | LoginPage |
| `/register` | Guest only | RegisterPage |
| `/forgot-password` | Any | ForgotPasswordPage |
| `/reset-password?token=...` | Any | ResetPasswordPage |
| `/verify-email?token=...` | Any | VerifyEmailPage |
| `/dashboard` | Protected | DashboardLayout > DashboardPage |
| `*` | Any | NotFoundPage (404) |

Route guards:
- **GuestRoute** — redirects authenticated users to `/dashboard`
- **ProtectedRoute** — redirects unauthenticated users to `/login`

## Authentication Flow

1. **Register** → `POST /api/v1/auth/register` → backend sends verification email
2. **Verify email** → `POST /api/v1/auth/verify-email` → sets `is_verified = true`
3. **Login** → `POST /api/v1/auth/login` → returns `{ access_token, refresh_token }` → stored in `localStorage` via `AuthContext.setTokens()`
4. **Token refresh** — axios interceptor automatically retries 401s by calling `/auth/refresh`, rotating both tokens
5. **Logout** — clears `localStorage`, navigates to `/login`

### Axios Interceptor (`api/client.ts`)

- Attaches `access_token` to every request via `Authorization: Bearer` header
- On 401, attempts silent refresh via `POST /auth/refresh`
- On refresh failure, clears tokens (effectively logging out)

## Data Fetching Convention

**All API calls go through custom hooks in `src/hooks/`** — never call `api.*` or `axios` directly from components.

Each hook wraps a TanStack Query `useMutation` (or `useQuery`) and returns the mutation result. Components only consume:

```tsx
const login = useLogin()
login.mutate({ email, password })
// state: login.isPending, login.isError, login.error, login.isSuccess
```

This keeps API logic centralized:

| Layer | Responsibility |
|-------|---------------|
| `src/api/auth.ts` | Raw HTTP calls (returns axios promises) |
| `src/hooks/use*.ts` | TanStack Query mutations (returns mutation state) |
| `src/pages/*.tsx` | UI rendering + form wiring |

## Adding a New Feature

1. Add the API function in `src/api/<module>.ts`
2. Create a custom hook `src/hooks/use<Action>.ts` wrapping it with `useMutation`
3. Export from `src/hooks/index.ts`
4. Build the page/component in the appropriate `src/pages/` subdirectory (`auth/`, `dashboard/`, or root)
5. Add route in `src/App.tsx`

## shadcn/ui

To add more components:

```bash
npx shadcn@latest add <component> --yes
```

Components land in `src/components/ui/` and import from `@/lib/utils` for `cn()`.

## Tech Stack

| Library | Purpose |
|---------|---------|
| React 19 | UI framework |
| Vite 8 | Build tool |
| TypeScript 6 | Type safety |
| Tailwind CSS 3 | Utility-first styling |
| shadcn/ui | Headless component primitives |
| TanStack Query (React Query) | Server state + async mutations |
| React Router DOM 7 | Client-side routing |
| Axios | HTTP client with interceptors |
| React Hook Form + Zod | Form validation |
| Lucide React | Icons |
