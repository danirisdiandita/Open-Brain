import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.folder import FolderCreate, FolderUpdate, FolderResponse, FolderTreeResponse
from app.services.folder import (
    FolderError,
    create_folder,
    delete_folder,
    get_folder,
    list_folders,
    update_folder,
    get_folder_tree,
)

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
