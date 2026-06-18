"""抓取 UpToDate What's New 页面，解析条目并与库中内容比对。"""
import hashlib
import json
import logging
import re
import threading
import time
from datetime import datetime, timezone

import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from bs4 import BeautifulSoup

from .config import TOC_API, TOPIC_API, USER_AGENT, CRAWL_DELAY_SECONDS, UTD_BASE
from .db import get_db, init_db

logger = logging.getLogger("crawler")
scheduler = BackgroundScheduler(timezone="Asia/Shanghai")

# 同一时间只允许一个抓取任务
crawl_lock = threading.Lock()


def crawl_in_background(trigger):
    threading.Thread(target=run_crawl, args=(trigger,), daemon=True).start()


def init_monitor_service():
    init_db()
    if not scheduler.running:
        scheduler.add_job(run_crawl, "cron", hour=2, minute=0, args=["scheduled"], id="utd_daily_crawl")
        scheduler.start()
        logger.info("已注册 UTD Monitor 每日 02:00 自动检查任务")
    with get_db() as conn:
        empty = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0] == 0
    if empty and not crawl_lock.locked():
        logger.info("UTD Monitor 数据库为空，后台执行首次基线抓取")
        crawl_in_background("baseline")


def shutdown_monitor_service():
    if scheduler.running:
        scheduler.shutdown(wait=False)

NAME_ZH = {
    "practice-changing-updates": "改变临床实践的更新",
    "whats-new-in-allergy-and-immunology": "变态反应与免疫学",
    "whats-new-in-anesthesiology": "麻醉学",
    "whats-new-in-cardiovascular-medicine": "心血管内科",
    "whats-new-in-dermatology": "皮肤科",
    "whats-new-in-drug-therapy": "药物治疗",
    "whats-new-in-emergency-medicine": "急诊医学",
    "whats-new-in-endocrinology-and-diabetes-mellitus": "内分泌与糖尿病",
    "whats-new-in-family-medicine": "全科医学",
    "whats-new-in-gastroenterology-and-hepatology": "消化与肝病",
    "whats-new-in-geriatrics": "老年医学",
    "whats-new-in-hematology": "血液科",
    "whats-new-in-hospital-medicine": "医院医学",
    "whats-new-in-infectious-diseases": "感染性疾病",
    "whats-new-in-nephrology-and-hypertension": "肾内科与高血压",
    "whats-new-in-neurology": "神经内科",
    "whats-new-in-obstetrics-and-gynecology": "妇产科",
    "whats-new-in-oncology": "肿瘤科",
    "whats-new-in-palliative-care": "姑息治疗",
    "whats-new-in-pediatrics": "儿科",
    "whats-new-in-primary-care": "初级保健",
    "whats-new-in-psychiatry": "精神科",
    "whats-new-in-pulmonary-and-critical-care-medicine": "呼吸与危重症医学",
    "whats-new-in-rheumatology": "风湿科",
    "whats-new-in-sleep-medicine": "睡眠医学",
    "whats-new-in-sports-medicine": "运动医学",
}


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def fetch_toc(client):
    resp = client.get(TOC_API)
    resp.raise_for_status()
    items = resp.json()["data"]["items"]
    return [
        {"topic_id": it["topicId"], "slug": it["url"].rstrip("/").split("/")[-1], "name": it["name"]}
        for it in items
        if it.get("type") == "TOPIC"
    ]


def fetch_topic(client, slug):
    resp = client.get(TOPIC_API.format(slug=slug))
    resp.raise_for_status()
    return resp.json()["data"]


DATE_RE = re.compile(r"\(([A-Z][a-z]+ \d{4})[^)]*\)\s*$")


def absolutize_links(html):
    """把正文里的相对链接（/contents/...）转成 UpToDate 绝对链接，并让其在新标签页打开。"""
    if not html:
        return html
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("//"):
            a["href"] = "https:" + href
        elif href.startswith("/"):
            a["href"] = UTD_BASE + href
        if a["href"].startswith("http"):
            a["target"] = "_blank"
            a["rel"] = "noopener noreferrer"
    return str(soup)


EMPTY_CITE_RE = re.compile(r"\[[\s,;，；\-–—]*\]")


def html_to_text(html):
    """把条目正文 HTML 转成纯文本，并剔除内联引用编号（[48] 这类）。

    UpToDate 在文档前面增删文献会让后续引用编号整体顺移，若把这些编号算进
    content_hash 会导致大量误报"修改"。引用信息已单独存于 references，正文文本
    （用于 hash / 翻译 / diff）不需要这些编号。
    """
    soup = BeautifulSoup(html or "", "html.parser")
    for a in soup.select("a[href*='/abstract/']"):
        a.decompose()
    text = soup.get_text(" ", strip=True)
    text = EMPTY_CITE_RE.sub("", text)        # 去掉剔除后残留的空方括号
    return re.sub(r"\s+", " ", text).strip()


def parse_references(soup):
    """解析页面底部 REFERENCES 列表，返回 {编号: {'n','text','url'}}。

    第 N 条 <li> 即引用编号 N；多数含 abstract 链接，少数指南/书籍为纯文本。
    """
    refs = {}
    ol = soup.find("ol", id="reference")
    if ol is None:
        return refs
    for i, li in enumerate(ol.find_all("li", recursive=False), 1):
        a = li.find("a", href=True)
        url = a["href"] if a else ""
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            url = UTD_BASE + url
        refs[i] = {"n": i, "text": li.get_text(" ", strip=True), "url": url}
    return refs


def parse_entries(body_html):
    """把正文 HTML 切分为条目列表，并把每条更新引用的文献附在 references 上。

    结构：p.headingAnchor > span.h1 为专科分组标题；span.h2 为条目标题（含月份），
    其后的兄弟节点为条目正文，直到下一个 headingAnchor。
    """
    soup = BeautifulSoup(body_html, "html.parser")
    refs = parse_references(soup)
    topic_text = soup.find(id="topicText")
    if topic_text is None:
        return []

    entries = []
    section = ""
    current = None

    for node in topic_text.children:
        if getattr(node, "name", None) is None:
            continue
        heading_span = None
        if "headingAnchor" in (node.get("class") or []):
            heading_span = node.find("span", class_=["h1", "h2", "h3"])
        if heading_span is not None:
            level = heading_span.get("class")[0]
            text = heading_span.get_text(" ", strip=True)
            if level == "h1":
                if current:
                    entries.append(current)
                    current = None
                section = text
            else:
                if current:
                    entries.append(current)
                m = DATE_RE.search(text)
                current = {
                    "anchor_id": node.get("id", ""),
                    "section": re.sub(r"\s*\([^)]*\)\s*$", "", section),
                    "section_date": m.group(1) if m else "",
                    "title": text,
                    "body_html": "",
                    "body_text": "",
                }
        elif current is not None:
            # 免责声明等尾部内容不属于任何条目
            if node.get("id") in ("disclaimerContent", "references"):
                entries.append(current)
                current = None
                continue
            current["body_html"] += str(node)

    if current:
        entries.append(current)

    for e in entries:
        # 该更新引用的文献编号（正文里的 abstract/N 链接），去重保序
        cited, seen_n = [], set()
        for m in re.findall(r"abstract/(\d+)", e["body_html"]):
            n = int(m)
            if n in refs and n not in seen_n:
                seen_n.add(n)
                cited.append(refs[n])
        e["references"] = sorted(cited, key=lambda r: r["n"])
        e["references_json"] = json.dumps(e["references"], ensure_ascii=False)
        # body_text 剔除内联引用编号，避免编号顺移触发误报"修改"
        e["body_text"] = html_to_text(e["body_html"])
        e["body_html"] = absolutize_links(e["body_html"])
        e["content_hash"] = hashlib.sha256(
            (e["title"] + "\n" + e["body_text"]).encode("utf-8")
        ).hexdigest()
    # 同一条目可能被交叉列在多个分组下（锚点重复），保留第一次出现
    seen = set()
    unique = []
    for e in entries:
        if e["anchor_id"] and e["anchor_id"] not in seen:
            seen.add(e["anchor_id"])
            unique.append(e)
    return unique


def norm_title(title):
    """去掉日期括号并归一化空白，用于把锚点变化但标题未变的条目配对成"修改"。"""
    t = re.sub(r"\s*\([^)]*\)\s*$", "", title)
    return re.sub(r"\s+", " ", t).strip().lower()


def diff_topic(conn, crawl_id, topic_id, new_entries, baseline, detected_at):
    """比对单个专科的新旧条目，写入 entries 与 changes，返回变更数。"""
    rows = conn.execute("SELECT * FROM entries WHERE topic_id=?", (topic_id,)).fetchall()
    old = {r["anchor_id"]: dict(r) for r in rows}
    new = {e["anchor_id"]: e for e in new_entries}

    added = [a for a in new if a not in old]
    removed = [a for a in old if a not in new]
    modified = [a for a in new if a in old and new[a]["content_hash"] != old[a]["content_hash"]]

    # 锚点变了但标题没变 → 视为修改而非"删除+新增"
    removed_by_title = {norm_title(old[a]["title"]): a for a in removed}
    paired = {}  # new_anchor -> old_anchor
    for a in list(added):
        key = norm_title(new[a]["title"])
        if key in removed_by_title:
            old_a = removed_by_title.pop(key)
            paired[a] = old_a
            added.remove(a)
            removed.remove(old_a)

    changes = []
    if not baseline:
        for a in added:
            changes.append(("new", a, "", new[a]))
        for a in modified:
            changes.append(("modified", a, old[a]["body_text"], new[a]))
        for a, old_a in paired.items():
            if new[a]["content_hash"] != old[old_a]["content_hash"]:
                changes.append(("modified", a, old[old_a]["body_text"], new[a]))
        for a in removed:
            e = old[a]
            changes.append(("removed", a, e["body_text"], {
                "title": e["title"], "section": e["section"],
                "section_date": e["section_date"], "body_text": "", "body_html": "",
            }))

    for change_type, anchor, old_text, e in changes:
        conn.execute(
            """INSERT INTO changes (crawl_id, topic_id, anchor_id, change_type, title,
               section, section_date, old_text, new_text, new_html, detected_at,
               translate_status, references_json)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (crawl_id, topic_id, anchor, change_type, e["title"], e["section"],
             e["section_date"], old_text, e.get("body_text", ""), e.get("body_html", ""),
             detected_at, "pending" if change_type != "removed" else "none",
             e.get("references_json", "[]")),
        )

    # 更新 entries 为最新状态
    conn.execute("DELETE FROM entries WHERE topic_id=?", (topic_id,))
    for e in new_entries:
        prev = old.get(e["anchor_id"])
        same = bool(prev and prev["content_hash"] == e["content_hash"])
        first_seen = prev["first_seen_at"] if prev else detected_at
        last_changed = prev["last_changed_at"] if same else detected_at
        # 内容未变沿用已有译文，变了（或新条目）置 pending 等待重译
        title_zh = prev["title_zh"] if same else ""
        body_zh = prev["body_zh"] if same else ""
        tstatus = prev["translate_status"] if same else "pending"
        conn.execute(
            """INSERT INTO entries (topic_id, anchor_id, section, section_date, title,
               body_html, body_text, content_hash, first_seen_at, last_changed_at,
               title_zh, body_zh, translate_status, references_json)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (topic_id, e["anchor_id"], e["section"], e["section_date"], e["title"],
             e["body_html"], e["body_text"], e["content_hash"], first_seen, last_changed,
             title_zh, body_zh, tstatus, e.get("references_json", "[]")),
        )
    return len(changes)


def run_crawl(trigger="manual"):
    """全量抓取一次。返回 crawl_id；若已有抓取在进行则返回 None。"""
    if not crawl_lock.acquire(blocking=False):
        logger.info("已有抓取任务在进行，跳过")
        return None
    try:
        return _run_crawl(trigger)
    finally:
        crawl_lock.release()


def _run_crawl(trigger):
    started = now_iso()
    with get_db() as conn:
        baseline = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0] == 0
        cur = conn.execute(
            "INSERT INTO crawls (started_at, trigger, status) VALUES (?,?,'running')",
            (started, trigger),
        )
        crawl_id = cur.lastrowid

    topics_checked = topics_changed = changes_found = 0
    error = ""
    try:
        with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=30) as client:
            toc = fetch_toc(client)
            logger.info("目录共 %d 个专科页面（baseline=%s）", len(toc), baseline)
            with get_db() as conn:
                for t in toc:
                    conn.execute(
                        """INSERT INTO topics (topic_id, slug, name, name_zh) VALUES (?,?,?,?)
                           ON CONFLICT(topic_id) DO UPDATE SET slug=excluded.slug, name=excluded.name""",
                        (t["topic_id"], t["slug"], t["name"], NAME_ZH.get(t["slug"], "")),
                    )

            for t in toc:
                time.sleep(CRAWL_DELAY_SECONDS)
                detected_at = now_iso()
                try:
                    data = fetch_topic(client, t["slug"])
                except Exception as exc:
                    logger.warning("抓取 %s 失败: %s", t["slug"], exc)
                    continue
                topics_checked += 1
                info = data["topicInfo"]
                version = str(info.get("version", ""))

                with get_db() as conn:
                    row = conn.execute(
                        "SELECT last_version FROM topics WHERE topic_id=?", (t["topic_id"],)
                    ).fetchone()
                    has_entries = conn.execute(
                        "SELECT COUNT(*) FROM entries WHERE topic_id=?", (t["topic_id"],)
                    ).fetchone()[0] > 0
                    if row and row["last_version"] == version and has_entries:
                        conn.execute(
                            "UPDATE topics SET last_crawled_at=? WHERE topic_id=?",
                            (detected_at, t["topic_id"]),
                        )
                        continue

                    entries = parse_entries(data.get("bodyHtml", ""))
                    if not entries:
                        logger.warning("%s 解析不到条目，跳过比对以防误报删除", t["slug"])
                        continue
                    n = diff_topic(conn, crawl_id, t["topic_id"], entries, baseline, detected_at)
                    changes_found += n
                    if n:
                        topics_changed += 1

                    m = re.search(r"last updated:</span>\s*&?#?160;?\s*([A-Z][a-z]+ \d+, \d{4})",
                                  data.get("bodyHtml", ""))
                    conn.execute(
                        "UPDATE topics SET last_version=?, last_updated_date=?, last_crawled_at=? WHERE topic_id=?",
                        (version, m.group(1) if m else "", detected_at, t["topic_id"]),
                    )
                logger.info("%s: version=%s 变更 %d 条", t["slug"], version, 0 if baseline else changes_found)
        status = "success"
    except Exception as exc:
        logger.exception("抓取失败")
        status = "failed"
        error = str(exc)

    with get_db() as conn:
        conn.execute(
            "UPDATE crawls SET finished_at=?, status=?, topics_checked=?, topics_changed=?, changes_found=?, error=? WHERE id=?",
            (now_iso(), status, topics_checked, topics_changed, changes_found, error, crawl_id),
        )

    # 抓取完成后翻译待处理的变更与条目
    try:
        from .translator import translate_pending, translate_pending_entries
        translate_pending()
        translate_pending_entries()
    except Exception:
        logger.exception("翻译失败")
    return crawl_id
