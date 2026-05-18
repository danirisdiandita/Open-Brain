"""
Application settings loaded from environment variables.

In development, values are read from a ``.env`` file at the project root.
In production, set these directly as environment variables (the ``.env`` file
should not exist — all config comes from the deployment environment).
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # .env is a development convenience — in production, set real env vars
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────
    app_name: str = Field(
        default="Open Brain API",
        description="Human-readable application name (env: APP_NAME)",
    )
    app_env: str = Field(
        default="development",
        description="Deployment environment: development | staging | production (env: APP_ENV)",
    )
    debug: bool = Field(
        default=True,
        description="Enable debug mode — MUST be False in production (env: DEBUG)",
    )
    secret_key: str = Field(
        default="change-me",
        description="HMAC secret for JWT signing — use a strong random value (env: SECRET_KEY)",
    )

    # ── PostgreSQL ───────────────────────────────────────
    postgres_host: str = Field(
        default="localhost",
        description="Database host (env: POSTGRES_HOST)",
    )
    postgres_port: int = Field(
        default=5432,
        description="Database port (env: POSTGRES_PORT)",
    )
    postgres_user: str = Field(
        default="openbrain",
        description="Database user (env: POSTGRES_USER)",
    )
    postgres_password: str = Field(
        default="change-me",
        description="Database password (env: POSTGRES_PASSWORD)",
    )
    postgres_db: str = Field(
        default="openbrain",
        description="Database name (env: POSTGRES_DB)",
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # ── JWT ──────────────────────────────────────────────
    access_token_expire_minutes: int = Field(
        default=15,
        description="Access token lifetime in minutes (env: ACCESS_TOKEN_EXPIRE_MINUTES)",
    )
    refresh_token_expire_days: int = Field(
        default=7,
        description="Refresh token lifetime in days (env: REFRESH_TOKEN_EXPIRE_DAYS)",
    )

    # ── Email (Resend) ───────────────────────────────────
    resend_api_key: str = Field(
        default="re_123456789",
        description="Resend API key for transactional emails (env: RESEND_API_KEY)",
    )
    resend_from: str = Field(
        default="Open Brain <onboarding@resend.dev>",
        description="Sender address for outgoing emails (env: RESEND_FROM)",
    )

    # ── Frontend URLs (used in email links) ──────────────
    frontend_url: str = Field(
        default="http://localhost:5173",
        description="Public URL of the frontend (env: FRONTEND_URL)",
    )
    verify_email_redirect: str = Field(
        default="http://localhost:5173/verify-email",
        description="Frontend route for email verification (env: VERIFY_EMAIL_REDIRECT)",
    )
    reset_password_redirect: str = Field(
        default="http://localhost:5173/reset-password",
        description="Frontend route for password reset (env: RESET_PASSWORD_REDIRECT)",
    )

    # ── AI / LLM ─────────────────────────────────────────
    openai_api_key: str = Field(
        default="",
        description="OpenAI API key — required for AI features (env: OPENAI_API_KEY)",
    )
    openai_model: str = Field(
        default="gpt-4.1-mini",
        description="OpenAI chat model name (env: OPENAI_MODEL)",
    )
    openai_embedding_model: str = Field(
        default="text-embedding-3-small",
        description="OpenAI embedding model for RAG (env: OPENAI_EMBEDDING_MODEL)",
    )

    # ── RAG / Chunking ──────────────────────────────────
    rag_chunk_size: int = Field(
        default=512,
        description="Max tokens per chunk for RAG ingestion (env: RAG_CHUNK_SIZE)",
    )
    rag_chunk_overlap: int = Field(
        default=64,
        description="Token overlap between adjacent chunks (env: RAG_CHUNK_OVERLAP)",
    )
    rag_chunk_method: str = Field(
        default="recursive",
        description="Chunking method: recursive (default) | semantic | llm (env: RAG_CHUNK_METHOD)",
    )
    rag_semantic_threshold: int = Field(
        default=90,
        description="Percentile threshold for semantic chunking breakpoint (env: RAG_SEMANTIC_THRESHOLD)",
    )

    # ── RAG / Hybrid Retrieval ──────────────────────────
    rag_hybrid_enabled: bool = Field(
        default=False,
        description="Enable hybrid vector + keyword retrieval (env: RAG_HYBRID_ENABLED)",
    )
    rag_hybrid_vector_weight: float = Field(
        default=0.7,
        description="Vector score weight in hybrid search 0.0-1.0 (env: RAG_HYBRID_VECTOR_WEIGHT)",
    )
    rag_hybrid_keyword_weight: float = Field(
        default=0.3,
        description="Keyword score weight in hybrid search 0.0-1.0 (env: RAG_HYBRID_KEYWORD_WEIGHT)",
    )

    # ── RAG / Reranker ──────────────────────────────────
    rag_rerank_enabled: bool = Field(
        default=False,
        description="Enable cross-encoder reranking after retrieval (env: RAG_RERANK_ENABLED)",
    )
    rag_rerank_top_n: int = Field(
        default=10,
        description="Number of chunks to keep after reranking (env: RAG_RERANK_TOP_N)",
    )
    rag_coarse_top_k: int = Field(
        default=100,
        description="Candidates from initial vector search before rerank (env: RAG_COARSE_TOP_K)",
    )

    # ── RAG / Agent ─────────────────────────────────────
    rag_agent_enabled: bool = Field(
        default=False,
        description="Enable agentic ReAct mode for chat (env: RAG_AGENT_ENABLED)",
    )
    rag_agent_max_iterations: int = Field(
        default=5,
        description="Max reasoning steps for ReAct agent (env: RAG_AGENT_MAX_ITERATIONS)",
    )

    # ── External Services ────────────────────────────────
    cohere_api_key: str = Field(
        default="",
        description="Cohere API key for reranker (env: COHERE_API_KEY)",
    )

    # ── RAG / Vector Store ───────────────────────────────
    vector_store_provider: str = Field(
        default="pg_vector",
        description="Vector store provider: pg_vector | weaviate | pinecone (env: VECTOR_STORE_PROVIDER)",
    )
    pinecone_api_key: str = Field(
        default="",
        description="Pinecone API key (env: PINECONE_API_KEY)",
    )
    weaviate_url: str = Field(
        default="http://localhost:8080",
        description="Weaviate instance URL (env: WEAVIATE_URL)",
    )
    weaviate_api_key: str = Field(
        default="",
        description="Weaviate API key — leave empty for anonymous access (env: WEAVIATE_API_KEY)",
    )

    # ── S3 / Object Storage ──────────────────────────────
    s3_endpoint_url: str = Field(
        default="http://localhost:9002",
        description="S3-compatible endpoint URL, e.g. MinIO (env: S3_ENDPOINT_URL)",
    )
    s3_access_key: str = Field(
        default="minioadmin",
        description="S3 access key (env: S3_ACCESS_KEY)",
    )
    s3_secret_key: str = Field(
        default="minioadmin",
        description="S3 secret key (env: S3_SECRET_KEY)",
    )
    s3_region: str = Field(
        default="us-east-1",
        description="S3 region (env: S3_REGION)",
    )
    s3_bucket: str = Field(
        default="openbrain-attachments",
        description="S3 bucket name (env: S3_BUCKET)",
    )
    s3_use_path_style: bool = Field(
        default=True,
        description="Use path-style S3 URLs — required for MinIO (env: S3_USE_PATH_STYLE)",
    )
    s3_public_url: str = Field(
        default="",
        description="Public base URL for S3 files, e.g. CDN — skips presigned URL if set (env: S3_PUBLIC_URL)",
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance. Reads from env vars (or .env in dev)."""
    return Settings()
