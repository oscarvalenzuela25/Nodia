"""Offline deployment admission regressions; no Linux/service/network side effects."""
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

if sys.platform == 'win32':
    # Driver import only: never emulate system operation on Windows.
    sys.modules.setdefault('fcntl', types.ModuleType('fcntl'))
source = Path(__file__).with_name('nodia-ai-ai38-owner-adopt.py')
spec = importlib.util.spec_from_file_location('owner_driver', source)
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)


class Admission(unittest.TestCase):
    def plan(self, change=None, bad_pin=False):
        value = dict(release=str(d.NEW), manifest_sha256='a' * 64, files=3879, dist_outputs=2851)
        if change:
            value.update(change)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'plan.json'
            path.write_bytes(json.dumps(value).encode())
            return d.plan_file(path, 'b' * 64 if bad_pin else d.sha(path))

    def test_valid_pinned_plan(self):
        self.assertEqual(self.plan()['files'], 3879)

    def test_reject_changed_plan_pin(self):
        with self.assertRaisesRegex(ValueError, 'plan_pin_mismatch'):
            self.plan(bad_pin=True)

    def test_reject_legacy_destination(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.plan({'release': str(d.OLD)})

    def test_reject_path_traversal(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.plan({'release': str(d.NEW) + '/../legacy'})

    def test_reject_unknown_plan_fields(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.plan({'bootstrap': True})

    def test_reject_wrong_inventory(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.plan({'dist_outputs': 932})

    def test_descriptor_roundtrip_is_byte_exact(self):
        payload = ('WorkingDirectory=' + str(d.OLD) + '\nExecStart=node ' + str(d.OLD) + '/dist/main.js\n').encode()
        new = d.descriptor_transition(payload, d.OLD, d.NEW)
        self.assertEqual(d.descriptor_transition(new, d.NEW, d.OLD), payload)

    def test_descriptor_refuses_mixed_eras(self):
        with self.assertRaisesRegex(ValueError, 'descriptor_source_mismatch'):
            d.descriptor_transition((str(d.OLD) + str(d.NEW)).encode(), d.OLD, d.NEW)

    def test_descriptor_refuses_drift(self):
        with self.assertRaisesRegex(ValueError, 'descriptor_source_mismatch'):
            d.descriptor_transition(str(d.OLD).encode(), d.OLD, d.NEW)

    def backup(self):
        began = datetime(2026, 10, 22, tzinfo=timezone.utc)
        value = dict(schema_version=1, operation='backup', status='ready', backup_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                     cipher_sha256='b' * 64, cipher_bytes=1024, journal_sequence=3,
                     captured_at=(began + timedelta(seconds=1)).isoformat(),
                     expires_at=(began + timedelta(days=7, seconds=1)).isoformat())
        return value, began, began + timedelta(seconds=5)

    def test_fresh_ready_encrypted_backup(self):
        value, began, end = self.backup()
        self.assertEqual(d.validate_backup(value, began, end), value)

    def test_backup_rejects_old_capture(self):
        value, began, end = self.backup()
        with self.assertRaisesRegex(ValueError, 'fresh_backup_capture_or_retention_invalid'):
            d.validate_backup(value, began + timedelta(seconds=2), end)

    def test_backup_rejects_wrong_retention(self):
        value, began, end = self.backup()
        value['expires_at'] = (began + timedelta(days=30)).isoformat()
        with self.assertRaisesRegex(ValueError, 'fresh_backup_capture_or_retention_invalid'):
            d.validate_backup(value, began, end)

    def test_backup_rejects_uncertain_upload(self):
        value, began, end = self.backup()
        value['status'] = 'uploading'
        with self.assertRaisesRegex(ValueError, 'fresh_encrypted_backup_receipt_invalid'):
            d.validate_backup(value, began, end)

    def test_backup_rejects_missing_cipher_hash(self):
        value, began, end = self.backup()
        del value['cipher_sha256']
        with self.assertRaisesRegex(ValueError, 'fresh_encrypted_backup_receipt_invalid'):
            d.validate_backup(value, began, end)

    def test_errors_do_not_emit_arbitrary_stderr(self):
        self.assertEqual(d.safe_error(RuntimeError('credential=password')), 'operation_failed')
        self.assertEqual(d.safe_error(ValueError('credential=password')), 'operation_failed')
        self.assertEqual(d.safe_error(ValueError('journal_not_ready')), 'journal_not_ready')

    def test_manifest_rejects_changed_bytes_before_runtime(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            path = root / 'release-manifest.json'
            (root / 'member').write_bytes(b'tampered')
            path.write_bytes(json.dumps(dict(knowledge_release=d.KNOWLEDGE,
                             files={'member': hashlib.sha256(b'expected').hexdigest()})).encode())
            with self.assertRaisesRegex(ValueError, 'manifest_member_mismatch'):
                d.manifest(root, d.sha(path))

    def test_manifest_rejects_traversal(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            path = root / 'release-manifest.json'
            path.write_bytes(json.dumps(dict(knowledge_release=d.KNOWLEDGE,
                             files={'../escape': 'a' * 64})).encode())
            with self.assertRaisesRegex(ValueError, 'unsafe_manifest_member'):
                d.manifest(root, d.sha(path))


if __name__ == '__main__':
    unittest.main()
