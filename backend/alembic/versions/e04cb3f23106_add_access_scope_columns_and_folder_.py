"""add access_scope columns and folder/note member access tables

Revision ID: e04cb3f23106
Revises: 3a7406fe1a98
Create Date: 2026-05-17 06:45:21.143336
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e04cb3f23106'
down_revision: Union[str, None] = '3a7406fe1a98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add access_scope to user_organization with default for existing rows
    op.add_column('user_organization',
        sa.Column('access_scope', sa.String(16), nullable=True, server_default='all'))
    op.execute("UPDATE user_organization SET access_scope = 'all' WHERE access_scope IS NULL")
    op.alter_column('user_organization', 'access_scope', nullable=False)

    # Add access_scope + pending columns to organization_invitations
    op.add_column('organization_invitations',
        sa.Column('access_scope', sa.String(16), nullable=True, server_default='all'))
    op.execute("UPDATE organization_invitations SET access_scope = 'all' WHERE access_scope IS NULL")
    op.alter_column('organization_invitations', 'access_scope', nullable=False)
    op.add_column('organization_invitations', sa.Column('pending_folder_ids', sa.Text(), nullable=True))
    op.add_column('organization_invitations', sa.Column('pending_note_ids', sa.Text(), nullable=True))

    # Create folder_member_access table
    op.create_table('folder_member_access',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('folder_id', sa.UUID(), nullable=False),
        sa.Column('granted_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'folder_id', name='uq_folder_member_user_folder')
    )

    # Create note_member_access table
    op.create_table('note_member_access',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('note_id', sa.UUID(), nullable=False),
        sa.Column('granted_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['note_id'], ['notes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'note_id', name='uq_note_member_user_note')
    )


def downgrade() -> None:
    op.drop_table('note_member_access')
    op.drop_table('folder_member_access')
    op.drop_column('organization_invitations', 'pending_note_ids')
    op.drop_column('organization_invitations', 'pending_folder_ids')
    op.drop_column('organization_invitations', 'access_scope')
    op.drop_column('user_organization', 'access_scope')
