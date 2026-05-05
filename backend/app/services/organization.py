import uuid

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.user import User
from app.models.user_organization import UserOrganization


class OrganizationError(Exception):
    pass


async def list_organizations(db: AsyncSession, user: User) -> list[dict]:
    result = await db.execute(
        select(Organization, UserOrganization.role)
        .join(UserOrganization, UserOrganization.organization_id == Organization.id)
        .where(UserOrganization.user_id == user.id)
        .order_by(Organization.created_at)
    )
    rows = result.all()
    return [
        {
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "description": org.description,
            "logo_url": org.logo_url,
            "is_public": org.is_public,
            "role": role,
            "created_at": org.created_at.isoformat() if org.created_at else "",
        }
        for org, role in rows
    ]


async def get_organization(db: AsyncSession, org_id: uuid.UUID, user: User) -> dict:
    result = await db.execute(
        select(Organization, UserOrganization.role)
        .join(UserOrganization, UserOrganization.organization_id == Organization.id)
        .where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise OrganizationError("Organization not found")

    org, role = row
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "description": org.description,
        "logo_url": org.logo_url,
        "is_public": org.is_public,
        "role": role,
        "created_at": org.created_at.isoformat() if org.created_at else "",
    }


async def create_organization(
    db: AsyncSession,
    user: User,
    name: str,
    slug: str,
    description: str | None = None,
    logo_url: str | None = None,
    is_public: bool = False,
) -> dict:
    existing = await db.execute(
        select(Organization).where(Organization.slug == slug)
    )
    if existing.scalar_one_or_none() is not None:
        raise OrganizationError("An organization with this slug already exists")

    org = Organization(
        name=name,
        slug=slug,
        description=description,
        logo_url=logo_url,
        is_public=is_public,
        created_by=user.id,
    )
    db.add(org)
    await db.flush()

    membership = UserOrganization(
        user_id=user.id,
        organization_id=org.id,
        role="admin",
    )
    db.add(membership)
    await db.flush()

    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "description": org.description,
        "logo_url": org.logo_url,
        "is_public": org.is_public,
        "role": "admin",
        "created_at": org.created_at.isoformat() if org.created_at else "",
    }


async def update_organization(
    db: AsyncSession,
    org_id: uuid.UUID,
    user: User,
    name: str | None = None,
    slug: str | None = None,
    description: str | None = None,
    logo_url: str | None = None,
    is_public: bool | None = None,
) -> dict:
    await _check_admin(db, org_id, user)

    org = await db.get(Organization, org_id)
    if org is None:
        raise OrganizationError("Organization not found")

    if name is not None:
        org.name = name
    if slug is not None:
        existing = await db.execute(
            select(Organization).where(
                Organization.slug == slug, Organization.id != org_id
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise OrganizationError("An organization with this slug already exists")
        org.slug = slug
    if description is not None:
        org.description = description
    if logo_url is not None:
        org.logo_url = logo_url
    if is_public is not None:
        org.is_public = is_public

    await db.flush()

    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "description": org.description,
        "logo_url": org.logo_url,
        "is_public": org.is_public,
        "role": "admin",
        "created_at": org.created_at.isoformat() if org.created_at else "",
    }


async def delete_organization(db: AsyncSession, org_id: uuid.UUID, user: User) -> None:
    await _check_admin(db, org_id, user)

    org = await db.get(Organization, org_id)
    if org is None:
        raise OrganizationError("Organization not found")

    await db.delete(org)
    await db.flush()


async def _check_admin(db: AsyncSession, org_id: uuid.UUID, user: User) -> None:
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user.id,
            UserOrganization.role == "admin",
        )
    )
    if result.scalar_one_or_none() is None:
        raise OrganizationError("Only admins can perform this action")
