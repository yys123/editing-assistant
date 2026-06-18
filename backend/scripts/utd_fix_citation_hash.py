"""一次性修复：引用编号顺移导致的误报"修改"。

1. 用新逻辑（剔除内联引用编号）重算所有 entries 的 body_text + content_hash，
   定向 UPDATE，不产生新的变更记录——把库与新 hash 口径对齐。
2. 清理已记录的误报：对每条 modified 变更，剥掉新旧文本里的方括号引用编号后
   比较，若完全相同则为"仅编号顺移"的误报，删除；真实修改保留。
3. 重算受影响 crawl 的 changes_found / topics_changed。

幂等可重跑。用法：python3 fix_citation_hash.py
"""
import logging
import re

from crawler import html_to_text
from db import get_db, init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("fix_citation_hash")

# 剥掉纯由数字/分隔符/连字符组成的方括号引用组，如 [48]、[48,49]、[87-89]
CITE_GROUP_RE = re.compile(r"\[[\d,，;；\s\-–—]*\]")


def norm(text):
    return re.sub(r"\s+", " ", CITE_GROUP_RE.sub("", text or "")).strip()


def rebaseline_entries():
    import hashlib
    with get_db() as conn:
        rows = conn.execute("SELECT topic_id, anchor_id, title, body_html FROM entries").fetchall()
        changed = 0
        for r in rows:
            body_text = html_to_text(r["body_html"])
            h = hashlib.sha256((r["title"] + "\n" + body_text).encode("utf-8")).hexdigest()
            conn.execute(
                "UPDATE entries SET body_text=?, content_hash=? WHERE topic_id=? AND anchor_id=?",
                (body_text, h, r["topic_id"], r["anchor_id"]),
            )
            changed += 1
    logger.info("重算 entries 完成：%d 条", changed)


def clean_false_modified():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, old_text, new_text FROM changes WHERE change_type='modified'"
        ).fetchall()
        false_ids = [r["id"] for r in rows if norm(r["old_text"]) == norm(r["new_text"])]
        for cid in false_ids:
            conn.execute("DELETE FROM changes WHERE id=?", (cid,))
    logger.info("modified 共 %d 条，删除误报 %d 条，保留真实修改 %d 条",
                len(rows), len(false_ids), len(rows) - len(false_ids))


def recount_crawls():
    with get_db() as conn:
        for cr in conn.execute("SELECT id FROM crawls").fetchall():
            cid = cr["id"]
            n = conn.execute("SELECT COUNT(*) FROM changes WHERE crawl_id=?", (cid,)).fetchone()[0]
            nt = conn.execute(
                "SELECT COUNT(DISTINCT topic_id) FROM changes WHERE crawl_id=?", (cid,)
            ).fetchone()[0]
            conn.execute(
                "UPDATE crawls SET changes_found=?, topics_changed=? WHERE id=?", (n, nt, cid)
            )
    logger.info("已重算各次抓取的变更计数")


def main():
    init_db()
    rebaseline_entries()
    clean_false_modified()
    recount_crawls()
    with get_db() as conn:
        for t, c in conn.execute("SELECT change_type, COUNT(*) FROM changes GROUP BY change_type"):
            logger.info("剩余变更 %s: %d", t, c)


if __name__ == "__main__":
    main()
