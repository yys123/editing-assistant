import re
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree


def extract_docx_text(file_bytes: bytes, max_chars: Optional[int] = None) -> str:
    """Extract text from a .docx file using the Word XML document body."""
    return _extract_docx_text(file_bytes, max_chars=max_chars, mark_superscript_citations=False)


def extract_reference_docx_text(file_bytes: bytes, max_chars: Optional[int] = None) -> str:
    """Extract .docx reference text and preserve numeric superscript citations."""
    return _extract_docx_text(file_bytes, max_chars=max_chars, mark_superscript_citations=True)


def _extract_docx_text(
    file_bytes: bytes,
    max_chars: Optional[int] = None,
    mark_superscript_citations: bool = False,
) -> str:
    with tempfile.NamedTemporaryFile(suffix=".docx") as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        with zipfile.ZipFile(tmp.name) as zf:
            xml = zf.read("word/document.xml")

    root = ElementTree.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for para in root.findall(".//w:p", ns):
        if mark_superscript_citations:
            parts = _paragraph_parts_with_reference_citations(para, ns)
        else:
            parts = [node.text or "" for node in para.findall(".//w:t", ns)]
        text = "".join(parts).strip()
        if text:
            paragraphs.append(text)

    text = "\n".join(paragraphs)
    if mark_superscript_citations:
        text = _mark_inline_sentence_citations(text)
    return _truncate_text(text, max_chars)


def extract_doc_text(file_bytes: bytes, max_chars: Optional[int] = None) -> str:
    """Extract text from a legacy .doc file via macOS textutil when available."""
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / "input.doc"
        output_path = Path(tmpdir) / "input.txt"
        input_path.write_bytes(file_bytes)
        try:
            subprocess.run(
                ["textutil", "-convert", "txt", str(input_path), "-output", str(output_path)],
                check=True,
                capture_output=True,
                timeout=20,
            )
        except Exception as exc:
            raise ValueError("无法解析 .doc 文件，请尝试转换为 .docx 后上传") from exc
        text = output_path.read_text(encoding="utf-8", errors="replace")
    return _truncate_text(text, max_chars)


def extract_word_text(file_bytes: bytes, filename: str, max_chars: Optional[int] = None) -> str:
    lower = filename.lower()
    if lower.endswith(".docx"):
        text = extract_docx_text(file_bytes, max_chars=max_chars)
    elif lower.endswith(".doc"):
        text = extract_doc_text(file_bytes, max_chars=max_chars)
    else:
        raise ValueError("不支持的 Word 文档格式")
    if not text.strip():
        raise ValueError("Word 文档内容为空或无法提取正文")
    return text


def extract_reference_word_text(file_bytes: bytes, filename: str, max_chars: Optional[int] = None) -> str:
    lower = filename.lower()
    if lower.endswith(".docx"):
        text = extract_reference_docx_text(file_bytes, max_chars=max_chars)
    elif lower.endswith(".doc"):
        text = extract_doc_text(file_bytes, max_chars=max_chars)
    else:
        raise ValueError("不支持的 Word 文档格式")
    if not text.strip():
        raise ValueError("Word 文档内容为空或无法提取正文")
    return text


_SUPERSCRIPT_DIGITS = str.maketrans({
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁻": "-",
})


def _paragraph_parts_with_reference_citations(para: ElementTree.Element, ns: dict) -> list[str]:
    parts: list[str] = []
    citation_buffer: list[str] = []

    def flush_citation_buffer() -> None:
        if not citation_buffer:
            return
        raw = "".join(citation_buffer)
        marker = _format_reference_citation_marker(raw)
        parts.append(marker if marker else raw)
        citation_buffer.clear()

    for run in para.findall("./w:r", ns):
        text = "".join(node.text or "" for node in run.findall(".//w:t", ns))
        if not text:
            continue
        if _is_superscript_run(run, ns) and _is_possible_reference_citation_text(text):
            citation_buffer.append(text)
            continue
        flush_citation_buffer()
        parts.append(text)

    flush_citation_buffer()
    return parts


def _is_superscript_run(run: ElementTree.Element, ns: dict) -> bool:
    vert_align = run.find("./w:rPr/w:vertAlign", ns)
    if vert_align is not None and vert_align.get(f"{{{ns['w']}}}val") == "superscript":
        return True

    run_style = run.find("./w:rPr/w:rStyle", ns)
    style_value = run_style.get(f"{{{ns['w']}}}val", "") if run_style is not None else ""
    normalized_style = re.sub(r"[^a-z]", "", style_value.lower())
    return normalized_style in {"endnotereference", "footnotereference"}


def _is_possible_reference_citation_text(text: str) -> bool:
    normalized = text.translate(_SUPERSCRIPT_DIGITS)
    return bool(re.fullmatch(r"[\s\d,，、;；\[\]［］【】\-–—]+", normalized or ""))


def _format_reference_citation_marker(raw: str) -> Optional[str]:
    normalized = raw.translate(_SUPERSCRIPT_DIGITS)
    normalized = normalized.strip()
    normalized = re.sub(r"^[\[［【]\s*|\s*[\]］】]$", "", normalized)
    normalized = re.sub(r"\s+", "", normalized)
    normalized = normalized.replace("，", ",").replace("、", ",")
    normalized = normalized.replace("；", ",").replace(";", ",")
    normalized = normalized.replace("–", "-").replace("—", "-")
    tokens = [token for token in normalized.split(",") if token]
    if not tokens:
        return None
    if not all(re.fullmatch(r"\d+(?:-\d+)?", token) for token in tokens):
        return None
    return f"[{','.join(tokens)}]"


_INLINE_SENTENCE_CITATION_RE = re.compile(
    r"(?P<punct>[.!?。！？])"
    r"(?P<citation>\d+(?:\s*[-–—]\s*\d+)?(?:\s*[,，、;；]\s*\d+(?:\s*[-–—]\s*\d+)?)*)"
    r"(?P<after>\s+(?=[A-Z(（])|\s*$|$)"
)


def _mark_inline_sentence_citations(text: str) -> str:
    def replace(match: re.Match) -> str:
        marker = _format_reference_citation_marker(match.group("citation"))
        if not marker:
            return match.group(0)
        return f"{match.group('punct')}{marker}{match.group('after')}"

    return _INLINE_SENTENCE_CITATION_RE.sub(replace, text)


def _truncate_text(text: str, max_chars: Optional[int]) -> str:
    clean = re.sub(r"\n{3,}", "\n\n", text).strip()
    if max_chars is None:
        return clean
    if len(clean) <= max_chars:
        return clean
    truncated = clean[:max_chars]
    last_period = max(
        truncated.rfind("。"), truncated.rfind("."),
        truncated.rfind("！"), truncated.rfind("？"),
    )
    if last_period > max_chars // 2:
        truncated = truncated[: last_period + 1]
    return truncated.strip()
