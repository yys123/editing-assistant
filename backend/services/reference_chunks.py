import re
from dataclasses import dataclass
from typing import Iterable, Optional

from models import ReferenceInput


_PLAIN_ENGLISH_HEADING_TERMS = {
    "abstract",
    "introduction",
    "background",
    "methods",
    "results",
    "discussion",
    "conclusion",
    "conclusions",
    "author contributions",
    "acknowledgment",
    "acknowledgement",
    "conflict of interest statement",
    "definition",
    "overview",
    "epidemiology",
    "etiology",
    "pathogenesis",
    "pathophysiology",
    "classification",
    "clinical presentation",
    "clinical presentations",
    "clinical manifestation",
    "clinical manifestations",
    "clinical features",
    "symptom",
    "symptoms",
    "sign",
    "signs",
    "diagnosis",
    "diagnostic evaluation",
    "diagnostic workup",
    "diagnostic criteria",
    "physical examination",
    "examination",
    "examinations",
    "investigation",
    "investigations",
    "laboratory examination",
    "laboratory findings",
    "imaging",
    "imaging examination",
    "differential diagnosis",
    "treatment",
    "therapy",
    "management",
    "surgical treatment",
    "surgical management",
    "operative technique",
    "operation",
    "complication",
    "complications",
    "prevention",
    "screening",
    "prognosis",
    "follow up",
    "follow-up",
    "reference",
    "references",
    "bibliography",
}

_REFERENCE_SECTION_TITLES = {
    "参考文献",
    "参考资料",
    "reference",
    "references",
    "reference list",
    "bibliography",
    "author contributions",
    "acknowledgment",
    "acknowledgement",
    "conflict of interest statement",
}


@dataclass
class ReferenceChunkCandidate:
    chunk_id: str
    source_id: int
    source_filename: str
    title_path: str = ""
    text: str = ""
    context_before: str = ""
    context_after: str = ""
    paragraph_index: int = 0
    source_ref_ids: list[str] = None
    score: float = 0.0
    reason: str = ""

    def __post_init__(self) -> None:
        if self.source_ref_ids is None:
            self.source_ref_ids = []

    def model_dump(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "source_id": self.source_id,
            "source_filename": self.source_filename,
            "title_path": self.title_path,
            "text": self.text,
            "context_before": self.context_before,
            "context_after": self.context_after,
            "paragraph_index": self.paragraph_index,
            "source_ref_ids": self.source_ref_ids,
            "score": self.score,
            "reason": self.reason,
        }


def _strip_plain_heading_numbering(line: str) -> str:
    return re.sub(
        r"^\s*(?:\d+(?:\.\d+)*|[IVXLCDM]+|[A-Z])[\s.)、:-]+",
        "",
        line,
        flags=re.IGNORECASE,
    ).strip()


def _parse_plain_english_heading(line: str) -> Optional[tuple[int, str]]:
    title = _strip_plain_heading_numbering((line or "").strip()).strip(":：")
    if not title or len(title) > 80:
        return None
    if re.search(r"[\u4e00-\u9fff]", title) or not re.search(r"[A-Za-z]", title):
        return None
    if re.search(r"[.!?]$", title):
        return None

    normalized = re.sub(r"[^a-z]+", " ", title.lower()).strip()
    if not normalized:
        return None
    if len(normalized.split()) > 5:
        return None
    if normalized in _PLAIN_ENGLISH_HEADING_TERMS:
        return 2, title
    return None


def _parse_heading(line: str) -> Optional[tuple[int, str]]:
    stripped = (line or "").strip()
    markdown_match = re.match(r"^(#{1,6})\s+(.+?)\s*#*\s*$", stripped)
    if markdown_match:
        return len(markdown_match.group(1)), markdown_match.group(2).strip()
    structured_match = re.match(r"^\[H([1-6])\]\s*(.+?)\s*$", stripped, flags=re.IGNORECASE)
    if structured_match:
        return int(structured_match.group(1)), structured_match.group(2).strip()
    plain_english_heading = _parse_plain_english_heading(stripped)
    if plain_english_heading:
        return plain_english_heading
    return None


def _normalize_section_title(title: str) -> str:
    clean = _strip_plain_heading_numbering((title or "").strip()).strip(":：")
    clean = re.sub(r"\s+", " ", clean)
    if re.search(r"[\u4e00-\u9fff]", clean):
        return re.sub(r"\s+", "", clean)
    return re.sub(r"[^a-z]+", " ", clean.lower()).strip()


def _is_reference_section_title(title: str) -> bool:
    return _normalize_section_title(title) in _REFERENCE_SECTION_TITLES


def _has_markdown_headings(text: str) -> bool:
    return any(_parse_heading(line) for line in (text or "").splitlines())


def _split_paragraphs(text: str) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text or "") if part.strip()]
    if paragraphs:
        return paragraphs
    return [line.strip() for line in (text or "").splitlines() if line.strip()]


def _split_long_text(text: str, target_chars: int) -> list[str]:
    clean = (text or "").strip()
    if len(clean) <= target_chars:
        return [clean] if clean else []
    parts = _split_paragraphs(clean)
    chunks: list[str] = []
    buffer: list[str] = []
    for part in parts:
        current_len = len("\n\n".join(buffer))
        if buffer and current_len + len(part) > target_chars:
            chunks.append("\n\n".join(buffer).strip())
            buffer = []
        if len(part) > target_chars:
            if buffer:
                chunks.append("\n\n".join(buffer).strip())
                buffer = []
            for start in range(0, len(part), target_chars):
                chunks.append(part[start:start + target_chars].strip())
        else:
            buffer.append(part)
    if buffer:
        chunks.append("\n\n".join(buffer).strip())
    return [chunk for chunk in chunks if chunk]


def _extract_source_ref_ids(text: str) -> list[str]:
    ids: list[str] = []
    for match in re.finditer(r"[\[［【]\s*(\d+(?:\s*[-–—]\s*\d+)?)\s*[\]］】]", text or ""):
        value = re.sub(r"\s+", "", match.group(1)).replace("–", "-").replace("—", "-")
        if value not in ids:
            ids.append(value)
    return ids


def _make_candidate(
    ref: ReferenceInput,
    chunk_number: int,
    title_path: str,
    text: str,
    paragraph_index: int,
) -> ReferenceChunkCandidate:
    return ReferenceChunkCandidate(
        chunk_id=f"R{ref.id}-C{chunk_number:03d}",
        source_id=ref.id,
        source_filename=ref.filename,
        title_path=title_path,
        text=text.strip(),
        paragraph_index=paragraph_index,
        source_ref_ids=_extract_source_ref_ids(text),
    )


def _build_heading_chunks(ref: ReferenceInput, target_chars: int) -> list[ReferenceChunkCandidate]:
    chunks: list[ReferenceChunkCandidate] = []
    title_by_level: dict[int, str] = {}
    current_title_path = ""
    buffer: list[str] = []
    buffer_start = 0
    body_index = 0
    skip_reference_level: Optional[int] = None

    def flush() -> None:
        nonlocal buffer, buffer_start
        body = "\n".join(buffer).strip()
        if not body:
            buffer = []
            return
        for part in _split_long_text(body, target_chars):
            chunks.append(_make_candidate(ref, len(chunks) + 1, current_title_path, part, buffer_start))
        buffer = []

    for line in (ref.text or "").splitlines():
        heading = _parse_heading(line)
        if heading:
            flush()
            level, title = heading
            if skip_reference_level is not None:
                if level > skip_reference_level:
                    continue
                skip_reference_level = None
            if _is_reference_section_title(title):
                skip_reference_level = level
                title_by_level = {
                    existing_level: existing_title
                    for existing_level, existing_title in title_by_level.items()
                    if existing_level < level
                }
                current_title_path = " / ".join(title_by_level[key] for key in sorted(title_by_level))
                continue
            title_by_level = {
                existing_level: existing_title
                for existing_level, existing_title in title_by_level.items()
                if existing_level < level
            }
            title_by_level[level] = title
            current_title_path = " / ".join(title_by_level[key] for key in sorted(title_by_level))
            continue

        if skip_reference_level is not None:
            continue

        if line.strip():
            if not buffer:
                buffer_start = body_index
            buffer.append(line.strip())
            body_index += 1
        elif buffer:
            buffer.append("")

    flush()
    return chunks


def _build_paragraph_chunks(ref: ReferenceInput, target_chars: int) -> list[ReferenceChunkCandidate]:
    chunks: list[ReferenceChunkCandidate] = []
    for idx, paragraph in enumerate(_split_paragraphs(ref.text)):
        for part in _split_long_text(paragraph, target_chars):
            chunks.append(_make_candidate(ref, len(chunks) + 1, "", part, idx))
    return chunks


def _attach_context(chunks: list[ReferenceChunkCandidate]) -> None:
    for idx, chunk in enumerate(chunks):
        previous_chunk = chunks[idx - 1] if idx > 0 and chunks[idx - 1].source_id == chunk.source_id else None
        next_chunk = chunks[idx + 1] if idx + 1 < len(chunks) and chunks[idx + 1].source_id == chunk.source_id else None
        chunk.context_before = (previous_chunk.text[-600:] if previous_chunk else "").strip()
        chunk.context_after = (next_chunk.text[:600] if next_chunk else "").strip()


def build_reference_chunks(ref_inputs: list[ReferenceInput], target_chars: int = 1200) -> list[ReferenceChunkCandidate]:
    chunks: list[ReferenceChunkCandidate] = []
    for ref in ref_inputs:
        ref_chunks = (
            _build_heading_chunks(ref, target_chars)
            if _has_markdown_headings(ref.text)
            else _build_paragraph_chunks(ref, target_chars)
        )
        chunks.extend(ref_chunks)
    _attach_context(chunks)
    return chunks


def _tokens(text: str) -> set[str]:
    normalized = re.sub(r"[^\w\u4e00-\u9fff]+", " ", text or "", flags=re.UNICODE).lower()
    tokens = {token for token in normalized.split() if len(token) >= 2}
    compact = re.sub(r"\s+", "", normalized)
    for idx in range(max(0, len(compact) - 1)):
        token = compact[idx:idx + 2]
        if re.search(r"[\u4e00-\u9fff]", token):
            tokens.add(token)
    return tokens


def _contains_any(text: str, terms: Iterable[str]) -> bool:
    lowered = (text or "").lower()
    return any(term and str(term).lower() in lowered for term in terms)


def _matching_terms(text: str, terms: Iterable[str]) -> list[str]:
    lowered = (text or "").lower()
    return [term for term in terms if term and str(term).lower() in lowered]


def _local_title(title_path: str) -> str:
    parts = [
        part.strip()
        for part in re.split(r"[/|]", title_path or "")
        if part.strip()
    ]
    return parts[-1] if parts else ""


def _allowed_title_match_chunks(
    chunks: list[ReferenceChunkCandidate],
    preferred_terms: Iterable[str],
    excluded_terms: Iterable[str],
) -> list[ReferenceChunkCandidate]:
    preferred = list(preferred_terms or [])
    excluded = list(excluded_terms or [])
    if not preferred:
        return []

    matched: list[ReferenceChunkCandidate] = []
    for chunk in chunks:
        local_title = _local_title(chunk.title_path)
        title_hits = _matching_terms(local_title, preferred)
        if not title_hits:
            continue
        if excluded and _contains_any(local_title, excluded):
            continue
        if chunk.score <= 0:
            chunk.score = 4.0 + len(title_hits)
            chunk.reason = "命中标题：" + "、".join(_dedupe_hits(title_hits)[:8])
        matched.append(chunk)
    return matched


def _score(
    query_tokens: set[str],
    chunk: ReferenceChunkCandidate,
    priority_reference_ids: set[int],
    preferred_title_terms: Iterable[str] = (),
) -> tuple[float, list[str]]:
    haystack = f"{chunk.title_path}\n{chunk.text}"
    chunk_tokens = _tokens(haystack)
    hits = sorted(token for token in query_tokens if token in chunk_tokens)
    if not hits:
        return 0.0, []
    score = float(len(hits))
    title_hits = _matching_terms(_local_title(chunk.title_path), preferred_title_terms)
    if title_hits:
        score += 4.0 + len(title_hits)
        hits = [*title_hits, *hits]
    if chunk.source_id in priority_reference_ids:
        score += 2.0
    if re.search(r"指南|共识|guideline|consensus", chunk.source_filename, flags=re.IGNORECASE):
        score += 0.5
    return score, _dedupe_hits(hits)[:8]


def _dedupe_hits(hits: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for hit in hits:
        if hit in seen:
            continue
        seen.add(hit)
        result.append(hit)
    return result


def search_reference_chunks(
    ref_inputs: list[ReferenceInput],
    query: str,
    *,
    priority_reference_ids: Optional[Iterable[int]] = None,
    preferred_title_terms: Optional[Iterable[str]] = None,
    excluded_title_terms: Optional[Iterable[str]] = None,
    limit: int = 30,
) -> list[ReferenceChunkCandidate]:
    chunks = build_reference_chunks(ref_inputs)
    if not chunks:
        return []

    priority_ids = set(priority_reference_ids or [])
    preferred_terms = list(preferred_title_terms or [])
    excluded_terms = list(excluded_title_terms or [])
    query_tokens = _tokens(query)
    scored: list[ReferenceChunkCandidate] = []
    for chunk in chunks:
        chunk.score, hits = _score(query_tokens, chunk, priority_ids, preferred_terms)
        if chunk.score > 0:
            chunk.reason = "命中：" + "、".join(hits)
            scored.append(chunk)

    if scored:
        if excluded_terms:
            filtered = [
                chunk for chunk in scored
                if not _contains_any(_local_title(chunk.title_path), excluded_terms)
            ]
            if filtered:
                scored = filtered
        if preferred_terms:
            title_matched = _allowed_title_match_chunks(chunks, preferred_terms, excluded_terms)
            if title_matched:
                return title_matched[:limit]
        scored.sort(key=lambda item: (-item.score, item.source_id, item.paragraph_index, item.chunk_id))
        return scored[:limit]

    title_matched = _allowed_title_match_chunks(chunks, preferred_terms, excluded_terms)
    if title_matched:
        return title_matched[:limit]

    fallback: list[ReferenceChunkCandidate] = []
    remaining = chunks[:]
    while remaining and len(fallback) < limit:
        seen_sources: set[int] = set()
        next_remaining: list[ReferenceChunkCandidate] = []
        for chunk in remaining:
            if chunk.source_id not in seen_sources and len(fallback) < limit:
                fallback.append(chunk)
                seen_sources.add(chunk.source_id)
            else:
                next_remaining.append(chunk)
        remaining = next_remaining
    for chunk in fallback:
        chunk.reason = "无关键词命中，按来源顺序兜底展示"
    return fallback


def list_reference_chunks(
    ref_inputs: list[ReferenceInput],
    *,
    limit: Optional[int] = None,
) -> list[ReferenceChunkCandidate]:
    chunks = build_reference_chunks(ref_inputs)
    if limit is not None:
        chunks = chunks[:max(1, limit)]
    for chunk in chunks:
        chunk.reason = "全文切片"
    return chunks
