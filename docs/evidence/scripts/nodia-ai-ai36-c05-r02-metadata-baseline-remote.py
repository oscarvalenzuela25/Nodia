"""Readonly operational baseline; no provider requests or account/profile reads."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

root = Path('/opt/nodia/verification/ai36-c05-r02-metadata02')
assert not root.exists()
root.mkdir(mode=0o700)
def checked(args):
    p = subprocess.run(args, capture_output=True, check=False)
    assert p.returncode == 0, 'readonly_baseline_command_failed'
    return p.stdout
command = ['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-r02-metadata-baseline.mjs',
 '/opt/nodia/releases/nodia-server-ai15-20261016', '/opt/nodia/verification/ai36-c05-role-canary13/nodia-server',
 '/opt/nodia/verification/ai36-c05-role-canary13/binding.json', str(root / 'SQL-baseline.json')]
value = json.loads(checked(command))
container = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
assert container['Image'] == 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
units = {n: checked(['systemctl', 'is-active', n]).decode().strip() for n in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
quiet = json.loads(checked(['python3', '/tmp/ai32-r04-cleanup.py']))
assert all(quiet[k] == 0 for k in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
files = {p.relative_to(runtime).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((runtime / 'dist').rglob('*')) if p.is_file()}
digest = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
assert len(files) == 932 and digest == 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
expected = json.loads(Path('/tmp/ai36-c05-r02-metadata-source-hashes.json').read_text())
code = "import pathlib,json,hashlib;names=['agentic_service.py','agentic_cli.py','nodia_ai_chat.py'];print(json.dumps({n:hashlib.sha256((pathlib.Path('/app')/n).read_bytes()).hexdigest() for n in names}))"
actual = json.loads(checked(['docker', 'exec', 'nodia-gemini-microservice', '/usr/bin/python', '-I', '-B', '-c', code]))
assert expected == actual
records = []
p = subprocess.Popen(['docker', 'logs', '--since', '2026-10-19T19:22:40Z', '--timestamps', '--tail', '1000', 'nodia-gemini-microservice'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
for line in p.stdout:
    match = re.search(r'Agentic session/catalog check finished; duration_ms=(\d+) verified=(True|False)', line)
    if match: records.append({'at_utc': line.split(' ', 1)[0], 'duration_ms': int(match[1]), 'verified': match[2] == 'True'})
assert p.wait() == 0
report = {'stage': 'AI-36-C05-R02', 'scope': 'readonly_operational_existing_metadata_trace_baseline', 'status': 'passed',
 'observed_at_utc': datetime.now(timezone.utc).isoformat(), 'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'container': {'id': container['Id'], 'image': container['Image'], 'started_at': container['State']['StartedAt'], 'health': container['State']['Health']['Status']},
 'units': units, 'source_hashes': actual, 'local_runtime_source_parity': True, 'Node_compiled_files': len(files),
 'Node_manifest_sha256': digest, 'native_quiet': quiet, 'SQL_baseline': value, 'existing_metadata_checks': records,
 'provider_requests': 0, 'configured_SQL_writes': 0, 'services_restarted': False}
(root / 'operational-baseline.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
