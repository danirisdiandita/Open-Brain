import datetime
import json

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.config import get_settings
from app.schemas.folder import FoldersOutput


class FolderSuggestion(BaseModel):
    folder_path: str = Field(description="Full path to the folder, e.g. 'Engineering > Backend > API'")
    reason: str = Field(description="Brief explanation why this folder is a good fit")
    score: int = Field(description="Relevance score 1-10, 10 being best match")


class SuggestFolderOutput(BaseModel):
    suggestions: list[FolderSuggestion] = Field(description="3-5 folder suggestions, sorted best first")
    best_path: str = Field(description="The single best folder path recommendation")


async def suggest_folder_for_note(
    note_title: str,
    note_content: str | None,
    folder_tree: list[dict],
) -> SuggestFolderOutput:
    settings = get_settings()
    tree_str = json.dumps(folder_tree, indent=2) if folder_tree else "(no folders exist)"

    content_preview = (note_content or "")[:2000]

    system = """You are an expert at organizing knowledge bases. Given a note and a folder tree,
suggest the best folder(s) where this note should be placed.

Rules:
- Return 3-5 suggestions sorted by relevance (best first).
- Use full folder paths like "Engineering > Backend > API".
- Only suggest folders that EXIST in the provided tree.
- Score 10 means perfect match, 1 means barely relevant.
- Consider the note title and content to determine the best fit."""

    human = f"""Note title: {note_title}
Note content preview: {content_preview}

Folder tree:
{tree_str}

Suggest the best folders for this note. Return the best_path as your single top recommendation."""

    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.2,
    )

    structured_llm = llm.with_structured_output(SuggestFolderOutput)
    return await structured_llm.ainvoke([
        {"role": "system", "content": system},
        {"role": "user", "content": human},
    ])


async def generate_folder_tree(
    description: str,
    existing_folders: list[dict],
) -> FoldersOutput:
    settings = get_settings()
    existing_str = json.dumps(existing_folders, indent=2) if existing_folders else "(no existing folders)"

    system = """You are an expert at designing knowledge base folder structures for organizations.
Based on the user's description, return the COMPLETE suggested folder tree.

Rules:
- Include BOTH existing folders (marked is_existing=true) AND new folders (marked is_existing=false).
- Keep slugs lowercase, hyphenated, clean.
- Names should be concise (1-3 words).
- Maximum 3 levels deep.
- Preserve existing folder names/slugs exactly as provided."""

    human = f"""Organization description:
{description}

Existing folder structure (include these in your output with is_existing=true):
{existing_str}

Return the COMPLETE folder tree with both existing and suggested new folders.
Date context: {datetime.date.today().isoformat()}"""

    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.3,
    )

    structured_llm = llm.with_structured_output(FoldersOutput)
    return await structured_llm.ainvoke([
        {"role": "system", "content": system},
        {"role": "user", "content": human},
    ])
