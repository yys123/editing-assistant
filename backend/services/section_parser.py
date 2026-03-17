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
)


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
    clean = re.sub(r"\[H\d\]|\[图片\]|\[表格\]|\[图注\]|\[表格标题\]", "", text)
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


# ── Primary: AI-based parser ───────────────────────────────────────────────────

async def parse_article_sections(text: str) -> ParsedArticle:
    """Parse article content into sections using Gemini.

    Accepts two kinds of input:
    1. Structured text from parse_html_structured() — has [H1]/[H2]/[H3] markers.
    2. Plain text (Markdown headings, HTML, or raw prose).

    Falls back to regex/BS4 parsing if AI fails.
    """
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
        prompt = _build_structured_prompt(text[:40000], framework_summary)
    else:
        prompt = _build_plain_prompt(text[:30000], framework_summary)

    raw = await generate_text(prompt, _SYSTEM_PROMPT)
    data = extract_json(raw)

    sections: List[ArticleSection] = []
    for item in data.get("sections", []):
        if not isinstance(item, dict):
            continue
        heading = str(item.get("heading", "")).strip()
        content = str(item.get("content", "")).strip()
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

    total_words = sum(s.word_count for s in sections)
    return ParsedArticle(sections=sections, total_words=total_words)


def _build_structured_prompt(structured_text: str, framework_summary: str) -> str:
    return f"""你收到的词条内容已经过结构化预处理，使用了以下标记格式：
- [H1] 文章标题
- [H2] / [H3] 章节标题（来自原始 HTML 的 h2/h3 标签）
- [图片] 图片说明（例如「图 1 儿童 ADHD 诊治流程」）
- [表格] 表格说明（例如「表 1 儿童 ADHD 不同年龄段表现」）
- Markdown 表格行（|...| 格式）
- 其余文字为正文段落

⚠️ 重要提示：原始 HTML 中 h2 标签同时用于「一级字段」（如「基础知识」「诊断」「治疗」）和「二级子段」（如「定义」「临床表现」「药物治疗」），请结合内容框架判断正确的 level 值。

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
4. [H1] 标题行不作为章节输出
5. 若词条开头有无标题的引言段落，作为「概述」章节，level=1
6. content 字段：填写该章节**直属**的正文内容（不含子章节内容）；保留 [图片] 和 [表格] 标记
7. image_count：该章节 content 中 [图片] 标记的数量
8. table_count：该章节 content 中 [表格] 标记的数量
9. 忽略纯导航性文字（「点击查看」「跳转至」等）
10. 治疗字段的子级标题应为具体治疗类型（如"药物治疗""手术治疗"），不能以"治疗"作为子级标题
11. 参考文献及其后内容不作为章节输出

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

## 解析规则

1. 参照框架要求中的「字段」和「子级内容」识别章节层级：
   一级字段（基础知识/诊断/鉴别诊断/治疗/控制目标/预后/预防）→ level=1，其下子级 → level=2，更细子项 → level=3
2. 如果词条标题与框架略有不同（如「临床特征」对应「临床表现」），按实际标题记录，但按框架逻辑判断 level
3. 忽略导航性文字（「点击查看」「跳转至」等）
4. content 字段填写该章节直属的正文内容（不含子章节内容）
5. 若词条开头有无标题的引言段落，作为「概述」章节，level=1
6. 参考文献及其后内容不作为章节输出
7. image_count / table_count 统计该章节内的图片和表格数量

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
        table_count = len(re.findall(r"\[表格\]", content))
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
            if level == 1:
                # Article title — skip as heading but flush previous
                flush()
                current_heading = None
                current_lines = []
                continue
            flush()
            current_heading = heading_text
            current_level = min(3, level - 1)  # H2→1, H3→2, H4→3
            current_lines = []
        else:
            current_lines.append(line)

    flush()
    total_words = sum(s.word_count for s in sections)
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

    return ParsedArticle(sections=sections, total_words=sum(s.word_count for s in sections))
