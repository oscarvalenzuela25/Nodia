"""Offline validation of the final AI-39 integration cohort; no services or secrets."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parents[3]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--check', action='store_true', help='Check the frozen receipt instead of creating it')
args = p.parse_args()
target = root / 'docs/evidence/nodia-ai-ai39-worker-validation-r01.json'
def digest(path):
    return hashlib.sha256((root / path).read_bytes()).hexdigest()
def read(name):
    return json.loads((root / 'docs/evidence' / name).read_bytes())
if args.check:
    frozen = json.loads(target.read_bytes())
    for path, pin in frozen['file_hashes'].items():
        assert digest(path) == pin, f'Source/receipt drift: {path}'
    print(json.dumps({'status': 'passed', 'mode': 'frozen_hash_check',
                      'files': len(frozen['file_hashes']), 'provider_requests': 0}))
    raise SystemExit(0)

build = read('nodia-ai-ai39-build-r04.json')
unit = read('nodia-ai-ai39-unit-qa-r03.json')
checks = read('nodia-ai-ai39-checks-qa-r03.json')
stage = read('nodia-ai-ai39-worker-stage-r06.json')
sql = read('nodia-ai-ai39-worker-integration-r06.json')
journal = read('nodia-ai-ai39-journal-integration-r06.json')
protocol = read('nodia-ai-ai39-protocol-integration-r06.json')
provenance = read('nodia-ai-ai39-provenance-r03.json')
manifest_path = 'docs/evidence/nodia-ai-ai39-worker-snapshot-r06.json'
manifest = json.loads((root / manifest_path).read_bytes())
assert digest(manifest_path) == stage['manifest_sha256']
assert build['exit'] == 0 and build['production_sources_unchanged_during_build']
assert unit['sources_unchanged_during_commands'] and unit['results'][0]['exit'] == 0
assert unit['results'][0]['tests']['numFailedTests'] == 0
assert unit['results'][0]['tests']['numPendingTests'] == 0
assert unit['results'][0]['tests']['success']
assert checks['sources_unchanged_during_commands']
assert [r['exit'] for r in checks['results'][:2]] == [0, 0]
# The frozen legacy catalog checker is reported, not converted into a current positive.
assert checks['results'][2]['command'][-1] == 'test:nodia-ai:contracts'
for receipt in [sql, journal, protocol]:
    assert receipt['status'] == 'passed' and receipt['fixture_resources_cleaned']
    assert receipt['source_manifest_sha256'] == stage['manifest_sha256']
    assert not receipt['configured_database_or_credentials_used']
    assert receipt['operational_services_changed'] == 0
assert sql['provider_inferences'] == 0 and sql['remote_native_account_or_model_requests'] == 0
assert sql['fixture']['synthetic_readiness_override'] is True
assert sql['fixture']['provider_inferences'] == 0
assert sql['fixture']['operational_configuration_changed'] is False
assert sql['fixture']['checks'] == len(sql['fixture']['passed']) == 62
assert not sql['fixture'].get('failed')
scenarios = sql['fixture']['scenarios']
assert len(scenarios) == 5
assert {row['scenario'] for row in scenarios} == {
    'success', 'peer_crash', 'cancel', 'supervisor_crash', 'ack_cleanup_rollback_after_native_ack'}
assert all(row['provider_dispatches'] == row['completed_tool_receipts'] == 1
           and row['acknowledged'] for row in scenarios)
rollback = next(row for row in scenarios if row['scenario'] == 'ack_cleanup_rollback_after_native_ack')
assert rollback['native_ack_observed_before_purge']
assert rollback['sql_failure'] == 'explicit_post_ack_transaction_rollback'
assert rollback['state'] == 'completed' and not rollback['journal_record_present']
assert journal['fixture']['checks'] >= 16 and journal['fixture']['syntheticCertificates']
assert journal['provider_requests'] == 0
assert protocol['provider_requests'] == 0
assert protocol['fixture']['status'] == 'passed'
assert protocol['fixture']['process_groups_closed'] == len(protocol['fixture']['cases']) == 7
assert all(row['passed'] for row in protocol['fixture']['cases'])
assert protocol['fixture']['simulated_peer'] and protocol['fixture']['real_jsonl_processes']
assert provenance['published_capability_count'] == 74
assert provenance['capabilities_added_or_removed'] == provenance['contracts_or_scopes_changed'] == 0
assert provenance['registry_after_sha256'] == digest('nodia-server/config/nodia-ai-knowledge.registry.json')

paths = dict(build['production_source_hashes'])
for path, pin in manifest['files'].items():
    if path in paths:
        assert paths[path] == pin, f'Build/snapshot source mismatch: {path}'
    paths[path] = pin
for path, pin in unit['source_hashes'].items():
    if path in paths:
        assert paths[path] == pin, f'Build/unit source mismatch: {path}'
    paths[path] = pin
for path, pin in checks['source_hashes'].items():
    assert paths[path] == pin, f'Checks/unit source mismatch: {path}'
for path, pin in paths.items():
    assert digest(path) == pin, f'Current source differs: {path}'

documents = [
    'docs/mvp/00-progress.md', 'docs/mvp/README.md',
    'docs/mvp/85-nodia-ai-ai39-codex-runtime.md',
    'docs/architecture/decisions/ADR-072-nodia-ai-provider-runtime-adapters.md',
    'docs/nodia-ai/knowledge/nodia-ai/features/context-execution.md',
    'docs/evidence/nodia-ai-ai39-worker-runtime-r01.md',
]
feature = (root / documents[4]).read_text(encoding='utf-8').split('---', 2)
metadata = json.loads(feature[1])
assert metadata['revision'] == 16 and metadata['document_status'] == 'draft'
assert metadata['integration_status'] == 'unregistered' and metadata['approval'] is None
assert metadata['implementation']['status'] == 'partial'
for source in metadata['sources']:
    assert (root / source['path']).is_file()
for path in metadata['verification']['evidence_paths']:
    assert (root / path).is_file() or path == target.relative_to(root).as_posix()
# Resolve local links structurally; anchors are browser concerns.
link_count = 0
for path in documents:
    parent = (root / path).parent
    for reference in re.findall(r'\]\(([^)]+)\)', (root / path).read_text(encoding='utf-8')):
        if '://' in reference or reference.startswith('#'):
            continue
        reference = reference.split('#', 1)[0].split(' "', 1)[0].strip('<>')
        linked = (parent / reference).resolve()
        assert linked.is_file() or linked.is_dir() or linked == target, f'Missing link: {path}: {reference}'
        link_count += 1
receipts = [
    'nodia-ai-ai39-build-r04.json', 'nodia-ai-ai39-unit-qa-r03.json',
    'nodia-ai-ai39-checks-qa-r03.json', 'nodia-ai-ai39-worker-stage-r06.json',
    'nodia-ai-ai39-worker-integration-r06.json', 'nodia-ai-ai39-journal-integration-r06.json',
    'nodia-ai-ai39-protocol-integration-r06.json',
    'nodia-ai-ai39-provenance-r03.json', 'nodia-ai-ai39-worker-integration-r01.json',
    'nodia-ai-ai39-worker-integration-r02.json', 'nodia-ai-ai39-worker-integration-r03.json',
    'nodia-ai-ai39-worker-integration-r04.json', 'nodia-ai-ai39-worker-integration-r05.json',
    'nodia-ai-ai39-unit-qa-r02.json',
    'nodia-ai-ai39-unit-earlier-r01.json', 'nodia-ai-ai39-build-r03.json',
    'nodia-ai-ai39-checks-qa-r01.json',
]
extras = documents + ['docs/evidence/' + name for name in receipts] + [
    manifest_path,
    'nodia-server/config/nodia-ai-knowledge.registry.json',
    'nodia-server/test/nodia-ai-ai39.integration.mjs',
    'nodia-server/test/nodia-ai-ai39-journal.integration.mjs',
    'nodia-server/test/nodia-ai-ai39-protocol.integration.mjs',
    'nodia-server/test/fixtures/codex-chat-protocol-peer.mjs',
    'nodia-server/test/fixtures/codex-chat-peer.mjs',
    'nodia-server/test/nodia-ai-unpublished.fixture.mjs',
    'docs/evidence/scripts/nodia-ai-ai39-worker-validation-r01.py',
    'docs/evidence/scripts/nodia-ai-ai39-stage-worker-integration-r01.py',
    'docs/evidence/scripts/nodia-ai-ai39-stage-worker-integration-r02.py',
    'docs/evidence/scripts/nodia-ai-ai39-run-worker-integration-r01.py',
    'docs/evidence/scripts/nodia-ai-ai39-run-journal-integration-r01.py',
    'docs/evidence/scripts/nodia-ai-ai39-run-protocol-integration-r01.py',
]
for path in extras:
    paths[path] = digest(path)
report = {
    'stage': 'AI39', 'status': 'passed_with_explicit_acceptance_limits',
    'recorded_local_utc': datetime.now(timezone.utc).isoformat(),
    'unit_tests': unit['results'][0]['tests'], 'unit_test_files': unit['results'][0]['test_files'],
    'SQL_and_process_checks': sql['fixture']['checks'],
    'Linux_journal_checks': journal['fixture']['checks'],
    'Linux_JSONL_protocol_cases': len(protocol['fixture']['cases']),
    'local_links_checked': link_count,
    'legacy_catalog_checker_exit': checks['results'][2]['exit'],
    'historical_failed_runs_preserved': [1, 2],
    'historical_passed_integration_runs': [3, 4, 5],
    'current_integration_run': 6, 'production_MCP_certified': False,
    'provider_inferences': 0, 'configured_database_used': False,
    'operational_deployment': False, 'new_capabilities_published': 0,
    'acceptance_remaining': ['native_account_and_dynamic_tools', 'UI_and_provider_switch',
        'human_confirmed_business_effect_with_Codex', 'attachment_formats',
        'fail_closed_recovery_when_private_certificate_is_absent'],
    'file_hashes': paths,
}
with target.open('xb') as output:
    output.write(json.dumps(report, indent=2).encode() + b'\n')
print(json.dumps({k: v for k, v in report.items() if k != 'file_hashes'}))
