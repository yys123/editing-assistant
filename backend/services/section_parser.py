import os
import re
import hashlib
from typing import List, Optional
from models import ArticleSection, ParsedArticle
from services.text_llm import generate_json, generate_text

# ── Load content framework spec at module init ─────────────────────────────────
_FRAMEWORK_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "content_framework.md")
try:
    with open(_FRAMEWORK_PATH, encoding="utf-8") as _f:
        CONTENT_FRAMEWORK = _f.read()
except FileNotFoundError:
    CONTENT_FRAMEWORK = ""

_SYSTEM_PROMPT = (
    "你是一位资深临床医学编辑，熟悉知识库词条的标准内容框架。"
    "请严格按照要求的JSON格式输出，不要输出任何其他内容。"
    "【绝对禁止】将中文词语替换为英文：「和」不得改为「and」，「或」不得改为「or」，"
    "「包括」不得改为「include」——所有中文内容必须原样输出，严禁翻译或替换任何词语。"
)

# Headings that mark editorial summary sections (not subject to quality review)
_SUMMARY_HEADINGS = frozenset({"更新要点", "诊断要点", "治疗要点"})

# Top-level content framework field headings (7 canonical fields).
# NOTE: 概述 intentionally excluded — it can also appear as a sub-section
#       inside 基础知识, making blanket promotion unsafe.
_LEVEL1_HEADINGS = frozenset({
    "基础知识", "诊断", "鉴别诊断", "治疗", "控制目标", "预后", "预防",
})


def _is_summary_section(heading: str) -> bool:
    return any(kw in heading for kw in _SUMMARY_HEADINGS)


# ── CJK-English replacement fix patterns ─────────────────────────────────────
# Gemini sometimes replaces Chinese connectives with English equivalents.
# Each tuple: (compiled regex, replacement template)

_CJK = r'[\u4e00-\u9fff\uff00-\uffef]'

_CJK_EN_FIXES: List[tuple] = [
    # 和 → and
    (re.compile(rf'({_CJK})\s+and\s+({_CJK})', re.I), r'\1和\2'),
    # 或 → or
    (re.compile(rf'({_CJK})\s+or\s+({_CJK})', re.I), r'\1或\2'),
    # 包括 → include/includes/including
    (re.compile(rf'({_CJK})\s+includes?\s+({_CJK})', re.I), r'\1包括\2'),
    (re.compile(rf'({_CJK})\s+including\s+({_CJK})', re.I), r'\1包括\2'),
    # 但/但是 → but
    (re.compile(rf'({_CJK})\s+but\s+({_CJK})', re.I), r'\1但\2'),
    # 如 → such as
    (re.compile(rf'({_CJK})\s+such\s+as\s+({_CJK})', re.I), r'\1如\2'),
    # 等 → etc / etc.
    (re.compile(rf'({_CJK})\s+etc\.?\s*({_CJK})', re.I), r'\1等\2'),
    # 即 → i.e.
    (re.compile(rf'({_CJK})\s+i\.?e\.?\s+({_CJK})', re.I), r'\1即\2'),
]


def _fix_cjk_en_replacements(text: str) -> str:
    """Fix Gemini's erroneous CJK→English connective replacements."""
    for pattern, repl in _CJK_EN_FIXES:
        text = pattern.sub(repl, text)
    return text


# Keep backward-compatible alias
_fix_cjk_and_replacement = _fix_cjk_en_replacements


_ARABIC_NUMBERED_HEADING_RE = re.compile(r"^\d+[、.．]\s*\S+")
_MEDIA_MARKER_RE = re.compile(r"^\[(?:图片|图片内容|图注)\]")
_FIGURE_TABLE_CAPTION_RE = re.compile(r"^(?:图|表)\s*\d+\s*\S*")
_ROMAN_CAPTION_NOTE_RE = re.compile(r"^[ivxlcdm]+\.\s+\S+", re.I)


def _is_media_or_caption_line(text: str) -> bool:
    stripped = text.strip()
    return bool(
        _MEDIA_MARKER_RE.match(stripped)
        or _FIGURE_TABLE_CAPTION_RE.match(stripped)
        or _ROMAN_CAPTION_NOTE_RE.match(stripped)
    )


def _split_caption_trailing_numbered_heading(text: str) -> str:
    lines = text.split("\n")
    normalized: List[str] = []

    for line in lines:
        stripped = line.strip()
        match = re.match(r"^((?:图|表)\s*\d+[^\n]*?\]?)\s*(\d+[、.．]\s*\S.*)$", stripped)
        if match:
            normalized.append(match.group(1).strip())
            normalized.append(f"[H3] {match.group(2).strip()}")
            continue
        normalized.append(line)

    return "\n".join(normalized)


def _split_inline_trailing_numbered_heading(text: str) -> str:
    lines = text.split("\n")
    normalized: List[str] = []

    for line in lines:
        stripped = line.strip()
        match = re.match(r"^(.+[。；;：:])\s+(\d+[、.．]\s*\S.*)$", stripped)
        if match and len(match.group(2).strip()) <= 36:
            prefix = line[: len(line) - len(line.lstrip())]
            normalized.append(f"{prefix}{match.group(1).strip()}")
            normalized.append(f"[H3] {match.group(2).strip()}")
            continue
        normalized.append(line)

    return "\n".join(normalized)


def _promote_numbered_headings_after_media(text: str) -> str:
    lines = text.split("\n")
    promoted: List[str] = []
    prev_nonempty = ""

    for line in lines:
        stripped = line.strip()
        if (
            stripped
            and not stripped.startswith("[H")
            and _is_media_or_caption_line(prev_nonempty)
            and _ARABIC_NUMBERED_HEADING_RE.match(stripped)
        ):
            line = f"[H3] {stripped}"
            stripped = line

        promoted.append(line)
        if stripped:
            prev_nonempty = stripped

    return "\n".join(promoted)


def _normalize_structured_markers(text: str) -> str:
    """Ensure [H1]/[H2]/[H3] markers always start on their own line.

    Some upstream structured text contains inline markers like:
    "...正文。 [H2] 二、 标题"
    which would otherwise be treated as body content instead of a new section.
    """
    normalized = re.sub(r'(?<!\n)\s*(\[H[123]\]\s*)', r'\n\1', text)
    normalized = _split_caption_trailing_numbered_heading(normalized)
    normalized = _split_inline_trailing_numbered_heading(normalized)
    return _promote_numbered_headings_after_media(normalized)


def _fix_section_levels(sections: List[ArticleSection]) -> List[ArticleSection]:
    """Post-parse normalization: correct known-wrong level assignments.

    Context-aware rules:
    1. _LEVEL1_HEADINGS: force level=1 ONLY when the section is NOT nested
       inside a same-named level=1 parent (avoids misidentifying sub-sections
       like a "诊断" step under the "诊断" field as a new top-level field).
    2. _SUMMARY_HEADINGS (更新要点/诊断要点/治疗要点): always level=2.
    3. All others: keep as-is.
    """
    last_level1_heading: str = ""
    for s in sections:
        if s.heading in _LEVEL1_HEADINGS:
            if s.level != 1 and last_level1_heading != s.heading:
                # Misidentified top-level field — correct it
                s.level = 1
            if s.level == 1:
                last_level1_heading = s.heading
        elif _is_summary_section(s.heading):
            s.level = 2
    return sections


def _assign_stable_section_ids(sections: List[ArticleSection]) -> List[ArticleSection]:
    """Assign deterministic IDs so re-parsing can preserve downstream state."""
    counters = [0, 0, 0]

    for section in sections:
        level = max(1, min(3, section.level))
        if level == 1:
            counters[0] += 1
            counters[1] = 0
            counters[2] = 0
        elif level == 2:
            if counters[0] == 0:
                counters[0] = 1
            counters[1] += 1
            counters[2] = 0
        else:
            if counters[0] == 0:
                counters[0] = 1
            counters[2] += 1

        path = ".".join(str(n) for n in counters[:level] if n > 0)
        normalized_heading = re.sub(r"\s+", "", section.heading).strip()
        raw = f"{level}|{path}|{normalized_heading}"
        section.id = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:8]

    return sections


# ── Word-count helper ──────────────────────────────────────────────────────────

def count_chinese_words(text: str) -> int:
    """Count words/chars in a Word-like way for Chinese medical text.

    Rules:
    - CJK characters and punctuation are counted individually.
    - ASCII letter/digit runs are counted as one word (e.g. "ADHD" = 1, "10" = 1).
    - Structural markers ([H1], [图片], [表格] …) are excluded from count.
    - Reference superscript markers and Markdown table separators are excluded.
    - Whitespace is not counted.
    """
    # Remove structural markers injected by parse_html_structured
    clean = re.sub(r"\[H\d\]|\[图片\]|\[表格\]|\[图注\]|\[表格标题\]|\[图片内容\]", "", text)
    # Remove reference superscript markers, e.g. [2,3] [1-5], plus legacy ^[N].
    clean = re.sub(r"\^?\[\d[\d,，\-~～至–—]*\]", "", clean)
    # Remove bracketed citation markers copied from rich text, e.g. [¹³⁻¹⁴], [8]
    clean = re.sub(r"[［\[][⁰¹²³⁴⁵⁶⁷⁸⁹⁻,，\-~～至]+[］\]]", "", clean)
    clean = re.sub(r"[［\[]\d[\d,，\-~～至]*[］\]]", "", clean)
    # Remove Markdown table separators
    clean = re.sub(r"\|[-|: ]+\|", "", clean)
    # Remove pipe chars from table rows (but keep the cell content)
    clean = clean.replace("|", " ")

    count = 0
    index = 0
    while index < len(clean):
        char = clean[index]
        if char.isspace():
            index += 1
            continue
        if re.match(r"[A-Za-z0-9]", char):
            index += 1
            while index < len(clean) and re.match(r"[A-Za-z0-9]", clean[index]):
                index += 1
            count += 1
            continue
        count += 1
        index += 1
    return count


def _count_section_words(heading: str, content: str) -> int:
    return count_chinese_words(heading) + count_chinese_words(content)


# ── Post-parse validation & repair ────────────────────────────────────────────

import logging as _logging

_log = _logging.getLogger(__name__)


def _build_section_content_map(structured_text: str) -> dict:
    """Parse structured text ([H1]/[H2]/[H3] markers) into {heading: [content]}
    for validation.  Duplicate headings are stored as a list.
    """
    sections: dict = {}  # heading -> [content, ...]
    current_heading: Optional[str] = None
    current_lines: List[str] = []

    def flush():
        if current_heading is None:
            return
        content = "\n".join(current_lines).strip()
        sections.setdefault(current_heading, []).append(content)

    for line in structured_text.split("\n"):
        m = re.match(r"^\[H(\d)\]\s*(.+)$", line)
        if m:
            flush()
            current_heading = m.group(2).strip()
            current_lines = []
        else:
            current_lines.append(line)
    flush()
    return sections


def _count_cjk(text: str) -> int:
    """Count CJK characters only (fast, for validation)."""
    return len(re.findall(r'[\u4e00-\u9fff]', text))


def _extract_refs(text: str) -> List[str]:
    """Extract all [N] reference markers, including legacy ^[N] markers."""
    return re.findall(r'\^?\[\d+(?:[,，\-~～至–—\d]*)\]', text)


def _count_table_rows(text: str) -> int:
    """Count Markdown table rows (lines starting with |)."""
    return sum(1 for line in text.split("\n")
               if line.strip().startswith("|") and "|" in line[1:])


def _validate_and_repair(
    sections: List[ArticleSection],
    original_text: str,
) -> List[ArticleSection]:
    """Post-parse validation: detect and auto-repair AI-induced content issues.

    Checks performed on each section:
      1. CJK→English connective replacements (auto-fixed)
      2. Content loss — if >5% CJK characters lost, restore from original
      3. Reference marker loss — if refs dropped, restore from original
      4. Markdown table row loss — if table rows dropped, restore from original

    Parameters
    ----------
    sections : AI-parsed sections (already level-fixed).
    original_text : the structured text fed to the AI (with [H] markers).

    Returns
    -------
    The repaired section list (mutated in place and returned).
    """
    if not re.search(r"^\[H[123]\]", original_text, re.MULTILINE):
        # Not structured input — skip validation (plain-text has no ground truth)
        return sections

    source_map = _build_section_content_map(original_text)
    repair_count = 0

    for section in sections:
        heading = section.heading

        # ── 1. Fix CJK→English replacements ──────────────────────────
        fixed_content = _fix_cjk_en_replacements(section.content)
        fixed_heading = _fix_cjk_en_replacements(section.heading)
        if fixed_content != section.content or fixed_heading != section.heading:
            _log.warning("Validation fix [cjk-en]: section '%s'", heading)
            section.content = fixed_content
            section.heading = fixed_heading
            repair_count += 1

        # Find matching source content for deeper validation
        source_contents = source_map.get(heading, [])
        if not source_contents:
            continue
        # Pick the source with the best CJK count match
        expected = min(
            source_contents,
            key=lambda sc: abs(_count_cjk(sc) - _count_cjk(section.content)),
        )
        if not expected:
            continue

        needs_restore = False
        reasons: List[str] = []

        # ── 2. CJK character loss check ──────────────────────────────
        expected_cjk = _count_cjk(expected)
        parsed_cjk = _count_cjk(section.content)
        if expected_cjk > 10:
            loss_pct = (expected_cjk - parsed_cjk) / expected_cjk
            if loss_pct > 0.05:
                needs_restore = True
                reasons.append(f"cjk-loss={loss_pct:.0%}")

        # ── 3. Reference marker check ────────────────────────────────
        expected_refs = set(_extract_refs(expected))
        parsed_refs = set(_extract_refs(section.content))
        missing_refs = expected_refs - parsed_refs
        if missing_refs and len(missing_refs) / max(len(expected_refs), 1) > 0.1:
            needs_restore = True
            reasons.append(f"ref-loss={len(missing_refs)}")

        # ── 4. Table row check ────────────────────────────────────────
        expected_rows = _count_table_rows(expected)
        parsed_rows = _count_table_rows(section.content)
        if expected_rows > 0 and parsed_rows < expected_rows:
            needs_restore = True
            reasons.append(f"table-loss={expected_rows - parsed_rows}rows")

        # ── Restore from source if needed ─────────────────────────────
        if needs_restore:
            _log.warning(
                "Validation restore: section '%s' reasons=[%s]",
                heading, ", ".join(reasons),
            )
            section.content = expected
            section.word_count = _count_section_words(section.heading, expected)
            section.image_count = len(re.findall(r"\[图片\]", expected))
            section.table_count = len(re.findall(r"\[表格\]|\[表格标题\]", expected))
            repair_count += 1

    if repair_count:
        _log.info("Validation repaired %d section(s)", repair_count)

    return sections


# ── Primary: AI-based parser ───────────────────────────────────────────────────

async def parse_article_sections(text: str) -> ParsedArticle:
    """Parse article content into sections using Gemini.

    Accepts two kinds of input:
    1. Structured text from parse_html_structured() — has [H1]/[H2]/[H3] markers.
    2. Plain text (Markdown headings, HTML, or raw prose).

    Falls back to regex/BS4 parsing if AI fails.
    """
    has_explicit_markers = bool(re.search(r"^\[H[123]\]", text, re.MULTILINE))
    normalized = _normalize_structured_markers(text)
    if has_explicit_markers and re.search(r"^\[H[123]\]", normalized, re.MULTILINE):
        return _parse_structured_markers(normalized)

    plain_structured = _parse_plain_numbered_sections(normalized)
    if plain_structured:
        return plain_structured

    try:
        return await _parse_with_ai(normalized)
    except Exception:
        return _parse_with_fallback(normalized)


async def _parse_with_ai(text: str) -> ParsedArticle:
    is_structured = bool(re.search(r"^\[H[123]\]", text, re.MULTILINE))

    framework_summary = _extract_framework_summary()

    if is_structured:
        prompt = _build_structured_prompt(text, framework_summary)
    else:
        prompt = _build_plain_prompt(text, framework_summary)

    data = await generate_json(
        prompt, _SYSTEM_PROMPT, context="article_parse_sections", text_generator=generate_text
    )

    sections: List[ArticleSection] = []
    for item in data.get("sections", []):
        if not isinstance(item, dict):
            continue
        heading = _fix_cjk_and_replacement(str(item.get("heading", "")).strip())
        content = _fix_cjk_and_replacement(str(item.get("content", "")).strip())
        level = int(item.get("level", 1))
        image_count = int(item.get("image_count", 0))
        table_count = int(item.get("table_count", 0))
        if not heading:
            continue
        sections.append(ArticleSection(
            heading=heading,
            content=content,
            word_count=_count_section_words(heading, content),
            level=max(1, min(3, level)),
            image_count=image_count,
            table_count=table_count,
        ))

    if not sections:
        raise ValueError("AI returned no sections")

    _fix_section_levels(sections)
    _validate_and_repair(sections, text)
    _assign_stable_section_ids(sections)
    total_words = sum(s.word_count for s in sections if not _is_summary_section(s.heading))
    return ParsedArticle(sections=sections, total_words=total_words)


def _build_structured_prompt(structured_text: str, framework_summary: str) -> str:
    return f"""你收到的词条内容已经过结构化预处理，使用了以下标记格式：
- [H1] 一级字段标题（基础知识/诊断/鉴别诊断/治疗/控制目标/预后/预防等）
- [H2] 二级子章节标题
- [H3] 三级子章节标题
- [图片] 图片说明（例如「图 1 儿童 ADHD 诊治流程」）
- [图片内容] 紧跟在 [图片] 下方，为该图的视觉内容提取文字（Gemini 视觉分析）
- [表格] 表格说明（来自 figcaption，例如「表 1 儿童 ADHD 不同年龄段表现」）
- [表格标题] 表格标题（来自 HTML <caption> 标签，含表格内嵌标题及 [N] 引用）
- Markdown 表格行（|...| 格式）
- [N] 或 [N-M] 为参考文献上标角标（如 [2,3]、[1-5]；旧数据可能为 ^[N]），是引用标注，不属于正文内容
- 其余文字为正文段落

⚠️ 内容复制要求（最高优先级）：
- content 字段必须**原文逐字复制**，严禁总结、改写、翻译或替换任何词语
- 中文词语不得替换为英文（如"和"不得改为"and"，"包括"不得改为"include"）
- **严禁纠正原文任何错误**：错别字、拼写错误、医学术语错误（如"ADHA"即使疑似有误也须原样保留，不得自行改为"ADHD"）——发现并保留这些错误正是后续审核环节的职责
- [N] 参考文献角标原样保留，不得删除或移动；旧数据中的 ^[N] 也原样保留
- **Markdown 表格须完整保留**：原文中的 `| col | col |` 表格行及其分隔行 `|---|---|` 须**原封不动**复制到 content 中，不得重新排列、合并、删减任何行或列

## 词条内容框架（参考标准）

{framework_summary}

---

## 待解析的词条内容

{structured_text}

---

## 解析规则

1. 一级字段（基础知识/诊断/鉴别诊断/治疗/控制目标/预后/预防）→ level=1
2. 框架中一级字段的子级 → level=2
3. 更细的子项 → level=3
4. [H1] 标题行 → level=1 章节，直接输出（不跳过）
5. 若词条开头有无标题的引言段落，作为「概述」章节，level=1
6. content 字段：**原文逐字复制**该章节直属的正文内容（不含子章节内容）；保留 [图片]、[表格]、[表格标题]、[图片内容] 标记及 [N] 角标，不得修改、删除或翻译任何词语
7. image_count：该章节 content 中 [图片] 标记的数量
8. table_count：该章节 content 中 [表格] 或 [表格标题] 标记的数量（二者均计入）
9. 忽略纯导航性文字（「点击查看」「跳转至」等）
10. 治疗字段的子级标题应为具体治疗类型（如"药物治疗""手术治疗"），不能以"治疗"作为子级标题
11. 参考文献及其后内容不作为章节输出
12. 「更新要点」「诊断要点」「治疗要点」是编辑摘要章节，level=2，作为独立章节正常输出（不嵌套、不合并、不跳过）

请以 JSON 格式输出：
{{
  "sections": [
    {{
      "heading": "章节标题",
      "content": "该标题直属的正文内容",
      "level": 1,
      "image_count": 0,
      "table_count": 0
    }}
  ]
}}

按原文顺序输出所有章节，包含所有层级。"""


def _build_plain_prompt(text: str, framework_summary: str) -> str:
    return f"""请根据以下「知识库词条内容框架要求」，对提供的词条内容进行章节结构解析。

## 词条内容框架要求（参考标准）

{framework_summary}

---

## 待解析的词条内容

{text}

---

⚠️ 内容复制要求（最高优先级）：
- content 字段必须**原文逐字复制**，严禁总结、改写、翻译或替换任何词语
- 中文词语不得替换为英文（如"和"不得改为"and"，"包括"不得改为"include"）
- **严禁纠正原文任何错误**：错别字、拼写错误、医学术语错误（如"ADHA"即使疑似有误也须原样保留，不得自行改为"ADHD"）——发现并保留这些错误正是后续审核环节的职责
- [N] 参考文献角标原样保留，不得删除或移动；旧数据中的 ^[N] 也原样保留
- **Markdown 表格须完整保留**：原文中的 `| col | col |` 表格行及其分隔行 `|---|---|` 须**原封不动**复制到 content 中，不得重新排列、合并、删减任何行或列

## 解析规则

1. 参照框架要求中的「字段」和「子级内容」识别章节层级：
   一级字段（基础知识/诊断/鉴别诊断/治疗/控制目标/预后/预防）→ level=1，其下子级 → level=2，更细子项 → level=3
2. 如果词条标题与框架略有不同（如「临床特征」对应「临床表现」），按实际标题记录，但按框架逻辑判断 level
3. 忽略导航性文字（「点击查看」「跳转至」等）
4. content 字段**原文逐字复制**该章节直属的正文内容（不含子章节内容），保留 [N] 角标
5. 若词条开头有无标题的引言段落，作为「概述」章节，level=1
6. 参考文献及其后内容不作为章节输出
7. image_count / table_count 统计该章节内的图片和表格数量
8. 文中 [N] 或 [N-M] 为参考文献上标角标（如 [2,3]、[1-5]；旧数据可能为 ^[N]），属于引用标注，不属于正文内容，解析时忽略

请以 JSON 格式输出：
{{
  "sections": [
    {{
      "heading": "章节标题",
      "content": "该标题直属的正文内容",
      "level": 1,
      "image_count": 0,
      "table_count": 0
    }}
  ]
}}

按原文顺序输出所有章节，包含所有层级。"""


def _extract_framework_summary() -> str:
    """Extract structural part of the content framework spec."""
    if not CONTENT_FRAMEWORK:
        return _BUILTIN_FRAMEWORK_SUMMARY

    lines = CONTENT_FRAMEWORK.split("\n")
    summary_lines = []
    for line in lines:
        if re.match(r"^\*{0,2}三、一般要求\*{0,2}", line.strip()):
            break
        summary_lines.append(line)

    result = "\n".join(summary_lines).strip()
    if len(result) > 4000:
        result = result[:4000] + "\n...(略)"
    return result


# Built-in fallback summary if framework file not found
_BUILTIN_FRAMEWORK_SUMMARY = """
## 一、疾病结构框架

**字段：基础知识**
子级内容（按以下顺序，特殊情况可调整）：
一、定义/概述（必须有）
二、病因/危险因素（与"发病机制"至少有其一）
三、发病机制（与"病因"至少有其一）
四、流行病学
五、解剖学
六、病理生理学
七、分类/分型/分期（仅放不涉及诊断、治疗的分类；与诊断或治疗相关的分类放"诊断"或"治疗"字段）

**字段：诊断**
子级内容（按以下顺序）：
一、临床表现（必须有；含病史、症状、体格检查，以及按临床表现的分型）
二、辅助检查（必须有；含实验室、影像学、心电图、肺功能、有创检查、病理、基因检测等）
三、诊断（必须有；含诊断标准/流程，与诊断治疗相关的分型/分期）
四、病情评估
五、诊断注意事项（无需强行添加）
六、并发症/合并症（仅涉及诊断内容时放此处；涉及治疗时放"治疗"字段；涉及预后时放"预后"字段）

**字段：鉴别诊断**
相似临床表现或辅助检查的鉴别，内容集中于鉴别点。

**字段：治疗**
子级内容（按疾病最优分层列举，不强制以下顺序）：
一、治疗原则
二、药物治疗
三、手术治疗
四、疗效评估
五、治疗注意事项（无需强行添加）
⚠️ 重要：不能将"治疗"本身作为子级标题；应将具体治疗类型（药物治疗/手术治疗等）作为子级标题。
可按分期/分型列举治疗方案，如"Ⅰ期治疗""轻度治疗"等。

**字段：控制目标**（慢性病时可有，非必须）
一、慢性疾病控制目标
二、急性疾病控制目标

**字段：预后**
一、出院依据
二、预后
三、长期/短期监测
四、随访（含患者教育）

**字段：预防**
一、筛查
二、预防

---

## 二、症状/体征类结构框架

**字段：基础知识**
一、定义/概述（必须有）
二、病因/分类
三、发病机制
四、流行病学
五、解剖学
六、病理生理学

**字段：诊断**
一、初始评估
  （一）病史采集（含伴随症状、既往史、个人史、家族史等）
  （二）体格检查
  （三）辅助检查
二、诊断思路（含诊断流程图）
三、关联疾病
四、鉴别诊断

**字段：鉴别诊断**（狭义疾病间鉴别）

**字段：治疗**
一、治疗原则
二、药物治疗
三、手术治疗
四、疗效评估

**字段：预后**
一、预后
二、长期/短期监测
三、随访

**字段：预防**
一、疾病的筛查
二、预防
"""


# ── Fallback: structural parsing without AI ────────────────────────────────────

def _parse_with_fallback(text: str) -> ParsedArticle:
    """Try Markdown headings, then HTML headings, then treat as single section."""
    # Check for structured markers from parse_html_structured
    if re.search(r"^\[H[123]\]", text, re.MULTILINE):
        return _parse_structured_markers(text)

    md_headings = re.findall(r"^(#{1,3})\s+(.+)$", text, re.MULTILINE)
    if len(md_headings) >= 2:
        return _parse_markdown(text)

    plain_structured = _parse_plain_numbered_sections(text)
    if plain_structured:
        return plain_structured

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(text, "lxml")
        if len(soup.find_all(["h1", "h2", "h3"])) >= 2:
            return _parse_html_fallback(text)
    except Exception:
        pass

    sections = [ArticleSection(
            heading="正文", content=text,
            word_count=count_chinese_words(text), level=1,
        )]
    _assign_stable_section_ids(sections)
    return ParsedArticle(
        sections=sections,
        total_words=count_chinese_words(text),
    )


_CJK_NUMBERED_HEADING_RE = re.compile(r"^[一二三四五六七八九十百]+[、.．]\s*\S+")
_PAREN_CJK_NUMBERED_HEADING_RE = re.compile(r"^[（(][一二三四五六七八九十百]+[）)]\s*\S+")
_ARABIC_LIST_ITEM_RE = re.compile(r"^\d+[、.)]\s*\S+")


def _is_long_arabic_list_item(text: str) -> bool:
    stripped = text.strip()
    return bool(re.match(r"^\d+[.)]\s*\S+", stripped) and len(stripped) > 36)


def _normalize_plain_heading(text: str) -> str:
    return re.sub(r"[\s：:]+", "", text.strip())


def _strip_heading_marker(text: str) -> str:
    return re.sub(r"^\[H[123]\]\s*", "", text.strip())


def _plain_heading_level(line: str, seen_level1: bool, seen_level2: bool) -> int:
    raw = line.strip()
    marker_match = re.match(r"^\[H([123])\]\s*(.+)$", raw)
    stripped = marker_match.group(2).strip() if marker_match else raw
    if not stripped:
        return 0
    if marker_match:
        marker_level = int(marker_match.group(1))
        if marker_level == 1 and _normalize_plain_heading(stripped) in _LEVEL1_HEADINGS:
            return 1
        if marker_level == 2 and seen_level1:
            return 2
        if marker_level == 3 and seen_level2:
            return 3
    if _normalize_plain_heading(stripped) in _LEVEL1_HEADINGS:
        return 1
    if not seen_level1:
        return 0
    if _CJK_NUMBERED_HEADING_RE.match(stripped):
        return 2
    if _is_long_arabic_list_item(stripped):
        return 0
    if seen_level2 and _PAREN_CJK_NUMBERED_HEADING_RE.match(stripped):
        if len(stripped) <= 80:
            return 3
    return 0


def _parse_plain_numbered_sections(text: str) -> Optional[ParsedArticle]:
    """Fast parse pasted plain text when obvious field headings are present."""
    lines = text.split("\n")
    sections: List[ArticleSection] = []
    current_heading: Optional[str] = None
    current_level = 1
    current_lines: List[str] = []
    seen_level1 = False
    seen_level2 = False
    level1_count = 0

    def flush() -> None:
        if current_heading is None:
            return
        content = "\n".join(current_lines).strip()
        sections.append(ArticleSection(
            heading=current_heading,
            content=content,
            word_count=_count_section_words(current_heading, content),
            level=current_level,
            image_count=len(re.findall(r"\[图片\]", content)),
            table_count=len(re.findall(r"\[表格\]|\[表格标题\]", content)),
        ))

    for line in lines:
        stripped = line.strip()
        heading_text = _strip_heading_marker(stripped)
        if _normalize_plain_heading(heading_text) == "参考文献":
            break

        level = _plain_heading_level(stripped, seen_level1, seen_level2)
        if level:
            flush()
            current_heading = heading_text
            current_level = level
            current_lines = []
            if level == 1:
                seen_level1 = True
                seen_level2 = False
                level1_count += 1
            elif level == 2:
                seen_level2 = True
            continue

        current_lines.append(line)

    flush()
    if level1_count < 2 or len(sections) < 4:
        return None

    _fix_section_levels(sections)
    _assign_stable_section_ids(sections)
    total_words = sum(s.word_count for s in sections if not _is_summary_section(s.heading))
    return ParsedArticle(sections=sections, total_words=total_words)


def _parse_structured_markers(text: str) -> ParsedArticle:
    """Parse text that has [H1]/[H2]/[H3] markers (output of parse_html_structured)."""
    lines = text.split("\n")
    sections: List[ArticleSection] = []
    current_heading: Optional[str] = None
    current_level = 1
    current_lines: List[str] = []

    def flush() -> None:
        if current_heading is None:
            return
        content = "\n".join(current_lines).strip()
        image_count = len(re.findall(r"\[图片\]", content))
        table_count = len(re.findall(r"\[表格\]|\[表格标题\]", content))
        sections.append(ArticleSection(
            heading=current_heading,
            content=content,
            word_count=_count_section_words(current_heading, content),
            level=current_level,
            image_count=image_count,
            table_count=table_count,
        ))

    for line in lines:
        m = re.match(r"^\[H(\d)\]\s*(.+)$", line)
        if m:
            level = int(m.group(1))
            heading_text = m.group(2).strip()
            if level == 3 and _is_long_arabic_list_item(heading_text) and current_heading is not None:
                current_lines.append(heading_text)
                continue
            flush()
            current_heading = heading_text
            current_level = min(3, level)    # H1→1, H2→2, H3→3
            current_lines = []
        else:
            current_lines.append(line)

    flush()
    _fix_section_levels(sections)
    _assign_stable_section_ids(sections)
    total_words = sum(s.word_count for s in sections if not _is_summary_section(s.heading))
    return ParsedArticle(sections=sections, total_words=total_words)


def _parse_markdown(text: str) -> ParsedArticle:
    lines = text.split("\n")
    sections: List[ArticleSection] = []
    current_heading: Optional[str] = None
    current_level = 1
    current_lines: List[str] = []

    def flush() -> None:
        if current_heading is None:
            return
        content = "\n".join(current_lines).strip()
        sections.append(ArticleSection(
            heading=current_heading, content=content,
            word_count=_count_section_words(current_heading, content), level=current_level,
        ))

    for line in lines:
        m = re.match(r"^(#{1,3})\s+(.+)$", line)
        if m:
            flush()
            current_level = len(m.group(1))
            current_heading = m.group(2).strip()
            current_lines = []
        else:
            current_lines.append(line)

    flush()
    _fix_section_levels(sections)
    _assign_stable_section_ids(sections)
    return ParsedArticle(sections=sections, total_words=sum(s.word_count for s in sections))


def _parse_html_fallback(text: str) -> ParsedArticle:
    from bs4 import BeautifulSoup, Tag

    soup = BeautifulSoup(text, "lxml")
    sections: List[ArticleSection] = []

    for heading in soup.find_all(["h1", "h2", "h3"]):
        level = int(heading.name[1])
        heading_text = heading.get_text(strip=True)
        content_parts = []
        for sibling in heading.next_siblings:
            if isinstance(sibling, Tag) and sibling.name in ["h1", "h2", "h3"]:
                break
            content_parts.append(
                sibling.get_text(separator=" ", strip=True)
                if isinstance(sibling, Tag) else str(sibling)
            )
        content = " ".join(content_parts).strip()
        sections.append(ArticleSection(
            heading=heading_text, content=content,
            word_count=_count_section_words(heading, content), level=level,
        ))

    _fix_section_levels(sections)
    _assign_stable_section_ids(sections)
    return ParsedArticle(sections=sections, total_words=sum(s.word_count for s in sections))
