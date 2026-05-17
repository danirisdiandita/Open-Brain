"""add search_vector to chunks for hybrid retrieval

Revision ID: cfcae3b5f326
Revises: 9c6108dbc2ae
Create Date: 2026-05-18 02:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'cfcae3b5f326'
down_revision: Union[str, None] = '9c6108dbc2ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chunks', sa.Column('search_vector', sa.Text(), nullable=True))

    # Trigger to auto-populate tsvector from content
    op.execute("""
        CREATE OR REPLACE FUNCTION chunks_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_chunks_search_vector
        BEFORE INSERT OR UPDATE ON chunks
        FOR EACH ROW EXECUTE FUNCTION chunks_search_vector_update();
    """)

    # Backfill existing rows
    op.execute("""
        UPDATE chunks SET search_vector = to_tsvector('english', COALESCE(content, ''));
    """)

    # GIN index with tsvector_ops on the text column
    op.execute("""
        CREATE INDEX ix_chunks_search ON chunks
        USING gin (to_tsvector('english', COALESCE(search_vector, '')));
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chunks_search")
    op.execute("DROP TRIGGER IF EXISTS trg_chunks_search_vector ON chunks")
    op.execute("DROP FUNCTION IF EXISTS chunks_search_vector_update()")
    op.drop_column('chunks', 'search_vector')
