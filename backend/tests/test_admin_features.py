import json
import inspect
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

import auth
import db
import main
from routers import admin
from routers import history
from services import admin_activity
from services import admin_runtime


class AdminAuthTests(unittest.TestCase):
    def test_is_admin_email_matches_whitelist(self):
        fake_settings = SimpleNamespace(admin_emails="shengkaixiang@dxy.cn,other@dxy.cn")
        with patch.object(auth, "settings", fake_settings):
            self.assertTrue(auth.is_admin_email("shengkaixiang@dxy.cn"))
            self.assertFalse(auth.is_admin_email("normal@dxy.cn"))

    def test_current_user_dependency_is_async_to_preserve_contextvars(self):
        self.assertTrue(inspect.iscoroutinefunction(auth.get_current_user))


class AdminRuntimeConfigTests(unittest.TestCase):
    def test_save_and_load_runtime_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "admin_runtime_config.json"
            payload = {
                "scope": "admin_only",
                "text_model_provider": "deepseek",
                "deepseek_model": "deepseek-chat",
                "deepseek_temperature": 0.4,
                "deepseek_top_p": 0.9,
                "deepseek_max_tokens": 2048,
                "deepseek_base_url": "https://api.deepseek.com",
            }
            with patch.object(admin_runtime, "CONFIG_PATH", path):
                admin_runtime.save_runtime_config(payload)
                loaded = admin_runtime.load_runtime_config()
            self.assertEqual(loaded["scope"], "admin_only")
            self.assertEqual(loaded["deepseek_temperature"], 0.4)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["deepseek_model"], "deepseek-chat")

    def test_effective_text_config_only_applies_to_admin_when_scope_is_admin_only(self):
        fake_settings = SimpleNamespace(
            text_model_provider="gemini",
            deepseek_model="deepseek-chat",
            deepseek_base_url="https://api.deepseek.com",
            deepseek_temperature=0.7,
            deepseek_top_p=1.0,
            deepseek_max_tokens=0,
            deepseek_api_key="secret",
        )
        runtime = {
            "scope": "admin_only",
            "text_model_provider": "deepseek",
            "deepseek_model": "deepseek-reasoner",
            "deepseek_base_url": "https://api.deepseek.com",
            "deepseek_temperature": 0.3,
            "deepseek_top_p": 0.8,
            "deepseek_max_tokens": 1024,
        }
        with patch.object(admin_runtime, "settings", fake_settings), patch.object(
            admin_runtime, "load_runtime_config", return_value=runtime
        ):
            admin_effective = admin_runtime.get_effective_text_config({"is_admin": True})
            user_effective = admin_runtime.get_effective_text_config({"is_admin": False})
        self.assertEqual(admin_effective["text_model_provider"], "deepseek")
        self.assertEqual(admin_effective["deepseek_model"], "deepseek-reasoner")
        self.assertEqual(user_effective["text_model_provider"], "gemini")


class AiCallLogDbTests(unittest.TestCase):
    def test_ai_call_log_preserves_request_log_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sessions.db"
            with patch.object(db, "DB_PATH", path):
                db.init_db()
                db.insert_ai_call_log({
                    "context": "section_analysis",
                    "provider": "deepseek",
                    "model": "deepseek-chat",
                    "prompt_chars": 10,
                    "status": "success",
                    "request_log_path": "/tmp/request.json",
                })

                logs = db.list_ai_call_logs(1)

        self.assertEqual(logs[0]["request_log_path"], "/tmp/request.json")


class AdminActivityTrackerTests(unittest.TestCase):
    def test_activity_tracker_lists_recent_users(self):
        tracker = admin_activity.ActivityTracker()
        now = datetime(2026, 6, 22, 10, 0, tzinfo=timezone.utc)

        tracker.record_activity(
            {"id": "u1", "email": "a@example.com", "display_name": "A"},
            "GET",
            "/api/history",
            now,
        )
        snap = tracker.snapshot(now=now, active_window_seconds=300)

        self.assertEqual(snap["active_user_count"], 1)
        self.assertEqual(snap["running_count"], 0)
        self.assertEqual(snap["active_users"][0]["email"], "a@example.com")
        self.assertEqual(snap["active_users"][0]["display_name"], "A")
        self.assertEqual(snap["active_users"][0]["last_path"], "/api/history")

    def test_running_request_keeps_user_visible_outside_activity_window(self):
        tracker = admin_activity.ActivityTracker()
        started = datetime(2026, 6, 22, 10, 0, tzinfo=timezone.utc)
        now = started + timedelta(minutes=10)

        request_id = tracker.start_request(
            {"id": "u1", "email": "a@example.com", "display_name": "A"},
            "POST",
            "/api/generate/draft",
            started,
        )
        snap = tracker.snapshot(now=now, active_window_seconds=300)

        self.assertEqual(snap["active_user_count"], 1)
        self.assertEqual(snap["running_count"], 1)
        self.assertEqual(snap["active_users"][0]["running_requests"][0]["id"], request_id)
        self.assertEqual(snap["active_users"][0]["running_requests"][0]["elapsed_seconds"], 600)

    def test_finish_request_removes_running_request(self):
        tracker = admin_activity.ActivityTracker()
        now = datetime(2026, 6, 22, 10, 0, tzinfo=timezone.utc)

        request_id = tracker.start_request(
            {"id": "u1", "email": "a@example.com", "display_name": ""},
            "POST",
            "/api/analyze/full",
            now,
        )
        tracker.finish_request(request_id)
        snap = tracker.snapshot(now=now, active_window_seconds=300)

        self.assertEqual(snap["running_count"], 0)
        self.assertEqual(snap["active_users"][0]["running_requests"], [])


class AdminActivityEndpointTests(unittest.TestCase):
    def test_admin_activity_rejects_non_admin(self):
        with self.assertRaises(HTTPException) as ctx:
            admin.get_activity(user={"is_admin": False})

        self.assertEqual(ctx.exception.status_code, 403)

    def test_admin_activity_returns_snapshot_for_admin(self):
        snapshot = {
            "generated_at": "2026-06-22T10:00:00.000Z",
            "active_window_seconds": 300,
            "active_users": [],
            "running_requests": [],
            "active_user_count": 0,
            "running_count": 0,
        }

        with patch.object(admin.admin_activity, "snapshot", return_value=snapshot) as mock_snapshot:
            result = admin.get_activity(user={"is_admin": True})

        self.assertEqual(result, snapshot)
        mock_snapshot.assert_called_once_with()


class AdminActivityMiddlewareTests(unittest.TestCase):
    def test_should_track_activity_ignores_low_signal_paths(self):
        self.assertFalse(main._should_track_activity("/health"))
        self.assertFalse(main._should_track_activity("/healthz"))
        self.assertFalse(main._should_track_activity("/api/admin/activity"))
        self.assertFalse(main._should_track_activity("/api/admin/runtime-config"))

    def test_should_track_activity_tracks_normal_api_paths(self):
        self.assertTrue(main._should_track_activity("/api/history"))
        self.assertTrue(main._should_track_activity("/api/generate/draft"))


class TemporaryDisabledDraftRouteTests(unittest.TestCase):
    def test_plan_and_draft_generation_routes_are_temporarily_disabled_but_ai_integration_remains(self):
        route_paths = {
            getattr(route, "path", None)
            for route in main.app.routes
        }

        self.assertNotIn("/api/analyze/plan", route_paths)
        self.assertNotIn("/api/analyze/plan-from-gap", route_paths)
        self.assertNotIn("/api/generate/draft", route_paths)
        self.assertNotIn("/api/generate/batch-draft", route_paths)
        self.assertIn("/api/generate/ai-integration", route_paths)


class AdminAiRequestPayloadTests(unittest.TestCase):
    def test_ai_call_logs_hide_unreadable_request_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "ai_requests"
            day = base / "2026-06-16"
            day.mkdir(parents=True)
            payload_path = day / "request.json"
            payload_path.write_text("{}", encoding="utf-8")

            logs = [
                {"id": "valid", "request_log_path": str(payload_path)},
                {"id": "invalid", "request_log_path": "/tmp/ai-request.json"},
            ]
            with patch.object(admin, "REQUEST_LOG_DIR", base), patch.object(
                admin.db, "list_ai_call_logs", return_value=logs
            ), patch.object(admin.db, "summarize_ai_call_logs", return_value={}):
                result = admin.get_ai_call_logs(user={"is_admin": True})

        self.assertEqual(result["items"][0]["request_log_path"], str(payload_path))
        self.assertEqual(result["items"][1]["request_log_path"], "")

    def test_admin_can_read_saved_ai_request_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "ai_requests"
            day = base / "2026-06-16"
            day.mkdir(parents=True)
            payload_path = day / "request.json"
            payload_path.write_text(json.dumps({
                "request": {
                    "payload": {
                        "messages": [
                            {"role": "system", "content": "系统提示"},
                            {"role": "user", "content": "用户 Prompt"},
                        ],
                    },
                },
            }, ensure_ascii=False), encoding="utf-8")

            log = {
                "id": "log-1",
                "context": "section_analysis",
                "provider": "deepseek",
                "model": "deepseek-chat",
                "request_log_path": str(payload_path),
            }

            with patch.object(admin, "REQUEST_LOG_DIR", base), patch.object(
                admin.db, "get_ai_call_log", return_value=log
            ):
                result = admin.get_ai_call_request_payload("log-1", {"is_admin": True})

        self.assertIn("[system]\n系统提示", result["prompt"])
        self.assertIn("[user]\n用户 Prompt", result["prompt"])
        self.assertEqual(result["payload"]["request"]["payload"]["messages"][1]["content"], "用户 Prompt")

    def test_admin_request_payload_rejects_paths_outside_audit_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "ai_requests"
            base.mkdir()
            outside = Path(tmp) / "request.json"
            outside.write_text("{}", encoding="utf-8")
            log = {"id": "log-1", "request_log_path": str(outside)}

            with patch.object(admin, "REQUEST_LOG_DIR", base), patch.object(
                admin.db, "get_ai_call_log", return_value=log
            ):
                with self.assertRaises(HTTPException) as ctx:
                    admin.get_ai_call_request_payload("log-1", {"is_admin": True})

        self.assertEqual(ctx.exception.status_code, 403)


class AdminHistoryPermissionTests(unittest.TestCase):
    def test_admin_can_update_other_users_session_without_changing_owner(self):
        admin_user = {"id": "admin-id", "email": "shengkaixiang@dxy.cn", "is_admin": True}
        record = {"id": "session-1", "updatedAt": "2026-06-03T00:00:00Z", "disease": "感冒"}
        with patch("routers.history.db.get_session_owner", return_value="owner-1"), patch(
            "routers.history.db.upsert_session"
        ) as mock_upsert:
            resp = history.save_session("session-1", record, admin_user)
        self.assertEqual(resp["ok"], True)
        mock_upsert.assert_called_once_with("session-1", "owner-1", "2026-06-03T00:00:00Z", "感冒", record)

    def test_non_admin_cannot_update_other_users_session(self):
        user = {"id": "user-1", "email": "normal@dxy.cn", "is_admin": False}
        record = {"id": "session-1", "updatedAt": "2026-06-03T00:00:00Z", "disease": "感冒"}
        with patch("routers.history.db.get_session_owner", return_value="owner-1"):
            with self.assertRaises(HTTPException) as ctx:
                history.save_session("session-1", record, user)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_admin_can_delete_other_users_session(self):
        admin_user = {"id": "admin-id", "email": "shengkaixiang@dxy.cn", "is_admin": True}
        with patch("routers.history.db.delete_session_admin", return_value=True) as mock_delete:
            resp = history.remove_session("session-1", admin_user)
        self.assertEqual(resp["ok"], True)
        mock_delete.assert_called_once_with("session-1")

    def test_admin_can_clone_any_session_to_their_account(self):
        admin_user = {"id": "admin-id", "email": "shengkaixiang@dxy.cn", "is_admin": True}
        cloned = {
            "id": "session-copy",
            "updatedAt": "2026-06-05T00:00:00Z",
            "disease": "感冒（副本）",
            "owner_id": "admin-id",
        }
        with patch("routers.history.db.clone_session_admin", return_value=cloned) as mock_clone:
            resp = history.clone_session("session-1", admin_user)
        self.assertEqual(resp, cloned)
        mock_clone.assert_called_once_with("session-1", "admin-id")

    def test_non_admin_cannot_clone_session(self):
        user = {"id": "user-1", "email": "normal@dxy.cn", "is_admin": False}
        with self.assertRaises(HTTPException) as ctx:
            history.clone_session("session-1", user)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_clone_session_admin_copies_full_record_and_assigns_admin_owner(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sessions.db"
            with patch.object(db, "DB_PATH", path):
                db.init_db()
                db.create_user("source-user", "source@dxy.cn", "hash", "Source")
                db.create_user("admin-id", "shengkaixiang@dxy.cn", "hash", "Admin")
                source = {
                    "id": "session-1",
                    "updatedAt": "2026-06-03T00:00:00Z",
                    "disease": "感冒",
                    "referenceDocs": [{"filename": "ref.md", "text": "完整资料", "char_count": 4}],
                    "currentStep": 6,
                    "draftHistory": [{"id": "draft-1", "editedContent": "原草稿"}],
                }
                db.upsert_session("session-1", "source-user", source["updatedAt"], source["disease"], source)

                cloned = db.clone_session_admin("session-1", "admin-id")

                self.assertIsNotNone(cloned)
                self.assertNotEqual(cloned["id"], source["id"])
                self.assertEqual(cloned["disease"], "感冒（副本）")
                self.assertEqual(cloned["owner_id"], "admin-id")
                self.assertEqual(cloned["owner_email"], "shengkaixiang@dxy.cn")
                self.assertEqual(cloned["referenceDocs"], source["referenceDocs"])
                self.assertEqual(cloned["currentStep"], 6)
                self.assertEqual(cloned["draftHistory"], source["draftHistory"])
                self.assertEqual(db.get_session_owner(cloned["id"]), "admin-id")


if __name__ == "__main__":
    unittest.main()
