"""Offline consistency check for the AI-38 MCP cut; no app/DB/provider imports."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/evidence'


def read(name):
    return json.loads((EVIDENCE / name).read_text(encoding='utf-8-sig'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


freeze = read('nodia-ai-ai38-mcp-r01-candidate-source-freeze02.json')
build = read('nodia-ai-ai38-mcp-r01-candidate-build02.json')
activation = read('nodia-ai-ai38-mcp-r01-activation.json')
live = read('nodia-ai-ai38-mcp-r01-live01.json')
resume = read('nodia-ai-ai38-mcp-r01-resume.json')
observe = read('nodia-ai-ai38-mcp-r01-postresume-observe01.json')
inventory = read('nodia-ai-ai38-mcp-r01-final-inventory.json')
native = read('nodia-ai-ai38-mcp-r01-final-native-closure.json')
assert freeze['status'] == 'passed_local_offline_only'
for path, digest in freeze['sources'].items():
    assert sha(ROOT / 'nodia-gemini-microservice' / path) == digest
for path, digest in freeze['test_files'].items():
    assert sha(ROOT / 'nodia-gemini-microservice/tests' / path) == digest
assert build['status'] == 'passed' and build['Linux_tests_discovered_and_executed'] == 442
assert build['Linux_runtime_skips'] == 0 and build['QA_exit_code'] == 0
assert build['public_source_files_compared'] == 47 and len(build['public_source_delta']) == 2
assert build['image_sources'] == freeze['sources']
assert build['runtime_image_Config_unchanged'] and build['added_layers'] == 1
assert build['owned_offline_containers_remaining'] == 0
assert sum(item['test_methods'] for item in build['excluded_test_files'].values()) == 31
assert build['provider_requests'] == 0 and build['operational_environment_or_profiles_mounted'] is False
for report in (activation, live, resume, observe):
    assert report['status'] == 'passed'
assert live['native_pending_identity'] is False
result = live['native_result']
assert result['diagnostic_nonce_verified'] and result['native_terminal_proof_acknowledged']
assert result['configured_database_read_only'] and not result['configured_database_modified']
assert not result['inference_replayed'] and result['real_provider_dispatch_requests'] == 1
assert result['supports_mcp_before'] is False and result['supports_mcp_after'] is True
diagnostic = result['diagnostics']
assert diagnostic['callbacks'] == 1 and diagnostic['last_rpc_messages'] == 7
assert diagnostic['start_admission'] == 'running'
for endpoint in ('start', 'results', 'attest', 'acknowledge'):
    assert diagnostic['endpoints'][endpoint] == {'requests': 1, 'completed': 1, 'failed': 0}
assert diagnostic['endpoints']['cancel']['requests'] == diagnostic['endpoints']['reconcile']['requests'] == 0
assert resume['canary_sha256'] == observe['live_report_sha256'] == sha(EVIDENCE / 'nodia-ai-ai38-mcp-r01-live01.json')
assert live['harness_sha256'] == sha(ROOT / 'nodia-server/test/nodia-ai-ai38-mcp-diagnostic.mjs')
assert observe['source_sha256'] == sha(EVIDENCE / 'scripts/nodia-ai-ai38-mcp-r01-observe.py')
assert observe['same_selection_configuration_session_and_epoch'] and observe['supports_mcp_after']
assert observe['provider_dispatch_requests'] == observe['provider_generations'] == 0
assert observe['metadata_requests'] == 2 and observe['api_public_root_http_status'] == 200
for key in ('selection', 'configuration_generation', 'session_generation'):
    assert observe[key] == diagnostic[key]
assert observe['container_before'] == observe['container_after']
assert observe['container_after']['image'] == build['candidate_image_id'] == activation['candidate_image_id']
assert observe['container_after']['id'] == activation['container_id'] == resume['candidate_container_id'] == inventory['gemini_container']['id']
assert observe['container_after']['started_at_utc'] == activation['container_started_at_utc'] == resume['candidate_started_at_utc']
assert all(value == 'active' for value in resume['service_states_after'].values())
assert all(value['active_state'] == 'active' for value in inventory['units'].values())
assert inventory['operational_node']['compiled_files'] == 932
assert inventory['operational_node']['manifest_sha256'] == 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
assert inventory['gemini_container']['environment_matches_private_baseline']
assert inventory['gemini_container']['mounts_match_private_baseline']
assert all(inventory['SQL_read_only'][key] == 0 for key in ('pending_jobs', 'open_attempts', 'retained_slots'))
assert all(native[key] == 0 for key in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
                                      'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
fiche = (ROOT / 'docs/nodia-ai/knowledge/nodia-ai/features/runtime-policy.md').read_text(encoding='utf-8')
metadata = json.loads(fiche.split('---', 2)[1])
assert metadata['revision'] == 7 and metadata['approval'] is None
assert metadata['document_status'] == 'draft' and metadata['integration_status'] == 'unregistered'
knowledge = subprocess.run(['node', 'scripts/build-nodia-ai-knowledge.mjs', '--check'],
                           cwd=ROOT / 'nodia-server', capture_output=True, check=True, timeout=30)
knowledge = json.loads(knowledge.stdout)
assert knowledge['releaseId'] == 'c70317bf3106f002a399c5449158f0cdea204a308f1016dc0053a27be3e6ad36'
assert (knowledge['sources'], knowledge['excluded'], knowledge['documents'], knowledge['fragments']) == (59, 28, 31, 31)
print(json.dumps({'stage': 'AI-38-MCP-R01', 'status': 'passed_offline_cut_consistency',
                  'Linux_tests': 442, 'source_pins_checked': len(freeze['sources']),
                  'test_file_pins_checked': len(freeze['test_files']),
                  'real_MCP_canary': 'passed_exact_epoch_nonce_and_ACK',
                  'causal_timeout_fix_claimed': False, 'business_acceptance_added': False,
                  'knowledge': knowledge, 'fresh_remote_requests_by_validator': 0}))
