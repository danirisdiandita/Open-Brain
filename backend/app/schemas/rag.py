"""Pydantic schemas for RAG search and chat endpoints."""

import uuid

from pydantic import BaseModel, Field


class RAGSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=50)


class RAGChunkResponse(BaseModel):
    id: uuid.UUID
    content: str
    note_id: uuid.UUID
    note_title: str = ""
    heading_path: str | None = None
    similarity: float


class RAGSearchResponse(BaseModel):
    chunks: list[RAGChunkResponse]


class RAGChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


class RAGChatSource(BaseModel):
    note_id: uuid.UUID
    title: str
    heading: str | None = None


class RAGChatResponse(BaseModel):
    answer: str
    sources: list[RAGChatSource]
