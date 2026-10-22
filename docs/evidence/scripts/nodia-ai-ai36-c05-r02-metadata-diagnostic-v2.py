"""One existing HTTP observe with readonly /proc command timing; never another CLI."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import select
import subprocess
import time

root = Path('/opt/nodia/verification/ai36-c05-r02-metadata03')
assert not root.exists()
root.mkdir(mode=0o700)
fresh = subprocess.run(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-r02-metadata-baseline.mjs',
 '/opt/nodia/releases/nodia-server-ai15-20261016', '/opt/nodia/verification/ai36-c05-role-canary13/nodia-server',
 '/opt/nodia/verification/ai36-c05-r02-metadata02/SQL-baseline.json', str(root / 'SQL-baseline.json')], capture_output=True, check=True)
baseline = {'SQL_baseline': json.loads(fresh.stdout)}
current = json.loads(subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'], capture_output=True, check=True).stdout)[0]
assert current['Image'] == 'sha256:902d0edc51ae2153d02bd32ad77c496bf1d16ee09d89d98d8dce86bb7cffd8c5'
assert current['State']['Health']['Status'] == 'healthy'
units = {n: subprocess.run(['systemctl', 'is-active', n], capture_output=True, check=True).stdout.decode().strip() for n in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
baseline['container'] = {'image': current['Image'], 'id': current['Id'], 'started_at': current['State']['StartedAt']}
baseline['units'] = units
(root / 'operational-baseline.json').write_text(json.dumps(baseline, indent=2) + '\n')
observer_source = Path('/tmp/nodia-ai-ai36-c05-r02-metadata-proc-observer-v2.py').read_text()
sha = lambda b: hashlib.sha256(b).hexdigest()
report = {'stage': 'AI-36-C05-R02', 'scope': 'one_actual_HTTP_observe_with_readonly_native_metadata_process_timing',
 'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(), 'maximum_HTTP_observations': 1,
 'HTTP_observations_requested': 0, 'native_MCP_start_requests': 0, 'provider_inference_requests': 0,
 'additional_CLI_executions': 0, 'application_sources_modified': 0, 'services_restarted': False,
 'baseline_sha256': sha((root / 'operational-baseline.json').read_bytes()),
 'source_sha256': sha(Path(__file__).read_bytes()), 'observer_source_sha256': sha(observer_source.encode())}
def save(): (root / 'diagnostic-report.json').write_text(json.dumps(report, indent=2) + '\n')
save()
observer = subprocess.Popen(['docker', 'exec', '-i', '--user', '10001:10001', 'nodia-gemini-microservice',
 '/usr/bin/python', '-I', '-B', '-c', observer_source], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    selection = baseline['SQL_baseline']['selection']
    observer.stdin.write(json.dumps({'model_id': selection['model_id'], 'effort_id': selection['effort_id'], 'maximum_seconds': 40}) + '\n')
    observer.stdin.flush()
    assert select.select([observer.stdout], [], [], 8)[0], 'observer_ready_timeout_no_HTTP_requested'
    ready = json.loads(observer.stdout.readline())
    assert ready['kind'] == 'ready' and ready['baseline_CLI_processes'] == 0
    report['observer_ready'] = ready; save()
    report['HTTP_observations_requested'] = 1
    report['HTTP_command_started'] = {'at_utc': datetime.now(timezone.utc).isoformat(), 'monotonic_ms': time.monotonic() * 1000}; save()
    response = subprocess.run(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-r02-metadata-observe.mjs',
      '/opt/nodia/releases/nodia-server-ai15-20261016', '/opt/nodia/verification/ai36-c05-role-canary13/nodia-server',
      str(root / 'SQL-baseline.json')], capture_output=True, check=False, timeout=45)
    report['HTTP_command_closed'] = {'at_utc': datetime.now(timezone.utc).isoformat(), 'monotonic_ms': time.monotonic() * 1000}
    (root / 'HTTP-observation.json').write_bytes(response.stdout)
    (root / 'HTTP-observation-stderr.log').write_bytes(response.stderr)
    report['HTTP_command_exit_code'] = response.returncode
    report['HTTP_observation_sha256'] = sha(response.stdout)
    # Leave at most a short post-response window for observing process closure.
    time.sleep(0.15)
    observer.stdin.write('{"kind":"stop"}\n'); observer.stdin.flush()
    remaining, errors = observer.communicate(timeout=5)
    (root / 'observer-remaining.jsonl').write_text(remaining)
    (root / 'observer-stderr.log').write_text(errors)
    report['observer_exit_code'] = observer.returncode
    data = [json.loads(line) for line in remaining.splitlines() if line.strip()]
    assert observer.returncode == 0 and len(data) == 1 and data[0]['kind'] == 'result'
    report['process_observation'] = data[0]
    assert response.returncode == 0
    report['HTTP_observation'] = json.loads(response.stdout)
    report['status'] = 'passed_diagnostic_observation_not_MCP_acceptance'
except BaseException:
    report['status'] = 'failed_diagnostic_no_inference_retry'
    raise
finally:
    if observer.poll() is None:
        try:
            observer.stdin.write('{"kind":"stop"}\n'); observer.stdin.flush()
            observer.communicate(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            # This is only the observer process; no app, CLI or profile owner is killed.
            observer.kill(); observer.communicate()
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat(); save()
    print(json.dumps(report))
