from pathlib import Path
import unittest

from config import Settings


class SettingsEnvFileTests(unittest.TestCase):
    def test_default_env_file_is_backend_env_independent_of_cwd(self):
        env_file = Path(Settings.model_config["env_file"])

        self.assertTrue(env_file.is_absolute())
        self.assertEqual(env_file, Path(__file__).resolve().parents[1] / ".env")


if __name__ == "__main__":
    unittest.main()
