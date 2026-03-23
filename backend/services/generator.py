import re
from collections import defaultdict
from models import GenerationRequest, GeneratedDraft, QAItem, ReferenceInput
from services.gemini import generate_text
from services.utils import extract_json

SYSTEM_PROMPT = """你是一位资深临床医学编辑，专注于为临床医生撰写实用、循证的诊疗内容。

核心写作原则：
1. 最小改动：在原文基础上进行针对性修订和补充，原文中已符合质量要求和用户需求的内容必须原样保留，不得大篇幅改写。只有当原内容在整体框架结构上存在明显缺陷时，才可进行大幅调整。
2. 证据至上：所有新增或修订内容必须严格基于提供的参考文献和Q&A数据，禁止主观推测或编造数据。如果证据不足以支撑某个论点，明确标注"证据有限"。
3. 精准溯源：每一个事实性陈述、数据、结论后必须标注引用标记[参考文献序号]（如[1]、[2]）或[Q&A编号]（如[Q1]、[Q3]）。一句话可有多个引用。
4. 时效优先：当多个证据源存在时，优先采用最近发布、最权威的来源（国际/国家指南 > 地方指南 > 教材 > 专家意见）。

语言精炼专业，避免冗余。"""


def _select_relevant_qa(qa_items: list, section: str, gap_description: str, limit: int = 20) -> list:
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


def format_qa_references(qa_items: list) -> str:
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


def _chunk_reference(text: str, chunk_size: int = 500) -> list:
    """将参考文献按段落切分，过短段落合并到 chunk_size 左右。"""
    paragraphs = re.split(r'\n{2,}', text)
    chunks = []
    buf = ""
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if len(buf) + len(p) > chunk_size and buf:
            chunks.append(buf)
            buf = p
        else:
            buf = (buf + "\n" + p).strip() if buf else p
    if buf:
        chunks.append(buf)
    return chunks


def _extract_relevant_chunks(
    ref_inputs: list,
    section: str,
    gap_description: str,
    max_total_chars: int = 60000,
) -> str:
    """从所有参考文献中按相关性提取片段，带文献编号标注。"""
    if not ref_inputs:
        return "（无参考文献）"

    keywords = [kw.lower() for kw in (section + " " + gap_description).split() if len(kw) > 1]

    scored_chunks = []  # (score, ref_id, chunk)
    for ref in ref_inputs:
        chunks = _chunk_reference(ref.text)
        for chunk in chunks:
            text_lower = chunk.lower()
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                scored_chunks.append((score, ref.id, chunk))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)

    # 按总字符预算选取
    selected = []
    total = 0
    for score, ref_id, chunk in scored_chunks:
        if total + len(chunk) > max_total_chars:
            break
        selected.append((ref_id, chunk))
        total += len(chunk)

    if not selected:
        # 无关键词匹配时，每篇取前 2000 字符
        blocks = []
        for ref in ref_inputs:
            blocks.append(f"[{ref.id}] {ref.filename}\n{ref.text[:2000]}")
        return "\n\n---\n\n".join(blocks)

    # 按文献编号分组输出
    by_ref = defaultdict(list)
    for ref_id, chunk in selected:
        by_ref[ref_id].append(chunk)

    ref_map = {r.id: r.filename for r in ref_inputs}
    blocks = []
    for ref_id in sorted(by_ref.keys()):
        header = f"[{ref_id}] {ref_map[ref_id]}"
        body = "\n\n".join(by_ref[ref_id])
        blocks.append(f"{header}\n{body}")
    return "\n\n---\n\n".join(blocks)


async def generate_section_draft(req: GenerationRequest) -> GeneratedDraft:
    relevant_qa = _select_relevant_qa(req.qa_references, req.section, req.gap_description)
    qa_text = format_qa_references(relevant_qa)
    original_content = req.original_content if req.original_content else "（该章节暂无内容）"
    context_preview = req.article_context[:5000] if req.article_context else ""

    ref_doc_text = _extract_relevant_chunks(req.reference_inputs, req.section, req.gap_description)

    prompt = f"""请为【{req.disease}】的【{req.section}】章节撰写/完善内容。

## 改进要求
{req.gap_description}

## 当前章节内容（必须在此基础上针对性修订，原文合格部分原样保留）
{original_content}

## 词条其他内容参考（了解整体上下文，不需要引用）
{context_preview}

## 相关临床Q&A参考（引用时使用[Q编号]）
{qa_text}

## 参考文献（引用时使用[文献序号]，如[1]、[2]）
{ref_doc_text}

## 输出要求
请以JSON格式输出（不要包含 original_content 字段，只输出以下字段）：
{{
  "generated_content": "完整的改进后章节内容（Markdown格式，结构清晰，使用小标题和列表）",
  "key_changes": ["主要改动点1", "主要改动点2", "主要改动点3"],
  "references_used": ["引用的参考文献和Q&A编号，如[1][Q1][Q3]等"]
}}

## 写作规范（极其重要）
- 最小改动原则：仅针对"改进要求"中指出的问题进行修订和补充，原文中已合格的内容必须原样保留，禁止大篇幅改写。只有当原文框架结构存在明显缺陷时才可大幅调整。
- 每个事实性陈述必须跟随引用标记，如"推荐剂量为10mg/日[1]"
- 仅使用提供的参考文献和Q&A，不得引入未提供的数据
- 多来源时优先采用文件名含"指南"、年份较新的来源
- 在 generated_content 末尾添加"参考文献"小节，列出引用的文献编号和名称
- 面向临床医生，语言专业精炼
- 关键推荐注明证据级别（如：A级推荐、B级推荐）
- 剂量、疗程等具体参数须准确
- 使用Markdown格式：## 小标题、- 列表项、**加粗**关键词"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    return GeneratedDraft(
        section=req.section,
        original_content=req.original_content or "",
        generated_content=data["generated_content"],
        key_changes=data.get("key_changes", []),
        references_used=data.get("references_used", [])
    )
