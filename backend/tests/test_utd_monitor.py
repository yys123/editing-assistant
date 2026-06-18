import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from services.utd_monitor import crawler, db as utd_db


class UtdParserTests(unittest.TestCase):
    def test_parse_entries_extracts_references_and_absolute_links(self):
        html = """
        <div id="topicText">
          <p id="H1" class="headingAnchor"><span class="h1">Cardiology</span></p>
          <p id="H2" class="headingAnchor"><span class="h2">New anticoagulant data (May 2026)</span></p>
          <p>Body with <a href="/contents/topic-a">relative topic</a> and <a href="/abstract/1">1</a>.</p>
        </div>
        <ol id="reference"><li><a href="/abstract/1">Smith 2026</a></li></ol>
        """

        entries = crawler.parse_entries(html)

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["anchor_id"], "H2")
        self.assertEqual(entries[0]["section"], "Cardiology")
        self.assertEqual(entries[0]["section_date"], "May 2026")
        self.assertIn("https://www.uptodate.cn/contents/topic-a", entries[0]["body_html"])
        self.assertEqual(entries[0]["references"][0]["n"], 1)
        self.assertEqual(entries[0]["references"][0]["url"], "https://www.uptodate.cn/abstract/1")
        self.assertNotIn("[1]", entries[0]["body_text"])


class UtdDiffTests(unittest.TestCase):
    def _entry(self, anchor_id, title, body_text):
        return {
            "anchor_id": anchor_id,
            "section": "Cardiology",
            "section_date": "May 2026",
            "title": title,
            "body_html": f"<p>{body_text}</p>",
            "body_text": body_text,
            "content_hash": hashlib.sha256((title + "\n" + body_text).encode("utf-8")).hexdigest(),
            "references_json": json.dumps([], ensure_ascii=False),
        }

    def test_baseline_updates_entries_without_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(utd_db, "DB_PATH", Path(tmp) / "utd.db"):
                utd_db.init_db()
                entry = self._entry("A1", "Title (May 2026)", "Body")
                with utd_db.get_db() as conn:
                    conn.execute("INSERT INTO crawls (started_at, trigger) VALUES ('now','test')")
                    n = crawler.diff_topic(conn, 1, "topic-1", [entry], baseline=True, detected_at="now")
                    changes = conn.execute("SELECT COUNT(*) FROM changes").fetchone()[0]
                    entries = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]

        self.assertEqual(n, 0)
        self.assertEqual(changes, 0)
        self.assertEqual(entries, 1)

    def test_modified_entry_creates_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(utd_db, "DB_PATH", Path(tmp) / "utd.db"):
                utd_db.init_db()
                original = self._entry("A1", "Title (May 2026)", "Original body")
                changed = self._entry("A1", "Title (May 2026)", "Changed body")
                with utd_db.get_db() as conn:
                    conn.execute("INSERT INTO crawls (started_at, trigger) VALUES ('now','test')")
                    crawler.diff_topic(conn, 1, "topic-1", [original], baseline=True, detected_at="now")
                    n = crawler.diff_topic(conn, 1, "topic-1", [changed], baseline=False, detected_at="later")
                    row = conn.execute("SELECT change_type, old_text, new_text FROM changes").fetchone()

        self.assertEqual(n, 1)
        self.assertEqual(row["change_type"], "modified")
        self.assertEqual(row["old_text"], "Original body")
        self.assertEqual(row["new_text"], "Changed body")


class UtdRouterTests(unittest.TestCase):
    def test_router_uses_api_utd_prefix_and_auth_dependency(self):
        from routers import utd

        paths = {route.path for route in utd.router.routes}

        self.assertIn("/api/utd/changes", paths)
        self.assertIn("/api/utd/crawl", paths)
        self.assertTrue(utd.router.dependencies)


if __name__ == "__main__":
    unittest.main()
