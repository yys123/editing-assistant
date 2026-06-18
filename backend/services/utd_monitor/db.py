import sqlite3
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS topics (
    topic_id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_zh TEXT NOT NULL DEFAULT '',
    last_version TEXT NOT NULL DEFAULT '',
    last_updated_date TEXT NOT NULL DEFAULT '',
    last_crawled_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS entries (
    topic_id TEXT NOT NULL,
    anchor_id TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT '',
    section_date TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    body_html TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_changed_at TEXT NOT NULL,
    title_zh TEXT NOT NULL DEFAULT '',
    body_zh TEXT NOT NULL DEFAULT '',
    translate_status TEXT NOT NULL DEFAULT 'pending',
    references_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (topic_id, anchor_id)
);

CREATE TABLE IF NOT EXISTS changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crawl_id INTEGER NOT NULL,
    topic_id TEXT NOT NULL,
    anchor_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    title TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT '',
    section_date TEXT NOT NULL DEFAULT '',
    old_text TEXT NOT NULL DEFAULT '',
    new_text TEXT NOT NULL DEFAULT '',
    new_html TEXT NOT NULL DEFAULT '',
    detected_at TEXT NOT NULL,
    title_zh TEXT NOT NULL DEFAULT '',
    summary_zh TEXT NOT NULL DEFAULT '',
    body_zh TEXT NOT NULL DEFAULT '',
    translate_status TEXT NOT NULL DEFAULT 'pending',
    references_json TEXT NOT NULL DEFAULT '[]',
    is_read INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crawls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'running',
    trigger TEXT NOT NULL DEFAULT 'manual',
    topics_checked INTEGER NOT NULL DEFAULT 0,
    topics_changed INTEGER NOT NULL DEFAULT 0,
    changes_found INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_changes_detected ON changes (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_changes_topic ON changes (topic_id);
"""


COLUMN_MIGRATIONS = {
    "entries": [
        ("title_zh", "TEXT NOT NULL DEFAULT ''"),
        ("body_zh", "TEXT NOT NULL DEFAULT ''"),
        ("translate_status", "TEXT NOT NULL DEFAULT 'pending'"),
        ("references_json", "TEXT NOT NULL DEFAULT '[]'"),
    ],
    "changes": [
        ("references_json", "TEXT NOT NULL DEFAULT '[]'"),
    ],
}


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)
        # 给已有数据库的表补列（幂等）
        for table, migrations in COLUMN_MIGRATIONS.items():
            cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
            for name, decl in migrations:
                if name not in cols:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")


@contextmanager
def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
