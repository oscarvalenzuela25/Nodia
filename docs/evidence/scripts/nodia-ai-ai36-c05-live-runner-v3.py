"""One explicitly selected independent case; never advances to another case."""
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile

expected, attempt, case_id = sys.argv[1:4]
control = sys.argv[4:] == ['--control']
assert sys.argv[4:] in ([], ['--control'])
assert re.fullmatch(r'[a-f0-9]{64}', expected) and re.fullmatch(r'attempt[0-9]{2}', attempt)
assert case_id in ('reads', 'preferences', 'finance', 'workflow')
prefix = 'ai36-c05-cases-control' if control else 'ai36-c05-cases-live'
archive = Path('/tmp/' + prefix + '-stage.tar')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected
os.umask(0o077)
root = Path('/opt/nodia/verification/' + prefix + '-' + attempt + '-' + case_id) / 'nodia-server'
root.mkdir(parents=True, mode=0o700, exist_ok=False)
with tarfile.open(archive) as packet:
    for member in packet.getmembers():
        name = PurePosixPath(member.name)
        assert not name.is_absolute() and '..' not in name.parts and not member.issym() and not member.islnk()
        assert name.parts[0] in ('dist', 'test', '.tmp', 'package.json', 'package-lock.json')
    packet.extractall(root, filter='data')
manifest_path = root / ('.tmp/' + prefix + '-stage-manifest.json')
manifest = json.loads(manifest_path.read_text())
assert manifest['semantic_control_only'] is control
assert manifest['case_contract_version'] == 'nodia-ai-c05-independent-cases/1'
assert manifest['maximum_generations_per_case'] == 2 and manifest['maximum_generations_per_cohort'] == 8
assert not manifest.get('owned_log_observer') and not manifest.get('discovery_only')
for name, digest in manifest['files'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
assert not (root / '.env').exists()
os.symlink('/opt/nodia/verification/ai32-r02-20261018/node_modules', root / 'node_modules')


def runtime_baseline():
    operational = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
    files = {file.relative_to(operational).as_posix(): hashlib.sha256(file.read_bytes()).hexdigest()
             for file in sorted((operational / 'dist').rglob('*')) if file.is_file()}
    units = {name: subprocess.check_output(['systemctl', 'is-active', name], text=True).strip()
             for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
    info = json.loads(subprocess.check_output(['docker', 'inspect', 'nodia-gemini-microservice'], text=True))[0]
    return {'compiled_files': len(files), 'manifest_sha256': hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest(),
            'units': units, 'container': {'id': info['Id'], 'image': info['Image'], 'started_at': info['State']['StartedAt']}}


before = None
quiet = None
if not control:
    before = runtime_baseline()
    assert all(value == 'active' for value in before['units'].values())
    assert before['container']['image'] == 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
    assert before['container']['started_at'] == '2026-10-18T20:36:40.116324795Z'
    quiet = json.loads(subprocess.check_output(['python3', '/tmp/ai32-r04-cleanup.py'], text=True))
    assert all(quiet[key] == 0 for key in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
               'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
stdout, stderr, report_path = (root / '.tmp' / name for name in ('stdout.log', 'stderr.log', 'case-report.json'))
timeout = False
with stdout.open('x') as out, stderr.open('x') as err:
    try:
        result = subprocess.run(['/usr/local/bin/node', 'test/nodia-ai-ai36-c05-live.integration.mjs'], cwd=root,
            stdout=out, stderr=err, timeout=1500,
            env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODE_ENV': 'test',
                 'DOTENV_CONFIG_PATH': '/dev/null', 'NODIA_AI_ALLOW_LIVE': 'no' if control else 'yes',
                 'NODIA_AI_C05_SEMANTIC_CONTROL': 'yes' if control else 'no',
                 'NODIA_AI_C05_CASE': case_id, 'NODIA_AI_C05_OUTPUT': str(report_path),
                 **({} if control else {'NODIA_AI_C05_OPERATIONAL_RUNTIME': '/opt/nodia/releases/nodia-server-ai15-20261016'})})
        code = result.returncode
    except subprocess.TimeoutExpired:
        timeout, code = True, 124
assertion = json.loads(report_path.read_text()) if report_path.exists() else None
after = None if control else runtime_baseline()
remaining = subprocess.check_output(['docker', 'ps', '-a', '--filter',
    'name=template_' + ('ai3607_' if control else 'ai3605_'), '--format', '{{.Names}}'], text=True).splitlines()
bounded = assertion and assertion['provider_dispatch_attempts'] <= 2 and assertion['actual_provider_generations'] <= 2
receipt = {'stage': 'AI-36-C05', 'scope': 'one_independent_case_real_SQL_synthetic_transport' if control else 'one_independent_case_real_Gemini_disposable_SQL',
    'runner_contract_version': 'nodia-ai-c05-external-runner/3', 'outer_process_timeout_seconds': 1500,
    'attempt': attempt, 'case_id': case_id, 'status': 'passed' if code == 0 and before == after and not remaining and bounded else 'failed',
    'started_at_utc': started, 'completed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'exit_code': code, 'timeout': timeout, 'manifest_sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
    'archive_sha256': expected, 'compiled_files_verified': manifest['compiled_files'],
    'harness_sha256': manifest['files']['test/nodia-ai-ai36-c05-live.integration.mjs'],
    'case_fixture_sha256': manifest['files']['test/nodia-ai-ai36-c05-independent-cases.fixture.mjs'],
    'runner_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'stdout_sha256': hashlib.sha256(stdout.read_bytes()).hexdigest(), 'stderr_sha256': hashlib.sha256(stderr.read_bytes()).hexdigest(),
    'assertion_result': assertion, 'operational_runtime_before': before, 'operational_runtime_after': after,
    'operational_runtime_unchanged': before == after if not control else None,
    'preflight_native_quiet': quiet, 'services_restarted': False,
    'configured_SQL_layer': 'none' if control else 'read_only_public_selection_and_quiet_check',
    'business_effects_layer': 'synthetic_disposable_PostgreSQL_only_after_operator_HTTP_confirmation',
    'actual_provider_generations': 0 if control else assertion.get('actual_provider_generations') if assertion else None,
    'physical_UI_accepted': False, 'productive_acceptance': False, 'disposable_containers_remaining': len(remaining),
    'next_case_automatically_started': False, 'next_case_requires_explicit_operator_GO': True}
(root / '.tmp/receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'status': receipt['status'], 'case_id': case_id, 'exit_code': code,
                  'actual_provider_generations': receipt['actual_provider_generations'],
                  'unresolved_native_or_proof_state': assertion.get('unresolved_native_or_proof_state') if assertion else None}))
sys.exit(code if code else 1 if receipt['status'] != 'passed' else 0)
