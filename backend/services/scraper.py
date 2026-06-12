import re
import base64
import httpx
from bs4 import BeautifulSoup, Tag, NavigableString
from typing import List, Dict, Any

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
_CN_NUMS = "一二三四五六七八九十百"
_H2_NUM_RE = re.compile(r'^[' + _CN_NUMS + r']+[、]')
_H3_PAREN_RE = re.compile(r'^（[' + _CN_NUMS + r']+）')
_SUPERSCRIPT_MAP = str.maketrans("0123456789+-=()n", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ")
_SUBSCRIPT_MAP = str.maketrans("0123456789+-=()aeioruvxhklmnpst", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑᵢₒᵣᵤᵥₓₕₖₗₘₙₚₛₜ")


def _script_text(text: str, script: str) -> str:
    compact = re.sub(r"\s+", "", text)
    if not compact:
        return ""
    table = _SUPERSCRIPT_MAP if script == "sup" else _SUBSCRIPT_MAP
    converted = compact.translate(table)
    if converted != compact:
        return converted
    marker = "^" if script == "sup" else "_"
    return f"{marker}({compact})"


def _is_reference_sup_text(text: str) -> bool:
    compact = re.sub(r"\s+", "", text)
    return bool(re.fullmatch(r"\d+(?:[,，\-~～至]\d+)*", compact))


def _nearest_text_before(tag: Tag) -> str:
    current = tag
    while current is not None:
        sibling = current.previous_sibling
        while sibling is not None:
            text = sibling.get_text("", strip=False) if isinstance(sibling, Tag) else str(sibling)
            if text:
                return text
            sibling = sibling.previous_sibling
        current = current.parent if isinstance(current.parent, Tag) else None
    return ""


def _nearest_text_after(tag: Tag) -> str:
    current = tag
    while current is not None:
        sibling = current.next_sibling
        while sibling is not None:
            text = sibling.get_text("", strip=False) if isinstance(sibling, Tag) else str(sibling)
            if text:
                return text
            sibling = sibling.next_sibling
        current = current.parent if isinstance(current.parent, Tag) else None
    return ""


def _looks_like_reference_sup(tag: Tag) -> bool:
    text = tag.get_text(" ", strip=True)
    if not _is_reference_sup_text(text):
        return False

    before = _nearest_text_before(tag).rstrip()
    after = _nearest_text_after(tag).lstrip()
    prev_char = before[-1:] if before else ""
    next_char = after[:1] if after else ""

    # Scientific notation and units such as 10^9 or cm^2 should remain true
    # superscripts. Citation superscripts are usually attached to prose.
    if prev_char and re.match(r"[\d×*/+\-=]", prev_char):
        return False
    if next_char and re.match(r"[A-Za-z0-9/]", next_char):
        return False

    return True


def _extract_text_with_refs(tag: Tag) -> str:
    """Recursively extract text, converting literature-sup elements to ^[N] notation.

    <sup class="literature-sup">2,3</sup> → ^[2,3]

    All other elements are traversed normally.  Whitespace is normalised.
    """
    parts: list[str] = []
    for child in tag.children:
        if isinstance(child, NavigableString):
            parts.append(str(child))
        elif isinstance(child, Tag):
            classes = child.get("class") or []
            if child.name == "sup" and "literature-sup" in classes:
                ref = child.get_text(strip=True)
                if ref:
                    parts.append(f"^[{ref}]")
            elif child.name == "sup" and _looks_like_reference_sup(child):
                ref = re.sub(r"\s+", "", child.get_text(" ", strip=True))
                parts.append(f"^[{ref}]")
            elif child.name in {"sup", "sub"}:
                parts.append(_script_text(child.get_text(" ", strip=True), child.name))
            else:
                parts.append(_extract_text_with_refs(child))
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def _append_structured_text(lines: list[str], text: str) -> None:
    if not text or len(text) <= 3:
        return
    clean = re.sub(r"\d+$", "", text).strip()
    if not clean:
        return
    if any(kw in clean for kw in _REFERENCE_STOP_KEYWORDS):
        return
    if _H2_NUM_RE.match(clean):
        lines.append(f"[H2] {clean}")
    elif _H3_PAREN_RE.match(clean):
        lines.append(f"[H3] {clean}")
    else:
        lines.append(text)


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
                text = _extract_text_with_refs(child)
                _append_structured_text(lines, text)
                continue

            # ── Inline tags inside block context – skip ────────────────
            if tag in _INLINE_TAGS:
                continue

            # ── Special editorial summary blocks (identified by CSS class) ──
            classes = child.get("class") or []

            # 更新要点: <section class="Update_section__*">
            if any("Update_section" in c for c in classes):
                lines.append("[H2] 更新要点")
                content_el = child.find(
                    lambda t: isinstance(t, Tag)
                    and any("Update_content" in c for c in (t.get("class") or []))
                )
                if content_el:
                    walk(content_el)
                continue

            # 诊断要点 / 治疗要点: <div class="dxy-card">
            if "dxy-card" in classes:
                # Determine heading: prefer <strong> containing "要点"
                strong_tag = child.find(
                    lambda t: isinstance(t, Tag) and t.name == "strong"
                    and "要点" in t.get_text()
                )
                if strong_tag:
                    heading = strong_tag.get_text(strip=True).rstrip("：:").strip()
                else:
                    anchor_span = child.find("span", attrs={"data-menu-anchor": True})
                    if anchor_span:
                        raw = anchor_span.get("data-menu-anchor", "")
                        m = re.search(r"[\u4e00-\u9fff]+要点", raw)
                        heading = m.group(0) if m else "编辑要点"
                    else:
                        heading = "编辑要点"
                lines.append(f"[H2] {heading}")
                full_text = _extract_text_with_refs(child)
                # Strip heading prefix from content text
                for prefix in (heading + "：", heading + ":", heading):
                    if full_text.startswith(prefix):
                        full_text = full_text[len(prefix):].strip()
                        break
                if full_text and len(full_text) > 3:
                    lines.append(full_text)
                continue

            # ── Generic containers (div, section, article …) ───────────
            # Only recurse when there are block-level children with actual text
            # content.  Empty block children (e.g. <p class="new-line"/>) must
            # NOT trigger recursion — otherwise the inline elements and bare
            # NavigableStrings that hold the real content are silently dropped.
            has_block = any(
                isinstance(c, Tag)
                and c.name not in _INLINE_TAGS
                and bool(c.get_text(strip=True))
                for c in child.children
            )
            if not has_block:
                # Leaf container – collect its text preserving ref markers
                text = _extract_text_with_refs(child)
                _append_structured_text(lines, text)
            else:
                walk(child)

    # 检测 DXY 结构化词条（page_disease-section 特征）
    disease_sections = [
        t for t in soup.find_all("section")
        if any("page_disease-section" in c for c in (t.get("class") or []))
    ]

    if disease_sections:
        # ── 结构化模式 ────────────────────────────────────────
        # 1. 先处理 Update_section（更新要点）
        body = soup.find("body") or soup
        for child in body.children:
            if not isinstance(child, Tag):
                continue
            child_classes = child.get("class") or []
            if any("Update_section" in c for c in child_classes):
                # 提取含日期的完整标题
                card = child.find(
                    lambda t: isinstance(t, Tag)
                    and any("Update_card" in c for c in (t.get("class") or []))
                )
                if card:
                    title_h2 = card.find(
                        lambda t: isinstance(t, Tag) and t.name == "h2"
                        and any("Update_title" in c for c in (t.get("class") or []))
                    )
                    title_text = title_h2.get_text(strip=True) if title_h2 else "更新要点"
                else:
                    title_text = "更新要点"
                lines.append(f"[H2] {title_text}")
                content_el = child.find(
                    lambda t: isinstance(t, Tag)
                    and any("Update_content" in c for c in (t.get("class") or []))
                )
                if content_el:
                    walk(content_el)

        # 2. 依次处理每个 disease section
        for sec in disease_sections:
            if stopped[0]:
                break
            # 找 section 直接子 div（无 class 的外层容器）
            outer_div = next(
                (c for c in sec.children if isinstance(c, Tag) and c.name == "div"),
                None,
            )
            if not outer_div:
                continue

            # 一级字段标题（outer_div 直接子 h2）
            field_h2 = next(
                (c for c in outer_div.children if isinstance(c, Tag) and c.name == "h2"),
                None,
            )
            if field_h2:
                text = field_h2.get_text(strip=True)
                text = re.sub(r"\d+$", "", text).strip()
                if any(kw in text for kw in _REFERENCE_STOP_KEYWORDS):
                    stopped[0] = True
                    break
                if text:
                    lines.append(f"[H1] {text}")

            # 走 ck-content（现有 walk() 完全复用，h2→[H2], h3→[H3] 保持原逻辑）
            ck = outer_div.find("div", class_="ck-content")
            if ck:
                walk(ck)

    else:
        # ── 兼容 fallback：原始平铺遍历 ──────────────────────
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
# Public: extract embedded images from HTML (for vision analysis)
# ---------------------------------------------------------------------------

def extract_images_from_html(html: str) -> List[Dict[str, Any]]:
    """Extract content images from HTML for Gemini vision analysis.

    Only extracts images inside <figure class="image"> elements (content figures),
    ignoring UI icons, footer badges, etc.

    Returns a list of dicts in document order:
        {caption: str, data: bytes, mime_type: str}
    """
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements first (same as parse_html_structured)
    for tag in soup.find_all(_SKIP_TAGS):
        tag.decompose()
    for tag in soup.find_all(id=re.compile(r"footer|sidebar|aside|nav|menu|right", re.I)):
        tag.decompose()

    images: List[Dict[str, Any]] = []

    for figure in soup.find_all("figure", class_="image"):
        # Get caption
        cap_tag = figure.find("figcaption")
        caption = cap_tag.get_text(strip=True) if cap_tag else ""
        # Strip trailing reference numbers from caption
        caption = re.sub(r"\d+$", "", caption).strip()

        # Get the img element
        img_tag = figure.find("img")
        if not img_tag:
            continue

        src = img_tag.get("src", "")
        if not src.startswith("data:"):
            # URL-referenced image — skip for now (would need HTTP fetch)
            continue

        try:
            # Parse "data:<mime>;base64,<data>"
            header, encoded = src.split(",", 1)
            mime_type = header.split(";")[0].replace("data:", "").strip()
            img_bytes = base64.b64decode(encoded)
            images.append({
                "caption": caption,
                "data": img_bytes,
                "mime_type": mime_type,
            })
        except Exception:
            continue

    return images


# ---------------------------------------------------------------------------
# Public: structured TXT parser (for knowledge base article upload)
# ---------------------------------------------------------------------------

# Reference markers like [12], [12-34], [12,34]
_REF_RE = re.compile(r'\[\d+(?:[,，\-~～至]\d+)*\]')
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
            # Convert [N] / [N-M] ref markers to ^[N] notation instead of
            # stripping them — reference citations in table cells must be kept.
            cells = [_REF_RE.sub(lambda m: "^" + m.group(0), c).strip()
                     for c in stripped.split('\t')]
            cells = [c for c in cells if c]
            if cells:
                output.append('| ' + ' | '.join(cells) + ' |')
                if in_table and not table_header_done:
                    output.append('|' + '---|' * len(cells))
                    table_header_done = True
            prev_was_empty = False
            continue

        # For non-tab lines, strip reference markers (used for heading/caption
        # pattern matching; see table-mode block below for ref-preserving output)
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
                # Emit as table content (non-tab continuation or footnote).
                # Use ref-converted text so [N] citations are preserved as ^[N].
                clean_with_refs = _REF_RE.sub(lambda m: "^" + m.group(0), stripped).strip()
                if len(clean_with_refs) > 1:
                    output.append(clean_with_refs)
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
    """Convert a <table> element to a Markdown table, handling rowspan/colspan.

    Each spanned cell's text is placed at its top-left position; continuation
    positions are filled with an empty string so every row has the same column
    count and the Markdown table stays properly aligned.

    If the table has a <caption> element, its text (including ^[N] ref markers)
    is prepended as a [表格标题] line.
    """
    rows = table_tag.find_all("tr")
    if not rows:
        return ""

    # Extract <caption> tag (HTML table title), preserving reference markers
    caption_line = ""
    caption_tag = table_tag.find("caption")
    if caption_tag:
        caption_text = _extract_text_with_refs(caption_tag).strip()
        # Strip trailing bare digits (stray ref numbers stuck to caption text)
        caption_text = re.sub(r"\d+$", "", caption_text).strip()
        if caption_text:
            caption_line = f"[表格标题] {caption_text}"

    num_rows = len(rows)
    # occupied[(r, c)] = cell text for that grid position
    occupied: dict[tuple[int, int], str] = {}
    max_col = 0

    for r, row in enumerate(rows):
        c = 0
        for cell in row.find_all(["th", "td"]):
            # Skip positions already filled by a rowspan from a previous row
            while (r, c) in occupied:
                c += 1
            text = _extract_text_with_refs(cell).replace("|", "｜")
            colspan = int(cell.get("colspan", 1))
            rowspan = int(cell.get("rowspan", 1))
            # Fill all positions covered by this cell's span
            for dr in range(rowspan):
                for dc in range(colspan):
                    rr, cc = r + dr, c + dc
                    if rr < num_rows:
                        # Only the anchor position gets the real text;
                        # continuation positions are left empty to preserve alignment
                        occupied[(rr, cc)] = text if (dr == 0 and dc == 0) else ""
            c += colspan
        max_col = max(max_col, c)

    if max_col == 0:
        return ""

    result: list[str] = []
    if caption_line:
        result.append(caption_line)
    for r in range(num_rows):
        cols = [occupied.get((r, c), "") for c in range(max_col)]
        if not any(cols):
            continue
        result.append("| " + " | ".join(cols) + " |")
        if r == 0:
            result.append("|" + "---|" * max_col)

    return "\n".join(result)
