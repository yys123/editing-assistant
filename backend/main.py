from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from auth import decode_token
from config import settings
from routers import article, qa, analyze, generate, history, standards, auth, admin, utd
from services.admin_runtime import get_effective_text_config
from services import admin_activity
from services.utd_monitor.crawler import init_monitor_service, shutdown_monitor_service
import db

app = FastAPI(title="Editing Assistant API", version="1.0.0")


def _should_track_activity(path: str) -> bool:
    return path not in {"/health", "/healthz"} and not path.startswith("/api/admin")


def _activity_user_from_request(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        payload = decode_token(auth_header[7:])
        return db.get_user_by_id(payload["sub"])
    except Exception:
        return None


@app.middleware("http")
async def track_admin_activity(request: Request, call_next):
    request_id = None
    path = request.url.path
    if _should_track_activity(path):
        user = _activity_user_from_request(request)
        if user:
            request_id = admin_activity.start_request(user, request.method, path)
    try:
        return await call_next(request)
    finally:
        if request_id:
            admin_activity.finish_request(request_id)


@app.on_event("startup")
def startup():
    db.init_db()
    init_monitor_service()


@app.on_event("shutdown")
def shutdown():
    shutdown_monitor_service()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(article.router)
app.include_router(qa.router)
app.include_router(analyze.router)
app.include_router(generate.router)
app.include_router(history.router)
app.include_router(standards.router)
app.include_router(admin.router)
app.include_router(utd.router)


@app.get("/health")
@app.get("/healthz")
def health():
    config = get_effective_text_config()
    provider = str(config.get("text_model_provider", settings.text_model_provider)).strip().lower()
    model = config.get("deepseek_model") if provider == "deepseek" else settings.gemini_model
    return {"status": "ok", "provider": provider, "model": model}
