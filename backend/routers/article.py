import base64
import hashlib
import html as html_lib
import logging
import re
import secrets
import uuid
import time
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from typing import Dict, List
from services.scraper import fetch_article_from_url, parse_html_to_text, parse_html_structured, parse_txt_structured, extract_images_from_html
from services.gemini import analyze_image
from services.pdf import extract_pdf_text
from services.document import extract_word_text
from services.section_parser import parse_article_sections
from models import ReferenceDoc
from pydantic import BaseModel
from config import settings

from auth import get_current_user

router = APIRouter(prefix="/api/article", tags=["article"], dependencies=[Depends(get_current_user)])
_log = logging.getLogger("uvicorn.error")

# In-memory store for chunked uploads (auto-cleaned after 30 min)
_chunk_store: Dict[str, dict] = {}

SUPPORTED_TYPES = {
    "text/plain", "text/markdown",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}

REFERENCE_EXTENSIONS = (".pdf", ".html", ".htm", ".doc", ".docx")
GUIDE_AUTH_QUERY_KEYS = {
    "appId": "guide_app_id",
    "appSignKey": "guide_app_sign_key",
}
GUIDE_DETAIL_TITLE_KEYS = ("title", "name", "guideName", "guide_name", "articleTitle", "article_title")
GUIDE_DETAIL_CONTENT_KEYS = (
    "content",
    "htmlContent",
    "html_content",
    "guideContent",
    "guide_content",
    "articleContent",
    "article_content",
    "detailContent",
    "detail_content",
    "mainContent",
    "main_content",
    "body",
    "html",
    "text",
    "fullText",
    "full_text",
)
ENTRY_DETAIL_NAME_KEYS = ("name", "title", "entryName", "entry_name", "ncdName", "ncd_name")
ENTRY_DETAIL_CONTENT_KEYS = (
    "content",
    "htmlContent",
    "html_content",
    "entryContent",
    "entry_content",
    "ncdContent",
    "ncd_content",
    "detailContent",
    "detail_content",
    "mainContent",
    "main_content",
    "body",
    "html",
    "text",
    "fullText",
    "full_text",
)
ENTRY_MODULE_TITLE_KEYS = (
    "fieldName",
    "field_name",
    "moduleName",
    "module_name",
    "sectionName",
    "section_name",
    "catalogName",
    "catalog_name",
    "title",
    "name",
)
ENTRY_MODULE_LIST_KEYS = (
    "fieldList",
    "field_list",
    "fields",
    "moduleList",
    "module_list",
    "modules",
    "sectionList",
    "section_list",
    "sections",
    "catalogList",
    "catalog_list",
    "contents",
    "contentList",
    "content_list",
    "items",
    "list",
    "records",
    "children",
)


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


async def _fetch_guide_api(path: str, params: dict) -> dict:
    return await _fetch_signed_api("指南", _guide_base_url(), path, params)


async def _fetch_entry_api(path: str, params: dict) -> dict:
    return await _fetch_signed_api("词条", _entry_base_url(), path, params)


async def _fetch_signed_api(label: str, base_url: str, path: str, params: dict) -> dict:
    url = f"{base_url}/{path}"
    signed_params = _signed_api_params(label, params)
    safe_params = _sanitize_guide_params(signed_params)
    _log.info("%s API request path=%s url=%s params=%s", label, path, url, safe_params)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url, params=signed_params)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"{label}数据源连接失败: {str(e)}")

    response_text = response.text[:1000]
    _log.info(
        "%s API response path=%s status=%s body=%s",
        label,
        path,
        response.status_code,
        response_text,
    )

    if response.status_code >= 400:
        raise HTTPException(
            502,
            {
                "message": f"{label}数据源请求失败 ({response.status_code})",
                "config": _signed_config_summary(base_url),
                "request": {"url": url, "params": safe_params},
                "response": response_text,
            },
        )

    try:
        payload = response.json()
    except Exception:
        raise HTTPException(
            502,
            {
                "message": f"{label}数据源返回格式异常",
                "config": _signed_config_summary(base_url),
                "request": {"url": url, "params": safe_params},
                "response": response_text,
            },
        )

    code = str(payload.get("code", "")).lower()
    if code and code != "success":
        message = payload.get("message") or f"{label}数据源请求失败"
        raise HTTPException(
            502,
            {
                "message": str(message),
                "code": payload.get("code"),
                "config": _signed_config_summary(base_url),
                "request": {"url": url, "params": safe_params},
                "response": payload,
            },
        )

    return payload


def _sanitize_guide_params(params: dict) -> dict:
    safe = {}
    for key, value in params.items():
        if key == "appSignKey":
            safe[key] = "***"
        elif key == "sign":
            value = str(value)
            safe[key] = f"{value[:8]}...{value[-8:]}" if len(value) > 16 else value
        else:
            safe[key] = value
    return safe


def _guide_base_url() -> str:
    return getattr(
        settings,
        "guide_api_base",
        "https://newdrugs.dxy.cn/open-sign-api/article-quality/guide",
    ).rstrip("/")


def _entry_base_url() -> str:
    return getattr(
        settings,
        "ncd_api_base",
        "https://newdrugs.dxy.cn/open-sign-api/article-quality/ncd",
    ).rstrip("/")


def _guide_config_summary() -> dict:
    return _signed_config_summary(_guide_base_url())


def _entry_config_summary() -> dict:
    return _signed_config_summary(_entry_base_url())


def _signed_config_summary(base_url: str) -> dict:
    app_id = str(getattr(settings, "guide_app_id", "") or "").strip()
    app_name = str(getattr(settings, "guide_app_name", "") or "").strip()
    sign_key = str(getattr(settings, "guide_app_sign_key", "") or "").strip()
    return {
        "baseUrl": base_url,
        "appId": app_id,
        "appName": app_name,
        "appSignKeyConfigured": bool(sign_key),
        "appSignKeyLength": len(sign_key),
    }


def _guide_api_params(params: dict) -> dict:
    return _signed_api_params("指南", params)


def _signed_api_params(label: str, params: dict) -> dict:
    sign_params = {
        key: str(value)
        for key, value in params.items()
        if value is not None
    }
    missing = []
    for query_key, setting_name in GUIDE_AUTH_QUERY_KEYS.items():
        value = str(getattr(settings, setting_name, "") or "").strip()
        if not value:
            missing.append(query_key)
        else:
            sign_params[query_key] = value

    if missing:
        raise HTTPException(500, f"{label}数据源凭证未配置: {', '.join(missing)}")

    sign_params["timestamp"] = str(int(time.time() * 1000))
    sign_params["noncestr"] = "".join(str(secrets.randbelow(10)) for _ in range(8))

    sign_source = "&".join(f"{key}={sign_params[key]}" for key in sorted(sign_params))
    masked_sign_source = "&".join(
        f"{key}={'***' if key == 'appSignKey' else sign_params[key]}"
        for key in sorted(sign_params)
    )
    request_params = {key: value for key, value in sign_params.items() if key != "appSignKey"}
    request_params["sign"] = hashlib.sha1(sign_source.encode("utf-8")).hexdigest()
    _log.info("%s API sign fields=%s source=%s", label, sorted(sign_params), masked_sign_source)
    return request_params


def _guide_items_from_response(payload: dict) -> list:
    return _items_from_response(payload, ("title", "name", "guideName", "guide_name"))


def _entry_items_from_response(payload: dict) -> list:
    items = _items_from_response(payload, ENTRY_DETAIL_NAME_KEYS)
    return [{"id": item["id"], "name": item["title"]} for item in items]


def _items_from_response(payload: dict, title_keys: tuple[str, ...]) -> list:
    data = payload.get("data")
    if isinstance(data, list):
        raw_items = data
    elif isinstance(data, dict):
        raw_items = []
        for key in ("items", "list", "records", "results", "rows"):
            value = data.get(key)
            if isinstance(value, list):
                raw_items = value
                break
        if not raw_items and data.get("id") is not None:
            raw_items = [data]
    else:
        raw_items = []

    items = []
    for item in raw_items[:10]:
        if not isinstance(item, dict):
            continue
        try:
            item_id = int(item.get("id"))
        except (TypeError, ValueError):
            continue
        title = _first_guide_text_field(item, title_keys)
        if not title:
            continue
        items.append({"id": item_id, "title": title.strip()})
    return items


def _first_guide_text_field(value, keys: tuple[str, ...]) -> str:
    if isinstance(value, dict):
        for key in keys:
            text = value.get(key)
            if isinstance(text, str) and text.strip():
                return text
        for item in value.values():
            text = _first_guide_text_field(item, keys)
            if text.strip():
                return text
    elif isinstance(value, list):
        parts = []
        for item in value:
            text = _first_guide_text_field(item, keys)
            if text.strip():
                parts.append(text.strip())
        if parts:
            return "\n\n".join(parts)
    return ""


def _direct_text_field(value, keys: tuple[str, ...]) -> str:
    if not isinstance(value, dict):
        return ""
    for key in keys:
        text = value.get(key)
        if isinstance(text, str) and text.strip():
            return text
    return ""


def _looks_like_html(text: str) -> bool:
    return bool(re.search(r"</?[a-zA-Z][\s\S]*>", text))


def _plain_text_to_html(text: str) -> str:
    blocks = []
    for block in re.split(r"\n{2,}", text.strip()):
        lines = [html_lib.escape(line) for line in block.splitlines()]
        blocks.append(f"<p>{'<br>'.join(lines)}</p>")
    return "".join(blocks)


def _entry_module_to_html(item: dict) -> str:
    heading = _direct_text_field(item, ENTRY_MODULE_TITLE_KEYS).strip()
    body = _direct_text_field(item, ENTRY_DETAIL_CONTENT_KEYS).strip()
    child_parts = []
    for key in ENTRY_MODULE_LIST_KEYS:
        children = item.get(key)
        if isinstance(children, list):
            child_html = _entry_modules_to_html(children)
            if child_html:
                child_parts.append(child_html)

    if not body and not child_parts:
        return ""

    parts = []
    if heading:
        parts.append(f'<p class="rich-editor-module-heading">{html_lib.escape(heading)}</p>')
    if body:
        parts.append(body if _looks_like_html(body) else _plain_text_to_html(body))
    parts.extend(child_parts)
    return "".join(parts)


def _entry_modules_to_html(items: list) -> str:
    parts = []
    for item in items:
        if not isinstance(item, dict):
            continue
        module_html = _entry_module_to_html(item)
        if module_html:
            parts.append(module_html)
    return "".join(parts)


def _find_entry_module_html(value) -> str:
    if isinstance(value, dict):
        for key in ENTRY_MODULE_LIST_KEYS:
            items = value.get(key)
            if isinstance(items, list):
                html = _entry_modules_to_html(items)
                if html:
                    return html
        for item in value.values():
            html = _find_entry_module_html(item)
            if html:
                return html
    elif isinstance(value, list):
        html = _entry_modules_to_html(value)
        if html:
            return html
        for item in value:
            html = _find_entry_module_html(item)
            if html:
                return html
    return ""


def _entry_detail_content(data: dict) -> str:
    content = _direct_text_field(data, ENTRY_DETAIL_CONTENT_KEYS)
    if content.strip():
        return content
    return _find_entry_module_html(data)


def _guide_string_field_summary(value, prefix: str = "data", limit: int = 20) -> list:
    fields = []
    if isinstance(value, dict):
        for key, item in value.items():
            if len(fields) >= limit:
                break
            path = f"{prefix}.{key}"
            if isinstance(item, str):
                fields.append({"path": path, "length": len(item), "preview": item[:80]})
            elif isinstance(item, (dict, list)):
                fields.extend(_guide_string_field_summary(item, path, limit - len(fields)))
    elif isinstance(value, list):
        for index, item in enumerate(value[:5]):
            if len(fields) >= limit:
                break
            fields.extend(_guide_string_field_summary(item, f"{prefix}[{index}]", limit - len(fields)))
    return fields[:limit]


@router.get("/guides/search")
async def search_guides(keyword: str = Query(...)):
    keyword = keyword.strip()
    if not keyword:
        raise HTTPException(400, "搜索词不能为空")
    payload = await _fetch_guide_api("search", {"keyword": keyword})
    return {"items": _guide_items_from_response(payload)}


@router.get("/guides/debug-config")
async def debug_guide_config():
    sample_params = _guide_api_params({"keyword": "debug"})
    return {
        **_guide_config_summary(),
        "sampleRequestParams": _sanitize_guide_params(sample_params),
    }


@router.get("/guides/{guide_id}")
async def get_guide_detail(guide_id: int):
    payload = await _fetch_guide_api("detail", {"id": guide_id})
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(502, "指南详情返回格式异常")
    content = _first_guide_text_field(data, GUIDE_DETAIL_CONTENT_KEYS)
    if not content.strip():
        raise HTTPException(
            502,
            {
                "message": "指南详情内容为空",
                "dataKeys": list(data.keys()),
                "stringFields": _guide_string_field_summary(data),
            },
        )
    title = _first_guide_text_field(data, GUIDE_DETAIL_TITLE_KEYS) or f"指南-{guide_id}"
    title = title.strip()
    return {"id": guide_id, "title": title, "content": content}


@router.get("/entries/search")
async def search_entries(keyword: str = Query(...)):
    keyword = keyword.strip()
    if not keyword:
        raise HTTPException(400, "搜索词不能为空")
    payload = await _fetch_entry_api("search", {"keyword": keyword})
    return {"items": _entry_items_from_response(payload)}


@router.get("/entries/debug-config")
async def debug_entry_config():
    sample_params = _signed_api_params("词条", {"keyword": "debug"})
    return {
        **_entry_config_summary(),
        "sampleRequestParams": _sanitize_guide_params(sample_params),
    }


@router.get("/entries/{entry_id}")
async def get_entry_detail(entry_id: int):
    payload = await _fetch_entry_api("detail", {"id": entry_id})
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(502, "词条详情返回格式异常")
    content = _entry_detail_content(data)
    if not content.strip():
        raise HTTPException(
            502,
            {
                "message": "词条详情内容为空",
                "dataKeys": list(data.keys()),
                "stringFields": _guide_string_field_summary(data),
            },
        )
    name = _first_guide_text_field(data, ENTRY_DETAIL_NAME_KEYS) or f"词条-{entry_id}"
    return {"id": entry_id, "name": name.strip(), "content": content}


@router.post("/upload-pdf")
async def upload_pdf(files: List[UploadFile] = File(...)):
    """Upload multiple reference source files and extract their text."""
    results = []
    for file in files:
        filename = file.filename or "unknown"
        lower = filename.lower()
        if not lower.endswith(REFERENCE_EXTENSIONS):
            raise HTTPException(400, f"文件 {filename} 格式不支持，请上传 PDF、HTML 或 Word 文件")
        try:
            content_bytes = await file.read()
            text = _extract_reference_source_text(content_bytes, filename)
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
    """Upload reference source files via base64 JSON (avoids multipart)."""
    results = []
    for item in req.files:
        filename = item.filename or "unknown"
        lower = filename.lower()
        if not lower.endswith(REFERENCE_EXTENSIONS):
            raise HTTPException(400, f"文件 {filename} 格式不支持，请上传 PDF、HTML 或 Word 文件")
        try:
            content_bytes = _decode_b64(item.data)
            text = _extract_reference_source_text(content_bytes, filename)
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
    """Process a single reference source file upload."""
    results = []
    filename = filenames[0] if filenames else "unknown"
    lower = filename.lower()
    try:
        if not lower.endswith(REFERENCE_EXTENSIONS):
            raise ValueError("格式不支持，请上传 PDF、HTML 或 Word 文件")
        text = _extract_reference_source_text(content_bytes, filename)
        results.append(ReferenceDoc(
            filename=filename, text=text, char_count=len(text),
        ).model_dump())
    except Exception as e:
        raise HTTPException(500, f"解析 {filename} 失败: {str(e)}")
    return results


def _extract_reference_source_text(content_bytes: bytes, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return extract_pdf_text(content_bytes)
    if lower.endswith((".doc", ".docx")):
        return extract_word_text(content_bytes, filename)
    try:
        html = content_bytes.decode("utf-8-sig")
    except Exception:
        html = content_bytes.decode("gbk", errors="replace")
    text = parse_html_to_text(html)
    if not text.strip():
        raise ValueError("HTML 文件内容为空或无法提取正文")
    return text


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
