import test_support
import json
import unittest
from uuid import uuid4
from unittest.mock import patch
from analysis_observations import AnalysisObservations
from agentic_progress import CliProgress
from test_support import AppTestCase, HEADERS


class ObservationStoreTest(unittest.TestCase):
    def test_limits_expiry_and_gaps(self):
        store = AnalysisObservations()
        identifier = str(uuid4())
        with patch('analysis_observations.time.monotonic', return_value=0):
            store.claim(identifier)
            with self.assertRaisesRegex(Exception, 'utilizada'):
                store.claim(identifier)
            for index in range(1000):
                store.emit(identifier, 'document_read_started' if index % 2 else 'document_read_completed')
            data = store.read(identifier, 0)
            self.assertEqual(len(data['events']), 256)
            self.assertTrue(data['gap'])
            store.emit(identifier, 'secret prompt')
            self.assertNotIn('secret', json.dumps(store.read(identifier, 0)))
            store.finish(identifier, 'failed')
        with patch('analysis_observations.time.monotonic', return_value=301):
            with self.assertRaisesRegex(Exception, 'no disponible'):
                store.read(identifier, 0)

    def test_parser_publishes_categories_during_fragmented_stdout_only(self):
        stages = []
        parser = CliProgress(stages.append)
        payload = (json.dumps({'event': 'init', 'init': {'secret': 'PRIVATE'}}) + '\n' +
                   json.dumps({'event': 'step_update', 'step_update': {'tool_name': 'view_file', 'state': 'DONE', 'text': 'PRIVATE'}}) + '\n').encode()
        for byte in payload:
            parser.feed(bytes([byte]))
        parser.feed(b'invalid\n' + b'a' * 70000 + b'\n')
        self.assertEqual(stages, ['cli_initialized', 'document_read_completed'])
        self.assertNotIn('PRIVATE', json.dumps(parser.summary()))


class ObservationHTTPTest(AppTestCase):
    def test_private_route_requires_service_auth_and_is_per_execution(self):
        identifier = str(uuid4())
        headers = {**HEADERS, 'X-Nodia-Analysis-Id': identifier}
        response = self.client.post('/analyze-invoice', headers=headers, data={'model': 'synthetic'},
                                    files={'file': ('invoice.pdf', b'%PDF-1.4', 'application/pdf')})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(f'/analysis-observations/{identifier}').status_code, 401)
        snapshot = self.client.get(f'/analysis-observations/{identifier}', headers=HEADERS)
        self.assertEqual(snapshot.headers['cache-control'], 'no-store')
        self.assertEqual(snapshot.json()['state'], 'succeeded')
        self.assertEqual(snapshot.json()['events'][-1]['stage'], 'extraction_validated')
        self.assertEqual(self.client.get(f'/analysis-observations/{uuid4()}', headers=HEADERS).status_code, 404)
        self.assertEqual(self.client.post('/analyze-invoice', headers=headers).status_code, 409)
        self.assertEqual(self.web.analyze_invoice.await_count, 1)

    def test_multipart_validation_failure_is_observed_before_inference(self):
        identifier = str(uuid4())
        self.assertEqual(self.client.post('/analyze-invoice', headers={**HEADERS, 'X-Nodia-Analysis-Id': identifier}).status_code, 422)
        snapshot = self.client.get(f'/analysis-observations/{identifier}', headers=HEADERS).json()
        self.assertEqual(snapshot['state'], 'failed')
        self.web.analyze_invoice.assert_not_awaited()
