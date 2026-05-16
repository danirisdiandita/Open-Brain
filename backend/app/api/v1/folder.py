import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.folder import Folder
from app.models.user import User
from app.schemas.folder import (
    FolderCreate,
    FolderUpdate,
    FolderResponse,
    FolderTreeResponse,
    GenerateFoldersRequest,
    GenerateFoldersResponse,
    ApplyFoldersRequest,
)
from app.services.folder import (
    FolderError,
    create_folder,
    delete_folder,
    get_folder,
    list_folders,
    update_folder,
    get_folder_tree,
    build_folder_tree,
)
from app.services.ai import generate_folder_tree as ai_generate_tree

router = APIRouter(prefix="/organizations/{org_id}/folders", tags=["folders"])

@router.get("", response_model=list[FolderResponse])
async def list_org_folders(
    org_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await list_folders(db, org_id, user)
    except FolderError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

@router.get("/tree", response_model=FolderTreeResponse)
async def get_org_folder_tree(
    org_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_folder_tree(db, org_id, user)
    except FolderError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/generate", response_model=GenerateFoldersResponse)
async def generate_folders(
    org_id: uuid.UUID,
    body: GenerateFoldersRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        folders = await list_folders(db, org_id, user)
        existing = build_folder_tree(folders)

        result = await ai_generate_tree(body.description, existing)

        all_roots = result.roots
        new_count = count_new_nodes(all_roots)

        return GenerateFoldersResponse(
            roots=all_roots,
            existing_count=len(folders),
            new_count=new_count,
        )
    except FolderError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/generate/apply", status_code=status.HTTP_201_CREATED)
async def apply_generated_folders(
    org_id: uuid.UUID,
    body: ApplyFoldersRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        created = 0

        async def get_existing_folder_id(name: str, parent_id: uuid.UUID | None) -> uuid.UUID | None:
            """Find an existing folder by name and parent to get its ID."""
            result = await db.execute(
                select(Folder).where(
                    Folder.organization_id == org_id,
                    Folder.name == name,
                    Folder.parent_id == parent_id,
                ).limit(1)
            )
            f = result.scalar_one_or_none()
            return f.id if f else None

        async def create_tree(nodes: list, parent_id: uuid.UUID | None = None) -> None:
            nonlocal created
            for node in nodes:
                child_parent_id: uuid.UUID | None = None

                if node.is_existing:
                    child_parent_id = await get_existing_folder_id(node.name, parent_id)
                else:
                    folder = await create_folder(
                        db, org_id, user,
                        name=node.name,
                        slug=node.slug,
                        description=node.description,
                        parent_id=parent_id,
                    )
                    created += 1
                    child_parent_id = folder.id

                if child_parent_id and node.children:
                    await create_tree(node.children, child_parent_id)

        await create_tree(body.roots)
        await db.commit()
        return {"created": created}
    except FolderError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def count_new_nodes(roots: list) -> int:
    from app.schemas.folder import FolderTreeNode
    c = 0
    for r in roots:
        if not r.is_existing:
            c += 1
        c += count_new_nodes(r.children)
    return c


@router.get("/{folder_id}", response_model=FolderResponse)
async def get_org_folder(
    org_id: uuid.UUID,
    folder_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_folder(db, folder_id, org_id, user)
    except FolderError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_org_folder(
    org_id: uuid.UUID,
    body: FolderCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        folder = await create_folder(
            db, org_id, user, body.name, body.slug, body.description, body.parent_id, body.order_index
        )
        await db.commit()
        return folder
    except FolderError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

@router.patch("/{folder_id}", response_model=FolderResponse)
async def update_org_folder(
    org_id: uuid.UUID,
    folder_id: uuid.UUID,
    body: FolderUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        folder = await update_folder(
            db, folder_id, org_id, user, body.name, body.slug, body.description, body.parent_id, body.order_index
        )
        await db.commit()
        return folder
    except FolderError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org_folder(
    org_id: uuid.UUID,
    folder_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await delete_folder(db, folder_id, org_id, user)
        await db.commit()
    except FolderError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
