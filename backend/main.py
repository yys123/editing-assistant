from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import article, qa, analyze, generate, history, standards
import db

app = FastAPI(title="Editing Assistant API", version="1.0.0")

@app.on_event("startup")
def startup():
    db.init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(article.router)
app.include_router(qa.router)
app.include_router(analyze.router)
app.include_router(generate.router)
app.include_router(history.router)
app.include_router(standards.router)


@app.get("/health")
def health():
    return {"status": "ok", "model": settings.gemini_model}
