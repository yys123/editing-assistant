"""一次性回填：为库中已有 entries 抓取并写入引用文献（references_json）。

用定向 UPDATE 只更新 references_json 列，不动翻译/正文列，可与翻译回填并行运行。
幂等可重跑。用法：python3 migrate_references.py
"""
import logging
import time

import httpx

from config import TOPIC_API, USER_AGENT, CRAWL_DELAY_SECONDS
from crawler import fetch_toc, fetch_topic, parse_entries
from db import get_db, init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("migrate_references")


def main():
    init_db()
    updated = total_refs = 0
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=30) as client:
        toc = fetch_toc(client)
        for t in toc:
            time.sleep(CRAWL_DELAY_SECONDS)
            try:
                data = fetch_topic(client, t["slug"])
                entries = parse_entries(data.get("bodyHtml", ""))
            except Exception:
                logger.exception("抓取 %s 失败", t["slug"])
                continue
            n = sum(len(e["references"]) for e in entries)
            total_refs += n
            with get_db() as conn:
                for e in entries:
                    conn.execute(
                        "UPDATE entries SET references_json=? WHERE topic_id=? AND anchor_id=?",
                        (e["references_json"], t["topic_id"], e["anchor_id"]),
                    )
                    updated += 1
            logger.info("%s: %d 条更新，共引用 %d 篇文献", t["slug"], len(entries), n)
    logger.info("回填结束：更新 %d 条 entries，累计文献引用 %d", updated, total_refs)


if __name__ == "__main__":
    main()
