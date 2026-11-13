import hashlib
import importlib.util
from pathlib import Path
import unittest
import zipfile

BASE = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('pin_backup_paths', BASE / 'pin-backup-runner-paths.py')
pin = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pin)


class CanonicalBackupPathTests(unittest.TestCase):
    def test_only_script_paths_change_and_preserve_original_format(self):
        with zipfile.ZipFile(BASE.parent / 'maintenance/production-backup-units-original-20261111.zip') as archive:
            original = archive.read('backup-runner.env.template')
        self.assertEqual(hashlib.sha256(original).hexdigest(), pin.BEFORE_SHA)
        changed = pin.canonical_environment(original)
        self.assertEqual(changed, (BASE / 'backup-runner.env.template').read_bytes())
        self.assertNotIn(b'/opt/nodia/current/scripts/', changed)
        self.assertIn(b'NODIA_AI_BACKUP_CONFIG=/var/lib/nodia/config/backup.json\n', changed)
        self.assertIn(b'NODIA_AI_RECOVERY_CONFIG=/var/lib/nodia/config/recovery.json\n', changed)

    def test_unknown_existing_configuration_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'unexpected_legacy_environment'):
            pin.canonical_environment(b'NODIA_AI_BACKUP_SCRIPT=/foreign/package/script.mjs\n')


if __name__ == '__main__':
    unittest.main()
