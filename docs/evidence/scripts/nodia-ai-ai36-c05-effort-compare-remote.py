"""Run only the explicitly approved two-probe comparison; never change runtime."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

script_sha, input_sha, attempt = sys.argv[1:4]
assert re.fullmatch(r'[a-f0-9]{64}', script_sha) and re.fullmatch(r'[a-f0-9]{64}', input_sha)
assert re.fullmatch(r'compare[0-9]{2}', attempt)
os.umask(0o077)
root = Path('/opt/nodia/verification/ai36-c05-effort-' + attempt)
root.mkdir(mode=0o700, exist_ok=False)
script = Path('/tmp/nodia-ai-ai36-c05-effort-compare.mjs')
input_path = Path('/tmp/nodia-ai-ai36-c05-effort-compare-input.json')
assert hashlib.sha256(script.read_bytes()).hexdigest() == script_sha
assert hashlib.sha256(input_path.read_bytes()).hexdigest() == input_sha
frozen_script, frozen_input = root / 'compare.mjs', root / 'input.json'
frozen_script.write_bytes(script.read_bytes())
frozen_input.write_bytes(input_path.read_bytes())
candidate = Path('/opt/nodia/verification/ai36-c05-live-attempt06/nodia-server')
candidate_manifest_path = candidate / '.tmp/ai36-c05-live-stage-manifest.json'
manifest = json.loads(candidate_manifest_path.read_text())
assert manifest['compiled_files'] == 2803
for name, digest in manifest['files'].items():
    assert hashlib.sha256((candidate / name).read_bytes()).hexdigest() == digest
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')


def baseline():
    files = {file.relative_to(runtime).as_posix(): hashlib.sha256(file.read_bytes()).hexdigest()
             for file in sorted((runtime / 'dist').rglob('*')) if file.is_file()}
    units = {name: subprocess.check_output(['systemctl', 'is-active', name], text=True).strip()
             for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
    container = json.loads(subprocess.check_output(['docker', 'inspect', 'nodia-gemini-microservice'], text=True))[0]
    return {'compiled_files': len(files), 'manifest_sha256': hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest(),
            'units': units, 'container': {'id': container['Id'], 'image': container['Image'], 'started_at': container['State']['StartedAt']}}


before = baseline()
assert all(value == 'active' for value in before['units'].values())
assert before['container']['image'] == 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
assert before['container']['started_at'] == '2026-10-18T20:36:40.116324795Z'
quiet = json.loads(subprocess.check_output(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-live-health.mjs', str(runtime)], text=True))
assert quiet['status'] == 'passed' and quiet['pending_jobs'] == quiet['open_attempts'] == quiet['retained_slots'] == 0
native_quiet = json.loads(subprocess.check_output(['python3', '/tmp/ai32-r04-cleanup.py'], text=True))
assert all(native_quiet[key] == 0 for key in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
           'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
stdout, stderr, report_path = root / 'stdout.log', root / 'stderr.log', root / 'report.json'
timeout = False
with stdout.open('x') as out, stderr.open('x') as err:
    try:
        completed = subprocess.run(['/usr/local/bin/node', str(frozen_script), str(candidate), str(runtime),
                                    str(frozen_input), str(report_path)], stdout=out, stderr=err, cwd=candidate,
                                   env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODE_ENV': 'test',
                                        'DOTENV_CONFIG_PATH': '/dev/null', 'NODIA_AI_ALLOW_LIVE': 'yes'}, timeout=450)
        code = completed.returncode
    except subprocess.TimeoutExpired:
        timeout, code = True, 124
after = baseline()
assertion = json.loads(report_path.read_text()) if report_path.exists() else None
receipt = {'stage': 'AI-36-C05', 'scope': 'paired_effort_two_synthetic_MCP_probes_diagnostic_only',
           'attempt': attempt, 'status': 'passed' if code == 0 and before == after else 'failed',
           'started_at_utc': started, 'finished_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'exit_code': code, 'timeout': timeout, 'script_sha256': script_sha, 'input_sha256': input_sha,
           'runner_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'candidate_manifest_sha256': hashlib.sha256(candidate_manifest_path.read_bytes()).hexdigest(),
           'compiled_files_verified': manifest['compiled_files'], 'stdout_sha256': hashlib.sha256(stdout.read_bytes()).hexdigest(),
           'stderr_sha256': hashlib.sha256(stderr.read_bytes()).hexdigest(), 'assertion_result': assertion,
           'operational_runtime_before': before, 'operational_runtime_after': after,
           'operational_runtime_unchanged': before == after, 'preflight_SQL_quiet': quiet,
           'preflight_native_quiet': native_quiet, 'services_restarted': False, 'operational_SQL_writes': 0,
           'business_capabilities_accepted': 0, 'diagnostic_only': True}
(root / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'status': receipt['status'], 'exit_code': code,
                  'actual_provider_generations': assertion.get('real_provider_generations') if assertion else None,
                  'unresolved_native_state': assertion.get('unresolved_native_state') if assertion else None}))
sys.exit(code if code else 1 if before != after else 0)
