import os
import re
from typing import List, Optional
from models import ArticleSection, ParsedArticle

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


# ── Word-count helper ──────────────────────────────────────────────────────────

def count_chinese_words(text: str) -> int:
    """Count words in Chinese medical text.

    Rules:
    - Each CJK character = 1 word
    - Each run of ASCII letters/digits = 1 word  (e.g. "ADHD" = 1, "50%" = 1)
    - Structural markers ([H1], [图片], [表格] …) are excluded from count.
    - Punctuation and whitespace are not counted.
    """
    # Remove structural markers injected by parse_html_structured
    clean = re.sub(r"\[H\d\]|\[图片\]|\[表格\]|\[图注\]|\[表格标题\]|\[图片内容\]", "", text)
    # Remove reference superscript markers, e.g. ^[2,3] ^[1-5]
    clean = re.sub(r"\^\[\d[\d,，\-~～至]*\]", "", clean)
    # Remove Markdown table separators
    clean = re.sub(r"\|[-|: ]+\|", "", clean)
    # Remove pipe chars from table rows (but keep the cell content)
    clean = clean.replace("|", " ")

    # Count CJK characters
    cjk = len(re.findall(
        r"[\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f"
        r"\u2b740-\u2b81f\u2b820-\u2ceaf\uf900-\ufaff\u2f800-\u2fa1f]",
        clean
    ))
    # Count ASCII word tokens (letters + digits runs)
    ascii_words = len(re.findall(r"[A-Za-z0-9]+", clean))

    return cjk + ascii_words


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
    """Extract all ^[N] reference markers."""
    return re.findall(r'\^\[\d+(?:[,，\-~～至\d]*)\]', text)


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
            section.word_count = count_chinese_words(expected)
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
    if re.search(r"^\[H[123]\]", text, re.MULTILINE):
        return _parse_structured_markers(text)

    try:
        return await _parse_with_ai(text)
    except Exception:
        return _parse_with_fallback(text)


async def _parse_with_ai(text: str) -> ParsedArticle:
    from services.gemini import generate_text
    from services.utils import extract_json

    is_structured = bool(re.search(r"^\[H[123]\]", text, re.MULTILINE))

    framework_summary = _extract_framework_summary()

    if is_structured:
        prompt = _build_structured_prompt(text, framework_summary)
    else:
        prompt = _build_plain_prompt(text, framework_summary)

    raw = await generate_text(prompt, _SYSTEM_PROMPT, context="article_parse_sections")
    data = extract_json(raw)

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
            word_count=count_chinese_words(content),
            level=max(1, min(3, level)),
            image_count=image_count,
            table_count=table_count,
        ))

    if not sections:
        raise ValueError("AI returned no sections")

    _fix_section_levels(sections)
    _validate_and_repair(sections, text)
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
- [表格标题] 表格标题（来自 HTML <caption> 标签，含表格内嵌标题及 ^[N] 引用）
- Markdown 表格行（|...| 格式）
- ^[N] 或 ^[N-M] 为参考文献上标角标（如 ^[2,3]、^[1-5]），是引用标注，不属于正文内容
- 其余文字为正文段落

⚠️ 内容复制要求（最高优先级）：
- content 字段必须**原文逐字复制**，严禁总结、改写、翻译或替换任何词语
- 中文词语不得替换为英文（如"和"不得改为"and"，"包括"不得改为"include"）
- **严禁纠正原文任何错误**：错别字、拼写错误、医学术语错误（如"ADHA"即使疑似有误也须原样保留，不得自行改为"ADHD"）——发现并保留这些错误正是后续审核环节的职责
- ^[N] 参考文献角标原样保留，不得删除或移动
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
6. content 字段：**原文逐字复制**该章节直属的正文内容（不含子章节内容）；保留 [图片]、[表格]、[表格标题]、[图片内容] 标记及 ^[N] 角标，不得修改、删除或翻译任何词语
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
- ^[N] 参考文献角标原样保留，不得删除或移动
- **Markdown 表格须完整保留**：原文中的 `| col | col |` 表格行及其分隔行 `|---|---|` 须**原封不动**复制到 content 中，不得重新排列、合并、删减任何行或列

## 解析规则

1. 参照框架要求中的「字段」和「子级内容」识别章节层级：
   一级字段（基础知识/诊断/鉴别诊断/治疗/控制目标/预后/预防）→ level=1，其下子级 → level=2，更细子项 → level=3
2. 如果词条标题与框架略有不同（如「临床特征」对应「临床表现」），按实际标题记录，但按框架逻辑判断 level
3. 忽略导航性文字（「点击查看」「跳转至」等）
4. content 字段**原文逐字复制**该章节直属的正文内容（不含子章节内容），保留 ^[N] 角标
5. 若词条开头有无标题的引言段落，作为「概述」章节，level=1
6. 参考文献及其后内容不作为章节输出
7. image_count / table_count 统计该章节内的图片和表格数量
8. 文中 ^[N] 或 ^[N-M] 为参考文献上标角标（如 ^[2,3]、^[1-5]），属于引用标注，不属于正文内容，解析时忽略

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

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(text, "lxml")
        if len(soup.find_all(["h1", "h2", "h3"])) >= 2:
            return _parse_html_fallback(text)
    except Exception:
        pass

    return ParsedArticle(
        sections=[ArticleSection(
            heading="正文", content=text,
            word_count=count_chinese_words(text), level=1,
        )],
        total_words=count_chinese_words(text),
    )


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
            word_count=count_chinese_words(content),
            level=current_level,
            image_count=image_count,
            table_count=table_count,
        ))

    for line in lines:
        m = re.match(r"^\[H(\d)\]\s*(.+)$", line)
        if m:
            level = int(m.group(1))
            heading_text = m.group(2).strip()
            flush()
            current_heading = heading_text
            current_level = min(3, level)    # H1→1, H2→2, H3→3
            current_lines = []
        else:
            current_lines.append(line)

    flush()
    _fix_section_levels(sections)
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
            word_count=count_chinese_words(content), level=current_level,
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
            word_count=count_chinese_words(content), level=level,
        ))

    _fix_section_levels(sections)
    return ParsedArticle(sections=sections, total_words=sum(s.word_count for s in sections))
