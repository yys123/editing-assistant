import json
import re
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

from models import CitationVerificationItem, CitationVerificationResult, ReferenceAnchor
from services.text_llm import generate_text

MAX_CITATION_VERIFICATION_ITEMS = 40
REVIEW_STATUSES = {"weak", "mismatch", "unverifiable", "unverified"}
VALID_ITEM_STATUSES = {"supported", "weak", "mismatch", "unverifiable", "unverified"}

CITATION_VERIFICATION_SYSTEM_PROMPT = """你是一位严谨的医学编辑，负责核对 AI 整合结果中的引用是否支撑答案句子。

只判断每个 item 的 citation_detail 是否支撑 sentence 的核心事实，不评价整段正文。
允许同义改写；但人群、适应证、禁忌证、时间、剂量、数据、结论方向不一致时应标为 mismatch。
主题相关但支撑不完整时标为 weak；信息不足无法判断时标为 unverifiable。
必须输出严格 JSON，不要输出 Markdown。每条返回必须原样带回 input_id。
"""


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


def _strip_markdown_fence(text: str) -> str:
    value = (text or "").strip()
    if value.startswith("```"):
        value = re.sub(r"^```(?:json)?\s*", "", value, flags=re.IGNORECASE)
        value = re.sub(r"\s*```$", "", value)
    return value.strip()


def _build_verification_prompt(ai_inputs: list[CitationVerificationInput]) -> str:
    payload = {
        "items": [
            {
                "input_id": item.input_id,
                "citation_key": item.item.citation_key,
                "anchor_key": item.item.anchor_key,
                "sentence": item.item.sentence,
                "source_label": item.item.source_label,
                "quote": item.item.quote,
                "context_before": item.context_before,
                "context_after": item.context_after,
            }
            for item in ai_inputs
        ]
    }
    return (
        "请逐条判断 citation_detail 是否支撑 sentence。\n"
        "返回 JSON 格式："
        '{"items":[{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"supported","reason":"理由"}]}\n'
        "status 只能是 supported、weak、mismatch、unverifiable。必须原样回传每条 input_id。\n\n"
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def _parse_verification_response(raw: str) -> list[dict]:
    parsed = json.loads(_strip_markdown_fence(raw))
    items = parsed.get("items") if isinstance(parsed, dict) else None
    if not isinstance(items, list):
        raise ValueError("citation verification response missing items")
    return [item for item in items if isinstance(item, dict)]


def _copy_item_with_judgment(
    item: CitationVerificationItem,
    *,
    status: str,
    reason: str,
) -> CitationVerificationItem:
    if status not in VALID_ITEM_STATUSES:
        status = "unverified"
    return item.model_copy(update={
        "status": status,
        "reason": str(reason or "").strip(),
    })


def _merge_judgments(
    items: list[CitationVerificationItem],
    ai_inputs: list[CitationVerificationInput],
    judgments: list[dict],
) -> list[CitationVerificationItem]:
    merged = [item.model_copy() for item in items]
    index_by_input_id: dict[str, int] = {}
    fallback_index: dict[tuple[str, str, str], int] = {}

    for verification_input in ai_inputs:
        item_index = next(
            (idx for idx, item in enumerate(items) if item is verification_input.item),
            -1,
        )
        if item_index < 0:
            continue
        index_by_input_id[verification_input.input_id] = item_index
        item = verification_input.item
        fallback_index[(item.anchor_key or item.citation_key, item.sentence, item.quote)] = item_index

    for judgment in judgments:
        target_index = index_by_input_id.get(str(judgment.get("input_id") or ""))
        if target_index is None:
            fallback_key = (
                str(judgment.get("anchor_key") or judgment.get("citation_key") or ""),
                str(judgment.get("sentence") or ""),
                str(judgment.get("quote") or ""),
            )
            target_index = fallback_index.get(fallback_key)
        if target_index is None:
            continue
        merged[target_index] = _copy_item_with_judgment(
            merged[target_index],
            status=str(judgment.get("status") or "unverified"),
            reason=str(judgment.get("reason") or ""),
        )
    return merged


def _result_from_items(
    items: list[CitationVerificationItem],
    warnings: list[str],
) -> CitationVerificationResult:
    if not items:
        return CitationVerificationResult(status="not_run", warnings=warnings)
    status = "needs_review" if any(item.status in REVIEW_STATUSES for item in items) else "passed"
    return CitationVerificationResult(status=status, items=items, warnings=warnings)


async def verify_ai_integration_citations(
    text: str,
    reference_anchors: list[ReferenceAnchor],
    *,
    text_generator: Callable[..., Awaitable[str]] = generate_text,
    limit: int = MAX_CITATION_VERIFICATION_ITEMS,
) -> CitationVerificationResult:
    build = build_citation_verification_inputs(text, reference_anchors, limit=limit)
    if not build.items:
        return CitationVerificationResult(status="not_run", warnings=["未检测到可核对的引用。"])
    if not build.ai_inputs:
        return _result_from_items(build.items, build.warnings)

    prompt = _build_verification_prompt(build.ai_inputs)
    try:
        raw = await text_generator(
            prompt,
            CITATION_VERIFICATION_SYSTEM_PROMPT,
            context="ai_integration_citation_verification",
        )
        judged = _parse_verification_response(raw)
    except Exception:
        return CitationVerificationResult(
            status="failed",
            items=build.items,
            warnings=[*build.warnings, "引用核对未完成，请人工检查。"],
        )

    merged = _merge_judgments(build.items, build.ai_inputs, judged)
    return _result_from_items(merged, build.warnings)
