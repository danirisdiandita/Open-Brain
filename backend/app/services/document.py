from docling.document_converter import DocumentConverter


class DocumentParseError(Exception):
    pass


_converter: DocumentConverter | None = None


def _get_converter() -> DocumentConverter:
    global _converter
    if _converter is None:
        _converter = DocumentConverter()
    return _converter


async def parse_document(file_path: str) -> str:
    try:
        result = _get_converter().convert(file_path)
        return result.document.export_to_markdown()
    except Exception as exc:
        raise DocumentParseError(f"Failed to parse document: {exc}") from exc
