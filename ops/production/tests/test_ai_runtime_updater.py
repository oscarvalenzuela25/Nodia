"""Exact reviewed AI runtime extensions; no account, inference or updater effects."""
import ast
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

BASE = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


adapter = load('ai_updater_host', BASE / 'update-backend.py')
policy = load('ai_updater_policy', BASE / 'backend_update.py')


def registry():
    return {'schema_version': 1, 'purpose': 'nodia_ai_runtime_consumers',
            'units': {unit: dict(adapter.AI_RUNTIME_HASHES) for unit in adapter.SERVICES}}


class RegistryContractTests(unittest.TestCase):
    def test_hashes_match_the_reviewed_provisioning_templates(self):
        self.assertEqual(adapter.AI_RUNTIME_TEMPLATES['70-codex-runtime.conf'],
                         (BASE / 'ai-runtime/codex-runtime.conf').read_bytes())
        source = ast.parse((BASE / 'ai-runtime/activate-ai-runtime.py').read_text(encoding='utf-8'))
        gemini = [node.value for node in ast.walk(source) if isinstance(node, ast.Constant)
                  and isinstance(node.value, bytes)
                  and node.value.startswith(b'[Unit]\nWants=nodia-gemini.service\n')]
        self.assertEqual(gemini, [adapter.AI_RUNTIME_TEMPLATES['71-gemini-runtime.conf']])
        self.assertEqual(adapter.ai_runtime_registry(registry()), registry())

    def test_only_both_application_units_and_two_pinned_hashes_are_allowed(self):
        mutations = [
            lambda value: value.update(schema_version=True),
            lambda value: value.update(purpose='arbitrary_root_dropins'),
            lambda value: value.update(extra='unknown'),
            lambda value: value['units'].pop('nodia-ai-worker.service'),
            lambda value: value['units'].update({'nodia-ai-backup.service': dict(adapter.AI_RUNTIME_HASHES)}),
            lambda value: value['units']['nodia-api.service'].pop('71-gemini-runtime.conf'),
            lambda value: value['units']['nodia-api.service'].update({'99-override.conf': 'a' * 64}),
            lambda value: value['units']['nodia-api.service'].update({'70-codex-runtime.conf': 'a' * 64}),
        ]
        for change in mutations:
            value = registry()
            change(value)
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'ai_runtime_registry_invalid'):
                adapter.ai_runtime_registry(value)


class RuntimeDropinGuardTests(unittest.TestCase):
    def setUp(self):
        # On Linux these are real root-owned POSIX files. Windows cannot model Unix
        # owner/mode bits: content/inventory tests there explicitly mock that boundary.
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        root = Path(self.temporary.name).resolve()
        self.units = root / 'systemd'
        self.units.mkdir()
        self.registry = root / 'consumers.json'
        self.host = adapter.Host(policy, None, {'service_hashes': {}})
        for unit in adapter.SERVICES:
            path = self.units / unit
            path.write_bytes(b'synthetic reviewed base unit\n')
            path.chmod(0o644)
            self.host.settings['service_hashes'][unit] = adapter.sha_file(path)
        self.addCleanup(patch.stopall)
        patch.object(adapter, 'SYSTEMD_UNITS', self.units).start()
        patch.object(adapter, 'AI_CONSUMERS', self.registry).start()
        self.real_protected = adapter.protected
        if os.name == 'nt':
            def filesystem_metadata(path, **_):
                if path.is_symlink():
                    raise ValueError('unsafe_protected_path')
                return path.stat()
            patch.object(adapter, 'protected', side_effect=filesystem_metadata).start()
        else:
            # tempfile's shared /tmp parent is intentionally writable, unlike /etc.
            # Validate actual fixture nodes; do not reinterpret /tmp as production.
            def filesystem_metadata(path, **kwargs):
                if path in self.registry.parents and path not in (root,):
                    return path.stat()
                return self.real_protected(path, **kwargs)
            patch.object(adapter, 'protected', side_effect=filesystem_metadata).start()

    def state(self, unit='nodia-api.service'):
        return {'DropInPaths': ' '.join(str(self.units / (unit + '.d') / name)
                                       for name in adapter.AI_RUNTIME_HASHES)}

    def configure(self):
        self.registry.write_text(json.dumps(registry()), encoding='utf-8')
        self.registry.chmod(0o600)
        for unit in adapter.SERVICES:
            parent = self.units / (unit + '.d')
            parent.mkdir()
            parent.chmod(0o755)
            for name, data in adapter.AI_RUNTIME_TEMPLATES.items():
                child = parent / name
                child.write_bytes(data)
                child.chmod(0o644)

    def test_absent_registry_preserves_no_dropin_legacy(self):
        for unit in adapter.SERVICES:
            self.host.service_overrides(unit, {'DropInPaths': ''})
        with self.assertRaises(policy.Rejected):
            self.host.service_overrides('nodia-api.service', self.state())

    def test_exact_extensions_pass_pre_and_post_observation_without_mutation(self):
        self.configure()
        before = {p: p.read_bytes() for p in self.units.rglob('*') if p.is_file()}
        for _ in range(2):
            for unit in adapter.SERVICES:
                self.host.service_overrides(unit, self.state(unit))
        self.assertEqual(before, {p: p.read_bytes() for p in self.units.rglob('*') if p.is_file()})

    def test_backup_units_never_accept_ai_or_arbitrary_dropins(self):
        self.configure()
        for unit in (*adapter.BACKUPS, *adapter.TIMERS):
            self.host.service_overrides(unit, {'DropInPaths': ''})
            with self.subTest(unit=unit), self.assertRaises(policy.Rejected):
                self.host.service_overrides(unit, self.state(unit))

    def test_extra_loaded_or_unloaded_dropins_are_rejected(self):
        self.configure()
        with self.assertRaises(policy.Rejected):
            self.host.service_overrides('nodia-api.service',
                {'DropInPaths': self.state()['DropInPaths'] + ' /run/systemd/system/override.conf'})
        extra = self.units / 'nodia-api.service.d/99-extra.conf'
        extra.write_bytes(b'[Service]\nUser=root\n')
        extra.chmod(0o644)
        with self.assertRaisesRegex(policy.Rejected, 'ai_runtime_dropin_inventory_changed'):
            self.host.service_overrides('nodia-api.service', self.state())

    def test_changed_bytes_or_missing_dropin_do_not_get_repaired(self):
        self.configure()
        target = self.units / 'nodia-api.service.d/70-codex-runtime.conf'
        changed = b'[Service]\nExecStart=/bin/sh\n'
        target.write_bytes(changed)
        with self.assertRaisesRegex(policy.Rejected, 'ai_runtime_dropin_changed'):
            self.host.service_overrides('nodia-api.service', self.state())
        self.assertEqual(target.read_bytes(), changed)
        target.unlink()
        with self.assertRaisesRegex(policy.Rejected, 'ai_runtime_dropin_inventory_changed'):
            self.host.service_overrides('nodia-api.service', self.state())

    def test_registry_removal_or_replacement_mid_update_is_rejected(self):
        self.configure()
        self.host.service_overrides('nodia-api.service', self.state())
        self.registry.unlink()
        with self.assertRaisesRegex(policy.Rejected, 'ai_runtime_registry_changed_during_update'):
            self.host.service_overrides('nodia-ai-worker.service', self.state('nodia-ai-worker.service'))
        self.registry.write_text(json.dumps(registry(), indent=2), encoding='utf-8')
        self.registry.chmod(0o600)
        with self.assertRaisesRegex(policy.Rejected, 'ai_runtime_registry_changed_during_update'):
            self.host.service_overrides('nodia-api.service', self.state())

    def test_base_unit_hash_is_still_pinned(self):
        self.configure()
        self.host.service_overrides('nodia-api.service', self.state())
        target = self.units / 'nodia-api.service'
        target.write_bytes(b'[Service]\nUser=root\n')
        with self.assertRaisesRegex(policy.Rejected, 'installed_service_changed_or_overridden'):
            self.host.service_overrides('nodia-api.service', self.state())

    def test_symlink_and_mutable_files_cannot_gain_trust_from_registry(self):
        self.configure()
        target = self.units / 'nodia-api.service.d/70-codex-runtime.conf'
        original = target.read_bytes()
        target.unlink()
        target.symlink_to(self.units / 'nodia-api.service')
        with self.assertRaises(ValueError):
            self.host.service_overrides('nodia-api.service', self.state())
        target.unlink()
        target.write_bytes(original)
        if os.name == 'posix':
            target.chmod(0o666)
            with self.assertRaises(ValueError):
                self.host.service_overrides('nodia-api.service', self.state())
        else:
            with patch.object(adapter, 'protected', side_effect=ValueError('unsafe_protected_path')):
                with self.assertRaises(ValueError):
                    self.host.service_overrides('nodia-api.service', self.state())


if __name__ == '__main__':
    unittest.main(verbosity=2)
