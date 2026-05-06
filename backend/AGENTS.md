# AGENTS.md — Open Brain Backend

> **Rule:** Do not run `./push.sh` unless explicitly asked by the user.

FastAPI backend for the Open Brain dashboard (RAG-based second brain).

## Project Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app entry point, lifespan, CORS, router mounts
│   ├── config.py                  # Pydantic-settings, reads .env
│   ├── database.py                # Async SQLAlchemy engine + session factory
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py                # SQLAlchemy DeclarativeBase
│   │   └── user.py                # User ORM model
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py                # Pydantic request/response schemas for auth
│   │   └── user.py                # Pydantic UserResponse schema
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                # FastAPI dependencies (get_db, get_current_user)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py          # Aggregates all v1 route modules
│   │       └── auth.py            # /api/v1/auth/* endpoints
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth.py                # Auth business logic (register, login, verify, etc.)
│   └── utils/
│       ├── __init__.py
│       ├── security.py            # bcrypt hashing, JWT create/decode, verification tokens
│       └── email.py               # aiosmtplib email sender, verification/reset templates
├── alembic/
│   ├── env.py                     # Alembic env — file-based offline + online modes
│   ├── script.py.mako             # Migration template
│   └── versions/                  # Generated migration files
├── alembic.ini                    # Alembic configuration
├── .env.example                   # Environment variables template
├── requirements.txt               # Pip dependencies
└── pyproject.toml                 # Project metadata + ruff config
```

## Quick Start

```bash
# 1. Install dependencies
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials and secrets

# 3. Run migrations
alembic revision --autogenerate -m "init"
alembic upgrade head

# 4. Start the server
uvicorn app.main:app --reload
# API at http://localhost:8000
# Docs at http://localhost:8000/docs
```

## Commands

| Action | Command |
|--------|---------|
| Run dev server | `uvicorn app.main:app --reload` |
| Generate migration | `alembic revision --autogenerate -m "description"` |
| Apply migrations | `alembic upgrade head` |
| Rollback one | `alembic downgrade -1` |
| Show migration SQL | `alembic upgrade head --sql` |
| Lint | `ruff check .` |
| Format | `ruff format .` |

## Environment Variables

Copy `.env.example` → `.env` and fill in:

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | HMAC key for JWT signing (must be strong) |
| `POSTGRES_*` | Database connection (host, port, user, password, db) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL (default 15) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL (default 7) |
| `SMTP_*` | SMTP server for transactional emails |
| `FRONTEND_URL` | CORS origin + base URL for email links |

## Authentication Flow

### Endpoints (all under `/api/v1/auth`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/register` | Create account → sends verification email |
| `POST` | `/login` | Returns `{access_token, refresh_token}` |
| `POST` | `/refresh` | Rotate tokens using refresh token |
| `POST` | `/verify-email` | Confirm email with token from email link |
| `POST` | `/resend-verification` | Resend verification email |
| `POST` | `/forgot-password` | Request password reset → sends reset email |
| `POST` | `/reset-password` | Set new password using reset token |

### Token Strategy

- **Access token** — short-lived (15 min by default), sent as `Authorization: Bearer <token>`, used for all authenticated requests.
- **Refresh token** — longer-lived (7 days by default), used only on `/refresh` to rotate both tokens.
- Both tokens are HMAC-signed JWT (HS256) with payload `{sub: user_id, type: "access"|"refresh", iat, exp}`.

### Email Verification

1. On register, a random hex token is generated, stored in `users.verification_token` with a 24h expiry.
2. The token link is emailed via SMTP (falls back to logging in debug mode).
3. `POST /verify-email` validates the token and sets `is_verified = true`.

### Password Reset

1. `POST /forgot-password` generates a reset token (1h expiry) and emails a link.
2. `POST /reset-password` validates the token and updates the password hash.

## Database

### User Model (`users` table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | PK, auto-generated |
| `email` | `varchar(320)` | Unique, indexed |
| `hashed_password` | `varchar(128)` | bcrypt hash |
| `full_name` | `varchar(128)` | Optional display name |
| `is_active` | `boolean` | Soft-delete flag |
| `is_verified` | `boolean` | Email confirmed |
| `verification_token` | `varchar(256)` | Nullable, unique |
| `verification_token_expires` | `timestamptz` | Nullable |
| `password_reset_token` | `varchar(256)` | Nullable, unique |
| `password_reset_token_expires` | `timestamptz` | Nullable |
| `created_at` | `timestamptz` | Server default `now()` |
| `updated_at` | `timestamptz` | Auto-updated |

### Adding New Models

1. Create `app/models/your_model.py` with a class inheriting from `Base`.
2. Import it in `alembic/env.py` (add `from app.models.your_model import YourModel`).
3. Run `alembic revision --autogenerate -m "add your_model"`.
4. Run `alembic upgrade head`.

## Architecture Decisions

- **Async SQLAlchemy** with `asyncpg` driver for non-blocking DB I/O.
- **Lifespan context manager** on FastAPI app (startup/shutdown hook point).
- **Service layer** separates business logic from HTTP handlers.
- **Dependency injection** via FastAPI's `Depends` — `get_db` for sessions, `get_current_user` for auth.
- **File-based Alembic migrations** — offline mode generates migration files from model metadata without requiring a live database. Use `--autogenerate` to diff.
- **Leaky email** pattern — forgot-password and resend-verification always return 200 with a generic message to prevent email enumeration.
- **Passlib + bcrypt** for password hashing; **python-jose** for JWT.
