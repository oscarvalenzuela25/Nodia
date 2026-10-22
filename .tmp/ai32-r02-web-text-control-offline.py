"""Offline text-control transport simulation: zero provider/DB/network calls."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('text_control', ROOT / 'docs/evidence/scripts/nodia-ai-ai32-r02-web-text-control.py')
CONTROL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONTROL)
RESOURCE, SESSION = 'gemini-profile:' + '1' * 64, '2' * 32


class Response:
    status = 200

    def __init__(self, value):
        self.raw = json.dumps(value).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, limit):
        assert len(self.raw) < limit
        return self.raw


class ControlTests(unittest.TestCase):
    def simulate(self, mode='success'):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            helper = target / 'helper.py'
            helper.write_text("def configuration():\n return {'url':'https://synthetic.invalid','token':'fake','selections':{'web':{'model_id':'fixture-model','effort_id':None,'configuration_generation':'" + '3' * 64 + "'}},'quiet':{'pending_jobs':0}}\n", encoding='utf-8')
            native = target / 'native.py'
            native.write_text('def diagnostics(attempt):\n return []\n', encoding='utf-8')
            output = target / 'output.json'
            calls, generated, current, last_proof = [], [], {}, None

            def post(request, **_):
                nonlocal last_proof
                route = request.full_url
                payload = json.loads(request.data)
                calls.append(route)
                if route.endswith('/observe'):
                    return Response({'available': True, 'resource_key': RESOURCE,
                        'session_generation': '9' * 32 if mode == 'changed_session' and generated else SESSION})
                if route.endswith('/turn'):
                    self.assertNotIn('attachments', payload)
                    self.assertNotIn('tools', payload)
                    generated.append(payload)
                    current.update({key: payload[key] for key in ('resource_key', 'session_generation')})
                    current['operation_ref'] = payload['attempt_id']
                    last_proof = {**current, 'attempt_id': payload['attempt_id'], 'process_closed': True,
                        'outcome': 'completed', 'terminal_proof_id': '77777777-7777-4777-8777-777777777777',
                        'observed_at': '2026-10-18T04:30:00+00:00'}
                    if mode == 'timeout':
                        raise TimeoutError('must never be copied to report')
                    nonce = payload['canonical_prompt'].split('"text":"', 1)[1].split('"', 1)[0]
                    proof = {**last_proof, 'resource_key': 'gemini-profile:' + '9' * 64} if mode == 'bad_proof' else last_proof
                    return Response({'reply': {'kind': 'answer', 'text': 'wrong' if mode == 'wrong' else nonce}, 'terminal_proof': proof})
                if route.endswith('/reconcile'):
                    self.assertEqual(payload, current)
                    return Response({**last_proof, 'resource_key': 'gemini-profile:' + '9' * 64} if mode == 'bad_proof' else last_proof)
                if route.endswith('/acknowledge'):
                    self.assertNotEqual(mode, 'bad_proof')
                    self.assertEqual(payload['operation_ref'], generated[0]['attempt_id'])
                    return Response({'acknowledged': True})
                self.fail('unexpected operation')

            args = ['fixture', '--live', '--historical-helper', str(helper), '--native-harness', str(native), '--output', str(output)]
            with patch.object(sys, 'argv', args), patch.object(CONTROL.urllib.request, 'urlopen', side_effect=post), contextlib.redirect_stdout(io.StringIO()):
                CONTROL.main()
            result = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(len(generated), 1)
            self.assertEqual(result['generation_requests'], 1)
            self.assertFalse(result['attachment_modalities_proved'])
            self.assertNotIn('must never', output.read_text(encoding='utf-8'))
            self.assertNotIn('NODIA_TEXT_CONTROL_', output.read_text(encoding='utf-8'))
            return result, calls

    def test_one_control_no_attachments_and_exact_proof_ack(self):
        report, calls = self.simulate()
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(len(calls), 4)

    def test_timeout_reconciles_and_acks_without_second_generation(self):
        report, calls = self.simulate('timeout')
        self.assertEqual(report['status'], 'gates_open')
        self.assertTrue(report['probe']['native_acknowledged'])
        self.assertEqual(sum(route.endswith('/turn') for route in calls), 1)

    def test_wrong_nonce_or_changed_session_never_passes(self):
        for mode in ('wrong', 'changed_session'):
            report, _ = self.simulate(mode)
            self.assertEqual(report['status'], 'gates_open')

    def test_foreign_proof_is_not_acknowledged(self):
        report, calls = self.simulate('bad_proof')
        self.assertEqual(report['status'], 'gates_open')
        self.assertFalse(report['probe']['native_acknowledged'])
        self.assertFalse(any(route.endswith('/acknowledge') for route in calls))


if __name__ == '__main__':
    unittest.main(verbosity=2)
