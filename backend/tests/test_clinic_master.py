import os
import unittest
from unittest.mock import patch

os.environ.setdefault("gemini_api_key", "test-gemini-key")

from services import clinic_master


class ClinicMasterSigningTests(unittest.TestCase):
    def test_generate_signature_matches_reference_example(self):
        params = {
            "appId": 1001,
            "timestamp": 1742050000,
            "nonce": "6a8d2f3e",
            "question": "hello",
            "stream": False,
        }

        result = clinic_master.generate_signature(params, "test-key")

        self.assertEqual(result, "892a5dd8950d6d2c4a4216f4545dd2e2fa81f3b7")

    def test_signed_params_use_seconds_hyphenated_uuid_and_do_not_send_key(self):
        fake_uuid = "9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a"
        settings = type("Settings", (), {
            "clinic_master_app_id": "app-1",
            "clinic_master_app_sign_key": "secret-key",
        })()

        with (
            patch.object(clinic_master, "settings", settings),
            patch.object(clinic_master.time, "time", return_value=1742050000.9),
            patch.object(clinic_master.uuid, "uuid4", return_value=fake_uuid),
        ):
            params = clinic_master.signed_params({"question": "hello", "optional": None})

        self.assertEqual(params["timestamp"], 1742050000)
        self.assertEqual(params["nonce"], fake_uuid)
        self.assertRegex(params["nonce"], r"^[0-9a-f-]{36}$")
        self.assertNotIn("appSignKey", params)
        self.assertIn("sign", params)


if __name__ == "__main__":
    unittest.main()
