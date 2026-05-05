from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_]+$")
    description: str | None = None
    logo_url: str | None = None
    is_public: bool = False


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    slug: str | None = Field(default=None, min_length=1, max_length=64, pattern=r"^[a-z0-9_]+$")
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
