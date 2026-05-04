from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Open Brain API"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me"

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "openbrain"
    postgres_password: str = "change-me"
    postgres_db: str = "openbrain"

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

    # JWT
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Email
    smtp_host: str = "smtp.example.com"
    smtp_port: int = 587
    smtp_user: str = "noreply@example.com"
    smtp_password: str = "change-me"
    smtp_from: str = "noreply@example.com"

    # Frontend
    frontend_url: str = "http://localhost:3000"
    verify_email_redirect: str = "http://localhost:3000/auth/verify"
    reset_password_redirect: str = "http://localhost:3000/auth/reset-password"


@lru_cache
def get_settings() -> Settings:
    return Settings()
