import uuid
from datetime import datetime, timedelta, timezone

import jwt
import bcrypt
from fastapi import Request, HTTPException

from config import settings
import db

# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

# ── JWT ────────────────────────────────────────────────────────────────────────

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "登录已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "无效的认证信息")

# ── Registration codes ─────────────────────────────────────────────────────────

def validate_registration_code(code: str, user_id: str) -> bool:
    """Check and consume a registration code. Returns False if invalid or already used."""
    return db.consume_registration_code(code.strip(), user_id)

# ── FastAPI dependency ─────────────────────────────────────────────────────────

def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "未登录")
    token = auth_header[7:]
    payload = decode_token(token)
    user = db.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(401, "用户不存在")
    return user
