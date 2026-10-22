"""Validate frozen, byte-preserved native-format reports; no provider or DB access."""
from datetime import datetime
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'docs' / 'evidence'
HELPER = '616077cd82abaad224002a9c8a758d8b8d7e98d0991679d290b7edd380763131'
WRAPPER = '6b808e616c35e4ce3fc45a9d138648dac64ccdc3d2673cba24e214638bd622c0'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((EVIDENCE / name).read_text(encoding='utf-8'))


cohort_name = 'nodia-ai-ai38-modalities-agentic-cohort-02.json'
prior_name = 'nodia-ai-ai38-modalities-agentic-cohort-01.json'
cohort, prior = read(cohort_name), read(prior_name)
qa_name = 'nodia-ai-ai38-modalities-bootstrap-qa.json'
qa = read(qa_name)
cases = cohort['cases']
assert cohort['status'] == 'passed' and [case['format'] for case in cases] == ['png', 'pdf', 'wav', 'webm']
assert prior['cases'] == [] and prior['probe_requests_declared_in_reports'] == 0
assert prior['status'] == 'control_failed_no_next_probe' and prior['failure_class'] == 'AssertionError'
assert qa['status'] == 'passed' and qa['helper_source_sha256'] == HELPER and qa['wrapper_source_sha256'] == WRAPPER
assert qa['results']['legacy_import_before_environment'] == {'code': 'adapter_unconfigured', 'calls': 0}
assert qa['results']['corrected_environment_before_import'] == {'code': None, 'calls': 1}
sources = {
    'docs/evidence/scripts/nodia-ai-ai38-verifications-modalities.py': HELPER,
    'docs/evidence/scripts/nodia-ai-ai38-agentic-modalities-cohort.py': WRAPPER,
}
for name, expected in sources.items():
    assert digest(ROOT / name) == expected
assert cohort['helper_sha256'] == HELPER and cohort['source_sha256'] == WRAPPER
assert cohort['probe_requests_declared_in_reports'] == 4 and cohort['maximum_probe_requests'] == 4
assert cohort['automatic_inference_retries'] == 0 and cohort['unknown_native_state'] is False
assert cohort['services_restarted'] is False and cohort['selection_modified'] is False
assert cohort['historical_resource_key_compared'] is False
reports = {prior_name: digest(EVIDENCE / prior_name), cohort_name: digest(EVIDENCE / cohort_name), qa_name: digest(EVIDENCE / qa_name)}
previous_end = None
summary = []
expected_media = {'png': ('image', 'image/png'), 'pdf': ('pdf', 'application/pdf'), 'wav': ('audio', 'audio/wav'), 'webm': ('audio', 'audio/webm')}
for case in cases:
    name = 'nodia-ai-ai38-modalities-agentic-' + case['format'] + '-01.json'
    value = read(name)
    reports[name] = digest(EVIDENCE / name)
    assert reports[name] == case['report_sha256'] and value == case['probe_result']
    assert case['status'] == 'passed' and case['exit_code'] == 0 and case['native_state'] == 'closed_acknowledged'
    assert all(case[key] is True for key in ('same_binding', 'same_format', 'same_epoch'))
    assert value['status'] == 'passed' and value['http_status'] == 200
    assert (value['kind'], value['media_type']) == expected_media[case['format']]
    assert value['semantic_match'] is True and value['expected_answer_sha256'] == value['actual_answer_sha256']
    assert value['native_outcome'] == 'completed' and value['native_acknowledged'] is True and value['native_pending_identity'] is False
    assert value['exact_format_verified_after'] is True
    assert value['generation_requests'] == value['maximum_generations'] == 1 and value['inference_replayed'] is False
    assert value['source_sha256'] == HELPER
    assert all(value[key] == cohort['binding'][key] for key in ('selection', 'configuration_generation', 'session_generation'))
    assert value['configured_SQL_writes'] == value['business_effects'] == 0
    assert value['provider_login_logout'] is False and value['raw_provider_output_exported'] is False
    assert all(count == 0 for count in value['quiet_before'].values())
    start, end = map(datetime.fromisoformat, (value['started_at_utc'], value['finished_at_utc']))
    assert start <= end and (previous_end is None or previous_end <= start)
    previous_end = end
    summary.append({'format': case['format'], 'media_type': value['media_type'], 'status': 'passed',
                    'generation_requests': 1, 'semantic_match': True, 'native_outcome': 'completed',
                    'native_acknowledged': True, 'native_pending_identity': False,
                    'exact_format_verified_after': True, 'attempt_id': value['attempt_id']})
checks = {
    'six_public_reports_copied_byte_exact_from_VM_and_hashed': True,
    'failed_bootstrap_cohort_preserved_with_zero_probe_requests': True,
    'bootstrap_order_regression_uses_compiled_transport_and_synthetic_fetch_only': True,
    'helper_and_wrapper_sources_match_live_and_offline_QA_pins': True,
    'four_distinct_formats_exact_kind_and_MIME': True,
    'four_semantic_answer_digests_match': True,
    'four_completed_exact_identity_proofs_acknowledged_without_pending_identity': True,
    'four_formats_verified_by_fresh_post_probe_observation': True,
    'four_independent_generations_sequential_without_retry_or_replay': True,
    'same_selection_configuration_session_current_resource_and_container_epoch': True,
    'no_claim_of_historical_resource_key_comparison': True,
    'read_only_configured_database_snapshots_zero_declared_business_effects': True,
}
receipt = {
    'stage': 'AI-38', 'scope': 'Agentic_exact_native_format_semantic_canaries_current_VM_epoch',
    'status': 'passed', 'live_provider_generations': 4, 'accepted_formats': 4,
    'inference_retries': 0, 'earlier_bootstrap_probe_requests': 0,
    'source_sha256': sources, 'evidence_sha256': reports,
    'candidate_manifest_sha256': '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3',
    'selection': cohort['binding']['selection'],
    'configuration_generation': cohort['binding']['configuration_generation'],
    'session_generation': cohort['binding']['session_generation'],
    'epoch': cohort['epoch_before'],
    'started_at_utc': cohort['started_at_utc'], 'finished_at_utc': cohort['finished_at_utc'],
    'historical_resource_key_compared': False, 'checks': checks, 'check_count': len(checks),
    'cases': summary,
    'limitations': [
        'Direct authenticated native attachment probe routes; not a new worker, UI, R2, or physical microphone end-to-end acceptance.',
        'Audio is synthetic Windows TTS; the WebM fixture was transcoded and decoded with PyAV before this cohort.',
        'Acceptance belongs to the exact selection, configuration, session and current runtime epoch; no universal format or future-session claim.',
        'Node/Client candidate adoption, all product capabilities and whole AI-38 closure are separate gates.',
        'The earlier bootstrap failure was adapter_unconfigured before dispatch; this correction is harness-only and does not establish a provider timeout cause.',
    ],
}
target = EVIDENCE / 'nodia-ai-ai38-modalities-agentic-receipt.json'
raw = (json.dumps(receipt, indent=2) + '\n').encode()
if target.exists():
    assert target.read_bytes() == raw
else:
    target.write_bytes(raw)
print(json.dumps({'receipt': target.name, 'sha256': digest(target), 'checks': len(checks), 'formats': 4}, indent=2))
