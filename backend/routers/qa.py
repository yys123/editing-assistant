from fastapi import APIRouter, UploadFile, File, HTTPException
from services.parser import parse_qa_file

router = APIRouter(prefix="/api/qa", tags=["qa"])


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
