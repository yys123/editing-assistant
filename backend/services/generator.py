import json
import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional
from models import (
    GenerationRequest, GeneratedDraft, QAItem, ReferenceInput,
    BatchGenerationRequest, BatchGeneratedDraft, ReferenceAnchor,
    AiIntegrationRequest, AiIntegrationResponse, ConfirmedReferenceChunk, PriorityGuidelineUsage,
)
from services.text_llm import generate_json, generate_text

SYSTEM_PROMPT = """你是一位资深临床医学编辑，专注于为临床医生撰写实用、循证的诊疗内容。

核心写作原则：
1. 最小改动：在原文基础上进行针对性修订和补充，原文中已符合质量要求和用户需求的内容必须原样保留，不得大篇幅改写。只有当原内容在整体框架结构上存在明显缺陷时，才可进行大幅调整。
2. 证据至上：所有新增或修订内容必须严格基于提供的参考文献和Q&A数据，禁止主观推测或编造数据。如果证据不足以支撑某个论点，明确标注"证据有限"。
3. 精准溯源：每一个事实性陈述、数据、结论后必须标注引用标记。引用参考数据源时使用每条证据列出的“引用标记”（如[3-22]），引用Q&A时使用[Q&A编号]（如[Q1]、[Q3]）。一句话可有多个引用。
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


def _strip_markdown_fence(text: str) -> str:
    value = (text or "").strip()
    if value.startswith("```"):
        value = re.sub(r"^```(?:json|markdown|md)?\s*", "", value, flags=re.IGNORECASE)
        value = re.sub(r"\s*```$", "", value)
    return value.strip()


def _parse_bullet_summary(text: str) -> list[str]:
    items = []
    for line in (text or "").splitlines():
        item = re.sub(r"^\s*[-*]\s+", "", line).strip()
        if item:
            items.append(item)
    return items


def _parse_ai_integration_output(raw_answer: str) -> tuple[str, str, list[str]]:
    answer = (raw_answer or "").strip()
    stripped = _strip_markdown_fence(answer)
    try:
        parsed = json.loads(stripped)
        revision = str(parsed.get("revision_text") or parsed.get("修订后正文") or "").strip()
        summary_value = parsed.get("change_summary") or parsed.get("修改说明") or []
        if isinstance(summary_value, str):
            summary = _parse_bullet_summary(summary_value)
        elif isinstance(summary_value, list):
            summary = [str(item).strip() for item in summary_value if str(item).strip()]
        else:
            summary = []
        return answer, revision, summary
    except Exception:
        pass

    revision_match = re.search(
        r"(?ims)^##\s*修订后正文\s*\n(?P<body>.*?)(?=^##\s*(?:修改说明|已解决的问题|仍需人工确认的问题|待确认事项|参考文献)\s*$|\Z)",
        answer,
    )
    summary_match = re.search(
        r"(?ims)^##\s*修改说明\s*\n(?P<body>.*?)(?=^##\s+|\Z)",
        answer,
    )
    revision = revision_match.group("body").strip() if revision_match else ""
    summary = _parse_bullet_summary(summary_match.group("body")) if summary_match else []
    return answer, revision, summary


_PRIORITY_USAGE_SECTION_RE = re.compile(
    r"(?ims)^##\s*重点指南使用情况\s*\n(?P<body>.*?)(?=^##\s+|\Z)"
)


def _extract_priority_usage_section(text: str) -> str:
    match = _PRIORITY_USAGE_SECTION_RE.search(text or "")
    return match.group("body").strip() if match else ""


_SOURCE_CITATION_GROUP_RE = re.compile(r"[\[［【]\s*([0-9\s,，、;；\-–—]+)\s*[\]］】]")


def _source_ids_from_citation_groups(text: str) -> set[int]:
    source_ids: set[int] = set()
    for match in _SOURCE_CITATION_GROUP_RE.finditer(text or ""):
        body = match.group(1)
        parts = re.split(r"[,，、;；]\s*", body)
        for part in parts:
            source_match = re.match(r"\s*(\d+)", part)
            if source_match:
                source_ids.add(int(source_match.group(1)))
    return source_ids


def _infer_priority_guideline_usage(
    text: str,
    priority_source_ids: set[int],
    references_by_id: dict[int, str],
) -> PriorityGuidelineUsage:
    if not priority_source_ids:
        return PriorityGuidelineUsage(status="not_configured")

    usage_section = _extract_priority_usage_section(text)
    combined = f"{text or ''}\n{usage_section}"
    used_ids = _source_ids_from_citation_groups(combined) & priority_source_ids

    used_sources = [
        f"参考数据源 {source_id}：{references_by_id.get(source_id, '')}".rstrip("：")
        for source_id in sorted(used_ids)
    ]
    if used_sources:
        return PriorityGuidelineUsage(status="used", used_sources=used_sources)
    if "未覆盖" in usage_section or "没有覆盖" in usage_section:
        return PriorityGuidelineUsage(status="not_covered")
    return PriorityGuidelineUsage(
        status="not_used",
        warnings=["本次回答未检测到重点指南引用，请人工核查或重新生成。"],
    )


_SUPERSCRIPT_REF_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹"
_SOURCE_REF_DIGIT_TRANSLATION = str.maketrans({
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁻": "-",
})
_SOURCE_REF_BODY_CHARS = rf'0-9{_SUPERSCRIPT_REF_DIGITS}\s,，、;；\-–—⁻'
_INLINE_SOURCE_REF_RE = re.compile(
    rf'\^?\s*(?:<sup>\s*)?[\[［【]\s*([{_SOURCE_REF_BODY_CHARS}]*[0-9{_SUPERSCRIPT_REF_DIGITS}][{_SOURCE_REF_BODY_CHARS}]*)\s*[\]］】]\s*(?:</sup>)?',
    flags=re.IGNORECASE,
)
_SUP_SOURCE_REF_RE = re.compile(
    rf'<sup>\s*([{_SOURCE_REF_BODY_CHARS}]*[0-9{_SUPERSCRIPT_REF_DIGITS}][{_SOURCE_REF_BODY_CHARS}]*)\s*</sup>',
    flags=re.IGNORECASE,
)
_UNICODE_SUP_SOURCE_REF_RE = re.compile(
    rf'[{_SUPERSCRIPT_REF_DIGITS}]+(?:\s*[,，、;；\-–—⁻]\s*[{_SUPERSCRIPT_REF_DIGITS}]+)*'
)
_HASH_SOURCE_REF_RE = re.compile(r'#R(\d+)\b', flags=re.IGNORECASE)


@dataclass
class ReferenceChunk:
    chunk_id: str
    citation_key: str
    source_id: int
    source_filename: str
    text: str
    title_path: str
    context_before: str
    context_after: str
    paragraph_index: int
    source_ref_ids: list[str]
    score: float = 0.0
    confirmed: bool = False


def _reference_chunks_from_confirmed(confirmed_chunks: list[ConfirmedReferenceChunk]) -> list[ReferenceChunk]:
    chunks: list[ReferenceChunk] = []
    for idx, chunk in enumerate(confirmed_chunks):
        source_ref_ids = [str(ref_id).strip() for ref_id in (chunk.source_ref_ids or []) if str(ref_id).strip()]
        citation_key = f"{chunk.source_id}-{source_ref_ids[-1]}" if source_ref_ids else str(chunk.source_id)
        chunks.append(ReferenceChunk(
            chunk_id=chunk.chunk_id or f"R{chunk.source_id}-C{idx + 1:03d}",
            citation_key=citation_key,
            source_id=chunk.source_id,
            source_filename=chunk.source_filename,
            text=chunk.text,
            title_path=chunk.title_path,
            context_before="",
            context_after="",
            paragraph_index=idx,
            source_ref_ids=source_ref_ids,
            confirmed=True,
        ))
    return chunks


def _split_reference_paragraphs(text: str) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r'\n{2,}', text or "") if p.strip()]
    if paragraphs:
        return paragraphs
    stripped = (text or "").strip()
    return [stripped] if stripped else []


def _is_standalone_source_ref_marker(text: str) -> bool:
    stripped = (text or "").strip()
    if not stripped:
        return False
    remaining = stripped
    for pattern in (_INLINE_SOURCE_REF_RE, _SUP_SOURCE_REF_RE):
        remaining = pattern.sub("", remaining)
    remaining = _HASH_SOURCE_REF_RE.sub("", remaining)
    return not re.sub(r'[\s.,，。;；:：、]+', '', remaining)


def _split_sentence_fragments(paragraph: str, paragraph_index: int) -> list[dict]:
    fragments: list[dict] = []
    start = -1
    sentence_index = 0

    def push(end: int) -> None:
        nonlocal start, sentence_index
        if start < 0:
            return
        text = re.sub(r'\s+', ' ', paragraph[start:end]).strip()
        if text:
            if fragments and _is_standalone_source_ref_marker(text):
                fragments[-1]["text"] = f"{fragments[-1]['text']} {text}".strip()
                fragments[-1]["end"] = end
                start = -1
                return
            fragments.append({
                "text": text,
                "paragraph_index": paragraph_index,
                "sentence_index": sentence_index,
                "start": start,
                "end": end,
            })
            sentence_index += 1
        start = -1

    for idx, char in enumerate(paragraph):
        if start < 0 and not char.isspace():
            start = idx
        if start < 0:
            continue

        next_char = paragraph[idx + 1] if idx + 1 < len(paragraph) else ""
        is_cjk_terminator = char in "。！？!?；;"
        is_english_period = char == "." and (not next_char or next_char.isspace())
        is_line_break = char == "\n"
        if is_cjk_terminator or is_english_period or is_line_break:
            push(idx + 1)

    push(len(paragraph))
    return fragments


def _sentence_context(sentences: list[dict], target_index: int, before_count: int = 2, after_count: int = 2) -> tuple[str, str]:
    context_before = "\n".join(
        s["text"] for s in sentences[max(0, target_index - before_count):target_index]
    ).strip()
    context_after = "\n".join(
        s["text"] for s in sentences[target_index + 1:target_index + 1 + after_count]
    ).strip()
    return context_before, context_after


def _normalize_search_text(text: str) -> str:
    text = re.sub(
        r'\^?(?:<sup>)?[\[［【](?:R\d+-C\d+|Q?\d+|\d+\s*[-–—]\s*\d+)(?:\s*[、,，]\s*(?:R\d+-C\d+|Q?\d+|\d+\s*[-–—]\s*\d+))*[\]］】](?:</sup>)?',
        ' ',
        text or "",
        flags=re.IGNORECASE,
    )
    text = re.sub(r'[^\w\u4e00-\u9fff]+', ' ', text, flags=re.UNICODE)
    return re.sub(r'\s+', ' ', text).strip().lower()


def _search_tokens(text: str) -> set[str]:
    normalized = _normalize_search_text(text)
    tokens = {token for token in normalized.split() if len(token) >= 2}
    compact = re.sub(r'\s+', '', normalized)
    for idx in range(max(0, len(compact) - 1)):
        tokens.add(compact[idx:idx + 2])
    return tokens


def _overlap_score(query: str, candidate: str) -> float:
    query_tokens = _search_tokens(query)
    if not query_tokens:
        return 0.0
    candidate_tokens = _search_tokens(candidate)
    if not candidate_tokens:
        return 0.0
    score = 0.0
    for token in query_tokens:
        if token in candidate_tokens:
            score += 2.0 if len(token) > 2 else 1.0
    return score / max(1.0, len(candidate_tokens) ** 0.5)


def _split_long_unit(text: str, max_chars: int = 1200) -> list[str]:
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []
    pieces: list[str] = []
    current = ""
    for sentence in re.split(r'(?<=[。！？!?；;])\s*', text):
        sentence = sentence.strip()
        if not sentence:
            continue
        if current and len(current) + len(sentence) > max_chars:
            pieces.append(current)
            current = sentence
        else:
            current = f"{current}{sentence}" if current else sentence
    if current:
        pieces.append(current)
    if pieces:
        return pieces
    return [text[idx:idx + max_chars].strip() for idx in range(0, len(text), max_chars) if text[idx:idx + max_chars].strip()]


def _split_reference_units(text: str) -> list[str]:
    units = [p.strip() for p in re.split(r'\n{2,}', text or "") if p.strip()]
    if len(units) <= 1 and "\n" in (text or ""):
        units = [p.strip() for p in (text or "").splitlines() if p.strip()]
    expanded: list[str] = []
    for unit in units:
        expanded.extend(_split_long_unit(unit))
    return expanded


def _looks_like_title(text: str) -> bool:
    compact = re.sub(r'\s+', '', text.strip())
    if not compact or len(compact) > 60:
        return False
    if re.fullmatch(r'\d+', compact):
        return False
    if re.match(r'^(#{1,6}|第[一二三四五六七八九十\d]+[章节部分篇]|[一二三四五六七八九十]+[、.]|\d+(?:\.\d+){0,3}\s*)', compact):
        return True
    if compact.endswith(("指南", "共识", "推荐", "诊断", "治疗", "随访", "评估")) and len(compact) <= 30:
        return True
    return False


def _build_reference_chunks(ref_inputs: list[ReferenceInput], target_chars: int = 900) -> list[ReferenceChunk]:
    chunks: list[ReferenceChunk] = []
    for ref in ref_inputs:
        units = _split_reference_units(ref.text)
        title_stack: list[str] = []
        buffer: list[str] = []
        buffer_start = 0
        buffer_title = ""

        def flush(next_unit: str = "") -> None:
            nonlocal buffer, buffer_start, buffer_title
            body = "\n".join(buffer).strip()
            if not body:
                buffer = []
                return
            chunk_number = sum(1 for chunk in chunks if chunk.source_id == ref.id) + 1
            chunk_id = f"R{ref.id}-C{chunk_number:03d}"
            source_ref_ids = _extract_source_ref_ids(body)
            citation_key = f"{ref.id}-{source_ref_ids[-1]}" if source_ref_ids else str(ref.id)
            previous_text = chunks[-1].text if chunks and chunks[-1].source_id == ref.id else ""
            chunks.append(ReferenceChunk(
                chunk_id=chunk_id,
                citation_key=citation_key,
                source_id=ref.id,
                source_filename=ref.filename,
                text=body,
                title_path=buffer_title,
                context_before=previous_text[-600:].strip(),
                context_after=next_unit[:600].strip(),
                paragraph_index=buffer_start,
                source_ref_ids=source_ref_ids,
            ))
            buffer = []

        for idx, unit in enumerate(units):
            if _looks_like_title(unit):
                if buffer:
                    flush(unit)
                cleaned_title = re.sub(r'^#+\s*', '', unit).strip()
                title_stack = [*title_stack[-2:], cleaned_title]
                continue

            if not buffer:
                buffer_start = idx
                buffer_title = " / ".join(title_stack)
            current_len = len("\n".join(buffer))
            if buffer and current_len + len(unit) > target_chars:
                flush(unit)
                buffer_start = idx
                buffer_title = " / ".join(title_stack)
            buffer.append(unit)

        flush()
    return chunks


def _chunk_priority_multiplier(filename: str) -> float:
    multiplier = 1.0
    if re.search(r'指南|共识|guideline|consensus|nccn|csco', filename, flags=re.IGNORECASE):
        multiplier += 0.2
    years = [int(year) for year in re.findall(r'20\d{2}', filename)]
    if years:
        multiplier += min(0.2, max(0, max(years) - 2020) * 0.025)
    return multiplier


def _select_reference_chunks(
    ref_inputs: list[ReferenceInput],
    query: str,
    max_total_chars: int = 60000,
    max_chunks: int = 80,
    priority_source_ids: Optional[set[int]] = None,
    priority_chunks_per_source: int = 20,
) -> list[ReferenceChunk]:
    chunks = _build_reference_chunks(ref_inputs)
    if not chunks:
        return []
    priority_source_ids = priority_source_ids or set()

    scored: list[ReferenceChunk] = []
    for chunk in chunks:
        searchable = f"{chunk.title_path}\n{chunk.text}"
        chunk.score = _overlap_score(query, searchable) * _chunk_priority_multiplier(chunk.source_filename)
        if chunk.score > 0:
            scored.append(chunk)

    if not scored:
        scored = chunks[:max_chunks]
    else:
        scored.sort(key=lambda chunk: chunk.score, reverse=True)

    selected: list[ReferenceChunk] = []
    selected_keys: set[tuple[int, str]] = set()
    total = 0

    def add_chunk(chunk: ReferenceChunk, *, force: bool = False) -> bool:
        nonlocal total
        key = (chunk.source_id, chunk.chunk_id)
        if key in selected_keys or len(selected) >= max_chunks:
            return False
        if not force and total + len(chunk.text) > max_total_chars and selected:
            return False
        selected.append(chunk)
        selected_keys.add(key)
        total += len(chunk.text)
        return True

    if priority_source_ids:
        per_source_limit = max(
            1,
            min(priority_chunks_per_source, max_chunks // max(1, len(priority_source_ids))),
        )
        for source_id in sorted(priority_source_ids):
            priority_chunks = [chunk for chunk in chunks if chunk.source_id == source_id]
            priority_chunks.sort(key=lambda chunk: (-chunk.score, chunk.paragraph_index, chunk.chunk_id))
            added = 0
            for chunk in priority_chunks:
                if added >= per_source_limit:
                    break
                if add_chunk(chunk, force=True):
                    added += 1

    for chunk in scored:
        if len(selected) >= max_chunks:
            break
        if (chunk.source_id, chunk.chunk_id) in selected_keys:
            continue
        if total + len(chunk.text) > max_total_chars and selected:
            break
        add_chunk(chunk)

    return sorted(selected, key=lambda chunk: (chunk.source_id, chunk.paragraph_index, chunk.chunk_id))


def _sentence_evidence_blocks_for_chunk(chunk: ReferenceChunk) -> list[str]:
    sentences = _split_sentence_fragments(chunk.text, chunk.paragraph_index)
    if not sentences:
        sentences = [{
            "text": chunk.text,
            "paragraph_index": chunk.paragraph_index,
            "sentence_index": 0,
            "start": 0,
            "end": len(chunk.text),
        }]

    blocks: list[str] = []
    chunk_has_source_refs = bool(chunk.source_ref_ids)
    for idx, sentence in enumerate(sentences, 1):
        source_ref_ids = _extract_source_ref_ids(sentence["text"])
        if not source_ref_ids and chunk_has_source_refs:
            if chunk.confirmed:
                source_ref_ids = chunk.source_ref_ids
            else:
                blocks.append(
                    f"上下文{idx}｜无源内参考文献号，不能单独作为引用依据\n原文句子：{sentence['text']}"
                )
                continue
        citation_keys = (
            [f"{chunk.source_id}-{source_ref_id}" for source_ref_id in source_ref_ids]
            if source_ref_ids
            else [str(chunk.source_id)]
        )
        source_refs = f"\n源内参考文献号：{', '.join(source_ref_ids)}" if source_ref_ids else ""
        available = "、".join(f"[{key}]" for key in citation_keys)
        blocks.append(
            f"证据{idx}｜引用标记：[{ '、'.join(citation_keys) }]｜可用引用标记：{available}{source_refs}\n原文句子：{sentence['text']}"
        )
    return blocks


def _format_reference_chunks(chunks: list[ReferenceChunk], priority_source_ids: Optional[set[int]] = None) -> str:
    if not chunks:
        return "（无参考文献）"
    priority_source_ids = priority_source_ids or set()
    blocks = []
    for chunk in chunks:
        marker = "（重点指南）" if chunk.source_id in priority_source_ids else ""
        title = f"\n标题路径：{chunk.title_path}" if chunk.title_path else ""
        evidence = "\n".join(_sentence_evidence_blocks_for_chunk(chunk))
        blocks.append(
            f"参考数据源 {chunk.source_id}：{chunk.source_filename}{marker}{title}\n{evidence}"
        )
    return "\n\n---\n\n".join(blocks)


def _partition_reference_chunks_by_priority(
    chunks: list[ReferenceChunk],
    priority_source_ids: set[int],
) -> tuple[list[ReferenceChunk], list[ReferenceChunk]]:
    priority_chunks = [chunk for chunk in chunks if chunk.source_id in priority_source_ids]
    supplementary_chunks = [chunk for chunk in chunks if chunk.source_id not in priority_source_ids]
    return priority_chunks, supplementary_chunks


def _ai_integration_reference_mode(req: AiIntegrationRequest) -> str:
    mode = (req.reference_mode or "").strip().lower()
    if mode in {"full", "confirmed_chunks", "auto"}:
        return mode
    return "confirmed_chunks" if req.confirmed_reference_chunks else "full"


def _chunk_sentence_evidence(chunk: ReferenceChunk) -> tuple[str, str, str, int]:
    sentences = _split_sentence_fragments(chunk.text, chunk.paragraph_index)
    if not sentences:
        return chunk.text, chunk.context_before, chunk.context_after, chunk.paragraph_index

    marker_matches = _iter_source_ref_matches(chunk.text)
    target_ref_id = chunk.source_ref_ids[-1] if chunk.source_ref_ids else ""
    target_start = -1
    for marker_start, source_ref_ids in marker_matches:
        if target_ref_id and target_ref_id in source_ref_ids:
            target_start = marker_start
            break
    if target_start < 0 and marker_matches:
        target_start = marker_matches[0][0]

    target_index = 0
    if target_start >= 0:
        for idx, sentence in enumerate(sentences):
            if sentence["start"] <= target_start < sentence["end"]:
                target_index = idx
                break

    context_before, context_after = _sentence_context(sentences, target_index)
    if not context_before and chunk.context_before:
        context_before = chunk.context_before
    if not context_after and chunk.context_after:
        context_after = chunk.context_after
    return (
        sentences[target_index]["text"],
        context_before,
        context_after,
        sentences[target_index]["paragraph_index"],
    )


def _sentence_evidences_for_chunk(chunk: ReferenceChunk) -> list[tuple[str, str, str, int, list[str]]]:
    sentences = _split_sentence_fragments(chunk.text, chunk.paragraph_index)
    if not sentences:
        return [(chunk.text, chunk.context_before, chunk.context_after, chunk.paragraph_index, chunk.source_ref_ids)]

    evidences: list[tuple[str, str, str, int, list[str]]] = []
    for idx, sentence in enumerate(sentences):
        source_ref_ids = _extract_source_ref_ids(sentence["text"])
        if not source_ref_ids:
            continue
        context_before, context_after = _sentence_context(sentences, idx)
        if not context_before and chunk.context_before:
            context_before = chunk.context_before
        if not context_after and chunk.context_after:
            context_after = chunk.context_after
        evidences.append((
            sentence["text"],
            context_before,
            context_after,
            sentence["paragraph_index"],
            source_ref_ids,
        ))

    if evidences:
        return evidences

    quote, context_before, context_after, paragraph_index = _chunk_sentence_evidence(chunk)
    return [(quote, context_before, context_after, paragraph_index, [])]


def _anchors_from_reference_chunks(chunks: list[ReferenceChunk]) -> list[ReferenceAnchor]:
    anchors: list[ReferenceAnchor] = []
    for chunk in chunks:
        evidences = _sentence_evidences_for_chunk(chunk)
        for quote, context_before, context_after, paragraph_index, source_ref_ids in evidences:
            citation_keys = (
                [f"{chunk.source_id}-{source_ref_id}" for source_ref_id in source_ref_ids]
                if source_ref_ids
                else [str(chunk.source_id)]
            )
            for citation_key in citation_keys:
                source_ref_id = citation_key.split("-", 1)[1] if "-" in citation_key else ""
                anchors.append(ReferenceAnchor(
                    citation_key=citation_key,
                    source_id=chunk.source_id,
                    source_filename=chunk.source_filename,
                    source_ref_id=source_ref_id,
                    chunk_id=chunk.chunk_id,
                    title_path=chunk.title_path,
                    quote=quote,
                    context_before=context_before,
                    context_after=context_after,
                    paragraph_index=paragraph_index,
                ))
        if chunk.citation_key != chunk.chunk_id:
            quote, context_before, context_after, paragraph_index = _chunk_sentence_evidence(chunk)
            anchors.append(ReferenceAnchor(
                citation_key=chunk.chunk_id,
                source_id=chunk.source_id,
                source_filename=chunk.source_filename,
                source_ref_id=",".join(chunk.source_ref_ids),
                chunk_id=chunk.chunk_id,
                title_path=chunk.title_path,
                quote=quote,
                context_before=context_before,
                context_after=context_after,
                paragraph_index=paragraph_index,
            ))
    return anchors


def _rewrite_internal_chunk_citations(text: str, chunks: list[ReferenceChunk]) -> str:
    chunk_to_citation = {
        chunk.chunk_id.upper(): _display_citation_key_for_chunk(chunk)
        for chunk in chunks
        if chunk.citation_key and chunk.chunk_id
    }
    if not text or not chunk_to_citation:
        return text

    def replace_token(match: re.Match) -> str:
        token = re.sub(r'\s+', '', match.group(0)).replace("–", "-").replace("—", "-").upper()
        if token in chunk_to_citation:
            return chunk_to_citation[token]
        fallback = re.match(r'R(\d+)-C\d+', token, flags=re.IGNORECASE)
        return fallback.group(1) if fallback else match.group(0)

    return re.sub(r'R\d+\s*[-–—]\s*C\d+', replace_token, text, flags=re.IGNORECASE)


def _rewrite_internal_chunk_citation_list(items: list, chunks: list[ReferenceChunk]) -> list:
    return [
        _rewrite_internal_chunk_citations(str(item), chunks)
        for item in (items or [])
    ]


def _source_ref_sort_key(citation_key: str) -> tuple[int, str]:
    ref_id = citation_key.split("-", 1)[1] if "-" in citation_key else citation_key
    return (int(ref_id), "") if ref_id.isdigit() else (10**9, ref_id)


def _answer_sentence_around_citation(text: str, citation_start: int) -> str:
    sentences = _split_sentence_fragments(text, 0)
    for sentence in sentences:
        if sentence["start"] <= citation_start < sentence["end"]:
            return sentence["text"]
    return text


def _best_source_ref_keys_for_answer_sentence(
    sentence: str,
    source_id: int,
    reference_anchors: list[ReferenceAnchor],
) -> list[str]:
    grouped: dict[str, list[ReferenceAnchor]] = defaultdict(list)
    for anchor in reference_anchors:
        if (
            anchor.source_id == source_id
            and anchor.source_ref_id
            and anchor.citation_key.startswith(f"{source_id}-")
        ):
            grouped[anchor.quote].append(anchor)
    if not grouped:
        return []

    best_score = 0.0
    best_anchors: list[ReferenceAnchor] = []
    for quote, anchors in grouped.items():
        score = _overlap_score(sentence, quote)
        if score > best_score:
            best_score = score
            best_anchors = anchors

    if best_score < 0.15:
        return []

    keys = list(dict.fromkeys(anchor.citation_key for anchor in best_anchors))
    return sorted(keys, key=_source_ref_sort_key)


def _rewrite_source_only_citations_to_source_refs(
    text: str,
    reference_anchors: list[ReferenceAnchor],
) -> str:
    source_ids_with_ref_anchors = {
        anchor.source_id for anchor in reference_anchors if anchor.source_ref_id
    }
    if not text or not source_ids_with_ref_anchors:
        return text

    citation_group_re = re.compile(
        r'\[([0-9]+(?:\s*[、,，]\s*[0-9]+)*)\]'
    )

    def repl(match: re.Match) -> str:
        sentence = _answer_sentence_around_citation(text, match.start())
        raw_tokens = re.split(r'\s*[、,，]\s*', match.group(1))
        rewritten: list[str] = []
        changed = False
        for raw_token in raw_tokens:
            token = raw_token.strip()
            if token.isdigit() and int(token) in source_ids_with_ref_anchors:
                source_ref_keys = _best_source_ref_keys_for_answer_sentence(
                    sentence,
                    int(token),
                    reference_anchors,
                )
                if source_ref_keys:
                    rewritten.extend(source_ref_keys)
                    changed = True
                    continue
            rewritten.append(token)
        return f"[{'、'.join(rewritten)}]" if changed else match.group(0)

    return citation_group_re.sub(repl, text)


def _expand_source_ref_ids(raw: str) -> list[str]:
    ref_ids: list[str] = []
    normalized = (raw or "").translate(_SOURCE_REF_DIGIT_TRANSLATION)
    parts = re.split(r'[,，、;；]\s*', normalized)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        range_match = re.fullmatch(r'(\d+)\s*[-–—]\s*(\d+)', part)
        if range_match:
            start, end = int(range_match.group(1)), int(range_match.group(2))
            if start <= end and end - start <= 50:
                ref_ids.extend(str(i) for i in range(start, end + 1))
            continue
        if part.isdigit():
            ref_ids.append(str(int(part)))

    deduped = []
    seen = set()
    for ref_id in ref_ids:
        if ref_id not in seen:
            deduped.append(ref_id)
            seen.add(ref_id)
    return deduped


def _looks_like_unicode_sup_source_ref_context(text: str, start: int, end: int) -> bool:
    before = (text or "")[:start].rstrip()
    after = (text or "")[end:].lstrip()
    if not before:
        return False

    prev_char = before[-1]
    next_char = after[:1]
    normalized = (text or "")[start:end].translate(_SOURCE_REF_DIGIT_TRANSLATION)
    digits = re.sub(r"\D+", "", normalized)
    if re.match(r"[\d×*/+\-=^]", prev_char):
        return False
    if next_char and re.match(r"[\d/]", next_char):
        return False
    if len(digits) >= 2 and re.match(r"[A-Za-z\u4e00-\u9fff]", prev_char):
        return True

    return bool(re.match(r"[.,;:，。；、)\]）】]", prev_char))


def _citation_keys_for_chunk(chunk: ReferenceChunk) -> list[str]:
    if chunk.source_ref_ids:
        return [f"{chunk.source_id}-{source_ref_id}" for source_ref_id in chunk.source_ref_ids]
    return [chunk.citation_key]


def _display_citation_key_for_chunk(chunk: ReferenceChunk) -> str:
    return "、".join(_citation_keys_for_chunk(chunk))


def _iter_source_ref_matches(text: str) -> list[tuple[int, list[str]]]:
    matches: list[tuple[int, list[str]]] = []
    for pattern in (_INLINE_SOURCE_REF_RE, _SUP_SOURCE_REF_RE):
        for match in pattern.finditer(text or ""):
            ref_ids = _expand_source_ref_ids(match.group(1))
            if ref_ids:
                matches.append((match.start(), ref_ids))
    for match in _UNICODE_SUP_SOURCE_REF_RE.finditer(text or ""):
        if not _looks_like_unicode_sup_source_ref_context(text or "", match.start(), match.end()):
            continue
        ref_ids = _expand_source_ref_ids(match.group(0))
        if ref_ids:
            matches.append((match.start(), ref_ids))
    for match in _HASH_SOURCE_REF_RE.finditer(text or ""):
        matches.append((match.start(), [str(int(match.group(1)))]))
    return sorted(matches, key=lambda item: item[0])


def _extract_source_ref_ids(text: str) -> list[str]:
    ref_ids: list[str] = []
    for _, ids in _iter_source_ref_matches(text):
        ref_ids.extend(ids)
    return list(dict.fromkeys(ref_ids))


def _expand_original_content_ref_ids(raw: str) -> list[str]:
    ref_ids: list[str] = []
    for part in re.split(r'[,，、;；]\s*', raw or ""):
        trimmed = part.strip()
        if not trimmed:
            continue
        source_zero = re.fullmatch(r'0\s*[-–—]\s*(\d+)', trimmed)
        if source_zero:
            ref_ids.append(str(int(source_zero.group(1))))
            continue
        ref_ids.extend(_expand_source_ref_ids(trimmed))
    return list(dict.fromkeys(ref_id for ref_id in ref_ids if ref_id != "0"))


def _iter_original_content_ref_matches(text: str) -> list[tuple[int, list[str]]]:
    matches: list[tuple[int, list[str]]] = []
    for pattern in (_INLINE_SOURCE_REF_RE, _SUP_SOURCE_REF_RE):
        for match in pattern.finditer(text or ""):
            ref_ids = _expand_original_content_ref_ids(match.group(1))
            if ref_ids:
                matches.append((match.start(), ref_ids))
    for match in _HASH_SOURCE_REF_RE.finditer(text or ""):
        matches.append((match.start(), [str(int(match.group(1)))]))
    return sorted(matches, key=lambda item: item[0])


def _extract_reference_anchors(ref_inputs: list[ReferenceInput]) -> list[ReferenceAnchor]:
    anchors: list[ReferenceAnchor] = []
    seen = set()
    for ref in ref_inputs:
        paragraphs = _split_reference_paragraphs(ref.text)
        sentence_groups = [
            _split_sentence_fragments(paragraph, idx)
            for idx, paragraph in enumerate(paragraphs)
        ]
        all_sentences = [sentence for group in sentence_groups for sentence in group]
        for idx, paragraph in enumerate(paragraphs):
            for marker_start, source_ref_ids in _iter_source_ref_matches(paragraph):
                paragraph_sentences = sentence_groups[idx] if idx < len(sentence_groups) else []
                local_sentence = next(
                    (
                        sentence for sentence in paragraph_sentences
                        if sentence["start"] <= marker_start < sentence["end"]
                    ),
                    paragraph_sentences[0] if paragraph_sentences else None,
                )
                sentence_index = all_sentences.index(local_sentence) if local_sentence in all_sentences else -1
                if sentence_index >= 0:
                    context_before, context_after = _sentence_context(all_sentences, sentence_index)
                else:
                    context_before, context_after = "", ""
                compact_quote = local_sentence["text"] if local_sentence else re.sub(r'\s+', ' ', paragraph).strip()
                for source_ref_id in source_ref_ids:
                    citation_key = f"{ref.id}-{source_ref_id}"
                    if citation_key in seen:
                        continue
                    seen.add(citation_key)
                    anchors.append(ReferenceAnchor(
                        citation_key=citation_key,
                        source_id=ref.id,
                        source_filename=ref.filename,
                        source_ref_id=source_ref_id,
                        quote=compact_quote,
                        context_before=context_before,
                        context_after=context_after,
                        paragraph_index=idx,
                    ))
    return anchors


def _extract_original_content_anchors(original_content: str) -> list[ReferenceAnchor]:
    anchors: list[ReferenceAnchor] = []
    seen = set()
    paragraphs = _split_reference_paragraphs(original_content)
    sentence_groups = [
        _split_sentence_fragments(paragraph, idx)
        for idx, paragraph in enumerate(paragraphs)
    ]
    all_sentences = [sentence for group in sentence_groups for sentence in group]
    for idx, paragraph in enumerate(paragraphs):
        for marker_start, source_ref_ids in _iter_original_content_ref_matches(paragraph):
            paragraph_sentences = sentence_groups[idx] if idx < len(sentence_groups) else []
            local_sentence = next(
                (
                    sentence for sentence in paragraph_sentences
                    if sentence["start"] <= marker_start < sentence["end"]
                ),
                paragraph_sentences[0] if paragraph_sentences else None,
            )
            sentence_index = all_sentences.index(local_sentence) if local_sentence in all_sentences else -1
            if sentence_index >= 0:
                context_before, context_after = _sentence_context(all_sentences, sentence_index)
            else:
                context_before, context_after = "", ""
            compact_quote = local_sentence["text"] if local_sentence else re.sub(r'\s+', ' ', paragraph).strip()
            for source_ref_id in source_ref_ids:
                citation_key = f"0-{source_ref_id}"
                if citation_key in seen:
                    continue
                seen.add(citation_key)
                anchors.append(ReferenceAnchor(
                    citation_key=citation_key,
                    source_id=0,
                    source_filename="原词条内容",
                    source_ref_id=source_ref_id,
                    quote=compact_quote,
                    context_before=context_before,
                    context_after=context_after,
                    paragraph_index=idx,
                ))
    return anchors


def _format_original_content_evidence(anchors: list[ReferenceAnchor]) -> str:
    if not anchors:
        return "（原词条未识别到可转换为[0-X]的参考文献序号）"
    blocks = []
    for idx, anchor in enumerate(anchors, 1):
        blocks.append(
            f"原词条证据{idx}｜引用标记：[{anchor.citation_key}]\n"
            f"原文句子：{anchor.quote}"
        )
    return "\n\n".join(blocks)


def _rewrite_original_content_citations(
    text: str,
    original_anchors: list[ReferenceAnchor],
    reference_source_ids: set[int],
    reference_citation_keys: set[str],
) -> str:
    original_ref_ids = {anchor.source_ref_id for anchor in original_anchors}
    if not text or not original_ref_ids:
        return text

    citation_group_re = re.compile(
        rf'\^?(?:<sup>)?[\[［【]((?:Q?\d+|\d+\s*[-–—]\s*\d+)(?:\s*[、,，]\s*(?:Q?\d+|\d+\s*[-–—]\s*\d+))*)[\]］】](?:</sup>)?',
        flags=re.IGNORECASE,
    )

    def repl(match: re.Match) -> str:
        raw_tokens = re.split(r'\s*[、,，]\s*', match.group(1))
        rewritten = []
        changed = False
        for raw_token in raw_tokens:
            token = raw_token.strip().replace("–", "-").replace("—", "-")
            source_zero = re.fullmatch(r'0\s*-\s*(\d+)', token)
            if source_zero:
                numeric = str(int(source_zero.group(1)))
                if numeric in original_ref_ids:
                    rewritten.append(f"0-{numeric}")
                    changed = changed or token != f"0-{numeric}"
                    continue
            if re.fullmatch(r'\d+', token):
                numeric = str(int(token))
                if numeric in original_ref_ids and int(numeric) not in reference_source_ids:
                    rewritten.append(f"0-{numeric}")
                    changed = True
                    continue
            range_match = re.fullmatch(r'(\d+)\s*-\s*(\d+)', token)
            if range_match and token not in reference_citation_keys:
                expanded = _expand_source_ref_ids(token)
                if expanded and all(ref_id in original_ref_ids for ref_id in expanded):
                    rewritten.extend(f"0-{ref_id}" for ref_id in expanded)
                    changed = True
                    continue
            rewritten.append(token)
        return f"[{'、'.join(rewritten)}]" if changed else match.group(0)

    return citation_group_re.sub(repl, text)


def _rewrite_ai_integration_citations(
    text: str,
    reference_chunks: list[ReferenceChunk],
    original_anchors: list[ReferenceAnchor],
    reference_anchors: list[ReferenceAnchor],
    reference_source_ids: set[int],
) -> str:
    rewritten = _rewrite_internal_chunk_citations((text or "").strip(), reference_chunks)
    rewritten = _rewrite_original_content_citations(
        rewritten,
        original_anchors,
        reference_source_ids,
        {
            anchor.citation_key
            for anchor in reference_anchors
            if anchor.source_id != 0
        },
    )
    return _rewrite_source_only_citations_to_source_refs(
        rewritten,
        [anchor for anchor in reference_anchors if anchor.source_id != 0],
    )


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
            blocks.append(f"### 参考数据源 {ref.id}：{ref.filename}\n{ref.text[:2000]}")
        return "\n\n---\n\n".join(blocks)

    # 按文献编号分组输出
    by_ref = defaultdict(list)
    for ref_id, chunk in selected:
        by_ref[ref_id].append(chunk)

    ref_map = {r.id: r.filename for r in ref_inputs}
    blocks = []
    for ref_id in sorted(by_ref.keys()):
        header = f"### 参考数据源 {ref_id}：{ref_map[ref_id]}"
        body = "\n\n".join(by_ref[ref_id])
        blocks.append(f"{header}\n{body}")
    return "\n\n---\n\n".join(blocks)


async def generate_ai_integration_answer(
    req: AiIntegrationRequest,
    text_generator=generate_text,
) -> AiIntegrationResponse:
    original_content = req.original_content.strip() or "（未选择原词条内容）"
    original_anchors = _extract_original_content_anchors(req.original_content)
    original_evidence_text = (
        _format_original_content_evidence(original_anchors)
        if req.original_content.strip()
        else "（未选择原词条内容）"
    )
    priority_ids = set(req.priority_reference_ids or [])
    reference_mode = _ai_integration_reference_mode(req)
    if reference_mode == "confirmed_chunks":
        reference_chunks = _reference_chunks_from_confirmed(req.confirmed_reference_chunks)
    elif reference_mode == "auto":
        reference_chunks = _select_reference_chunks(
            req.reference_inputs,
            f"{req.disease} {req.user_request} {req.original_content[:2000]}",
            max_total_chars=160000,
            max_chunks=200,
            priority_source_ids=priority_ids,
        )
    else:
        reference_chunks = _build_reference_chunks(req.reference_inputs)
    priority_chunks, supplementary_chunks = _partition_reference_chunks_by_priority(
        reference_chunks,
        priority_ids,
    )
    primary_reference_text = (
        "（未设置重点指南）"
        if not priority_ids
        else _format_reference_chunks(priority_chunks, priority_ids)
    )
    supplementary_reference_text = (
        "（未选择普通参考资料）"
        if not supplementary_chunks
        else _format_reference_chunks(supplementary_chunks, priority_ids)
    )
    reference_anchors = [
        *original_anchors,
        *(_extract_reference_anchors(req.reference_inputs) if reference_mode == "full" else []),
        *_anchors_from_reference_chunks(reference_chunks),
    ]
    references_used = [f"[{ref.id}] {ref.filename}" for ref in req.reference_inputs]
    disease_label = req.disease.strip() or "当前词条"

    prompt = f"""请围绕【{disease_label}】回答用户的问题或完成用户要求。

## 用户问题或要求
{req.user_request.strip()}

## 原词条内容
{original_content}

## 原词条可引用证据（引用时使用[0-原文献号]）
{original_evidence_text}

## 重点指南主证据区
{primary_reference_text}

## 普通参考资料补充区
{supplementary_reference_text}

## 回答要求
- 若“重点指南主证据区”中有相关证据，必须优先以重点指南为准，并采用重点指南作为主体依据。
- 若普通参考资料与重点指南不一致，必须说明冲突，并采用重点指南结论，除非用户明确要求比较不同资料。
- 不要因为普通参考资料数量更多就覆盖重点指南；普通参考资料补充区只能补充重点指南未覆盖的内容。
- 只使用上方提供的原词条内容和参考文献，不要引入未提供的数据或指南。
- 如证据不足，明确说明“现有材料不足以判断”，并说明还需要哪类资料。
- 引用原词条内容时必须使用[0-原文献号]，例如原词条句子原本标注[18]，回答中应写作[0-18]；只有原词条可引用证据列出的编号才能这样使用。
- 涉及事实性结论时必须标注来源。引用参考资料时必须使用每条证据列出的“引用标记”，例如[3-22]；如果证据没有源内文献号，引用标记会是[1]、[2]这类参考数据源号。不要使用其他未列出的标记。
- 不要沿用原词条或参考资料中的原有条目序号，例如“4.”、“（3）”、“2、”。除非用户明确要求编号列表，列举要点时统一使用 Markdown 无序列表“-”；如必须编号，应从 1 开始连续编号，且同一级编号样式保持一致。
- 必须包含“## 修订后正文”区块，区块内只放可直接粘贴到词条中的清洁修订正文。
- 修订后正文应是可直接粘贴到词条中的清洁文本，不要混入修改说明、证据不足提示、待确认事项。
- 必须包含“## 重点指南使用情况”区块；若重点指南覆盖了本次任务，列出采用的参考数据源和引用标记；若未覆盖，明确写“重点指南未覆盖”并说明使用了哪些普通资料补充。
- 必须包含“## 修改说明”区块，用 Markdown 无序列表简要说明本次修改了哪些内容。
- 直接回答用户问题，使用 Markdown，语言专业、清晰、便于医学编辑继续使用。"""

    answer = await text_generator(
        prompt,
        SYSTEM_PROMPT,
        context="ai_integration",
    )

    parsed_answer, revision_text, change_summary = _parse_ai_integration_output(answer)
    reference_source_ids = {ref.id for ref in req.reference_inputs}

    rewritten_answer = _rewrite_ai_integration_citations(
        parsed_answer,
        reference_chunks,
        original_anchors,
        reference_anchors,
        reference_source_ids,
    )
    rewritten_revision_text = (
        _rewrite_ai_integration_citations(
            revision_text,
            reference_chunks,
            original_anchors,
            reference_anchors,
            reference_source_ids,
        )
        if revision_text
        else ""
    )
    references_by_id = {ref.id: ref.filename for ref in req.reference_inputs}
    priority_guideline_usage = _infer_priority_guideline_usage(
        f"{rewritten_answer}\n{rewritten_revision_text}",
        priority_ids,
        references_by_id,
    )

    return AiIntegrationResponse(
        answer=rewritten_answer,
        revision_text=rewritten_revision_text,
        change_summary=change_summary,
        references_used=references_used,
        reference_anchors=reference_anchors,
        priority_guideline_usage=priority_guideline_usage,
    )


async def generate_section_draft(req: GenerationRequest) -> GeneratedDraft:
    relevant_qa = _select_relevant_qa(req.qa_references, req.section, req.gap_description)
    qa_text = format_qa_references(relevant_qa)
    original_content = req.original_content if req.original_content else "（该章节暂无内容）"
    context_preview = req.article_context[:5000] if req.article_context else ""

    reference_chunks = _select_reference_chunks(
        req.reference_inputs,
        f"{req.section} {req.gap_description}",
    )
    ref_doc_text = _format_reference_chunks(reference_chunks)
    reference_anchors = [
        *_extract_reference_anchors(req.reference_inputs),
        *_anchors_from_reference_chunks(reference_chunks),
    ]

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
- 每个事实性陈述必须跟随引用标记。引用参考数据源时必须使用每条证据列出的“引用标记”，如[1-3]、[3-22]；同一句可写作[1-3、3-22]
- 只使用参考证据明确列出的“引用标记”；如果证据列出的引用标记是[1]、[2]这类参考数据源号，说明该证据没有源内文献号，可以直接使用该引用标记；只有Q&A可写作[Q1]、[Q2]
- 仅使用提供的参考文献和Q&A，不得引入未提供的数据
- 多来源时优先采用文件名含"指南"、年份较新的来源
- 在 generated_content 末尾添加"参考文献"小节，列出引用的文献编号和名称
- 面向临床医生，语言专业精炼
- 剂量、疗程等具体参数须准确
- 使用Markdown格式：## 小标题、- 列表项、**加粗**关键词

## 相关临床Q&A参考（引用时使用[Q编号]）
{qa_text}

## 参考数据源（引用时必须使用每条证据列出的“引用标记”）
{ref_doc_text}

## 输出要求
请以JSON格式输出（不要包含 original_content 字段，只输出以下字段）：
{{
  "generated_content": "完整的改进后章节内容（Markdown格式，结构清晰，使用小标题和列表）",
  "key_changes": ["主要改动点1", "主要改动点2", "主要改动点3"],
  "references_used": ["引用的来源编号，如[1-3][3-22][Q1]等"]
}}"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="draft_generation", text_generator=generate_text
    )

    return GeneratedDraft(
        section=req.section,
        original_content=req.original_content or "",
        generated_content=_rewrite_internal_chunk_citations(data["generated_content"], reference_chunks),
        key_changes=data.get("key_changes", []),
        references_used=_rewrite_internal_chunk_citation_list(data.get("references_used", []), reference_chunks),
        reference_anchors=reference_anchors,
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

    reference_chunks = _select_reference_chunks(
        req.reference_inputs,
        combined_keywords,
        max_total_chars=80000,
    )
    ref_doc_text = _format_reference_chunks(reference_chunks)
    reference_anchors = [
        *_extract_reference_anchors(req.reference_inputs),
        *_anchors_from_reference_chunks(reference_chunks),
    ]

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
      "references_used": ["[1-3]", "[Q1]"]
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
- 每个事实性陈述必须跟随引用标记。引用参考数据源时必须使用每条证据列出的“引用标记”，如[1-3]、[3-22]；同一句可写作[1-3、3-22]
- 只使用参考证据明确列出的“引用标记”；如果证据列出的引用标记是[1]、[2]这类参考数据源号，说明该证据没有源内文献号，可以直接使用该引用标记；只有Q&A可写作[Q1]、[Q2]
- 仅使用提供的参考文献和Q&A，不得引入未提供的数据
- 多来源时优先采用文件名含"指南"、年份较新的来源
- 每个章节的 generated_content 末尾添加"参考文献"小节
- 面向临床医生，语言专业精炼
- 剂量、疗程等具体参数须准确
- 使用Markdown格式：## 小标题、- 列表项、**加粗**关键词

## 相关临床Q&A参考（引用时使用[Q编号]）
{qa_text}

## 参考数据源（引用时必须使用每条证据列出的“引用标记”）
{ref_doc_text}

## 输出要求
请以JSON格式输出：
{{
  "drafts": [
{output_example}
  ],
  "coordination_notes": "跨章节协调说明：①各章节如何分工 ②哪些内容做了去重处理 ③术语如何统一"
}}"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="batch_draft_generation", text_generator=generate_text
    )

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
            generated_content=_rewrite_internal_chunk_citations(draft_data.get("generated_content", ""), reference_chunks),
            key_changes=draft_data.get("key_changes", []),
            references_used=_rewrite_internal_chunk_citation_list(draft_data.get("references_used", []), reference_chunks),
            reference_anchors=reference_anchors,
        ))

    return BatchGeneratedDraft(
        drafts=drafts,
        coordination_notes=data.get("coordination_notes", ""),
    )
