"""Prove the SDK refusal-log test fails without the constructor's privacy guard.

Synthetic isolated SDK transport only. Never imports operational configuration,
contacts a provider, changes installed source, or emits captured log content.
"""
import hashlib
import inspect
import io
import json
from pathlib import Path
import sys
import textwrap
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'nodia-gemini-microservice'))
sys.path.insert(0, str(ROOT / 'nodia-gemini-microservice/tests'))
import test_support
import gemini_service
from loguru import logger
from test_web_chat_recovery import ChatRecoveryTests


def main():
    constructor = textwrap.dedent(inspect.getsource(gemini_service.GeminiWebService.__init__))
    guard = '    logger.disable("gemini_webapi")\n'
    assert constructor.count(guard) == 1
    changed = constructor.replace(guard, '')
    namespace = {}
    exec(compile(changed, '<synthetic-constructor-mutation>', 'exec'),
         gemini_service.__dict__, namespace)
    method = 'test_actual_SDK_refusal_text_stays_out_of_all_sinks_while_Nodia_diagnostics_remain'
    result_stream = io.StringIO()
    try:
        with patch.object(gemini_service.GeminiWebService, '__init__', namespace['__init__']):
            result = unittest.TextTestRunner(stream=result_stream).run(
                unittest.TestSuite([ChatRecoveryTests(method)]))
    finally:
        logger.disable('gemini_webapi')
    assert result.testsRun == 1 and len(result.failures) == 1 and not result.errors
    assert 'synthetic-private-refusal-marker' in result.failures[0][1]
    report = dict(schema='ai38-web-stream-recovery-privacy-mutation-v1', status='passed',
        expected_regression_failures=1, test_errors=0, synthetic_tests_run=1,
        mutation='remove_only_logger_disable_from_explicit_service_constructor_in_memory',
        fixture_enables_vendor_logger_immediately_before_constructor=True,
        old_behavior_emits_synthetic_refusal_and_is_rejected=True,
        installed_source_modified=False, provider_requests=0, operational_profile_bytes_read=False,
        captured_log_payloads_emitted=False,
        test_source_sha256=hashlib.sha256((ROOT / 'nodia-gemini-microservice/tests/test_web_chat_recovery.py').read_bytes()).hexdigest(),
        service_source_sha256=hashlib.sha256((ROOT / 'nodia-gemini-microservice/gemini_service.py').read_bytes()).hexdigest())
    target = ROOT / 'docs/evidence/nodia-ai-ai38-web-stream-recovery-privacy-mutation-r01.json'
    with target.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
