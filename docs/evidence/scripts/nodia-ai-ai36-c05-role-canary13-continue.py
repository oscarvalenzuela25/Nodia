"""One authorized metadata refresh, then the unconsumed GO13 canary if eligible."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess

os.umask(0o077)
root = Path('/opt/nodia/verification/ai36-c05-role-canary13')
out = root / 'continuation-report.json'
assert not out.exists() and not (root / 'canary-report.json').exists()
stage = root / 'nodia-server'
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
sha = lambda b: hashlib.sha256(b).hexdigest()
def run(args, timeout=120, env=None):
    return subprocess.run(args, capture_output=True, timeout=timeout, env=env, check=False)
report = {'stage': 'AI-36-C05-R01', 'scope': 'GO13_one_metadata_refresh_then_unconsumed_single_canary',
    'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
    'native_start_requests': 0, 'accepted_native_starts': 0, 'maximum_native_start_requests': 1,
    'source_runner_sha256': sha(Path(__file__).read_bytes()), 'inference_retry': False,
    'previous_preflight_failed_before_any_native_start': True}
def save(): out.write_text(json.dumps(report, indent=2) + '\n')
save()
try:
    fresh = run(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-role-fresh-high-preflight.mjs', str(runtime), str(stage), str(root / 'binding.json')], 60)
    (root / 'fresh-high-preflight.json').write_bytes(fresh.stdout)
    (root / 'fresh-high-preflight-stderr.log').write_bytes(fresh.stderr)
    assert fresh.returncode == 0
    value = json.loads(fresh.stdout)
    report['metadata_requests'] = value['metadata_requests']
    report['observation'] = value['observations'][0]
    assert value['metadata_requests'] == 1
    if value['can_proceed_to_one_canary']:
        report['canary_command_started_at_utc'] = datetime.now(timezone.utc).isoformat(); save()
        env = {**os.environ, 'NODIA_AI_ALLOW_LIVE': 'yes', 'NODIA_AI_ATTEST_CONFIGURED_DB': 'read_only',
           'NODIA_AI_LAB_API_ENV': str(runtime / '.env'), 'NODIA_AI_LAB_SELECTION_JSON': str(root / 'selection.json'),
           'NODIA_AI_LAB_REPORT_JSON': str(root / 'original-ai15-report.json'),
           'NODIA_AI_C05_ROLE_CANARY_REPORT': str(root / 'canary-report.json'),
           'NODIA_AI_C05_ROLE_CANDIDATE_BINDING': str(root / 'binding.json')}
        canary = run(['/usr/local/bin/node', str(stage / 'test/nodia-ai-ai36-c05-role-canary.mjs')], 300, env)
        (root / 'canary-stdout.log').write_bytes(canary.stdout)
        (root / 'canary-stderr.log').write_bytes(canary.stderr)
        result = json.loads((root / 'canary-report.json').read_text())
        report['canary_exit_code'] = canary.returncode
        report['native_start_requests'] = result['native_start_requests']
        report['accepted_native_starts'] = result['accepted_native_starts']
        report['canary_report_sha256'] = sha((root / 'canary-report.json').read_bytes())
        report['status'] = 'passed' if canary.returncode == 0 and result['status'] == 'passed' else 'failed'
    else:
        report['status'] = 'preflight_unavailable_no_native_start'
        stat = run(['docker', 'stats', '--no-stream', '--format', '{{json .}}', 'nodia-gemini-microservice'])
        data = json.loads(stat.stdout)
        report['public_resource_snapshot'] = {k: data.get(k) for k in ('CPUPerc', 'MemUsage', 'MemPerc', 'PIDs')}
except BaseException:
    report['status'] = 'failed'
    raise
finally:
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat(); save()
    print(json.dumps(report))
