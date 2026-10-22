"""One R02 activation and original MCP canary; always restore the four services."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

os.umask(0o077)
root = Path('/opt/nodia/verification/ai36-c05-r02-role-canary01')
assert not root.exists()
root.mkdir(mode=0o700)
sha = lambda b: hashlib.sha256(b).hexdigest()
def run(args, timeout=120, env=None):
    return subprocess.run(args, capture_output=True, check=False, timeout=timeout, env=env)
def checked(args, timeout=120):
    p = run(args, timeout)
    assert p.returncode == 0, 'R02_control_or_activation_failed'
    return p.stdout
report = {'stage': 'AI-36-C05-R02', 'scope': 'frozen_owned_role_candidate_one_original_MCP_canary', 'status': 'running',
 'started_at_utc': datetime.now(timezone.utc).isoformat(), 'maximum_native_start_requests': 1,
 'native_start_requests': 0, 'accepted_native_starts': 0, 'business_effects': 0,
 'configured_SQL_writes': 0, 'configured_selection_modified': False, 'Node_deployed': False,
 'source_sha256': sha(Path(__file__).read_bytes()), 'automatic_inference_retries': 0}
def save(): (root / 'runner-report.json').write_text(json.dumps(report, indent=2) + '\n')
save()
try:
    activation = run(['python3', '/tmp/nodia-ai-ai36-c05-r02-role-activate.py'], 150)
    (root / 'activation-stdout.log').write_bytes(activation.stdout)
    (root / 'activation-stderr.log').write_bytes(activation.stderr)
    assert activation.returncode == 0
    report['candidate_activated'] = True; save()
    compiled = Path('/opt/nodia/verification/ai36-c05-cases-live-attempt08-reads/nodia-server')
    manifest_path = compiled / '.tmp/ai36-c05-cases-live-stage-manifest.json'
    assert sha(manifest_path.read_bytes()) == 'eb5909cf0e08ff01b309744797047c98de136d1dbfe5723882a4926ba2dfb46a'
    manifest = json.loads(manifest_path.read_text())
    compiled_files = {n: h for n, h in manifest['files'].items() if n.startswith('dist/')}
    assert len(compiled_files) == 2803 and all(sha((compiled / n).read_bytes()) == h for n, h in compiled_files.items())
    stage = root / 'nodia-server'
    (stage / 'test').mkdir(parents=True)
    for name in ('package.json', 'package-lock.json'): shutil.copyfile(compiled / name, stage / name)
    (stage / 'dist').symlink_to(compiled / 'dist'); (stage / 'node_modules').symlink_to(compiled / 'node_modules')
    for name in ('nodia-ai-ai15-live-attest.mjs', 'nodia-ai-ai36-c05-role-canary.mjs'):
        shutil.copyfile('/tmp/' + name, stage / 'test' / name)
    assert sha((stage / 'test/nodia-ai-ai15-live-attest.mjs').read_bytes()) == '604563be962df59a4b4431ad5efb2bf590b67a133a748a0d748cc90cd79ae49c'
    assert sha((stage / 'test/nodia-ai-ai36-c05-role-canary.mjs').read_bytes()) == '191877d0165c0bf4577eb836dc510b16db8d6e83a8abd5cf4dcc9b3299d38046'
    build_file = Path('/opt/nodia/verification/ai36-c05-role-candidate-build04/report.json')
    build = json.loads(build_file.read_text())
    runtime = '/opt/nodia/releases/nodia-server-ai15-20261016'
    checked(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-role-canary-input-v2.mjs', runtime, str(stage), str(root),
       '/tmp/nodia-ai-ai36-c05-current-modalities-before-role.json', build['MCP_execution_policy_sha256'], str(build_file)])
    report['selection_binding_sha256'] = sha((root / 'binding.json').read_bytes())
    report['compiled_files_verified'] = 2803
    report['compiled_manifest_sha256'] = sha(manifest_path.read_bytes())
    report['canary_command_started_at_utc'] = datetime.now(timezone.utc).isoformat(); save()
    env = {**os.environ, 'NODIA_AI_ALLOW_LIVE': 'yes', 'NODIA_AI_ATTEST_CONFIGURED_DB': 'read_only',
       'NODIA_AI_LAB_API_ENV': runtime + '/.env', 'NODIA_AI_LAB_SELECTION_JSON': str(root / 'selection.json'),
       'NODIA_AI_LAB_REPORT_JSON': str(root / 'original-ai15-report.json'),
       'NODIA_AI_C05_ROLE_CANARY_REPORT': str(root / 'canary-report.json'),
       'NODIA_AI_C05_ROLE_CANDIDATE_BINDING': str(root / 'binding.json')}
    result = run(['/usr/local/bin/node', str(stage / 'test/nodia-ai-ai36-c05-role-canary.mjs')], 300, env)
    (root / 'canary-stdout.log').write_bytes(result.stdout); (root / 'canary-stderr.log').write_bytes(result.stderr)
    canary = json.loads((root / 'canary-report.json').read_text())
    report['native_start_requests'] = canary['native_start_requests']; report['accepted_native_starts'] = canary['accepted_native_starts']
    report['canary_status'] = canary['status']; report['canary_exit_code'] = result.returncode
    report['canary_report_sha256'] = sha((root / 'canary-report.json').read_bytes())
    report['status'] = 'passed' if canary['status'] == 'passed' and result.returncode == 0 else 'failed'
except BaseException:
    report['status'] = 'failed_control_or_canary_no_retry'
    raise
finally:
    try:
        report['native_start_or_restore_exit_code'] = run(['systemctl', 'start', 'nodia-gemini-lab'], 120).returncode
    finally:
        report['API_worker_restore_exit_code'] = run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 120).returncode
        report['service_states_after'] = {n: run(['systemctl', 'is-active', n]).stdout.decode().strip() for n in ('nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx')}
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat(); save()
    print(json.dumps(report))
