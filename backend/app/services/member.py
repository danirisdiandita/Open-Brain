"""Member management service."""

import uuid

from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.user_organization import UserOrganization


class MemberError(Exception):
    pass


async def list_members(
    db: AsyncSession, org_id: uuid.UUID,
) -> list[dict]:
    result = await db.execute(
        select(UserOrganization, User.email, User.full_name)
        .join(User, User.id == UserOrganization.user_id)
        .where(UserOrganization.organization_id == org_id)
        .order_by(UserOrganization.created_at)
    )
    rows = result.all()
    return [
        {
            "user_id": uo.user_id,
            "email": email,
            "full_name": full_name,
            "role": uo.role,
            "joined_at": uo.created_at,
        }
        for uo, email, full_name in rows
    ]


async def update_member_role(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID, role: str,
) -> dict:
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise MemberError("Member not found")

    member.role = role
    await db.flush()

    user = await db.get(User, user_id)
    return {
        "user_id": member.user_id,
        "email": user.email if user else "",
        "full_name": user.full_name if user else None,
        "role": member.role,
        "joined_at": member.created_at,
    }


async def remove_member(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        delete(UserOrganization).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user_id,
        )
    )
    await db.flush()
    return result.rowcount > 0


async def get_member_role(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID,
) -> str | None:
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    return member.role if member else None
