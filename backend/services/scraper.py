import re
import httpx
from bs4 import BeautifulSoup, Tag, NavigableString
from typing import List

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_INLINE_TAGS = {
    "span", "a", "strong", "em", "b", "i", "u", "s", "sup", "sub",
    "code", "cite", "abbr", "time", "small", "label",
}
_TEXT_BLOCK_TAGS = {"p", "li", "dt", "dd", "blockquote", "pre"}
_SKIP_TAGS = {
    "script", "style", "nav", "footer", "header", "aside",
    "noscript", "iframe", "svg", "button", "input", "select",
    "textarea", "form", "option",
}
_HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
_REFERENCE_STOP_KEYWORDS = {"参考文献", "相关指南", "参考资料", "references"}


# ---------------------------------------------------------------------------
# Public: structured HTML parser (for article upload)
# ---------------------------------------------------------------------------

def parse_html_structured(html: str) -> str:
    """Parse HTML into a structured text preserving heading hierarchy,
    image captions and tables.  Stops before the References section.

    Output markers:
        [H1] / [H2] / [H3]  – headings (original HTML tag level)
        [图片] <caption>     – figure captions starting with 图
        [表格] <caption>     – figure captions starting with 表
        Markdown table rows  – table cell content
        Plain text           – paragraph / list-item text
    """
    soup = BeautifulSoup(html, "lxml")

    # ── Remove obvious UI noise ────────────────────────────────────────────
    for tag in soup.find_all(_SKIP_TAGS):
        tag.decompose()

    # Remove by id/class pattern (sidebars, ads, footers …)
    for tag in soup.find_all(id=re.compile(r"footer|sidebar|aside|nav|menu|right", re.I)):
        tag.decompose()
    for tag in soup.find_all(class_=lambda c: c and any(
        k in " ".join(c).lower()
        for k in ("sidebar", "right__", "rightaside", "footer", "aside", "banner", "ad_")
    )):
        tag.decompose()

    lines: list[str] = []
    stopped = [False]

    def walk(element: Tag) -> None:
        if stopped[0]:
            return
        for child in element.children:
            if stopped[0]:
                return
            if isinstance(child, NavigableString):
                text = child.strip()
                # Only collect naked text if it is meaningful and its parent
                # is not a block-level element we already handle
                if text and len(text) > 3 and isinstance(element, Tag) and element.name in _INLINE_TAGS:
                    lines.append(text)
                continue

            tag = child.name
            if not tag:
                continue

            # ── Skip noise ─────────────────────────────────────────────
            if tag in _SKIP_TAGS:
                continue

            # ── Headings ───────────────────────────────────────────────
            if tag in _HEADING_TAGS:
                text = child.get_text(strip=True)
                if not text:
                    continue
                # Normalise: strip reference numbers stuck to heading text
                # e.g. "非药物治疗68" → "非药物治疗"
                text = re.sub(r"\d+$", "", text).strip()
                if any(kw in text for kw in _REFERENCE_STOP_KEYWORDS):
                    stopped[0] = True
                    return
                level = int(tag[1])
                lines.append(f"[H{level}] {text}")
                continue

            # ── Figure captions ────────────────────────────────────────
            if tag == "figcaption":
                text = child.get_text(strip=True)
                if text:
                    # Strip trailing reference numbers
                    text = re.sub(r"\d+$", "", text).strip()
                    if re.match(r"^图\s*\d", text):
                        lines.append(f"[图片] {text}")
                    elif re.match(r"^表\s*\d", text):
                        lines.append(f"[表格] {text}")
                    else:
                        lines.append(f"[图注] {text}")
                continue

            # ── Tables ────────────────────────────────────────────────
            if tag == "table":
                md = _table_to_markdown(child)
                if md:
                    lines.append(md)
                continue

            # ── Text blocks ────────────────────────────────────────────
            if tag in _TEXT_BLOCK_TAGS:
                text = child.get_text(separator=" ", strip=True)
                # Strip trailing reference numbers
                text = re.sub(r"\s*\d+\s*$", "", text).strip()
                if text and len(text) > 3:
                    lines.append(text)
                continue

            # ── Inline tags inside block context – skip ────────────────
            if tag in _INLINE_TAGS:
                continue

            # ── Generic containers (div, section, article …) ───────────
            # Check whether this container has any block-level children.
            has_block = any(
                isinstance(c, Tag) and c.name not in _INLINE_TAGS
                for c in child.children
            )
            if not has_block:
                # Leaf container – collect its text
                text = child.get_text(separator=" ", strip=True)
                text = re.sub(r"\s*\d+\s*$", "", text).strip()
                if text and len(text) > 3:
                    lines.append(text)
            else:
                walk(child)

    walk(soup.find("body") or soup)

    # De-duplicate consecutive identical lines
    deduped: list[str] = []
    prev = None
    for line in lines:
        if line != prev:
            deduped.append(line)
        prev = line

    # Drop known UI noise patterns (buttons, breadcrumbs, etc.)
    _UI_NOISE = re.compile(
        r"^(全屏查看|返回顶部|点击查看|跳转至|下载App|专属顾问|诊疗方案详情"
        r"|首页|搜索结果|文献评审|相关推荐|相关指南|查看更多|展开全文"
        r"|收起|加载中|Loading|暂无内容).*$"
    )
    cleaned: list[str] = []
    for line in deduped:
        if _UI_NOISE.match(line):
            continue
        cleaned.append(line)

    # Trim leading non-heading lines (breadcrumbs / page navigation before first [H])
    first_heading_idx = next(
        (i for i, l in enumerate(cleaned) if re.match(r"^\[H\d\]", l)),
        0,
    )
    cleaned = cleaned[first_heading_idx:]

    return "\n".join(cleaned)


# ---------------------------------------------------------------------------
# Public: structured TXT parser (for knowledge base article upload)
# ---------------------------------------------------------------------------

_CN_NUMS = "一二三四五六七八九十百"
# Reference markers like [12], [12-34], [12,34]
_REF_RE = re.compile(r'\[\d+(?:[,，\-~～至]\d+)*\]')
# H2: 一、二、三... prefixed sections
_H2_NUM_RE = re.compile(r'^[' + _CN_NUMS + r']+[、]')
# H3: （一）（二）... prefixed sub-sections
_H3_PAREN_RE = re.compile(r'^（[' + _CN_NUMS + r']+）')
# Short standalone section title: 2-8 CJK chars only (e.g. 基础知识, 诊断, 治疗)
_SHORT_TITLE_RE = re.compile(r'^[\u4e00-\u9fff]{2,8}$')
# Table caption: 表 N
_TABLE_RE = re.compile(r'^表\s*\d')
# Figure caption: 图 N
_FIG_RE = re.compile(r'^图\s*\d')
# Whitelist: known top-level section names from the standard content framework.
# These are always emitted as [H2] and always exit table mode, regardless of
# whether the preceding line was empty.  Non-whitelisted short titles (e.g. drug
# names like "哌甲酯") are only promoted to [H2] when preceded by an empty line.
_LEVEL1_SECTIONS = {
    "基础知识", "诊断", "鉴别诊断", "治疗", "控制目标", "预后", "预防", "概述",
}


def parse_txt_structured(text: str) -> str:
    """Parse a structured Chinese medical TXT file into the same marker format
    as parse_html_structured.

    Output markers (same as HTML parser):
        [H2] / [H3]       – section headings by detected level
        [图片] <caption>  – figure captions starting with 图N
        [表格] <caption>  – table captions starting with 表N
        Markdown table rows – tab-delimited content converted to | col | col |
        Plain text        – body paragraphs and numbered items

    Heading detection:
        - [H2]: 一、二、三... prefixed OR standalone short CJK title (≤8 chars)
        - [H3]: （一）（二）... Chinese numeral in parentheses

    Table mode: activated by "表 N" caption line; exits when a 一、 or （一）
    heading is seen, or when a standalone short title follows an empty line.
    """
    # Remove non-printable control chars (keep tab \x09, space) that may
    # appear in copy-pasted or exported txt files and break regex matching
    _CTRL_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')

    output: List[str] = []
    in_table = False
    table_header_done = False
    prev_was_empty = True  # treat start-of-file as preceded by empty line

    for raw_line in text.splitlines():
        # Strip control characters, normalize non-breaking space, then whitespace
        stripped = _CTRL_RE.sub('', raw_line).replace('\xa0', ' ').strip()

        if not stripped:
            prev_was_empty = True
            continue

        # ── Tab-delimited line → markdown table row ─────────────────────────
        if '\t' in stripped:
            cells = [_REF_RE.sub('', c).strip() for c in stripped.split('\t')]
            cells = [c for c in cells if c]
            if cells:
                output.append('| ' + ' | '.join(cells) + ' |')
                if in_table and not table_header_done:
                    output.append('|' + '---|' * len(cells))
                    table_header_done = True
            prev_was_empty = False
            continue

        # For non-tab lines, strip reference markers
        clean = _REF_RE.sub('', stripped).strip()
        if not clean:
            prev_was_empty = True
            continue

        # ── Figure caption ───────────────────────────────────────────────────
        if _FIG_RE.match(clean):
            in_table = False
            output.append(f'[图片] {clean}')
            prev_was_empty = False
            continue

        # ── Table caption: start new table ──────────────────────────────────
        if _TABLE_RE.match(clean):
            in_table = True
            table_header_done = False
            output.append(f'[表格] {clean}')
            prev_was_empty = False
            continue

        # ── Inside table mode ────────────────────────────────────────────────
        if in_table:
            # Exit on major heading patterns
            is_h2 = _H2_NUM_RE.match(clean)
            is_h3 = _H3_PAREN_RE.match(clean)
            # Whitelisted level-1 sections always exit table mode.
            # Other short titles only exit when preceded by an empty line, to
            # avoid promoting in-cell sub-labels (e.g. "多动", "冲动") to headings.
            is_standalone = _SHORT_TITLE_RE.match(clean) and (
                clean in _LEVEL1_SECTIONS or prev_was_empty
            )
            if is_h2 or is_h3 or is_standalone:
                in_table = False
                # Fall through to heading detection below
            else:
                # Emit as table content (non-tab continuation or footnote)
                if len(clean) > 1:
                    output.append(clean)
                prev_was_empty = False
                continue

        # ── Heading / body detection (outside table mode) ────────────────────
        if _H2_NUM_RE.match(clean):
            output.append(f'[H2] {clean}')
        elif _H3_PAREN_RE.match(clean):
            output.append(f'[H3] {clean}')
        elif _SHORT_TITLE_RE.match(clean):
            # Whitelisted names are always top-level section markers.
            # Other short titles (e.g. drug names like "哌甲酯") are only
            # promoted to [H2] when preceded by an empty line; otherwise they
            # are emitted as plain body text to preserve hierarchy.
            if clean in _LEVEL1_SECTIONS or prev_was_empty:
                output.append(f'[H2] {clean}')
            else:
                output.append(clean)
        elif len(clean) > 3:
            output.append(clean)

        prev_was_empty = False

    return '\n'.join(output)


# ---------------------------------------------------------------------------
# Public: plain-text HTML parser (for reference docs / URL fetch)
# ---------------------------------------------------------------------------

def parse_html_to_text(html: str) -> str:
    """Extract plain text from HTML (no structural markers).
    Used for reference document upload and URL fetch."""
    soup = BeautifulSoup(html, "lxml")

    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    main = (
        soup.find("article")
        or soup.find("main")
        or soup.find(class_=lambda c: c and any(
            k in str(c).lower() for k in ["content", "article", "entry", "post", "body"]
        ))
        or soup.find("body")
    )

    text = (main or soup).get_text(separator="\n", strip=True)
    lines = [line for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public: URL fetcher
# ---------------------------------------------------------------------------

async def fetch_article_from_url(url: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    return parse_html_to_text(response.text)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _table_to_markdown(table_tag: Tag) -> str:
    """Convert a <table> element to a Markdown-style text representation."""
    rows = table_tag.find_all("tr")
    if not rows:
        return ""

    result: list[str] = []
    for i, row in enumerate(rows):
        cells = row.find_all(["th", "td"])
        # Escape pipe chars inside cells
        cell_texts = [
            re.sub(r"\s+", " ", c.get_text(separator=" ", strip=True)).replace("|", "｜")
            for c in cells
        ]
        if not any(cell_texts):
            continue
        result.append("| " + " | ".join(cell_texts) + " |")
        if i == 0:
            result.append("|" + "---|" * len(cells))

    return "\n".join(result)
