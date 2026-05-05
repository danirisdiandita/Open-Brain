"""Alembic environment configuration — file-based (offline) migration generation.

Usage:
    alembic revision --autogenerate -m "description"
    alembic upgrade head
    alembic downgrade -1
"""

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.models.base import Base
from app.models.user import User  # noqa: F401 — ensure models are imported
from app.models.organization import Organization  # noqa: F401
from app.models.user_organization import UserOrganization  # noqa: F401

settings = get_settings()
config = context.config

config.set_main_option("sqlalchemy.url", settings.database_url_sync)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Generate migration file without connecting to the database."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Apply migrations against a live database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
