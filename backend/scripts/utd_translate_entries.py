"""一次性回填：翻译 entries 表中所有待译条目（title_zh + body_zh）。

幂等：只处理 translate_status 为 pending/failed 的条目，已 done 的跳过。
可安全重跑（失败的会重试）。后台运行：
    nohup python3 translate_entries.py > translate.log 2>&1 &
"""
import logging

from db import get_db, init_db
from translator import translate_pending_entries

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("translate_entries")


def main():
    init_db()
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
        pending = conn.execute(
            "SELECT COUNT(*) FROM entries WHERE translate_status IN ('pending','failed')"
        ).fetchone()[0]
    logger.info("条目总数 %d，待译 %d", total, pending)

    processed = 0
    # 分批处理，每批 50 条，直到没有 pending；防止单次失败影响全部
    while True:
        n = translate_pending_entries(limit=50)
        if n == 0:
            break
        processed += n
        with get_db() as conn:
            remain = conn.execute(
                "SELECT COUNT(*) FROM entries WHERE translate_status IN ('pending','failed')"
            ).fetchone()[0]
        logger.info("已完成 %d，剩余 %d", processed, remain)
        if remain == 0:
            break

    with get_db() as conn:
        done = conn.execute("SELECT COUNT(*) FROM entries WHERE translate_status='done'").fetchone()[0]
        failed = conn.execute("SELECT COUNT(*) FROM entries WHERE translate_status='failed'").fetchone()[0]
    logger.info("回填结束：done=%d failed=%d", done, failed)


if __name__ == "__main__":
    main()
