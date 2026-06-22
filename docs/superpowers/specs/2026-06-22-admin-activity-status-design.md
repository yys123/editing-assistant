# Admin Activity Status Design

Date: 2026-06-22

## Goal

Let administrators see which users are recently active and which authenticated backend requests are currently running, so service restarts can be timed with less risk of interrupting active work.

## Context

Editing Assistant is a FastAPI backend plus React/Vite frontend. Admin-only controls already live under `/api/admin/...` and are shown in `AdminSettingsModal`. Authentication is JWT-based, and most application routers use `get_current_user`.

The current system stores sessions and AI call logs, but it does not track last user activity or in-flight requests. AI logs are retrospective and do not reliably answer whether a request is still running.

## Recommended Approach

Add lightweight in-memory activity tracking in the backend and expose it through a new admin endpoint. The data is operational status, not durable business data, so it should reset on process restart.

This approach avoids schema migrations, keeps normal request handling simple, and gives administrators the key restart signal: recent users and unfinished requests.

## Backend Design

### Activity Service

Create `backend/services/admin_activity.py` with an in-memory tracker protected by a lock.

The tracker records:

- Last activity by user:
  - user id
  - email
  - display name
  - last activity timestamp
  - last request method and path
- Currently running requests:
  - request id
  - user id
  - email
  - display name
  - method
  - path
  - started timestamp

The service should expose small functions:

- `record_activity(user, method, path, now=None)`
- `start_request(user, method, path, now=None) -> request_id`
- `finish_request(request_id)`
- `snapshot(now=None, active_window_seconds=300) -> dict`

`snapshot` returns:

- `generated_at`
- `active_window_seconds`
- `active_users`
- `running_requests`
- `running_count`
- `active_user_count`

`active_users` includes users active within the configured window or users with at least one running request. Each user row includes any matching running requests.

### Middleware

Add an HTTP middleware in `backend/main.py`.

For every request with a valid Bearer token:

1. Decode the JWT and load the user.
2. Record user activity.
3. Register the request as running.
4. Call the downstream handler.
5. Finish the running request in `finally`.

If the token is missing, invalid, expired, or the user no longer exists, the middleware silently skips activity tracking and lets existing auth dependencies return the correct response.

The middleware must not become a second authentication layer. It only gathers best-effort operational telemetry. Existing route dependencies remain responsible for request authorization and for setting the auth `ContextVar` used by downstream AI audit code.

The middleware should ignore low-signal endpoints:

- `/health`
- `/healthz`
- `/api/admin/...`

Ignoring admin endpoints prevents an administrator opening or refreshing the panel from making themselves appear as active user work.

### Admin Endpoint

Add `GET /api/admin/activity`.

The endpoint:

- Uses the existing `get_current_user` dependency.
- Calls `_require_admin`.
- Returns the activity snapshot.

No non-admin user can read activity data.

## Frontend Design

Add an "运行状态" section to `frontend/src/components/AdminSettingsModal.tsx`, near the existing admin statistics area.

The section shows:

- 最近在线人数
- 运行中请求数
- 最后刷新时间
- Manual "刷新" button

Below the summary, show a compact table:

- 用户
- 状态
- 最近活动
- 当前请求
- 已运行

If a user has multiple running requests, list the paths in the current request cell with durations. If there are no active users and no running requests, show a clear empty state.

The activity panel has its own loading and error state, so failures do not block model configuration or AI log inspection.

## Data Flow

1. A logged-in user calls any normal API.
2. Middleware records the user as recently active and registers the request as running.
3. The request finishes; middleware removes it from the running map.
4. An administrator opens the settings modal.
5. The modal calls `/api/admin/activity`.
6. The backend returns recent active users and current running requests.
7. The administrator refreshes the panel before restarting the service.

## Error Handling

- Invalid or missing tokens in middleware are ignored for tracking only.
- Existing route dependencies remain the source of auth failures.
- The activity endpoint returns 403 for non-admin users.
- Frontend activity loading errors are displayed inside the activity section only.
- In-flight request cleanup always happens in a `finally` block.

## Testing

Backend tests come first.

Add focused tests for:

- Activity recording includes recently active users.
- Users with running requests remain visible even if their last activity is outside the active window.
- Finished requests are removed from the running snapshot.
- `/api/admin/activity` rejects non-admin users.
- `/api/admin/activity` returns the service snapshot for admins.

Frontend verification:

- Ensure TypeScript accepts the new activity types and UI code.
- Run existing frontend tests.
- Manually inspect the admin modal if the dev server is available.
