import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.organization_ai_config import OrganizationAIConfig


async def get_org_ai_config(
    db: AsyncSession, org_id: uuid.UUID
) -> OrganizationAIConfig | None:
    result = await db.execute(
        select(OrganizationAIConfig).where(
            OrganizationAIConfig.organization_id == org_id
        )
    )
    return result.scalar_one_or_none()


@dataclass(frozen=True)
class DefaultPrompts:
    FOLDER_SUGGESTION_SYSTEM: str = """\
You are an expert at organizing knowledge bases. Given a note and a folder tree,
suggest the best folder(s) where this note should be placed.

Rules:
- Return 3-5 suggestions sorted by relevance (best first).
- Use full folder paths like "Engineering > Backend > API".
- Only suggest folders that EXIST in the provided tree.
- Score 10 means perfect match, 1 means barely relevant.
- Consider the note title and content to determine the best fit."""

    FOLDER_TREE_SYSTEM: str = """\
You are an expert at designing knowledge base folder structures for organizations.
Based on the user's description, return the COMPLETE suggested folder tree.

Rules:
- Include BOTH existing folders (marked is_existing=true) AND new folders (marked is_existing=false).
- Keep slugs lowercase, hyphenated, clean.
- Names should be concise (1-3 words).
- Maximum 3 levels deep.
- Preserve existing folder names/slugs exactly as provided."""

    CHAT_SYSTEM: str = (
        "You are an assistant for Open Brain, a knowledge base. "
        "Answer using ONLY the context below. "
        "If the context doesn't contain the answer, say so. "
        "Always cite which note the information comes from. "
        "Be concise and helpful.\n\n"
        "{history_section}"
        "Relevant knowledge base context:\n{context}"
    )

    RAG_SYSTEM: str = (
        "You are an assistant for Open Brain, a knowledge base. "
        "Answer using ONLY the context below. "
        "If the context doesn't contain the answer, say so. "
        "Always cite which note the information comes from.\n\n"
        "Context:\n{context}"
    )


_DEFAULT_MAP = {
    "folder_suggestion_system": DefaultPrompts.FOLDER_SUGGESTION_SYSTEM,
    "folder_tree_system": DefaultPrompts.FOLDER_TREE_SYSTEM,
    "chat_system": DefaultPrompts.CHAT_SYSTEM,
    "rag_system": DefaultPrompts.RAG_SYSTEM,
}


def get_prompt(key: str, org_config: OrganizationAIConfig | None, **template_vars) -> str:
    override = None
    if org_config is not None:
        override = getattr(org_config, key, None)

    base = override if override else _DEFAULT_MAP.get(key, "")
    if template_vars:
        return base.format(**template_vars)
    return base


def get_effective_config(org_config: OrganizationAIConfig | None) -> dict:
    settings = get_settings()
    return {
        "ai_model": org_config.ai_model if org_config and org_config.ai_model else settings.openai_model,
        "temperature": org_config.temperature if org_config and org_config.temperature is not None else 0.3,
    }
