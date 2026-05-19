"""Organization invitation service."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invitation import OrganizationInvitation
from app.models.user import User
from app.models.user_organization import UserOrganization
from app.utils.tokens import generate_invitation_token, hash_invitation_token, verify_invitation_token


class InvitationError(Exception):
    pass


async def create_invitation(
    db: AsyncSession,
    org_id: uuid.UUID,
    email: str,
    role: str,
    access_scope: str = "all",
    created_by: uuid.UUID | None = None,
) -> tuple[OrganizationInvitation, str]:
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    if user:
        result2 = await db.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user.id,
                UserOrganization.organization_id == org_id,
            )
        )
        if result2.scalar_one_or_none():
            raise InvitationError("User is already a member of this organization")

    result3 = await db.execute(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == org_id,
            OrganizationInvitation.email == email,
            OrganizationInvitation.expires_at > datetime.now(timezone.utc),
        )
    )
    if result3.scalar_one_or_none():
        raise InvitationError("A pending invitation already exists for this email")

    raw_token, token_hash = generate_invitation_token()

    invitation = OrganizationInvitation(
        organization_id=org_id,
        email=email,
        role=role,
        access_scope=access_scope,
        token_hash=token_hash,
        created_by=created_by or uuid.UUID("00000000-0000-0000-0000-000000000000"),
    )
    db.add(invitation)
    await db.flush()
    await db.refresh(invitation)
    return invitation, raw_token


async def list_invitations(
    db: AsyncSession, org_id: uuid.UUID,
) -> list[OrganizationInvitation]:
    result = await db.execute(
        select(OrganizationInvitation)
        .where(
            OrganizationInvitation.organization_id == org_id,
            OrganizationInvitation.expires_at > datetime.now(timezone.utc),
        )
        .order_by(OrganizationInvitation.created_at.desc())
    )
    return list(result.scalars().all())


async def get_invitation_by_token(
    db: AsyncSession, token: str,
) -> OrganizationInvitation | None:
    token_hash = hash_invitation_token(token)
    result = await db.execute(
        select(OrganizationInvitation).where(
            OrganizationInvitation.token_hash == token_hash,
            OrganizationInvitation.expires_at > datetime.now(timezone.utc),
        )
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        return None
    if not verify_invitation_token(token, invitation.token_hash):
        return None
    return invitation


async def accept_invitation(
    db: AsyncSession, token: str, user: User,
) -> UserOrganization:
    import json

    from app.services.authorization import grant_folder_access, grant_note_access

    invitation = await get_invitation_by_token(db, token)
    if invitation is None:
        raise InvitationError("Invalid or expired invitation")

    if user.email.lower() != invitation.email.lower():
        raise InvitationError("This invitation is for a different email address")

    membership = UserOrganization(
        user_id=user.id,
        organization_id=invitation.organization_id,
        role=invitation.role,
        access_scope=invitation.access_scope,
    )
    db.add(membership)

    if invitation.access_scope == "selected":
        if invitation.pending_folder_ids:
            for fid in json.loads(invitation.pending_folder_ids):
                await grant_folder_access(
                    db, invitation.organization_id, user.id,
                    uuid.UUID(fid), invitation.created_by,
                )
        if invitation.pending_note_ids:
            for nid in json.loads(invitation.pending_note_ids):
                await grant_note_access(
                    db, invitation.organization_id, user.id,
                    uuid.UUID(nid), invitation.created_by,
                )

    await db.delete(invitation)
    await db.flush()
    await db.refresh(membership)
    return membership


async def revoke_invitation(
    db: AsyncSession, invitation_id: uuid.UUID, org_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        delete(OrganizationInvitation).where(
            OrganizationInvitation.id == invitation_id,
            OrganizationInvitation.organization_id == org_id,
        )
    )
    await db.flush()
    return result.rowcount > 0
