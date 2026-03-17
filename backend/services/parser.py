import pandas as pd
import io
from typing import List
from models import QAItem


def parse_qa_file(file_bytes: bytes, filename: str) -> List[QAItem]:
    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8-sig")
    elif filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        raise ValueError(f"Unsupported file format: {filename}. Use CSV or Excel.")

    df.columns = [c.strip().lower() for c in df.columns]

    # Flexible column mapping
    col_map = {}
    for col in df.columns:
        if any(k in col for k in ["问题", "question", "提问", "问"]):
            col_map["question"] = col
        elif any(k in col for k in ["回答", "answer", "答案", "答"]):
            col_map["answer"] = col
        elif any(k in col for k in ["证据", "evidence", "参考", "来源", "引用"]):
            col_map["evidence"] = col

    if "question" not in col_map:
        raise ValueError("未找到问题列，请确保表格包含'问题'或'question'列")

    items = []
    for _, row in df.iterrows():
        q = str(row[col_map["question"]]).strip()
        if not q or q == "nan":
            continue
        items.append(QAItem(
            question=q,
            answer=str(row[col_map["answer"]]).strip() if "answer" in col_map else None,
            evidence=str(row[col_map["evidence"]]).strip() if "evidence" in col_map else None,
        ))

    return items
