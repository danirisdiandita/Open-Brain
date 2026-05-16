import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChatSourceSchema(BaseModel):
    note_id: uuid.UUID
    title: str
    heading: str | None = None


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    sources: list[ChatSourceSchema] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionDetailResponse(ChatSessionResponse):
    messages: list[ChatMessageResponse] = []


class ChatRequest(BaseModel):
    session_id: uuid.UUID | None = Field(
        default=None,
        description="Existing session ID, or null to create a new session",
    )
    question: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


class ChatResponse(BaseModel):
    session_id: uuid.UUID
    answer: str
    sources: list[ChatSourceSchema]


class SessionListResponse(BaseModel):
    sessions: list[ChatSessionResponse]
