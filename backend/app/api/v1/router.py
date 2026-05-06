from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.organization import router as organization_router
from app.api.v1.folder import router as folder_router

router = APIRouter(prefix="/v1")
router.include_router(auth_router)
router.include_router(organization_router)
router.include_router(folder_router)

__all__ = ["router"]
