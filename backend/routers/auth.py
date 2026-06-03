import uuid
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends

import db
from auth import (
    hash_password, check_password, create_token,
    validate_registration_code, get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    reg_code: str
    password: str
    display_name: str = ""

class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(req: RegisterRequest):
    if not req.email.endswith("@dxy.cn"):
        raise HTTPException(400, "仅允许 @dxy.cn 域名邮箱注册")
    if len(req.password) < 6:
        raise HTTPException(400, "密码长度不能少于6位")
    if db.get_user_by_email(req.email):
        raise HTTPException(400, "该邮箱已注册")
    user_id = uuid.uuid4().hex
    if not validate_registration_code(req.reg_code, user_id):
        raise HTTPException(400, "注册码无效或已被使用")
    display_name = req.display_name or req.email.split("@")[0]
    password_hash = hash_password(req.password)
    user = db.create_user(user_id, req.email, password_hash, display_name)
    user["is_admin"] = user["email"] in {e.strip() for e in db.get_user_by_id(user_id).get("email", "").split(",")} if False else False
    token = create_token(user_id, req.email)
    return {"token": token, "user": user}


@router.post("/login")
def login(req: LoginRequest):
    user = db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(400, "邮箱或密码错误")
    if not check_password(req.password, user["password"]):
        raise HTTPException(400, "邮箱或密码错误")
    if not user["verified"]:
        raise HTTPException(400, "账号未验证")
    token = create_token(user["id"], user["email"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "display_name": user["display_name"],
            "is_admin": user.get("is_admin", False),
        },
    }


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "display_name": user["display_name"],
        "is_admin": user.get("is_admin", False),
    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    if not check_password(req.current_password, user["password"]):
        raise HTTPException(400, "当前密码错误")
    if len(req.new_password) < 6:
        raise HTTPException(400, "新密码长度不能少于6位")
    db.update_user_password(user["id"], hash_password(req.new_password))
    return {"ok": True}
