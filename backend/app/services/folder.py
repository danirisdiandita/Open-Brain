import uuid
import secrets

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import Folder
from app.models.user import User
from app.models.user_organization import UserOrganization

class FolderError(Exception):
    pass

async def _ensure_unique_folder_slug(db: AsyncSession, base_slug: str, org_id: uuid.UUID, parent_id: uuid.UUID | None) -> str:
    slug = base_slug
    query = select(Folder).where(
        Folder.organization_id == org_id,
        Folder.parent_id == parent_id,
        Folder.slug == slug
    )
    result = await db.execute(query)
    if result.scalar_one_or_none() is None:
        return slug
    suffix = secrets.token_hex(2)
    return f"{base_slug}-{suffix}"

async def _check_membership(db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user_id
        )
    )
    if result.scalar_one_or_none() is None:
        raise FolderError("You do not have access to this organization")

async def list_folders(db: AsyncSession, org_id: uuid.UUID, user: User) -> list[Folder]:
    await _check_membership(db, org_id, user.id)
    result = await db.execute(
        select(Folder)
        .where(Folder.organization_id == org_id)
        .order_by(Folder.order_index, Folder.created_at)
    )
    return list(result.scalars().all())

def build_folder_tree(folders: list[Folder]) -> list[dict]:
    node_map: dict[uuid.UUID, dict] = {}
    roots: list[dict] = []

    for f in folders:
        node = {
            "name": f.name,
            "slug": f.slug,
            "description": f.description,
            "order_index": f.order_index,
            "children": [],
        }
        node_map[f.id] = node

    for f in folders:
        node = node_map[f.id]
        if f.parent_id and f.parent_id in node_map:
            node_map[f.parent_id]["children"].append(node)
        else:
            roots.append(node)

    return roots

async def get_folder_tree(db: AsyncSession, org_id: uuid.UUID, user: User) -> dict:
    folders = await list_folders(db, org_id, user)
    return {"roots": build_folder_tree(folders)}

async def get_folder(db: AsyncSession, folder_id: uuid.UUID, org_id: uuid.UUID, user: User) -> Folder:
    await _check_membership(db, org_id, user.id)
    result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.organization_id == org_id)
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise FolderError("Folder not found")
    return folder

async def create_folder(
    db: AsyncSession,
    org_id: uuid.UUID,
    user: User,
    name: str,
    slug: str,
    description: str | None = None,
    parent_id: uuid.UUID | None = None,
    order_index: int = 0
) -> Folder:
    await _check_membership(db, org_id, user.id)
    slug = await _ensure_unique_folder_slug(db, slug, org_id, parent_id)

    folder = Folder(
        organization_id=org_id,
        name=name,
        slug=slug,
        description=description,
        parent_id=parent_id,
        order_index=order_index
    )
    db.add(folder)
    await db.flush()

    # Inherit parent's share grants
    if parent_id:
        from app.models.access import FolderMemberAccess
        result = await db.execute(
            select(FolderMemberAccess).where(FolderMemberAccess.folder_id == parent_id)
        )
        for grant in result.scalars().all():
            db.add(FolderMemberAccess(
                organization_id=grant.organization_id,
                user_id=grant.user_id,
                folder_id=folder.id,
                granted_by=grant.granted_by,
            ))

    return folder

async def update_folder(
    db: AsyncSession,
    folder_id: uuid.UUID,
    org_id: uuid.UUID,
    user: User,
    name: str | None = None,
    slug: str | None = None,
    description: str | None = None,
    parent_id: uuid.UUID | None = None,
    order_index: int | None = None
) -> Folder:
    folder = await get_folder(db, folder_id, org_id, user)

    if name is not None:
        folder.name = name
    if slug is not None and slug != folder.slug:
        folder.slug = await _ensure_unique_folder_slug(db, slug, org_id, folder.parent_id if parent_id is None else parent_id)
    if description is not None:
        folder.description = description
    if parent_id is not None:
        folder.parent_id = parent_id
    if order_index is not None:
        folder.order_index = order_index

    await db.flush()
    return folder

async def delete_folder(db: AsyncSession, folder_id: uuid.UUID, org_id: uuid.UUID, user: User) -> None:
    folder = await get_folder(db, folder_id, org_id, user)

    # Recursively delete all children first
    async def _delete_children(parent_id: uuid.UUID) -> None:
        result = await db.execute(
            select(Folder).where(Folder.parent_id == parent_id)
        )
        children = result.scalars().all()
        for child in children:
            await _delete_children(child.id)
            await db.delete(child)

    await _delete_children(folder.id)
    await db.delete(folder)
    await db.flush()
