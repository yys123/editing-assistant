import base64
import uuid
import time
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Dict, List
from services.scraper import fetch_article_from_url, parse_html_to_text, parse_html_structured, parse_txt_structured, extract_images_from_html
from services.gemini import analyze_image
from services.pdf import extract_pdf_text
from services.section_parser import parse_article_sections
from models import ReferenceDoc
from pydantic import BaseModel

from auth import get_current_user

router = APIRouter(prefix="/api/article", tags=["article"], dependencies=[Depends(get_current_user)])

# In-memory store for chunked uploads (auto-cleaned after 30 min)
_chunk_store: Dict[str, dict] = {}

SUPPORTED_TYPES = {
    "text/plain", "text/markdown",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}


@router.post("/url")
async def load_from_url(url: str = Form(...)):
    try:
        content = await fetch_article_from_url(url)
        if not content.strip():
            raise HTTPException(400, "页面内容为空，请检查URL是否正确")
        return {"content": content, "source": url, "length": len(content)}
    except Exception as e:
        raise HTTPException(400, f"无法获取页面内容: {str(e)}")


@router.post("/upload")
async def upload_article(file: UploadFile = File(...)):
    content_bytes = await file.read()

    filename = file.filename or ""

    if filename.endswith((".html", ".htm")):
        try:
            html = content_bytes.decode("utf-8-sig")
        except Exception:
            html = content_bytes.decode("gbk", errors="replace")
        content = parse_html_structured(html)
        if not content.strip():
            raise HTTPException(400, "HTML 文件内容为空或无法提取正文")

        # Extract and analyze embedded images using Gemini vision
        content = await _inject_image_analysis(html, content)

        return {"content": content, "source": filename, "length": len(content)}

    if filename.endswith(".txt"):
        try:
            raw_text = content_bytes.decode("utf-8-sig")
        except Exception:
            raw_text = content_bytes.decode("gbk", errors="replace")
        content = parse_txt_structured(raw_text)
        if not content.strip():
            raise HTTPException(400, "TXT 文件内容为空或无法提取正文")
        return {"content": content, "source": filename, "length": len(content)}

    if filename.endswith(".md"):
        try:
            raw_text = content_bytes.decode("utf-8-sig")
        except Exception:
            raw_text = content_bytes.decode("gbk", errors="replace")
        content = parse_txt_structured(raw_text)
        if not content.strip():
            content = raw_text
        return {"content": content, "source": filename, "length": len(content)}

    raise HTTPException(400, "支持 .html / .htm / .txt / .md 格式")


@router.post("/text")
async def submit_text(content: str = Form(...), disease: str = Form(...)):
    if not content.strip():
        raise HTTPException(400, "内容不能为空")
    return {"content": content, "source": f"手动输入 - {disease}", "length": len(content)}


class ParseSectionsRequest(BaseModel):
    article_content: str


@router.post("/parse-sections")
async def parse_sections(req: ParseSectionsRequest):
    """Parse article content into sections."""
    if not req.article_content.strip():
        raise HTTPException(400, "内容不能为空")
    try:
        result = await parse_article_sections(req.article_content)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"章节解析失败: {str(e)}")


@router.post("/upload-pdf")
async def upload_pdf(files: List[UploadFile] = File(...)):
    """Upload multiple PDF or HTML files and extract their text."""
    results = []
    for file in files:
        filename = file.filename or "unknown"
        lower = filename.lower()
        if not (lower.endswith(".pdf") or lower.endswith(".html") or lower.endswith(".htm")):
            raise HTTPException(400, f"文件 {filename} 格式不支持，请上传 PDF 或 HTML 文件")
        try:
            content_bytes = await file.read()
            if lower.endswith(".pdf"):
                text = extract_pdf_text(content_bytes)
            else:
                try:
                    html = content_bytes.decode("utf-8-sig")
                except Exception:
                    html = content_bytes.decode("gbk", errors="replace")
                text = parse_html_to_text(html)
                if not text.strip():
                    raise ValueError("HTML 文件内容为空或无法提取正文")
            results.append(ReferenceDoc(
                filename=filename,
                text=text,
                char_count=len(text),
            ).model_dump())
        except Exception as e:
            raise HTTPException(500, f"解析 {filename} 失败: {str(e)}")
    return results


async def _inject_image_analysis(html: str, structured_text: str) -> str:
    """Analyze embedded images in HTML and inject extracted content into structured text.

    For each [图片] marker in the structured text, calls Gemini vision on the
    corresponding base64 image and inserts a [图片内容] block below it.
    """
    images = extract_images_from_html(html)
    if not images:
        return structured_text

    # Analyze all images (in document order)
    analyses = []
    for img in images:
        text = await analyze_image(img["data"], img["mime_type"], img["caption"])
        analyses.append(text)

    # Inject [图片内容] after each [图片] marker, matched positionally
    lines = structured_text.split("\n")
    result: List[str] = []
    img_idx = 0
    for line in lines:
        result.append(line)
        if line.startswith("[图片]") and img_idx < len(analyses):
            analysis = analyses[img_idx]
            img_idx += 1
            if analysis:
                result.append(f"[图片内容] {analysis}")
    return "\n".join(result)


@router.post("/upload-standard")
async def upload_standard(file: UploadFile = File(...), standard_type: str = Form(...)):
    """Upload a standards document (txt/pdf) to override built-in standards."""
    if standard_type not in ("quality", "spec"):
        raise HTTPException(400, "standard_type must be 'quality' or 'spec'")
    filename = file.filename or ""
    content_bytes = await file.read()
    if filename.lower().endswith(".pdf"):
        text = extract_pdf_text(content_bytes, max_chars=12000)
    else:
        try:
            text = content_bytes.decode("utf-8-sig")
        except Exception:
            text = content_bytes.decode("gbk", errors="replace")
    return {"text": text, "char_count": len(text)}


# ── Base64 JSON upload endpoints (avoid multipart for slow networks) ──


class B64FileUpload(BaseModel):
    filename: str
    data: str  # base64-encoded file content


class B64PdfUpload(BaseModel):
    files: List[B64FileUpload]


class B64StandardUpload(BaseModel):
    filename: str
    data: str
    standard_type: str


def _decode_b64(data: str) -> bytes:
    try:
        return base64.b64decode(data)
    except Exception:
        raise HTTPException(400, "无效的文件编码")


@router.post("/upload-b64")
async def upload_article_b64(req: B64FileUpload):
    """Upload article via base64 JSON (avoids multipart)."""
    content_bytes = _decode_b64(req.data)
    filename = req.filename or ""

    if filename.endswith((".html", ".htm")):
        try:
            html = content_bytes.decode("utf-8-sig")
        except Exception:
            html = content_bytes.decode("gbk", errors="replace")
        content = parse_html_structured(html)
        if not content.strip():
            raise HTTPException(400, "HTML 文件内容为空或无法提取正文")
        content = await _inject_image_analysis(html, content)
        return {"content": content, "source": filename, "length": len(content)}

    if filename.endswith(".txt"):
        try:
            raw_text = content_bytes.decode("utf-8-sig")
        except Exception:
            raw_text = content_bytes.decode("gbk", errors="replace")
        content = parse_txt_structured(raw_text)
        if not content.strip():
            raise HTTPException(400, "TXT 文件内容为空或无法提取正文")
        return {"content": content, "source": filename, "length": len(content)}

    if filename.endswith(".md"):
        try:
            raw_text = content_bytes.decode("utf-8-sig")
        except Exception:
            raw_text = content_bytes.decode("gbk", errors="replace")
        content = parse_txt_structured(raw_text)
        if not content.strip():
            content = raw_text
        return {"content": content, "source": filename, "length": len(content)}

    raise HTTPException(400, "支持 .html / .htm / .txt / .md 格式")


@router.post("/upload-pdf-b64")
async def upload_pdf_b64(req: B64PdfUpload):
    """Upload PDFs via base64 JSON (avoids multipart)."""
    results = []
    for item in req.files:
        filename = item.filename or "unknown"
        lower = filename.lower()
        if not (lower.endswith(".pdf") or lower.endswith(".html") or lower.endswith(".htm")):
            raise HTTPException(400, f"文件 {filename} 格式不支持，请上传 PDF 或 HTML 文件")
        try:
            content_bytes = _decode_b64(item.data)
            if lower.endswith(".pdf"):
                text = extract_pdf_text(content_bytes)
            else:
                try:
                    html = content_bytes.decode("utf-8-sig")
                except Exception:
                    html = content_bytes.decode("gbk", errors="replace")
                text = parse_html_to_text(html)
                if not text.strip():
                    raise ValueError("HTML 文件内容为空或无法提取正文")
            results.append(ReferenceDoc(
                filename=filename,
                text=text,
                char_count=len(text),
            ).model_dump())
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"解析 {filename} 失败: {str(e)}")
    return results


@router.post("/upload-standard-b64")
async def upload_standard_b64(req: B64StandardUpload):
    """Upload standards document via base64 JSON."""
    if req.standard_type not in ("quality", "spec"):
        raise HTTPException(400, "standard_type must be 'quality' or 'spec'")
    content_bytes = _decode_b64(req.data)
    filename = req.filename or ""
    if filename.lower().endswith(".pdf"):
        text = extract_pdf_text(content_bytes, max_chars=12000)
    else:
        try:
            text = content_bytes.decode("utf-8-sig")
        except Exception:
            text = content_bytes.decode("gbk", errors="replace")
    return {"text": text, "char_count": len(text)}


# ── Chunked upload for slow networks ──


def _cleanup_old_chunks():
    """Remove chunk sessions older than 30 minutes."""
    cutoff = time.time() - 1800
    expired = [k for k, v in _chunk_store.items() if v["created"] < cutoff]
    for k in expired:
        del _chunk_store[k]


class ChunkInitReq(BaseModel):
    filename: str
    total_chunks: int
    upload_type: str  # "article" | "pdf" | "qa" | "standard"
    extra: dict = {}  # e.g. {"standard_type": "quality"}, {"files": ["a.pdf","b.pdf"]}


class ChunkDataReq(BaseModel):
    upload_id: str
    chunk_index: int
    data: str  # base64 chunk


@router.post("/chunk/init")
async def chunk_init(req: ChunkInitReq):
    _cleanup_old_chunks()
    upload_id = uuid.uuid4().hex[:12]
    _chunk_store[upload_id] = {
        "filename": req.filename,
        "total_chunks": req.total_chunks,
        "upload_type": req.upload_type,
        "extra": req.extra,
        "chunks": {},
        "created": time.time(),
    }
    return {"upload_id": upload_id}


@router.post("/chunk/upload")
async def chunk_upload(req: ChunkDataReq):
    session = _chunk_store.get(req.upload_id)
    if not session:
        raise HTTPException(400, "上传会话不存在或已过期")
    session["chunks"][req.chunk_index] = req.data
    received = len(session["chunks"])
    return {"received": received, "total": session["total_chunks"]}


@router.post("/chunk/complete")
async def chunk_complete(upload_id: str = Form(...)):
    session = _chunk_store.pop(upload_id, None)
    if not session:
        raise HTTPException(400, "上传会话不存在或已过期")

    # Reassemble chunks in order
    total = session["total_chunks"]
    if len(session["chunks"]) != total:
        raise HTTPException(400, f"分块不完整: 期望 {total} 块，收到 {len(session['chunks'])} 块")

    full_b64 = "".join(session["chunks"][i] for i in range(total))
    content_bytes = base64.b64decode(full_b64)
    upload_type = session["upload_type"]
    filename = session["filename"]
    extra = session["extra"]

    if upload_type == "article":
        return await _process_article(content_bytes, filename)
    elif upload_type == "pdf":
        filenames = extra.get("filenames", [filename])
        return await _process_pdfs(content_bytes, filenames)
    elif upload_type == "qa":
        return _process_qa(content_bytes, filename)
    elif upload_type == "standard":
        return _process_standard(content_bytes, filename, extra.get("standard_type", "quality"))
    else:
        raise HTTPException(400, f"未知上传类型: {upload_type}")


async def _process_article(content_bytes: bytes, filename: str):
    if filename.endswith((".html", ".htm")):
        try:
            html = content_bytes.decode("utf-8-sig")
        except Exception:
            html = content_bytes.decode("gbk", errors="replace")
        content = parse_html_structured(html)
        if not content.strip():
            raise HTTPException(400, "HTML 文件内容为空或无法提取正文")
        content = await _inject_image_analysis(html, content)
        return {"content": content, "source": filename, "length": len(content)}
    if filename.endswith(".txt"):
        try:
            raw_text = content_bytes.decode("utf-8-sig")
        except Exception:
            raw_text = content_bytes.decode("gbk", errors="replace")
        content = parse_txt_structured(raw_text)
        if not content.strip():
            raise HTTPException(400, "TXT 文件内容为空或无法提取正文")
        return {"content": content, "source": filename, "length": len(content)}
    if filename.endswith(".md"):
        try:
            raw_text = content_bytes.decode("utf-8-sig")
        except Exception:
            raw_text = content_bytes.decode("gbk", errors="replace")
        content = parse_txt_structured(raw_text)
        if not content.strip():
            content = raw_text
        return {"content": content, "source": filename, "length": len(content)}
    raise HTTPException(400, "支持 .html / .htm / .txt / .md 格式")


async def _process_pdfs(content_bytes: bytes, filenames: list):
    """Process concatenated PDF files. For single file upload."""
    results = []
    filename = filenames[0] if filenames else "unknown"
    lower = filename.lower()
    try:
        if lower.endswith(".pdf"):
            text = extract_pdf_text(content_bytes)
        else:
            try:
                html = content_bytes.decode("utf-8-sig")
            except Exception:
                html = content_bytes.decode("gbk", errors="replace")
            text = parse_html_to_text(html)
            if not text.strip():
                raise ValueError("HTML 文件内容为空或无法提取正文")
        results.append(ReferenceDoc(
            filename=filename, text=text, char_count=len(text),
        ).model_dump())
    except Exception as e:
        raise HTTPException(500, f"解析 {filename} 失败: {str(e)}")
    return results


def _process_qa(content_bytes: bytes, filename: str):
    from services.parser import parse_qa_file
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(400, "请上传 CSV 或 Excel 文件")
    try:
        items = parse_qa_file(content_bytes, filename)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"文件解析失败: {str(e)}")
    if not items:
        raise HTTPException(400, "文件中未找到有效的问题数据")
    return {
        "count": len(items),
        "items": [i.model_dump() for i in items],
        "preview": [i.model_dump() for i in items[:5]],
    }


def _process_standard(content_bytes: bytes, filename: str, standard_type: str):
    if standard_type not in ("quality", "spec"):
        raise HTTPException(400, "standard_type must be 'quality' or 'spec'")
    if filename.lower().endswith(".pdf"):
        text = extract_pdf_text(content_bytes, max_chars=12000)
    else:
        try:
            text = content_bytes.decode("utf-8-sig")
        except Exception:
            text = content_bytes.decode("gbk", errors="replace")
    return {"text": text, "char_count": len(text)}
