import json
from models import GenerationRequest, GeneratedDraft, QAItem
from services.gemini import generate_text
from services.utils import extract_json

SYSTEM_PROMPT = "你是一位资深临床医学编辑，专注于为临床医生撰写实用、循证的诊疗内容。语言精炼专业，避免冗余，每个建议都应有临床依据。"


def _select_relevant_qa(qa_items: list[QAItem], section: str, gap_description: str, limit: int = 20) -> list[QAItem]:
    """按关键词相关性排序，选取最相关的 Q&A 条目。"""
    if not qa_items:
        return []
    keywords = [kw.lower() for kw in (section + " " + gap_description).split() if len(kw) > 1]
    if not keywords:
        return qa_items[:limit]
    scored = []
    for item in qa_items:
        text = (item.question + " " + (item.answer or "")).lower()
        score = sum(1 for kw in keywords if kw in text)
        scored.append((score, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]


def format_qa_references(qa_items: list[QAItem]) -> str:
    if not qa_items:
        return "（无相关Q&A参考）"
    lines = []
    for i, item in enumerate(qa_items):
        line = f"[Q{i+1}] {item.question}"
        if item.answer:
            line += f"\n  回答摘要: {item.answer[:300]}"
        if item.evidence:
            line += f"\n  证据来源: {item.evidence}"
        lines.append(line)
    return "\n\n".join(lines)


async def generate_section_draft(req: GenerationRequest) -> GeneratedDraft:
    relevant_qa = _select_relevant_qa(req.qa_references, req.section, req.gap_description)
    qa_text = format_qa_references(relevant_qa)
    original_preview = req.original_content[:500] if req.original_content else "（该章节暂无内容）"
    context_preview = req.article_context[:2000] if req.article_context else ""

    ref_block = ""
    if req.reference_texts:
        snippets = [t[:2000] for t in req.reference_texts[:2]]
        ref_block = "\n\n## 参考文献摘录（供内容参考）\n" + "\n---\n".join(snippets)

    prompt = f"""请为【{req.disease}】的【{req.section}】章节撰写/完善内容。

## 改进要求
{req.gap_description}

## 当前章节内容（需要在此基础上改进）
{original_preview}

## 词条其他内容参考（了解整体上下文）
{context_preview}

## 相关临床Q&A参考（来自真实医生提问）
{qa_text}{ref_block}

## 输出要求
请以JSON格式输出：
{{
  "section": "{req.section}",
  "original_content": {json.dumps(req.original_content or "", ensure_ascii=False)},
  "generated_content": "完整的改进后章节内容（Markdown格式，结构清晰，使用小标题和列表）",
  "key_changes": ["主要改动点1", "主要改动点2", "主要改动点3"],
  "references_used": ["引用的Q&A编号或证据来源，如[Q1][Q3]等"]
}}

写作规范：
- 面向临床医生，语言专业精炼
- 关键推荐注明证据级别（如：A级推荐、B级推荐）
- 剂量、疗程等具体参数须准确
- 使用Markdown格式：## 小标题、- 列表项、**加粗**关键词
- 改进内容要与原有内容无缝融合，不要重复已有的良好内容"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    return GeneratedDraft(
        section=data["section"],
        original_content=data.get("original_content", req.original_content or ""),
        generated_content=data["generated_content"],
        key_changes=data.get("key_changes", []),
        references_used=data.get("references_used", [])
    )
