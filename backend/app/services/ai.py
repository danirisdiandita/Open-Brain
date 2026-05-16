import datetime
import json

from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.schemas.folder import FoldersOutput


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
