"""Codex CV host preparation and production consumer proof."""

from copy import deepcopy
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


BASE = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, BASE / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


updater = load('codex_cv_updater', 'update-backend.py')
policy = load('codex_cv_policy', 'backend_update.py')
operator = load('codex_cv_operator', 'ai-runtime/prepare-codex-cv-runtime.py')


def consumers(attach_cv=True):
    hashes = {**updater.AI_RUNTIME_HASHES,
              updater.TEACHER_RUNTIME_NAME: hashlib.sha256(updater.TEACHER_RUNTIME_TEMPLATE).hexdigest()}
    value = {'schema_version': 1, 'purpose': 'nodia_ai_runtime_consumers',
             'teacher_host': {'environment_sha256': 'a' * 64, 'binary_sha512': 'b' * 128}}
    if attach_cv:
        value['codex_cv_runtime'] = dict(operator.SOURCES)
        hashes[updater.CODEX_CV_RUNTIME_NAME] = hashlib.sha256(updater.CODEX_CV_RUNTIME_TEMPLATE).hexdigest()
    value['units'] = {unit: dict(hashes) for unit in updater.SERVICES}
    return value


class CodexCvRegistryTests(unittest.TestCase):
    def test_registry_requires_exact_attestation_and_dropins_on_both_consumers(self):
        original = consumers()
        self.assertEqual(updater.ai_runtime_registry(original), original)
        self.assertEqual(updater.ai_runtime_registry(consumers(False)), consumers(False))
        for mutate in (
                lambda value: value.update(codex_cv_runtime=False),
                lambda value: value['codex_cv_runtime'].update(schema_version=True),
                lambda value: value['codex_cv_runtime'].update(manifest_sha256='1' * 63),
                lambda value: value['codex_cv_runtime'].update(source_tree_sha='1' * 39),
                lambda value: value['codex_cv_runtime'].update(path='/bin/sh'),
                lambda value: value['units']['nodia-api.service'].pop(updater.CODEX_CV_RUNTIME_NAME),
                lambda value: value['units']['nodia-ai-worker.service'].update(
                    {updater.CODEX_CV_RUNTIME_NAME: '2' * 64}),
                lambda value: value['units']['nodia-api.service'].pop(updater.TEACHER_RUNTIME_NAME),
                lambda value: value.pop('codex_cv_runtime')):
            with self.subTest(mutation=mutate):
                invalid = deepcopy(original)
                mutate(invalid)
                with self.assertRaisesRegex(ValueError, 'runtime_(attestation|registry)_invalid'):
                    updater.ai_runtime_registry(invalid)

    def test_rollback_restores_exact_previous_registry_and_rejects_teacher_drift(self):
        prior = operator.encoded(consumers(False))
        reader = SimpleNamespace(read_regular=Mock(return_value=prior))
        active = consumers()
        self.assertEqual(operator.normalized_previous(updater, reader, Path('/activated'), active), prior)
        active['teacher_host']['binary_sha512'] = 'f' * 128
        with self.assertRaisesRegex(ValueError, 'codex_cv_previous_registry_changed'):
            operator.normalized_previous(updater, reader, Path('/activated'), active)


class CodexCvArtifactTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.binary = b'\x7fELF\x02\x01\x01' + bytes(11) + b'\x3e\x00' + b'synthetic-fixture'
        checksum = hashlib.sha256(self.binary).hexdigest()
        self.artifact = self.root / ('nodia-cv-codex-host-' + checksum[:16])
        self.artifact.write_bytes(self.binary)
        self.manifest = self.artifact.with_suffix('.manifest.json')
        self.record = {'schema': 'nodia-cv-codex-host-artifact/1', 'capabilities': operator.CAPABILITIES,
                       'source': {'codex_commit': operator.CAPABILITIES['source_commit'],
                                  'codex_release_tag': 'rust-v0.161.0',
                                  'sdk_model_metadata_release': operator.VERSION},
                       'artifact': {'filename': self.artifact.name, 'architecture': 'linux-x86_64',
                                    'cargo_profile': 'release', 'stripped': True, 'maximum_glibc_symbol': '2.34',
                                    'bytes': len(self.binary), 'sha256': checksum,
                                    'sha512': hashlib.sha512(self.binary).hexdigest()}}

    def write_manifest(self):
        raw = operator.encoded(self.record)
        self.manifest.write_bytes(raw)
        return raw, {**operator.SOURCES, 'binary_sha512': self.record['artifact']['sha512'],
                     'manifest_sha256': hashlib.sha256(raw).hexdigest()}

    @unittest.skipUnless(hasattr(os, 'O_NOFOLLOW'), 'real Linux artifact open constraints required')
    def test_manifest_pin_bytes_and_reviewed_source_are_independent_checks(self):
        raw, proof = self.write_manifest()
        with patch.object(operator, 'SOURCES', proof):
            with self.assertRaisesRegex(ValueError, 'codex_cv_reviewed_manifest_required'):
                operator.checked_manifest(updater, self.manifest, self.artifact, '0' * 64)
            self.assertEqual(operator.checked_manifest(updater, self.manifest, self.artifact,
                             proof['manifest_sha256']), (raw, self.record['artifact']))
            self.manifest.write_bytes(raw + b' ')
            with self.assertRaisesRegex(ValueError, 'codex_cv_manifest_digest_mismatch'):
                operator.checked_manifest(updater, self.manifest, self.artifact, proof['manifest_sha256'])
        self.record['source']['codex_commit'] = '0' * 40
        _, proof = self.write_manifest()
        with patch.object(operator, 'SOURCES', proof):
            with self.assertRaisesRegex(ValueError, 'codex_cv_manifest_source_invalid'):
                operator.checked_manifest(updater, self.manifest, self.artifact, proof['manifest_sha256'])

    @unittest.skipUnless(hasattr(os, 'O_NOFOLLOW'), 'real Linux artifact open constraints required')
    def test_tampered_binary_does_not_create_immutable_executable_or_manifest(self):
        raw, proof = self.write_manifest()
        self.artifact.write_bytes(self.binary[:-1] + b'Z')
        target = self.root / 'verified' / 'host'
        filesystem = SimpleNamespace(make_directory=lambda path: path.mkdir(), install_file=Mock())
        with patch.object(operator, 'SOURCES', proof), patch.object(updater, 'codex_cv_host_path', return_value=target):
            with self.assertRaisesRegex(ValueError, 'codex_cv_artifact_digest_mismatch'):
                operator.install_artifact(filesystem, updater, self.artifact, raw, self.record['artifact'])
        self.assertEqual(list(target.parent.iterdir()), [])
        filesystem.install_file.assert_not_called()

    def test_live_descriptor_detects_each_of_three_bound_files_changing(self):
        raw, proof = self.write_manifest()
        root = self.root / 'installed'
        root.mkdir()
        active = root / 'active.json'
        environment = root / 'runtime.env'
        with (patch.object(updater, 'CODEX_CV_ROOT', root), patch.object(updater, 'CODEX_CV_ACTIVE', active),
              patch.object(updater, 'CODEX_CV_ENVIRONMENT', environment),
              patch.object(updater, 'protected', side_effect=lambda path, **_: path.stat())):
            target = updater.codex_cv_host_path(proof)
            manifest = target.with_suffix('.manifest.json')
            active.write_bytes(operator.encoded(proof))
            correct = ((environment, updater.codex_cv_environment_bytes(proof), 'environment'),
                       (manifest, raw, 'manifest'), (target, self.binary, 'binary'))
            for path, contents, _ in correct:
                path.write_bytes(contents)
            self.assertEqual(updater.codex_cv_runtime_descriptor(), proof)
            for path, contents, code in correct:
                path.write_bytes(contents + b' ')
                with self.subTest(code=code), self.assertRaisesRegex(ValueError, f'codex_cv_runtime_{code}_changed'):
                    updater.codex_cv_runtime_descriptor()
                path.write_bytes(contents)


class CodexCvLifecycleTests(unittest.TestCase):
    def test_prepared_attestation_rejects_a_different_full_source_tree(self):
        altered = {**operator.SOURCES, 'source_tree_sha': '1' * 40}
        reader = SimpleNamespace(read_regular=Mock(return_value=operator.encoded({
            'codex_cv_runtime': altered,
            'offline_selection': {'model_id': 'verified-model', 'effort_id': 'high'},
        })))
        with self.assertRaisesRegex(ValueError, 'codex_cv_prepared_receipt_invalid'):
            operator.staged(updater, reader)

    def test_attestation_is_absent_only_when_no_cv_files_exist(self):
        host = updater.Host(policy, None, {})
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            active = root / 'active.json'
            with (patch.object(updater, 'registered_ai_runtimes', return_value=(consumers(False), 'old')),
                  patch.object(updater, 'CODEX_CV_ACTIVE', active),
                  patch.object(updater, 'CODEX_CV_ENVIRONMENT', root / 'runtime.env'),
                  patch.object(updater, 'SYSTEMD_UNITS', root)):
                self.assertIsNone(host.codex_cv_attestation(root))
                active.touch()
                with self.assertRaisesRegex(policy.Rejected, 'codex_cv_runtime_partial'):
                    host.codex_cv_attestation(root)

    def test_live_process_requires_all_three_exact_pins_once(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            process = root / '123'
            process.mkdir()
            environ = process / 'environ'
            pins = updater.codex_cv_environment_bytes(operator.SOURCES)
            inherited = b'OTHER_VARIABLE=other-value\0'
            valid = inherited + pins.replace(b'\n', b'\0')
            with patch.object(updater, 'Path', return_value=root):
                environ.write_bytes(valid)
                updater.codex_cv_process_environment('123', pins)
                for invalid in (valid + pins.splitlines()[0] + b'\0',
                                inherited, valid.replace(operator.SOURCES['binary_sha512'].encode(), b'wrong')):
                    environ.write_bytes(invalid)
                    with self.assertRaisesRegex(ValueError, 'codex_cv_consumer_environment_changed'):
                        updater.codex_cv_process_environment('123', pins)

    def test_runtime_catalog_requires_unambiguous_exact_model_and_effort(self):
        row = {'slug': 'verified-model', 'supported_reasoning_levels': [{'effort': 'high'}]}
        self.assertEqual(updater.unique_json(operator.exact_model_metadata({'models': [row]},
                          'verified-model', 'high')), row)
        for model, effort, catalog, expected in (
                ('verified', 'high', {'models': [row]}, 'model_unavailable'),
                ('verified-model', 'high', {'models': [row, row]}, 'model_unavailable'),
                ('verified-model', 'medium', {'models': [row]}, 'effort_unavailable')):
            with self.subTest(model=model, effort=effort), self.assertRaisesRegex(ValueError, expected):
                operator.exact_model_metadata(catalog, model, effort)

    def test_stopped_quiescence_failure_records_phase_before_writing_consumer_config(self):
        self.exercise_quiescence_failure(remove=False)
        self.exercise_quiescence_failure(remove=True)

    def exercise_quiescence_failure(self, remove):
        release = Path('/backend/releases/backend-123456789abc-123456789abc')
        prior = operator.encoded(consumers(remove))
        proof = dict(operator.SOURCES) if remove else None
        receipt = operator.encoded({'status': 'codex_cv_runtime_ready_for_cd',
                                    'codex_cv_runtime': proof, 'current_release': release.name})
        safe = SimpleNamespace(read_regular=Mock(side_effect=[prior, receipt, operator.encoded(consumers(False))]),
                               install_file=Mock())
        host = Mock()
        host.codex_cv_attestation.return_value = proof
        host.prior_updates_blocked.return_value = False
        host.require_quiescent.side_effect = [None, ValueError('runtime_not_quiescent')]
        with tempfile.TemporaryDirectory() as temporary:
            with (patch.object(operator, 'STATE', Path(temporary)),
                  patch.object(operator, 'staged', return_value={'offline_selection': {}}),
                  patch.object(updater, 'MAINTENANCE', Path(temporary) / 'no-maintenance'),
                  patch.object(updater, 'Host', return_value=host),
                  patch.object(updater, 'atomic_write') as write,
                  patch.object(updater, 'codex_cv_executable'), patch.object(updater, 'codex_cv_installed_host')):
                with self.assertRaisesRegex(ValueError, 'runtime_not_quiescent'):
                    operator.change(updater, safe, policy, Mock(), Mock(), {}, release, remove)
                host.stop_writers.assert_called_once()
                safe.install_file.assert_not_called()
                self.assertEqual([args.args[0].name for args in write.call_args_list],
                                 ['previous-registry.json', 'intent.json', 'failure.json'])
                self.assertEqual(updater.unique_json(write.call_args.args[1]), {
                    'phase': 'stop_requested', 'preserve_state': True, 'automatic_retry_allowed': False})


if __name__ == '__main__':
    unittest.main()
