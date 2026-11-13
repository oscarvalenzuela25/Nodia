"""Receiver refresh on root-owned disposable POSIX state, without app effects."""
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('refresh_receiver', Path(__file__).resolve().parents[1] / 'refresh-production-cd.py')
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


@unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'requires isolated Linux root filesystem ownership')
class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir='/root')
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.lib, self.state = root / 'lib', root / 'state'
        self.lib.mkdir()
        self.state.mkdir()
        self.lock = root / 'installation.lock'
        self.write(self.lock, b'', 0o600)
        self.write(self.state / 'receiver.lock', b'', 0o600)
        self.old = b'# reviewed previous receiver\n'
        self.previous = refresh.sha(self.old)
        self.write(self.lib / refresh.RECEIVER, self.old, 0o644)
        self.write(self.lib / refresh.GATEWAY, b'# fixed gateway\n', 0o755)
        self.write(self.lib / 'update-backend.py', b'# unchanged updater\n', 0o644)
        self.settings = {'schema_version': 1, 'operator_field': 'preserved', 'assets': {
            refresh.RECEIVER: self.previous,
            refresh.GATEWAY: refresh.sha((self.lib / refresh.GATEWAY).read_bytes())}}
        self.write(self.state / 'receiver-settings.json', json.dumps(self.settings).encode(), 0o600)
        self.updater_raw = json.dumps({'assets': {'update-backend.py': refresh.sha((self.lib / 'update-backend.py').read_bytes())},
                                       'service_hashes': {'untouched': 'also preserved'}}).encode()
        self.write(self.state / 'settings.json', self.updater_raw, 0o600)
        self.status = {'status': 'deployment_ready', 'blocked': False, 'current': {'source_sha': 'a' * 40},
                       'application': {'api_active': True, 'worker_active': True}}
        self.source = root / 'candidate.py'
        self.candidate(self.status)
        for name, value in [('LIB', self.lib), ('STATE', self.state), ('INSTALL_LOCK', self.lock)]:
            context = patch.object(refresh, name, value)
            context.start()
            self.addCleanup(context.stop)

    def write(self, path, raw, mode):
        path.write_bytes(raw)
        path.chmod(mode)

    def candidate(self, status):
        self.source.write_text('def deployment_status():\n    return ' + repr(status) + '\n', encoding='utf-8', newline='\n')
        self.expected = refresh.sha(self.source.read_bytes())

    def run_refresh(self):
        return refresh.refresh(self.source, self.expected, self.previous)

    def test_refresh_preserves_unrelated_configuration_and_durable_originals(self):
        result = self.run_refresh()
        self.assertEqual(result['status'], 'receiver_refreshed')
        self.assertFalse(result['deployment_requested'])
        self.assertEqual((self.lib / refresh.RECEIVER).read_bytes(), self.source.read_bytes())
        settings = json.loads((self.state / 'receiver-settings.json').read_bytes())
        self.assertEqual(settings, {**self.settings, 'assets': {**self.settings['assets'], refresh.RECEIVER: self.expected}})
        self.assertEqual((self.state / 'settings.json').read_bytes(), self.updater_raw)
        record = self.state / ('receiver-refresh-' + self.expected)
        self.assertEqual((record / refresh.RECEIVER).read_bytes(), self.old)
        self.assertEqual(json.loads((record / 'receiver-settings.json').read_bytes()), self.settings)
        self.assertEqual(stat.S_IMODE((self.lib / refresh.RECEIVER).stat().st_mode), 0o644)
        self.assertEqual(stat.S_IMODE((self.state / 'receiver-settings.json').stat().st_mode), 0o600)

    def test_source_hash_mismatch_has_no_writes(self):
        self.source.write_bytes(b'# changed after review\n')
        with self.assertRaisesRegex(ValueError, 'reviewed_receiver_digest_required'):
            self.run_refresh()
        self.assertEqual((self.lib / refresh.RECEIVER).read_bytes(), self.old)

    def test_changed_installed_asset_or_wrong_prior_digest_rejects(self):
        with self.assertRaisesRegex(ValueError, 'previous_receiver_digest_mismatch'):
            refresh.refresh(self.source, self.expected, 'f' * 64)
        self.write(self.lib / refresh.GATEWAY, b'# replaced\n', 0o755)
        with self.assertRaisesRegex(ValueError, 'installed_receiver_asset_changed'):
            self.run_refresh()

    def test_changed_updater_rejects_before_writes(self):
        self.write(self.lib / 'update-backend.py', b'# changed\n', 0o644)
        with self.assertRaisesRegex(ValueError, 'installed_updater_asset_changed'):
            self.run_refresh()
        self.assertEqual((self.lib / refresh.RECEIVER).read_bytes(), self.old)

    def test_held_locks_prevent_refresh(self):
        for path in (self.lock, self.state / 'receiver.lock'):
            with self.subTest(path=path), path.open('r+b') as stream:
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):
                    self.run_refresh()
        self.assertEqual((self.lib / refresh.RECEIVER).read_bytes(), self.old)

    def test_blocked_or_inactive_status_does_not_change_installed_files(self):
        for change in [{'blocked': True}, {'application': {'api_active': True, 'worker_active': False}}]:
            with self.subTest(change=change):
                self.candidate({**self.status, **change})
                with self.assertRaisesRegex(ValueError, 'reviewed_receiver_not_ready'):
                    self.run_refresh()
                self.assertEqual((self.lib / refresh.RECEIVER).read_bytes(), self.old)

    def test_symlink_or_unprotected_settings_rejected(self):
        source_link = self.source.with_suffix('.link')
        source_link.symlink_to(self.source)
        with self.assertRaises(OSError):
            refresh.refresh(source_link, self.expected, self.previous)
        (self.state / 'receiver-settings.json').chmod(0o644)
        with self.assertRaisesRegex(ValueError, 'invalid_refresh_mode'):
            self.run_refresh()

    def test_second_write_failure_preserves_originals_and_does_not_replay(self):
        original = refresh.replace
        def fail_settings(path, raw, mode):
            if path.name == 'receiver-settings.json':
                raise OSError('synthetic interrupted settings write')
            return original(path, raw, mode)
        with patch.object(refresh, 'replace', side_effect=fail_settings), self.assertRaises(OSError):
            self.run_refresh()
        self.assertEqual((self.lib / refresh.RECEIVER).read_bytes(), self.source.read_bytes())
        self.assertEqual(json.loads((self.state / 'receiver-settings.json').read_bytes()), self.settings)
        self.assertEqual((self.state / ('receiver-refresh-' + self.expected) / refresh.RECEIVER).read_bytes(), self.old)
        with self.assertRaisesRegex(ValueError, 'installed_receiver_asset_changed'):
            self.run_refresh()

    def test_original_directory_entries_are_synced_before_either_asset_write(self):
        events = []
        original_sync, original_replace = refresh.sync_directory, refresh.replace
        def sync(path):
            events.append(('sync', path))
            return original_sync(path)
        def replace(path, raw, mode):
            events.append(('replace', path))
            return original_replace(path, raw, mode)
        with patch.object(refresh, 'sync_directory', side_effect=sync), patch.object(refresh, 'replace', side_effect=replace):
            self.run_refresh()
        record = self.state / ('receiver-refresh-' + self.expected)
        self.assertEqual(events[:3], [('sync', record), ('sync', self.state), ('replace', self.lib / refresh.RECEIVER)])

    def test_failure_to_persist_original_directory_entries_prevents_asset_writes(self):
        with patch.object(refresh, 'sync_directory', side_effect=OSError('synthetic fsync failure')):
            with self.assertRaises(OSError):
                self.run_refresh()
        self.assertEqual((self.lib / refresh.RECEIVER).read_bytes(), self.old)
        self.assertEqual(json.loads((self.state / 'receiver-settings.json').read_bytes()), self.settings)


if __name__ == '__main__':
    unittest.main()
