"""一次性迁移：把库中已有正文 HTML 的相对链接转成 UpToDate 绝对链接。

幂等：链接已是 http(s) 开头的不会被重复处理。可安全重复运行。
用法：python3 migrate_links.py
"""
from crawler import absolutize_links
from db import get_db


def main():
    with get_db() as conn:
        entries = conn.execute("SELECT rowid, body_html FROM entries").fetchall()
        n_entries = 0
        for r in entries:
            new_html = absolutize_links(r["body_html"])
            if new_html != r["body_html"]:
                conn.execute("UPDATE entries SET body_html=? WHERE rowid=?", (new_html, r["rowid"]))
                n_entries += 1

        changes = conn.execute("SELECT id, new_html FROM changes WHERE new_html != ''").fetchall()
        n_changes = 0
        for r in changes:
            new_html = absolutize_links(r["new_html"])
            if new_html != r["new_html"]:
                conn.execute("UPDATE changes SET new_html=? WHERE id=?", (new_html, r["id"]))
                n_changes += 1

    print(f"已更新 entries {n_entries}/{len(entries)} 条，changes {n_changes}/{len(changes)} 条")


if __name__ == "__main__":
    main()
