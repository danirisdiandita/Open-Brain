import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ApiKeyCreate(BaseModel):
    name: str = Field(default="Default", max_length=128)


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    last_used_at: datetime | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreatedResponse(ApiKeyResponse):
    raw_token: str


class IngestNoteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    content: str | None = None
    content_type: str = Field(default="markdown", max_length=16)
    folder_mode: str | None = Field(
        default=None,
        description='"auto" | "manual" | "create" — omit for uncategorized',
    )
    folder_id: str | None = Field(
        default=None,
        description='UUID string, required when folder_mode = "manual"',
    )
    tags: list[str] | None = None
