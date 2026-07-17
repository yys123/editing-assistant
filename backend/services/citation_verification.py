import json
import re
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

from models import CitationVerificationItem, CitationVerificationResult, ReferenceAnchor
from services.text_llm import generate_text

MAX_CITATION_VERIFICATION_ITEMS = 40
REVIEW_STATUSES = {"weak", "mismatch", "unverifiable", "unverified"}
VALID_ITEM_STATUSES = {"supported", "weak", "mismatch", "unverifiable", "unverified"}


@dataclass
class CitationVerificationInput:
    input_id: str
    item: CitationVerificationItem
    context_before: str = ""
    context_after: str = ""


@dataclass
class VerificationBuildResult:
    items: list[CitationVerificationItem]
    ai_inputs: list[CitationVerificationInput]
    warnings: list[str]


_CITATION_GROUP_RE = re.compile(r"[\[［【]\s*([^\]］】]+?)\s*[\]］】]")
_CITATION_SPLIT_RE = re.compile(r"\s*[、,，;；]\s*")


def _normalize_citation_token(token: str) -> str:
    return re.sub(r"\s+", "", token or "").replace("–", "-").replace("—", "-").upper()


def _split_citation_tokens(group_body: str) -> list[str]:
    tokens: list[str] = []
    for raw_token in _CITATION_SPLIT_RE.split(group_body or ""):
        token = _normalize_citation_token(raw_token)
        if re.fullmatch(r"R\d+-C\d+", token, flags=re.IGNORECASE):
            tokens.append(token)
        elif re.fullmatch(r"\d+(?:-\d+)?", token):
            tokens.append(token)
    return tokens


def _sentence_around(text: str, citation_start: int) -> str:
    value = text or ""
    left_candidates = [value.rfind(mark, 0, citation_start) for mark in "。！？!?；;\n"]
    left = max(left_candidates) + 1 if left_candidates else 0
    right_positions = [
        pos for pos in (value.find(mark, citation_start) for mark in "。！？!?；;\n")
        if pos >= 0
    ]
    right = min(right_positions) + 1 if right_positions else len(value)
    return re.sub(r"\s+", " ", value[left:right]).strip()


def _anchors_with_keys(reference_anchors: list[ReferenceAnchor]) -> list[tuple[str, ReferenceAnchor]]:
    counts: dict[str, int] = {}
    for anchor in reference_anchors:
        counts[anchor.citation_key] = counts.get(anchor.citation_key, 0) + 1
    seen: dict[str, int] = {}
    keyed: list[tuple[str, ReferenceAnchor]] = []
    for anchor in reference_anchors:
        if counts.get(anchor.citation_key, 0) <= 1:
            keyed.append((anchor.citation_key, anchor))
            continue
        index = seen.get(anchor.citation_key, 0) + 1
        seen[anchor.citation_key] = index
        keyed.append((f"{anchor.citation_key}~{index}", anchor))
    return keyed


def _normalize_search_text(text: str) -> str:
    text = re.sub(
        r"\^?(?:<sup>)?[\[［【](?:R\d+-C\d+|Q?\d+|\d+\s*[-–—]\s*\d+)(?:\s*[、,，]\s*(?:R\d+-C\d+|Q?\d+|\d+\s*[-–—]\s*\d+))*[\]］】](?:</sup>)?",
        " ",
        text or "",
        flags=re.IGNORECASE,
    )
    text = re.sub(r"[^\w\u4e00-\u9fff]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip().lower()


def _search_tokens(text: str) -> set[str]:
    normalized = _normalize_search_text(text)
    tokens = {token for token in normalized.split() if len(token) >= 2}
    compact = re.sub(r"\s+", "", normalized)
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
    overlap = query_tokens & candidate_tokens
    return len(overlap) / max(1.0, len(candidate_tokens) ** 0.5)


def _anchor_matches_token(token: str, anchor_key: str, anchor: ReferenceAnchor) -> bool:
    normalized = _normalize_citation_token(token)
    return (
        normalized == _normalize_citation_token(anchor_key)
        or normalized == _normalize_citation_token(anchor.citation_key)
        or (anchor.chunk_id and normalized == _normalize_citation_token(anchor.chunk_id))
    )


def _best_anchor_for_token(
    token: str,
    sentence: str,
    keyed_anchors: list[tuple[str, ReferenceAnchor]],
) -> Optional[tuple[str, ReferenceAnchor]]:
    matches = [
        (anchor_key, anchor)
        for anchor_key, anchor in keyed_anchors
        if _anchor_matches_token(token, anchor_key, anchor)
    ]
    if not matches:
        return None
    return max(matches, key=lambda item: _overlap_score(sentence, item[1].quote))


def _source_label(anchor: ReferenceAnchor) -> str:
    if anchor.source_id == 0:
        label = anchor.source_filename or "原词条内容"
    else:
        label = f"参考数据源 {anchor.source_id}：{anchor.source_filename}"
    if anchor.title_path:
        label = f"{label}｜标题路径：{anchor.title_path}"
    return label


def _build_inputs_from_text(
    text: str,
    reference_anchors: list[ReferenceAnchor],
    limit: int,
) -> VerificationBuildResult:
    keyed_anchors = _anchors_with_keys(reference_anchors)
    pending: list[tuple[CitationVerificationItem, ReferenceAnchor | None]] = []
    seen: set[tuple[str, str, str]] = set()

    for match in _CITATION_GROUP_RE.finditer(text or ""):
        sentence = _sentence_around(text, match.start())
        for token in _split_citation_tokens(match.group(1)):
            best = _best_anchor_for_token(token, sentence, keyed_anchors)
            if best is None:
                item = CitationVerificationItem(
                    citation_key=token,
                    sentence=sentence,
                    status="unverifiable",
                    reason="未找到可点击详情，请人工核查。",
                )
                key = (item.sentence, item.citation_key, item.quote)
                if key not in seen:
                    pending.append((item, None))
                    seen.add(key)
                continue

            anchor_key, anchor = best
            item = CitationVerificationItem(
                citation_key=anchor.citation_key,
                anchor_key=anchor_key,
                sentence=sentence,
                source_label=_source_label(anchor),
                quote=anchor.quote,
            )
            key = (item.sentence, item.citation_key, item.quote)
            if key not in seen:
                pending.append((item, anchor))
                seen.add(key)

    warnings: list[str] = []
    if len(pending) > limit:
        warnings.append(f"引用数量超过 {limit} 条，仅核对前 {limit} 条。")
        pending = pending[:limit]

    items = [item for item, _ in pending]
    ai_inputs: list[CitationVerificationInput] = []
    ai_index = 1
    for item, anchor in pending:
        if anchor is None:
            continue
        ai_inputs.append(
            CitationVerificationInput(
                input_id=f"v{ai_index}",
                item=item,
                context_before=anchor.context_before,
                context_after=anchor.context_after,
            )
        )
        ai_index += 1
    return VerificationBuildResult(items=items, ai_inputs=ai_inputs, warnings=warnings)


def build_citation_verification_inputs(
    text: str,
    reference_anchors: list[ReferenceAnchor],
    limit: int = MAX_CITATION_VERIFICATION_ITEMS,
) -> VerificationBuildResult:
    return _build_inputs_from_text(text, reference_anchors, limit)
