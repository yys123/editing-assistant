from pathlib import Path
BASE_DIR = Path(__file__).resolve().parents[2]
DB_PATH = BASE_DIR / "data" / "utd_monitor.db"

UTD_BASE = "https://www.uptodate.cn"
TOC_API = f"{UTD_BASE}/services/app/contents/table-of-contents/whats-new/json"
TOPIC_API = f"{UTD_BASE}/services/app/contents/topic/{{slug}}/json"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
CRAWL_DELAY_SECONDS = 1.5
