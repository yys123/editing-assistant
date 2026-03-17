from pypdf import PdfReader
import io


def extract_pdf_text(file_bytes: bytes, max_chars: int = 6000) -> str:
    """Extract text from PDF bytes, truncated to max_chars at a sentence boundary."""
    reader = PdfReader(io.BytesIO(file_bytes))
    parts = []
    for page in reader.pages:
        text = page.extract_text() or ""
        parts.append(text)
    full_text = "\n".join(parts).strip()

    if len(full_text) <= max_chars:
        return full_text

    truncated = full_text[:max_chars]
    # Find last sentence boundary
    last_period = max(truncated.rfind("。"), truncated.rfind("."), truncated.rfind("！"), truncated.rfind("？"))
    if last_period > max_chars // 2:
        truncated = truncated[: last_period + 1]
    return truncated
