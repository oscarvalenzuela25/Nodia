"""Offline synthetic harness checks: zero network/provider/DB operations."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('r02_probe_under_test', ROOT / 'docs/evidence/scripts/nodia-ai-ai32-r02-native-probe.py')
PROBE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROBE)
RESOURCE = 'gemini-profile:' + '1' * 64
SESSION = '2' * 32
BASE_OBSERVATION = {'available': True, 'reason': None, 'resource_key': RESOURCE,
    'session_generation': SESSION, 'verified_modalities': ['audio'],
    'verified_attachment_media_types': ['audio/webm'], 'supports_mcp': False}


class FakeResponse:
    status = 200

    def __init__(self, value):
        self.raw = json.dumps(value).encode('utf-8')

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, size):
        if len(self.raw) > size:
            raise AssertionError('Fixture exceeds harness response bound')
        return self.raw


class ExactFormatHarnessTests(unittest.TestCase):
    def run_synthetic(self, after):
        with tempfile.TemporaryDirectory(prefix='nodia-r02-offline-harness-') as directory:
            target = Path(directory)
            helper = target / 'helper.py'
            helper.write_text("""def configuration():
    return {'url':'https://synthetic.invalid','token':'synthetic-not-real',
        'selections':{'web':{'model_id':'synthetic-model','effort_id':None,'configuration_generation':'3333333333333333333333333333333333333333333333333333333333333333'}},
        'quiet':{'pending_jobs':0,'open_attempts':0,'held_or_unknown_slots':0}}
def fixtures(path):
    return {'audio':(b'synthetic-audio-fixture','audio/webm','La casa tiene ventanas azules.')}
""", encoding='utf-8')
            output = target / 'report.json'
            observed = 0
            generations = 0
            calls = []

            def urlopen(request, **_):
                nonlocal observed, generations
                calls.append(request.full_url)
                if request.full_url.endswith('/observe'):
                    observed += 1
                    return FakeResponse(BASE_OBSERVATION if observed == 1 else after)
                if request.full_url.endswith('/attachments/probe'):
                    generations += 1
                    body = json.loads(request.data)
                    self.assertNotIn('La casa tiene ventanas azules.', body['canonical_prompt'])
                    return FakeResponse({'reply': {'kind': 'answer', 'text': 'La casa tiene ventanas azules.'},
                        'terminal_proof': {'outcome': 'completed', 'terminal_proof_id': 'synthetic-proof'}})
                if request.full_url.endswith('/acknowledge'):
                    return FakeResponse({'acknowledged': True})
                self.fail('Unexpected transport operation: ' + request.full_url)

            args = ['synthetic-offline-test', '--live', '--historical-helper', str(helper),
                '--output', str(output), '--engine', 'web', '--kind', 'audio',
                '--synthetic-speech', str(target / 'not-read-by-fixture.webm'),
                '--synthetic-speech-text', 'La casa tiene ventanas azules.', '--audio-media', 'audio/webm']
            with patch.object(sys, 'argv', args), patch.object(PROBE.urllib.request, 'urlopen', side_effect=urlopen), \
                    patch.object(PROBE, 'diagnostics', return_value=[]), contextlib.redirect_stdout(io.StringIO()):
                PROBE.main()
            report = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(generations, 1)
            self.assertEqual(len(calls), 4)
            self.assertEqual(report['generation_requests'], 1)
            self.assertTrue(report['probe']['native_acknowledged'])
            self.assertTrue(report['probe']['semantic_canary_matches'])
            self.assertEqual(report['automatic_inference_retries'], 0)
            self.assertEqual(report['harness_sha256'], hashlib.sha256(Path(PROBE.__file__).read_bytes()).hexdigest())
            self.assertEqual(report['observation_after']['resource_key'], after.get('resource_key'))
            self.assertEqual(report['observation_after']['session_generation'], after.get('session_generation'))
            return report

    def test_exact_format_canary_completed_and_acked_succeeds(self):
        result = self.run_synthetic(dict(BASE_OBSERVATION))
        self.assertEqual(result['status'], 'passed')
        self.assertTrue(result['probe']['exact_format_verified'])

    def test_category_summary_true_does_not_promote_a_different_mime(self):
        result = self.run_synthetic({**BASE_OBSERVATION, 'verified_attachment_media_types': ['audio/wav']})
        self.assertTrue(result['probe']['cached_modality_verified'])
        self.assertFalse(result['probe']['exact_format_verified'])
        self.assertFalse(result['probe']['verified'])
        self.assertEqual(result['status'], 'gates_open')

    def test_legacy_summary_without_format_list_remains_unknown(self):
        after = dict(BASE_OBSERVATION)
        after.pop('verified_attachment_media_types')
        result = self.run_synthetic(after)
        self.assertFalse(result['probe']['exact_format_verified'])
        self.assertEqual(result['status'], 'gates_open')

    def test_another_session_or_resource_cannot_lend_its_format_proof(self):
        for change in ({'session_generation': '9' * 32}, {'resource_key': 'gemini-profile:' + '9' * 64}):
            with self.subTest(change=change):
                result = self.run_synthetic({**BASE_OBSERVATION, **change})
                self.assertFalse(result['probe']['exact_format_verified'])
                self.assertEqual(result['status'], 'gates_open')

    def test_malformed_format_list_never_proves_a_format(self):
        for formats in ('audio/webm', ['audio/webm', 'audio/webm'], [None, 'audio/webm'], None):
            with self.subTest(formats=formats):
                result = self.run_synthetic({**BASE_OBSERVATION, 'verified_attachment_media_types': formats})
                self.assertFalse(result['probe'].get('exact_format_verified', False))
                self.assertEqual(result['status'], 'gates_open')

    def test_unavailable_observation_cannot_prove_audio(self):
        result = self.run_synthetic({**BASE_OBSERVATION, 'available': False})
        self.assertFalse(result['probe']['exact_format_verified'])
        self.assertEqual(result['status'], 'gates_open')


if __name__ == '__main__':
    unittest.main(verbosity=2)
