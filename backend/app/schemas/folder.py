import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class FolderBase(BaseModel):
    name: str = Field(..., max_length=256)
    slug: str = Field(..., max_length=256)
    description: str | None = None
    parent_id: uuid.UUID | None = None
    order_index: int = 0

class FolderCreate(FolderBase):
    pass

class FolderUpdate(BaseModel):
    name: str | None = Field(None, max_length=256)
    slug: str | None = Field(None, max_length=256)
    description: str | None = None
    parent_id: uuid.UUID | None = None
    order_index: int | None = None

class FolderResponse(FolderBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
