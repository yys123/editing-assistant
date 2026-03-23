from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import List
from services.scraper import fetch_article_from_url, parse_html_to_text, parse_html_structured, parse_txt_structured, extract_images_from_html
from services.gemini import analyze_image
from services.pdf import extract_pdf_text
from services.section_parser import parse_article_sections
from models import ReferenceDoc
from pydantic import BaseModel

from auth import get_current_user

router = APIRouter(prefix="/api/article", tags=["article"], dependencies=[Depends(get_current_user)])

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
            content = content_bytes.decode("utf-8-sig")
        except Exception:
            content = content_bytes.decode("gbk", errors="replace")
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
