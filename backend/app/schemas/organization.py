import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    logo_url: str | None = None
    is_public: bool = False


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    slug: str | None = Field(default=None, min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    logo_url: str | None = None
    is_public: bool | None = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None
    logo_url: str | None = None
    is_public: bool
    role: str
    created_at: str

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    email: str = Field(..., max_length=320)
    role: str = Field(default="editor", pattern=r"^(admin|editor|writer|viewer)$")
    access_scope: str = Field(default="all", pattern=r"^(all|selected|blocked)$")
    folder_ids: list[str] | None = None
    note_ids: list[str] | None = None


class InvitationResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    access_scope: str
    created_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}


class MemberResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str | None = None
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern=r"^(admin|editor|writer|viewer)$")
