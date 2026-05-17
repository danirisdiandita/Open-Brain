import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.config import get_settings
from app.database import get_db
from app.models.organization_ai_config import OrganizationAIConfig
from app.models.user import User
from app.schemas.ai_config import AIConfigField, AIConfigResponse, AIConfigUpdate
from app.schemas.organization import (
    InvitationResponse,
    InviteRequest,
    MemberResponse,
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
    UpdateMemberRoleRequest,
)
from app.services.authorization import (
    grant_folder_access,
    grant_note_access,
    list_member_folders,
    list_member_notes,
    revoke_folder_access,
    revoke_note_access,
    update_access_scope,
)
from app.services.invitation import (
    InvitationError,
    accept_invitation,
    create_invitation,
    list_invitations,
    revoke_invitation,
)
from app.services.member import (
    MemberError,
    list_members,
    remove_member,
    update_member_role,
)
from app.services.organization import (
    OrganizationError,
    create_organization,
    delete_organization,
    get_organization,
    list_organizations,
    update_organization,
)
from app.services.prompts import DefaultPrompts, get_org_ai_config

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationResponse])
async def list_orgs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_organizations(db, user)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_org(
    org_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_organization(db, org_id, user)
    except OrganizationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_org(
    body: OrganizationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await create_organization(
            db, user, body.name, body.slug, body.description, body.logo_url, body.is_public
        )
    except OrganizationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_org(
    org_id: uuid.UUID,
    body: OrganizationUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await update_organization(
            db, org_id, user, body.name, body.slug, body.description, body.logo_url, body.is_public
        )
    except OrganizationError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org(
    org_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await delete_organization(db, org_id, user)
    except OrganizationError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


# ── Invitations ───────────────────────────────────────────

@router.post("/invitations/{token}/accept")
async def accept_invitation_by_token(
    token: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        membership = await accept_invitation(db, token, user)
        # Grant pending folder/note access
        inv = await get_invitation_by_token(db, token)
        if inv is None:
            # Invitation already deleted after accept — look for it in the service
            pass
        return {"organization_id": str(membership.organization_id), "role": membership.role}
    except InvitationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{org_id}/invitations", response_model=list[InvitationResponse])
async def list_org_invitations(
    org_id: uuid.UUID,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    return await list_invitations(db, org_id)


@router.post("/{org_id}/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_org_invitation(
    org_id: uuid.UUID,
    body: InviteRequest,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        import json
        inv = await create_invitation(
            db, org_id, body.email, body.role,
            body.access_scope, user.id,
        )
        # Store pending folder/note IDs as JSON on the invitation
        if body.access_scope == "selected":
            if body.folder_ids or body.note_ids:
                inv.pending_folder_ids = json.dumps(body.folder_ids) if body.folder_ids else None
                inv.pending_note_ids = json.dumps(body.note_ids) if body.note_ids else None
                await db.flush()
        return inv
    except InvitationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{org_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_org_invitation(
    org_id: uuid.UUID,
    invitation_id: uuid.UUID,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    ok = await revoke_invitation(db, invitation_id, org_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Invitation not found")


# ── Members ───────────────────────────────────────────────

@router.get("/{org_id}/members", response_model=list[MemberResponse])
async def list_org_members(
    org_id: uuid.UUID,
    _: User = Depends(require_role("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    return await list_members(db, org_id)


@router.patch("/{org_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role_endpoint(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    body: UpdateMemberRoleRequest,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await update_member_role(db, org_id, user_id, body.role)
    except MemberError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_org_member(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    ok = await remove_member(db, org_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Member not found")


# ── AI Configuration ──────────────────────────────────

_DEFAULT_PROMPTS = {
    "folder_suggestion_system": DefaultPrompts.FOLDER_SUGGESTION_SYSTEM,
    "folder_tree_system": DefaultPrompts.FOLDER_TREE_SYSTEM,
    "chat_system": DefaultPrompts.CHAT_SYSTEM,
    "rag_system": DefaultPrompts.RAG_SYSTEM,
}


def _build_ai_config_response(config: OrganizationAIConfig | None) -> AIConfigResponse:
    settings = get_settings()

    def field(key: str, default_val, db_val) -> AIConfigField:
        if db_val is not None:
            return AIConfigField(value=db_val, is_default=False)
        return AIConfigField(value=default_val, is_default=True)

    return AIConfigResponse(
        folder_suggestion_system=field(
            "folder_suggestion_system",
            _DEFAULT_PROMPTS["folder_suggestion_system"],
            config.folder_suggestion_system if config else None,
        ),
        folder_tree_system=field(
            "folder_tree_system",
            _DEFAULT_PROMPTS["folder_tree_system"],
            config.folder_tree_system if config else None,
        ),
        chat_system=field(
            "chat_system",
            _DEFAULT_PROMPTS["chat_system"],
            config.chat_system if config else None,
        ),
        rag_system=field(
            "rag_system",
            _DEFAULT_PROMPTS["rag_system"],
            config.rag_system if config else None,
        ),
        ai_model=field("ai_model", settings.openai_model, config.ai_model if config else None),
        temperature=field("temperature", 0.3, config.temperature if config else None),
    )


@router.get("/{org_id}/ai-config", response_model=AIConfigResponse)
async def get_ai_config(
    org_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await get_org_ai_config(db, org_id)
    return _build_ai_config_response(config)


@router.patch("/{org_id}/ai-config", response_model=AIConfigResponse)
async def update_ai_config(
    org_id: uuid.UUID,
    body: AIConfigUpdate,
    _: User = Depends(require_role("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    config = await get_org_ai_config(db, org_id)

    if config is None:
        config = OrganizationAIConfig(organization_id=org_id)
        db.add(config)

    for field_name in (
        "folder_suggestion_system",
        "folder_tree_system",
        "chat_system",
        "rag_system",
        "ai_model",
        "temperature",
    ):
        val = getattr(body, field_name)
        if val is not None or body.model_dump(exclude_unset=True).get(field_name) is not None:
            setattr(config, field_name, val)

    await db.commit()
    await db.refresh(config)
    return _build_ai_config_response(config)


# ── Member Access Management ─────────────────────────────

@router.patch("/{org_id}/members/{user_id}/access-scope")
async def update_member_scope(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    scope: str = "all",
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if scope not in ("all", "selected", "blocked"):
        raise HTTPException(status_code=400, detail="Invalid scope")
    await update_access_scope(db, org_id, user_id, scope)
    return {"access_scope": scope}


@router.get("/{org_id}/members/{user_id}/folders")
async def list_member_folder_access(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    _: User = Depends(require_role("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_member_folders(db, user_id)
    return [{"folder_id": str(r.folder_id)} for r in rows]


@router.post("/{org_id}/members/{user_id}/folders/{folder_id}")
async def grant_folder_access_endpoint(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    folder_id: uuid.UUID,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await grant_folder_access(db, org_id, user_id, folder_id, admin.id)
    return {"granted": str(folder_id)}


@router.delete("/{org_id}/members/{user_id}/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_folder_access_endpoint(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    folder_id: uuid.UUID,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await revoke_folder_access(db, user_id, folder_id)


@router.get("/{org_id}/members/{user_id}/notes")
async def list_member_note_access(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    _: User = Depends(require_role("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_member_notes(db, user_id)
    return [{"note_id": str(r.note_id)} for r in rows]


@router.post("/{org_id}/members/{user_id}/notes/{note_id}")
async def grant_note_access_endpoint(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    note_id: uuid.UUID,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await grant_note_access(db, org_id, user_id, note_id, admin.id)
    return {"granted": str(note_id)}


@router.delete("/{org_id}/members/{user_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_note_access_endpoint(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    note_id: uuid.UUID,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await revoke_note_access(db, user_id, note_id)
