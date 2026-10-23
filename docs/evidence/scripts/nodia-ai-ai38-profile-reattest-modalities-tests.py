"""Offline controls for the successor cohort; no VM, SQL or provider access."""
from contextlib import redirect_stdout
import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name('nodia-ai-ai38-profile-reattest-modalities-r01.py')
spec = importlib.util.spec_from_file_location('ai38_profile_modalities', SCRIPT)
cohort = importlib.util.module_from_spec(spec)
with patch('subprocess.run', side_effect=AssertionError('Import cannot operate')):
    spec.loader.exec_module(cohort)


class CohortControlsTests(unittest.TestCase):
    def setUp(self):
        self.binding = {'selection': {'connection_id': '2', 'mode': 'token_plan_agentic',
                                     'model_id': 'synthetic-discovered-model', 'effort_id': 'synthetic-effort'},
                        'configuration_generation': 'a' * 64, 'session_generation': 'b' * 32,
                        'resource_key': 'gemini-profile:' + 'c' * 64}
        self.native = {'status': 'passed', 'diagnostic_nonce_verified': True,
                       'native_terminal_proof_acknowledged': True, 'supports_mcp_after': True,
                       'configured_database_read_only': True, 'configured_database_modified': False,
                       'configured_selection_modified': False, 'inference_replayed': False,
                       'real_provider_dispatch_requests': 1, 'maximum_provider_dispatch_requests': 1,
                       'native_pending_identity': False, 'diagnostics': {
                           **{key: self.binding[key] for key in ('selection', 'configuration_generation', 'session_generation')},
                           'attempt_id': '12345678-1234-1234-1234-123456789012'}}
        self.report = {'status': 'passed', 'native_result': self.native}
        self.capture = {'input_report_sha256': 'd' * 64,
                        'attempt_id': self.native['diagnostics']['attempt_id'], 'same_container_epoch_after_capture': True}
        self.case = {'status': 'passed', 'native_pending_identity': False, 'native_acknowledged': True,
                     'native_outcome': 'completed', 'generation_requests': 1, 'maximum_generations': 1,
                     'inference_replayed': False, 'kind': 'image', 'media_type': 'image/png',
                     'semantic_match': True, 'exact_format_verified_after': True, **self.binding}

    def test_fresh_MCP_nonce_ACK_selection_and_capture_bind_exactly(self):
        result = cohort.qualify(self.report, self.capture, 'd' * 64)
        self.assertEqual(result, {key: self.binding[key] for key in ('selection', 'configuration_generation', 'session_generation')})
        for key in ('diagnostic_nonce_verified', 'native_terminal_proof_acknowledged', 'supports_mcp_after'):
            wrong = copy.deepcopy(self.report)
            wrong['native_result'][key] = False
            with self.subTest(key=key), self.assertRaises(cohort.ControlError):
                cohort.qualify(wrong, self.capture, 'd' * 64)

    def test_old_capture_wrong_attempt_wrong_connection_or_pending_MCP_rejected(self):
        for key, value in (('input_report_sha256', 'e' * 64), ('attempt_id', 'other'), ('same_container_epoch_after_capture', False)):
            with self.subTest(capture=key), self.assertRaises(cohort.ControlError):
                cohort.qualify(self.report, {**self.capture, key: value}, 'd' * 64)
        wrong = copy.deepcopy(self.report)
        wrong['native_result']['diagnostics']['selection']['connection_id'] = '3'
        with self.assertRaises(cohort.ControlError):
            cohort.qualify(wrong, self.capture, 'd' * 64)
        wrong = copy.deepcopy(self.report)
        wrong['native_result']['native_pending_identity'] = True
        with self.assertRaises(cohort.ControlError):
            cohort.qualify(wrong, self.capture, 'd' * 64)

    def test_unknown_abandoned_unacknowledged_or_replayed_format_stops_cohort(self):
        cohort.check_case(self.case, self.binding, 'png')
        for key, value in (('native_pending_identity', True), ('native_acknowledged', False),
                           ('native_outcome', 'abandoned_unknown'), ('generation_requests', 2),
                           ('generation_requests', True), ('inference_replayed', True)):
            with self.subTest(key=key, value=value), self.assertRaises(cohort.ControlError):
                cohort.check_case({**self.case, key: value}, self.binding, 'png')

    def test_semantic_failure_wrong_exact_format_or_selection_never_grants_acceptance(self):
        for key, value in (('semantic_match', False), ('exact_format_verified_after', False),
                           ('status', 'gates_open'), ('media_type', 'application/pdf'),
                           ('session_generation', 'e' * 32), ('configuration_generation', 'f' * 64)):
            with self.subTest(key=key), self.assertRaises(cohort.ControlError):
                cohort.check_case({**self.case, key: value}, self.binding, 'png')

    def test_Web_false_or_unknown_skips_Web_without_fabricating_available(self):
        for available in (False, None):
            gates = {'agentic': {'available': True}, 'web': {'available': available}}
            self.assertEqual(cohort.available_modes(gates), ['agentic'])
            self.assertIs(gates['web']['available'], available)
        self.assertEqual(cohort.available_modes({'agentic': {'available': True}, 'web': {'available': True}}), ['agentic', 'web'])
        for available in (False, None, 'true'):
            with self.subTest(agentic=available), self.assertRaises(cohort.ControlError):
                cohort.available_modes({'agentic': {'available': available}, 'web': {'available': True}})

    def test_SQL_activity_or_wrong_identity_cannot_start_probe(self):
        value = {'connection_id': '2', 'provider_key': 'gemini', 'selections': {},
                 'quiet': {'jobs': 0, 'attempts': 0, 'slots': 0}, 'mode_fields_sha256': 'e' * 64, 'updated_at': 'synthetic'}
        cohort.configuration(value)
        for changed in ({'connection_id': '3'}, {'provider_key': 'other'}, {'quiet': {'jobs': 1, 'attempts': 0, 'slots': 0}}):
            with self.subTest(changed=changed), self.assertRaises(cohort.ControlError):
                cohort.configuration({**value, **changed})

    def test_preflight_files_is_inert_even_with_eight_canary_code_present(self):
        # Tiny local fixture checks only file controls, never audio semantics.
        root = SCRIPT.parents[3]
        packet = root / '.tmp/ai38-node-candidate01/nodia-server'
        helper = SCRIPT.with_name('nodia-ai-ai38-verifications-modalities.py')
        with tempfile.TemporaryDirectory() as temporary:
            wav, webm = Path(temporary) / 'synthetic.wav', Path(temporary) / 'synthetic.webm'
            wav.write_bytes(b'RIFFsynthetic_test_header_only')
            webm.write_bytes(b'\x1aE\xdf\xa3synthetic_test_header_only')
            argv = [str(SCRIPT), '--helper', str(helper), '--packet', str(packet), '--wav', str(wav),
                    '--wav-sha', cohort.sha(wav), '--webm', str(webm), '--webm-sha', cohort.sha(webm), '--preflight-files']
            output = io.StringIO()
            with patch('sys.argv', argv), patch.object(cohort.subprocess, 'run', side_effect=AssertionError('No subprocess in preflight')), redirect_stdout(output):
                self.assertEqual(cohort.main(), 0)
            value = json.loads(output.getvalue())
            self.assertEqual(value['provider_calls'], 0)
            self.assertEqual(value['SQL_calls'], 0)
            self.assertFalse(value['proofs_restored'])

    def test_packet_escape_and_tampered_file_rejected_before_any_process(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'safe.js').write_text('synthetic')
            manifest = root / 'manifest.json'
            manifest.write_text(json.dumps({'files': {'safe.js': cohort.sha(root / 'safe.js')}}))
            with patch.object(cohort, 'PACKET_SHA', cohort.sha(manifest)):
                self.assertEqual(cohort.verify_packet(root), 1)
                (root / 'safe.js').write_text('modified')
                with self.assertRaises(cohort.ControlError):
                    cohort.verify_packet(root)
            manifest.write_text(json.dumps({'files': {'../escape.js': 'a' * 64}}))
            with patch.object(cohort, 'PACKET_SHA', cohort.sha(manifest)), self.assertRaises(cohort.ControlError):
                cohort.verify_packet(root)


if __name__ == '__main__':
    unittest.main()
