"""Text chunking for RAG ingestion. Uses tiktoken for token-accurate splitting.

Method dispatch via RAG_CHUNK_METHOD env var:
  - recursive (default): RecursiveCharacterTextSplitter
  - semantic: langchain_experimental SemanticChunker
  - llm: LLM-based chunking (future)
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import get_settings


def _chunk_recursive(content: str) -> list[str]:
    settings = get_settings()
    splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        encoding_name="cl100k_base",
        chunk_size=settings.rag_chunk_size,
        chunk_overlap=settings.rag_chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(content)


def _chunk_semantic(content: str) -> list[str]:
    settings = get_settings()
    try:
        from langchain_experimental.text_splitter import SemanticChunker
        from langchain_openai import OpenAIEmbeddings

        splitter = SemanticChunker(
            OpenAIEmbeddings(
                model=settings.openai_embedding_model,
                api_key=settings.openai_api_key,
            ),
            breakpoint_threshold_type="percentile",
            breakpoint_threshold_amount=settings.rag_semantic_threshold,
        )
        return splitter.split_text(content)
    except ImportError:
        return _chunk_recursive(content)


def _chunk_llm(content: str) -> list[str]:
    # Placeholder for LLM-based chunking
    return _chunk_recursive(content)


def chunk_text(content: str) -> list[str]:
    """Split content into overlapping chunks. Method controlled by RAG_CHUNK_METHOD."""
    if not content:
        return []

    settings = get_settings()
    method = settings.rag_chunk_method

    if method == "semantic":
        return _chunk_semantic(content)
    elif method == "llm":
        return _chunk_llm(content)
    return _chunk_recursive(content)
