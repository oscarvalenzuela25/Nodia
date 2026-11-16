"""Gateway CAS and failure boundaries on disposable Linux root files; no production IO."""
import copy
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

BASE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('refresh_gateway_fixture', BASE / 'refresh-deploy-gateway.py')
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


@unittest.skipUnless(sys.platform == 'linux' and os.geteuid() == 0, 'requires isolated Linux root ownership')
class GatewayRefreshTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='gateway-refresh-', dir=Path.home())
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.lib, self.state = self.root / 'lib', self.root / 'state'
        self.lib.mkdir(mode=0o700)
        self.state.mkdir(mode=0o700)
        self.install = self.root / 'installation.lock'
        for filename in (self.install, self.state / 'receiver.lock'):
            self.write(filename, b'', 0o600)
        self.io = refresh.io_policy()
        self.old = b'# Synthetic prior gateway; never executed.\n'
        self.previous = self.io.sha(self.old)
        self.write(self.lib / refresh.GATEWAY, self.old, 0o755)
        self.status = {'schema_version': 1, 'status': 'deployment_ready', 'blocked': False,
                       'application': {'api_active': True, 'worker_active': True},
                       'current': {'source_sha': 'a' * 40, 'package_tree_sha256': 'b' * 64,
                                   'release_id': 'backend-' + 'a' * 12 + '-' + 'b' * 12}}
        self.units = {unit: {'ActiveState': 'active', 'SubState': 'running', 'Result': 'success',
                           'MainPID': str(1000 + index), 'ControlGroup': '/system.slice/' + unit}
                      for index, unit in enumerate(refresh.UNITS)}
        receiver = ('def deployment_status():\n    return ' + repr(self.status) +
                    '\ndef unit_state(unit):\n    return ' + repr(self.units) + '[unit]\n').encode()
        self.write(self.lib / refresh.RECEIVER, receiver, 0o644)
        self.settings = {'schema_version': 1, 'operator_field': 'preserved', 'assets': {
            refresh.RECEIVER: self.io.sha(receiver), refresh.GATEWAY: self.previous}}
        self.settings_path = self.state / 'receiver-settings.json'
        self.json(self.settings_path, self.settings)
        self.settings_raw = self.settings_path.read_bytes()
        self.settings_sha = self.io.sha(self.settings_raw)
        assets = {}
        for name in refresh.UPDATER_ASSETS:
            raw = b'# Synthetic immutable updater asset.\n'
            self.write(self.lib / name, raw, 0o644)
            assets[name] = self.io.sha(raw)
        self.json(self.state / 'settings.json', {'schema_version': 1, 'assets': assets,
                  'service_hashes': {'preserved': 'unchanged'}})
        self.updater_raw = (self.state / 'settings.json').read_bytes()
        self.source = self.root / 'unprivileged-candidate.py'
        # Original v1 bytes pinned by this historical operator, from production commit 6ba2afb7.
        self.write(self.source, (BASE / 'tests/fixtures/deploy-gateway-v1.py').read_bytes(), 0o666)
        self.expected = self.io.sha(self.source.read_bytes())
        self.assertEqual(self.expected, refresh.CANDIDATE_SHA256)
        self.record = self.state / ('gateway-refresh-' + self.expected)
        context = patch.multiple(refresh, LIB=self.lib, STATE=self.state, INSTALL_LOCK=self.install)
        context.start()
        self.addCleanup(context.stop)
        load = refresh.load_receiver

        def receiver_from_pinned_bytes(raw):
            module = load(raw)
            module.deployment_status = lambda: copy.deepcopy(self.status)
            module.unit_state = lambda unit: copy.deepcopy(self.units[unit])
            return module
        context = patch.object(refresh, 'load_receiver', side_effect=receiver_from_pinned_bytes)
        context.start()
        self.addCleanup(context.stop)

    def write(self, path, raw, mode):
        path.write_bytes(raw)
        path.chmod(mode)

    def json(self, path, value):
        self.write(path, (json.dumps(value, sort_keys=True) + '\n').encode(), 0o600)

    def run_refresh(self, **kwargs):
        return refresh.refresh(self.source, self.expected, self.previous, self.settings_sha, **kwargs)

    def original_files(self):
        return {str(path.relative_to(self.root)): (path.read_bytes(), stat.S_IMODE(path.stat().st_mode))
                for directory in (self.lib, self.state) for path in directory.rglob('*') if path.is_file()}

    def test_default_dry_run_has_no_writes_or_intent(self):
        before = self.original_files()
        result = self.run_refresh()
        self.assertEqual(result['status'], 'gateway_refresh_dry_run')
        self.assertFalse(result['gateway_changed'])
        self.assertFalse(result['automatic_retry_allowed'])
        self.assertFalse(result['deployment_requested'])
        self.assertFalse(self.record.exists())
        self.assertEqual(self.original_files(), before)

    def test_apply_updates_only_gateway_and_its_pin_with_durable_originals_and_receipt(self):
        before = self.original_files()
        result = self.run_refresh(apply=True)
        self.assertEqual(result['status'], 'gateway_refreshed')
        self.assertTrue(result['gateway_changed'])
        self.assertFalse(result['application_services_restarted'])
        self.assertFalse(result['deployment_performed'])
        self.assertFalse(result['automatic_retry_allowed'])
        self.assertEqual(result['current'], self.status['current'])
        self.assertEqual(result['application_pids'], {unit: int(value['MainPID']) for unit, value in self.units.items()})
        self.assertEqual((self.lib / refresh.GATEWAY).read_bytes(), self.source.read_bytes())
        self.assertEqual(stat.S_IMODE((self.lib / refresh.GATEWAY).stat().st_mode), 0o755)
        self.assertEqual(stat.S_IMODE(self.settings_path.stat().st_mode), 0o600)
        self.assertEqual(json.loads(self.settings_path.read_bytes()), {**self.settings, 'assets': {
            **self.settings['assets'], refresh.GATEWAY: self.expected}})
        self.assertEqual((self.record / refresh.GATEWAY).read_bytes(), self.old)
        self.assertEqual((self.record / 'receiver-settings.json').read_bytes(), self.settings_raw)
        self.assertEqual(json.loads((self.record / 'receipt.json').read_bytes()), result)
        self.assertEqual(json.loads((self.record / 'intent.json').read_bytes())['previous_receiver_settings_sha256'], self.settings_sha)
        for relative, (raw, mode) in before.items():
            if relative not in ('lib/' + refresh.GATEWAY, 'state/receiver-settings.json'):
                self.assertEqual(((self.root / relative).read_bytes(), stat.S_IMODE((self.root / relative).stat().st_mode)), (raw, mode))
        with self.assertRaisesRegex(ValueError, 'intent_exists_no_automatic_replay'):
            self.run_refresh(apply=True)

    def test_only_the_reviewed_candidate_and_exact_settings_cas_are_accepted(self):
        with self.assertRaisesRegex(ValueError, 'receiver_settings_cas_mismatch'):
            refresh.refresh(self.source, self.expected, self.previous, 'f' * 64, apply=True)
        with self.assertRaisesRegex(ValueError, 'previous_gateway_digest_mismatch'):
            refresh.refresh(self.source, self.expected, 'f' * 64, self.settings_sha, apply=True)
        self.source.write_bytes(b'# Unknown but valid Python source.\n')
        with self.assertRaisesRegex(ValueError, 'reviewed_gateway_identity_required'):
            refresh.refresh(self.source, self.io.sha(self.source.read_bytes()), self.previous, self.settings_sha, apply=True)
        with self.assertRaisesRegex(ValueError, 'reviewed_gateway_digest_required'):
            self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())
        self.assertEqual((self.lib / refresh.GATEWAY).read_bytes(), self.old)

    def test_all_installed_assets_and_pins_are_checked_before_writes(self):
        for name in {refresh.RECEIVER, refresh.GATEWAY} | refresh.UPDATER_ASSETS:
            with self.subTest(name=name):
                path = self.lib / name
                raw = path.read_bytes()
                path.write_bytes(b'# Altered installed bytes.\n')
                try:
                    with self.assertRaisesRegex(ValueError, 'installed_gateway_refresh_asset_changed'):
                        self.run_refresh(apply=True)
                    self.assertFalse(self.record.exists())
                finally:
                    path.write_bytes(raw)

    def test_the_io_policy_pin_and_private_settings_mode_cannot_be_bypassed(self):
        with patch.object(refresh, 'IO_SHA256', 'f' * 64):
            with self.assertRaisesRegex(ValueError, 'reviewed_refresh_policy_required'):
                self.run_refresh(apply=True)
        self.settings_path.chmod(0o644)
        with self.assertRaisesRegex(ValueError, 'invalid_refresh_mode'):
            self.run_refresh(apply=True)
        self.assertEqual((self.lib / refresh.GATEWAY).read_bytes(), self.old)
        self.assertFalse(self.record.exists())

    def test_both_locks_are_required_and_acquired_in_receiver_then_installation_order(self):
        order, original = [], fcntl.flock

        def flock(fd, operation):
            order.append(Path(os.readlink('/proc/self/fd/' + str(fd))))
            return original(fd, operation)
        with patch.object(refresh.fcntl, 'flock', side_effect=flock):
            self.run_refresh()
        self.assertEqual(order, [self.state / 'receiver.lock', self.install])
        for path in (self.state / 'receiver.lock', self.install):
            with self.subTest(path=path), path.open('r+b') as handle:
                original(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):
                    self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())

    def test_blocked_or_unhealthy_status_prevents_any_mutation(self):
        for change in ({'blocked': True}, {'application': {'api_active': True, 'worker_active': False}},
                       {'current': {'source_sha': 'a' * 40}}):
            with self.subTest(change=change):
                original = self.status
                self.status = {**original, **change}
                try:
                    with self.assertRaisesRegex(ValueError, 'gateway_refresh_backend_not_ready'):
                        self.run_refresh(apply=True)
                finally:
                    self.status = original
        self.assertFalse(self.record.exists())

    def test_reconciled_historical_block_evidence_is_preserved_not_reinterpreted(self):
        blocked = self.state / 'BLOCKED.json'
        self.json(blocked, {'historical_failure': 'Synthetic, reconciled by installed receiver policy'})
        raw = blocked.read_bytes()
        result = self.run_refresh(apply=True)
        self.assertEqual(result['blocked_evidence_sha256'], self.io.sha(raw))
        self.assertEqual(blocked.read_bytes(), raw)

    def test_pid_change_after_replacement_prevents_success_receipt_and_replay(self):
        original = self.io.replace

        def replace(path, raw, mode):
            result = original(path, raw, mode)
            if path == self.settings_path:
                self.units[refresh.UNITS[0]]['MainPID'] = '9000'
            return result
        with patch.object(refresh, 'io_policy', return_value=self.io), patch.object(self.io, 'replace', side_effect=replace):
            with self.assertRaisesRegex(ValueError, 'gateway_refresh_runtime_changed'):
                self.run_refresh(apply=True)
        self.assertTrue((self.record / 'intent.json').exists())
        self.assertFalse((self.record / 'receipt.json').exists())
        with self.assertRaisesRegex(ValueError, 'intent_exists_no_automatic_replay'):
            self.run_refresh(apply=True)

    def test_failure_after_code_write_keeps_originals_and_mismatched_pin_fail_closed(self):
        original = self.io.replace

        def replace(path, raw, mode):
            if path == self.settings_path:
                raise OSError('Synthetic interruption before pin replacement')
            return original(path, raw, mode)
        with patch.object(refresh, 'io_policy', return_value=self.io), patch.object(self.io, 'replace', side_effect=replace):
            with self.assertRaises(OSError):
                self.run_refresh(apply=True)
        self.assertEqual((self.lib / refresh.GATEWAY).read_bytes(), self.source.read_bytes())
        self.assertEqual(self.settings_path.read_bytes(), self.settings_raw)
        self.assertNotEqual(self.io.sha((self.lib / refresh.GATEWAY).read_bytes()), self.settings['assets'][refresh.GATEWAY])
        self.assertEqual((self.record / refresh.GATEWAY).read_bytes(), self.old)
        self.assertEqual((self.record / 'receiver-settings.json').read_bytes(), self.settings_raw)
        self.assertFalse((self.record / 'receipt.json').exists())
        with self.assertRaisesRegex(ValueError, 'intent_exists_no_automatic_replay'):
            self.run_refresh(apply=True)

    def test_intent_or_partial_record_is_never_overwritten_even_during_dry_run(self):
        self.record.mkdir(mode=0o700)
        for apply in (False, True):
            with self.assertRaisesRegex(ValueError, 'intent_exists_no_automatic_replay'):
                self.run_refresh(apply=apply)
        self.assertEqual(list(self.record.iterdir()), [])
        self.assertEqual((self.lib / refresh.GATEWAY).read_bytes(), self.old)

    def test_source_symlink_fifo_hardlink_invalid_utf8_and_crlf_are_rejected(self):
        link = self.root / 'link.py'
        link.symlink_to(self.source)
        with self.assertRaises(OSError):
            refresh.refresh(link, self.expected, self.previous, self.settings_sha, apply=True)
        fifo = self.root / 'fifo.py'
        os.mkfifo(fifo)
        with self.assertRaisesRegex(ValueError, 'invalid_gateway_refresh_source'):
            refresh.refresh(fifo, self.expected, self.previous, self.settings_sha, apply=True)
        hardlink = self.root / 'hardlink.py'
        os.link(self.source, hardlink)
        with self.assertRaisesRegex(ValueError, 'invalid_gateway_refresh_source'):
            self.run_refresh(apply=True)
        hardlink.unlink()
        self.source.write_bytes(b'# invalid UTF-8: \xff\n')
        with self.assertRaisesRegex(ValueError, 'gateway_source_utf8_required'):
            self.run_refresh(apply=True)
        self.source.write_bytes((BASE / refresh.GATEWAY).read_bytes().replace(b'\n', b'\r\n'))
        with self.assertRaisesRegex(ValueError, 'reviewed_gateway_digest_required'):
            self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())

    def test_an_oversized_source_is_rejected_without_reading_unbounded_data(self):
        self.source.write_bytes(b'x' * (refresh.SOURCE_LIMIT + 1))
        with self.assertRaisesRegex(ValueError, 'invalid_gateway_refresh_source'):
            self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())
        self.assertEqual((self.lib / refresh.GATEWAY).read_bytes(), self.old)

    def test_originals_and_intent_are_synced_before_first_replacement(self):
        events, original_sync, original_replace = [], self.io.sync_directory, self.io.replace

        def sync(path):
            events.append(('sync', path))
            return original_sync(path)

        def replace(path, raw, mode):
            events.append(('replace', path))
            self.assertTrue((self.record / 'intent.json').is_file())
            self.assertEqual((self.record / refresh.GATEWAY).read_bytes(), self.old)
            self.assertEqual((self.record / 'receiver-settings.json').read_bytes(), self.settings_raw)
            return original_replace(path, raw, mode)
        with patch.object(refresh, 'io_policy', return_value=self.io), patch.object(self.io, 'sync_directory', side_effect=sync), patch.object(self.io, 'replace', side_effect=replace):
            self.run_refresh(apply=True)
        first = events.index(('replace', self.lib / refresh.GATEWAY))
        self.assertIn(('sync', self.state), events[:first])
        self.assertGreaterEqual(events[:first].count(('sync', self.record)), 3)


if __name__ == '__main__':
    unittest.main()
