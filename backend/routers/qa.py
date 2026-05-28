import base64
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from services.parser import parse_qa_file

from auth import get_current_user

router = APIRouter(prefix="/api/qa", tags=["qa"], dependencies=[Depends(get_current_user)])


@router.post("/upload")
async def upload_qa(file: UploadFile = File(...)):
    filename = file.filename or ""
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(400, "请上传 CSV 或 Excel 文件")

    content = await file.read()
    try:
        items = parse_qa_file(content, filename)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"文件解析失败: {str(e)}")

    if not items:
        raise HTTPException(400, "文件中未找到有效的问题数据")

    return {
        "count": len(items),
        "items": [i.model_dump() for i in items],
        "preview": [i.model_dump() for i in items[:5]]
    }


class B64QaUpload(BaseModel):
    filename: str
    data: str  # base64


@router.post("/upload-b64")
async def upload_qa_b64(req: B64QaUpload):
    """Upload QA file via base64 JSON (avoids multipart)."""
    filename = req.filename or ""
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(400, "请上传 CSV 或 Excel 文件")

    try:
        content = base64.b64decode(req.data)
    except Exception:
        raise HTTPException(400, "无效的文件编码")

    try:
        items = parse_qa_file(content, filename)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"文件解析失败: {str(e)}")

    if not items:
        raise HTTPException(400, "文件中未找到有效的问题数据")

    return {
        "count": len(items),
        "items": [i.model_dump() for i in items],
        "preview": [i.model_dump() for i in items[:5]]
    }
