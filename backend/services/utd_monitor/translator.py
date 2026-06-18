"""用 DeepSeek 把新增/修改的条目翻译成中文并生成摘要。"""
import json
import logging

from openai import OpenAI

from config import settings
from .db import get_db

logger = logging.getLogger("translator")

PROMPT = """你是医学编辑助手。下面是 UpToDate "What's New" 中的一条更新（英文），请输出 JSON：
{{
  "title_zh": "标题的中文翻译（去掉末尾的月份括号）",
  "summary_zh": "一句话中文摘要（50字以内，说清楚这条更新改变了什么）",
  "body_zh": "正文的完整中文翻译，保持专业医学术语准确，药名保留英文并附中文"
}}

标题：{title}
正文：
{body}
"""

_client = None


def get_client():
    """惰性创建 DeepSeek 客户端（OpenAI 兼容接口）。"""
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
    return _client


def translate_one(client, title, body):
    resp = client.chat.completions.create(
        model=settings.deepseek_model,
        messages=[{"role": "user", "content": PROMPT.format(title=title, body=body[:8000])}],
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=8000,
    )
    data = json.loads(resp.choices[0].message.content)
    return data.get("title_zh", ""), data.get("summary_zh", ""), data.get("body_zh", "")


def translate_pending(limit=50):
    """翻译所有待处理的变更（每次抓取后调用，失败的下次重试）。"""
    if not settings.deepseek_api_key:
        logger.warning("未配置 DEEPSEEK_API_KEY，跳过翻译")
        return

    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, title, new_text FROM changes
               WHERE translate_status IN ('pending', 'failed') AND change_type != 'removed'
               ORDER BY id DESC LIMIT ?""",
            (limit,),
        ).fetchall()
    if not rows:
        return

    client = get_client()
    logger.info("待翻译 %d 条", len(rows))

    for row in rows:
        try:
            title_zh, summary_zh, body_zh = translate_one(client, row["title"], row["new_text"])
            with get_db() as conn:
                conn.execute(
                    "UPDATE changes SET title_zh=?, summary_zh=?, body_zh=?, translate_status='done' WHERE id=?",
                    (title_zh, summary_zh, body_zh, row["id"]),
                )
        except Exception:
            logger.exception("翻译变更 #%s 失败", row["id"])
            with get_db() as conn:
                conn.execute(
                    "UPDATE changes SET translate_status='failed' WHERE id=?", (row["id"],)
                )


def translate_pending_entries(limit=None):
    """翻译 entries 表中待处理的条目（只存 title_zh + body_zh，不需要摘要）。

    limit=None 时处理全部待译条目（用于一次性回填）；否则每批处理 limit 条。
    """
    if not settings.deepseek_api_key:
        logger.warning("未配置 DEEPSEEK_API_KEY，跳过条目翻译")
        return 0

    sql = """SELECT topic_id, anchor_id, title, body_text FROM entries
             WHERE translate_status IN ('pending', 'failed') ORDER BY rowid"""
    params = ()
    if limit is not None:
        sql += " LIMIT ?"
        params = (limit,)
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    if not rows:
        return 0

    client = get_client()
    logger.info("待翻译条目 %d 条", len(rows))

    done = 0
    for row in rows:
        try:
            title_zh, _summary, body_zh = translate_one(client, row["title"], row["body_text"])
            with get_db() as conn:
                conn.execute(
                    "UPDATE entries SET title_zh=?, body_zh=?, translate_status='done' "
                    "WHERE topic_id=? AND anchor_id=?",
                    (title_zh, body_zh, row["topic_id"], row["anchor_id"]),
                )
            done += 1
        except Exception:
            logger.exception("翻译条目 %s/%s 失败", row["topic_id"], row["anchor_id"])
            with get_db() as conn:
                conn.execute(
                    "UPDATE entries SET translate_status='failed' "
                    "WHERE topic_id=? AND anchor_id=?",
                    (row["topic_id"], row["anchor_id"]),
                )
    return done
