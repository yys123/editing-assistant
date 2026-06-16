import sqlite3
import json
import uuid
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_call_logs (
                id                       TEXT PRIMARY KEY,
                created_at               TEXT NOT NULL,
                user_id                  TEXT,
                context                  TEXT NOT NULL,
                provider                 TEXT NOT NULL,
                model                    TEXT NOT NULL,
                prompt_chars             INTEGER NOT NULL,
                estimated_prompt_tokens  INTEGER,
                prompt_tokens            INTEGER,
                output_tokens            INTEGER,
                total_tokens             INTEGER,
                elapsed_ms               INTEGER,
                context_window_tokens    INTEGER,
                context_usage_ratio      REAL,
                status                   TEXT NOT NULL,
                warning                  TEXT DEFAULT '',
                error                    TEXT DEFAULT '',
                request_log_path         TEXT DEFAULT ''
            )
        """)
        ai_cols = {row[1] for row in conn.execute("PRAGMA table_info(ai_call_logs)")}
        if "request_log_path" not in ai_cols:
            conn.execute("ALTER TABLE ai_call_logs ADD COLUMN request_log_path TEXT DEFAULT ''")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_call_logs_created ON ai_call_logs(created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_call_logs_user ON ai_call_logs(user_id)"
        )
        conn.commit()


# ── User CRUD ──────────────────────────────────────────────────────────────────

def create_user(user_id: str, email: str, password_hash: str, display_name: str) -> dict:
    with _conn() as conn:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
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


def clone_session_admin(session_id: str, target_user_id: str):
    from datetime import datetime, timezone

    with _conn() as conn:
        source = conn.execute(
            "SELECT data, disease FROM sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        if not source:
            return None

        owner = conn.execute(
            "SELECT email FROM users WHERE id = ?",
            (target_user_id,),
        ).fetchone()

        now = datetime.now(timezone.utc).isoformat()
        original = json.loads(source["data"])
        cloned = json.loads(json.dumps(original, ensure_ascii=False))
        original_disease = cloned.get("disease") or source["disease"] or ""
        cloned_disease = f"{original_disease}（副本）" if original_disease else "未命名任务（副本）"
        cloned["id"] = now
        cloned["updatedAt"] = now
        cloned["disease"] = cloned_disease
        cloned["owner_id"] = target_user_id
        if owner:
            cloned["owner_email"] = owner["email"]

        conn.execute(
            "INSERT INTO sessions (id, user_id, updated_at, disease, data) VALUES (?, ?, ?, ?, ?)",
            (now, target_user_id, now, cloned_disease, json.dumps(cloned, ensure_ascii=False)),
        )
        conn.commit()

    return cloned


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


def delete_session_admin(session_id: str) -> bool:
    with _conn() as conn:
        cursor = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
    return cursor.rowcount > 0


# ── AI call audit logs ─────────────────────────────────────────────────────────

def insert_ai_call_log(entry: dict) -> dict:
    from datetime import datetime, timezone
    row = {
        "id": entry.get("id") or uuid.uuid4().hex,
        "created_at": entry.get("created_at") or datetime.now(timezone.utc).isoformat(),
        "user_id": entry.get("user_id"),
        "context": entry.get("context") or "unknown",
        "provider": entry.get("provider") or "unknown",
        "model": entry.get("model") or "unknown",
        "prompt_chars": int(entry.get("prompt_chars") or 0),
        "estimated_prompt_tokens": entry.get("estimated_prompt_tokens"),
        "prompt_tokens": entry.get("prompt_tokens"),
        "output_tokens": entry.get("output_tokens"),
        "total_tokens": entry.get("total_tokens"),
        "elapsed_ms": entry.get("elapsed_ms"),
        "context_window_tokens": entry.get("context_window_tokens"),
        "context_usage_ratio": entry.get("context_usage_ratio"),
        "status": entry.get("status") or "unknown",
        "warning": entry.get("warning") or "",
        "error": entry.get("error") or "",
        "request_log_path": entry.get("request_log_path") or "",
    }
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO ai_call_logs (
                id, created_at, user_id, context, provider, model, prompt_chars,
                estimated_prompt_tokens, prompt_tokens, output_tokens, total_tokens,
                elapsed_ms, context_window_tokens, context_usage_ratio, status,
                warning, error, request_log_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"], row["created_at"], row["user_id"], row["context"],
                row["provider"], row["model"], row["prompt_chars"],
                row["estimated_prompt_tokens"], row["prompt_tokens"],
                row["output_tokens"], row["total_tokens"], row["elapsed_ms"],
                row["context_window_tokens"], row["context_usage_ratio"],
                row["status"], row["warning"], row["error"],
                row["request_log_path"],
            ),
        )
        conn.commit()
    return row


def list_ai_call_logs(limit: int = 100) -> list:
    safe_limit = max(1, min(int(limit or 100), 500))
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_call_logs ORDER BY created_at DESC LIMIT ?",
            (safe_limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_ai_call_log(log_id: str):
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM ai_call_logs WHERE id = ?",
            (log_id,),
        ).fetchone()
    return dict(row) if row else None


def summarize_ai_call_logs() -> dict:
    with _conn() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS calls,
                SUM(COALESCE(total_tokens, 0)) AS total_tokens,
                SUM(COALESCE(prompt_tokens, estimated_prompt_tokens, 0)) AS input_tokens,
                SUM(COALESCE(output_tokens, 0)) AS output_tokens,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_calls,
                SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failed_calls,
                MAX(context_usage_ratio) AS max_context_usage_ratio
            FROM ai_call_logs
            """
        ).fetchone()
    return dict(row) if row else {
        "calls": 0,
        "total_tokens": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "success_calls": 0,
        "failed_calls": 0,
        "max_context_usage_ratio": None,
    }
