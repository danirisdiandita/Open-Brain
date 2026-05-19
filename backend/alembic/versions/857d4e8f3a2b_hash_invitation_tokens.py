"""hash invitation tokens

Revision ID: 857d4e8f3a2b
Revises: 81f4206dd0eb
Create Date: 2026-05-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '857d4e8f3a2b'
down_revision: Union[str, None] = '81f4206dd0eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('organization_invitations_token_key', 'organization_invitations', type_='unique')
    op.alter_column('organization_invitations', 'token', new_column_name='token_hash', existing_type=sa.String(256))
    op.create_unique_constraint('uq_organization_invitations_token_hash', 'organization_invitations', ['token_hash'])


def downgrade() -> None:
    op.drop_constraint('uq_organization_invitations_token_hash', 'organization_invitations', type_='unique')
    op.alter_column('organization_invitations', 'token_hash', new_column_name='token', existing_type=sa.String(256))
    op.create_unique_constraint('organization_invitations_token_key', 'organization_invitations', ['token'])
