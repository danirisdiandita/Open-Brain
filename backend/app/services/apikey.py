import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apikey import ApiKey
from app.models.folder import Folder
from app.models.user import User
from app.models.user_organization import UserOrganization
from app.utils.security import hash_password, verify_password


class ApiKeyError(Exception):
    pass


async def _require_admin(db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.user_id == user_id,
            UserOrganization.role == "admin",
        )
    )
    if result.scalar_one_or_none() is None:
        raise ApiKeyError("Only admins can manage API keys")


async def generate_raw_token() -> str:
    return "ob_" + secrets.token_hex(24)


async def create_api_key(
    db: AsyncSession,
    org_id: uuid.UUID,
    user: User,
    name: str = "Default",
) -> tuple[ApiKey, str]:
    await _require_admin(db, org_id, user.id)

    raw = await generate_raw_token()
    token_hash = hash_password(raw)

    key = ApiKey(
        organization_id=org_id,
        created_by=user.id,
        name=name,
        token_hash=token_hash,
    )
    db.add(key)
    await db.flush()
    return key, raw


async def list_api_keys(
    db: AsyncSession,
    org_id: uuid.UUID,
    user: User,
) -> list[ApiKey]:
    await _require_admin(db, org_id, user.id)
    result = await db.execute(
        select(ApiKey)
        .where(
            ApiKey.organization_id == org_id,
            ApiKey.is_active == True,
        )
        .order_by(ApiKey.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_api_key(
    db: AsyncSession,
    org_id: uuid.UUID,
    key_id: uuid.UUID,
    user: User,
) -> None:
    await _require_admin(db, org_id, user.id)
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.organization_id == org_id,
        )
    )
    key = result.scalar_one_or_none()
    if key is None:
        raise ApiKeyError("API key not found")
    key.is_active = False


async def authenticate_api_key(
    db: AsyncSession,
    token: str,
) -> ApiKey:
    result = await db.execute(
        select(ApiKey).where(ApiKey.is_active == True)
    )
    for key in result.scalars().all():
        if verify_password(token, key.token_hash):
            return key
    verify_password(token, "$2b$12$" + "x" * 53)
    raise ApiKeyError("Invalid or inactive API key")


async def resolve_folder(
    db: AsyncSession,
    org_id: uuid.UUID,
    note_title: str,
    note_content: str | None,
    folder_mode: str | None,
    folder_id: str | None,
) -> uuid.UUID | None:
    if not folder_mode:
        return None

    if folder_mode == "manual":
        if not folder_id:
            raise ApiKeyError('folder_mode "manual" requires folder_id')
        try:
            fid = uuid.UUID(folder_id)
        except ValueError:
            raise ApiKeyError("Invalid folder_id format")
        result = await db.execute(
            select(Folder).where(
                Folder.id == fid,
                Folder.organization_id == org_id,
            )
        )
        folder = result.scalar_one_or_none()
        if not folder:
            raise ApiKeyError("Folder not found")
        return folder.id

    if folder_mode in ("auto", "create"):
        from app.services.ai import suggest_folder_for_note
        from app.services.folder import build_folder_tree

        result = await db.execute(
            select(Folder).where(Folder.organization_id == org_id)
        )
        folders = list(result.scalars().all())
        tree = build_folder_tree(folders)

        from app.services.prompts import get_org_ai_config
        org_config = await get_org_ai_config(db, org_id)

        suggestion = await suggest_folder_for_note(
            note_title=note_title,
            note_content=note_content,
            folder_tree=tree,
            org_config=org_config,
            allow_new=(folder_mode == "create"),
        )

        if suggestion.suggestions and suggestion.suggestions[0].score >= 7:
            best = suggestion.suggestions[0]
            if best.is_new:
                from app.services.folder import create_folder
                path_parts = best.folder_path.split(" > ")
                parent_id: uuid.UUID | None = None
                for part in path_parts:
                    new_name = part.replace("NEW: ", "").strip()
                    slug = new_name.lower().replace(" ", "-")
                    from app.models.folder import Folder as FolderModel
                    f = FolderModel(
                        organization_id=org_id,
                        name=new_name,
                        slug=slug,
                        description=best.new_folder_description,
                        parent_id=parent_id,
                    )
                    db.add(f)
                    await db.flush()
                    parent_id = f.id
                return parent_id
            else:
                path_parts = best.folder_path.split(" > ")
                current_parent: uuid.UUID | None = None
                for part in path_parts:
                    part = part.strip()
                    result = await db.execute(
                        select(Folder).where(
                            Folder.organization_id == org_id,
                            Folder.name == part,
                            Folder.parent_id == current_parent,
                        )
                    )
                    f = result.scalar_one_or_none()
                    if f is None:
                        return None
                    current_parent = f.id
                return current_parent

    return None
