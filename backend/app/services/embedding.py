"""OpenAI embedding service."""

from openai import AsyncOpenAI

from app.config import get_settings


async def embed_text(text: str) -> list[float]:
    """Embed a single text. Returns a 1536-dimensional vector."""
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    resp = await client.embeddings.create(
        model=settings.openai_embedding_model,
        input=text,
    )
    return resp.data[0].embedding


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in one API call (cheaper and faster)."""
    if not texts:
        return []
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    resp = await client.embeddings.create(
        model=settings.openai_embedding_model,
        input=texts,
    )
    return [d.embedding for d in resp.data]
