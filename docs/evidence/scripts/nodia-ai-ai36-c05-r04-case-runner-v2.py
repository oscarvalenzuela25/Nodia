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
control = False
assert sys.argv[4:] == []
assert re.fullmatch(r'[a-f0-9]{64}', expected) and re.fullmatch(r'attempt[0-9]{2}', attempt)
assert case_id in ('preferences', 'finance')
prefix = 'ai36-c05-cases-control' if control else 'ai36-c05-cases-live'
archive = Path('/tmp/' + prefix + '-stage.tar')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected
os.umask(0o077)
root = Path('/opt/nodia/verification/ai36-c05-r04-cases-' + attempt + '-' + case_id) / 'nodia-server'
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
    units = {name: subprocess.run(['systemctl', 'is-active', name], capture_output=True, text=True, check=False).stdout.strip()
             for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
    info = json.loads(subprocess.check_output(['docker', 'inspect', 'nodia-gemini-microservice'], text=True))[0]
    return {'compiled_files': len(files), 'manifest_sha256': hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest(),
            'units': units, 'container': {'id': info['Id'], 'image': info['Image'], 'started_at': info['State']['StartedAt']}}


before = None
quiet = None
if not control:
    epoch_root = Path('/opt/nodia/verification/ai36-c05-r04-role-canary01')
    epoch_path = epoch_root / 'runner-report.json'
    epoch = json.loads(epoch_path.read_text())
    canary_path = epoch_root / 'canary-report.json'
    canary = json.loads(canary_path.read_text())
    assert epoch['status'] == canary['status'] == 'passed'
    assert canary['accepted_native_starts'] == 1 and canary['fixture_callbacks_observed'] == 1
    assert len(canary['proofs']) == len(canary['acknowledgements']) == 1
    proof, ack = canary['proofs'][0], canary['acknowledgements'][0]
    assert proof['outcome'] == 'completed' and proof['process_closed'] is True
    assert proof['attempt_id'] == ack['attempt_id'] == canary['attempt_id']
    assert proof['terminal_proof_sha256'] == ack['terminal_proof_sha256'] and ack['acknowledged'] is True
    assert canary['attestation']['verified'] is True
    assert canary['image_binding']['role_policy_sha256'] == '7820451f2eec37bfdff82b49c9f3e170cd051f9bfdde14eb119ec2d9fc1c85fc'
    before = runtime_baseline()
    assert before['units'] == {'nodia-api': 'inactive', 'nodia-ai-worker': 'inactive', 'nodia-gemini-lab': 'active', 'nginx': 'active'}
    assert before['container']['image'] == canary['image_binding']['candidate_image_id'] == epoch['epoch']['image']
    assert before['container']['id'] == epoch['epoch']['id']
    assert before['container']['started_at'] == epoch['epoch']['started_at']
    assert before['compiled_files'] == 932 and before['manifest_sha256'] == 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
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
receipt = {'stage': 'AI-36-C05-R04', 'scope': 'one_independent_case_real_Gemini_disposable_SQL_same_attested_owned_role_epoch',
    'runner_contract_version': 'nodia-ai-c05-external-runner/7-r04', 'outer_process_timeout_seconds': 1500,
    'epoch_runner_sha256': hashlib.sha256(epoch_path.read_bytes()).hexdigest(),
    'qualification_canary_sha256': hashlib.sha256(canary_path.read_bytes()).hexdigest(),
    'qualified_image_id': canary['image_binding']['candidate_image_id'],
    'qualified_role_policy_sha256': canary['image_binding']['role_policy_sha256'],
    'qualification_canary_proof_sha256': proof['terminal_proof_sha256'],
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
