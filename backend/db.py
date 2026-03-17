import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "sessions.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          TEXT PRIMARY KEY,
                updated_at  TEXT NOT NULL,
                disease     TEXT DEFAULT '',
                data        TEXT NOT NULL
            )
        """)
        conn.commit()


def list_sessions() -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT data FROM sessions ORDER BY updated_at DESC"
        ).fetchall()
    return [json.loads(r["data"]) for r in rows]


def upsert_session(session_id: str, updated_at: str, disease: str, data: dict):
    with _conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sessions (id, updated_at, disease, data) VALUES (?, ?, ?, ?)",
            (session_id, updated_at, disease, json.dumps(data, ensure_ascii=False))
        )
        conn.commit()


def delete_session(session_id: str):
    with _conn() as conn:
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
