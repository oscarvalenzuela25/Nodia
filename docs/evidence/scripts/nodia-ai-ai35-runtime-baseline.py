"""Read-only AI-35 preflight; no generation, migration, cloud or profile read."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.request

RUNTIME = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
EXPECTED_NODE = '5f5f89bb4d8418f422f6fd446f91c838e011e579ccbad4e0f7590b7d41ee7909'
EXPECTED_RELEASE = '72e2d9823d559968836eb36a0a48c7a9afa268f02ba549cb7be9ad930f646896'
EXPECTED_IMAGE = 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=30).stdout.strip()

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

manifest = {file.relative_to(RUNTIME).as_posix(): digest(file) for file in sorted((RUNTIME / 'dist').rglob('*')) if file.is_file()}
deployed_manifest = Path('/tmp/nodia-ai34-metadata-candidate/.tmp/ai34-runtime-candidate-manifest.json')
assert digest(deployed_manifest) == EXPECTED_NODE and json.loads(deployed_manifest.read_text()) == manifest and len(manifest) == 931
units = {name: run(['systemctl', 'is-active', name]) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
assert all(value == 'active' for value in units.values())
http = {}
for name, url in (('api', 'http://127.0.0.1:3000/api/v1/'), ('gemini', 'http://127.0.0.1:8000/health'), ('proxy', 'http://127.0.0.1:8080/api/v1/')):
    with urllib.request.urlopen(url, timeout=5) as response:
        http[name] = response.status
assert all(value == 200 for value in http.values())
sql = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
assert sql['migrations'] == 28 and all(sql[key] == 0 for key in ('pending_jobs', 'open_attempts', 'held_or_unknown_slots'))
native = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
native_keys = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')
native_counts = {key: native[key] for key in native_keys}
assert all(value == 0 for value in native_counts.values())
image = run(['docker', 'inspect', 'nodia-gemini-microservice', '--format', '{{.Image}}'])
assert image == EXPECTED_IMAGE
parity = json.loads(run(['python3', '/tmp/nodia-ai-ai34-native-source-verify.py', 'container', 'nodia-gemini-microservice', '/tmp/ai34-native-mcp-manifest.json']))
assert parity['files'] == 99 and parity['drift_count'] == 0
pin = json.loads((RUNTIME / 'dist/nodia-ai-context/config/knowledge-pin.json').read_text())
assert pin['release_id'] == json.loads((RUNTIME / 'dist/nodia-ai/knowledge/manifest.json').read_text())['release_id'] == EXPECTED_RELEASE
chat = json.loads(run(['/usr/local/bin/node', '/tmp/ai32-r05-r2-chat-final-projection.mjs']))
assert chat['status'] == 'passed' and 'cloud_reads' not in chat
print(json.dumps({
    'stage': 'AI-35', 'scope': 'read_only_pre_activation_baseline', 'status': 'passed',
    'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'manifest': manifest, 'compiled_files': len(manifest), 'compiled_manifest_sha256': EXPECTED_NODE,
    'knowledge_release': pin['release_id'], 'native_image': image,
    'native_source_files_verified': parity['files'], 'native_source_manifest_sha256': parity['source_manifest_sha256'],
    'native_runtime_artifact_counts': native_counts, 'sql_quiet': sql, 'units': units, 'http': http,
    'configured_chat_checked': True, 'provider_generations': 0, 'provider_metadata_requests': 0,
    'configured_database_writes': 0, 'storage_operations': 0, 'services_restarted': False,
}, indent=2))
