import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class OrganizationAIConfig(Base):
    __tablename__ = "organization_ai_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    folder_suggestion_system: Mapped[str | None] = mapped_column(Text, default=None)
    folder_tree_system: Mapped[str | None] = mapped_column(Text, default=None)
    chat_system: Mapped[str | None] = mapped_column(Text, default=None)
    rag_system: Mapped[str | None] = mapped_column(Text, default=None)

    ai_model: Mapped[str | None] = mapped_column(String(128), default=None)
    temperature: Mapped[float | None] = mapped_column(Float, default=None)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    organization: Mapped["Organization"] = relationship(back_populates="ai_config")
