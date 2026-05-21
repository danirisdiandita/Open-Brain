from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.organization import router as organization_router
from app.api.v1.folder import router as folder_router
from app.api.v1.note import router as note_router
from app.api.v1.rag import router as rag_router
from app.api.v1.chat import router as chat_router
from app.api.v1.recent import router as recent_router
from app.api.v1.apikey import router as apikey_router
from app.api.v1.apikey import ingest_router

router = APIRouter(prefix="/v1")
router.include_router(auth_router)
router.include_router(organization_router)
router.include_router(folder_router)
router.include_router(note_router)
router.include_router(rag_router)
router.include_router(chat_router)
router.include_router(recent_router)
router.include_router(apikey_router)
router.include_router(ingest_router)

__all__ = ["router"]
