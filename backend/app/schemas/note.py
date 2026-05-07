from datetime import datetime

from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    slug: str = Field(min_length=1, max_length=512, pattern=r"^[a-z0-9-]+$")
    content: str | None = None
    folder_id: str | None = None


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    slug: str | None = Field(default=None, min_length=1, max_length=512, pattern=r"^[a-z0-9-]+$")
    content: str | None = None
    is_published: bool | None = None
    folder_id: str | None = None


class NoteResponse(BaseModel):
    id: str
    organization_id: str
    folder_id: str | None = None
    title: str
    slug: str
    content: str | None = None
    content_type: str
    is_published: bool
    order_index: int
    created_by: str
    created_at: datetime | str
    updated_at: datetime | str

    model_config = {"from_attributes": True}
