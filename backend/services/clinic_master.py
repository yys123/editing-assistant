import hashlib
import time
import uuid
from typing import Any

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
