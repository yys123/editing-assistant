import re
import base64
import httpx
from bs4 import BeautifulSoup, Tag, NavigableString
from typing import List, Dict, Any, Optional
from services.document import _mark_inline_sentence_citations

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
_SUPERSCRIPT_REF_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹"
_SUPERSCRIPT_REF_TRANSLATION = str.maketrans({
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
_UNICODE_SUP_REF_RE = re.compile(
    rf"[{_SUPERSCRIPT_REF_DIGITS}]+(?:\s*[,，、;；\-–—⁻]\s*[{_SUPERSCRIPT_REF_DIGITS}]+)*"
)


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


def _looks_like_unicode_reference_sup_text(text: str, start: int, end: int) -> bool:
    before = (text or "")[:start].rstrip()
    after = (text or "")[end:].lstrip()
    if not before:
        return False

    prev_char = before[-1:]
    next_char = after[:1]
    normalized = (text or "")[start:end].translate(_SUPERSCRIPT_REF_TRANSLATION)
    digits = re.sub(r"\D+", "", normalized)
    if prev_char and re.match(r"[\d×*/+\-=^]", prev_char):
        return False
    if next_char and re.match(r"[\d/]", next_char):
        return False
    if len(digits) >= 2 and re.match(r"[A-Za-z\u4e00-\u9fff]", prev_char):
        return True
    return bool(prev_char and re.match(r"[.,;:，。；、)\]）】]", prev_char))


def _mark_unicode_superscript_citations(text: str) -> str:
    def replace(match: re.Match) -> str:
        if not _looks_like_unicode_reference_sup_text(text, match.start(), match.end()):
            return match.group(0)
        normalized = match.group(0).translate(_SUPERSCRIPT_REF_TRANSLATION)
        normalized = re.sub(r"\s+", "", normalized)
        normalized = normalized.replace("，", ",").replace("、", ",")
        normalized = normalized.replace("；", ",").replace(";", ",")
        normalized = normalized.replace("–", "-").replace("—", "-").replace("⁻", "-")
        return f"[{normalized}]"

    return _UNICODE_SUP_REF_RE.sub(replace, text or "")


def _clean_extracted_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    text = re.sub(r"^\s*null\s+", "", text, flags=re.I)
    return text


def _append_line(lines: list[str], text: str) -> None:
    text = _clean_extracted_text(text)
    if text:
        lines.append(text)


def _meta_values(soup: BeautifulSoup, *names: str) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    wanted = {name.lower() for name in names}
    for meta in soup.find_all("meta"):
        name = str(meta.get("name") or "").lower()
        if name not in wanted:
            continue
        value = _clean_extracted_text(str(meta.get("content") or ""))
        if value and value not in seen:
            values.append(value)
            seen.add(value)
    return values


def _first_cjk_value(values: list[str]) -> str:
    for value in values:
        if re.search(r"[\u4e00-\u9fff]", value):
            return value
    return values[0] if values else ""


def _split_keyword_values(values: list[str]) -> list[str]:
    keywords: list[str] = []
    seen: set[str] = set()
    for value in values:
        for part in re.split(r"[;；]", value):
            keyword = _clean_extracted_text(part)
            if keyword and keyword not in seen:
                keywords.append(keyword)
                seen.add(keyword)
    return keywords


def _looks_like_cma_journal_page(soup: BeautifulSoup) -> bool:
    if not soup.select_one(".body_content"):
        return False
    has_title = bool(_meta_values(soup, "citation_title", "eprints.title", "DC.title"))
    if not has_title:
        return False
    identifiers = " ".join(
        _meta_values(
            soup,
            "citation_doi",
            "citation_journal_title",
            "eprints.institution",
            "eprints.publisher",
            "DC.publisher",
            "DC.relation",
        )
    )
    return bool(
        re.search(r"中华医学会|中华医学|Chinese Medical|cma\.j|rs\.yiigle\.com", identifiers, re.I)
    )


def _append_cma_front_matter(soup: BeautifulSoup, lines: list[str], structured: bool) -> None:
    titles = _meta_values(soup, "citation_title", "eprints.title", "DC.title")
    title = _first_cjk_value(titles)
    if title:
        _append_line(lines, f"[H1] {title}" if structured else title)

    english_titles = [value for value in titles if value != title]
    if english_titles:
        _append_line(lines, f"英文题名：{english_titles[0]}")

    authors = _meta_values(soup, "citation_author", "eprints.creators_name", "DC.creator")
    if authors:
        _append_line(lines, f"作者：{'；'.join(authors)}")

    journal = _first_cjk_value(_meta_values(soup, "citation_journal_title", "jour-name", "eprints.publication"))
    if journal:
        _append_line(lines, f"期刊：{journal}")

    date = _first_cjk_value(_meta_values(soup, "citation_publication_date", "eprints.date", "DC.date"))
    if date:
        _append_line(lines, f"出版日期：{date}")

    volume = _first_cjk_value(_meta_values(soup, "citation_volume", "eprints.volume"))
    issue = _first_cjk_value(_meta_values(soup, "citation_issue", "eprints.number"))
    first_page = _first_cjk_value(_meta_values(soup, "citation_firstpage"))
    last_page = _first_cjk_value(_meta_values(soup, "citation_lastpage"))
    if volume or issue or first_page or last_page:
        page_range = ""
        if first_page and last_page:
            page_range = f"，页码：{first_page}-{last_page}"
        elif first_page:
            page_range = f"，页码：{first_page}"
        _append_line(lines, f"卷期：{volume or ''}({issue or ''}){page_range}".strip())

    doi = _first_cjk_value(_meta_values(soup, "citation_doi", "eprints.doi"))
    if doi:
        _append_line(lines, f"DOI：{doi}")


def _append_cma_abstracts(soup: BeautifulSoup, lines: list[str], structured: bool) -> None:
    abstracts = [
        _extract_text_with_refs(tag)
        for tag in soup.select(".abstract_sec_main .abstract_content")
    ]
    if not abstracts:
        abstracts = _meta_values(soup, "citation_abstract", "eprints.abstract", "DC.description")

    chinese_abstract = _first_cjk_value(abstracts)
    if chinese_abstract:
        if structured:
            _append_line(lines, "[H2] 摘要")
        else:
            _append_line(lines, "摘要")
        _append_line(lines, chinese_abstract)

    keywords = _split_keyword_values(_meta_values(soup, "citation_keyword", "eprints.keywords", "DC.subject"))
    chinese_keywords = [value for value in keywords if re.search(r"[\u4e00-\u9fff]", value)]
    if chinese_keywords:
        _append_line(lines, f"关键词：{'；'.join(chinese_keywords)}")

    for abstract in abstracts:
        if abstract and abstract != chinese_abstract and not re.search(r"[\u4e00-\u9fff]", abstract):
            _append_line(lines, "ABSTRACT" if not structured else "[H2] ABSTRACT")
            _append_line(lines, abstract)
            break

    english_keywords = [value for value in keywords if not re.search(r"[\u4e00-\u9fff]", value)]
    if english_keywords:
        _append_line(lines, f"KEYWORDS：{'; '.join(english_keywords)}")


def _append_cma_body_section(sec: Tag, lines: list[str], structured: bool) -> None:
    title_tag = sec.find(
        lambda tag: isinstance(tag, Tag)
        and "title" in (tag.get("class") or []),
        recursive=False,
    )
    title = _extract_text_with_refs(title_tag) if title_tag else ""
    if title:
        _append_line(lines, f"[H2] {title}" if structured else title)

    for child in sec.children:
        if isinstance(child, NavigableString):
            _append_line(lines, str(child))
            continue
        if not isinstance(child, Tag) or child is title_tag:
            continue
        if child.name in _SKIP_TAGS:
            continue
        if child.name == "table":
            _append_line(lines, _table_to_markdown(child))
            continue
        if "title" in (child.get("class") or []):
            continue
        text = _extract_text_with_refs(child)
        if text:
            _append_line(lines, text)


def _append_cma_body(soup: BeautifulSoup, lines: list[str], structured: bool) -> None:
    body = soup.select_one(".body_content")
    if not body:
        return
    for sec in body.find_all(
        lambda tag: isinstance(tag, Tag)
        and tag.name == "div"
        and "sec" in (tag.get("class") or []),
        recursive=False,
    ):
        _append_cma_body_section(sec, lines, structured)


def _append_cma_references_and_notes(soup: BeautifulSoup, lines: list[str], structured: bool) -> None:
    ref_sec = soup.select_one(".back .ref_sec")
    if ref_sec:
        if structured:
            _append_line(lines, "[H2] 参考文献")
        else:
            _append_line(lines, "参考文献")
        ref_items = ref_sec.find_all(
            lambda child: isinstance(child, Tag)
            and child.name in {"div", "li"}
            and "ref" in (child.get("class") or [])
            and re.fullmatch(r"R\d+", str(child.get("id") or "")),
        )
        if ref_items:
            for ref in ref_items:
                ref_no = str(ref.get("id") or "").lstrip("R")
                contents = ref.select(".ref_content")
                if not contents:
                    contents = [ref]
                for index, content_tag in enumerate(contents):
                    text = _extract_text_with_refs(content_tag)
                    text = re.sub(r"\s*返回引文位置.*$", "", text).strip()
                    if not text:
                        continue
                    prefix = f"[{ref_no}] " if index == 0 and ref_no else ""
                    _append_line(lines, f"{prefix}{text}")
        else:
            for tag in ref_sec.find_all(
                lambda child: isinstance(child, Tag)
                and child.name in {"div", "li", "p"}
                and child is not ref_sec,
            ):
                classes = tag.get("class") or []
                text = _extract_text_with_refs(tag)
                if not text or text == "参考文献" or "ref_title" in classes:
                    continue
                text = re.sub(r"\s*返回引文位置.*$", "", text).strip()
                _append_line(lines, text)

    note_sec = soup.select_one(".back .foot_note_sec")
    if note_sec:
        if structured:
            _append_line(lines, "[H2] 备注信息")
        else:
            _append_line(lines, "备注信息")
        for tag in note_sec.find_all(["div", "p"], recursive=False):
            text = _extract_text_with_refs(tag)
            if text and text != "备注信息":
                _append_line(lines, text)


def _dedupe_lines(lines: list[str]) -> list[str]:
    deduped: list[str] = []
    seen_consecutive = None
    for line in lines:
        clean = _clean_extracted_text(line)
        if not clean or clean == seen_consecutive:
            continue
        deduped.append(clean)
        seen_consecutive = clean
    return deduped


def _parse_cma_journal_page(soup: BeautifulSoup, structured: bool) -> Optional[str]:
    if not _looks_like_cma_journal_page(soup):
        return None

    lines: list[str] = []
    _append_cma_front_matter(soup, lines, structured)
    _append_cma_abstracts(soup, lines, structured)
    _append_cma_body(soup, lines, structured)
    _append_cma_references_and_notes(soup, lines, structured)
    return "\n".join(_dedupe_lines(lines))


def _clean_cnki_text(text: str) -> str:
    text = _clean_extracted_text(text)
    text = text.replace("解决无障碍阅读Errors", " ")
    text = re.sub(r"^(?:删除\s*)+(?:颜色\s*)?(?:笔记\s*)?(?:摘录\s*)?", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_cnki_text(tag: Optional[Tag]) -> str:
    if not tag:
        return ""
    return _clean_cnki_text(_extract_text_with_refs(tag))


def _looks_like_cnki_reader_page(soup: BeautifulSoup) -> bool:
    root = soup.select_one("#paperRead")
    if not root:
        return False
    if root.select_one(".js-studyAchievement"):
        return True
    title = soup.find("title")
    return bool(title and "HTML阅读-" in title.get_text("", strip=True))


def _append_cnki_front_matter(root: Tag, lines: list[str], structured: bool) -> None:
    title_tag = root.select_one(".js-studyAchievement .ChapterH1 h1, .js-studyAchievement h1.Chapter")
    title = _extract_cnki_text(title_tag)
    if title:
        _append_line(lines, f"[H1] {title}" if structured else title)

    source = _extract_cnki_text(root.select_one(".source-info"))
    if source:
        _append_line(lines, f"来源：{source}")

    msg = root.select_one(".js-studyAchievement .ChapterMsg")
    people_groups = msg.select("ul.Chapter-people") if msg else []
    if people_groups:
        authors = [
            _extract_cnki_text(item)
            for item in people_groups[0].find_all("li", recursive=False)
        ]
        authors = [author for author in authors if author]
        if authors:
            _append_line(lines, f"作者：{'；'.join(authors)}")

    if len(people_groups) > 1:
        units = [
            _extract_cnki_text(item)
            for item in people_groups[1].find_all("li", recursive=False)
        ]
        units = [unit for unit in units if unit]
        if units:
            _append_line(lines, f"单位：{'；'.join(units)}")

    front_wrap = root.select_one(".js-studyAchievement > .wrap")
    if front_wrap:
        for meta in front_wrap.select(".ChapterP"):
            text = _extract_cnki_text(meta)
            if text:
                _append_line(lines, text)


def _append_cnki_body(root: Tag, lines: list[str], structured: bool) -> None:
    body_wraps = root.select(".js-studyAchievement > .wrap")
    for body in body_wraps[1:]:
        for block in body.select(".ChapterWrap"):
            heading = block.find(_HEADING_TAGS)
            if heading:
                text = _extract_cnki_text(heading)
                if text:
                    _append_line(lines, f"[H2] {text}" if structured else text)
                continue
            text = _extract_cnki_text(block)
            if text:
                _append_line(lines, text)


def _cnki_reference_lines_from_right_panel(soup: BeautifulSoup) -> list[str]:
    ref_panel = soup.select_one(".pdf-right-content .liter-scrolltop")
    if not ref_panel:
        return []
    lines: list[str] = []
    for item in ref_panel.select(".note-list > li"):
        text = _extract_cnki_text(item)
        if not text:
            continue
        text = re.sub(r"^\[?(\d+)\]?\s*", r"[\1] ", text)
        lines.append(text)
    return _dedupe_lines(lines)


def _cnki_reference_lines_from_article(root: Tag) -> list[str]:
    ref_box = root.select_one(".references-box")
    if not ref_box:
        return []
    lines: list[str] = []
    for item in ref_box.find_all(["p", "li"], recursive=True):
        text = _extract_cnki_text(item)
        if not text or text == "参考文献":
            continue
        text = re.sub(r"^\[?(\d+)\]?\s*", r"[\1] ", text)
        lines.append(text)
    return _dedupe_lines(lines)


def _append_cnki_references(soup: BeautifulSoup, root: Tag, lines: list[str], structured: bool) -> None:
    refs = _cnki_reference_lines_from_right_panel(soup)
    if not refs:
        refs = _cnki_reference_lines_from_article(root)
    if not refs:
        return
    _append_line(lines, "[H2] 参考文献" if structured else "参考文献")
    for ref in refs:
        _append_line(lines, ref)


def _parse_cnki_reader_page(soup: BeautifulSoup, structured: bool) -> Optional[str]:
    if not _looks_like_cnki_reader_page(soup):
        return None

    root = soup.select_one("#paperRead")
    if not root:
        return None

    lines: list[str] = []
    _append_cnki_front_matter(root, lines, structured)
    _append_cnki_body(root, lines, structured)
    _append_cnki_references(soup, root, lines, structured)
    return "\n".join(_dedupe_lines(lines))


def _normalize_reference_sup_text(text: str) -> str:
    compact = re.sub(r"\s+", "", text)
    if (
        len(compact) >= 2
        and compact[0] in "[［【"
        and compact[-1] in "]］】"
    ):
        compact = compact[1:-1]
    if not re.fullmatch(r"\d+(?:[,，、;；\-~～至–—]\d+)*", compact):
        return ""
    normalized = re.sub(r"[，、;；]", ",", compact)
    return re.sub(r"[~～至–—]", "-", normalized)


def _is_reference_sup_text(text: str) -> bool:
    return bool(_normalize_reference_sup_text(text))


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
    if prev_char and re.match(r"[.,;:，。；、)\]）】]", prev_char):
        return True
    if next_char and re.match(r"[a-z0-9/]", next_char):
        return False

    return True


def _reference_id_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").strip().lstrip("#").lower())


def _is_common_reference_target_id(value: str) -> bool:
    key = _reference_id_key(value)
    return bool(re.fullmatch(r"(?:r|ref|refs|bib|bibr|cit|citation)\d+", key))


def _is_reference_container(tag: Tag) -> bool:
    values = [
        str(tag.get("id") or ""),
        " ".join(tag.get("class") or []),
        str(tag.get("aria-label") or ""),
        str(tag.get("role") or ""),
    ]
    joined = " ".join(values).lower()
    return bool(re.search(r"references?|ref[-_\s]?list|bibliograph|citations?", joined))


def _collect_reference_target_ids(root: Tag) -> set[str]:
    targets: set[str] = set()
    for tag in root.find_all(True):
        tag_id = str(tag.get("id") or "")
        tag_name = str(tag.get("name") or "")
        if _is_common_reference_target_id(tag_id):
            targets.add(_reference_id_key(tag_id))
        if _is_common_reference_target_id(tag_name):
            targets.add(_reference_id_key(tag_name))

    for container in root.find_all(_is_reference_container):
        for tag in container.find_all(True):
            tag_id = str(tag.get("id") or "")
            tag_name = str(tag.get("name") or "")
            if tag_id:
                targets.add(_reference_id_key(tag_id))
            if tag_name:
                targets.add(_reference_id_key(tag_name))
    return targets


def _anchor_target_key(tag: Tag) -> str:
    href = str(tag.get("href") or "")
    rid = str(tag.get("rid") or "")
    if rid:
        return _reference_id_key(rid)
    if "#" in href:
        return _reference_id_key(href.rsplit("#", 1)[-1])
    return ""


def _looks_like_reference_anchor(tag: Tag, reference_targets: Optional[set[str]] = None) -> bool:
    text = tag.get_text(" ", strip=True)
    if not _is_reference_sup_text(text):
        return False

    target = _anchor_target_key(tag)
    if reference_targets and target:
        return target in reference_targets

    classes = " ".join(tag.get("class") or []).lower()
    href = str(tag.get("href") or "").lower()
    rid = str(tag.get("rid") or "").lower()
    if any(key in classes for key in ("xref", "bibr", "citation", "reference", "ref")):
        return True
    if re.search(r"(?:^#|ref|bibr|citation|^javascript)", href):
        return True
    if re.search(r"^r\d+$|^ref", rid):
        return True
    return False


def _extract_text_with_refs(tag: Tag, reference_targets: Optional[set[str]] = None) -> str:
    """Recursively extract text, converting literature-sup elements to [N] notation.

    <sup class="literature-sup">2,3</sup> → [2,3]

    All other elements are traversed normally.  Whitespace is normalised.
    """
    parts: list[str] = []
    for child in tag.children:
        if isinstance(child, NavigableString):
            parts.append(str(child))
        elif isinstance(child, Tag):
            classes = child.get("class") or []
            if child.name == "sup" and "literature-sup" in classes:
                ref = _normalize_reference_sup_text(child.get_text(" ", strip=True))
                if ref:
                    parts.append(f"[{ref}]")
            elif child.name == "sup" and _looks_like_reference_sup(child):
                ref = _normalize_reference_sup_text(child.get_text(" ", strip=True))
                parts.append(f"[{ref}]")
            elif child.name == "a" and _looks_like_reference_anchor(child, reference_targets):
                ref = _normalize_reference_sup_text(child.get_text(" ", strip=True))
                parts.append(f"[{ref}]")
            elif child.name in {"sup", "sub"}:
                parts.append(_script_text(child.get_text(" ", strip=True), child.name))
            else:
                parts.append(_extract_text_with_refs(child, reference_targets))
    return _mark_unicode_superscript_citations(re.sub(r"\s+", " ", "".join(parts)).strip())


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

def parse_html_structured(html: str, preserve_leading_text: bool = False) -> str:
    """Parse HTML into a structured text preserving heading hierarchy,
    image captions and tables.  Stops before the References section.

    Output markers:
        [H1] / [H2] / [H3] – detected headings
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

    cnki_text = _parse_cnki_reader_page(soup, structured=True)
    if cnki_text:
        return cnki_text

    cma_text = _parse_cma_journal_page(soup, structured=True)
    if cma_text:
        return cma_text

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
                if level <= 2:
                    lines.append(f"[H{level}] {text}")
                elif _H3_PAREN_RE.match(text):
                    lines.append(f"[H3] {text}")
                else:
                    lines.append(text)
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

    if not preserve_leading_text:
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
            # Keep [N] / [N-M] reference citations in table cells.
            cells = [c.strip() for c in stripped.split('\t')]
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
                # Keep [N] citations in table continuation text.
                clean_with_refs = stripped.strip()
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

    cnki_text = _parse_cnki_reader_page(soup, structured=False)
    if cnki_text:
        return cnki_text

    cma_text = _parse_cma_journal_page(soup, structured=False)
    if cma_text:
        return cma_text

    main = (
        soup.find("article")
        or soup.find("main")
        or soup.find(class_=lambda c: c and any(
            k in str(c).lower() for k in ["content", "article", "entry", "post", "body"]
        ))
        or soup.find("body")
    )

    root = main or soup
    reference_targets = _collect_reference_target_ids(root)
    block_tags = _HEADING_TAGS | _TEXT_BLOCK_TAGS
    blocks = [root] if isinstance(root, Tag) and root.name in block_tags else list(root.find_all(block_tags))

    lines = []
    for tag in blocks:
        parent = tag.parent
        nested = False
        while isinstance(parent, Tag) and parent is not root:
            if parent.name in block_tags:
                nested = True
                break
            parent = parent.parent
        if nested:
            continue
        text = _extract_text_with_refs(tag, reference_targets)
        text = _mark_inline_sentence_citations(text)
        if text:
            lines.append(text)

    if not lines:
        text = _extract_text_with_refs(root, reference_targets)
        text = _mark_inline_sentence_citations(text)
        lines = [text] if text else []
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

    If the table has a <caption> element, its text (including [N] ref markers)
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
