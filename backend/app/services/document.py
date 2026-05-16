import json

from docling.document_converter import DocumentConverter


class DocumentParseError(Exception):
    pass


_converter: DocumentConverter | None = None


def _get_converter() -> DocumentConverter:
    global _converter
    if _converter is None:
        _converter = DocumentConverter()
    return _converter


def _markdown_to_prosemirror(md: str) -> dict:
    blocks = md.strip().split("\n\n")
    content: list[dict] = []

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        if block.startswith("#"):
            level = min(len(block) - len(block.lstrip("#")), 6)
            text = block.lstrip("#").strip()
            content.append({
                "type": "heading",
                "attrs": {"level": level},
                "content": _parse_inline(text),
            })
        elif block.startswith("```"):
            lines = block.removeprefix("```").strip().split("\n")
            if len(lines) > 1:
                lang = lines[0].strip() or None
                code = "\n".join(lines[1:])
            else:
                lang = None
                code = lines[0]
            node: dict = {
                "type": "codeBlock",
                "content": [{"type": "text", "text": code}],
            }
            if lang:
                node["attrs"] = {"language": lang}
            content.append(node)
        elif block.startswith("- ") or block.startswith("* "):
            items = _parse_bullet_list(block)
            content.append({
                "type": "bulletList",
                "content": [
                    {
                        "type": "listItem",
                        "content": [
                            {"type": "paragraph", "content": _parse_inline(item)}
                        ],
                    }
                    for item in items
                ],
            })
        elif block.startswith(">"):
            text = block.removeprefix(">").strip()
            content.append({
                "type": "blockquote",
                "content": [
                    {"type": "paragraph", "content": _parse_inline(text)}
                ],
            })
        else:
            content.append({
                "type": "paragraph",
                "content": _parse_inline(block),
            })

    if not content:
        content = [{"type": "paragraph", "content": []}]

    return {"type": "doc", "content": content}


def _parse_bullet_list(block: str) -> list[str]:
    items: list[str] = []
    for line in block.split("\n"):
        stripped = line.strip()
        if stripped.startswith("- ") or stripped.startswith("* "):
            items.append(stripped[2:])
    return items


def _parse_inline(text: str) -> list[dict]:
    import re

    tokens: list[dict] = []
    pattern = re.compile(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))")

    last = 0
    for match in pattern.finditer(text):
        start, end = match.span()
        if start > last:
            tokens.append({"type": "text", "text": text[last:start]})

        raw = match.group(1)
        if raw.startswith("**") and raw.endswith("**"):
            tokens.append({
                "type": "text",
                "text": raw[2:-2],
                "marks": [{"type": "bold"}],
            })
        elif raw.startswith("*") and raw.endswith("*"):
            tokens.append({
                "type": "text",
                "text": raw[1:-1],
                "marks": [{"type": "italic"}],
            })
        elif raw.startswith("`") and raw.endswith("`"):
            tokens.append({
                "type": "text",
                "text": raw[1:-1],
                "marks": [{"type": "code"}],
            })
        elif raw.startswith("["):
            link_match = re.match(r"\[([^\]]+)\]\(([^)]+)\)", raw)
            if link_match:
                tokens.append({
                    "type": "text",
                    "text": link_match.group(1),
                    "marks": [
                        {
                            "type": "link",
                            "attrs": {"href": link_match.group(2)},
                        }
                    ],
                })

        last = end

    if last < len(text):
        tokens.append({"type": "text", "text": text[last:]})

    if not tokens:
        tokens = [{"type": "text", "text": text}]

    return tokens


async def parse_document(file_path: str) -> str:
    try:
        result = _get_converter().convert(file_path)
        md = result.document.export_to_markdown()
        pm = _markdown_to_prosemirror(md)
        return json.dumps(pm)
    except Exception as exc:
        raise DocumentParseError(f"Failed to parse document: {exc}") from exc
