import re
import subprocess
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree


def extract_docx_text(file_bytes: bytes, max_chars: int = 6000) -> str:
    """Extract text from a .docx file using the Word XML document body."""
    with tempfile.NamedTemporaryFile(suffix=".docx") as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        with zipfile.ZipFile(tmp.name) as zf:
            xml = zf.read("word/document.xml")

    root = ElementTree.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for para in root.findall(".//w:p", ns):
        parts = [node.text or "" for node in para.findall(".//w:t", ns)]
        text = "".join(parts).strip()
        if text:
            paragraphs.append(text)

    return _truncate_text("\n".join(paragraphs), max_chars)


def extract_doc_text(file_bytes: bytes, max_chars: int = 6000) -> str:
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


def extract_word_text(file_bytes: bytes, filename: str, max_chars: int = 6000) -> str:
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


def _truncate_text(text: str, max_chars: int) -> str:
    clean = re.sub(r"\n{3,}", "\n\n", text).strip()
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
