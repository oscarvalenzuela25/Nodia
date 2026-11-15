"""Real isolated root filesystem CAS/locks/recovery, with synthetic systemd/receiver boundaries."""
from contextlib import ExitStack
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('teacher_operator_upgrade', Path(__file__).resolve().parents[1] / 'ai-runtime/upgrade-teacher-operators.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'requires isolated native Linux root ownership')
class TeacherOperatorUpgradeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir='/root')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.lib, self.state, self.units = [self.root / name for name in ('lib', 'state', 'units')]
        self.bundle = self.root / 'bundle'
        self.registry = self.root / 'registry/consumers.json'
        self.lock = self.root / 'installation.lock'
        for directory in (self.lib / 'ai-runtime', self.state, self.units, self.bundle / 'ai-runtime', self.registry.parent):
            directory.mkdir(mode=0o755, parents=True)
        self.write(self.lock, b'', 0o600)
        self.write(self.state / 'receiver.lock', b'', 0o600)
        self.release = self.root / ('backend-' + 'a' * 12 + '-' + 'b' * 12)
        self.release.mkdir()
        self.write(self.release / 'release-manifest.json', b'{"synthetic_fixture":true}\n')
        self.current = self.root / 'current'
        self.current.symlink_to(self.release)
        self.ready = {'status': 'deployment_ready', 'blocked': False,
                      'application': {'api_active': True, 'worker_active': True},
                      'current': {'release_id': self.release.name, 'source_sha': 'a' * 40, 'package_tree_sha256': 'b' * 64}}
        template = {'70-codex-runtime.conf': b'reviewed synthetic70\n', '71-gemini-runtime.conf': b'reviewed synthetic71\n'}
        registry = {'schema_version': 1, 'purpose': 'nodia_ai_runtime_consumers',
                    'units': {name: {key: module.sha(value) for key, value in template.items()} for name in module.SERVICES}}
        old = ('AI_RUNTIME_TEMPLATES=' + repr(template) + '\n'
               'def ai_runtime_registry(value):\n if value!=' + repr(registry) + ': raise ValueError("registry_mismatch")\n return value\n')
        new = old + ('TEACHER_RUNTIME_NAME="72-teacher-runtime.conf"\n'
                     'TEACHER_RUNTIME_TEMPLATE=b"[Service]\\nEnvironmentFile=/etc/nodia/teacher-runtime.env\\n"\n'
                     'class Host:\n def __init__(self,*args): pass\n'
                     ' def service_overrides(self,unit,state):\n'
                     '  if unit not in ' + repr(module.SERVICES) + ' and state["DropInPaths"]!="": raise ValueError("fixture_unknown_override")\n')
        self.write(self.lib / 'update-backend.py', old.encode())
        for name in module.ASSETS - {'update-backend.py'}:
            self.write(self.lib / name, b'# Synthetic immutable asset\n')
        self.write(self.lib / 'ai-runtime/register-consumers.py', b'# Synthetic previous register\n')
        for name in module.IMMUTABLE:
            if not (self.lib / name).exists():
                self.write(self.lib / name, b'# Synthetic verified runtime asset\n')
        receiver = ('def deployment_status():\n return ' + repr(self.ready) + '\n'
                    'def unit_state(unit):\n return {"ActiveState":"active","SubState":"running","MainPID":"0","DropInPaths":""}\n')
        self.write(self.lib / 'deploy-backend-receiver.py', receiver.encode())
        self.write(self.lib / 'deploy-gateway.py', b'# Synthetic immutable gateway\n', 0o755)
        self.settings = {'schema_version': 1,
                         'assets': {name: module.sha((self.lib / name).read_bytes()) for name in module.ASSETS},
                         'service_hashes': {}, 'nginx_site_sha256': 'd' * 64,
                         'arbitrary_preserved_metadata': {'purpose': 'must remain equal'}}
        for name in module.BASE_UNITS:
            self.write(self.units / name, ('# Synthetic reviewed ' + name + '\n').encode())
            self.settings['service_hashes'][name] = module.sha((self.units / name).read_bytes())
        self.write(self.state / 'settings.json', json.dumps(self.settings).encode(), 0o600)
        receiver_settings = {'schema_version': 1, 'assets': {name: module.sha((self.lib / name).read_bytes()) for name in
                                                           ('deploy-backend-receiver.py', 'deploy-gateway.py')}}
        self.write(self.state / 'receiver-settings.json', json.dumps(receiver_settings).encode(), 0o600)
        self.write(self.registry, json.dumps(registry).encode(), 0o600)
        self.write(self.bundle / 'update-backend.py', new.encode())
        self.write(self.bundle / 'ai-runtime/register-consumers.py', b'# Synthetic reviewed new register\n')
        self.write(self.bundle / 'ai-runtime/prepare-teacher-runtime.py', b'# Synthetic reviewed new prepare\n')
        self.plan = {'schema': 'teacher-operator-upgrade/1', 'current_release': self.release.name,
                     'current_manifest_sha256': module.sha((self.release / 'release-manifest.json').read_bytes()),
                     'files': {name: {'previous_sha256': module.sha((self.lib / name).read_bytes()) if name in module.REPLACE else None,
                                      'sha256': module.sha((self.bundle / name).read_bytes())} for name in module.REPLACE | module.CREATE},
                     'immutable': {name: module.sha((self.lib / name).read_bytes()) for name in module.IMMUTABLE}}
        self.manifest = self.root / 'manifest.json'
        self.seal()
        self.patch = ExitStack()
        self.addCleanup(self.patch.close)
        for name, value in {'LIB': self.lib, 'STATE': self.state, 'CURRENT': self.current, 'SYSTEMD': self.units,
                            'REGISTRY': self.registry, 'TEACHER_ENVIRONMENT': self.root / 'teacher-runtime.env', 'INSTALL_LOCK': self.lock}.items():
            self.patch.enter_context(patch.object(module, name, value))
        self.patch.enter_context(patch.object(module, 'timer_enabled', return_value='enabled'))
        self.before = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}

    def write(self, path, raw, mode=0o644):
        path.write_bytes(raw)
        path.chmod(mode)

    def seal(self):
        for filename, field in [('settings.json', 'settings_sha256'), ('receiver-settings.json', 'receiver_settings_sha256')]:
            self.plan[field] = module.sha((self.state / filename).read_bytes())
        self.plan['registry_sha256'] = module.sha(self.registry.read_bytes())
        self.write(self.manifest, (json.dumps(self.plan) + '\n').encode())
        self.digest = module.sha(self.manifest.read_bytes())
        self.record = self.state / ('teacher-operators-upgrade-' + self.digest)

    def upgrade(self):
        return module.upgrade(self.bundle, self.manifest, self.digest)

    def test_healthy_refresh_changes_only_three_operators_and_one_pin(self):
        result = self.upgrade()
        self.assertEqual(result['status'], 'teacher_operators_upgraded')
        self.assertFalse(result['application_restarted'])
        self.assertFalse(result['runtime_activated'])
        settings = json.loads((self.state / 'settings.json').read_bytes())
        expected = json.loads(json.dumps(self.settings))
        expected['assets']['update-backend.py'] = self.plan['files']['update-backend.py']['sha256']
        self.assertEqual(settings, expected)
        for name in module.REPLACE | module.CREATE:
            self.assertEqual((self.lib / name).read_bytes(), (self.bundle / name).read_bytes())
            self.assertEqual((self.lib / name).stat().st_mode & 0o777, 0o644)
        for name in module.IMMUTABLE:
            self.assertEqual((self.lib / name).read_bytes(), self.before['lib/' + name])
        for name in module.REPLACE:
            backup = self.record / 'originals' / name
            self.assertEqual(backup.read_bytes(), self.before['lib/' + name])
            self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
        for name in ('settings.json', 'receiver-settings.json'):
            self.assertEqual((self.record / 'originals' / name).read_bytes(), self.before['state/' + name])
        self.assertEqual((self.record / 'originals/consumers.json').read_bytes(), self.before['registry/consumers.json'])
        self.assertEqual(json.loads((self.record / 'before.json').read_bytes())['absent'], sorted(module.CREATE))
        self.assertEqual((self.state / 'receiver-settings.json').read_bytes(), self.before['state/receiver-settings.json'])
        self.assertEqual(self.registry.read_bytes(), self.before['registry/consumers.json'])
        self.assertFalse((self.state / 'attempts').exists())
        self.assertFalse((self.lib / 'teacher-runtime').exists())

    def test_unknown_targets_or_bad_manifest_pin_fail_without_reserving(self):
        with self.assertRaisesRegex(ValueError, 'manifest_digest_mismatch'):
            module.upgrade(self.bundle, self.manifest, 'f' * 64)
        self.plan['files']['ai-runtime/unreviewed.py'] = self.plan['files']['update-backend.py']
        self.seal()
        with self.assertRaisesRegex(ValueError, 'closed_operator_scope_required'):
            self.upgrade()
        self.assertFalse(self.record.exists())

    def test_blocked_inactive_or_not_ready_backend_rejects_before_reservation(self):
        receiver_path = self.lib / 'deploy-backend-receiver.py'
        original = receiver_path.read_bytes()
        for change in ({'blocked': True}, {'application': {'api_active': True, 'worker_active': False}},
                       {'status': 'not_ready'}):
            with self.subTest(change=change):
                value = {**self.ready, **change}
                receiver_path.write_bytes(original.replace(repr(self.ready).encode(), repr(value).encode()))
                settings = json.loads((self.state / 'receiver-settings.json').read_bytes())
                settings['assets']['deploy-backend-receiver.py'] = module.sha(receiver_path.read_bytes())
                self.write(self.state / 'receiver-settings.json', json.dumps(settings).encode(), 0o600)
                self.seal()
                with self.assertRaisesRegex(ValueError, 'healthy_unblocked_backend_required'):
                    self.upgrade()
                self.assertFalse(self.record.exists())
                self.assertEqual((self.lib / 'update-backend.py').read_bytes(), self.before['lib/update-backend.py'])

    def test_preexisting_teacher_environment_is_preserved_and_rejects_initial_upgrade(self):
        environment = self.root / 'teacher-runtime.env'
        self.write(environment, b'# Synthetic existing unknown environment\n')
        with self.assertRaisesRegex(ValueError, 'teacher_runtime_already_configured'):
            self.upgrade()
        self.assertEqual(environment.read_bytes(), b'# Synthetic existing unknown environment\n')
        self.assertFalse(self.record.exists())

    def test_settings_action_pin_cannot_be_hidden_by_identical_immutable_key(self):
        self.settings['assets']['update-backend-action.mjs'] = 'f' * 64
        self.write(self.state / 'settings.json', json.dumps(self.settings).encode(), 0o600)
        self.seal()
        with self.assertRaisesRegex(ValueError, 'installed_asset_digest_changed'):
            self.upgrade()
        self.assertFalse(self.record.exists())

    def test_preexisting_unit_drift_and_missing_unit_pin_are_rejected(self):
        target = self.units / 'nodia-ai-backup.timer'
        target.write_bytes(b'# Unreviewed timer change\n')
        with self.assertRaisesRegex(ValueError, 'base_unit_pin_changed'):
            self.upgrade()
        target.write_bytes(self.before['units/nodia-ai-backup.timer'])
        self.settings['service_hashes'].pop('nodia-ai-backup.timer')
        self.write(self.state / 'settings.json', json.dumps(self.settings).encode(), 0o600)
        self.seal()
        with self.assertRaisesRegex(ValueError, 'installed_digest_map_invalid'):
            self.upgrade()
        self.assertFalse(self.record.exists())

    def test_metadata_or_source_drift_and_preexisting_prepare_never_overwrite(self):
        original = self.registry.read_bytes()
        self.registry.write_bytes(original + b' ')
        with self.assertRaisesRegex(ValueError, 'protected_metadata_CAS_changed'):
            self.upgrade()
        self.registry.write_bytes(original)
        self.write(self.lib / 'ai-runtime/prepare-teacher-runtime.py', b'# Existing unknown operator\n')
        with self.assertRaisesRegex(ValueError, 'prepare_operator_already_exists'):
            self.upgrade()
        self.assertFalse(self.record.exists())

    def test_receiver_and_installation_locks_exclude_concurrent_writes(self):
        import fcntl
        for path in (self.state / 'receiver.lock', self.lock):
            with path.open('r+b') as stream:
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):
                    self.upgrade()
        self.assertFalse(self.record.exists())

    def test_unsafe_sources_manifest_links_and_CRLF_fail_before_reservation(self):
        link = self.root / 'manifest.link'; link.symlink_to(self.manifest)
        with self.assertRaisesRegex(ValueError, 'canonical_source_required'):
            module.upgrade(self.bundle, link, self.digest)
        source = self.bundle / 'ai-runtime/register-consumers.py'
        raw = source.read_bytes(); source.unlink(); os.mkfifo(source)
        with self.assertRaisesRegex(ValueError, 'bounded_regular_source_required'):
            self.upgrade()
        source.unlink(); self.write(source, raw)
        other = self.root / 'linked-source'; os.link(source, other)
        with self.assertRaisesRegex(ValueError, 'bounded_regular_source_required'):
            self.upgrade()
        other.unlink(); self.write(source, raw + b'\r\n')
        self.plan['files']['ai-runtime/register-consumers.py']['sha256'] = module.sha(source.read_bytes()); self.seal()
        with self.assertRaisesRegex(ValueError, 'candidate_source_digest_or_LF_invalid'):
            self.upgrade()
        self.assertFalse(self.record.exists())

    def interrupt_after(self, name, create=False):
        target = self.lib / name if name != 'settings.json' else self.state / name
        function = 'exclusive' if create else 'replace'
        original = getattr(module, function)
        def fail(path, raw, mode=0o600):
            original(path, raw, mode)
            if path == target:
                raise OSError('Synthetic private interruption; must not reach a public receipt')
        with patch.object(module, function, side_effect=fail):
            with self.assertRaises(OSError):
                self.upgrade()
        self.assertTrue((self.record / 'intent.json').exists())
        self.assertTrue((self.record / 'failure.json').exists())
        self.assertFalse((self.record / 'receipt.json').exists())
        for replaced in module.REPLACE:
            self.assertEqual((self.record / 'originals' / replaced).read_bytes(), self.before['lib/' + replaced])
        with self.assertRaisesRegex(ValueError, 'upgrade_already_reserved_no_replay'):
            self.upgrade()

    def test_interrupted_new_prepare_preserves_originals_and_prevents_replay(self):
        self.interrupt_after('ai-runtime/prepare-teacher-runtime.py', create=True)

    def test_interrupted_register_preserves_originals_and_prevents_replay(self):
        self.interrupt_after('ai-runtime/register-consumers.py')

    def test_interrupted_updater_before_settings_preserves_originals_and_prevents_replay(self):
        self.interrupt_after('update-backend.py')

    def test_interrupted_settings_preserves_originals_and_prevents_replay(self):
        self.interrupt_after('settings.json')

    def test_timer_enable_drift_after_install_is_not_reported_as_success(self):
        states = iter(['enabled', 'enabled', 'disabled', 'enabled'])
        with patch.object(module, 'timer_enabled', side_effect=lambda _: next(states)):
            with self.assertRaisesRegex(ValueError, 'backend_or_runtime_changed_during_upgrade'):
                self.upgrade()
        self.assertTrue((self.record / 'failure.json').exists())
        self.assertFalse((self.record / 'receipt.json').exists())


if __name__ == '__main__':
    unittest.main()
