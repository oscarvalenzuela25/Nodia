import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

RUNTIME = Path(__file__).resolve().parents[1] / 'ai-runtime'


def load(name):
    spec = importlib.util.spec_from_file_location(name, RUNTIME / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


proof = load('gemini-sdk-proof')
stager = load('gemini-sdk-rollout')


class GeminiSdkIsolationTests(unittest.TestCase):
    def test_only_login_uses_the_loopback_network_and_neither_mounts_cli_state(self):
        stage = Path('/var/lib/nodia-gemini/cv-sdk-auth-fixture')
        image = 'sha256:' + 'a' * 64
        for action, network in (('login', '--network=host'), ('observe', '--network=bridge')):
            with self.subTest(action=action):
                command = stager.sdk_arguments(image, 'fixture-' + action, stage, proof, action)
                self.assertIn(network, command)
                self.assertIn('--log-driver=none', command)
                self.assertIn('--read-only', command)
                self.assertEqual(command.count('--mount'), 1)
                self.assertEqual(command[command.index('--mount') + 1], f'type=bind,src={stage},dst=/profile')
                self.assertIn('--' + action, command)
                self.assertNotIn('--execute', command)
                self.assertNotIn('--env-file', command)
                self.assertIn('-i', command[command.index(image) + 1:])

    def test_staged_observation_rejects_a_missing_model_before_publication(self):
        prepared = {'image_id': 'sha256:' + 'a' * 64, 'source_tree_sha': 'b' * 40}
        row = {'contract': 'teacher-sdk-host/1', 'event': 'observation', 'generative': False,
               'assets_hash': proof.MANIFEST_SHA256, 'authenticated': True, 'effort_serializable': True,
               'model_present': False}
        attempt = SimpleNamespace(returncode=0, stdout=json.dumps(row).encode())
        preparer = SimpleNamespace(command=MagicMock(return_value='c' * 64))
        with patch.object(stager, 'write_once'), patch.object(stager, 'closed_login', return_value=0), \
                patch.object(stager.subprocess, 'run', return_value=attempt) as run:
            with self.assertRaisesRegex(ValueError, 'gemini_cv_staged_model_unavailable'):
                stager.preflight_selection(preparer, prepared, Path('/attempt'), Path('/stage'), proof,
                                           'exact-model', 'high', 'private-epoch')
        self.assertEqual(json.loads(run.call_args.kwargs['input']),
                         {'contract': 'teacher-sdk-host/1', 'model_id': 'exact-model', 'effort_id': 'high'})


class GeminiCvProofTests(unittest.TestCase):
    runtime = {'schema_version': 1, 'image_id': 'sha256:' + 'a' * 64,
               'source_sha': 'b' * 40, 'source_tree_sha': 'c' * 40}
    material = {'runtime_hash': 'd' * 64, 'policy_hash': 'e' * 64, 'binary_sha512': 'f' * 128,
                'adapter_entry_hash': 'a' * 64}
    generation = {'container_id': 'd' * 64, 'pid': 123, 'started_at': '2026-11-25T12:00:00Z',
                  'image_id': runtime['image_id'], 'running': True}
    epoch = 'b' * 64

    def capture(self):
        with patch.object(proof, 'generation', return_value=self.generation), \
                patch.object(proof, 'profile_epoch', return_value=self.epoch), \
                patch.object(proof, 'runtime_material', return_value=self.material), \
                patch.object(proof, 'observe_selection', return_value=self.material) as observe:
            captured = proof.capture_attestation(self.runtime, 'exact-model', 'high')
            observe.assert_called_once_with(self.runtime, 'exact-model', 'high')
        return captured

    def verify(self, generation, material, epoch):
        raw = json.dumps(self.capture()).encode()
        with patch.object(proof, 'RECORD', MagicMock()), patch.object(proof, 'protected_file', return_value=raw), \
                patch.object(proof, 'generation', return_value=generation), \
                patch.object(proof, 'profile_epoch', return_value=epoch), \
                patch.object(proof, 'runtime_material', return_value=material):
            return proof.cv_sdk_attestation(self.runtime)

    def test_receipt_requires_the_same_backend_generation_and_sdk_material(self):
        receipt = self.verify(self.generation, self.material, self.epoch)
        self.assertEqual(receipt, {**self.runtime, 'manifest_sha256': proof.MANIFEST_SHA256,
                                   'runtime_hash': self.material['runtime_hash'], 'policy_hash': self.material['policy_hash']})
        with self.assertRaisesRegex(ValueError, 'gemini_cv_attestation_generation_changed'):
            self.verify({**self.generation, 'pid': 321}, self.material, self.epoch)
        with self.assertRaisesRegex(ValueError, 'gemini_cv_attestation_generation_changed'):
            self.verify(self.generation, self.material, 'c' * 64)
        with self.assertRaisesRegex(ValueError, 'gemini_cv_attestation_material_changed'):
            self.verify(self.generation, {**self.material, 'adapter_entry_hash': 'b' * 64}, self.epoch)


if __name__ == '__main__':
    unittest.main()
