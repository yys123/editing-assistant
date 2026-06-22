import threading
import uuid
from datetime import datetime, timezone


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    value = value.astimezone(timezone.utc)
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _user_info(user: dict) -> dict:
    return {
        "user_id": user.get("id") or "",
        "email": user.get("email") or "",
        "display_name": user.get("display_name") or "",
    }


class ActivityTracker:
    def __init__(self):
        self._lock = threading.RLock()
        self._activity = {}
        self._running = {}

    def record_activity(self, user: dict, method: str, path: str, now: datetime = None):
        now = now or _utc_now()
        info = _user_info(user)
        if not info["user_id"]:
            return
        with self._lock:
            self._activity[info["user_id"]] = {
                **info,
                "last_activity_at": now,
                "last_method": method,
                "last_path": path,
            }

    def start_request(self, user: dict, method: str, path: str, now: datetime = None) -> str:
        now = now or _utc_now()
        info = _user_info(user)
        request_id = uuid.uuid4().hex
        if not info["user_id"]:
            return request_id
        with self._lock:
            self._activity[info["user_id"]] = {
                **info,
                "last_activity_at": now,
                "last_method": method,
                "last_path": path,
            }
            self._running[request_id] = {
                "id": request_id,
                **info,
                "method": method,
                "path": path,
                "started_at": now,
            }
        return request_id

    def finish_request(self, request_id: str):
        with self._lock:
            self._running.pop(request_id, None)

    def snapshot(self, now: datetime = None, active_window_seconds: int = 300) -> dict:
        now = now or _utc_now()
        with self._lock:
            activity = {key: dict(value) for key, value in self._activity.items()}
            running = {key: dict(value) for key, value in self._running.items()}

        running_by_user = {}
        running_rows = []
        for request in running.values():
            row = self._format_running_request(request, now)
            running_rows.append(row)
            running_by_user.setdefault(row["user_id"], []).append(row)

        active_users = []
        user_ids = set(activity.keys()) | set(running_by_user.keys())
        for user_id in user_ids:
            item = activity.get(user_id) or {
                "user_id": user_id,
                "email": "",
                "display_name": "",
                "last_activity_at": now,
                "last_method": "",
                "last_path": "",
            }
            elapsed = max(0, int((now - item["last_activity_at"]).total_seconds()))
            user_running = sorted(
                running_by_user.get(user_id, []),
                key=lambda row: row["started_at"],
            )
            if elapsed <= active_window_seconds or user_running:
                active_users.append({
                    "user_id": item["user_id"],
                    "email": item["email"],
                    "display_name": item["display_name"],
                    "last_activity_at": _iso(item["last_activity_at"]),
                    "last_method": item["last_method"],
                    "last_path": item["last_path"],
                    "seconds_since_activity": elapsed,
                    "running_requests": user_running,
                })

        active_users.sort(key=lambda row: row["last_activity_at"], reverse=True)
        running_rows.sort(key=lambda row: row["started_at"])
        return {
            "generated_at": _iso(now),
            "active_window_seconds": active_window_seconds,
            "active_users": active_users,
            "running_requests": running_rows,
            "active_user_count": len(active_users),
            "running_count": len(running_rows),
        }

    def _format_running_request(self, request: dict, now: datetime) -> dict:
        elapsed = max(0, int((now - request["started_at"]).total_seconds()))
        return {
            "id": request["id"],
            "user_id": request["user_id"],
            "email": request["email"],
            "display_name": request["display_name"],
            "method": request["method"],
            "path": request["path"],
            "started_at": _iso(request["started_at"]),
            "elapsed_seconds": elapsed,
        }


_default_tracker = ActivityTracker()


def record_activity(user: dict, method: str, path: str, now: datetime = None):
    return _default_tracker.record_activity(user, method, path, now)


def start_request(user: dict, method: str, path: str, now: datetime = None) -> str:
    return _default_tracker.start_request(user, method, path, now)


def finish_request(request_id: str):
    return _default_tracker.finish_request(request_id)


def snapshot(now: datetime = None, active_window_seconds: int = 300) -> dict:
    return _default_tracker.snapshot(now, active_window_seconds)
