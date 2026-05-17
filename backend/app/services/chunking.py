"""Text chunking for RAG ingestion. Uses tiktoken for token-accurate splitting."""

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import get_settings


def chunk_text(content: str) -> list[str]:
    """Split content into overlapping chunks, respecting paragraph boundaries.

    Uses OpenAI's cl100k_base tokenizer for accurate token counting.
    Chunk size and overlap are configured via RAG_CHUNK_SIZE / RAG_CHUNK_OVERLAP.
    """
    if not content:
        return []

    settings = get_settings()

    splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        encoding_name="cl100k_base",
        chunk_size=settings.rag_chunk_size,
        chunk_overlap=settings.rag_chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(content)
