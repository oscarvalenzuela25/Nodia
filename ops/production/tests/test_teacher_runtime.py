"""Pinned Teacher artifact/activation rules, without accounts or native execution."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

BASE = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


operator = load('teacher_runtime_operator', BASE / 'ai-runtime/prepare-teacher-runtime.py')
updater = load('teacher_runtime_updater', BASE / 'update-backend.py')


class TeacherArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        content = b'Synthetic native artifact. Never executed.\n'
        checksum = hashlib.sha256(content).hexdigest()
        self.artifact = self.root / ('nodia-teacher-codex-host-' + checksum[:16])
        self.artifact.write_bytes(content)
        self.manifest = self.root / 'manifest.json'
        self.value = {'schema': 'nodia-teacher-codex-host-artifact/1',
            'source': {'codex_commit': operator.COMMIT, 'codex_release_tag': 'rust-v0.161.0'},
            'capabilities': dict(operator.CAPABILITIES),
            'artifact': {'filename': self.artifact.name, 'bytes': len(content), 'sha256': checksum,
                         'architecture': 'linux-x86_64', 'maximum_glibc_symbol': '2.36',
                         'cargo_profile': 'release', 'stripped': True}}

    def write_manifest(self):
        self.manifest.write_bytes((json.dumps(self.value) + '\n').encode())
        return hashlib.sha256(self.manifest.read_bytes()).hexdigest()

    def test_exact_release_artifact_is_bound_without_executing_or_reading_a_profile(self):
        expected = self.write_manifest()
        with patch.object(operator.subprocess, 'run') as execute:
            result = operator.validate_artifact(self.manifest, self.artifact, expected)
        self.assertEqual(result['binary_sha512'], hashlib.sha512(self.artifact.read_bytes()).hexdigest())
        execute.assert_not_called()

    def test_mutated_manifest_or_binary_cannot_be_reused(self):
        expected = self.write_manifest()
        self.manifest.write_bytes(self.manifest.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'manifest_digest_mismatch'):
            operator.validate_artifact(self.manifest, self.artifact, expected)
        expected = self.write_manifest()
        self.artifact.write_bytes(b'X' * self.artifact.stat().st_size)
        with self.assertRaisesRegex(ValueError, 'artifact_digest_mismatch'):
            operator.validate_artifact(self.manifest, self.artifact, expected)

    def test_wrong_source_abi_debug_build_or_tools_are_rejected_before_execution(self):
        original = json.loads(json.dumps(self.value))
        mutations = [
            lambda v: v['source'].update(codex_commit='a' * 40),
            lambda v: v['artifact'].update(maximum_glibc_symbol='2.41'),
            lambda v: v['artifact'].update(cargo_profile='dev'),
            lambda v: v['artifact'].update(architecture='linux-arm64'),
            lambda v: v['artifact'].update(filename='../host'),
            lambda v: v['capabilities'].update(tools=['shell']),
            lambda v: v['capabilities'].update(retries=1),
        ]
        for mutation in mutations:
            self.value = json.loads(json.dumps(original))
            mutation(self.value)
            expected = self.write_manifest()
            with self.subTest(value=self.value), self.assertRaises(ValueError):
                operator.validate_artifact(self.manifest, self.artifact, expected)

    def test_environment_contains_only_exact_host_and_hash_without_shell_or_config_injection(self):
        raw = operator.environment_bytes('a' * 128)
        self.assertEqual(raw.count(b'\n'), 2)
        self.assertIn(b'host-' + b'a' * 128 + b'\n', raw)
        for value in ['a' * 127, 'a' * 128 + '\nJWT_SECRET=invalid', '../host']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                operator.environment_bytes(value)

    def test_activation_requires_stopped_consumers_and_empty_sql_before_mutation(self):
        receipt = {'binary_sha512': 'a' * 128, 'manifest_sha256': 'b' * 64}
        safe = SimpleNamespace(read_regular=Mock(side_effect=[json.dumps(receipt).encode(), operator.environment_bytes('a' * 128)]),
            checked=Mock(return_value=True), install_file=Mock())
        activation = SimpleNamespace(preflight=Mock())
        with patch.object(operator, 'digest', return_value='a' * 128), patch.object(operator, 'command', return_value=b'ActiveState=active\nMainPID=123\n'):
            with self.assertRaisesRegex(ValueError, 'consumers_must_be_drained_and_stopped'):
                operator.activate(safe, updater, activation)
        safe.install_file.assert_not_called()
        activation.preflight.assert_not_called()
        safe.read_regular.side_effect = [json.dumps(receipt).encode(), operator.environment_bytes('a' * 128)]
        activation.preflight.side_effect = ValueError('runtime_not_quiescent')
        with patch.object(operator, 'digest', return_value='a' * 128), patch.object(operator, 'command', return_value=b'ActiveState=inactive\nMainPID=0\n'):
            with self.assertRaisesRegex(ValueError, 'runtime_not_quiescent'):
                operator.activate(safe, updater, activation)
        safe.install_file.assert_not_called()


class TeacherRegistryTests(unittest.TestCase):
    @unittest.skipUnless(hasattr(os, 'O_NOFOLLOW'), 'registration module uses the Linux lock contract')
    def test_old_updater_reports_compatibility_before_accessing_teacher_attributes(self):
        registration = load('teacher_runtime_registration', BASE / 'ai-runtime/register-consumers.py')
        old = SimpleNamespace(AI_RUNTIME_HASHES={}, unique_json=json.loads)
        safe = SimpleNamespace(read_regular=Mock(return_value=b'{}'))
        with patch.object(registration.os, 'geteuid', return_value=0), patch.object(registration, 'load', side_effect=[old, safe]):
            with self.assertRaisesRegex(RuntimeError, 'compatible_updater_required'):
                registration.register()

    def registry(self):
        hashes = {**updater.AI_RUNTIME_HASHES,
                  updater.TEACHER_RUNTIME_NAME: hashlib.sha256(updater.TEACHER_RUNTIME_TEMPLATE).hexdigest()}
        return {'schema_version': 1, 'purpose': 'nodia_ai_runtime_consumers',
            'units': {name: dict(hashes) for name in updater.SERVICES},
            'teacher_host': {'environment_sha256': 'a' * 64, 'binary_sha512': 'b' * 128}}

    def test_optional_host_requires_both_exact_consumers_and_both_pins(self):
        original = self.registry()
        self.assertEqual(updater.ai_runtime_registry(original), original)
        mutations = [
            lambda v: v['units']['nodia-api.service'].pop(updater.TEACHER_RUNTIME_NAME),
            lambda v: v.pop('teacher_host'),
            lambda v: v['teacher_host'].update(environment_sha256='invalid'),
            lambda v: v['teacher_host'].update(binary_sha512='b' * 64),
            lambda v: v['teacher_host'].update(secret='forbidden'),
        ]
        for mutation in mutations:
            value = json.loads(json.dumps(original))
            mutation(value)
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'ai_runtime_registry_invalid'):
                updater.ai_runtime_registry(value)


if __name__ == '__main__':
    unittest.main(verbosity=2)
