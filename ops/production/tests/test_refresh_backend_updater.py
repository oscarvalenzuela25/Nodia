"""Protected updater replacement, pinned inputs, locks and interrupted-write evidence."""
import fcntl
import importlib.util
import json
import os
import stat
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('refresh_updater', Path(__file__).resolve().parents[1] / 'refresh-backend-updater.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'requires isolated Linux root ownership')
class UpdaterRefreshTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir='/root')
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.lib, self.state = root / 'lib', root / 'state'
        self.lib.mkdir()
        self.state.mkdir()
        self.lock = root / 'installation.lock'
        for file in (self.lock, self.state / 'receiver.lock'):
            self.write(file, b'', 0o600)
        self.io = module.io_policy()
        assets = {}
        for name in module.ASSETS:
            raw = b'# previous updater\n' if name == module.ASSET else b'# immutable fixture\n'
            self.write(self.lib / name, raw, 0o644)
            assets[name] = self.io.sha(raw)
        self.previous = assets[module.ASSET]
        self.settings = {'schema_version': 1, 'assets': assets, 'nginx_site_sha256': 'f' * 64,
                         'service_hashes': {'preserved': 'also preserved'}}
        self.write(self.state / 'settings.json', json.dumps(self.settings).encode(), 0o600)
        ready = {'status': 'deployment_ready', 'blocked': False, 'current': {'source_sha': 'a' * 40},
                 'application': {'api_active': True, 'worker_active': True}}
        receiver = ('def deployment_status():\n    return ' + repr(ready) +
                    '\ndef unit_state(unit):\n    return {}\n').encode()
        self.write(self.lib / 'deploy-backend-receiver.py', receiver, 0o644)
        self.write(self.lib / 'deploy-gateway.py', b'# fixed gateway\n', 0o755)
        receiver_settings = {'assets': {name: self.io.sha((self.lib / name).read_bytes()) for name in
                                       ('deploy-backend-receiver.py', 'deploy-gateway.py')}}
        self.receiver_raw = json.dumps(receiver_settings).encode()
        self.write(self.state / 'receiver-settings.json', self.receiver_raw, 0o600)
        self.operation = 'b' * 32
        attempt = self.state / 'attempts' / self.operation
        attempt.mkdir(parents=True)
        self.state_file = attempt / 'state.json'
        self.operation_state = {'operation_id': self.operation, 'phase': 'failed', 'failed_phase': 'preparing',
                                'effects_started': False, 'migration_requested': False}
        self.write(self.state_file, json.dumps(self.operation_state).encode(), 0o600)
        self.source = root / 'candidate.py'
        self.source.write_text('class Host:\n def __init__(self,*args): pass\n def service_overrides(self,*args): pass\n', encoding='utf-8')
        self.expected = self.io.sha(self.source.read_bytes())
        for name, value in (('LIB', self.lib), ('STATE', self.state), ('INSTALL_LOCK', self.lock)):
            context = patch.object(module, name, value)
            context.start()
            self.addCleanup(context.stop)

    def write(self, path, raw, mode):
        path.write_bytes(raw)
        path.chmod(mode)

    def refresh(self):
        return module.refresh(self.source, self.expected, self.previous, self.operation)

    def test_replaces_only_updater_and_its_pin_preserving_failed_operation(self):
        original_state = self.state_file.read_bytes()
        result = self.refresh()
        self.assertEqual(result['status'], 'updater_refreshed')
        self.assertFalse(result['deployment_requested'])
        expected = {**self.settings, 'assets': {**self.settings['assets'], module.ASSET: self.expected}}
        self.assertEqual(json.loads((self.state / 'settings.json').read_bytes()), expected)
        self.assertEqual((self.state / 'receiver-settings.json').read_bytes(), self.receiver_raw)
        self.assertEqual(self.state_file.read_bytes(), original_state)
        self.assertEqual((self.lib / module.ASSET).read_bytes(), self.source.read_bytes())
        record = self.state / ('updater-refresh-' + self.expected)
        self.assertEqual((record / module.ASSET).read_bytes(), b'# previous updater\n')
        self.assertEqual(json.loads((record / 'settings.json').read_bytes()), self.settings)

    def test_new_or_installed_digest_mismatch_prevents_writes(self):
        self.source.write_bytes(b'# changed after review\n')
        with self.assertRaisesRegex(ValueError, 'reviewed_updater_digest_required'):
            self.refresh()
        self.source.write_bytes(b'class Host:\n def __init__(self,*args): pass\n def service_overrides(self,*args): pass\n')
        (self.lib / 'backend_update.py').write_bytes(b'# modified installed policy\n')
        with self.assertRaisesRegex(ValueError, 'installed_updater_asset_changed'):
            self.refresh()
        self.assertEqual((self.lib / module.ASSET).read_bytes(), b'# previous updater\n')

    def test_effects_or_migration_or_wrong_phase_reject_refresh(self):
        for change in ({'effects_started': True}, {'migration_requested': True}, {'failed_phase': 'migration_requested'}):
            with self.subTest(change=change):
                self.state_file.write_text(json.dumps({**self.operation_state, **change}))
                with self.assertRaisesRegex(ValueError, 'effect_free_failed_preflight_required'):
                    self.refresh()
        self.assertEqual((self.lib / module.ASSET).read_bytes(), b'# previous updater\n')

    def test_receiver_or_installation_lock_rejects_concurrent_refresh(self):
        for path in (self.state / 'receiver.lock', self.lock):
            with path.open('r+b') as stream:
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):
                    self.refresh()

    def test_symlink_fifo_and_growing_sources_fail_before_writes(self):
        link = self.source.with_suffix('.link')
        link.symlink_to(self.source)
        with self.assertRaises(OSError):
            module.refresh(link, self.expected, self.previous, self.operation)
        fifo = self.source.with_suffix('.fifo')
        os.mkfifo(fifo)
        with self.assertRaisesRegex(ValueError, 'invalid_reviewed_source'):
            module.refresh(fifo, self.expected, self.previous, self.operation)
        self.source.write_bytes(b'x' * (100 * 1024 + 10))
        # A file that grows after fstat remains bounded by the descriptor read.
        with patch.object(module.os, 'fstat', return_value=SimpleNamespace(st_mode=stat.S_IFREG | 0o644, st_nlink=1, st_size=1)):
            with self.assertRaisesRegex(ValueError, 'reviewed_source_too_large'):
                self.refresh()
        self.assertEqual((self.lib / module.ASSET).read_bytes(), b'# previous updater\n')

    def test_interrupted_settings_write_preserves_originals_and_prevents_replay(self):
        original = self.io.replace
        def fail_settings(path, raw, mode):
            if path.name == 'settings.json':
                raise OSError('synthetic interrupted settings replacement')
            return original(path, raw, mode)
        with patch.object(module, 'io_policy', return_value=self.io), patch.object(self.io, 'replace', side_effect=fail_settings):
            with self.assertRaises(OSError):
                self.refresh()
        record = self.state / ('updater-refresh-' + self.expected)
        self.assertEqual((record / module.ASSET).read_bytes(), b'# previous updater\n')
        self.assertEqual(json.loads((self.state / 'settings.json').read_bytes()), self.settings)
        with self.assertRaisesRegex(ValueError, 'installed_updater_asset_changed'):
            self.refresh()


if __name__ == '__main__':
    unittest.main()
