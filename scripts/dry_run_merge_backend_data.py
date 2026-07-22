#!/usr/bin/env python3
"""Create a dry-run merged backend data directory.

This script is intentionally non-destructive: it reads the current app data
directory and an imported data directory, then writes snapshots, a staging
merged-data directory, and conflict reports under a separate output directory.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import filecmp
import hashlib
import json
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


SESSIONS_TABLES = ("users", "sessions", "registration_codes", "ai_call_logs")
UTD_TABLES = ("topics", "entries", "changes", "crawls")


def parse_args() -> argparse.Namespace:
    repo = Path(__file__).resolve().parents[1]
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    parser = argparse.ArgumentParser(
        description="Build a dry-run merged backend data directory."
    )
    parser.add_argument(
        "--old-data",
        type=Path,
        default=repo / "backend" / "data",
        help="Current app data directory.",
    )
    parser.add_argument(
        "--new-data",
        type=Path,
        default=repo / "backend-data",
        help="Imported data directory to merge in.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/private/tmp") / f"editing-assistant-data-merge-{timestamp}",
        help="Dry-run output directory. Must not already exist.",
    )
    return parser.parse_args()


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_clean_output(path: Path) -> None:
    if path.exists():
        raise SystemExit(f"Output path already exists: {path}")
    path.mkdir(parents=True)


def snapshot_sqlite(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    source = sqlite3.connect(f"file:{src}?mode=ro", uri=True, timeout=30)
    try:
        source.execute("PRAGMA busy_timeout=30000")
        target = sqlite3.connect(dest)
        try:
            source.backup(target)
        finally:
            target.close()
    finally:
        source.close()


def open_db(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


def fetch_one(conn: sqlite3.Connection, sql: str, params: tuple[Any, ...] = ()) -> Any:
    return conn.execute(sql, params).fetchone()[0]


def table_count(conn: sqlite3.Connection, table: str) -> int:
    return int(fetch_one(conn, f"SELECT COUNT(*) FROM {table}"))


def checkpoint_wal(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def copy_file_if_exists(src: Path, dest: Path) -> bool:
    if not src.exists():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return True


def copy_tree(src: Path, dest: Path) -> None:
    if src.exists():
        shutil.copytree(src, dest)


def merge_sessions_db(old_db: Path, new_db: Path, dest_db: Path, report_dir: Path) -> dict[str, Any]:
    dest_db.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(old_db, dest_db)
    report: dict[str, Any] = {}
    conflicts: dict[str, list[dict[str, Any]]] = {
        "user_conflicts": [],
        "session_conflicts": [],
        "registration_code_conflicts": [],
        "ai_call_log_conflicts": [],
        "orphan_sessions_in_new": [],
    }

    with open_db(dest_db) as conn:
        conn.execute("ATTACH DATABASE ? AS newdb", (str(new_db),))
        before = {table: table_count(conn, table) for table in SESSIONS_TABLES}
        report["before"] = before

        for row in conn.execute(
            """
            SELECT n.*
            FROM newdb.users n
            LEFT JOIN users o ON o.id = n.id
            WHERE o.id IS NULL
            ORDER BY n.created_at, n.id
            """
        ):
            conn.execute(
                """
                INSERT INTO users (id, email, password, display_name, created_at, verified)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    row["id"],
                    row["email"],
                    row["password"],
                    row["display_name"],
                    row["created_at"],
                    row["verified"],
                ),
            )

        user_conflict_rows = conn.execute(
            """
            SELECT
                o.id,
                o.email AS old_email,
                n.email AS new_email,
                o.created_at AS old_created_at,
                n.created_at AS new_created_at,
                o.display_name AS old_display_name,
                n.display_name AS new_display_name,
                o.verified AS old_verified,
                n.verified AS new_verified,
                CASE WHEN o.password <> n.password THEN 1 ELSE 0 END AS password_changed
            FROM users o
            JOIN newdb.users n ON o.id = n.id
            WHERE
                o.email <> n.email
                OR o.password <> n.password
                OR COALESCE(o.display_name, '') <> COALESCE(n.display_name, '')
                OR COALESCE(o.verified, -1) <> COALESCE(n.verified, -1)
            ORDER BY o.id
            """
        ).fetchall()
        for row in user_conflict_rows:
            conflicts["user_conflicts"].append(dict(row) | {"chosen": "new"})
            conn.execute(
                """
                UPDATE users
                SET email = ?, password = ?, display_name = ?, created_at = ?, verified = ?
                WHERE id = ?
                """,
                (
                    row["new_email"],
                    conn.execute(
                        "SELECT password FROM newdb.users WHERE id = ?", (row["id"],)
                    ).fetchone()["password"],
                    row["new_display_name"],
                    row["new_created_at"],
                    row["new_verified"],
                    row["id"],
                ),
            )

        for row in conn.execute(
            """
            SELECT n.*
            FROM newdb.registration_codes n
            LEFT JOIN registration_codes o ON o.code = n.code
            WHERE o.code IS NULL
            ORDER BY n.created_at, n.code
            """
        ):
            conn.execute(
                """
                INSERT INTO registration_codes (code, created_at, used_at, used_by)
                VALUES (?, ?, ?, ?)
                """,
                (row["code"], row["created_at"], row["used_at"], row["used_by"]),
            )

        registration_conflict_rows = conn.execute(
            """
            SELECT
                o.code,
                o.created_at AS old_created_at,
                n.created_at AS new_created_at,
                o.used_at AS old_used_at,
                n.used_at AS new_used_at,
                o.used_by AS old_used_by,
                n.used_by AS new_used_by
            FROM registration_codes o
            JOIN newdb.registration_codes n ON o.code = n.code
            WHERE
                COALESCE(o.created_at, '') <> COALESCE(n.created_at, '')
                OR COALESCE(o.used_at, '') <> COALESCE(n.used_at, '')
                OR COALESCE(o.used_by, '') <> COALESCE(n.used_by, '')
            ORDER BY o.code
            """
        ).fetchall()
        for row in registration_conflict_rows:
            conflicts["registration_code_conflicts"].append(dict(row) | {"chosen": "new"})
            conn.execute(
                """
                UPDATE registration_codes
                SET created_at = ?, used_at = ?, used_by = ?
                WHERE code = ?
                """,
                (row["new_created_at"], row["new_used_at"], row["new_used_by"], row["code"]),
            )

        for row in conn.execute(
            """
            SELECT n.id, n.user_id, n.updated_at, n.disease, n.data
            FROM newdb.sessions n
            LEFT JOIN users u ON u.id = n.user_id
            WHERE u.id IS NULL
            ORDER BY n.updated_at, n.id
            """
        ):
            conflicts["orphan_sessions_in_new"].append(dict(row))

        session_conflict_rows = conn.execute(
            """
            SELECT
                o.id,
                o.user_id AS old_user_id,
                n.user_id AS new_user_id,
                o.updated_at AS old_updated_at,
                n.updated_at AS new_updated_at,
                o.disease AS old_disease,
                n.disease AS new_disease,
                CASE WHEN o.data <> n.data THEN 1 ELSE 0 END AS data_changed
            FROM sessions o
            JOIN newdb.sessions n ON o.id = n.id
            WHERE
                COALESCE(o.user_id, '') <> COALESCE(n.user_id, '')
                OR COALESCE(o.updated_at, '') <> COALESCE(n.updated_at, '')
                OR COALESCE(o.disease, '') <> COALESCE(n.disease, '')
                OR COALESCE(o.data, '') <> COALESCE(n.data, '')
            ORDER BY MAX(o.updated_at, n.updated_at), o.id
            """
        ).fetchall()
        for row in session_conflict_rows:
            chosen = "new" if row["new_updated_at"] > row["old_updated_at"] else "old"
            conflicts["session_conflicts"].append(dict(row) | {"chosen": chosen})
            if chosen == "new":
                conn.execute(
                    """
                    UPDATE sessions
                    SET user_id = ?, updated_at = ?, disease = ?, data = ?
                    WHERE id = ?
                    """,
                    (
                        row["new_user_id"],
                        row["new_updated_at"],
                        row["new_disease"],
                        conn.execute(
                            "SELECT data FROM newdb.sessions WHERE id = ?", (row["id"],)
                        ).fetchone()["data"],
                        row["id"],
                    ),
                )

        for row in conn.execute(
            """
            SELECT n.*
            FROM newdb.sessions n
            LEFT JOIN sessions o ON o.id = n.id
            JOIN users u ON u.id = n.user_id
            WHERE o.id IS NULL
            ORDER BY n.updated_at, n.id
            """
        ):
            conn.execute(
                """
                INSERT INTO sessions (id, user_id, updated_at, disease, data)
                VALUES (?, ?, ?, ?, ?)
                """,
                (row["id"], row["user_id"], row["updated_at"], row["disease"], row["data"]),
            )

        ai_log_conflict_rows = conn.execute(
            """
            SELECT o.id, o.created_at AS old_created_at, n.created_at AS new_created_at
            FROM ai_call_logs o
            JOIN newdb.ai_call_logs n ON o.id = n.id
            WHERE
                COALESCE(o.created_at, '') <> COALESCE(n.created_at, '')
                OR COALESCE(o.user_id, '') <> COALESCE(n.user_id, '')
                OR COALESCE(o.context, '') <> COALESCE(n.context, '')
                OR COALESCE(o.provider, '') <> COALESCE(n.provider, '')
                OR COALESCE(o.model, '') <> COALESCE(n.model, '')
                OR COALESCE(o.prompt_chars, -1) <> COALESCE(n.prompt_chars, -1)
                OR COALESCE(o.estimated_prompt_tokens, -1) <> COALESCE(n.estimated_prompt_tokens, -1)
                OR COALESCE(o.prompt_tokens, -1) <> COALESCE(n.prompt_tokens, -1)
                OR COALESCE(o.output_tokens, -1) <> COALESCE(n.output_tokens, -1)
                OR COALESCE(o.total_tokens, -1) <> COALESCE(n.total_tokens, -1)
                OR COALESCE(o.elapsed_ms, -1) <> COALESCE(n.elapsed_ms, -1)
                OR COALESCE(o.context_window_tokens, -1) <> COALESCE(n.context_window_tokens, -1)
                OR COALESCE(o.context_usage_ratio, -1) <> COALESCE(n.context_usage_ratio, -1)
                OR COALESCE(o.status, '') <> COALESCE(n.status, '')
                OR COALESCE(o.warning, '') <> COALESCE(n.warning, '')
                OR COALESCE(o.error, '') <> COALESCE(n.error, '')
                OR COALESCE(o.request_log_path, '') <> COALESCE(n.request_log_path, '')
            ORDER BY o.created_at, o.id
            """
        ).fetchall()
        conflicts["ai_call_log_conflicts"].extend(dict(row) | {"chosen": "old"} for row in ai_log_conflict_rows)

        conn.execute(
            """
            INSERT INTO ai_call_logs (
                id, created_at, user_id, context, provider, model, prompt_chars,
                estimated_prompt_tokens, prompt_tokens, output_tokens, total_tokens,
                elapsed_ms, context_window_tokens, context_usage_ratio, status,
                warning, error, request_log_path
            )
            SELECT
                n.id, n.created_at, n.user_id, n.context, n.provider, n.model,
                n.prompt_chars, n.estimated_prompt_tokens, n.prompt_tokens,
                n.output_tokens, n.total_tokens, n.elapsed_ms, n.context_window_tokens,
                n.context_usage_ratio, n.status, n.warning, n.error, n.request_log_path
            FROM newdb.ai_call_logs n
            LEFT JOIN ai_call_logs o ON o.id = n.id
            WHERE o.id IS NULL
            """
        )
        conn.commit()

        after = {table: table_count(conn, table) for table in SESSIONS_TABLES}
        report["after"] = after
        report["integrity_check"] = fetch_one(conn, "PRAGMA integrity_check")
        report["foreign_key_check_count"] = fetch_one(
            conn, "SELECT COUNT(*) FROM pragma_foreign_key_check"
        )
        checkpoint_wal(conn)

    write_csv(
        report_dir / "sessions_conflicts.csv",
        conflicts["session_conflicts"],
        [
            "id",
            "old_user_id",
            "new_user_id",
            "old_updated_at",
            "new_updated_at",
            "old_disease",
            "new_disease",
            "data_changed",
            "chosen",
        ],
    )
    write_csv(
        report_dir / "user_conflicts.csv",
        conflicts["user_conflicts"],
        [
            "id",
            "old_email",
            "new_email",
            "old_created_at",
            "new_created_at",
            "old_display_name",
            "new_display_name",
            "old_verified",
            "new_verified",
            "password_changed",
            "chosen",
        ],
    )
    write_csv(
        report_dir / "registration_code_conflicts.csv",
        conflicts["registration_code_conflicts"],
        [
            "code",
            "old_created_at",
            "new_created_at",
            "old_used_at",
            "new_used_at",
            "old_used_by",
            "new_used_by",
            "chosen",
        ],
    )
    report["conflict_counts"] = {key: len(value) for key, value in conflicts.items()}
    return report


def analyze_utd(old_db: Path, new_db: Path, dest_db: Path, report_dir: Path) -> dict[str, Any]:
    dest_db.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(new_db, dest_db)
    report: dict[str, Any] = {"strategy": "new_db_as_current_state"}
    conflict_counts: dict[str, int] = {}
    rows_for_csv: dict[str, list[dict[str, Any]]] = {
        "old_only_entries": [],
        "changed_topics": [],
        "changed_entries": [],
        "changed_changes": [],
    }

    with open_db(old_db) as conn:
        conn.execute("ATTACH DATABASE ? AS newdb", (str(new_db),))
        report["old_counts"] = {table: table_count(conn, table) for table in UTD_TABLES}
        report["new_counts"] = {
            table: int(fetch_one(conn, f"SELECT COUNT(*) FROM newdb.{table}"))
            for table in UTD_TABLES
        }
        report["merged_counts"] = dict(report["new_counts"])

        changed_topics = conn.execute(
            """
            SELECT
                o.topic_id,
                o.slug,
                o.last_version AS old_last_version,
                n.last_version AS new_last_version,
                o.last_updated_date AS old_last_updated_date,
                n.last_updated_date AS new_last_updated_date,
                o.last_crawled_at AS old_last_crawled_at,
                n.last_crawled_at AS new_last_crawled_at
            FROM topics o
            JOIN newdb.topics n ON o.topic_id = n.topic_id
            WHERE
                COALESCE(o.slug, '') <> COALESCE(n.slug, '')
                OR COALESCE(o.name, '') <> COALESCE(n.name, '')
                OR COALESCE(o.name_zh, '') <> COALESCE(n.name_zh, '')
                OR COALESCE(o.last_version, '') <> COALESCE(n.last_version, '')
                OR COALESCE(o.last_updated_date, '') <> COALESCE(n.last_updated_date, '')
                OR COALESCE(o.last_crawled_at, '') <> COALESCE(n.last_crawled_at, '')
            ORDER BY o.slug
            """
        ).fetchall()
        rows_for_csv["changed_topics"].extend(dict(row) for row in changed_topics)

        changed_entries = conn.execute(
            """
            SELECT
                o.topic_id,
                o.anchor_id,
                o.title AS old_title,
                n.title AS new_title,
                o.content_hash AS old_content_hash,
                n.content_hash AS new_content_hash,
                o.last_changed_at AS old_last_changed_at,
                n.last_changed_at AS new_last_changed_at,
                o.translate_status AS old_translate_status,
                n.translate_status AS new_translate_status
            FROM entries o
            JOIN newdb.entries n
              ON o.topic_id = n.topic_id AND o.anchor_id = n.anchor_id
            WHERE
                COALESCE(o.content_hash, '') <> COALESCE(n.content_hash, '')
                OR COALESCE(o.body_text, '') <> COALESCE(n.body_text, '')
                OR COALESCE(o.body_zh, '') <> COALESCE(n.body_zh, '')
                OR COALESCE(o.references_json, '') <> COALESCE(n.references_json, '')
            ORDER BY o.topic_id, o.anchor_id
            """
        ).fetchall()
        rows_for_csv["changed_entries"].extend(dict(row) for row in changed_entries)

        old_only_entries = conn.execute(
            """
            SELECT o.topic_id, o.anchor_id, o.title, o.last_changed_at, o.content_hash
            FROM entries o
            LEFT JOIN newdb.entries n
              ON o.topic_id = n.topic_id AND o.anchor_id = n.anchor_id
            WHERE n.topic_id IS NULL
            ORDER BY o.topic_id, o.anchor_id
            """
        ).fetchall()
        rows_for_csv["old_only_entries"].extend(dict(row) for row in old_only_entries)

        changed_changes = conn.execute(
            """
            SELECT
                o.id,
                o.crawl_id AS old_crawl_id,
                n.crawl_id AS new_crawl_id,
                o.topic_id AS old_topic_id,
                n.topic_id AS new_topic_id,
                o.anchor_id AS old_anchor_id,
                n.anchor_id AS new_anchor_id,
                o.detected_at AS old_detected_at,
                n.detected_at AS new_detected_at,
                o.translate_status AS old_translate_status,
                n.translate_status AS new_translate_status,
                o.is_read AS old_is_read,
                n.is_read AS new_is_read
            FROM changes o
            JOIN newdb.changes n ON o.id = n.id
            WHERE
                COALESCE(o.crawl_id, -1) <> COALESCE(n.crawl_id, -1)
                OR COALESCE(o.topic_id, '') <> COALESCE(n.topic_id, '')
                OR COALESCE(o.anchor_id, '') <> COALESCE(n.anchor_id, '')
                OR COALESCE(o.change_type, '') <> COALESCE(n.change_type, '')
                OR COALESCE(o.title, '') <> COALESCE(n.title, '')
                OR COALESCE(o.section, '') <> COALESCE(n.section, '')
                OR COALESCE(o.section_date, '') <> COALESCE(n.section_date, '')
                OR COALESCE(o.old_text, '') <> COALESCE(n.old_text, '')
                OR COALESCE(o.new_text, '') <> COALESCE(n.new_text, '')
                OR COALESCE(o.new_html, '') <> COALESCE(n.new_html, '')
                OR COALESCE(o.detected_at, '') <> COALESCE(n.detected_at, '')
                OR COALESCE(o.title_zh, '') <> COALESCE(n.title_zh, '')
                OR COALESCE(o.summary_zh, '') <> COALESCE(n.summary_zh, '')
                OR COALESCE(o.body_zh, '') <> COALESCE(n.body_zh, '')
                OR COALESCE(o.translate_status, '') <> COALESCE(n.translate_status, '')
                OR COALESCE(o.references_json, '') <> COALESCE(n.references_json, '')
                OR COALESCE(o.is_read, -1) <> COALESCE(n.is_read, -1)
            ORDER BY o.id
            """
        ).fetchall()
        rows_for_csv["changed_changes"].extend(dict(row) for row in changed_changes)

        conflict_counts = {key: len(value) for key, value in rows_for_csv.items()}

    write_csv(
        report_dir / "utd_old_only_entries.csv",
        rows_for_csv["old_only_entries"],
        ["topic_id", "anchor_id", "title", "last_changed_at", "content_hash"],
    )
    write_csv(
        report_dir / "utd_changed_topics.csv",
        rows_for_csv["changed_topics"],
        [
            "topic_id",
            "slug",
            "old_last_version",
            "new_last_version",
            "old_last_updated_date",
            "new_last_updated_date",
            "old_last_crawled_at",
            "new_last_crawled_at",
        ],
    )
    write_csv(
        report_dir / "utd_changed_entries.csv",
        rows_for_csv["changed_entries"],
        [
            "topic_id",
            "anchor_id",
            "old_title",
            "new_title",
            "old_content_hash",
            "new_content_hash",
            "old_last_changed_at",
            "new_last_changed_at",
            "old_translate_status",
            "new_translate_status",
        ],
    )
    write_csv(
        report_dir / "utd_changed_changes.csv",
        rows_for_csv["changed_changes"],
        [
            "id",
            "old_crawl_id",
            "new_crawl_id",
            "old_topic_id",
            "new_topic_id",
            "old_anchor_id",
            "new_anchor_id",
            "old_detected_at",
            "new_detected_at",
            "old_translate_status",
            "new_translate_status",
            "old_is_read",
            "new_is_read",
        ],
    )
    report["conflict_counts"] = conflict_counts

    with open_db(dest_db) as conn:
        report["integrity_check"] = fetch_one(conn, "PRAGMA integrity_check")
        report["foreign_key_check_count"] = fetch_one(
            conn, "SELECT COUNT(*) FROM pragma_foreign_key_check"
        )
        checkpoint_wal(conn)

    return report


def merge_ai_requests(old_dir: Path, new_dir: Path, dest_dir: Path, report_dir: Path) -> dict[str, Any]:
    report: dict[str, Any] = {
        "old_files": 0,
        "new_files": 0,
        "added_from_new": 0,
        "same_path_same_content": 0,
        "same_path_different_content": 0,
    }
    conflicts: list[dict[str, Any]] = []

    if old_dir.exists():
        for src in old_dir.rglob("*"):
            if src.is_file():
                rel = src.relative_to(old_dir)
                copy_file_if_exists(src, dest_dir / rel)
                report["old_files"] += 1

    conflict_new_root = report_dir / "ai_requests_conflicts_new_copy"
    if new_dir.exists():
        for src in new_dir.rglob("*"):
            if not src.is_file():
                continue
            rel = src.relative_to(new_dir)
            report["new_files"] += 1
            dest = dest_dir / rel
            if not dest.exists():
                copy_file_if_exists(src, dest)
                report["added_from_new"] += 1
                continue
            old_hash = sha256_path(dest)
            new_hash = sha256_path(src)
            if old_hash == new_hash:
                report["same_path_same_content"] += 1
            else:
                report["same_path_different_content"] += 1
                conflicts.append(
                    {
                        "relative_path": str(rel),
                        "old_sha256": old_hash,
                        "new_sha256": new_hash,
                    }
                )
                copy_file_if_exists(src, conflict_new_root / rel)

    write_csv(
        report_dir / "ai_requests_path_conflicts.csv",
        conflicts,
        ["relative_path", "old_sha256", "new_sha256"],
    )
    report["merged_files"] = sum(1 for path in dest_dir.rglob("*") if path.is_file())
    return report


def write_text_diff(old_file: Path, new_file: Path, diff_file: Path) -> bool:
    if not old_file.exists() or not new_file.exists():
        return False
    old_text = old_file.read_text(encoding="utf-8", errors="replace").splitlines(True)
    new_text = new_file.read_text(encoding="utf-8", errors="replace").splitlines(True)
    if old_text == new_text:
        return False
    diff_file.parent.mkdir(parents=True, exist_ok=True)
    diff = difflib.unified_diff(
        old_text,
        new_text,
        fromfile=str(old_file),
        tofile=str(new_file),
    )
    diff_file.write_text("".join(diff), encoding="utf-8")
    return True


def analyze_sidecar_files(old_data: Path, new_data: Path, merged_data: Path, report_dir: Path) -> dict[str, Any]:
    report: dict[str, Any] = {}

    copy_tree(old_data / "standards", merged_data / "standards")
    copy_file_if_exists(old_data / "admin_runtime_config.json", merged_data / "admin_runtime_config.json")
    copy_file_if_exists(old_data / "content_framework.md", merged_data / "content_framework.md")

    standards_diffs: list[str] = []
    old_standards = old_data / "standards"
    new_standards = new_data / "standards"
    if old_standards.exists() and new_standards.exists():
        relative_files = sorted(
            {
                path.relative_to(old_standards)
                for path in old_standards.rglob("*")
                if path.is_file()
            }
            | {
                path.relative_to(new_standards)
                for path in new_standards.rglob("*")
                if path.is_file()
            }
        )
        for rel in relative_files:
            old_file = old_standards / rel
            new_file = new_standards / rel
            if not old_file.exists() or not new_file.exists():
                standards_diffs.append(str(rel))
                continue
            if not filecmp.cmp(old_file, new_file, shallow=False):
                standards_diffs.append(str(rel))
                write_text_diff(
                    old_file,
                    new_file,
                    report_dir / "standards_diffs" / rel.with_suffix(rel.suffix + ".diff"),
                )
    report["standards_different_files"] = standards_diffs

    admin_diff = write_text_diff(
        old_data / "admin_runtime_config.json",
        new_data / "admin_runtime_config.json",
        report_dir / "admin_runtime_config.diff",
    )
    report["admin_runtime_config_diff"] = admin_diff

    framework_same = False
    old_framework = old_data / "content_framework.md"
    new_framework = new_data / "content_framework.md"
    if old_framework.exists() and new_framework.exists():
        framework_same = filecmp.cmp(old_framework, new_framework, shallow=False)
        if not framework_same:
            write_text_diff(old_framework, new_framework, report_dir / "content_framework.diff")
    report["content_framework_same"] = framework_same
    report["staging_choice"] = {
        "standards": "old/current files copied; differences left for manual review",
        "admin_runtime_config": "old/current file copied; diff left for manual review",
        "content_framework": "old/current file copied",
    }
    return report


def write_markdown_report(path: Path, report: dict[str, Any]) -> None:
    sessions = report["sessions_db"]
    utd = report["utd_monitor_db"]
    ai = report["ai_requests"]
    sidecar = report["sidecar_files"]

    lines = [
        "# Backend Data Merge Dry Run Report",
        "",
        f"Generated at: {report['generated_at']}",
        "",
        "## Inputs",
        "",
        f"- Old/current data: `{report['old_data']}`",
        f"- New/import data: `{report['new_data']}`",
        f"- Output root: `{report['output']}`",
        f"- Staging merged data: `{report['merged_data']}`",
        "",
        "## sessions.db",
        "",
        "| Table | Before old | After merged |",
        "| --- | ---: | ---: |",
    ]
    for table in SESSIONS_TABLES:
        lines.append(f"| {table} | {sessions['before'][table]} | {sessions['after'][table]} |")
    lines.extend(
        [
            "",
            f"- Integrity check: `{sessions['integrity_check']}`",
            f"- Foreign key check count: `{sessions['foreign_key_check_count']}`",
            f"- User conflicts using new row: {sessions['conflict_counts']['user_conflicts']}",
            f"- Session conflicts resolved by later `updated_at`: {sessions['conflict_counts']['session_conflicts']}",
            f"- Registration code conflicts using new row: {sessions['conflict_counts']['registration_code_conflicts']}",
            f"- AI call log same-id conflicts kept as old: {sessions['conflict_counts']['ai_call_log_conflicts']}",
            f"- New orphan sessions skipped: {sessions['conflict_counts']['orphan_sessions_in_new']}",
            "",
            "## utd_monitor.db",
            "",
            "Strategy: copied the new/import database as current UTD state.",
            "",
            "| Table | Old/current | New/staging |",
            "| --- | ---: | ---: |",
        ]
    )
    for table in UTD_TABLES:
        lines.append(f"| {table} | {utd['old_counts'][table]} | {utd['new_counts'][table]} |")
    lines.extend(
        [
            "",
            f"- Integrity check: `{utd['integrity_check']}`",
            f"- Changed topics: {utd['conflict_counts']['changed_topics']}",
            f"- Changed entries: {utd['conflict_counts']['changed_entries']}",
            f"- Old-only entries not restored: {utd['conflict_counts']['old_only_entries']}",
            f"- Changed `changes` rows now follow new/import state: {utd['conflict_counts']['changed_changes']}",
            "",
            "## ai_requests",
            "",
            f"- Old files copied first: {ai['old_files']}",
            f"- New files scanned: {ai['new_files']}",
            f"- Added from new: {ai['added_from_new']}",
            f"- Same path and same content: {ai['same_path_same_content']}",
            f"- Same path but different content: {ai['same_path_different_content']}",
            f"- Merged files in staging: {ai['merged_files']}",
            "",
            "## Sidecar Files",
            "",
            f"- Standards differing files: {len(sidecar['standards_different_files'])}",
            f"- Admin runtime config differs: {sidecar['admin_runtime_config_diff']}",
            f"- Content framework same: {sidecar['content_framework_same']}",
            "",
            "Staging keeps old/current standards and admin runtime config. Review diffs before applying those files.",
            "",
            "## Report Files",
            "",
            "- `merge_report.json`",
            "- `sessions_conflicts.csv`",
            "- `user_conflicts.csv`",
            "- `registration_code_conflicts.csv`",
            "- `utd_old_only_entries.csv`",
            "- `utd_changed_topics.csv`",
            "- `utd_changed_entries.csv`",
            "- `utd_changed_changes.csv`",
            "- `ai_requests_path_conflicts.csv`",
            "- `standards_diffs/`",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    old_data = args.old_data.resolve()
    new_data = args.new_data.resolve()
    output = args.output.resolve()
    snapshots = output / "snapshots"
    merged_data = output / "merged-data"
    report_dir = output / "reports"

    if not old_data.exists():
        raise SystemExit(f"Old data directory does not exist: {old_data}")
    if not new_data.exists():
        raise SystemExit(f"New data directory does not exist: {new_data}")

    ensure_clean_output(output)
    snapshots.mkdir()
    merged_data.mkdir()
    report_dir.mkdir()

    old_sessions_snapshot = snapshots / "old" / "sessions.db"
    new_sessions_snapshot = snapshots / "new" / "sessions.db"
    old_utd_snapshot = snapshots / "old" / "utd_monitor.db"
    new_utd_snapshot = snapshots / "new" / "utd_monitor.db"
    snapshot_sqlite(old_data / "sessions.db", old_sessions_snapshot)
    snapshot_sqlite(new_data / "sessions.db", new_sessions_snapshot)
    snapshot_sqlite(old_data / "utd_monitor.db", old_utd_snapshot)
    snapshot_sqlite(new_data / "utd_monitor.db", new_utd_snapshot)

    report: dict[str, Any] = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "old_data": str(old_data),
        "new_data": str(new_data),
        "output": str(output),
        "merged_data": str(merged_data),
        "snapshots": str(snapshots),
    }
    report["sessions_db"] = merge_sessions_db(
        old_sessions_snapshot,
        new_sessions_snapshot,
        merged_data / "sessions.db",
        report_dir,
    )
    report["utd_monitor_db"] = analyze_utd(
        old_utd_snapshot,
        new_utd_snapshot,
        merged_data / "utd_monitor.db",
        report_dir,
    )
    report["ai_requests"] = merge_ai_requests(
        old_data / "ai_requests",
        new_data / "ai_requests",
        merged_data / "ai_requests",
        report_dir,
    )
    report["sidecar_files"] = analyze_sidecar_files(
        old_data,
        new_data,
        merged_data,
        report_dir,
    )

    (report_dir / "merge_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_markdown_report(report_dir / "merge_report.md", report)

    print(f"Output: {output}")
    print(f"Merged data: {merged_data}")
    print(f"Report: {report_dir / 'merge_report.md'}")


if __name__ == "__main__":
    main()
