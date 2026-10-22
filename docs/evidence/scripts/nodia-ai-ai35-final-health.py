"""Read-only final health, Node/native parity and protected R05 chat check."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.request

runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=30).stdout.strip()

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

report = {'stage': 'AI-35', 'scope': 'final_read_only_lab_health_parity', 'status': 'running',
    'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'provider_generations': 0,
    'provider_metadata_requests': 0, 'storage_operations': 0, 'configured_database_writes': 0, 'services_restarted': False}
phase = 'services'
try:
    units = {name: run(['systemctl', 'is-active', name]) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
    assert all(value == 'active' for value in units.values()); http = {}
    for name, url in (('api', 'http://127.0.0.1:3000/api/v1/'), ('gemini', 'http://127.0.0.1:8000/health'), ('proxy', 'http://127.0.0.1:8080/api/v1/')):
        with urllib.request.urlopen(url, timeout=5) as response:
            http[name] = response.status
    assert all(value == 200 for value in http.values()); report.update(units=units, http=http)
    phase = 'sql_and_native_quiet'
    sql = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    assert sql['migrations'] == 29 and all(sql[key] == 0 for key in ('pending_jobs', 'open_attempts', 'held_or_unknown_slots'))
    native = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    counts = {key: native[key] for key in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')}
    assert all(value == 0 for value in counts.values()); report.update(sql_quiet=sql, native_runtime_artifact_counts=counts)
    phase = 'compiled_parity'
    manifest_file = Path('/tmp/nodia-ai35-runtime-candidate/.tmp/ai35-runtime-candidate-manifest.json')
    expected = json.loads(manifest_file.read_text())
    actual = {file.relative_to(runtime).as_posix(): digest(file) for file in sorted((runtime / 'dist').rglob('*')) if file.is_file()}
    assert actual == expected and len(actual) == 932
    pin = json.loads((runtime / 'dist/nodia-ai-context/config/knowledge-pin.json').read_text())
    assert pin['release_id'] == json.loads((runtime / 'dist/nodia-ai/knowledge/manifest.json').read_text())['release_id']
    report.update(compiled_files_verified=932, compiled_manifest_sha256=digest(manifest_file), compiled_drift_files=[], knowledge_release=pin['release_id'])
    phase = 'native_parity'
    parity = json.loads(run(['python3', '/tmp/nodia-ai-ai34-native-source-verify.py', 'container', 'nodia-gemini-microservice', '/tmp/ai34-native-mcp-manifest.json']))
    assert parity['files'] == 99 and parity['drift_count'] == 0
    image = run(['docker', 'inspect', 'nodia-gemini-microservice', '--format', '{{.Image}}'])
    assert image == 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
    report.update(native_image=image, native_source_files_verified=99, native_source_drift_count=0, native_source_manifest_sha256=parity['source_manifest_sha256'])
    phase = 'protected_chat_and_schema'
    activation = json.loads(Path('/tmp/ai35-activation-result.json').read_text()); assert activation['status'] == 'passed'
    before = json.loads((Path(activation['backup_directory']) / 'configured-chat-before.json').read_text())
    chat = json.loads(run(['/usr/local/bin/node', '/tmp/ai32-r05-r2-chat-final-projection.mjs'])); assert chat['status'] == 'passed' and 'cloud_reads' not in chat
    assert {key: chat[key] for key in before} == before
    schema = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai-ai35-schema-observation.mjs']))
    assert schema['status'] == 'passed'
    report.update(schema=schema, configured_chat_preserved=True, status='passed')
except Exception:
    report.update(status='failed', safe_failure_phase=phase)
report['completed_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
print(json.dumps(report, indent=2))
if report['status'] != 'passed':
    raise SystemExit(1)
