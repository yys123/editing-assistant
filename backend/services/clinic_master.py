import hashlib
import re
import time
import uuid
from typing import Any, Optional

import httpx
from fastapi import HTTPException

from config import settings


def _value_to_sign_string(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        return "[" + ", ".join(_value_to_sign_string(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ", ".join(
            f"{key}={_value_to_sign_string(item)}" for key, item in value.items()
        ) + "}"
    return str(value)


def build_signature_plaintext(params: dict, app_sign_key: str) -> str:
    sign_params = {**params, "appSignKey": app_sign_key}
    sign_params.pop("sign", None)
    parts: list[str] = []
    for key in sorted(sign_params):
        value = sign_params[key]
        if value is None:
            continue
        parts.append(f"{key}={_value_to_sign_string(value)}")
    return "&".join(parts)


def generate_signature(params: dict, app_sign_key: str) -> str:
    plaintext = build_signature_plaintext(params, app_sign_key)
    return hashlib.sha1(plaintext.encode("utf-8")).hexdigest()


def signed_params(params: dict) -> dict:
    app_id = str(getattr(settings, "clinic_master_app_id", "") or "").strip()
    sign_key = str(getattr(settings, "clinic_master_app_sign_key", "") or "").strip()
    if not app_id or not sign_key:
        raise HTTPException(500, "Clinic Master 凭证未配置: appId/appSignKey")

    request_params = {
        key: value
        for key, value in params.items()
        if value is not None
    }
    request_params["appId"] = app_id
    request_params["timestamp"] = int(time.time())
    request_params["nonce"] = str(uuid.uuid4())
    request_params["sign"] = generate_signature(request_params, sign_key)
    return request_params


def openapi_host() -> str:
    host = str(getattr(settings, "clinic_master_openapi_host", "") or "").strip().rstrip("/")
    if not host:
        raise HTTPException(500, "Clinic Master OpenAPI Host 未配置")
    return host


def _openapi_url(path: str) -> str:
    return f"{openapi_host()}/openapi/p/{path.strip('/')}"


def _japi_url(path: str) -> str:
    return f"{openapi_host()}/japi/platform/{path.strip('/')}"


def _safe_params(params: dict) -> dict:
    safe = {}
    for key, value in params.items():
        if key == "appSignKey":
            safe[key] = "***"
        elif key == "sign":
            text = str(value)
            safe[key] = f"{text[:8]}...{text[-8:]}" if len(text) > 16 else text
        else:
            safe[key] = value
    return safe


def _timeout() -> int:
    return int(getattr(settings, "clinic_master_timeout_seconds", 30) or 30)


def _extract_payload(response: httpx.Response, label: str, url: str, params: dict) -> dict:
    response_text = response.text[:1000]
    if response.status_code >= 400:
        raise HTTPException(
            502,
            {
                "message": f"Clinic Master {label} 请求失败 ({response.status_code})",
                "request": {"url": url, "params": _safe_params(params)},
                "response": response_text,
            },
        )
    try:
        payload = response.json()
    except Exception:
        raise HTTPException(
            502,
            {
                "message": f"Clinic Master {label} 返回格式异常",
                "request": {"url": url, "params": _safe_params(params)},
                "response": response_text,
            },
        )
    code = str(payload.get("code", "")).lower()
    if code and code != "success":
        raise HTTPException(
            502,
            {
                "message": str(payload.get("message") or f"Clinic Master {label} 请求失败"),
                "code": payload.get("code"),
                "request": {"url": url, "params": _safe_params(params)},
                "response": payload,
            },
        )
    return payload


async def _post_openapi(path: str, params: dict, label: str) -> dict:
    url = _openapi_url(path)
    signed = signed_params(params)
    try:
        async with httpx.AsyncClient(timeout=_timeout()) as client:
            response = await client.post(url, json=signed)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Clinic Master {label} 连接失败: {exc}")
    return _extract_payload(response, label, url, signed)


async def create_chat(question: str, request_id: str) -> dict:
    return await _post_openapi(
        "chat/stream",
        {
            "question": question,
            "requestId": request_id,
        },
        "创建对话",
    )


async def get_chat_detail(chat_id: Optional[str] = None, request_id: Optional[str] = None) -> dict:
    params = {
        "chatId": chat_id,
        "requestId": request_id,
    }
    return await _post_openapi("chat/detail", params, "获取对话详情")


async def get_chat_references(message_id: str) -> dict:
    return await _post_openapi("chat/reference", {"messageId": message_id}, "获取参考文档")


async def get_reference_detail(reference_payload: dict) -> dict:
    url = _japi_url("100000017")
    signed = signed_params(reference_payload)
    try:
        async with httpx.AsyncClient(timeout=_timeout()) as client:
            response = await client.post(
                url,
                data=signed,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Clinic Master 参考文献详情连接失败: {exc}")
    return _extract_payload(response, "参考文献详情", url, signed)


def _walk_dicts(value: Any) -> list[dict]:
    items: list[dict] = []
    if isinstance(value, dict):
        items.append(value)
        for nested in value.values():
            items.extend(_walk_dicts(nested))
    elif isinstance(value, list):
        for nested in value:
            items.extend(_walk_dicts(nested))
    return items


def _data_container(payload: dict) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def _message_id(item: dict) -> str:
    for key in ("messageId", "message_id", "id"):
        value = item.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _is_assistant_message(item: dict) -> bool:
    role = str(
        item.get("roleType")
        or item.get("role_type")
        or item.get("role")
        or item.get("type")
        or ""
    ).strip().lower()
    return role == "assistant"


def extract_assistant_message_id(detail_payload: dict) -> str:
    assistant_ids = [
        _message_id(item)
        for item in _walk_dicts(_data_container(detail_payload))
        if _is_assistant_message(item) and _message_id(item)
    ]
    return assistant_ids[-1] if assistant_ids else ""


def _first_text_field(value: Any, keys: tuple[str, ...]) -> str:
    if isinstance(value, dict):
        for key in keys:
            text = value.get(key)
            if isinstance(text, str) and text.strip():
                return text.strip()
        for nested in value.values():
            text = _first_text_field(nested, keys)
            if text:
                return text
    elif isinstance(value, list):
        for nested in value:
            text = _first_text_field(nested, keys)
            if text:
                return text
    return ""


def _latest_assistant_message(detail_payload: dict) -> dict:
    messages = [
        item
        for item in _walk_dicts(_data_container(detail_payload))
        if _is_assistant_message(item)
    ]
    return messages[-1] if messages else {}


def extract_answer_text(detail_payload: dict, stream_payload: Optional[dict] = None) -> str:
    message = _latest_assistant_message(detail_payload)
    text = _first_text_field(
        message,
        ("content", "answer", "message", "text", "body"),
    )
    if text:
        return text
    return _first_text_field(
        stream_payload or {},
        ("content", "answer", "message", "text", "body"),
    )


def extract_reference_items(reference_payload: dict) -> list[dict]:
    data = _data_container(reference_payload)
    raw_items: list[Any] = []
    if isinstance(data, list):
        raw_items = data
    elif isinstance(data, dict):
        for key in ("items", "list", "records", "references", "docs", "rows"):
            value = data.get(key)
            if isinstance(value, list):
                raw_items = value
                break
        if not raw_items and any(key in data for key in ("referenceId", "reference_id", "id", "title")):
            raw_items = [data]
    return [item for item in raw_items if isinstance(item, dict)]


def _reference_title(item: dict, fallback: str) -> str:
    return _first_text_field(
        item,
        ("title", "name", "docTitle", "doc_title", "referenceTitle", "reference_title"),
    ) or fallback


def _reference_summary(item: dict) -> str:
    return _first_text_field(
        item,
        ("summary", "abstract", "description", "content", "text", "body"),
    )


def _normalize_reference_text(text: str) -> str:
    clean = (text or "").strip()
    if not clean:
        return ""
    if re.search(r"</?[a-zA-Z][\s\S]*>", clean):
        try:
            from services.scraper import parse_html_structured

            return parse_html_structured(clean, preserve_leading_text=True).strip()
        except Exception:
            return re.sub(r"<[^>]+>", "", clean).strip()
    return clean


def _detail_payload_text(payload: dict) -> str:
    data = _data_container(payload)
    return _first_text_field(
        data,
        (
            "content",
            "htmlContent",
            "html_content",
            "detailContent",
            "detail_content",
            "abstract",
            "summary",
            "text",
            "body",
        ),
    )


def _material_id() -> str:
    return str(uuid.uuid4())


def normalize_materials(
    question: str,
    answer: str,
    detail_payload: dict,
    references: list[dict],
    detail_results: list[dict],
) -> list[dict]:
    materials: list[dict] = []
    clean_question = (question or "").strip()
    clean_answer = _normalize_reference_text(answer)
    if clean_answer:
        materials.append({
            "id": _material_id(),
            "type": "answer",
            "title": f"ClinMaster 回答：{clean_question[:40] or '临床决策'}",
            "text": (
                f"[H1] ClinMaster 回答：{clean_question[:80] or '临床决策'}\n\n"
                f"问题：{clean_question}\n\n"
                f"回答：\n{clean_answer}"
            ).strip(),
            "sourceLabel": "ClinMaster 回答",
            "selectedByDefault": True,
            "metadata": {"question": clean_question},
        })

    for index, item in enumerate(references, start=1):
        title = _reference_title(item, f"参考资料 {index}")
        summary = _normalize_reference_text(_reference_summary(item))
        if not summary:
            continue
        materials.append({
            "id": _material_id(),
            "type": "reference",
            "title": title,
            "text": f"[H1] ClinMaster 参考资料：{title}\n\n{summary}",
            "sourceLabel": "ClinMaster 参考资料",
            "selectedByDefault": True,
            "metadata": {"reference": item},
        })

    for index, result in enumerate(detail_results, start=1):
        reference = result.get("reference") if isinstance(result, dict) else None
        payload = result.get("payload") if isinstance(result, dict) else result
        if not isinstance(payload, dict):
            continue
        title = _reference_title(payload, "")
        if not title and isinstance(reference, dict):
            title = _reference_title(reference, "")
        title = title or f"文献详情 {index}"
        text = _normalize_reference_text(_detail_payload_text(payload))
        if not text:
            continue
        materials.append({
            "id": _material_id(),
            "type": "reference_detail",
            "title": title,
            "text": f"[H1] ClinMaster 文献详情：{title}\n\n{text}",
            "sourceLabel": "ClinMaster 文献详情",
            "selectedByDefault": True,
            "metadata": {"reference": reference or {}, "detail": payload},
        })

    return materials
