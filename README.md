# Open Brain

Open Source Second Brain Dashboard based on RAG

## Prerequisites

- Python 3.11+
- Node.js 22+
- PostgreSQL

## Setup

### 1. Clone and configure

```bash
git clone <repo-url> && cd Open-Brain
```

### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials and secrets

# Run migrations
alembic revision --autogenerate -m "init"
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

Backend runs at **http://localhost:8000** — docs at http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Frontend runs at **http://localhost:5173** — proxies `/api` to the backend at `:8000`

## Environment Variables

See `backend/.env.example` for the full list. Key ones:

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | JWT signing key |
| `POSTGRES_*` | Database connection |
| `RESEND_API_KEY` | Email delivery (Resend.com) |
| `FRONTEND_URL` | CORS origin for the frontend |
