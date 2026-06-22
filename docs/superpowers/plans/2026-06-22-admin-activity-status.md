# Admin Activity Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only runtime panel that shows recently active users and currently running authenticated backend requests.

**Architecture:** The backend owns a small in-memory activity tracker and exposes an admin snapshot endpoint. A FastAPI middleware records best-effort activity for authenticated requests without changing route authorization semantics. The existing admin settings modal fetches and displays the snapshot with isolated loading and error states.

**Tech Stack:** FastAPI, SQLite-backed user lookup, Python unittest, React, TypeScript, Vite.

---

## File Structure

- Create `backend/services/admin_activity.py`
  - Owns in-memory last-activity and running-request state.
  - Provides `record_activity`, `start_request`, `finish_request`, and `snapshot`.
- Modify `backend/main.py`
  - Adds best-effort activity middleware.
  - Ignores health checks and `/api/admin/activity`.
- Modify `backend/routers/admin.py`
  - Adds `GET /api/admin/activity` guarded by `_require_admin`.
- Modify `backend/tests/test_admin_features.py`
  - Adds tracker and endpoint tests.
- Modify `frontend/src/components/AdminSettingsModal.tsx`
  - Adds activity response types, fetch state, and the "运行状态" section.

## Task 1: Backend Activity Tracker

**Files:**
- Create: `backend/services/admin_activity.py`
- Test: `backend/tests/test_admin_features.py`

- [ ] **Step 1: Write failing tracker tests**

Add tests that import `services.admin_activity.ActivityTracker` and cover:

```python
def test_activity_tracker_lists_recent_users(self):
    tracker = admin_activity.ActivityTracker()
    now = datetime(2026, 6, 22, 10, 0, tzinfo=timezone.utc)
    tracker.record_activity({"id": "u1", "email": "a@example.com", "display_name": "A"}, "GET", "/api/history", now)

    snap = tracker.snapshot(now=now, active_window_seconds=300)

    self.assertEqual(snap["active_user_count"], 1)
    self.assertEqual(snap["active_users"][0]["email"], "a@example.com")
```

Also test that a running request keeps a user visible outside the active window and that `finish_request` removes the request.

- [ ] **Step 2: Run tracker tests to verify they fail**

Run: `cd backend && python3 -m unittest tests.test_admin_features.AdminActivityTrackerTests -v`

Expected: FAIL because `services.admin_activity` does not exist.

- [ ] **Step 3: Implement minimal tracker**

Create `ActivityTracker` with a `threading.RLock`, dictionaries for activity and running requests, ISO UTC timestamp formatting, and module-level wrapper functions backed by a default tracker.

- [ ] **Step 4: Run tracker tests to verify they pass**

Run: `cd backend && python3 -m unittest tests.test_admin_features.AdminActivityTrackerTests -v`

Expected: PASS.

## Task 2: Admin Endpoint

**Files:**
- Modify: `backend/routers/admin.py`
- Test: `backend/tests/test_admin_features.py`

- [ ] **Step 1: Write failing endpoint tests**

Add tests for:

```python
def test_admin_activity_rejects_non_admin(self):
    with self.assertRaises(HTTPException) as ctx:
        admin.get_activity(user={"is_admin": False})
    self.assertEqual(ctx.exception.status_code, 403)
```

And an admin test that patches `admin.admin_activity.snapshot` and verifies the returned payload.

- [ ] **Step 2: Run endpoint tests to verify they fail**

Run: `cd backend && python3 -m unittest tests.test_admin_features.AdminActivityEndpointTests -v`

Expected: FAIL because `get_activity` does not exist.

- [ ] **Step 3: Implement endpoint**

Import `services.admin_activity` in `backend/routers/admin.py` and add:

```python
@router.get("/activity")
def get_activity(user: dict = Depends(get_current_user)):
    _require_admin(user)
    return admin_activity.snapshot()
```

- [ ] **Step 4: Run endpoint tests to verify they pass**

Run: `cd backend && python3 -m unittest tests.test_admin_features.AdminActivityEndpointTests -v`

Expected: PASS.

## Task 3: Activity Middleware

**Files:**
- Modify: `backend/main.py`
- Test: `backend/tests/test_admin_features.py`

- [ ] **Step 1: Write failing middleware helper tests**

Add small tests for a helper such as `_should_track_activity(path)` so ignored paths are locked down:

```python
self.assertFalse(main._should_track_activity("/health"))
self.assertFalse(main._should_track_activity("/api/admin/activity"))
self.assertTrue(main._should_track_activity("/api/history"))
```

- [ ] **Step 2: Run middleware helper tests to verify they fail**

Run: `cd backend && python3 -m unittest tests.test_admin_features.AdminActivityMiddlewareTests -v`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement middleware and helper**

In `backend/main.py`:

- Import `Request`, `auth.decode_token`, `db.get_user_by_id`, and `services.admin_activity`.
- Add `_should_track_activity(path: str) -> bool`.
- Add `@app.middleware("http")` function.
- Parse Bearer token best-effort.
- Record/start only when the token decodes and user lookup succeeds.
- Always call `finish_request` in `finally` when a request id was created.

- [ ] **Step 4: Run middleware helper tests to verify they pass**

Run: `cd backend && python3 -m unittest tests.test_admin_features.AdminActivityMiddlewareTests -v`

Expected: PASS.

## Task 4: Frontend Admin Activity Panel

**Files:**
- Modify: `frontend/src/components/AdminSettingsModal.tsx`

- [ ] **Step 1: Add activity types and fetch state**

Add TypeScript interfaces for activity users and running requests. Add state for snapshot, loading, error, and `loadActivity`.

- [ ] **Step 2: Load activity with the existing modal data**

Call `loadActivity()` when the modal opens, alongside runtime config and AI logs. Keep activity errors separate from the existing `error` state.

- [ ] **Step 3: Render the "运行状态" section**

Add summary tiles, a refresh button, and a compact table above "AI 调用统计". Use existing classes and inline style patterns from the modal. Display:

- user display name or email
- online/running status
- localized last activity time
- current request method/path
- duration based on `started_at`

- [ ] **Step 4: Keep empty and error states local**

If no active users exist, show "暂无最近活动或运行中的请求". If fetch fails, show the error inside the section.

## Task 5: Verification

**Files:**
- All modified files.

- [ ] **Step 1: Run focused backend tests**

Run: `cd backend && python3 -m unittest tests.test_admin_features -v`

Expected: PASS.

- [ ] **Step 2: Run frontend tests**

Run: `cd frontend && npm test`

Expected: PASS.

- [ ] **Step 3: Run frontend type/build verification**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 4: Check git diff**

Run: `git diff --stat`

Expected: Only planned files changed, plus the plan document.
