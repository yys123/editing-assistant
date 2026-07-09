import hashlib
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
