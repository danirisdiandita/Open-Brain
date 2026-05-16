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

class FolderTreeNode(BaseModel):
    name: str
    slug: str
    description: str | None = None
    order_index: int = 0
    children: list["FolderTreeNode"] = []
    is_existing: bool = False

class FoldersOutput(BaseModel):
    roots: list[FolderTreeNode]

class FolderTreeResponse(BaseModel):
    roots: list[FolderTreeNode]


class GenerateFoldersRequest(BaseModel):
    description: str


class GenerateFoldersResponse(BaseModel):
    roots: list[FolderTreeNode]
    existing_count: int
    new_count: int


class ApplyFoldersRequest(BaseModel):
    roots: list[FolderTreeNode]
