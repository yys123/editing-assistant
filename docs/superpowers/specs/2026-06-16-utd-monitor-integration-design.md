# UTD Monitor Integration Design

Date: 2026-06-16

## Goal

Integrate the existing `/Users/dxy/Documents/IT/utd-monitor` tool into Editing Assistant as a logged-in module. The integrated module should let editors monitor UpToDate "What's New" changes, review translated summaries and detail pages, browse specialty pages, and trigger manual crawls without leaving the main application.

## Current Context

Editing Assistant is a FastAPI backend plus React/Vite frontend. The frontend is a single authenticated app with a fixed header, a seven-step editing workflow sidebar, a history view, and admin settings. Backend state currently lives in `backend/data/sessions.db`.

`utd-monitor` is also a FastAPI plus React/Vite app. It already contains the core domain logic:

- Fetch UpToDate What's New table of contents and topic JSON APIs.
- Parse topic HTML into update entries.
- Track topics, current entries, crawls, and changes in SQLite.
- Diff entries by anchor id and normalized title.
- Parse references and attach them to entries and changes.
- Translate changes and entries with DeepSeek.
- Run a daily 02:00 APScheduler crawl and allow manual crawls.

The integration should reuse this proven behavior while reshaping the entry points, API paths, and UI shell to match Editing Assistant.

## Recommended Approach

Embed UTD Monitor as a first-class module inside Editing Assistant.

Backend code moves into a namespaced service package and router:

- `backend/services/utd_monitor/`
- `backend/routers/utd.py`

API endpoints are mounted under `/api/utd/...` instead of the standalone monitor's top-level `/api/...` routes. This avoids collisions with the existing Editing Assistant API and makes ownership clear.

Frontend code becomes a module view entered from the app header. The main `AppContent` view state expands from `main | history` to include `utd`. When `utd` is active, the seven-step workflow sidebar and footer are hidden, and a dedicated UTD Monitor workspace is shown.

This approach gives users one logged-in system while preserving clean code boundaries for future expansion.

## Backend Design

### Modules

Create a package at `backend/services/utd_monitor/`:

- `config.py`: UpToDate API URLs, user agent, crawl delay, and monitor DB path.
- `db.py`: monitor-specific SQLite connection, schema, and idempotent migrations.
- `crawler.py`: fetch, parse, diff, and crawl orchestration.
- `translator.py`: DeepSeek translation for pending changes and entries.

Create `backend/routers/utd.py` for HTTP endpoints:

- `GET /api/utd/changes`
- `GET /api/utd/changes/{change_id}`
- `POST /api/utd/changes/{change_id}/read`
- `POST /api/utd/changes/read-all`
- `GET /api/utd/topics`
- `GET /api/utd/topics/{slug}/entries`
- `POST /api/utd/crawl`
- `GET /api/utd/crawls`

Register the router in `backend/main.py`.

### Database

Use a separate SQLite database, `backend/data/utd_monitor.db`, rather than merging monitor tables into `sessions.db`.

Reasons:

- Monitor data has a different lifecycle from editing sessions.
- It avoids accidental coupling between user/session state and external crawl history.
- It keeps future migrations simpler.

Tables remain equivalent to the standalone monitor:

- `topics`
- `entries`
- `changes`
- `crawls`

The monitor database should use WAL mode and idempotent schema initialization, matching the standalone tool.

### Startup and Scheduling

On FastAPI startup:

1. Initialize the monitor database.
2. Register a daily 02:00 Asia/Shanghai scheduled crawl.
3. If the monitor database has no entries, start a background baseline crawl.

The scheduler should be module-owned and shut down cleanly on application shutdown. If the current app continues to use `@app.on_event`, keep the change consistent with the existing app style unless a broader lifespan migration becomes necessary.

### Translation

Reuse the main project's existing `DEEPSEEK_*` environment variables:

- `deepseek_api_key`
- `deepseek_model`
- `deepseek_base_url`

If no API key is configured, crawling still succeeds and translation is skipped. Pending or failed translations retry after later crawls.

The standalone monitor depends on the `openai` package for the DeepSeek-compatible client. Add it to backend requirements if not already available.

### Auth Boundary

All `/api/utd/...` endpoints should be reachable only through the authenticated Editing Assistant UI. If the existing backend does not enforce authentication globally, the UTD router should use the same auth dependency patterns as current protected routes. Admin-only restrictions are not required for read views. Manual crawl can be available to logged-in users unless product direction later requires admin-only controls.

## Frontend Design

### App Entry

Add a header button labeled `更新监控` with a Material Symbols icon such as `monitoring`.

When clicked:

- Set `appView` to `utd`.
- Preserve the current editing task state.
- Hide the editing workflow sidebar and footer.
- Render the UTD Monitor module full width below the fixed header.

The existing `历史记录`, password, admin settings, and logout controls remain available in the header.

### Module Views

Do not introduce `react-router-dom` into the main project. Instead, convert the standalone monitor's route-based pages into state-driven views.

Suggested frontend structure:

- `frontend/src/components/utd/UtdMonitor.tsx`
- `frontend/src/components/utd/UtdDashboard.tsx`
- `frontend/src/components/utd/UtdChangeDetail.tsx`
- `frontend/src/components/utd/UtdTopics.tsx`
- `frontend/src/components/utd/UtdTopicDetail.tsx`
- `frontend/src/components/utd/UtdCrawls.tsx`
- `frontend/src/components/utd/UtdReferences.tsx`
- `frontend/src/components/utd/api.ts`
- `frontend/src/components/utd/types.ts`

Module-local view state can look like:

- `dashboard`
- `changeDetail`
- `topics`
- `topicDetail`
- `crawls`

The dashboard should retain the standalone monitor behavior:

- unread badge
- specialty/type/date/search filters
- manual crawl
- mark all read
- change list

The change detail should retain:

- Chinese title and summary when available
- English fallback
- modified diff view
- removed content view
- original/translation panes
- references
- source link to UpToDate

### Styling

Adapt the monitor's CSS to the main app tokens already present in `frontend/src/index.css`.

Use the existing DUI/M3 variables:

- `--dui-primary`
- `--dui-page-bg`
- `--dui-surface`
- `--dui-divider`
- `--dui-text`
- `--dui-text-sub`
- semantic success/warning/danger colors

Avoid adding a second global design system. Prefix UTD-specific classes with `utd-` to reduce accidental collisions.

## Data Flow

1. User opens `更新监控`.
2. UTD dashboard calls `/api/utd/changes` and `/api/utd/topics`.
3. Dashboard polls `/api/utd/crawls` while a crawl is running.
4. Manual crawl calls `POST /api/utd/crawl`; if another crawl is active, the API returns `started: false`.
5. The backend crawler fetches UpToDate topic data, parses entries, writes changes, updates entries, and then translates pending rows.
6. The UI refreshes lists and unread counts after crawl completion or read-state changes.

## Error Handling

Crawler:

- Use a single lock to prevent overlapping crawls.
- Log per-topic fetch failures and continue to the next topic.
- If parsing a topic produces no entries, skip diffing to avoid false mass deletions.
- Record crawl status and error text in `crawls`.

Translation:

- Skip translation when DeepSeek key is missing.
- Mark failed translations as `failed` and retry later.
- Keep untranslated English content visible.

API/UI:

- Return 404 for missing changes or topics.
- Show empty states for no baseline or no matching filters.
- Show "检查中" while crawls are running.

## Testing Plan

Backend tests should come first.

Add focused tests for:

- parsing entries from representative UpToDate HTML
- reference extraction and link absolutization
- diff behavior for new, modified, removed, and title-paired anchor changes
- baseline crawl behavior producing entries but no changes
- router path prefix `/api/utd/...`
- manual crawl lock response when a crawl is already running

Frontend verification:

- TypeScript build with `npm run build`.
- Confirm the UTD module can enter and leave without clearing the current editing workflow state.
- Confirm list/detail/topic/crawl views render and navigate through local state.

If the existing frontend test stack is still minimal, do not add a new test runner solely for this integration. Keep frontend confidence through component boundaries, TypeScript, and browser verification.

## Dependencies

Backend:

- Add `apscheduler`.
- Add `openai`.
- Existing `httpx`, `beautifulsoup4`, `pydantic-settings`, and FastAPI dependencies are already present.

Frontend:

- Add `diff`.
- Do not add `react-router-dom`.

## Rollout Notes

The first deployment with an empty `utd_monitor.db` creates a baseline. Baseline entries are stored, but no changes are shown until later crawls detect differences.

The integrated module should not migrate or delete the standalone `/Users/dxy/Documents/IT/utd-monitor` database automatically. If historical monitor data needs to be preserved, add a separate explicit import step later.

## Open Follow-Up

Future work can connect UTD changes into the article workflow, for example selecting a UTD update as a reference source for quality review or draft generation. That should be designed separately after the embedded monitor is stable.
