import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        UniqueConstraint("folder_id", "slug", name="uq_note_folder_slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, default=None
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    slug: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, default=None)
    content_type: Mapped[str] = mapped_column(String(16), default="tiptap")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    attachment_key: Mapped[str | None] = mapped_column(String(512), default=None)
    attachment_filename: Mapped[str | None] = mapped_column(String(512), default=None)
    attachment_size: Mapped[int | None] = mapped_column(Integer, default=None)
    attachment_content_type: Mapped[str | None] = mapped_column(String(256), default=None)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    folder: Mapped["Folder | None"] = relationship(back_populates="notes")
    chunks: Mapped[list["Chunk"]] = relationship(back_populates="note", cascade="all, delete-orphan")
    attachments: Mapped[list["NoteAttachment"]] = relationship(
        back_populates="note", cascade="all, delete-orphan"
    )
