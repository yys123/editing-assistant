import difflib
import re
from typing import List, Optional, Tuple
from models import (
    QAItem, QualityReport, NeedsAnalysis, IterationPlan,
    IssueItem, DimOneReport, DimTwoReport, DimThreeReport, DimFourReport,
    NeedCluster, GapItem,
    ArticleSection, SectionAnalysis, SectionIssue, IssueAnchor, GuidelineEvidence, GapAnalysis, ParsedArticle,
    NeedSectionMapping, SectionNeedsGap, NeedCoverage, ConfirmedReferenceChunk,
)
from services.guideline_chunk_usage import guideline_chunk_usage_prompt
from services.text_llm import generate_json, generate_text

SYSTEM_PROMPT = "你是一位资深临床医学编辑，专注于面向临床医生的循证医学内容评估与改进。请严格按照要求的JSON格式输出，不要输出任何其他内容。"

CHUNK_SIZE = 100000       # 每块上限（字符），DeepSeek 长上下文下尽量保持章节完整
CHUNK_OVERLAP = 1000      # 相邻块重叠字符数，避免跨块问题漏报
CHUNK_THRESHOLD = 120000  # 触发分块的章节长度阈值
REFERENCE_BATCH_MAX_CHARS = 300000  # 参考资料优先全文提供；超长时按批次完整覆盖
VERIFY_REFERENCE_MAX_CHARS = 60000  # 二次核验只需证据补全上下文，避免超长JSON修复反复失败
SECTION_REFERENCE_MAX_CHARS = 60000  # 单章节审评只带入相关参考片段，避免长参考全文导致JSON截断
SECTION_PROMPT_MAX_CHARS = 120000
QUALITY_STANDARD_MAX_CHARS = 10000
CONTENT_SPEC_MAX_CHARS = 8000
SECTION_ISSUE_OUTPUT_LIMIT = 15
MERGED_ISSUE_OUTPUT_LIMIT = 25

FIGURE_TABLE_REFERENCE_RULE = """图/表固定编号引用核查规则（非常重要）：
- AI 当前只接收章节文本，图片二进制本身无法随 prompt 传递；这不代表实际词条中没有图片。
- 若章节原文中出现图题、图注、图片占位符、图片内容文字或“图 N/见图N/详见图 N”等引用，默认对应图片在实际词条中存在，不得因“未看到图片本身/只看到图注/图片无法传递给 AI”判定为图片缺失、内容无法理解或需要补充图片。
- “详见表 2”“详见表2”“详见图 3”“见图1”等固定图表编号引用，属于知识库词条内对已有图/表的正常引用，符合要求。
- 不得仅因原文保留“详见表/图 + 固定编号”而判定为“交互式关联缺失”“超链接不恰当”“应删除固定编号引用”“不符合知识库交互关联规范”等问题。
- 只有当被引用的图/表在章节原文或词条中明显不存在、编号前后矛盾，或引用内容导致医学含义错误时，才可按实际问题报告。
- 解析历史数据时，`[图注] 表 N ...` 也可能是表格标题；若其后紧跟 `|` 分隔的行、Markdown表格行或其他表格行，应视为该表已有具体表格内容，不得仅因标记为`[图注]`而报告“只有表题/未提供表格具体内容/无法识别表格信息”。"""

SUPERSCRIPT_SUBSCRIPT_RULE = """上下标格式核查规则（非常重要）：
- 上下标不是评审内容。由于复制/解析可能丢失 HTML 上标/下标格式，不得仅因 `10⁹/L` 显示为 `109/L`、下标显示为普通数字等情况，判定为“格式错误”“科学计数法错误”“单位指数错误”。
- 对表格单位、检验指标单位、化学式、基因/蛋白标记等场景，若问题仅依赖上下标显示差异，应删除该问题或不报告。
- 只有医学数值、单位含义或正文结论本身确有错误，且不是复制/解析导致的上下标显示差异时，才可按内容准确性问题报告。"""

SOURCE_BOUNDARY_RULE = """原文边界核查规则（非常重要）：
- 只审查“章节内容（含子章节）/章节原文内容”中的知识库正文，不得把内容质量审评标准、内容要求规范、参考数据源或本提示词中的词句当成知识库原文问题。
- 对 style、accuracy、outdated 问题，必须能在章节原文中逐字定位到对应片段；如果无法在章节原文中定位，应删除该问题或不报告。
- 例如“本指南”“本共识”“专家组认为”等禁用词，只有真实出现在章节原文中才可报告；如果只出现在评审标准、内容规范或参考指南中，不得报告为原文问题。"""

HEADING_NUMBERING_RULE = """标题序号层级核查规则（非常重要）：
- 标题序号常规顺序可为“一、→（一）→1、→（1）→1）→①→a.→I.”，但允许根据内容需要跳过中间层级。
- “一、”后面可以直接使用“1、”，不一定必须先出现“（一）”；不得仅因缺少“（一）”而判定标题层级混乱或结构问题。
- 只有在同一层级内部编号前后矛盾、标题与正文归属明显错位，或层级跳转导致用户无法理解内容关系时，才可报告结构问题。"""

_TABLE_CAPTION_LINE_RE = re.compile(r"^\s*(?:\[(?:表格|表格标题|图注)\]\s*)?表\s*([0-9一二三四五六七八九十百]+)(?![0-9一二三四五六七八九十百])")
_TABLE_RANGE_RE = re.compile(r"表\s*(\d+)\s*(?:[-~～至到]|—|–)\s*表?\s*(\d+)")
_TABLE_NUM_RE = re.compile(r"表\s*([0-9一二三四五六七八九十百]+)")


def _looks_like_table_row(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if "\t" in stripped:
        return len([cell for cell in stripped.split("\t") if cell.strip()]) >= 2
    if stripped.count("|") < 2:
        return False
    cells = [cell.strip() for cell in stripped.strip("|").split("|")]
    meaningful_cells = [
        cell for cell in cells
        if cell and not re.fullmatch(r":?-{2,}:?", cell)
    ]
    return len(meaningful_cells) >= 2


def _table_numbers_with_body(section_content: str) -> set[str]:
    numbers: set[str] = set()
    lines = section_content.splitlines()

    for idx, line in enumerate(lines):
        match = _TABLE_CAPTION_LINE_RE.match(line.strip())
        if not match:
            continue
        table_num = match.group(1)

        scanned = 0
        for next_line in lines[idx + 1:]:
            stripped = next_line.strip()
            if not stripped:
                continue
            if re.match(r"^\s*\[H[1-3]\]", stripped) or _TABLE_CAPTION_LINE_RE.match(stripped):
                break
            scanned += 1
            if _looks_like_table_row(stripped):
                numbers.add(table_num)
                break
            if scanned >= 12:
                break

    return numbers


def _issue_table_numbers(text: str) -> set[str]:
    numbers: set[str] = set()
    for start, end in _TABLE_RANGE_RE.findall(text):
        try:
            start_num = int(start)
            end_num = int(end)
        except ValueError:
            continue
        if start_num <= end_num and end_num - start_num <= 50:
            numbers.update(str(num) for num in range(start_num, end_num + 1))

    numbers.update(_TABLE_NUM_RE.findall(text))
    return numbers


def _claims_missing_table_body(issue: SectionIssue) -> bool:
    text = " ".join([
        issue.description or "",
        " ".join(issue.examples or []),
        " ".join(anchor.quote for anchor in issue.anchors if anchor.quote),
    ])
    if "表" not in text or "内容" not in text:
        return False
    body_missing_phrases = (
        "未提供表格的具体内容",
        "未提供表格具体内容",
        "未提供具体表格内容",
        "未提供具体内容",
        "未列出具体内容",
        "未展示具体内容",
        "无法获取表格内容",
        "无法识别表格信息",
        "只有表题",
        "仅有表题",
        "只有标题",
        "仅有标题",
        "只有图注",
        "仅有图注",
    )
    if any(phrase in text for phrase in body_missing_phrases):
        return True
    return "仅以" in text and "[图注]" in text


def _drop_false_table_body_missing_issues(
    issues: List[SectionIssue],
    section_content: str,
) -> List[SectionIssue]:
    body_table_numbers = _table_numbers_with_body(section_content)
    if not body_table_numbers:
        return issues

    filtered: List[SectionIssue] = []
    for issue in issues:
        if not _claims_missing_table_body(issue):
            filtered.append(issue)
            continue
        issue_text = " ".join([issue.description or "", " ".join(issue.examples or [])])
        mentioned_numbers = _issue_table_numbers(issue_text)
        if mentioned_numbers and mentioned_numbers.issubset(body_table_numbers):
            continue
        filtered.append(issue)
    return filtered


_ABBREVIATION_FULL_NAME_RE = re.compile(
    r"[\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9（）()、/·\-\s]{0,40}"
    r"[（(]\s*[A-Za-z][A-Za-z0-9 /,\-–—]+[，,]\s*[A-Z][A-Z0-9-]{1,15}\s*[）)]"
)


def _claims_missing_abbreviation_full_name(issue: SectionIssue) -> bool:
    if issue.issue_type != "style":
        return False
    text = " ".join([
        issue.description or "",
        " ".join(issue.examples or []),
    ])
    if "缩写" not in text:
        return False
    return (
        "全称" in text
        or "英文全称" in text
        or "中文全称" in text
        or "首次出现" in text
    )


def _drop_false_abbreviation_full_name_issues(
    issues: List[SectionIssue],
) -> List[SectionIssue]:
    filtered: List[SectionIssue] = []
    for issue in issues:
        if not _claims_missing_abbreviation_full_name(issue):
            filtered.append(issue)
            continue
        anchor_text = " ".join(anchor.quote for anchor in issue.anchors if anchor.quote)
        if anchor_text and _ABBREVIATION_FULL_NAME_RE.search(anchor_text):
            continue
        filtered.append(issue)
    return filtered


_COVERAGE_TERM_SUFFIX_RE = re.compile(
    r"[\u4e00-\u9fffA-Za-z0-9\-]{0,12}"
    r"(?:障碍|异常|减少|降低|增高|感染|敏感|退化|萎缩|纤维化|紊乱|不全|延缓|"
    r"患病率|发病率|危险因素|临床表现|诊断标准|治疗方案|禁忌证|不良反应)"
)
_COVERAGE_NUMBER_RE = re.compile(r"(?:≥|≤|>|<)?\s*\d+(?:\.\d+)?\s*%?")
_COVERAGE_STOP_TERMS = {
    "发病因素",
    "主要因素",
    "危险因素",
    "临床表现",
    "治疗方案",
    "不良反应",
}


def _compact_for_coverage(text: str) -> str:
    compact = re.sub(r"\[[^\]]+\]", "", str(text or ""))
    compact = re.sub(r"\s+", "", compact)
    compact = re.sub(r"[，,。；;：:、（）()《》“”\"'`·/\\]", "", compact)
    return compact.lower()


def _coverage_numbers(text: str) -> set[str]:
    numbers: set[str] = set()
    for match in _COVERAGE_NUMBER_RE.findall(text or ""):
        normalized = re.sub(r"\s+", "", match)
        if not normalized:
            continue
        if re.fullmatch(r"\d{4}", normalized):
            continue
        numbers.add(normalized)
    return numbers


def _coverage_terms(text: str) -> set[str]:
    terms: set[str] = set()
    clean = re.sub(r"\[[^\]]+\]", "", str(text or "")).lower()
    fragments = re.split(
        r"[\s，,。；;：:、（）()《》“”\"'`/\\]+|(?:以及|并且|和|及|与)",
        clean,
    )
    for fragment in fragments:
        compact = _compact_for_coverage(fragment)
        for match in _COVERAGE_TERM_SUFFIX_RE.findall(compact):
            term = re.sub(r"^.*(?:包括|缺少|补充|总结|提示|显示|指出|例如|如)", "", match)
            term = re.sub(r"^(?:老年人|患者|fd|的|其|该|相关)+", "", term).strip("-")
            if len(term) < 4 or term in _COVERAGE_STOP_TERMS:
                continue
            terms.add(term)
    return terms


def _has_covered_guideline_evidence(issue: SectionIssue, section_content: str) -> bool:
    evidence_text = " ".join(
        part for evidence in issue.guideline_evidence
        for part in (evidence.quote, evidence.relevance)
        if part
    )
    issue_text = " ".join([
        issue.description or "",
        " ".join(issue.examples or []),
        evidence_text,
    ])
    section_compact = _compact_for_coverage(section_content)

    evidence_numbers = _coverage_numbers(evidence_text)
    if len(evidence_numbers) >= 2:
        covered_numbers = {
            number for number in evidence_numbers
            if number in section_content or number.replace("%", "") in section_content
        }
        if len(covered_numbers) >= 2 and len(covered_numbers) / len(evidence_numbers) >= 0.5:
            return True

    terms = _coverage_terms(issue_text)
    if len(terms) < 3:
        return False
    covered_terms = {term for term in terms if term in section_compact}
    return len(covered_terms) >= 3 and len(covered_terms) / len(terms) >= 0.55


def _drop_false_covered_missing_content_issues(
    issues: List[SectionIssue],
    section_content: str,
) -> List[SectionIssue]:
    filtered: List[SectionIssue] = []
    for issue in issues:
        if (
            issue.issue_type == "missing_content"
            and issue.guideline_evidence
            and _has_covered_guideline_evidence(issue, section_content)
        ):
            continue
        filtered.append(issue)
    return filtered


_ARABIC_HEADING_CLAIM_RE = re.compile(r"[“\"「『']\s*([1-9]\d*)\s*[、.．]\s*([^”\"」』']{2,40})[”\"」』']")
_PAREN_HEADING_LINE_RE = re.compile(r"^\s*(?:#{1,6}\s*)?[（(][一二三四五六七八九十百]+[）)]\s*(.+?)\s*$")


def _issue_text(issue: SectionIssue) -> str:
    return " ".join([
        issue.description or "",
        " ".join(issue.examples or []),
        " ".join(anchor.quote for anchor in issue.anchors if anchor.quote),
    ])


def _claims_false_heading_numbering(issue: SectionIssue, section_content: str) -> bool:
    text = _issue_text(issue)
    if not ("标题" in text and ("序号" in text or "层级" in text or "编号" in text)):
        return False
    if not any(word in text for word in ("不规范", "不一致", "混乱", "混合")):
        return False

    parenthesized_titles = {
        _compact_for_coverage(match.group(1))
        for line in section_content.splitlines()
        if (match := _PAREN_HEADING_LINE_RE.match(line.strip()))
    }
    if not parenthesized_titles:
        return False

    for _number, title in _ARABIC_HEADING_CLAIM_RE.findall(text):
        compact_title = _compact_for_coverage(title)
        if compact_title and compact_title in parenthesized_titles:
            return True
    return False


def _claims_reference_marker_format_only(issue: SectionIssue) -> bool:
    text = _issue_text(issue)
    if "参考文献" not in text and "引用序号" not in text:
        return False
    if not any(word in text for word in ("格式不一致", "上标", "方括号", "普通字符", "普通方括号")):
        return False
    if any(word in text for word in ("缺失", "缺少", "无法定位", "错误引用", "引用错误", "来源不明")):
        return False
    return True


def _drop_false_numbering_and_reference_style_issues(
    issues: List[SectionIssue],
    section_content: str,
) -> List[SectionIssue]:
    filtered: List[SectionIssue] = []
    for issue in issues:
        if issue.issue_type == "style" and (
            _claims_false_heading_numbering(issue, section_content)
            or _claims_reference_marker_format_only(issue)
        ):
            continue
        filtered.append(issue)
    return filtered


def _is_functional_dyspepsia_topic(disease: str) -> bool:
    normalized = _compact_for_coverage(disease)
    return "功能性消化不良" in normalized or normalized in {"fd"}


def _claims_out_of_scope_od_diagnostic_path(issue: SectionIssue) -> bool:
    text = _issue_text(issue)
    if not any(marker in text for marker in ("器质性消化不良", "OD", "organic dyspepsia")):
        return False
    if not any(word in text for word in ("诊断流程", "诊断路径", "诊断步骤", "评估步骤", "评估与诊断")):
        return False
    if any(phrase in text for phrase in ("排除器质性", "排除OD", "排除 OD", "鉴别OD", "鉴别 OD")):
        return False
    return True


def _drop_out_of_scope_disease_issues(
    issues: List[SectionIssue],
    disease: str,
) -> List[SectionIssue]:
    if not _is_functional_dyspepsia_topic(disease):
        return issues

    filtered: List[SectionIssue] = []
    for issue in issues:
        if (
            issue.issue_type in {"missing_content", "structure"}
            and _claims_out_of_scope_od_diagnostic_path(issue)
        ):
            continue
        filtered.append(issue)
    return filtered


_ROME_V_REFERENCE_RE = re.compile(r"(?:rome\s*[vⅤ]|罗马\s*[vⅤ五])", re.IGNORECASE)


def _references_include_rome_v(reference_texts: List[str]) -> bool:
    return any(_ROME_V_REFERENCE_RE.search(text or "") for text in reference_texts)


def _claims_rome_v_unpublished(issue: SectionIssue) -> bool:
    text = _issue_text(issue)
    if not _ROME_V_REFERENCE_RE.search(text):
        return False
    return any(phrase in text for phrase in (
        "未正式发布",
        "尚未正式发布",
        "尚未发布",
        "未发布",
        "未公布",
        "尚未公布",
    ))


def _drop_false_rome_v_unpublished_issues(
    issues: List[SectionIssue],
    reference_texts: List[str],
) -> List[SectionIssue]:
    if not _references_include_rome_v(reference_texts):
        return issues

    filtered: List[SectionIssue] = []
    for issue in issues:
        if issue.issue_type in {"accuracy", "outdated"} and _claims_rome_v_unpublished(issue):
            continue
        filtered.append(issue)
    return filtered


def _parse_issue_anchors(item: dict) -> List[IssueAnchor]:
    anchors: List[IssueAnchor] = []
    for raw in item.get("anchors", []) or []:
        if isinstance(raw, str):
            quote = raw.strip()
            heading_hint = ""
        elif isinstance(raw, dict):
            quote = str(raw.get("quote", "")).strip()
            heading_hint = str(raw.get("heading_hint", "")).strip()
        else:
            continue
        if quote:
            anchors.append(IssueAnchor(quote=quote, heading_hint=heading_hint))
    return anchors


def _parse_guideline_evidence(item: dict) -> List[GuidelineEvidence]:
    evidence: List[GuidelineEvidence] = []
    for raw in item.get("guideline_evidence", []) or []:
        if not isinstance(raw, dict):
            continue
        source = str(raw.get("source", "")).strip()
        quote = str(raw.get("quote", "")).strip()
        relevance = str(raw.get("relevance", "")).strip()
        if source or quote or relevance:
            evidence.append(GuidelineEvidence(
                source=source,
                quote=quote,
                relevance=relevance,
            ))
    return evidence


_REFERENCE_ID_RE = re.compile(r"参考数据源\s*(\d+)")
_REFERENCE_FILENAME_RE = re.compile(r"文件名[：:]\s*([^\n]+)")
_REFERENCE_HEADER_RE = re.compile(
    r"^\s*#{0,6}\s*参考数据源\s*(\d+)(?:（[^）]*）)?(?:[：:]\s*([^\n]+))?",
    re.MULTILINE,
)


def _compact_reference_name(text: str) -> str:
    compact = re.sub(r"\s+", "", str(text or ""))
    compact = re.sub(r"[：:（）()【】\[\]《》“”\"'`]", "", compact)
    return compact.lower()


def _allowed_reference_sources(reference_texts: List[str]) -> dict[int, str]:
    allowed: dict[int, str] = {}
    for fallback_idx, text in enumerate(reference_texts, 1):
        clean = str(text or "").strip()
        if not clean:
            continue
        ref_id = fallback_idx
        header_filename = ""
        header_match = _REFERENCE_HEADER_RE.search(clean)
        if header_match:
            try:
                ref_id = int(header_match.group(1))
            except ValueError:
                ref_id = fallback_idx
            header_filename = (header_match.group(2) or "").strip()
        filename_match = _REFERENCE_FILENAME_RE.search(clean)
        filename = (filename_match.group(1) if filename_match else header_filename).strip()
        allowed[ref_id] = filename
    return allowed


def _guideline_evidence_matches_uploaded_source(
    evidence: GuidelineEvidence,
    allowed_sources: dict[int, str],
) -> bool:
    source = (evidence.source or "").strip()
    if not source:
        return False

    id_match = _REFERENCE_ID_RE.search(source)
    if id_match:
        try:
            ref_id = int(id_match.group(1))
        except ValueError:
            return False
        if ref_id not in allowed_sources:
            return False
        filename = allowed_sources.get(ref_id, "").strip()
        if not filename:
            return True
        source_tail = re.sub(
            r"^.*?参考数据源\s*\d+(?:（[^）]*）)?[：:]?",
            "",
            source,
        ).strip()
        if not source_tail:
            return True
        compact_filename = _compact_reference_name(filename)
        compact_tail = _compact_reference_name(source_tail)
        compact_source = _compact_reference_name(source)
        return compact_filename in compact_source or compact_tail in compact_filename

    compact_source = _compact_reference_name(source)
    return any(
        _compact_reference_name(filename) in compact_source
        for filename in allowed_sources.values()
        if filename
    )


def _sanitize_guideline_evidence_sources(
    issues: List[SectionIssue],
    reference_texts: List[str],
    priority_reference_texts: Optional[List[str]] = None,
) -> List[SectionIssue]:
    allowed_sources = _allowed_reference_sources([
        *(reference_texts or []),
        *((priority_reference_texts or [])),
    ])
    for issue in issues:
        issue.guideline_evidence = [
            evidence for evidence in issue.guideline_evidence
            if _guideline_evidence_matches_uploaded_source(evidence, allowed_sources)
        ]
    return issues


def _build_section_issue(item: dict) -> SectionIssue:
    return SectionIssue(
        issue_type=item.get("issue_type", "missing_content"),
        description=item.get("description", ""),
        severity=item.get("severity", "medium"),
        examples=item.get("examples", []),
        anchors=_parse_issue_anchors(item),
        guideline_evidence=_parse_guideline_evidence(item),
        deduction_score=float(item.get("deduction_score", 1.0)),
        is_key_content=bool(item.get("is_key_content", False)),
    )


def _clean_anchor_quote(text: str) -> str:
    quote = str(text or "").strip()
    quote = quote.strip("「」“”\"'` ")
    quote = re.sub(r"^(?:原文|原文片段|证据片段|出处|示例)\s*[：:]\s*", "", quote).strip()
    quote = quote.strip("「」“”\"'` ")
    return quote


def _compact_with_map(text: str) -> Tuple[str, List[int]]:
    chars: List[str] = []
    positions: List[int] = []
    for idx, char in enumerate(text):
        if char.isspace():
            continue
        chars.append(char)
        positions.append(idx)
    return "".join(chars), positions


def _line_range_for_span(text: str, start: int, end: int) -> Tuple[int, int]:
    line_start = text.count("\n", 0, start)
    line_end = text.count("\n", 0, max(start, end - 1))
    return line_start, line_end


def _locate_quote(text: str, quote: str) -> Optional[IssueAnchor]:
    cleaned = _clean_anchor_quote(quote)
    if len(cleaned) < 3:
        return None

    start = text.find(cleaned)
    match_mode = "exact"
    if start == -1:
        compact_text, text_positions = _compact_with_map(text)
        compact_quote, _quote_positions = _compact_with_map(cleaned)
        if len(compact_quote) < 3:
            return None
        compact_start = compact_text.find(compact_quote)
        if compact_start == -1:
            return None
        start = text_positions[compact_start]
        end = text_positions[compact_start + len(compact_quote) - 1] + 1
        match_mode = "compact"
    else:
        end = start + len(cleaned)

    line_start, line_end = _line_range_for_span(text, start, end)
    return IssueAnchor(
        quote=cleaned,
        start=start,
        end=end,
        line_start=line_start,
        line_end=line_end,
        match_mode=match_mode,
    )


def _issue_anchor_candidates(issue: SectionIssue) -> List[str]:
    candidates: List[str] = []
    candidates.extend(anchor.quote for anchor in issue.anchors if anchor.quote)
    candidates.extend(issue.examples or [])

    text_sources = [issue.description or "", *(issue.examples or [])]
    for pattern in (
        r"原文[：:]\s*([^；。\n]+)",
        r"“([^”]{3,120})”",
        r"‘([^’]{3,120})’",
        r"\"([^\"]{3,120})\"",
        r"「([^」]{3,120})」",
    ):
        for source in text_sources:
            candidates.extend(re.findall(pattern, source))

    seen = set()
    unique: List[str] = []
    for candidate in candidates:
        cleaned = _clean_anchor_quote(candidate)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            unique.append(cleaned)
    return unique


def _attach_issue_anchors(issues: List[SectionIssue], section_content: str) -> List[SectionIssue]:
    for issue in issues:
        located: List[IssueAnchor] = []
        seen_spans = set()
        for candidate in _issue_anchor_candidates(issue):
            anchor = _locate_quote(section_content, candidate)
            if not anchor:
                continue
            span = (anchor.start, anchor.end)
            if span in seen_spans:
                continue
            seen_spans.add(span)
            located.append(anchor)
            if len(located) >= 3:
                break
        issue.anchors = located
    return issues


def _drop_unlocated_required_anchor_issues(issues: List[SectionIssue]) -> List[SectionIssue]:
    required_anchor_types = {"style", "accuracy", "outdated"}
    return [
        issue for issue in issues
        if issue.issue_type not in required_anchor_types or bool(issue.anchors)
    ]


def _issue_similarity(a: SectionIssue, b: SectionIssue) -> float:
    a_text = f"{a.issue_type} {a.description} {' '.join(a.examples or [])}"
    b_text = f"{b.issue_type} {b.description} {' '.join(b.examples or [])}"
    return difflib.SequenceMatcher(None, a_text, b_text).ratio()


def _restore_missing_guideline_evidence(
    target_issues: List[SectionIssue],
    source_issues: List[SectionIssue],
) -> List[SectionIssue]:
    guide_types = {"missing_content", "accuracy", "outdated"}
    sources = [
        issue for issue in source_issues
        if issue.issue_type in guide_types and issue.guideline_evidence
    ]
    if not sources:
        return target_issues

    for target in target_issues:
        if target.guideline_evidence or target.issue_type not in guide_types:
            continue
        candidates = [s for s in sources if s.issue_type == target.issue_type]
        if not candidates:
            continue
        best = max(candidates, key=lambda source: _issue_similarity(target, source))
        if _issue_similarity(target, best) >= 0.25:
            target.guideline_evidence = best.guideline_evidence
    return target_issues


def _build_guideline_reference_block_for_verify(reference_blocks: List[str], priority_ref_block: str) -> str:
    parts = []
    if priority_ref_block.strip():
        parts.append(priority_ref_block.strip())
    parts.extend(block.strip() for block in reference_blocks if block.strip())
    if not parts:
        return ""
    combined = "\n\n".join(parts)
    if len(combined) > VERIFY_REFERENCE_MAX_CHARS:
        combined = combined[:VERIFY_REFERENCE_MAX_CHARS] + "\n\n...（参考数据源过长，已截断用于二次核验）"
    return "\n\n## 上传参考数据源（用于核验并补全指南依据）\n" + combined


def _parse_issues(items: list) -> List[IssueItem]:
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        result.append(IssueItem(
            description=item.get("description", ""),
            severity=item.get("severity", "medium"),
            examples=item.get("examples", []),
        ))
    return result


async def evaluate_article_quality(disease: str, article_text: str) -> QualityReport:
    prompt = f"""请对以下【{disease}】疾病知识库词条内容进行专业质量评估，请尽可能基于上传的指南、综述来分析，并严格按照以下四个维度标准逐项分析。

词条内容：
{article_text[:8000]}

## 评估维度说明（依据整合规范 6.0）

**维度一：内容全面**
- 重点内容（定义/概述、典型临床表现、主要辅助检查、诊断标准/诊断、治疗）：缺失须有权威数据源支撑才算问题
- 非重点内容（分类/分型、发病机制、病理生理、解剖、少见临床特征、预后、预防等）：需个性化判断
- 数据源缺失：关键内容无权威来源，每缺1篇扣1分
- 合格阈值：重点扣分＜10分/万字，或累积＜20分/万字；优秀：重点＜5，或累积＜10
- 扣分参考：重点内容重大缺失5分，影响临床使用3分，一般1分；非重点1分；数据源每缺1篇1分

**维度二：结构合理**
- 临床思维：章节顺序应结合具体疾病特点灵活判断，不同疾病适合不同的章节侧重点和顺序，不强制统一排列；预后分层若能指导治疗应置于治疗字段（扣3分）
- 整合逻辑：分类/分型/分期须放在正确字段（与诊断相关→诊断，与治疗相关→治疗，其余→基础知识）；标题须能概括下属全部内容
- 治疗字段不能以"治疗"作为子级标题，应以具体治疗类型（"药物治疗"等）为标题
- 合格阈值：累积＜20分/万字；优秀：累积＜10分/万字
- 扣分参考：结构严重错位3分，小调整1分

**维度三：内容准确**
- 内容错误：文本性错误影响句意（如药物剂量数字误写）：扣1分/处
- 内容陈旧：引用过时指南或旧版数据，未更新至最新权威推荐：扣1分/处
- 内容合理性（判定标准：是否影响用户理解、是否符合临床思维，文献不一致时保留的内容应自洽清楚）：多源融合思路不清晰（扣3分）；有分型未说明各型特点/优缺点（扣1分）；文字与表格重叠冗余又不完整（扣2分）；内容前后矛盾；未提及重要参考资料的特殊用法或剂量差异（扣1分）
- 合格阈值：重点扣分＜10分/万字，或累积＜20分/万字；优秀：重点＜5，或累积＜10

**维度四：内容精炼流畅**
- 同类错误多次出现计为1处，每处扣0.5分
- 合格阈值：累积＜20分/万字；优秀：累积＜10分/万字
- 扣分项：重复性文本/同一观点反复表达；研究性内容未精简（试验性/争议内容须精简，里程碑式可不精简）；必要图表缺失或不必要图表多余；必要超链缺失或多余；英文缩写首次出现未给出中英文全称；标题出现英文缩写；标题超过20字；保留"本指南""本共识"字眼；机翻痕迹；错别字；格式不一致；专有名词不统一

## 输出格式

请严格按以下JSON格式输出，severity取值为"high"/"medium"/"low"，无问题的数组输出[]：

{{
  "overall_score": <综合评分1.0-5.0的浮点数，基于四维度加权判断>,
  "summary": "整体评估总结，200字以内，指出最主要的问题和优势",
  "dim_one": {{
    "score": <1-5整数>,
    "key_missing": [
      {{"description": "具体缺失的重点内容描述", "severity": "high", "examples": ["具体体现，如：缺少XXX章节的YYY内容"]}}
    ],
    "nonkey_missing": [
      {{"description": "非重点内容缺失描述", "severity": "low", "examples": []}}
    ],
    "source_missing": [
      {{"description": "数据来源缺失描述", "severity": "medium", "examples": []}}
    ]
  }},
  "dim_two": {{
    "score": <1-5整数>,
    "clinical_thinking": [
      {{"description": "临床思维结构问题，描述当前结构和建议结构", "severity": "medium", "examples": ["如：当前为A→B→C，建议调整为C→B→A"]}}
    ],
    "integration_logic": [
      {{"description": "整合逻辑问题描述", "severity": "low", "examples": []}}
    ]
  }},
  "dim_three": {{
    "score": <1-5整数>,
    "errors": [
      {{"description": "具体错误内容描述", "severity": "high", "examples": ["原文：XXX，应为：YYY"]}}
    ],
    "outdated": [
      {{"description": "陈旧内容描述，指出应更新至哪个指南版本", "severity": "medium", "examples": []}}
    ],
    "unreasonable": [
      {{"description": "不合理内容的具体描述", "severity": "medium", "examples": []}}
    ]
  }},
  "dim_four": {{
    "score": <1-5整数>,
    "redundancy": [
      {{"description": "重复/冗余问题描述", "severity": "low", "examples": []}}
    ],
    "format_issues": [
      {{"description": "格式问题描述", "severity": "low", "examples": []}}
    ],
    "language_issues": [
      {{"description": "语言问题描述", "severity": "low", "examples": []}}
    ]
  }}
}}"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="legacy_quality_eval", text_generator=generate_text
    )

    d1 = data.get("dim_one", {})
    d2 = data.get("dim_two", {})
    d3 = data.get("dim_three", {})
    d4 = data.get("dim_four", {})

    return QualityReport(
        disease=disease,
        overall_score=float(data.get("overall_score", 3.0)),
        summary=data.get("summary", ""),
        dim_one=DimOneReport(
            score=int(d1.get("score", 3)),
            key_missing=_parse_issues(d1.get("key_missing", [])),
            nonkey_missing=_parse_issues(d1.get("nonkey_missing", [])),
            source_missing=_parse_issues(d1.get("source_missing", [])),
        ),
        dim_two=DimTwoReport(
            score=int(d2.get("score", 3)),
            clinical_thinking=_parse_issues(d2.get("clinical_thinking", [])),
            integration_logic=_parse_issues(d2.get("integration_logic", [])),
        ),
        dim_three=DimThreeReport(
            score=int(d3.get("score", 3)),
            errors=_parse_issues(d3.get("errors", [])),
            outdated=_parse_issues(d3.get("outdated", [])),
            unreasonable=_parse_issues(d3.get("unreasonable", [])),
        ),
        dim_four=DimFourReport(
            score=int(d4.get("score", 3)),
            redundancy=_parse_issues(d4.get("redundancy", [])),
            format_issues=_parse_issues(d4.get("format_issues", [])),
            language_issues=_parse_issues(d4.get("language_issues", [])),
        ),
    )


async def analyze_user_needs(disease: str, qa_items: List[QAItem]) -> NeedsAnalysis:
    qa_text = "\n".join([
        f"Q{i+1}: {item.question}" + (f"\nA: {item.answer[:200]}" if item.answer else "")
        for i, item in enumerate(qa_items[:200])
    ])

    prompt = f"""以下是临床医生关于【{disease}】的真实提问（共{len(qa_items)}条）。

{qa_text}

请分析这些提问，识别出典型需求类型并聚类，以JSON格式输出：
{{
  "disease": "{disease}",
  "total_qa_count": {len(qa_items)},
  "clusters": [
    {{
      "topic": "需求主题（简洁描述）",
      "frequency": <该类问题估计数量>,
      "representative_questions": ["典型问题1", "典型问题2"],
      "covered_in_kb": <true或false，基于问题判断知识库中是否有效覆盖>,
      "coverage_notes": "覆盖情况说明"
    }}
  ]
}}

要求：
- 聚类5-10个主要需求类型
- 按频次从高到低排列
- representative_questions每类取2-3个最有代表性的"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="legacy_user_needs", text_generator=generate_text
    )

    clusters = [NeedCluster(**c) for c in data.get("clusters", [])]
    return NeedsAnalysis(
        disease=data["disease"],
        total_qa_count=data["total_qa_count"],
        clusters=clusters
    )


def _fmt_issues(items: List[IssueItem], indent: str = "  ") -> str:
    active = [i for i in items if i.status != "rejected"]
    if not active:
        return f"{indent}（无问题）"
    lines = []
    for item in active:
        sev = {"high": "高优先", "medium": "中优先", "low": "低优先"}.get(item.severity, item.severity)
        note = f"（审核意见：{item.reviewer_note}）" if item.reviewer_note else ""
        status_mark = "【专家确认】" if item.status == "confirmed" else ("【专家补充】" if item.status == "added" else "")
        lines.append(f"{indent}- [{sev}]{status_mark} {item.description}{note}")
    return "\n".join(lines)


async def _verify_section_issues(
    disease: str,
    section: ArticleSection,
    first_pass_issues: List[SectionIssue],
    quality_standard: str,
    content_spec: str,
    guideline_reference_block: str = "",
) -> Tuple[List[SectionIssue], str]:
    """Second verification pass. Returns (refined_issues, verification_summary)."""
    if not first_pass_issues:
        return [], ""

    type_labels = {
        "missing_content": "内容缺失",
        "accuracy": "内容不准确",
        "outdated": "内容陈旧",
        "structure": "结构问题",
        "style": "语言/格式",
    }
    sev_labels = {"high": "高", "medium": "中", "low": "低"}

    issues_text = ""
    for i, issue in enumerate(first_pass_issues, 1):
        type_label = type_labels.get(issue.issue_type, issue.issue_type)
        sev = sev_labels.get(issue.severity, issue.severity)
        key_note = "（重点内容）" if issue.is_key_content else ""
        examples_text = ""
        if issue.examples:
            examples_text = "\n    示例：" + "；".join(issue.examples[:3])
        anchors_text = ""
        if issue.anchors:
            anchors_text = "\n    原文定位：" + "；".join(a.quote for a in issue.anchors[:3] if a.quote)
        evidence_text = ""
        if issue.guideline_evidence:
            evidence_text = "\n    指南依据：" + "；".join(
                f"{e.source}：{e.quote}" for e in issue.guideline_evidence[:3] if e.source or e.quote
            )
        issues_text += f"\n  {i}. [{type_label}/{sev}优先]{key_note} {issue.description}{examples_text}{anchors_text}{evidence_text}"

    prompt = f"""请对【{disease}】知识库词条「{section.heading}」章节的质量分析结果进行二次校验与优化。

## 章节原文内容
{section.content[:SECTION_PROMPT_MAX_CHARS]}

## 第一次分析识别到的问题（共{len(first_pass_issues)}项）
{issues_text}
{guideline_reference_block}

## 内容质量审评标准
{quality_standard[:QUALITY_STANDARD_MAX_CHARS]}

## 内容要求规范
{content_spec[:CONTENT_SPEC_MAX_CHARS]}

请对上述每个问题逐一核查：
1. **核实**：对照章节原文，确认该问题是否真实存在，有无被原文实际内容覆盖
2. **优化**：若问题描述不够精准，基于原文修正描述并补充具体原文依据
3. **删除**：若某问题在原文中已有明确覆盖，或描述明显有误，则从结果中移除；特别地，若structure类问题指向的是"缺少某子级目录"，但该章节原始内容本身确实不涉及该内容（即并非内容存在却放错位置），则应删除该问题——内容框架中的子级目录为参考框架，不强制要求，不得因内容本身不存在而扣分
4. **合并**：若多个问题高度重叠，合并为一条更准确的描述
5. **补全指南依据**：若保留missing_content、accuracy或outdated问题，且该问题依据上传参考数据源/重点指南判断，必须在guideline_evidence中逐字摘录指南原文；若第一次分析已给出指南依据，默认保留，不得删除

参考文献序号核查规则（非常重要）：
- 不要将章节原文中的参考文献序号（如[53]、[54]、[444-445]）与参考数据源/指南文末参考文献列表中的编号建立对应关系；二者编号体系彼此独立
- 不得仅因原文引用序号与指南参考文献列表编号不一致，判定为“引用错误”“内容不准确”“文献引用序号错误”
- 评估准确性时只比较医学内容本身是否与指南正文观点一致，忽略原文引用序号

{FIGURE_TABLE_REFERENCE_RULE}

{SUPERSCRIPT_SUBSCRIPT_RULE}

{SOURCE_BOUNDARY_RULE}

{HEADING_NUMBERING_RULE}

以JSON格式输出最终核验结果：
{{
  "verification_summary": "二次核验总结：说明做了哪些调整（删除/修正/合并了哪些问题）以及最终结论",
  "issues": [
    {{
      "issue_type": "missing_content",
      "description": "核验后精准的问题描述（包含原文出处或缺失位置）",
      "severity": "high",
      "examples": ["原文片段或具体示例"],
      "anchors": [
        {{"quote": "从章节原文中逐字摘录、最能定位该问题的连续片段", "heading_hint": "所在小标题，可为空"}}
      ],
      "guideline_evidence": [
        {{"source": "指南文件名或参考数据源编号", "quote": "指南原文中支持该判断的连续原文片段", "relevance": "说明该指南原文如何支持本问题"}}
      ],
      "deduction_score": 5.0,
      "is_key_content": true
    }}
  ]
}}

issue_type取值：missing_content / accuracy / outdated / structure / style
severity取值：high / medium / low
anchors定位要求：每个问题尽量保留或补充1-3个quote，quote必须逐字摘录自章节原文；accuracy/outdated/style类问题必须提供对应原文片段；missing_content可提供最接近的标题或留空。
若一个问题包含多个具体小问题或多个具体例子（例如多个术语格式问题、多个重复位置、多个错误数据点），必须尽量为每个小问题分别提供一个anchor；每个anchor的quote应对应一个具体原文位置，避免只给一个总定位。若examples中列出“1. ...；2. ...；3. ...”等编号小点，anchors原则上不得少于这些编号小点数量，除非某个小点在章节原文中确实找不到对应片段。
guideline_evidence要求：若问题属于missing_content、accuracy或outdated，且判断依据来自参考指南/重点指南，必须填写1-3条guideline_evidence；source统一写“参考数据源 N：文件名”，N必须使用上传数据源的固定全局序号，即使该资料被标记为重点指南，也不要写“重点指南 N”；quote必须逐字摘录指南原文中支持该判断的连续片段，relevance说明该指南原文与问题的关系。若无法找到指南原文依据，不要把该项作为“与指南不相符/缺失/陈旧”问题保留。
若所有问题核验后均属实且无需修改，原样输出并在verification_summary中说明「问题属实，无需调整」。
若所有问题均被推翻，输出 {{"verification_summary": "...", "issues": []}}"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="section_issue_verify", text_generator=generate_text
    )

    refined_issues: List[SectionIssue] = []
    for item in data.get("issues", []):
        if not isinstance(item, dict):
            continue
        refined_issues.append(_build_section_issue(item))
    _restore_missing_guideline_evidence(refined_issues, first_pass_issues)

    verification_summary = data.get("verification_summary", "")
    return refined_issues, verification_summary


def _should_recheck_empty_section(
    section: ArticleSection,
    ref_block: str = "",
    priority_ref_block: str = "",
) -> bool:
    content_len = len((section.content or "").strip())
    return content_len >= 2000 or bool(ref_block.strip()) or bool(priority_ref_block.strip())


async def _recheck_empty_section_issues(
    disease: str,
    section: ArticleSection,
    quality_standard: str,
    content_spec: str,
    ref_block: str = "",
    priority_ref_block: str = "",
) -> Tuple[List[SectionIssue], str]:
    prompt = f"""上一轮对【{disease}】知识库词条「{section.heading}」章节的内容质量审评返回了空结果：{{"issues":[]}}。

这不一定错误，但该章节内容较长或存在参考资料。请进行一次“空结果复核”，目标是避免漏检，而不是为了凑数量编造问题。

## 章节原文内容
{section.content[:SECTION_PROMPT_MAX_CHARS]}

## 内容质量审评标准
{quality_standard[:QUALITY_STANDARD_MAX_CHARS]}

## 内容要求规范
{content_spec[:CONTENT_SPEC_MAX_CHARS]}
{priority_ref_block}
{ref_block}

请按以下清单重新核查：
1. 内容全面性：本章节职责范围内是否有重点内容缺失、关键限制条件缺失、数据源支撑不足
2. 结构合理性：是否存在内容已经写了但放错层级/放错字段、临床使用顺序明显混乱
3. 内容准确性/时效性：是否与可见参考资料中的医学观点、剂量、分类、机制、适应证/禁忌证等不一致
4. 精炼流畅与格式：是否存在可定位的术语不统一、缩写首次出现不规范、重复冗余、明显机翻/来源边界问题

严格约束：
- 如果发现任何真实、可定位、证据充分的问题，必须输出到issues，不要再次空返回。
- 不得为了“有问题”而编造；如果复核后仍认为无问题，issues可为空，但必须在empty_review_summary中逐项说明为什么未发现问题。
- missing_content、accuracy、outdated问题若依赖参考资料判断，必须提供guideline_evidence；没有逐字指南依据时不要保留该类问题。
- style、accuracy、outdated问题必须提供章节原文anchors；无法定位到章节原文时不要保留。
- 只审查章节原文，不要把审评标准、内容规范、参考资料或本提示词当成原文问题。

{FIGURE_TABLE_REFERENCE_RULE}

{SUPERSCRIPT_SUBSCRIPT_RULE}

{SOURCE_BOUNDARY_RULE}

{HEADING_NUMBERING_RULE}

以JSON格式输出：
{{
  "empty_review_summary": "空结果复核摘要：逐项说明内容全面性/结构/准确性时效性/语言格式的检查结论；若仍无问题，说明依据；若发现问题，说明空结果被纠正。",
  "issues": [
    {{
      "issue_type": "missing_content",
      "description": "复核发现的问题描述",
      "severity": "high",
      "examples": ["具体体现或原文片段"],
      "anchors": [
        {{"quote": "从章节原文中逐字摘录、最能定位该问题的连续片段", "heading_hint": "所在小标题，可为空"}}
      ],
      "guideline_evidence": [
        {{"source": "参考数据源 N：文件名", "quote": "参考资料原文中支持该判断的连续片段", "relevance": "说明该参考资料如何支持本问题"}}
      ],
      "deduction_score": 3.0,
      "is_key_content": true
    }}
  ]
}}

issue_type取值：missing_content / accuracy / outdated / structure / style
severity取值：high / medium / low"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="section_empty_recheck", text_generator=generate_text
    )

    rechecked_issues: List[SectionIssue] = []
    for item in data.get("issues", []):
        if not isinstance(item, dict):
            continue
        rechecked_issues.append(_build_section_issue(item))

    summary = data.get("empty_review_summary") or "空结果复核完成，未返回复核摘要。"
    return rechecked_issues, summary


def _split_into_chunks(content: str, chunk_size: int, overlap: int) -> List[str]:
    """Split content into overlapping chunks, preferring paragraph boundaries."""
    chunks = []
    start = 0
    length = len(content)
    while start < length:
        end = min(start + chunk_size, length)
        if end < length:
            # Try to break at paragraph boundary
            para_pos = content.rfind("\n\n", start, end)
            if para_pos != -1 and para_pos > start:
                end = para_pos + 2
            else:
                newline_pos = content.rfind("\n", start, end)
                if newline_pos != -1 and newline_pos > start:
                    end = newline_pos + 1
        chunks.append(content[start:end])
        if end >= length:
            break
        start = end - overlap
    return chunks


def _chunk_reference_text(text: str, chunk_size: int = 900) -> List[str]:
    chunks: List[str] = []
    buf = ""
    for paragraph in re.split(r"\n{2,}", text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if buf and len(buf) + len(paragraph) > chunk_size:
            chunks.append(buf)
            buf = paragraph
        else:
            buf = f"{buf}\n{paragraph}".strip() if buf else paragraph
    if buf:
        chunks.append(buf)
    return chunks


def _reference_keywords(section_heading: str, section_content: str, limit: int = 180) -> List[str]:
    query = f"{section_heading}\n{section_content[:5000]}".lower()
    keywords: List[str] = []
    for token in re.findall(r"[a-z0-9]{2,}|[\u4e00-\u9fff]{2,}", query):
        if len(token) <= 12:
            keywords.append(token)
        elif re.fullmatch(r"[\u4e00-\u9fff]+", token):
            keywords.extend(token[i:i + 4] for i in range(0, max(0, len(token) - 3), 2))
    seen = set()
    result = []
    for keyword in keywords:
        if keyword in seen:
            continue
        seen.add(keyword)
        result.append(keyword)
        if len(result) >= limit:
            break
    return result


def _extract_relevant_reference_chunks(
    reference_texts: List[str],
    section_heading: str,
    section_content: str,
    max_total_chars: int = 30000,
) -> List[Tuple[int, str]]:
    keywords = _reference_keywords(section_heading, section_content)
    scored: List[Tuple[int, int, str]] = []
    for ref_idx, text in enumerate(reference_texts):
        for chunk in _chunk_reference_text(text):
            lower = chunk.lower()
            score = sum(1 for keyword in keywords if keyword and keyword in lower)
            if score > 0:
                scored.append((score, ref_idx + 1, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    selected: List[Tuple[int, str]] = []
    total = 0
    for _score, ref_idx, chunk in scored:
        if total + len(chunk) > max_total_chars:
            continue
        selected.append((ref_idx, chunk))
        total += len(chunk)
        if total >= max_total_chars:
            break

    if selected:
        return selected

    fallback: List[Tuple[int, str]] = []
    total = 0
    for ref_idx, text in enumerate(reference_texts):
        chunk = text.strip()[:2000]
        if not chunk:
            continue
        if total + len(chunk) > max_total_chars:
            break
        fallback.append((ref_idx + 1, chunk))
        total += len(chunk)
    return fallback


def _build_reference_block(reference_texts: List[str], section_heading: str, section_content: str) -> str:
    selected = _extract_relevant_reference_chunks(
        reference_texts,
        section_heading,
        section_content,
        max_total_chars=SECTION_REFERENCE_MAX_CHARS,
    )
    if not selected:
        return ""
    blocks = [
        "## 参考数据源相关片段",
        "以下为系统按当前章节标题和正文筛选出的参考资料片段；仅可基于可见片段判断指南依据。",
    ]
    for ref_idx, chunk in selected:
        blocks.append(f"### 参考数据源 {ref_idx}\n{chunk}")
    return "\n\n" + "\n---\n".join(blocks)


def _build_confirmed_reference_block(confirmed_chunks: List[ConfirmedReferenceChunk]) -> str:
    clean_chunks = [chunk for chunk in (confirmed_chunks or []) if chunk.text.strip()]
    if not clean_chunks:
        return ""
    blocks = [
        "## 用户确认的指南切片",
        "以下片段已由用户确认为本次章节质量评审可用证据；仅可基于这些可见片段判断指南依据。",
    ]
    for chunk in clean_chunks:
        title = f"\n标题路径：{chunk.title_path}" if chunk.title_path else ""
        source_refs = f"\n可用引用标记：{', '.join(f'[{chunk.source_id}-{ref_id}]' for ref_id in chunk.source_ref_ids)}" if chunk.source_ref_ids else f"\n可用引用标记：[{chunk.source_id}]"
        blocks.append(
            f"### 参考数据源 {chunk.source_id}：{chunk.source_filename}{title}{source_refs}\n{chunk.text.strip()}"
        )
    return "\n\n" + "\n---\n".join(blocks)


def _confirmed_reference_texts(confirmed_chunks: Optional[List[ConfirmedReferenceChunk]]) -> List[str]:
    return [
        f"### 参考数据源 {chunk.source_id}：{chunk.source_filename}\n{chunk.text}"
        for chunk in (confirmed_chunks or [])
        if chunk.text.strip()
    ]


def _reference_source_label(text: str, fallback_idx: int) -> str:
    match = re.search(r"参考数据源\s*\d+(?:[：:][^\n]+)?", text)
    if match:
        return match.group(0).strip()
    return f"参考数据源 {fallback_idx}"


def _build_priority_reference_block(
    priority_reference_texts: List[str],
    section_heading: str = "",
    section_content: str = "",
    max_total_chars: int = SECTION_REFERENCE_MAX_CHARS,
) -> str:
    clean_refs = [text.strip() for text in priority_reference_texts if text.strip()]
    if not clean_refs:
        return ""
    if section_heading or section_content:
        selected = _extract_relevant_reference_chunks(
            clean_refs,
            section_heading,
            section_content,
            max_total_chars=max_total_chars,
        )
        refs_for_prompt = []
        included_ref_idxs: set[int] = set()

        def append_priority_chunk(ref_idx: int, chunk: str) -> None:
            label = _reference_source_label(clean_refs[ref_idx - 1], ref_idx)
            if re.match(r"^###\s*参考数据源\s*\d+", chunk):
                refs_for_prompt.append(chunk)
            else:
                refs_for_prompt.append(f"### {label}（重点指南相关片段）\n{chunk}")

        for ref_idx, chunk in selected:
            included_ref_idxs.add(ref_idx)
            append_priority_chunk(ref_idx, chunk)
        for ref_idx, text in enumerate(clean_refs, 1):
            if ref_idx in included_ref_idxs:
                continue
            fallback_chunk = (_chunk_reference_text(text[:2000]) or [text[:2000]])[0].strip()
            if fallback_chunk:
                append_priority_chunk(ref_idx, fallback_chunk)
    else:
        refs_for_prompt = clean_refs
    return (
        "\n\n## ⚠️ 重点指南主证据区（本章节主判断依据）\n"
        "以下资料由用户标记为本章节重点指南，是本章节质量评审的主判断依据。"
        "标题中的「参考数据源 N」为上传时的固定全局序号，"
        "即使作为重点指南也必须沿用该编号。若其他参考数据源与重点指南观点不一致，或推荐、分期、剂量、疗程、适应证、禁忌证等不一致，"
        "请以重点指南为准；只有当重点指南未覆盖相关问题时，才参考其他资料。报告问题时应优先引用重点指南作为判断依据，"
        "报告 missing_content、accuracy 或 outdated 问题时，若重点指南区包含相关依据，必须优先引用重点指南作为 guideline_evidence；"
        "source字段统一写「参考数据源 N：文件名」，不要写「重点指南 N」。"
        "若下方只提供了相关片段，仅可基于可见片段判断指南依据。\n"
        + "\n---\n".join(refs_for_prompt)
    )


def _split_reference_for_batches(text: str, max_chars: int) -> List[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    chunks: List[str] = []
    buf = ""
    for paragraph in re.split(r"\n{2,}", text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if len(paragraph) > max_chars:
            if buf:
                chunks.append(buf)
                buf = ""
            for start in range(0, len(paragraph), max_chars):
                chunks.append(paragraph[start:start + max_chars])
            continue
        if buf and len(buf) + len(paragraph) + 2 > max_chars:
            chunks.append(buf)
            buf = paragraph
        else:
            buf = f"{buf}\n\n{paragraph}".strip() if buf else paragraph
    if buf:
        chunks.append(buf)
    return chunks


def _build_reference_blocks(
    reference_texts: List[str],
    max_total_chars: int = REFERENCE_BATCH_MAX_CHARS,
) -> List[str]:
    """Build full-reference prompt blocks, batching only when context is too large.

    Unlike the previous keyword selector, this preserves every non-empty reference
    source. Large sources are split in source order so each character is offered to
    the model in one of the batches.
    """
    labeled_blocks: List[str] = []
    for ref_idx, text in enumerate(reference_texts, 1):
        clean = text.strip()
        if not clean:
            continue
        max_chunk_chars = max(1000, max_total_chars - 1200)
        chunks = _split_reference_for_batches(clean, max_chunk_chars)
        for chunk_idx, chunk in enumerate(chunks, 1):
            suffix = f"（第 {chunk_idx}/{len(chunks)} 段）" if len(chunks) > 1 else ""
            if re.match(r"^###\s*参考数据源\s*\d+", chunk):
                labeled_blocks.append(f"{chunk}{suffix}")
            else:
                labeled_blocks.append(f"### 参考数据源 {ref_idx}{suffix}\n{chunk}")

    if not labeled_blocks:
        return []

    batches: List[List[str]] = []
    current: List[str] = []
    current_len = 0
    separator_len = len("\n---\n")
    for block in labeled_blocks:
        next_len = len(block) + (separator_len if current else 0)
        if current and current_len + next_len > max_total_chars:
            batches.append(current)
            current = [block]
            current_len = len(block)
        else:
            current.append(block)
            current_len += next_len
    if current:
        batches.append(current)

    total_batches = len(batches)
    return [
        f"\n\n## 参考数据源全文（第 {idx}/{total_batches} 批）\n" + "\n---\n".join(batch)
        for idx, batch in enumerate(batches, 1)
    ]


def _reference_batch_note(batch_idx: int, total_batches: int) -> str:
    if total_batches <= 1:
        return ""
    return (
        f"（注：以下参考数据源为第{batch_idx}/{total_batches}批。"
        "请基于当前批次能直接支持的证据报告问题；不要因为其他批次未出现在本次 prompt 中，"
        "就判定内容缺失、内容陈旧或数据源缺失。系统会汇总所有批次结果。）"
    )


async def _analyze_section_with_reference_block(
    disease: str,
    section: ArticleSection,
    quality_standard: str,
    content_spec: str,
    ref_block: str,
    priority_ref_block: str,
    article_outline: Optional[List[str]],
    context: str,
    chunk_note: str = "",
    batch_note: str = "",
) -> List[SectionIssue]:
    outline_block = ""
    if article_outline:
        outline_block = "\n\n## ⚠️ 完整词条章节大纲（重要）\n" + "\n".join(
            f"- {h}" for h in article_outline
        ) + "\n\n**关键规则：评估「内容缺失」时，必须先核查以上章节大纲。若某内容在其他章节中已有对应标题（如「定义」「鉴别诊断」「诊断」「治疗」等），则不得在本章节标记为缺失——该内容属于其他章节的职责范围，本章节无需重复。只报告本章节自身范围内真实存在的问题。**"

    notes = "".join(note for note in (chunk_note, batch_note) if note)

    prompt = f"""请对【{disease}】知识库词条的以下章节进行质量分析。{notes}章节内容已包含其下级子章节的内容，请综合考虑整体。

## 章节标题
{section.heading}

## 章节内容（含子章节）
{section.content[:SECTION_PROMPT_MAX_CHARS]}
{outline_block}
## 内容质量审评标准
{quality_standard[:QUALITY_STANDARD_MAX_CHARS]}

## 内容要求规范
{content_spec[:CONTENT_SPEC_MAX_CHARS]}
{priority_ref_block}
{ref_block}
{guideline_chunk_usage_prompt() if (priority_ref_block or ref_block) else ""}

请从以下五类问题角度分析该章节存在的质量问题，以JSON格式输出。为避免输出被截断，最多输出{SECTION_ISSUE_OUTPUT_LIMIT}条最重要、证据最充分、可定位的问题；相同或高度相似问题必须合并：
{{
  "issues": [
    {{
      "issue_type": "missing_content",
      "description": "具体缺失的内容描述",
      "severity": "high",
      "examples": ["具体体现或原文片段"],
      "anchors": [
        {{"quote": "从章节原文中逐字摘录、最能定位该问题的连续片段", "heading_hint": "所在小标题，可为空"}}
      ],
      "guideline_evidence": [
        {{"source": "指南文件名或参考数据源编号", "quote": "指南原文中支持该判断的连续原文片段", "relevance": "说明该指南原文如何支持本问题"}}
      ],
      "deduction_score": 5.0,
      "is_key_content": true
    }}
  ]
}}

issue_type取值（对应审评维度）：
- missing_content: 【维度一·内容全面】内容缺失（重点/非重点内容缺失、数据源缺失）
- structure: 【维度二·结构合理】结构/逻辑问题（临床思维顺序、整合逻辑）
- accuracy: 【维度三·内容准确】内容不准确或有误（内容错误、内容不合理）
- outdated: 【维度三·内容准确】内容陈旧（未更新至最新指南）
- style: 【维度四·内容精炼流畅】语言/格式/重复问题

severity取值：high/medium/low

deduction_score扣分参考（浮点数，实际扣分值，不做万字换算）：
- missing_content重点内容：1-5分（重大缺失如完全没有诊断/治疗内容5分；影响临床使用3分；一般缺失1分）；is_key_content=true；合格线重点<10/万字，优秀<5/万字
- missing_content非重点内容：1分；is_key_content=false；数据源缺失每缺1篇扣1分；合格线累积<20/万字，优秀<10/万字
- accuracy内容错误（文本性错误影响句意如药物剂量误写）：1分；内容合理性问题（判定标准：是否影响用户理解、是否符合临床思维，文献不一致时保留内容应自洽清楚）——多源融合混乱：3分；分型未说明特点/优缺点：1分；剂量差异/特殊用法未列举：1分；表格文字冗余重叠：2分；severity=high对应重点内容准确性问题；合格线重点<10/万字，累积<20/万字；优秀线重点<5/万字，累积<10/万字
- outdated内容陈旧：1分；severity=high对应重点内容陈旧；合格线同accuracy
- structure临床思维大问题（章节严重错位/分类字段放错）：3分；小结构调整：1分；合格线累积<20/万字，优秀<10/万字
  ⚠️ 结构评估重要原则：内容要求规范中列出的子级目录是「参考框架」，并非每个子级都强制要求。判断某子级目录是否应存在，须以内容的实际需要为准——若该章节的参考资料本身不含相关内容，或内容量极少不足以独立成节，则缺少该子级目录不属于结构问题，不得扣分。只有当内容已存在但放错了位置（如临床思维顺序颠倒、分类字段放错），或目录层级逻辑明显混乱时，才应标记为structure问题。例如：「预后」章节中「长期/短期监测」「随访」并非必须，若原始内容本身无此类内容，则无需标记缺失。
- style同类问题每处0.5分（英文缩写格式/标题问题/专有名词不统一/重复文本/机翻/"本指南"等）；合格线累积<20/万字，优秀<10/万字

is_key_content说明（仅missing_content类型有效）：
- 重点内容包括：定义/概述、典型临床表现、主要辅助检查、诊断标准/诊断、治疗
- 属于重点内容缺失则设为true，否则false（非重点内容、数据源缺失均设false）

anchors定位要求：
- 每个问题尽量提供1-3个anchors；quote必须逐字摘录自“章节内容（含子章节）”，用于前端点击问题后定位原文
- 若一个问题包含多个具体小问题或多个具体例子（例如多个术语格式问题、多个重复位置、多个错误数据点），必须尽量为每个小问题分别提供一个anchor；每个anchor的quote应对应一个具体原文位置，避免只给一个总定位。若examples中列出“1. ...；2. ...；3. ...”等编号小点，anchors原则上不得少于这些编号小点数量，除非某个小点在章节原文中确实找不到对应片段
- accuracy/outdated/style类问题必须提供对应原文片段；structure类问题提供最相关标题或段落；missing_content类问题提供最接近的缺失位置标题或留空
- quote不要写“应为XXX”、不要改写、不要摘录参考文献，只摘录知识库原文中真实存在的连续片段

guideline_evidence指南依据要求（非常重要）：
- 对missing_content、accuracy、outdated问题，只要判断依据来自参考指南/重点指南，必须提供1-3条guideline_evidence
- source统一写“参考数据源 N：文件名”，N必须使用上传数据源的固定全局序号，即使该资料被标记为重点指南，也不要写“重点指南 N”；若文件名不可识别，则写“参考数据源 N”
- quote必须逐字摘录指南原文中的连续片段，不能总结、不能改写、不能只写“指南建议”
- relevance说明该指南原文为什么能证明“当前词条缺失/与指南不相符/内容陈旧”
- 如果找不到可逐字引用的指南原文依据，不得报告“与指南不相符”“指南推荐缺失”“内容陈旧”等依赖指南判断的问题

参考文献序号核查规则（非常重要）：
- 不要将章节原文中的参考文献序号（如[53]、[54]、[444-445]）与参考数据源/指南文末参考文献列表中的编号建立对应关系；二者编号体系彼此独立
- 不得仅因原文引用序号与指南参考文献列表编号不一致，判定为“引用错误”“内容不准确”“文献引用序号错误”
- 评估准确性时只比较医学内容本身是否与指南正文观点一致，忽略原文引用序号

{FIGURE_TABLE_REFERENCE_RULE}

{SUPERSCRIPT_SUBSCRIPT_RULE}

{SOURCE_BOUNDARY_RULE}

{HEADING_NUMBERING_RULE}

若无问题，输出 {{"issues": []}}"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context=context, text_generator=generate_text
    )

    issues = []
    for item in data.get("issues", []):
        if not isinstance(item, dict):
            continue
        issues.append(_build_section_issue(item))
    return issues


async def _analyze_section_chunk(
    disease: str,
    chunk_section: ArticleSection,
    chunk_idx: int,
    total_chunks: int,
    quality_standard: str,
    content_spec: str,
    reference_texts: List[str],
    priority_reference_texts: List[str],
    article_outline: Optional[List[str]],
    confirmed_reference_chunks: Optional[List[ConfirmedReferenceChunk]] = None,
) -> List[SectionIssue]:
    """Analyze one chunk of a section. Returns raw issues without verification."""
    chunk_note = f"（注：以下为该章节第{chunk_idx}/{total_chunks}段内容，请仅分析此段中实际存在的问题）"
    confirmed_ref_block = _build_confirmed_reference_block(confirmed_reference_chunks or [])
    reference_blocks = [confirmed_ref_block or _build_reference_block(reference_texts, chunk_section.heading, chunk_section.content)]
    if not reference_blocks[0]:
        reference_blocks = [""]
    priority_ref_block = "" if confirmed_ref_block else _build_priority_reference_block(
        priority_reference_texts,
        chunk_section.heading,
        chunk_section.content,
    )
    all_issues: List[SectionIssue] = []
    for batch_idx, ref_block in enumerate(reference_blocks, 1):
        all_issues.extend(await _analyze_section_with_reference_block(
            disease, chunk_section, quality_standard, content_spec, ref_block,
            priority_ref_block, article_outline, context="section_chunk_analysis", chunk_note=chunk_note,
            batch_note=_reference_batch_note(batch_idx, len(reference_blocks)),
        ))

    if len(reference_blocks) > 1:
        merged_issues, _summary = await _merge_chunk_issues(
            disease, f"{chunk_section.heading} 第{chunk_idx}段", all_issues,
        )
        return merged_issues
    return all_issues


async def _merge_chunk_issues(
    disease: str,
    section_heading: str,
    all_issues: List[SectionIssue],
) -> Tuple[List[SectionIssue], str]:
    """Merge issues from multiple chunks, deduplicating near-identical ones."""
    if not all_issues:
        return [], ""

    type_labels = {
        "missing_content": "内容缺失",
        "accuracy": "内容不准确",
        "outdated": "内容陈旧",
        "structure": "结构问题",
        "style": "语言/格式",
    }
    sev_labels = {"high": "高", "medium": "中", "low": "低"}

    issues_text = ""
    for i, issue in enumerate(all_issues, 1):
        type_label = type_labels.get(issue.issue_type, issue.issue_type)
        sev = sev_labels.get(issue.severity, issue.severity)
        key_note = "（重点内容）" if issue.is_key_content else ""
        examples_text = ""
        if issue.examples:
            examples_text = "\n    示例：" + "；".join(issue.examples[:3])
        anchors_text = ""
        if issue.anchors:
            anchors_text = "\n    原文定位：" + "；".join(a.quote for a in issue.anchors[:3] if a.quote)
        evidence_text = ""
        if issue.guideline_evidence:
            evidence_text = "\n    指南依据：" + "；".join(
                f"{e.source}：{e.quote}" for e in issue.guideline_evidence[:3] if e.source or e.quote
            )
        issues_text += f"\n  {i}. [{type_label}/{sev}优先]{key_note} {issue.description}{examples_text}{anchors_text}{evidence_text}"

    prompt = f"""以下是对【{disease}】词条「{section_heading}」章节按段落分块分析后汇总的所有问题（共{len(all_issues)}项，可能含重复）。

## 汇总问题列表
{issues_text}

请对上述问题进行去重合并：
1. 将重复或高度相似的问题合并为一条（保留最完整的描述和示例）
2. 保留所有实质不同的问题
3. 以完全相同的JSON schema输出最终问题列表；最终最多保留{MERGED_ISSUE_OUTPUT_LIMIT}条最重要、证据最充分的问题

以JSON格式输出：
{{
  "merge_summary": "说明合并了哪些重复问题，最终保留了多少条",
  "issues": [
    {{
      "issue_type": "missing_content",
      "description": "合并后的问题描述",
      "severity": "high",
      "examples": ["具体示例"],
      "anchors": [
        {{"quote": "合并后保留的原文定位片段", "heading_hint": "所在小标题，可为空"}}
      ],
      "guideline_evidence": [
        {{"source": "指南文件名或参考数据源编号", "quote": "指南原文中支持该判断的连续原文片段", "relevance": "说明该指南原文如何支持本问题"}}
      ],
      "deduction_score": 5.0,
      "is_key_content": true
    }}
  ]
}}

issue_type取值：missing_content / accuracy / outdated / structure / style
severity取值：high / medium / low
anchors沿用原问题中最能定位原文的quote；若合并多个问题，可保留1-3个quote。
guideline_evidence沿用原问题中的指南来源和指南原文；missing_content、accuracy、outdated问题若保留，必须保留对应指南依据。
若所有问题均不重复，原样输出并在merge_summary中说明「无重复问题，全部保留」。"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="section_chunk_merge", text_generator=generate_text
    )

    merged_issues: List[SectionIssue] = []
    for item in data.get("issues", []):
        if not isinstance(item, dict):
            continue
        merged_issues.append(_build_section_issue(item))
    _restore_missing_guideline_evidence(merged_issues, all_issues)

    merge_summary = data.get("merge_summary", "")
    return merged_issues, merge_summary


async def analyze_section(
    disease: str,
    section: ArticleSection,
    quality_standard: str,
    content_spec: str,
    reference_texts: List[str],
    priority_reference_texts: Optional[List[str]] = None,
    article_outline: Optional[List[str]] = None,
    confirmed_reference_chunks: Optional[List[ConfirmedReferenceChunk]] = None,
) -> SectionAnalysis:
    """Analyze a single article section against quality standards."""
    evidence_reference_texts = [*(reference_texts or []), *_confirmed_reference_texts(confirmed_reference_chunks)]
    # Chunking path for very long sections
    if len(section.content) > CHUNK_THRESHOLD:
        print(f"[analyze_section] 章节「{section.heading}」内容超过 {CHUNK_THRESHOLD} 字符（{len(section.content)}），启用分块分析")
        chunks = _split_into_chunks(section.content, CHUNK_SIZE, CHUNK_OVERLAP)
        print(f"[analyze_section] 共拆分为 {len(chunks)} 块")
        all_issues: List[SectionIssue] = []
        for i, chunk in enumerate(chunks):
            chunk_section = ArticleSection(
                id=section.id,
                heading=section.heading,
                content=chunk,
                level=section.level,
                word_count=len(chunk),
            )
            chunk_issues = await _analyze_section_chunk(
                disease, chunk_section, i + 1, len(chunks),
                quality_standard, content_spec, reference_texts, priority_reference_texts or [], article_outline,
                confirmed_reference_chunks=confirmed_reference_chunks,
            )
            print(f"[analyze_section] 第 {i+1}/{len(chunks)} 块分析完毕，发现 {len(chunk_issues)} 个问题")
            all_issues.extend(chunk_issues)
        _sanitize_guideline_evidence_sources(
            all_issues,
            evidence_reference_texts,
            priority_reference_texts or [],
        )
        merged_issues, summary = await _merge_chunk_issues(
            disease, section.heading, all_issues,
        )
        _sanitize_guideline_evidence_sources(
            merged_issues,
            evidence_reference_texts,
            priority_reference_texts or [],
        )
        if not merged_issues:
            confirmed_ref_block = _build_confirmed_reference_block(confirmed_reference_chunks or [])
            ref_block = confirmed_ref_block or _build_reference_block(reference_texts, section.heading, section.content)
            priority_ref_block = "" if confirmed_ref_block else _build_priority_reference_block(
                priority_reference_texts or [],
                section.heading,
                section.content,
            )
            if _should_recheck_empty_section(section, ref_block, priority_ref_block):
                merged_issues, empty_summary = await _recheck_empty_section_issues(
                    disease, section, quality_standard, content_spec, ref_block, priority_ref_block,
                )
                _sanitize_guideline_evidence_sources(
                    merged_issues,
                    evidence_reference_texts,
                    priority_reference_texts or [],
                )
                summary = "\n".join(part for part in (summary, empty_summary) if part)
                if merged_issues:
                    guideline_reference_block = _build_guideline_reference_block_for_verify([ref_block], priority_ref_block)
                    merged_issues, verify_summary = await _verify_section_issues(
                        disease, section, merged_issues, quality_standard, content_spec,
                        guideline_reference_block=guideline_reference_block,
                    )
                    _sanitize_guideline_evidence_sources(
                        merged_issues,
                        evidence_reference_texts,
                        priority_reference_texts or [],
                    )
                    summary = "\n".join(part for part in (summary, verify_summary) if part)
        merged_issues = _drop_false_table_body_missing_issues(merged_issues, section.content)
        merged_issues = _drop_false_covered_missing_content_issues(merged_issues, section.content)
        merged_issues = _drop_false_numbering_and_reference_style_issues(merged_issues, section.content)
        merged_issues = _drop_out_of_scope_disease_issues(merged_issues, disease)
        merged_issues = _drop_false_rome_v_unpublished_issues(merged_issues, evidence_reference_texts)
        _attach_issue_anchors(merged_issues, section.content)
        merged_issues = _drop_false_abbreviation_full_name_issues(merged_issues)
        merged_issues = _drop_unlocated_required_anchor_issues(merged_issues)
        return SectionAnalysis(
            section_id=section.id,
            section_heading=section.heading,
            issues=merged_issues,
            verification_summary=summary,
        )

    confirmed_ref_block = _build_confirmed_reference_block(confirmed_reference_chunks or [])
    reference_blocks = [confirmed_ref_block or _build_reference_block(reference_texts, section.heading, section.content)]
    if not reference_blocks[0]:
        reference_blocks = [""]
    priority_ref_block = "" if confirmed_ref_block else _build_priority_reference_block(
        priority_reference_texts or [],
        section.heading,
        section.content,
    )
    guideline_reference_block = _build_guideline_reference_block_for_verify(reference_blocks, priority_ref_block)
    issues: List[SectionIssue] = []
    for batch_idx, ref_block in enumerate(reference_blocks, 1):
        issues.extend(await _analyze_section_with_reference_block(
            disease, section, quality_standard, content_spec, ref_block, priority_ref_block, article_outline,
            context="section_analysis",
            batch_note=_reference_batch_note(batch_idx, len(reference_blocks)),
        ))
    _sanitize_guideline_evidence_sources(
        issues,
        evidence_reference_texts,
        priority_reference_texts or [],
    )

    if len(reference_blocks) > 1:
        issues, _merge_summary = await _merge_chunk_issues(
            disease, section.heading, issues,
        )
        _sanitize_guideline_evidence_sources(
            issues,
            evidence_reference_texts,
            priority_reference_texts or [],
        )

    empty_review_summary = ""
    if not issues:
        ref_block = reference_blocks[0] if reference_blocks else ""
        if _should_recheck_empty_section(section, ref_block, priority_ref_block):
            issues, empty_review_summary = await _recheck_empty_section_issues(
                disease, section, quality_standard, content_spec, ref_block, priority_ref_block,
            )
            _sanitize_guideline_evidence_sources(
                issues,
                evidence_reference_texts,
                priority_reference_texts or [],
            )

    if not issues:
        return SectionAnalysis(
            section_id=section.id,
            section_heading=section.heading,
            issues=[],
            verification_summary=empty_review_summary,
        )

    # Second pass: verify and refine the first-pass issues
    verified_issues, verification_summary = await _verify_section_issues(
        disease, section, issues, quality_standard, content_spec,
        guideline_reference_block=guideline_reference_block,
    )
    _sanitize_guideline_evidence_sources(
        verified_issues,
        evidence_reference_texts,
        priority_reference_texts or [],
    )
    if empty_review_summary:
        verification_summary = "\n".join(
            part for part in (empty_review_summary, verification_summary) if part
        )
    verified_issues = _drop_false_table_body_missing_issues(verified_issues, section.content)
    verified_issues = _drop_false_covered_missing_content_issues(verified_issues, section.content)
    verified_issues = _drop_false_numbering_and_reference_style_issues(verified_issues, section.content)
    verified_issues = _drop_out_of_scope_disease_issues(verified_issues, disease)
    verified_issues = _drop_false_rome_v_unpublished_issues(verified_issues, evidence_reference_texts)
    _attach_issue_anchors(verified_issues, section.content)
    verified_issues = _drop_false_abbreviation_full_name_issues(verified_issues)
    verified_issues = _drop_unlocated_required_anchor_issues(verified_issues)

    return SectionAnalysis(
        section_id=section.id,
        section_heading=section.heading,
        issues=verified_issues,
        verification_summary=verification_summary,
    )


async def _classify_batch(disease: str, batch_items: List[QAItem], total_count: int) -> List[NeedCluster]:
    """Classify a single batch of Q&A items into need clusters."""
    qa_text = "\n".join([
        f"Q{i+1}: {item.question}" + (f"\nA: {item.answer[:150]}" if item.answer else "")
        for i, item in enumerate(batch_items)
    ])

    prompt = f"""以下是临床医生关于【{disease}】的真实提问（本批{len(batch_items)}条，总计{total_count}条）。

{qa_text}

请对这些提问进行需求分析与分类，识别出典型需求类型并聚类，以JSON格式输出：
{{
  "clusters": [
    {{
      "topic": "需求主题（简洁描述）",
      "frequency": <该类问题估计数量>,
      "representative_questions": ["典型问题1", "典型问题2", "典型问题3"],
      "covered_in_kb": <true或false，基于问题判断知识库中是否有效覆盖>,
      "coverage_notes": "覆盖情况说明"
    }}
  ]
}}

要求：
- 聚类5-10个主要需求类型，按频次从高到低排列
- representative_questions每类取2-3个最有代表性的
- covered_in_kb根据问题本身判断，不确定时填false"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="needs_classify_batch", text_generator=generate_text
    )
    return [NeedCluster(**c) for c in data.get("clusters", [])]


async def _merge_need_clusters(disease: str, all_clusters: List[NeedCluster]) -> List[NeedCluster]:
    """Merge clusters from multiple batches using Gemini to consolidate similar topics."""
    clusters_text = "\n".join([
        f"- topic: {c.topic}\n  frequency: {c.frequency}\n  covered_in_kb: {c.covered_in_kb}\n  coverage_notes: {c.coverage_notes}\n  representative_questions: {c.representative_questions}"
        for c in all_clusters
    ])

    prompt = f"""以下是对【{disease}】用户Q&A分批聚类后得到的多组需求类型（来自不同批次，可能有重复或相似主题）。

{clusters_text}

请将相同或高度相似的需求主题合并，汇总频次，保留最有代表性的问题，以JSON格式输出最终聚类结果：
{{
  "clusters": [
    {{
      "topic": "需求主题（简洁描述）",
      "frequency": <合并后的估计总频次>,
      "representative_questions": ["典型问题1", "典型问题2", "典型问题3"],
      "covered_in_kb": <true或false>,
      "coverage_notes": "覆盖情况说明"
    }}
  ]
}}

要求：
- 合并相同/相近主题，最终输出5-12个主要需求类型
- frequency为各批次同类需求频次之和（估算）
- 按最终频次从高到低排列
- covered_in_kb：若任何批次标记为false则取false"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="needs_merge_clusters", text_generator=generate_text
    )
    return [NeedCluster(**c) for c in data.get("clusters", [])]


async def classify_user_needs(disease: str, qa_items: List[QAItem]) -> List[NeedCluster]:
    """Phase 4-1: Classify all Q&A items into need clusters."""
    if not qa_items:
        return []

    QA_BATCH = 200
    if len(qa_items) <= QA_BATCH:
        return await _classify_batch(disease, qa_items, len(qa_items))

    # Batch processing for large Q&A sets
    print(f"[classify_user_needs] Q&A 共{len(qa_items)}条，分批处理（每批{QA_BATCH}条）")
    batches = [qa_items[i:i + QA_BATCH] for i in range(0, len(qa_items), QA_BATCH)]
    all_clusters: List[NeedCluster] = []
    for idx, batch in enumerate(batches):
        print(f"[classify_user_needs] 处理第{idx+1}/{len(batches)}批（{len(batch)}条）")
        clusters = await _classify_batch(disease, batch, len(qa_items))
        all_clusters.extend(clusters)
    print(f"[classify_user_needs] 合并{len(all_clusters)}个原始聚类")
    return await _merge_need_clusters(disease, all_clusters)


async def map_needs_to_sections(
    disease: str,
    clusters: List[NeedCluster],
    sections: List[ArticleSection],
) -> List[NeedSectionMapping]:
    """Phase 4-2: Map need clusters to article sections."""
    if not clusters or not sections:
        return [
            NeedSectionMapping(section_id=s.id, section_heading=s.heading)
            for s in sections
        ]

    clusters_text = "\n".join([
        f"- {c.topic}（约{c.frequency}次，{'已覆盖' if c.covered_in_kb else '未覆盖'}）"
        for c in clusters
    ])
    sections_text = "\n".join([
        f"- section_id:{s.id} | {s.heading}"
        for s in sections
    ])

    prompt = f"""以下是【{disease}】知识库词条的章节结构和用户需求聚类。

## 章节结构
{sections_text}

## 用户需求聚类
{clusters_text}

请判断每个章节与哪些需求类型最相关，以JSON格式输出：
{{
  "mappings": [
    {{
      "section_id": "章节ID（原样复制）",
      "section_heading": "章节标题",
      "cluster_topics": ["需求主题1", "需求主题2"],
      "relevance": "high"
    }}
  ]
}}

relevance取值：
- high：该章节是满足这些需求的核心章节
- medium：有一定相关性
- low：相关性较弱，或该章节无对应需求

每个章节必须出现在mappings中（即使cluster_topics为空也要包含）。"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="needs_map_to_sections", text_generator=generate_text
    )

    results = []
    for m in data.get("mappings", []):
        results.append(NeedSectionMapping(
            section_id=m.get("section_id", ""),
            section_heading=m.get("section_heading", ""),
            cluster_topics=m.get("cluster_topics", []),
            relevance=m.get("relevance", "medium"),
        ))

    # Ensure all sections are represented
    mapped_ids = {r.section_id for r in results}
    for s in sections:
        if s.id not in mapped_ids:
            results.append(NeedSectionMapping(section_id=s.id, section_heading=s.heading))

    return results


def _build_cross_section_block(
    section: ArticleSection,
    mapped_clusters: List[NeedCluster],
    all_mappings: Optional[List[NeedSectionMapping]],
) -> str:
    """Build the cross-section hint block for the needs gap prompt."""
    if not all_mappings:
        return ""
    cross_section_lines = []
    for c in mapped_clusters:
        sibling_headings = [
            m.section_heading for m in all_mappings
            if c.topic in m.cluster_topics and m.section_id != section.id
        ]
        if sibling_headings:
            cross_section_lines.append(
                f"- 「{c.topic}」同时映射到其他章节：{'、'.join(sibling_headings)}"
            )
    if not cross_section_lines:
        return ""
    return (
        f"\n\n## ⚠️ 跨章节需求提示（重要）\n"
        f"以下需求类型同时映射到了多个章节，请在给出修订建议时，仅聚焦「{section.heading}」章节负责的具体内容，"
        f"不要提出属于其他章节职责范围的建议（其他章节会单独处理各自部分）：\n"
        + "\n".join(cross_section_lines)
        + f"\n\n请针对本章节（{section.heading}）给出章节专属的、差异化的修订建议，"
        f"说明本章节在满足该用户需求方面应重点补充或完善什么。"
    )


async def _analyze_needs_gap_single(
    disease: str,
    section: ArticleSection,
    mapped_clusters: List[NeedCluster],
    all_mappings: Optional[List[NeedSectionMapping]],
    chunk_idx: int = 0,
    total_chunks: int = 1,
) -> SectionNeedsGap:
    """Single Gemini call for needs gap analysis of one section (or one chunk)."""
    cross_section_block = _build_cross_section_block(section, mapped_clusters, all_mappings)
    clusters_text = "\n".join([
        f"- 需求主题：{c.topic}（约{c.frequency}次提问）\n  代表性问题：{'、'.join(c.representative_questions[:2])}"
        for c in mapped_clusters
    ])

    chunk_note = f"（注：以下为该章节第{chunk_idx}/{total_chunks}段内容）\n" if chunk_idx > 0 else ""

    prompt = f"""请分析【{disease}】词条「{section.heading}」章节对以下用户需求的覆盖情况。

## 章节内容
{chunk_note}{section.content[:SECTION_PROMPT_MAX_CHARS]}

## 需要评估的用户需求（共{len(mapped_clusters)}类）
{clusters_text}
{cross_section_block}
请对每类用户需求，评估该章节内容的满足程度，以JSON格式输出：
{{
  "coverage_assessment": "对本章节整体覆盖情况的简评（1-2句话）",
  "need_coverages": [
    {{
      "topic": "需求主题（与上方完全一致）",
      "coverage_level": "full",
      "qa_frequency": 50,
      "representative_questions": ["代表性问题1", "代表性问题2"],
      "revision_suggestion": ""
    }}
  ]
}}

coverage_level取值规则：
- "full"：章节已有完整内容，能清晰回答该类需求，用户无需查找其他内容
- "partial"：有相关内容但不够完整，部分问题仍无法得到充分回答
- "missing"：章节基本未涉及该类需求，用户无法从中获得有效信息

revision_suggestion填写规则：
- coverage_level为"full"时，留空 ""
- coverage_level为"partial"时：指出现有内容哪里不足，具体说明需要补充或完善什么
- coverage_level为"missing"时：说明需要新增哪些内容来覆盖该需求

representative_questions：从该需求中选取1-2个最典型的实际问题
"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="section_needs_gap", text_generator=generate_text
    )

    need_coverages: List[NeedCoverage] = []
    for item in data.get("need_coverages", []):
        if not isinstance(item, dict):
            continue
        need_coverages.append(NeedCoverage(
            topic=item.get("topic", ""),
            coverage_level=item.get("coverage_level", "partial"),
            qa_frequency=int(item.get("qa_frequency", 0)),
            representative_questions=item.get("representative_questions", []),
            revision_suggestion=item.get("revision_suggestion", ""),
        ))

    return SectionNeedsGap(
        section_id=section.id,
        section_heading=section.heading,
        need_coverages=need_coverages,
        gap_items=[],
        coverage_assessment=data.get("coverage_assessment", ""),
    )


def _merge_need_coverages(all_coverages: List[NeedCoverage]) -> List[NeedCoverage]:
    """Merge NeedCoverage items across chunks: worst coverage_level wins, suggestions merged."""
    _level_rank = {"missing": 0, "partial": 1, "full": 2}
    grouped: dict = {}
    for nc in all_coverages:
        topic = nc.topic
        if topic not in grouped:
            grouped[topic] = nc
            continue
        existing = grouped[topic]
        # Take worse coverage level
        if _level_rank.get(nc.coverage_level, 1) < _level_rank.get(existing.coverage_level, 1):
            existing = NeedCoverage(
                topic=existing.topic,
                coverage_level=nc.coverage_level,
                qa_frequency=existing.qa_frequency,
                representative_questions=existing.representative_questions,
                revision_suggestion=existing.revision_suggestion,
            )
        # Merge revision_suggestion
        suggestions = [s for s in [existing.revision_suggestion, nc.revision_suggestion] if s]
        merged_suggestion = "；".join(dict.fromkeys(suggestions))
        # Max qa_frequency
        max_freq = max(existing.qa_frequency, nc.qa_frequency)
        # Merge representative_questions (deduplicate, keep first 3)
        seen_qs: dict = {}
        for q in existing.representative_questions + nc.representative_questions:
            seen_qs[q] = None
        merged_qs = list(seen_qs.keys())[:3]
        grouped[topic] = NeedCoverage(
            topic=existing.topic,
            coverage_level=existing.coverage_level,
            qa_frequency=max_freq,
            representative_questions=merged_qs,
            revision_suggestion=merged_suggestion,
        )
    return list(grouped.values())


def _derive_gap_items(section: ArticleSection, need_coverages: List[NeedCoverage]) -> List[GapItem]:
    """Derive GapItem list from NeedCoverage results for downstream planning."""
    gap_items: List[GapItem] = []
    for nc in need_coverages:
        if nc.coverage_level == "full":
            continue
        gap_items.append(GapItem(
            priority="P0" if nc.coverage_level == "missing" else "P1",
            section=section.heading,
            description=nc.revision_suggestion or f"补充「{nc.topic}」相关内容",
            source="user_needs",
            qa_frequency=nc.qa_frequency,
        ))
    return gap_items


async def analyze_section_needs_gap(
    disease: str,
    section: ArticleSection,
    section_analysis: Optional[SectionAnalysis],
    mapped_clusters: List[NeedCluster],
    all_mappings: Optional[List[NeedSectionMapping]] = None,
) -> SectionNeedsGap:
    """Phase 4-3: For one section, rate coverage of each mapped need cluster."""
    if not mapped_clusters:
        return SectionNeedsGap(
            section_id=section.id,
            section_heading=section.heading,
        )

    # Chunking path for very long sections
    if len(section.content) > CHUNK_THRESHOLD:
        print(f"[analyze_section_needs_gap] 章节「{section.heading}」内容超过{CHUNK_THRESHOLD}字符（{len(section.content)}），启用分块分析")
        chunks = _split_into_chunks(section.content, CHUNK_SIZE, CHUNK_OVERLAP)
        print(f"[analyze_section_needs_gap] 共拆分为{len(chunks)}块")
        all_coverages: List[NeedCoverage] = []
        for i, chunk in enumerate(chunks):
            chunk_section = ArticleSection(
                id=section.id, heading=section.heading,
                content=chunk, level=section.level,
                word_count=len(chunk),
            )
            partial = await _analyze_needs_gap_single(
                disease, chunk_section, mapped_clusters, all_mappings,
                chunk_idx=i + 1, total_chunks=len(chunks),
            )
            print(f"[analyze_section_needs_gap] 第{i+1}/{len(chunks)}块完成，{len(partial.need_coverages)}项覆盖评估")
            all_coverages.extend(partial.need_coverages)
        merged_coverages = _merge_need_coverages(all_coverages)
        gap_items = _derive_gap_items(section, merged_coverages)
        return SectionNeedsGap(
            section_id=section.id,
            section_heading=section.heading,
            need_coverages=merged_coverages,
            gap_items=gap_items,
            coverage_assessment="（分块分析，已合并各段结果）",
        )

    # Normal path (≤ CHUNK_THRESHOLD)
    result = await _analyze_needs_gap_single(
        disease, section, mapped_clusters, all_mappings,
    )
    gap_items = _derive_gap_items(section, result.need_coverages)
    return SectionNeedsGap(
        section_id=section.id,
        section_heading=section.heading,
        need_coverages=result.need_coverages,
        gap_items=gap_items,
        coverage_assessment=result.coverage_assessment,
    )


async def suggest_unmapped_placements(
    disease: str,
    unmapped_clusters: List[NeedCluster],
    sections: List[ArticleSection],
) -> dict:
    """For clusters not mapped to any existing section, generate placement suggestions."""
    if not unmapped_clusters:
        return {}

    section_outline = "\n".join([f"{'  ' * (s.level - 1)}- {s.heading}" for s in sections])
    clusters_text = "\n".join([
        f"- 需求主题：{c.topic}（约{c.frequency}次提问）\n  代表性问题：{'、'.join(c.representative_questions[:2])}"
        for c in unmapped_clusters
    ])

    prompt = f"""以下是【{disease}】词条当前章节结构，以及一批用户高频提问的需求主题，这些需求主题目前在词条中没有找到对应的章节内容。

## 当前词条章节大纲
{section_outline}

## 未覆盖的用户需求
{clusters_text}

请对每类未覆盖的需求，基于词条现有结构，给出具体的内容补充建议。建议须明确说明：
1. 是否建议新增独立章节（若是，说明建议标题和在大纲中的位置）
2. 或在现有某个章节中补充（若是，说明在哪个章节的哪个位置，以及具体要补充的内容方向）

以JSON格式输出：
{{
  "placements": [
    {{
      "topic": "需求主题（与上方完全一致）",
      "placement_suggestion": "具体修订建议，说明在哪里添加什么内容"
    }}
  ]
}}

要求：
- 建议须具体可操作，不超过150字
- 优先考虑融入现有章节（结构改动小）；若内容独立性强且体量较大，再建议新增章节
- 若建议新增章节，说明插入位置（例如：建议在「诊断」与「治疗」之间新增「XXX」章节）"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="needs_gap_placement", text_generator=generate_text
    )

    result = {}
    for item in data.get("placements", []):
        if isinstance(item, dict) and item.get("topic"):
            result[item["topic"]] = item.get("placement_suggestion", "")
    return result


async def analyze_gap(
    disease: str,
    qa_items: List[QAItem],
    section_analyses: List[SectionAnalysis],
    parsed_article: ParsedArticle,
) -> GapAnalysis:
    """Single Gemini call: cluster user needs and identify unmet gaps."""
    qa_text = "\n".join([
        f"Q{i+1}: {item.question}" + (f"\nA: {item.answer[:200]}" if item.answer else "")
        for i, item in enumerate(qa_items[:300])
    ]) if qa_items else "（未提供Q&A数据）"

    issues_summary = ""
    for sa in section_analyses:
        active = [i for i in sa.issues if i.status != "rejected"]
        if active:
            issues_summary += f"\n【{sa.section_heading}】\n"
            for issue in active:
                issues_summary += f"  - [{issue.severity}] {issue.description}\n"

    prompt = f"""基于以下【{disease}】词条的章节质量分析和用户Q&A数据，识别需求差距。

## 章节质量分析摘要
{issues_summary if issues_summary else "（无发现问题）"}

## 用户Q&A数据（共{len(qa_items)}条）
{qa_text}

请以JSON格式输出需求差距分析：
{{
  "total_qa_count": {len(qa_items)},
  "clusters": [
    {{
      "topic": "需求主题",
      "frequency": 50,
      "representative_questions": ["典型问题1", "典型问题2"],
      "covered_in_kb": false,
      "coverage_notes": "说明"
    }}
  ],
  "unmet_needs": [
    {{
      "priority": "P0",
      "section": "相关章节名",
      "description": "具体差距描述和改进方向",
      "source": "user_needs",
      "qa_frequency": 80
    }}
  ],
  "optimization_suggestions": ["优化建议1", "优化建议2"]
}}

优先级规则：
- P0: 高频需求(>100次)未覆盖，或内容高优先问题
- P1: 中频需求(50-100次)，或内容中优先问题
- P2: 低频需求或内容低优先改进

source取值: "quality_eval"/"user_needs"/"both"
clusters聚类5-10个主要需求类型，按频次降序。"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="legacy_full_analysis", text_generator=generate_text
    )

    clusters = [NeedCluster(**c) for c in data.get("clusters", [])]
    unmet = [GapItem(**g) for g in data.get("unmet_needs", [])]

    return GapAnalysis(
        clusters=clusters,
        total_qa_count=data.get("total_qa_count", len(qa_items)),
        unmet_needs=unmet,
        optimization_suggestions=data.get("optimization_suggestions", []),
    )


async def generate_plan_from_gap(
    disease: str,
    section_analyses: List[SectionAnalysis],
    gap_analysis: GapAnalysis,
    parsed_article=None,
) -> List[GapItem]:
    """Generate structured iteration plan following article section order."""

    # 1. Article structure — used both as display context and for section naming rules
    structure_lines = []
    if parsed_article:
        for s in parsed_article.sections:
            indent = "  " * (s.level - 1)
            prefix = "#" * s.level
            structure_lines.append(f"{indent}{prefix} {s.heading}")
    structure_text = "\n".join(structure_lines) if structure_lines else "（未提供结构信息）"

    # 2. Quality issues per section (user-confirmed only)
    issues_text = ""
    for sa in section_analyses:
        active = [i for i in sa.issues if i.status in ("confirmed", "added")]
        if active:
            issues_text += f"\n【{sa.section_heading}】\n"
            for issue in active:
                sev = {"high": "高优", "medium": "中优", "low": "低优"}.get(issue.severity, issue.severity)
                mark = "【用户补充】" if issue.status == "added" else "【用户确认】"
                key_note = "（重点内容）" if issue.is_key_content else ""
                issues_text += f"  - {mark}[{sev}]{key_note} {issue.description}\n"

    # 3. Need coverage gaps per section (user-confirmed only)
    needs_text = ""
    for sg in gap_analysis.section_gaps:
        active_needs = [
            nc for nc in (sg.need_coverages or [])
            if nc.coverage_level != "full" and nc.status == "confirmed"
        ]
        if active_needs:
            needs_text += f"\n【{sg.section_heading}】\n"
            for nc in active_needs:
                coverage_label = "内容缺失" if nc.coverage_level == "missing" else "需完善"
                freq_note = f"（用户提问约{nc.qa_frequency}次）" if nc.qa_frequency else ""
                suggestion = f" → {nc.revision_suggestion}" if nc.revision_suggestion else ""
                needs_text += f"  - 【用户确认】[{coverage_label}] {nc.topic}{freq_note}{suggestion}\n"

    if not issues_text and not needs_text:
        return []

    prompt = f"""基于以下【{disease}】词条经过审核的质量问题和用户需求差距，生成按章节结构组织的内容迭代计划。

## 词条实际章节结构（请严格按此顺序和命名输出迭代任务）
{structure_text}

## 各章节质量问题（仅包含用户确认/补充的条目）
{issues_text if issues_text else "（无用户确认的质量问题）"}

## 各章节用户需求差距（仅包含用户确认的条目）
{needs_text if needs_text else "（无用户确认的需求问题）"}

## 章节粒度规则（决定迭代任务的section字段精度）
- 「基础知识」「预后」「预防」等篇幅较小的章节：section直接使用1级标题（如 "基础知识"）
- 「鉴别诊断」：问题简单时使用"鉴别诊断"，有多个鉴别对象且问题复杂时细分到2级（如 "鉴别诊断 > 与X疾病的鉴别"）
- 「诊断」「治疗」等有复杂子目录的章节：优先细化到2级或3级子章节（如 "诊断 > 实验室检查"、"治疗 > 药物治疗"），避免笼统地写"诊断"或"治疗"
- section命名必须与上方实际章节结构中的标题一致，使用 " > " 连接层级（如 "治疗 > 药物治疗 > 一线方案"）

## 优先级规则
- P0：用户确认的高优问题、内容错误、重点内容缺失、高频未覆盖需求（>100次）
- P1：用户确认的中优问题、内容陈旧、结构问题、中频需求（50-100次）
- P2：用户确认的低优问题、非重点内容完善、精炼优化、低频需求

## description字段撰写要求（关键）
description必须足够详细具体，使后续生成稿件的AI能直接依据它输出高质量修订内容。每条description需包含：
1. 【现状】当前该子章节存在什么具体问题（缺少哪些内容、哪些内容有误或陈旧）
2. 【目标】需要补充或修改成什么（具体知识点、数据类型、临床标准、用药方案等）
3. 【依据】基于哪些质量问题或用户需求（可引用频次、问题严重性）
4. 【修订要点】建议的具体修改方式（如"在现有X内容后补充Y"、"将Z段落中的A替换为B"）

示例description格式（请参考此详细程度）：
"当前【实验室检查】部分仅列出血常规、尿常规等基础检查，缺少特异性诊断指标（用户频繁提问约85次，审核标记高优）。需补充：①特异性血清学标志物（如抗X抗体、Y蛋白）的检测意义及正常参考值；②各项指标的诊断阈值及临床解读方法；③不同病程阶段检查项目的选择时机。建议在现有检查项目列表后新增'特异性指标'子段落，格式与现有内容保持一致。"

请以JSON格式输出，任务顺序须与词条章节顺序一致：
{{
  "gap_items": [
    {{
      "priority": "P0",
      "section": "诊断 > 实验室检查",
      "description": "详细的修订说明（含现状、目标、依据、修订要点）",
      "source": "quality_eval",
      "qa_frequency": 0
    }}
  ]
}}

source取值：quality_eval（来自质量审评）/user_needs（来自用户需求）/both（两者均有）
source字段必须准确区分任务来源：只来自质量问题填quality_eval，只来自用户需求填user_needs，同时依据两类输入填both。
注意：只允许基于上方列出的用户确认/补充条目生成任务；AI识别但未确认的条目不得纳入计划。同一子章节的多个问题可合并为一条；按章节顺序输出。"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="plan_from_gap", text_generator=generate_text
    )

    # Preserve article-section order as returned by the AI (do not re-sort by priority)
    gap_items = [GapItem(**g) for g in data.get("gap_items", [])]
    return gap_items


async def generate_iteration_plan(
    disease: str,
    quality_report: QualityReport,
    needs_analysis: NeedsAnalysis
) -> IterationPlan:
    qr = quality_report

    def dim_summary(title: str, score: int, subcats: dict, comment: str) -> str:
        lines = [f"{title}（{score}/5分）："]
        for label, items in subcats.items():
            active = [i for i in items if i.status != "rejected"]
            if not active:
                continue  # 跳过无问题的分类
            lines.append(f"  [{label}]")
            lines.append(_fmt_issues(items, "    "))
        if len(lines) == 1:
            lines.append("  （无问题）")
        if comment:
            lines.append(f"  审核总意见：{comment}")
        return "\n".join(lines)

    quality_summary = "\n".join([
        dim_summary("维度一 内容全面", qr.dim_one.score, {
            "重点内容缺失": qr.dim_one.key_missing,
            "非重点内容缺失": qr.dim_one.nonkey_missing,
            "数据源缺失": qr.dim_one.source_missing,
        }, qr.dim_one.reviewer_comment),

        dim_summary("维度二 结构合理", qr.dim_two.score, {
            "临床思维问题": qr.dim_two.clinical_thinking,
            "整合逻辑问题": qr.dim_two.integration_logic,
        }, qr.dim_two.reviewer_comment),

        dim_summary("维度三 内容准确", qr.dim_three.score, {
            "内容错误": qr.dim_three.errors,
            "内容陈旧": qr.dim_three.outdated,
            "内容不合理": qr.dim_three.unreasonable,
        }, qr.dim_three.reviewer_comment),

        dim_summary("维度四 内容精炼流畅", qr.dim_four.score, {
            "重复冗余": qr.dim_four.redundancy,
            "格式问题": qr.dim_four.format_issues,
            "语言问题": qr.dim_four.language_issues,
        }, qr.dim_four.reviewer_comment),
    ])

    if qr.reviewer_comment:
        quality_summary += f"\n\n专家总体审核意见：{qr.reviewer_comment}"

    needs_summary = ""
    for c in needs_analysis.clusters:
        covered = "已覆盖" if c.covered_in_kb else "未覆盖"
        needs_summary += f"- {c.topic}（约{c.frequency}次，{covered}）\n"

    prompt = f"""基于以下【{disease}】经专家审核的质量评估报告和用户需求分析，生成内容迭代优先级计划。

## 专家审核后的质量评估
{quality_summary}

## 用户需求分析（来自真实Q&A）
{needs_summary if needs_summary else "（未提供Q&A数据）"}

请以JSON格式输出迭代优先级计划，每条gap_item对应一个具体的改进任务：
{{
  "gap_items": [
    {{
      "priority": "P0",
      "section": "受影响的章节名称",
      "description": "具体需要补充/修改/重构的内容描述，包含改进方向",
      "source": "both",
      "qa_frequency": 987
    }}
  ]
}}

优先级规则：
- P0：高优先问题（内容错误、重点内容缺失、用户高频需求>100次且未覆盖）
- P1：中优先问题（内容陈旧、结构不合理、中频需求50-100次、或内容不合理影响理解）
- P2：低优先改进（非重点内容补充、精炼流畅类问题、低频需求）

source字段值："quality_eval"（仅来自质量评估）、"user_needs"（仅来自用户需求）、"both"（两者都有）
qa_frequency字段：若来自用户需求则填入频次，否则省略。

注意：被专家标记为rejected的问题已从评估中移除，不需要纳入计划。专家补充或确认的问题应优先考虑。"""

    data = await generate_json(
        prompt, SYSTEM_PROMPT, context="legacy_iteration_plan", text_generator=generate_text
    )

    gap_items = [GapItem(**g) for g in data.get("gap_items", [])]
    gap_items.sort(key=lambda x: {"P0": 0, "P1": 1, "P2": 2}.get(x.priority, 3))

    return IterationPlan(
        disease=disease,
        quality_report=quality_report,
        needs_analysis=needs_analysis,
        gap_items=gap_items
    )
