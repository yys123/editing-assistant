import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "sessions.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id           TEXT PRIMARY KEY,
                email        TEXT UNIQUE NOT NULL,
                password     TEXT NOT NULL,
                display_name TEXT DEFAULT '',
                created_at   TEXT NOT NULL,
                verified     INTEGER DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                disease     TEXT DEFAULT '',
                data        TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        # Migration: add user_id column if old schema predates auth
        cols = {row[1] for row in conn.execute("PRAGMA table_info(sessions)")}
        if "user_id" not in cols:
            conn.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS registration_codes (
                code       TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                used_at    TEXT,
                used_by    TEXT
            )
        """)
        conn.commit()


# ── User CRUD ──────────────────────────────────────────────────────────────────

def create_user(user_id: str, email: str, password_hash: str, display_name: str) -> dict:
    with _conn() as conn:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO users (id, email, password, display_name, created_at, verified) VALUES (?, ?, ?, ?, ?, 1)",
            (user_id, email, password_hash, display_name, now),
        )
        conn.commit()
    return {"id": user_id, "email": email, "display_name": display_name}


def get_user_by_email(email: str):
    with _conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if row:
        return dict(row)
    return None


def get_user_by_id(user_id: str):
    with _conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row:
        return dict(row)
    return None


def verify_user(user_id: str):
    with _conn() as conn:
        conn.execute("UPDATE users SET verified = 1 WHERE id = ?", (user_id,))
        conn.commit()


def update_user_password(user_id: str, new_password_hash: str):
    with _conn() as conn:
        conn.execute("UPDATE users SET password = ? WHERE id = ?", (new_password_hash, user_id))
        conn.commit()


# ── Session CRUD ───────────────────────────────────────────────────────────────

def list_sessions() -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT s.data, s.user_id, u.email AS owner_email "
            "FROM sessions s JOIN users u ON s.user_id = u.id "
            "ORDER BY s.updated_at DESC"
        ).fetchall()
    results = []
    for r in rows:
        record = json.loads(r["data"])
        record["owner_id"] = r["user_id"]
        record["owner_email"] = r["owner_email"]
        results.append(record)
    return results


def get_session_owner(session_id: str):
    with _conn() as conn:
        row = conn.execute("SELECT user_id FROM sessions WHERE id = ?", (session_id,)).fetchone()
    return row["user_id"] if row else None


def upsert_session(session_id: str, user_id: str, updated_at: str, disease: str, data: dict):
    with _conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sessions (id, user_id, updated_at, disease, data) VALUES (?, ?, ?, ?, ?)",
            (session_id, user_id, updated_at, disease, json.dumps(data, ensure_ascii=False)),
        )
        conn.commit()


# ── Registration codes ─────────────────────────────────────────────────────────

def add_registration_code(code: str):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO registration_codes (code, created_at) VALUES (?, ?)",
            (code, now),
        )
        conn.commit()


def consume_registration_code(code: str, user_id: str) -> bool:
    """Mark code as used. Returns False if code doesn't exist or already used."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        row = conn.execute(
            "SELECT used_at FROM registration_codes WHERE code = ?", (code,)
        ).fetchone()
        if not row or row["used_at"] is not None:
            return False
        conn.execute(
            "UPDATE registration_codes SET used_at = ?, used_by = ? WHERE code = ?",
            (now, user_id, code),
        )
        conn.commit()
    return True


def list_registration_codes() -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT code, created_at, used_at, used_by FROM registration_codes ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def delete_session(session_id: str, user_id: str) -> bool:
    with _conn() as conn:
        cursor = conn.execute(
            "DELETE FROM sessions WHERE id = ? AND user_id = ?", (session_id, user_id)
        )
        conn.commit()
    return cursor.rowcount > 0
