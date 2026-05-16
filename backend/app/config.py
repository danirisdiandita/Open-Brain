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


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance. Reads from env vars (or .env in dev)."""
    return Settings()
