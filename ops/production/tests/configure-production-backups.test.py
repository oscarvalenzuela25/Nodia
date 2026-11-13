import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / 'configure-production-backups.py'
SPEC = importlib.util.spec_from_file_location('configure_production_backups', MODULE)
backup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(backup)


class BackupPreparationTests(unittest.TestCase):
    def test_custody_preserves_exact_original_bytes_and_names(self):
        originals = {'runtime.env': b'KEY="synthetic-$;|literal"\n', 'redis.env': b'REDIS_PASSWORD=synthetic\r\n',
                     'recovery.json': b'{"synthetic":"private"}\n'}
        value = json.loads(backup.custody_payload(originals, '2026-11-11T20:00:00.000Z'))
        self.assertEqual(value['purpose'], 'nodia_configuration_custody')
        self.assertEqual(value['restore_policy'], 'operator_review_only')
        for entry in value['files']:
            self.assertEqual(base64.b64decode(entry['content']), originals[entry['name']])
            self.assertEqual(entry['sha256'], hashlib.sha256(originals[entry['name']]).hexdigest())

    def test_custody_cannot_silently_omit_redis_or_include_private_key(self):
        with self.assertRaises(ValueError):
            backup.custody_payload({'runtime.env': b'x', 'recovery.json': b'y'}, 'date')
        with self.assertRaises(ValueError):
            backup.custody_payload({'runtime.env': b'x', 'redis.env': b'y', 'recovery.json': b'z', 'private.pem': b'forbidden'}, 'date')

    def test_creation_exclusive_never_overwrites_previous_or_symlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / 'private.json'
            target.write_bytes(b'preserve')
            with self.assertRaises(FileExistsError):
                backup.new_private_file(target, b'changed', owner=os.getuid(), group=os.getgid(), mode=0o600)
            link = Path(temporary) / 'symlink.json'
            link.symlink_to(target)
            with self.assertRaises(FileExistsError):
                backup.new_private_file(link, b'changed', owner=os.getuid(), group=os.getgid(), mode=0o600)
            self.assertEqual(target.read_bytes(), b'preserve')

    def test_empty_root_owned_lock_is_valid_and_writable_modes_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / 'installation.lock'
            with target.open('a+b') as stream:
                os.fchmod(stream.fileno(), 0o600)
                real_stat = os.fstat(stream.fileno())
                # Simulate root ownership when this isolated unit suite runs as a normal user.
                values = list(real_stat)
                values[4] = values[5] = 0
                with patch.object(backup.os, 'fstat', return_value=os.stat_result(values)):
                    backup.validate_installation_lock(stream.fileno())
                os.fchmod(stream.fileno(), 0o660)
                values = list(os.fstat(stream.fileno()))
                values[4] = values[5] = 0
                with patch.object(backup.os, 'fstat', return_value=os.stat_result(values)):
                    with self.assertRaisesRegex(ValueError, 'unsafe_installation_lock'):
                        backup.validate_installation_lock(stream.fileno())

    def test_admin_export_is_ciphertext_only_fixed_name_and_exclusive(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(backup, 'UPLOAD', Path(temporary)):
            cipher = b'NODCFG01' + b'x' * 64
            backup.export_ciphertext(cipher, os.getuid(), os.getgid())
            target = Path(temporary) / 'recovery-config-custody.enc'
            self.assertEqual(target.read_bytes(), cipher)
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                backup.export_ciphertext(cipher, os.getuid(), os.getgid())
            with self.assertRaises(ValueError):
                backup.export_ciphertext(b'plaintext-secret' * 10, os.getuid(), os.getgid())


if __name__ == '__main__':
    unittest.main()
