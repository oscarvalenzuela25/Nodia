"""Run the staged compiled fixture with private output capture; never load live env."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--work-name', required=True)
args = parser.parse_args()
assert re.fullmatch(r'ai39-worker-integration-r[0-9]{2}', args.work_name)
root = Path('/opt/nodia/verification') / args.work_name
server = root / 'nodia-server'
manifest = json.loads((root / 'verification-manifest.json').read_bytes())
for name, pin in manifest['files'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == pin
def containers():
    result = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, timeout=20, check=True)
    return sorted(value for value in result.stdout.decode().splitlines() if value.startswith('template_ai39_'))
def profiles():
    return sorted(path.name for path in Path('/tmp').glob('nodia-ai39-process-*'))
before, profiles_before = containers(), profiles()
env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(root), 'LANG': 'C.UTF-8',
       'NODE_ENV': 'test', 'RATE_LIMIT_STORAGE': 'memory', 'DOTENV_CONFIG_PATH': '/dev/null'}
began = datetime.now(timezone.utc).isoformat()
process = subprocess.Popen(['/usr/local/bin/node', 'test/nodia-ai-ai39.integration.mjs'],
    cwd=server, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
timed_out = False
try:
    stdout, stderr = process.communicate(timeout=230)
except subprocess.TimeoutExpired:
    timed_out = True
    os.killpg(process.pid, signal.SIGKILL)
    stdout, stderr = process.communicate(timeout=15)
assert len(stdout) <= 8 * 1024 * 1024 and len(stderr) <= 8 * 1024 * 1024
decoder = json.JSONDecoder()
observations = []
text = stdout.decode('utf-8', errors='replace')
for found in re.finditer(r'\{', text):
    try:
        value, _ = decoder.raw_decode(text[found.start():])
        if isinstance(value, dict) and value.get('stage') == 'AI39 compiled integration':
            observations.append(value)
    except ValueError:
        pass
after, profiles_after = containers(), profiles()
fixture = observations[-1] if observations else None
success = process.returncode == 0 and fixture is not None and not fixture.get('failed')
report = dict(stage='AI39', scope='isolated_compiled_SQL_and_process_integration',
    status='passed' if success and before == after and profiles_before == profiles_after else 'failed',
    began_VM_utc=began, finished_VM_utc=datetime.now(timezone.utc).isoformat(),
    exit_code=process.returncode, timed_out=timed_out, fixture=fixture,
    fixture_containers_before=before, fixture_containers_after=after,
    fixture_profile_directories_before=profiles_before, fixture_profile_directories_after=profiles_after,
    fixture_resources_cleaned=before == after and profiles_before == profiles_after,
    stdout_bytes=len(stdout), stderr_bytes=len(stderr), private_output_emitted=False,
    source_manifest_sha256=hashlib.sha256((root / 'verification-manifest.json').read_bytes()).hexdigest(),
    public_files_verified=len(manifest['files']),
    configured_database_or_credentials_used=False, operational_services_changed=0,
    provider_inferences=0, remote_native_account_or_model_requests=0)
# Only an owned test source line, never a raw exception or environment.
lines = re.findall(r'nodia-ai-ai39\.integration\.mjs:(\d+)', stderr.decode('utf-8', errors='replace'))
report['fixture_error_source_lines'] = sorted(set(int(value) for value in lines))
print(json.dumps(report, indent=2))
raise SystemExit(0 if report['status'] == 'passed' else 1)
