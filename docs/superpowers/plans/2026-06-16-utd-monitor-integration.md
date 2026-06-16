# UTD Monitor Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the standalone UTD Monitor into Editing Assistant as an authenticated `/api/utd` backend module and a header-accessible frontend module.

**Architecture:** Move the standalone monitor's crawler, SQLite schema, translation, and API behavior into a namespaced backend service and router. Convert the standalone monitor's route-based React UI into a state-driven module rendered inside the existing authenticated app shell. Keep monitor data in `backend/data/utd_monitor.db`.

**Tech Stack:** FastAPI, SQLite, APScheduler, httpx, BeautifulSoup, OpenAI-compatible DeepSeek client, React 18, TypeScript, Vite, `diff`.

---

## File Structure

Backend:

- Create `backend/services/utd_monitor/__init__.py`: package marker.
- Create `backend/services/utd_monitor/config.py`: monitor constants, API URLs, database path.
- Create `backend/services/utd_monitor/db.py`: SQLite schema, migrations, connection helper.
- Create `backend/services/utd_monitor/crawler.py`: fetch, parse, diff, crawl orchestration.
- Create `backend/services/utd_monitor/translator.py`: DeepSeek translation for pending rows.
- Create `backend/routers/utd.py`: authenticated `/api/utd` endpoints.
- Modify `backend/main.py`: include UTD router, initialize scheduler/database on startup, shut scheduler down on shutdown.
- Modify `backend/requirements.txt`: add `apscheduler` and `openai`.
- Create `backend/tests/test_utd_monitor.py`: parser, diff, database, and router tests.

Frontend:

- Create `frontend/src/components/utd/types.ts`: UTD data interfaces.
- Create `frontend/src/components/utd/api.ts`: authenticated API client helpers using existing `apiFetch`.
- Create `frontend/src/components/utd/UtdReferences.tsx`: reference list renderer.
- Create `frontend/src/components/utd/UtdDashboard.tsx`: latest changes view.
- Create `frontend/src/components/utd/UtdChangeDetail.tsx`: detail and diff view.
- Create `frontend/src/components/utd/UtdTopics.tsx`: specialty table.
- Create `frontend/src/components/utd/UtdTopicDetail.tsx`: entries and specialty history.
- Create `frontend/src/components/utd/UtdCrawls.tsx`: crawl history.
- Create `frontend/src/components/utd/UtdMonitor.tsx`: module shell and local view navigation.
- Modify `frontend/src/App.tsx`: add `utd` app view and header entry.
- Modify `frontend/src/index.css`: add prefixed `.utd-*` styles.
- Modify `frontend/package.json` and `frontend/package-lock.json`: add `diff`.

## Task 1: Backend Monitor Core

**Files:**

- Create: `backend/services/utd_monitor/__init__.py`
- Create: `backend/services/utd_monitor/config.py`
- Create: `backend/services/utd_monitor/db.py`
- Create: `backend/services/utd_monitor/crawler.py`
- Test: `backend/tests/test_utd_monitor.py`

- [ ] **Step 1: Write failing parser/reference tests**

Add `UtdParserTests` to `backend/tests/test_utd_monitor.py`:

```python
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
        self.assertNotIn("[1]", entries[0]["body_text"])
```

- [ ] **Step 2: Run parser test and verify it fails**

Run: `cd backend && python3 -m unittest tests.test_utd_monitor.UtdParserTests.test_parse_entries_extracts_references_and_absolute_links -v`

Expected: FAIL or import error because `services.utd_monitor` does not exist.

- [ ] **Step 3: Implement monitor config/db/crawler**

Port the standalone monitor's `config.py`, `db.py`, and `crawler.py` into `backend/services/utd_monitor/`, changing imports to package-relative imports such as `from .config import ...` and `from .db import get_db`.

Set `DB_PATH = Path(__file__).resolve().parents[2] / "data" / "utd_monitor.db"` in `config.py`.

- [ ] **Step 4: Run parser test and verify it passes**

Run: `cd backend && python3 -m unittest tests.test_utd_monitor.UtdParserTests.test_parse_entries_extracts_references_and_absolute_links -v`

Expected: PASS.

- [ ] **Step 5: Write failing diff/baseline tests**

Add tests for `diff_topic`:

```python
class UtdDiffTests(unittest.TestCase):
    def test_baseline_updates_entries_without_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(utd_db, "DB_PATH", Path(tmp) / "utd.db"), patch.object(crawler, "get_db", utd_db.get_db):
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
        # Insert one baseline entry, then run diff with changed body and baseline=False.
        # Assert one modified row is written.
```

- [ ] **Step 6: Run diff tests and verify failures**

Run: `cd backend && python3 -m unittest tests.test_utd_monitor.UtdDiffTests -v`

Expected: initially FAIL until helper and implementation are complete.

- [ ] **Step 7: Complete minimal diff test helpers and implementation fixes**

Add a `_entry` helper in the test file and adjust the ported crawler as needed so tests can patch the DB path cleanly.

- [ ] **Step 8: Run backend monitor core tests**

Run: `cd backend && python3 -m unittest tests.test_utd_monitor -v`

Expected: PASS.

- [ ] **Step 9: Commit backend monitor core**

Run:

```bash
git add backend/services/utd_monitor backend/tests/test_utd_monitor.py
git commit -m "Add UTD monitor backend core"
```

## Task 2: Backend Router, Scheduler, and Dependencies

**Files:**

- Create: `backend/routers/utd.py`
- Modify: `backend/main.py`
- Modify: `backend/requirements.txt`
- Create/modify: `backend/tests/test_utd_monitor.py`

- [ ] **Step 1: Write failing router/auth tests**

Add `UtdRouterTests`:

```python
class UtdRouterTests(unittest.TestCase):
    def test_router_uses_api_utd_prefix_and_auth_dependency(self):
        from routers import utd

        paths = {route.path for route in utd.router.routes}

        self.assertIn("/api/utd/changes", paths)
        self.assertIn("/api/utd/crawl", paths)
        self.assertTrue(utd.router.dependencies)
```

- [ ] **Step 2: Run router test and verify it fails**

Run: `cd backend && python3 -m unittest tests.test_utd_monitor.UtdRouterTests.test_router_uses_api_utd_prefix_and_auth_dependency -v`

Expected: FAIL or import error because `routers.utd` does not exist.

- [ ] **Step 3: Implement router**

Port standalone `backend/main.py` endpoint logic into `backend/routers/utd.py` with:

```python
router = APIRouter(
    prefix="/api/utd",
    tags=["utd"],
    dependencies=[Depends(get_current_user)],
)
```

Move row conversion helpers into this router. Keep crawl trigger asynchronous through `threading.Thread`.

- [ ] **Step 4: Implement scheduler lifecycle helpers**

In `backend/services/utd_monitor/crawler.py` or a new small scheduler helper, expose:

```python
def init_monitor_service() -> None:
    ...

def shutdown_monitor_service() -> None:
    ...
```

Register these in `backend/main.py` startup/shutdown while preserving existing `db.init_db()`.

- [ ] **Step 5: Add dependencies**

Add to `backend/requirements.txt`:

```text
apscheduler>=3.10.4
openai>=1.0.0
```

- [ ] **Step 6: Run router tests**

Run: `cd backend && python3 -m unittest tests.test_utd_monitor.UtdRouterTests -v`

Expected: PASS.

- [ ] **Step 7: Run full backend tests**

Run: `cd backend && python3 -m unittest discover tests -v`

Expected: PASS.

- [ ] **Step 8: Commit router and scheduler**

Run:

```bash
git add backend/routers/utd.py backend/main.py backend/requirements.txt backend/tests/test_utd_monitor.py
git commit -m "Add UTD monitor API routes"
```

## Task 3: Frontend Module API and Shell

**Files:**

- Create: `frontend/src/components/utd/types.ts`
- Create: `frontend/src/components/utd/api.ts`
- Create: `frontend/src/components/utd/UtdMonitor.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write the intended API wrapper**

Create `api.ts` with functions pointing to `/api/utd/...` and using existing `apiFetch`.

- [ ] **Step 2: Add UTD app view shell**

Create `UtdMonitor.tsx` with local view state:

```typescript
type UtdView =
  | { name: 'dashboard' }
  | { name: 'changeDetail'; id: number }
  | { name: 'topics' }
  | { name: 'topicDetail'; slug: string }
  | { name: 'crawls' }
```

Render placeholder sections first so TypeScript can validate integration.

- [ ] **Step 3: Modify App to enter and leave UTD view**

Change `appView` to `main | history | utd`. Add a header button:

```tsx
<button className={`btn-m3-icon-label ${isUtdView ? 'active' : ''}`} onClick={() => setAppView('utd')}>
  <span className="material-symbols-outlined">monitoring</span>
  <span>更新监控</span>
</button>
```

Render `<UtdMonitor />` in full-width main content when `appView === 'utd'`. Hide workflow sidebar/footer in UTD view.

- [ ] **Step 4: Run frontend build to expose missing pieces**

Run: `cd frontend && npm run build`

Expected: FAIL until all referenced components are implemented.

## Task 4: Frontend UTD Views

**Files:**

- Create: `frontend/src/components/utd/UtdReferences.tsx`
- Create: `frontend/src/components/utd/UtdDashboard.tsx`
- Create: `frontend/src/components/utd/UtdChangeDetail.tsx`
- Create: `frontend/src/components/utd/UtdTopics.tsx`
- Create: `frontend/src/components/utd/UtdTopicDetail.tsx`
- Create: `frontend/src/components/utd/UtdCrawls.tsx`
- Modify: `frontend/src/components/utd/UtdMonitor.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Implement references and shared formatting**

Port `References.tsx`, `fmtTime`, `fmtDate`, and `TYPE_LABEL` into the UTD module.

- [ ] **Step 2: Implement dashboard**

Port standalone `Dashboard.tsx`, replacing `useNavigate` with callback props:

```typescript
onOpenChange(id: number): void
onOpenTopics(): void
onOpenCrawls(): void
```

- [ ] **Step 3: Implement change detail**

Port standalone `ChangeDetail.tsx`, replacing `useParams` and `Link` with props and callbacks.

- [ ] **Step 4: Implement topics, topic detail, and crawls**

Port the remaining standalone pages and replace route navigation with callback props.

- [ ] **Step 5: Add scoped UTD styles**

Copy only the monitor styles needed by the new components into `frontend/src/index.css`, prefixing selectors with `.utd-` and using existing DUI variables.

- [ ] **Step 6: Add `diff` dependency**

Run: `cd frontend && npm install diff @types/diff`

Expected: `frontend/package.json` and `frontend/package-lock.json` update.

- [ ] **Step 7: Run frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 8: Commit frontend module**

Run:

```bash
git add frontend/src/App.tsx frontend/src/components/utd frontend/src/index.css frontend/package.json frontend/package-lock.json
git commit -m "Add UTD monitor frontend module"
```

## Task 5: End-to-End Verification and Cleanup

**Files:**

- Modify only if verification exposes issues.

- [ ] **Step 1: Run backend tests**

Run: `cd backend && python3 -m unittest discover tests -v`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 3: Start backend server**

Run: `cd backend && python3 -m uvicorn main:app --host 127.0.0.1 --port 8004`

Expected: server starts without import or scheduler errors.

- [ ] **Step 4: Start frontend server**

Run: `cd frontend && npm run dev -- --host 127.0.0.1 --port 5177`

Expected: Vite starts.

- [ ] **Step 5: Browser smoke test**

Use the in-app browser to open `http://127.0.0.1:5177`, log in if needed, click `更新监控`, and verify the module renders without clearing the current app shell.

- [ ] **Step 6: API smoke test**

With a valid session token or direct dependency override in a test, verify `/api/utd/changes` returns a JSON payload shape:

```json
{"total": 0, "unread": 0, "page": 1, "items": []}
```

- [ ] **Step 7: Final git status**

Run: `git status --short`

Expected: only intended files changed, or clean after final commit.

- [ ] **Step 8: Final commit and push**

Run:

```bash
git add .
git commit -m "Integrate UTD monitor"
git push origin main
```

Only commit if there are remaining changes not covered by earlier task commits.
