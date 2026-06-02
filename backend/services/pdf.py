import io
from typing import Optional


def extract_pdf_text(file_bytes: bytes, max_chars: Optional[int] = None) -> str:
    """Extract text from PDF bytes, optionally truncated at a sentence boundary.
    Uses pymupdf (fitz) as primary extractor; falls back to pypdf on failure.
    """
    full_text = _extract_with_pymupdf(file_bytes)
    if not full_text.strip():
        full_text = _extract_with_pypdf(file_bytes)
    if not full_text.strip():
        raise ValueError("无法从 PDF 中提取文本（可能是扫描版或加密 PDF）")

    if max_chars is None or len(full_text) <= max_chars:
        return full_text.strip()

    truncated = full_text[:max_chars]
    last_period = max(
        truncated.rfind("。"), truncated.rfind("."),
        truncated.rfind("！"), truncated.rfind("？"),
    )
    if last_period > max_chars // 2:
        truncated = truncated[: last_period + 1]
    return truncated


def _extract_with_pymupdf(file_bytes: bytes) -> str:
    try:
        import fitz  # pymupdf
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        parts = [page.get_text() for page in doc]
        return "\n".join(parts).strip()
    except Exception:
        return ""


def _extract_with_pypdf(file_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                pass  # skip broken pages, continue with rest
        return "\n".join(parts).strip()
    except Exception:
        return ""
