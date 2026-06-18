import json
import threading
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from services.utd_monitor.config import UTD_BASE
from services.utd_monitor.crawler import crawl_lock, run_crawl
from services.utd_monitor.db import get_db

router = APIRouter(
    prefix="/api/utd",
    tags=["utd"],
    dependencies=[Depends(get_current_user)],
)


def crawl_in_background(trigger):
    threading.Thread(target=run_crawl, args=(trigger,), daemon=True).start()


def parse_refs(raw):
    if not raw:
        return []
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return []


def load_topics(conn):
    return {r["topic_id"]: dict(r) for r in conn.execute("SELECT * FROM topics").fetchall()}


def change_to_dict(row, topics):
    d = dict(row)
    t = topics.get(d["topic_id"], {})
    d["topic_name"] = t.get("name", "")
    d["topic_name_zh"] = t.get("name_zh") or t.get("name", "")
    d["topic_slug"] = t.get("slug", "")
    d["source_url"] = f"{UTD_BASE}/contents/{t.get('slug', '')}#{d['anchor_id']}"
    d["references"] = parse_refs(d.pop("references_json", None))
    return d


@router.get("/changes")
def list_changes(
    specialty: Optional[str] = None,
    type: Optional[str] = None,
    days: Optional[int] = None,
    q: Optional[str] = None,
    unread_only: bool = False,
    page: int = 1,
    page_size: int = Query(20, le=100),
):
    where, params = ["1=1"], []
    if specialty:
        where.append("topic_id = (SELECT topic_id FROM topics WHERE slug=?)")
        params.append(specialty)
    if type:
        where.append("change_type=?")
        params.append(type)
    if days:
        where.append("detected_at >= datetime('now', ?)")
        params.append(f"-{days} days")
    if q:
        where.append("(title LIKE ? OR title_zh LIKE ? OR summary_zh LIKE ? OR new_text LIKE ?)")
        params += [f"%{q}%"] * 4
    if unread_only:
        where.append("is_read=0")
    cond = " AND ".join(where)

    with get_db() as conn:
        topics = load_topics(conn)
        total = conn.execute(f"SELECT COUNT(*) FROM changes WHERE {cond}", params).fetchone()[0]
        rows = conn.execute(
            f"""SELECT id, crawl_id, topic_id, anchor_id, change_type, title, section, section_date,
                detected_at, title_zh, summary_zh, translate_status, is_read
                FROM changes WHERE {cond}
                ORDER BY detected_at DESC, id DESC LIMIT ? OFFSET ?""",
            params + [page_size, (page - 1) * page_size],
        ).fetchall()
        unread = conn.execute("SELECT COUNT(*) FROM changes WHERE is_read=0").fetchone()[0]
    return {
        "total": total,
        "unread": unread,
        "page": page,
        "items": [change_to_dict(r, topics) for r in rows],
    }


@router.get("/changes/{change_id}")
def get_change(change_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM changes WHERE id=?", (change_id,)).fetchone()
        if not row:
            raise HTTPException(404, "变更不存在")
        topics = load_topics(conn)
    return change_to_dict(row, topics)


@router.post("/changes/{change_id}/read")
def mark_read(change_id: int):
    with get_db() as conn:
        conn.execute("UPDATE changes SET is_read=1 WHERE id=?", (change_id,))
    return {"ok": True}


@router.post("/changes/read-all")
def mark_all_read():
    with get_db() as conn:
        conn.execute("UPDATE changes SET is_read=1")
    return {"ok": True}


@router.get("/topics")
def list_topics():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM topics ORDER BY name").fetchall()
        stats = {
            r["topic_id"]: dict(r)
            for r in conn.execute(
                """SELECT topic_id,
                   COUNT(*) AS total_changes,
                   SUM(CASE WHEN is_read=0 THEN 1 ELSE 0 END) AS unread,
                   SUM(CASE WHEN detected_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS recent_changes
                   FROM changes GROUP BY topic_id"""
            ).fetchall()
        }
        entry_counts = {
            r["topic_id"]: r["n"]
            for r in conn.execute("SELECT topic_id, COUNT(*) AS n FROM entries GROUP BY topic_id").fetchall()
        }
    out = []
    for r in rows:
        d = dict(r)
        s = stats.get(d["topic_id"], {})
        d["name_zh"] = d["name_zh"] or d["name"]
        d["entry_count"] = entry_counts.get(d["topic_id"], 0)
        d["total_changes"] = s.get("total_changes", 0)
        d["unread"] = s.get("unread", 0) or 0
        d["recent_changes"] = s.get("recent_changes", 0) or 0
        out.append(d)
    return out


@router.get("/topics/{slug}/entries")
def topic_entries(slug: str):
    with get_db() as conn:
        topic = conn.execute("SELECT * FROM topics WHERE slug=?", (slug,)).fetchone()
        if not topic:
            raise HTTPException(404, "专科不存在")
        entries = conn.execute(
            "SELECT * FROM entries WHERE topic_id=? ORDER BY rowid", (topic["topic_id"],)
        ).fetchall()
        changes = conn.execute(
            """SELECT id, change_type, title, title_zh, summary_zh, section, detected_at, is_read
               FROM changes WHERE topic_id=? ORDER BY detected_at DESC, id DESC LIMIT 100""",
            (topic["topic_id"],),
        ).fetchall()
    d = dict(topic)
    d["name_zh"] = d["name_zh"] or d["name"]

    def entry_dict(e):
        ed = dict(e)
        ed["references"] = parse_refs(ed.pop("references_json", None))
        return ed

    return {
        "topic": d,
        "entries": [entry_dict(e) for e in entries],
        "changes": [dict(c) for c in changes],
    }


@router.post("/crawl")
def trigger_crawl():
    if crawl_lock.locked():
        return {"started": False, "message": "已有检查在进行中"}
    crawl_in_background("manual")
    return {"started": True}


@router.get("/crawls")
def list_crawls(limit: int = 30):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM crawls ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return {"running": crawl_lock.locked(), "items": [dict(r) for r in rows]}
