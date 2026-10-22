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
SPEC = importlib.util.spec_from_file_location('r03_probe_under_test', ROOT / 'docs/evidence/scripts/nodia-ai-ai32-r03-native-probe.py')
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
    def run_synthetic(self, after, mode="success"):
        with tempfile.TemporaryDirectory(prefix='nodia-r03-offline-harness-') as directory:
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
            current = {}
            proof = None

            def urlopen(request, **_):
                nonlocal observed, generations, proof
                calls.append(request.full_url)
                if request.full_url.endswith('/observe'):
                    observed += 1
                    return FakeResponse(BASE_OBSERVATION if observed == 1 else after)
                if request.full_url.endswith('/attachments/probe'):
                    generations += 1
                    body = json.loads(request.data)
                    self.assertNotIn('La casa tiene ventanas azules.', body['canonical_prompt'])
                    current.update({key: body[key] for key in ('resource_key','session_generation')})
                    current['operation_ref'] = body['attempt_id']
                    proof = {**current, 'attempt_id':body['attempt_id'], 'process_closed':True,
                        'outcome':'completed', 'terminal_proof_id':'77777777-7777-4777-8777-777777777777',
                        'observed_at':'2026-10-18T04:30:00+00:00'}
                    if mode == 'bad_proof':
                        proof['resource_key'] = 'gemini-profile:'+'9'*64
                    if mode == 'timeout':
                        raise TimeoutError('private-not-for-report')
                    return FakeResponse({'reply': {'kind': 'answer', 'text': 'La casa tiene ventanas azules.'},
                        'terminal_proof': proof})
                if request.full_url.endswith('/reconcile'):
                    return FakeResponse(proof)
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
            self.assertEqual(len(calls), 5 if mode == "timeout" else 4)
            self.assertEqual(report['generation_requests'], 1)
            self.assertEqual(report['probe']['native_acknowledged'], mode != 'bad_proof')
            self.assertEqual(report['probe'].get('semantic_canary_matches', False), mode != 'timeout')
            self.assertNotIn('private-not-for-report', output.read_text(encoding='utf-8'))
            self.assertEqual(report['automatic_inference_retries'], 0)
            self.assertEqual(report['harness_sha256'], hashlib.sha256(Path(PROBE.__file__).read_bytes()).hexdigest())
            self.assertEqual(report['observation_after']['resource_key'], after.get('resource_key'))
            self.assertEqual(report['observation_after']['session_generation'], after.get('session_generation'))
            return report

    def test_timeout_reconciles_without_replay(self):
        result = self.run_synthetic(dict(BASE_OBSERVATION), 'timeout')
        self.assertEqual(result['status'], 'gates_open')
        self.assertTrue(result['probe']['native_acknowledged'])

    def test_foreign_proof_cannot_be_acknowledged(self):
        result = self.run_synthetic(dict(BASE_OBSERVATION), 'bad_proof')
        self.assertEqual(result['status'], 'gates_open')
        self.assertFalse(result['probe']['native_acknowledged'])

    def test_structured_projection_never_exports_unknown_strings(self):
        digest = 'a'*64
        projected = PROBE.project_structured_text({'applied':True, 'last_equal':True,
            'candidate_checks':1, 'protected_ampersands_total':2,
            'unprotected_html_would_change_outputs':1, 'secret':'do-not-export',
            'last_source':{'text_bytes':0,'sha256':digest,'json_parseable':True, 'text':'do-not-export'},
            'last_output':{'text_bytes':1,'sha256':'do-not-export','json_parseable':True}})
        self.assertNotIn('do-not-export', json.dumps(projected))
        self.assertEqual(projected['last_source']['text_bytes'], 0)
        self.assertNotIn('last_output', projected)
        self.assertEqual(PROBE.project_structured_text(None), None)

    def test_success_and_failure_diagnostics_only_project_safe_fields(self):
        from types import SimpleNamespace
        attempt = '77777777-7777-4777-8777-777777777777'
        structured = {'applied':True, 'last_equal':True, 'candidate_checks':1,
            'protected_ampersands_total':3, 'unprotected_html_would_change_outputs':1,
            'last_source':{'text_bytes':42,'sha256':'a'*64,'json_parseable':True},
            'last_output':{'text_bytes':42,'sha256':'a'*64,'json_parseable':True}, 'raw':'private-marker'}
        entries = [
            'prefix nodia_ai_web_success '+json.dumps({'attempt_id':attempt, 'web_generation':{'structured_text':structured}, 'raw':'private-marker'}),
            'prefix nodia_ai_chat_failure '+json.dumps({'attempt_id':attempt, 'engine':'web', 'phase':'reply_validation', 'web_generation':{'structured_text':structured}}),
            'prefix nodia_ai_web_success '+json.dumps({'attempt_id':'other', 'raw':'private-marker'})]
        with patch.object(PROBE.subprocess, 'run', return_value=SimpleNamespace(returncode=0,stdout='\n'.join(entries),stderr='')):
            result = PROBE.diagnostics(attempt)
        self.assertEqual(len(result), 2)
        self.assertEqual([item['event'] for item in result], ['web_success','chat_failure'])
        self.assertTrue(result[0]['generation']['structured_text']['last_equal'])
        self.assertNotIn('private-marker', json.dumps(result))

    def test_upload_and_pacing_projection_excludes_identifiers_and_invalid_types(self):
        value = PROBE.project_uploads({'requests':1,'roundtrips_completed':1,'failed':0,
            'cancelled':False, 'sink_errors':0,'metadata_errors':0,'private':'secret-marker',
            'records':[{'ordinal':1,'started_elapsed_ms':0,'completed_elapsed_ms':2,'duration_ms':2,
                'outcome':'http_completed','http_status':200,'reference_chars':99,
                'reference_nonempty':True,'reference_prefix_matches':True,
                'reference':'secret-marker','filename':'secret-marker','url':'secret-marker'}]})
        self.assertNotIn('secret-marker',json.dumps(value))
        self.assertNotIn('cancelled',value)
        self.assertEqual(value['failed'],0)
        self.assertEqual(value['records'][0]['started_elapsed_ms'],0)
        self.assertEqual(PROBE.project_uploads(None),None)
        self.assertNotIn('records',PROBE.project_uploads({'records':[{}]*5}))
        pacing = PROBE.project_body_pacing({'first_chunk_elapsed_ms':0,'last_chunk_elapsed_ms':None,
            'max_inter_chunk_gap_ms':True,'raw':'secret-marker'})
        self.assertEqual(pacing,{'first_chunk_elapsed_ms':0,'last_chunk_elapsed_ms':None})

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
