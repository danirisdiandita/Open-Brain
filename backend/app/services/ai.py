import datetime
import json

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.config import get_settings
from app.schemas.folder import FoldersOutput
from app.services.prompts import get_effective_config, get_prompt


class FolderSuggestion(BaseModel):
    folder_path: str = Field(description="Full path to the folder, e.g. 'Engineering > Backend > API'")
    reason: str = Field(description="Brief explanation why this folder is a good fit")
    score: int = Field(description="Relevance score 1-10, 10 being best match")
    is_new: bool = Field(default=False, description="True if this is a suggested new folder to create")
    new_folder_name: str | None = Field(default=None, description="Suggested name for the new folder")
    new_folder_slug: str | None = Field(default=None, description="Suggested slug for the new folder")
    new_folder_description: str | None = Field(default=None, description="Optional description for the new folder")


class SuggestFolderOutput(BaseModel):
    suggestions: list[FolderSuggestion] = Field(description="3-5 folder suggestions, sorted best first")
    best_path: str = Field(description="The single best folder path recommendation")


async def suggest_folder_for_note(
    note_title: str,
    note_content: str | None,
    folder_tree: list[dict],
    org_config=None,
    allow_new: bool = False,
) -> SuggestFolderOutput:
    settings = get_settings()
    config = get_effective_config(org_config)
    tree_str = json.dumps(folder_tree, indent=2) if folder_tree else "(no folders exist)"

    content_preview = (note_content or "")[:2000]

    system = get_prompt("folder_suggestion_system", org_config)

    new_folder_rule = ""
    if allow_new:
        new_folder_rule = """
- If no existing folder is a perfect fit (score < 7), you MAY suggest 1 new folder to create.
- For a new folder suggestion, set is_new=true, provide new_folder_name, new_folder_slug (lowercase, hyphenated), and optionally new_folder_description.
- The folder_path for a new suggestion should show where it would go, e.g. "Engineering > NEW: API Docs".
- At most 1 suggestion should be a new folder."""

    human = f"""Note title: {note_title}
Note content preview: {content_preview}

Folder tree:
{tree_str}
{new_folder_rule}
Suggest the best folders for this note. Return the best_path as your single top recommendation."""

    llm = ChatOpenAI(
        model=config["ai_model"],
        api_key=settings.openai_api_key,
        temperature=config["temperature"],
    )

    structured_llm = llm.with_structured_output(SuggestFolderOutput)
    return await structured_llm.ainvoke([
        {"role": "system", "content": system},
        {"role": "user", "content": human},
    ])


async def generate_folder_tree(
    description: str,
    existing_folders: list[dict],
    org_config=None,
) -> FoldersOutput:
    settings = get_settings()
    config = get_effective_config(org_config)
    existing_str = json.dumps(existing_folders, indent=2) if existing_folders else "(no existing folders)"

    system = get_prompt("folder_tree_system", org_config)

    human = f"""Organization description:
{description}

Existing folder structure (include these in your output with is_existing=true):
{existing_str}

Return the COMPLETE folder tree with both existing and suggested new folders.
Date context: {datetime.date.today().isoformat()}"""

    llm = ChatOpenAI(
        model=config["ai_model"],
        api_key=settings.openai_api_key,
        temperature=config["temperature"],
    )

    structured_llm = llm.with_structured_output(FoldersOutput)
    return await structured_llm.ainvoke([
        {"role": "system", "content": system},
        {"role": "user", "content": human},
    ])
