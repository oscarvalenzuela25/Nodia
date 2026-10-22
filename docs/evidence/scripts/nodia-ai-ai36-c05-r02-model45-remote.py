"""GO45: stop the only owner, one exclusive model command, always restore services."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

os.umask(0o077)
root = Path('/opt/nodia/verification/ai36-c05-r02-model45')
assert not root.exists()
root.mkdir(mode=0o700)
baseline_root = Path('/opt/nodia/verification/ai36-c05-r02-metadata02')
baseline = json.loads((baseline_root / 'operational-baseline.json').read_text())
selection = baseline['SQL_baseline']['selection']
tool = Path('/tmp/nodia-ai-ai36-c05-r02-model45-tool.py').read_text()
def run(args, timeout=120, input=None):
    return subprocess.run(args, capture_output=True, check=False, timeout=timeout, input=input)
def checked(args, timeout=120):
    p = run(args, timeout)
    assert p.returncode == 0, 'exclusive_diagnostic_control_failed'
    return p.stdout
sha = lambda b: hashlib.sha256(b).hexdigest()
report = {'stage': 'AI-36-C05-R02', 'scope': 'oneoff_model45_same_original_image_profile_and_environment',
    'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
    'host_supervision_seconds': 60, 'CLI_timeout_seconds': 45, 'command_requests': 0,
    'provider_inference_requests': 0, 'additional_version_commands': 0, 'Node_runtime_modified': False,
    'source_sha256': sha(Path(__file__).read_bytes()), 'tool_sha256': sha(tool.encode()),
    'baseline_sha256': sha((baseline_root / 'operational-baseline.json').read_bytes())}
def save(): (root / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
save()
name = 'nodia-c05-r02-model45'
main_stopped = False
try:
    current = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    assert current['Image'] == baseline['container']['image']
    (root / 'private-main-container.json').write_text(json.dumps(current, indent=2) + '\n')
    labels = current['Config']['Labels']
    compose = ['/usr/bin/docker', 'compose', '-p', labels['com.docker.compose.project']]
    for file in labels['com.docker.compose.project.config_files'].split(','):
        compose += ['-f', file]
    checked(['systemctl', 'stop', 'nodia-ai-worker', 'nodia-api'])
    quiet = json.loads(checked(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-live-health.mjs', '/opt/nodia/releases/nodia-server-ai15-20261016']))
    native = json.loads(checked(['python3', '/tmp/ai32-r04-cleanup.py']))
    assert quiet['pending_jobs'] == quiet['open_attempts'] == quiet['retained_slots'] == 0 and quiet['preserved_r05_chat'] == 1
    assert all(native[k] == 0 for k in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
    # The original selector/configuration must still match without another observe.
    checked(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-r02-metadata-baseline.mjs',
      '/opt/nodia/releases/nodia-server-ai15-20261016', '/opt/nodia/verification/ai36-c05-role-canary13/nodia-server',
      str(baseline_root / 'SQL-baseline.json'), str(root / 'SQL-before.json')])
    checked(['systemctl', 'stop', 'nodia-gemini-lab'])
    main_stopped = True
    assert run(['docker', 'inspect', 'nodia-gemini-microservice']).returncode != 0
    started = time.monotonic()
    checked(compose + ['run', '-d', '--no-deps', '--name', name, '--pull', 'never', '--entrypoint', '/usr/bin/python',
       labels['com.docker.compose.service'], '-I', '-B', '-c', 'import time;time.sleep(90)'], 15)
    oneoff = json.loads(checked(['docker', 'inspect', name]))[0]
    env = lambda d: dict(s.split('=', 1) for s in d['Config']['Env'])
    assert oneoff['Image'] == current['Image'] and oneoff['Config']['User'] == current['Config']['User']
    assert len(env(oneoff)) == len(oneoff['Config']['Env']) and len(env(current)) == len(current['Config']['Env'])
    assert env(oneoff) == env(current)
    assert sorted(oneoff['Mounts'], key=lambda m: m['Destination']) == sorted(current['Mounts'], key=lambda m: m['Destination'])
    assert not oneoff['HostConfig']['PortBindings'] and not oneoff['NetworkSettings']['Ports'].get('8000/tcp')
    for key in ('Memory', 'NanoCpus', 'Tmpfs', 'NetworkMode', 'SecurityOpt', 'CapAdd', 'PidsLimit'):
        assert oneoff['HostConfig'][key] == current['HostConfig'][key], 'resource_or_security_mismatch'
    report['oneoff_precommand_verified'] = {'image_unchanged': True, 'environment_equal_unique': True,
       'all_six_mounts_equal': True, 'UID_equal': True, 'resources_and_security_equal': True, 'published_ports': 0,
       'main_owner_stopped': True, 'API_worker_stopped': True}
    # Check only numeric process names before invoking CLI; no profile inspection.
    check = "from pathlib import Path;import json;rows=[]\nfor p in Path('/proc').iterdir():\n if p.name.isdigit():\n  try:\n   a=(p/'cmdline').read_bytes().split(b'\\0',1)[0];rows.append(a.rsplit(b'/',1)[-1]==b'agy')\n  except OSError:pass\nprint(json.dumps({'CLI_processes':sum(rows)}))"
    assert json.loads(checked(['docker', 'exec', name, '/usr/bin/python', '-I', '-B', '-c', check]))['CLI_processes'] == 0
    report['command_requests'] = 1; save()
    try:
        result = run(['docker', 'exec', '-i', '--user', '10001:10001', name, '/usr/bin/python', '-I', '-B', '-c', tool],
          max(1, 60 - (time.monotonic() - started)), json.dumps(selection).encode())
        (root / 'command-report.json').write_bytes(result.stdout)
        (root / 'tool-stderr.log').write_bytes(result.stderr)
        report['tool_exit_code'] = result.returncode
        report['command_result'] = json.loads(result.stdout) if result.returncode == 0 else None
        report['status'] = 'completed_diagnostic_not_provider_acceptance'
    except subprocess.TimeoutExpired:
        report['status'] = 'host_supervisor_timeout'
    report['oneoff_elapsed_ms_before_cleanup'] = (time.monotonic() - started) * 1000
finally:
    # Only the exclusive oneoff container is removed; never kill another owner.
    stopped = run(['docker', 'rm', '-f', name], 10)
    report['oneoff_absent_before_main_restore'] = run(['docker', 'inspect', name]).returncode != 0
    assert report['oneoff_absent_before_main_restore']
    checked(['systemctl', 'start', 'nodia-gemini-lab'], 120)
    restored = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    assert restored['Image'] == baseline['container']['image'] and restored['State']['Health']['Status'] == 'healthy'
    checked(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'])
    report['services_after'] = {n: checked(['systemctl', 'is-active', n]).decode().strip() for n in ('nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx')}
    report['restored_image_id'] = restored['Image']
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat(); save()
    print(json.dumps(report))
