from pydantic import BaseModel, Field


class AIConfigField(BaseModel):
    value: str | float | None
    is_default: bool


class AIConfigResponse(BaseModel):
    folder_suggestion_system: AIConfigField
    folder_tree_system: AIConfigField
    chat_system: AIConfigField
    rag_system: AIConfigField
    ai_model: AIConfigField
    temperature: AIConfigField


class AIConfigUpdate(BaseModel):
    folder_suggestion_system: str | None = Field(
        default=None, description="Set to a string to override, or null to reset to default"
    )
    folder_tree_system: str | None = Field(
        default=None, description="Set to a string to override, or null to reset to default"
    )
    chat_system: str | None = Field(
        default=None, description="Set to a string to override, or null to reset to default"
    )
    rag_system: str | None = Field(
        default=None, description="Set to a string to override, or null to reset to default"
    )
    ai_model: str | None = Field(default=None)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
