import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

import auth
import db
from routers import history
from services import admin_runtime


class AdminAuthTests(unittest.TestCase):
    def test_is_admin_email_matches_whitelist(self):
        fake_settings = SimpleNamespace(admin_emails="shengkaixiang@dxy.cn,other@dxy.cn")
        with patch.object(auth, "settings", fake_settings):
            self.assertTrue(auth.is_admin_email("shengkaixiang@dxy.cn"))
            self.assertFalse(auth.is_admin_email("normal@dxy.cn"))


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
