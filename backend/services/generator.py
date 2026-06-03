import re
from collections import defaultdict
from models import (
    GenerationRequest, GeneratedDraft, QAItem, ReferenceInput,
    BatchGenerationRequest, BatchGeneratedDraft,
)
from services.text_llm import generate_text
from services.utils import extract_json

SYSTEM_PROMPT = """你是一位资深临床医学编辑，专注于为临床医生撰写实用、循证的诊疗内容。

核心写作原则：
1. 最小改动：在原文基础上进行针对性修订和补充，原文中已符合质量要求和用户需求的内容必须原样保留，不得大篇幅改写。只有当原内容在整体框架结构上存在明显缺陷时，才可进行大幅调整。
2. 证据至上：所有新增或修订内容必须严格基于提供的参考文献和Q&A数据，禁止主观推测或编造数据。如果证据不足以支撑某个论点，明确标注"证据有限"。
3. 精准溯源：每一个事实性陈述、数据、结论后必须标注引用标记[参考文献序号]（如[1]、[2]）或[Q&A编号]（如[Q1]、[Q3]）。一句话可有多个引用。
4. 时效优先：当多个证据源存在时，优先采用最近发布、最权威的来源（国际/国家指南 > 地方指南 > 教材 > 专家意见）。

语言精炼专业，避免冗余。"""

# 共享的内容规范——注入到所有生成 prompt 中
CONTENT_RULES = """
## 内容写作规范

### 多源融合规则
- 多篇参考资料有同一内容时，选择内容新、权威性高、更全面的作为主体框架，缺失处由其他资料补充
- 内容冲突时以更新、权威性更高者为准；无法判断时两者均保留并标注各自来源
- 融合后做到语言通顺、逻辑合理、不重复；不是简单罗列，而是恰当融合

### 取舍规则
- 同一药物同适应症不同参考资料剂量/疗程不同时，均保留并标注具体来源
- 同类内容冲突时，需理解内容意思后取舍，有冲突须在理解基础上保留合理内容

### 研究性内容处理
- 使用总分结构：总结性意见放最前面，再分层描述各项研究
- 只保留结论性语句（时间、人物、研究性质、结论），研究细节及方法删除
- 格式参考：XX年XX[文献序号]的meta分析结果显示XXX
- 多个研究论证同一观点时，保留一个结论，插入多篇参考文献
- 已有总述性结论且后续研究意思一致时，删除重复的细节研究

### 分层规则
- 不要以单独一句或半句话作为分层标记，避免过度分层打乱原有结构
- 分层原则：根据内容结构拆解，每部分表达同一层意思，可概括为一个中心，呈总分结构

### 格式规范
- 英文缩写首次出现时给出中英文全称，格式：社区获得性肺炎（community acquired pneumonia，CAP）
- 标题中不得出现英文缩写，应使用中文全称
- 标题字数一般不超过20字，须起提纲作用
- 不得保留"本指南""本共识""专家组认为""我们认为"等字眼
"""


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

## 词条其他章节内容（了解整体上下文，避免与其他章节内容重复）
{context_preview}
{CONTENT_RULES}
## 单章节写作要点（极其重要）
- **最小改动原则**：仅针对"改进要求"中指出的问题进行修订和补充，原文中已合格的内容必须原样保留，禁止大篇幅改写。只有当原文框架结构存在明显缺陷时才可大幅调整。
- **边界意识**：参考"词条其他章节内容"了解上下文，本章节中不要重复其他章节已有的内容。若需引用其他章节内容，使用"详见「XXX」章节"引导。
- **深度优先**：在本章节范围内把问题彻底解决，内容要完整、具体、可操作，不要泛泛而谈。
- 每个事实性陈述必须跟随引用标记，如"推荐剂量为10mg/日[1]"
- 仅使用提供的参考文献和Q&A，不得引入未提供的数据
- 多来源时优先采用文件名含"指南"、年份较新的来源
- 在 generated_content 末尾添加"参考文献"小节，列出引用的文献编号和名称
- 面向临床医生，语言专业精炼
- 剂量、疗程等具体参数须准确
- 使用Markdown格式：## 小标题、- 列表项、**加粗**关键词

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
}}"""

    text = await generate_text(prompt, SYSTEM_PROMPT, context="draft_generation")
    data = extract_json(text)

    return GeneratedDraft(
        section=req.section,
        original_content=req.original_content or "",
        generated_content=data["generated_content"],
        key_changes=data.get("key_changes", []),
        references_used=data.get("references_used", [])
    )


async def generate_multi_section_draft(req: BatchGenerationRequest) -> BatchGeneratedDraft:
    """联合生成多个章节的内容，确保跨章节协调：无重复、术语一致、交叉引用合理。"""

    # 合并所有 section 的关键词来选取参考资料
    all_sections = " ".join(s.section for s in req.sections)
    all_descriptions = " ".join(s.gap_description for s in req.sections)
    combined_keywords = all_sections + " " + all_descriptions

    relevant_qa = _select_relevant_qa(req.qa_references, all_sections, all_descriptions, limit=30)
    qa_text = format_qa_references(relevant_qa)
    context_preview = req.article_context[:5000] if req.article_context else ""

    ref_doc_text = _extract_relevant_chunks(
        req.reference_inputs, all_sections, all_descriptions, max_total_chars=80000,
    )

    # 构建每个章节的任务描述
    section_blocks = []
    for i, item in enumerate(req.sections, 1):
        original = item.original_content if item.original_content else "（该章节暂无内容）"
        section_blocks.append(f"""### 章节{i}：{item.section}

**改进要求：**
{item.gap_description}

**当前内容：**
{original}""")

    sections_text = "\n\n---\n\n".join(section_blocks)

    # 构建 JSON 输出格式示例
    output_items = []
    for i, item in enumerate(req.sections, 1):
        output_items.append(f"""    {{
      "section": "{item.section}",
      "generated_content": "章节{i}改进后的完整内容（Markdown格式）",
      "key_changes": ["改动点1", "改动点2"],
      "references_used": ["[1]", "[Q1]"]
    }}""")
    output_example = ",\n".join(output_items)

    prompt = f"""请为【{req.disease}】的以下 {len(req.sections)} 个章节**联合撰写/完善**内容。

⚠️ 这些章节涉及相互关联的内容，必须**先统一规划内容分工，再分别输出**，确保：
1. **内容归位**：每项信息只放在最合适的章节。例如：与诊断相关的分类/分型放在"诊断"而非"基础知识"；预后分层若指导治疗则放在"治疗"章节
2. **不重复**：同一信息不在多个章节中展开，其他章节简要提及并用"详见「XXX」章节"引导
3. **术语一致**：相同概念在所有章节中使用完全相同的名称和缩写，英文缩写在每个章节首次出现时均给出全称
4. **逻辑衔接**：各章节内容互补而非孤立，形成连贯的诊疗知识体系
5. **一致的深度**：各章节的详略程度应与其临床重要性匹配，避免某章节过度展开而另一章节过于简略

## 需要联合生成的章节

{sections_text}

## 词条其他章节内容（了解整体上下文，避免与未参与联合生成的章节重复）
{context_preview}
{CONTENT_RULES}
## 联合生成写作要点（极其重要）
- **最小改动原则**：仅针对各章节"改进要求"中指出的问题进行修订和补充，原文合格部分必须原样保留
- **先规划后执行**：先确定每项内容应放在哪个章节、各章节间如何分工衔接，再逐章节生成
- **跨章节去重**：如果两个章节的改进要求涉及相同内容（如某种药物），只在一个章节详细展开，另一个简要引用
- 每个事实性陈述必须跟随引用标记，如"推荐剂量为10mg/日[1]"
- 仅使用提供的参考文献和Q&A，不得引入未提供的数据
- 多来源时优先采用文件名含"指南"、年份较新的来源
- 每个章节的 generated_content 末尾添加"参考文献"小节
- 面向临床医生，语言专业精炼
- 剂量、疗程等具体参数须准确
- 使用Markdown格式：## 小标题、- 列表项、**加粗**关键词

## 相关临床Q&A参考（引用时使用[Q编号]）
{qa_text}

## 参考文献（引用时使用[文献序号]，如[1]、[2]）
{ref_doc_text}

## 输出要求
请以JSON格式输出：
{{
  "drafts": [
{output_example}
  ],
  "coordination_notes": "跨章节协调说明：①各章节如何分工 ②哪些内容做了去重处理 ③术语如何统一"
}}"""

    text = await generate_text(prompt, SYSTEM_PROMPT, context="batch_draft_generation")
    data = extract_json(text)

    drafts = []
    for i, draft_data in enumerate(data.get("drafts", [])):
        if not isinstance(draft_data, dict):
            continue
        # 匹配回原始 section 信息
        section_name = draft_data.get("section", req.sections[i].section if i < len(req.sections) else "")
        original_content = ""
        for item in req.sections:
            if item.section == section_name:
                original_content = item.original_content or ""
                break
        drafts.append(GeneratedDraft(
            section=section_name,
            original_content=original_content,
            generated_content=draft_data.get("generated_content", ""),
            key_changes=draft_data.get("key_changes", []),
            references_used=draft_data.get("references_used", []),
        ))

    return BatchGeneratedDraft(
        drafts=drafts,
        coordination_notes=data.get("coordination_notes", ""),
    )
