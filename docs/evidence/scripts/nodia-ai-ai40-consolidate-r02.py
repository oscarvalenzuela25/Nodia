"""Offline evidence consolidation. No services, private profiles, SQL or provider calls."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/evidence'


def read(name):
    return json.loads((EVIDENCE / name).read_bytes())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


adoption = read('nodia-ai-ai40-availability-adopt-r01.json')
canary = read('nodia-ai-ai40-real-canary-r06.json')
sql = read('nodia-ai-ai40-ui-final-sql-r01.json')
reloaded = read('nodia-ai-ai40-ui-final-sql-reloaded-r01.json')
environment = read('nodia-ai-ai40-final-environment-r01.json')
ui = read('nodia-ai-ai40-live-ui-r01.json')
server = read('nodia-ai-ai40-unit-qa-r03.json')
client = read('nodia-ai-ai40-client-qa-r02.json')
window = read('nodia-ai-ai40-client-busy-window-final-r01.json')
assert adoption['status'] == 'adopt_completed'
assert canary['status'] == 'passed' and canary['fixture_resources_removed'] is True
assert canary['child']['final_mcp_accepted'] is True
assert all(sql[k] == reloaded[k] for k in sql if k != 'observed_at_VM_utc')
assert sql['pending'] == {'unsettled_jobs': 0, 'retained_slots': 0}
assert len(sql['movements']) == len(sql['executions']) == len(sql['steps']) == 1
assert sql['movements'][0]['id'] == '2' and sql['movements'][0]['amount'] == '1'
assert sql['executions'][0]['state'] == sql['steps'][0]['state'] == 'completed'
assert sql['steps'][0]['receipt_present'] and sql['challenges'] == [{'challenges': 1, 'consumed': 1}]
assert server['sources_unchanged_during_commands'] is True
assert server['results'][0]['tests']['numPassedTests'] == 4651
assert environment['status'] == 'post_ui_read_only_passed'
assert environment['codex']['pending'] == 0 and environment['codex']['locks_or_sockets'] == 0
assert ui['post_turn_composer_enabled_without_manual_recheck'] is True

names = [
    'nodia-ai-ai40-unit-qa-r03.json', 'nodia-ai-ai40-build-r03.json',
    'nodia-ai-ai40-client-qa-r02.json', 'nodia-ai-ai40-client-build-r03.json',
    'nodia-ai-ai40-client-busy-window-final-r01.json',
    'nodia-ai-ai40-operator-qa-r02.json', 'nodia-ai-ai40-availability-operator-qa-r01.json',
    'nodia-ai-ai40-server-package-r03.json', 'nodia-ai-ai40-package-r03.json',
    'nodia-ai-ai40-stage-r03.json', 'nodia-ai-ai40-availability-adopt-r01.json',
    'nodia-ai-ai40-real-canary-r06.json', 'nodia-ai-ai40-live-ui-r01.json',
    'nodia-ai-ai40-ui-final-sql-r01.json', 'nodia-ai-ai40-ui-final-sql-reloaded-r01.json',
    'nodia-ai-ai40-final-environment-r01.json', 'nodia-ai-ai40-ui-effect-sql-r01.json',
    'nodia-ai-ai40-ui-effect-sql-reloaded-r01.json', 'nodia-ai-ai40-ack-window-r02.json',
    'nodia-ai-ai40-checks-qa-r01.json', 'nodia-ai-ai40-store-linux-r02.json',
    'nodia-ai-ai40-clock-comparison-r01.json',
]
receipts = {name: digest(EVIDENCE / name) for name in names}
result = {
    'schema': 'nodia-ai-ai40-validation-v1',
    'stage': 'AI-40', 'status': 'partial_scoped_linux_acceptance',
    'consolidated_at_host_utc': datetime.now(timezone.utc).isoformat(),
    'clock_provenance': {
        'host_and_VM_clocks_calibrated': False,
        'comparison_receipt': 'nodia-ai-ai40-clock-comparison-r01.json',
        'observed_VM_ahead_of_host_approximately_seconds': 389,
        'ordering_rule': 'Compare SQL/native/provider events within the VM clock; do not order VM events directly against host QA/consolidation timestamps',
        'clock_or_NTP_changed': False,
        'limitations': 'Browser countdowns versus server deadlines are not accepted across this uncalibrated environment; server confirmation/lease authority remains enforced',
    },
    'environment': 'local_linux_VM',
    'selection_observed': canary['child']['selection'],
    'server_release': '/opt/nodia/releases/nodia-server-ai40-r03',
    'server_manifest_sha256': adoption['new_manifest_sha256'],
    'ui_surface': 'authenticated_local_Vite_5174',
    'compiled_client_adoption_accepted': False,
    'server_unit_tests': 4651,
    'client_global_scope': '1823 tests on the frozen 3.5-second candidate; final 21-second delta verified by focused tests/build, not another global run',
    'receipt_sha256': receipts,
    'accepted_scopes': [
        'Explicit Codex drawer selection with discovered model/effort metadata and secure account link',
        'Real account and scoped MCP acceptance with gateway, nonce, terminal and ACK',
        'Normal UI/worker knowledge reads and semantic conversation continuity',
        'Explicit Gemini Web/Codex selection changes preserve history and the current draft',
        'Human confirmation of the exact proposal: one execution, receipt and movement 2',
        'Readback, route return and reload preserve IDs without repeating the effect',
        'Bounded GET-only post-turn availability recovery; current native proofs acknowledged',
    ],
    'remaining_scopes': [
        'Business capability families beyond the specific financial preparation/effect tested',
        'Real cancellation, uncertain-result reconciliation, revocation and long-context acceptance for Codex',
        'Native image/PDF/audio per exact MIME/model/connection; remain blocked',
        'Unsent draft persistence across full reload/authentication remount',
        'Compiled Client adoption and R03 rollback rehearsal',
        'Windows, remote production and unrelated AI-38 delivery gates',
        'Host/VM clock synchronization and cross-clock countdown acceptance',
    ],
    'preserved_negative_evidence': [
        'Initial host canary transport failure before dispatch and the reverted namespace misdiagnosis',
        'Successful transport canaries R02/R03 with incorrect timestamp mirror; not operational acceptance',
        'Normal R01 worker result rejected after a committed tool receipt by the global JSON-node limit',
        'Two R02 deployment attempts stopped before admission; neither replayed in place',
        'R03 post-turn UI busy state persisted with the insufficient 3.5-second window',
        'Historical AI-15 structure checker still rejects its frozen 0/67 expectation against current 74 publication',
        'Automatic review rejected replacing the local dev server with compiled preview before execution',
    ],
    'safety': {
        'new_publication': False, 'approval_inferred': False, 'SQL_restore': False,
        'migration_executed': False, 'credential_bytes_in_evidence': False,
        'generation_replayed_on_unknown': False, 'business_effects_confirmed_by_human': 1,
        'confirmed_movement_retained_for_review': '2',
    },
    'services_left_active': True,
}
target = EVIDENCE / 'nodia-ai-ai40-validation-r02.json'
with target.open('x', encoding='utf-8') as output:
    output.write(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': result['status'], 'evidence_files': len(receipts), 'sha256': digest(target)}))
