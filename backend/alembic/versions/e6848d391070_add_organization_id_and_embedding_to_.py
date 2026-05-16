"""add organization_id and embedding to chunks table

Revision ID: e6848d391070
Revises: 52d4d8373271
Create Date: 2026-05-16 20:57:43.058743
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e6848d391070'
down_revision: Union[str, None] = '52d4d8373271'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chunks', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.add_column('chunks', sa.Column('embedding', sa.ARRAY(sa.Float()), nullable=True))
    op.create_foreign_key(None, 'chunks', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')

    op.execute("""
        UPDATE chunks SET organization_id = notes.organization_id
        FROM notes WHERE chunks.note_id = notes.id
    """)

    op.alter_column('chunks', 'organization_id', nullable=False)


def downgrade() -> None:
    op.drop_constraint(None, 'chunks', type_='foreignkey')
    op.drop_column('chunks', 'embedding')
    op.drop_column('chunks', 'organization_id')
