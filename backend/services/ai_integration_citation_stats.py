import re
from datetime import datetime
from typing import Any, Optional


CITATION_STATUS_META = [
    {
        "status": "mismatch",
        "label": "不匹配已自动删除",
        "tone": "danger",
        "color": "#D92D20",
        "summary_mode": "total_ratio",
    },
    {
        "status": "weak",
        "label": "红色 / 支撑较弱",
        "tone": "danger",
        "color": "#D92D20",
        "summary_mode": "review_breakdown",
    },
    {
        "status": "unverifiable",
        "label": "黄色 / 无法判断",
        "tone": "warning",
        "color": "#D97706",
        "summary_mode": "review_breakdown",
    },
    {
        "status": "unverified",
        "label": "灰色 / 未完成核对",
        "tone": "neutral",
        "color": "#667085",
        "summary_mode": "review_breakdown",
    },
    {
        "status": "supported",
        "label": "默认 / 核对通过",
        "tone": "success",
        "color": "#5F3FE2",
        "summary_mode": "review_breakdown",
    },
]

VALID_CITATION_STATUSES = {item["status"] for item in CITATION_STATUS_META}
VALID_REVIEW_STATUSES = {"confirmed", "rejected"}
_CITATION_GROUP_RE = re.compile(r"\^?(?:<sup>)?[\[［【]\s*([^\]］】]+?)\s*[\]］】](?:</sup>)?", re.IGNORECASE)
_CITATION_SPLIT_RE = re.compile(r"\s*[、,，;；]\s*")
_CITATION_MARKER_RE = re.compile(r"\^?(?:<sup>)?[\[［【][^\]］】]+?[\]］】](?:</sup>)?", re.IGNORECASE)


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _item_status(item: dict) -> str:
    status = str(item.get("status") or "unverified")
    return status if status in VALID_CITATION_STATUSES else "unverified"


def _normalize_key(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "")).replace("–", "-").replace("—", "-").upper()


def _normalize_sentence(value: Any) -> str:
    without_citations = _CITATION_MARKER_RE.sub(" ", str(value or ""))
    return re.sub(r"\s+", " ", without_citations).strip()


def _parse_review_time(action: dict) -> float:
    value = str(action.get("reviewed_at") or "")
    if not value:
        return 0.0
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def _split_tokens(group_body: str) -> list[str]:
    tokens: list[str] = []
    for raw_token in _CITATION_SPLIT_RE.split(group_body or ""):
        token = _normalize_key(raw_token)
        if re.fullmatch(r"R\d+-C\d+", token, flags=re.IGNORECASE):
            tokens.append(token)
        elif re.fullmatch(r"Q?\d+(?:-\d+)?", token):
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


def _display_text(record: dict) -> str:
    revision_text = str(record.get("revisionText") or record.get("revision_text") or "").strip()
    if revision_text:
        return revision_text
    return str(record.get("answer") or "")


def _review_keys(payload: dict) -> list[tuple[str, str]]:
    citation_key = _normalize_key(payload.get("citation_key"))
    anchor_key = _normalize_key(payload.get("anchor_key"))
    sentence = _normalize_sentence(payload.get("sentence"))
    keys: list[tuple[str, str]] = []
    for key in (anchor_key, citation_key):
        if key and (key, sentence) not in keys:
            keys.append((key, sentence))
    return keys or [("", sentence)]


def _latest_review_actions(record: dict) -> dict[tuple[str, str], dict]:
    latest: dict[tuple[str, str], dict] = {}
    actions = [action for action in _safe_list(record.get("citationReviewActions")) if isinstance(action, dict)]
    actions.sort(key=_parse_review_time)
    for action in actions:
        if not isinstance(action, dict):
            continue
        review_status = str(action.get("review_status") or action.get("status") or "")
        if review_status not in VALID_REVIEW_STATUSES:
            continue
        for key in _review_keys(action):
            latest[key] = action
    return latest


def _empty_bucket(meta: dict) -> dict:
    return {
        **meta,
        "count": 0,
        "confirmed_issue_count": 0,
        "confirmed_issue_ratio": 0.0,
        "confirmed_ok_count": 0,
        "confirmed_ok_ratio": 0.0,
        "unconfirmed_count": 0,
        "unconfirmed_ratio": 0.0,
        "total_ratio": 0.0,
    }


def _item_matches_key(item: dict, token: str) -> bool:
    normalized = _normalize_key(token)
    return any(
        normalized == _normalize_key(item.get(key))
        for key in ("anchor_key", "citation_key")
    )


def _find_item_for_occurrence(items: list[dict], occurrence: dict) -> Optional[dict]:
    token = occurrence["citation_key"]
    sentence = occurrence["sentence"]
    normalized_sentence = occurrence["normalized_sentence"]
    exact = [
        item for item in items
        if _item_matches_key(item, token) and str(item.get("sentence") or "").strip() == sentence
    ]
    if exact:
        return exact[0]
    normalized = [
        item for item in items
        if _item_matches_key(item, token) and _normalize_sentence(item.get("sentence")) == normalized_sentence
    ]
    if normalized:
        return normalized[0]
    key_only = [item for item in items if _item_matches_key(item, token)]
    return key_only[0] if len(key_only) == 1 else None


def _collect_visible_occurrences(record: dict, items: list[dict]) -> list[dict]:
    text = _display_text(record)
    occurrences: list[dict] = []
    occurrence_index = 0
    for match in _CITATION_GROUP_RE.finditer(text):
        sentence = _sentence_around(text, match.start())
        for token in _split_tokens(match.group(1)):
            occurrence = {
                "occurrence_key": f"citation-occurrence-{occurrence_index}",
                "citation_key": token,
                "sentence": sentence,
                "normalized_sentence": _normalize_sentence(sentence),
            }
            item = _find_item_for_occurrence(items, occurrence)
            occurrence["status"] = _item_status(item or {})
            occurrence["item"] = item
            occurrences.append(occurrence)
            occurrence_index += 1
    return occurrences


def _action_matches_occurrence(action: dict, occurrence: dict) -> bool:
    if str(action.get("occurrence_key") or "") == occurrence["occurrence_key"]:
        return True
    action_keys = {_normalize_key(action.get("anchor_key")), _normalize_key(action.get("citation_key"))}
    if _normalize_key(occurrence["citation_key"]) not in action_keys:
        return False
    return _normalize_sentence(action.get("sentence")) == occurrence["normalized_sentence"]


def _latest_action_for_occurrence(actions: list[dict], occurrence: dict) -> Optional[dict]:
    matches = [
        action for action in actions
        if str(action.get("review_status") or action.get("status") or "") in VALID_REVIEW_STATUSES
        and _action_matches_occurrence(action, occurrence)
    ]
    if not matches:
        return None
    return sorted(matches, key=_parse_review_time)[-1]


def _count_bucket(bucket: dict, review_status: str) -> None:
    bucket["count"] += 1
    if bucket.get("summary_mode") == "total_ratio":
        return
    if review_status == "rejected":
        bucket["confirmed_issue_count"] += 1
    elif review_status == "confirmed":
        bucket["confirmed_ok_count"] += 1
    else:
        bucket["unconfirmed_count"] += 1


def _finalize_bucket(bucket: dict, total_citations: int) -> dict:
    count = bucket["count"]
    bucket["total_ratio"] = round(count / total_citations, 4) if total_citations > 0 else 0.0
    if count <= 0:
        return bucket
    bucket["confirmed_issue_ratio"] = round(bucket["confirmed_issue_count"] / count, 4)
    bucket["confirmed_ok_ratio"] = round(bucket["confirmed_ok_count"] / count, 4)
    bucket["unconfirmed_ratio"] = round(bucket["unconfirmed_count"] / count, 4)
    return bucket


def summarize_ai_integration_citation_stats(sessions: list[dict]) -> dict:
    buckets = {meta["status"]: _empty_bucket(meta) for meta in CITATION_STATUS_META}
    total_sessions = 0
    total_records = 0
    total_citations = 0

    for session in _safe_list(sessions):
        session_has_citations = False
        for record in _safe_list(_safe_dict(session).get("aiIntegrationHistory")):
            record = _safe_dict(record)
            verification = _safe_dict(record.get("citationVerification"))
            items = [item for item in _safe_list(verification.get("items")) if isinstance(item, dict)]
            if not items:
                continue
            actions = [
                action for action in _safe_list(record.get("citationReviewActions"))
                if isinstance(action, dict)
            ]
            occurrence_reviews = _safe_dict(record.get("citationOccurrenceReviews"))
            visible_occurrences = _collect_visible_occurrences(record, items)
            matched_rejected_action_ids: set[str] = set()
            counted_mismatch_keys: set[tuple[str, str]] = set()

            for item in items:
                if _item_status(item) != "mismatch":
                    continue
                _count_bucket(buckets["mismatch"], "")
                total_citations += 1
                session_has_citations = True
                counted_mismatch_keys.update(_review_keys(item))

            for occurrence in visible_occurrences:
                status = occurrence["status"]
                bucket = buckets[status]
                action = _latest_action_for_occurrence(actions, occurrence)
                action_id = str(_safe_dict(action).get("id") or "")
                if str(_safe_dict(action).get("review_status") or _safe_dict(action).get("status") or "") == "rejected" and action_id:
                    matched_rejected_action_ids.add(action_id)
                if status == "mismatch":
                    continue
                review_status = str(_safe_dict(action).get("review_status") or _safe_dict(action).get("status") or "")
                if not action and not actions:
                    review_status = str(occurrence_reviews.get(occurrence["occurrence_key"]) or "")
                _count_bucket(bucket, review_status)
                total_citations += 1
                session_has_citations = True

            for action in actions:
                review_status = str(action.get("review_status") or action.get("status") or "")
                if review_status != "rejected":
                    continue
                action_id = str(action.get("id") or "")
                if action_id and action_id in matched_rejected_action_ids:
                    continue
                status = str(action.get("verification_status") or "")
                if status not in VALID_CITATION_STATUSES:
                    item = next(
                        (items_item for key in _review_keys(action) for items_item in items if key in _review_keys(items_item)),
                        None,
                    )
                    status = _item_status(item or {})
                if status == "mismatch" and any(key in counted_mismatch_keys for key in _review_keys(action)):
                    continue
                _count_bucket(buckets[status], "rejected")
                total_citations += 1
                session_has_citations = True

            if (
                visible_occurrences
                or counted_mismatch_keys
                or any(str(action.get("review_status") or action.get("status") or "") == "rejected" for action in actions)
            ):
                total_records += 1
        if session_has_citations:
            total_sessions += 1

    finalized = [_finalize_bucket(buckets[meta["status"]], total_citations) for meta in CITATION_STATUS_META]
    auto_deleted_citation_count = buckets["mismatch"]["count"]
    auto_deleted_citation_ratio = round(auto_deleted_citation_count / total_citations, 4) if total_citations > 0 else 0.0
    return {
        "total_sessions": total_sessions,
        "total_records": total_records,
        "total_citations": total_citations,
        "auto_deleted_citation_count": auto_deleted_citation_count,
        "auto_deleted_citation_ratio": auto_deleted_citation_ratio,
        "buckets": finalized,
    }
