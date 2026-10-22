"""Final read-only parity/quiet/retention check, run only after the live owner finishes."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.request

runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=30).stdout


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


report = {'stage': 'AI-34', 'scope': 'final_post_canary_read_only_health_parity', 'status': 'running', 'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'provider_generations': 0, 'provider_metadata_requests': 0, 'storage_operations': 0, 'services_restarted': False}
phase = 'service_health'
try:
    units = {name: run(['systemctl', 'is-active', name]).strip() for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
    assert all(status == 'active' for status in units.values())
    http = {}
    for name, url in (('api', 'http://127.0.0.1:3000/api/v1/'), ('gemini', 'http://127.0.0.1:8000/health'), ('proxy', 'http://127.0.0.1:8080/api/v1/')):
        with urllib.request.urlopen(url, timeout=5) as response:
            http[name] = response.status
    assert all(status == 200 for status in http.values())
    report.update(units=units, http=http)
    phase = 'sql_quiet'
    quiet = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    assert all(quiet[key] == 0 for key in ('pending_jobs', 'open_attempts', 'held_or_unknown_slots')) and quiet['migrations'] == 28
    report['sql_quiet'] = quiet
    phase = 'native_quiet'
    native = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    keys = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')
    report['native_runtime_artifact_counts'] = {key: native[key] for key in keys}
    assert all(value == 0 for value in report['native_runtime_artifact_counts'].values())
    phase = 'compiled_parity'
    manifest_path = Path('/tmp/nodia-ai34-metadata-candidate/.tmp/ai34-runtime-candidate-manifest.json')
    manifest = json.loads(manifest_path.read_text())
    actual = {file.relative_to(runtime).as_posix(): digest(file) for file in sorted((runtime / 'dist').rglob('*')) if file.is_file()}
    assert actual == manifest and len(actual) == 931
    pin = json.loads((runtime / 'dist/nodia-ai-context/config/knowledge-pin.json').read_text())
    knowledge = json.loads((runtime / 'dist/nodia-ai/knowledge/manifest.json').read_text())
    assert pin['release_id'] == knowledge['release_id'] == '72e2d9823d559968836eb36a0a48c7a9afa268f02ba549cb7be9ad930f646896'
    report.update(compiled_files_verified=931, compiled_manifest_sha256=digest(manifest_path), compiled_drift_files=[], knowledge_release=pin['release_id'])
    phase = 'native_source_parity'
    parity = json.loads(run(['python3', '/tmp/nodia-ai-ai34-native-source-verify.py', 'container', 'nodia-gemini-microservice', '/tmp/ai34-native-mcp-manifest.json']))
    assert parity['files'] == 99 and parity['drift_count'] == 0
    image = run(['docker', 'inspect', 'nodia-gemini-microservice', '--format', '{{.Image}}']).strip()
    assert image == 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
    report.update(native_image=image, native_source_files_verified=99, native_source_drift_count=0, native_source_manifest_sha256=parity['source_manifest_sha256'])
    phase = 'preserved_chat'
    activation = json.loads(Path('/tmp/ai34-activation-result.json').read_text())
    before = json.loads((Path(activation['backup_directory']) / 'configured-chat-before.json').read_text())
    projection = json.loads(run(['/usr/local/bin/node', '/tmp/ai32-r05-r2-chat-final-projection.mjs']))
    assert projection['status'] == 'passed' and 'cloud_reads' not in projection
    current = {key: projection[key] for key in before}
    assert current == before
    report.update(configured_chat_preserved=True, configured_chat_metadata_sha256=hashlib.sha256(json.dumps(current, sort_keys=True, separators=(',', ':')).encode()).hexdigest(), status='passed')
except Exception:
    report.update(status='failed', safe_failure_phase=phase)
report['completed_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
print(json.dumps(report, indent=2))
if report['status'] != 'passed':
    raise SystemExit(1)
