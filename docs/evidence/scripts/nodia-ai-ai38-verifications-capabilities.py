"""Run one pinned AI-38 capability case; never advances, deploys or retries.

Arguments: CANDIDATE MANIFEST_SHA preferences|finance CANARY CANARY_SHA
           CAPTURE CAPTURE_SHA WRAPPER WRAPPER_SHA --execute-case-live
Consumers must already be paused; the attested Python epoch must be unchanged.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frozen_json(path, digest):
    assert path.is_file() and re.fullmatch(r'[a-f0-9]{64}', digest)
    assert sha(path) == digest, 'frozen_artifact_changed'
    return json.loads(path.read_text(encoding='utf-8'))


def checked(argv, timeout=45):
    result = subprocess.run(argv, capture_output=True, timeout=timeout, check=False)
    assert result.returncode == 0, 'verification_control_command_failed'
    return result.stdout


def runtime():
    root = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
    files = {path.relative_to(root).as_posix(): sha(path)
             for path in sorted((root / 'dist').rglob('*')) if path.is_file()}
    assert len(files) == 932
    assert hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest() == 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
    info = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    states = {unit: checked(['systemctl', 'show', unit, '-p', 'ActiveState', '--value']).decode().strip()
              for unit in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
    assert states == {'nodia-api': 'inactive', 'nodia-ai-worker': 'inactive',
                      'nodia-gemini-lab': 'active', 'nginx': 'active'}
    assert info['State']['Running'] is True
    return {'container_id': info['Id'], 'image': info['Image'], 'started_at': info['State']['StartedAt'],
            'units': states, 'operational_Node_files': len(files), 'operational_Node_unchanged': True}


def quiet():
    sql_path = Path('/tmp/nodia-ai-ai36-c05-live-health.mjs')
    native_path = Path('/tmp/ai32-r04-cleanup.py')
    assert sha(sql_path) == 'e4f32a756acbd2ab1ae15056352eca4429a59cb780a2ab8dfe861f9d2287f395'
    assert sha(native_path) == 'a42831dce6f458af03f8a405014ebd8de8aafda6d39ca60fb00cd24829c243b7'
    sql = json.loads(checked(['/usr/local/bin/node', str(sql_path), '/opt/nodia/releases/nodia-server-ai15-20261016']))
    native = json.loads(checked(['python3', str(native_path)]))
    assert sql['pending_jobs'] == sql['open_attempts'] == sql['retained_slots'] == 0
    assert all(native[key] == 0 for key in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
               'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
    return {'SQL': sql, 'native': native}


def main():
    assert sys.argv[-1] == '--execute-case-live', 'explicit_live_case_flag_required'
    candidate_arg, manifest_sha, case_id, canary_arg, canary_sha, capture_arg, capture_sha, wrapper_arg, wrapper_sha = sys.argv[1:-1]
    assert case_id in ('preferences', 'finance')
    candidate, wrapper = Path(candidate_arg), Path(wrapper_arg)
    assert candidate.is_absolute() and candidate.resolve().is_relative_to('/opt/nodia/verification')
    assert not (candidate / '.env').exists()
    manifest = frozen_json(candidate / 'manifest.json', manifest_sha)
    assert manifest['compiled_outputs'] == 2827 and manifest['runtime_assets'] == 979
    for name, digest in manifest['files'].items():
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and '..' not in relative.parts and '.env' not in relative.parts
        assert sha(candidate / name) == digest, 'candidate_file_changed'
    assert sha(wrapper) == wrapper_sha
    canary_path, capture_path = Path(canary_arg), Path(capture_arg)
    canary = frozen_json(canary_path, canary_sha)
    capture = frozen_json(capture_path, capture_sha)
    native = canary['native_result']
    assert canary['status'] == native['status'] == 'passed'
    assert native['diagnostic_nonce_verified'] and native['native_terminal_proof_acknowledged']
    assert native['supports_mcp_after'] and not native['native_pending_identity']
    assert native['real_provider_dispatch_requests'] == 1
    assert capture['input_report_sha256'] == canary_sha
    assert capture['attempt_id'] == native['diagnostics']['attempt_id']
    assert capture['same_container_epoch_after_capture'] is True
    assert capture['container_image'] == 'sha256:b8efad6217a4f04cb135db027fd899c1826b39c3a16154cca79f1b4f0deb977e'
    before = runtime()
    assert (before['container_id'], before['image'], before['started_at']) == (
        capture['container_id'], capture['container_image'], capture['container_started_at_utc'])
    preflight_quiet = quiet()
    os.umask(0o077)
    cohort = Path('/opt/nodia/verification/ai38-live-capabilities-r01')
    cohort.mkdir(mode=0o700, exist_ok=True)
    target = cohort / case_id
    assert not target.exists(), 'preserve_prior_case_no_automatic_replay'
    target.mkdir(mode=0o700)
    root = target / 'nodia-server'
    (root / 'test').mkdir(parents=True)
    (root / '.tmp').mkdir()
    (root / 'dist').symlink_to(candidate / 'dist')
    (root / 'node_modules').symlink_to('/opt/nodia/verification/ai32-r02-20261018/node_modules')
    for name in ('package.json', 'package-lock.json'):
        shutil.copyfile(candidate / name, root / name)
    for name in manifest['files']:
        if name.startswith('test/') and name.endswith('.mjs'):
            shutil.copyfile(candidate / name, root / name)
    shutil.copyfile(wrapper, root / 'test/nodia-ai-ai38-live-capabilities.mjs')
    pin = json.loads((candidate / 'dist/nodia-ai-context/config/knowledge-pin.json').read_text(encoding='utf-8'))
    knowledge_path = candidate / 'dist/nodia-ai/knowledge/manifest.json'
    knowledge = json.loads(knowledge_path.read_text(encoding='utf-8'))
    binding = {'case_id': case_id, 'selection': native['diagnostics']['selection'],
               'session_generation': native['diagnostics']['session_generation'],
               'configuration_generation': native['diagnostics']['configuration_generation'],
               'context_pin': {**pin, 'manifest_sha256': sha(knowledge_path), 'registry_sha256': knowledge['registry_sha256']},
               'inherited_harness_sha256': manifest['files']['test/nodia-ai-ai36-c05-live.integration.mjs']}
    assert binding['selection']['effort_id'] == 'high'
    binding_path = target / 'binding.json'
    binding_path.write_text(json.dumps(binding, indent=2) + '\n', encoding='utf-8')
    case_report, supplement = target / 'case-report.json', target / 'guard-report.json'
    report = {'stage': 'AI-38', 'scope': 'one_pending_capability_case_real_High_disposable_SQL',
              'status': 'running', 'case_id': case_id, 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'candidate_manifest_sha256': manifest_sha, 'qualification_canary_sha256': canary_sha,
              'qualification_epoch_capture_sha256': capture_sha, 'context_pin': binding['context_pin'],
              'wrapper_sha256': wrapper_sha, 'source_sha256': sha(Path(__file__)),
              'maximum_native_start_requests_this_case': 2, 'maximum_planned_two_case_cohort': 4,
              'configured_SQL_writes': 0, 'operational_publication_modified': False,
              'business_effects_scope': 'synthetic_disposable_PostgreSQL_after_operator_HTTP_confirmation',
              'automatic_inference_retries': 0, 'services_restarted': False,
              'next_case_automatically_started': False, 'runtime_before': before, 'quiet_before': preflight_quiet}
    report_path = target / 'driver-report.json'
    def save():
        report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    save()
    try:
        environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODE_ENV': 'test',
                       'DOTENV_CONFIG_PATH': '/dev/null', 'NODIA_AI_ALLOW_LIVE': 'yes',
                       'NODIA_AI_C05_SEMANTIC_CONTROL': 'no', 'NODIA_AI_C05_CASE': case_id,
                       'NODIA_AI_C05_OUTPUT': str(case_report),
                       'NODIA_AI_C05_OPERATIONAL_RUNTIME': '/opt/nodia/releases/nodia-server-ai15-20261016',
                       'NODIA_AI_AI38_CAPABILITY_BINDING': str(binding_path),
                       'NODIA_AI_AI38_CAPABILITY_SUPPLEMENT': str(supplement)}
        with (target / 'private-stdout.log').open('x') as out, (target / 'private-stderr.log').open('x') as err:
            result = subprocess.run(['/usr/local/bin/node', 'test/nodia-ai-ai38-live-capabilities.mjs'],
                                    cwd=root, env=environment, stdout=out, stderr=err, timeout=1500, check=False)
        assertion = json.loads(case_report.read_text(encoding='utf-8'))
        guard = json.loads(supplement.read_text(encoding='utf-8'))
        report['exit_code'] = result.returncode
        report['case_report_sha256'] = sha(case_report)
        report['guard_report_sha256'] = sha(supplement)
        report['native_start_requests'] = guard['native_start_requests']
        report['accepted_native_starts'] = assertion['actual_provider_generations']
        report['unresolved_native_or_proof_state'] = assertion['unresolved_native_or_proof_state']
        assert report['native_start_requests'] <= 2
        assert not assertion['unresolved_native_or_proof_state'], 'reconcile_exact_identity_before_any_next_action'
        assert result.returncode == 0 and guard['status'] == assertion['status'] == 'passed'
        assert assertion['publication']['release_id'] == binding['context_pin']['release_id']
        assert assertion['publication']['manifest_sha256'] == binding['context_pin']['manifest_sha256']
        report['per_capability'] = {name: {
            'successful_callbacks': assertion['per_capability'][name]['successful_callbacks'],
            'contract_hash': assertion['per_capability'][name]['contract_hash'],
            'semantic_assertions_passed': len(assertion['per_capability'][name]['semantic_assertions']),
        } for name in guard['requested_capabilities']}
        report['successful_fixture_database_retained'] = False
        report['worker_execution_scope'] = 'native_inline_Stage_Claim_Execute_not_standalone_worker_process'
        report['status'] = 'passed'
    except BaseException as error:
        report['status'] = 'failed_no_replay_or_automatic_cleanup'
        report['failure_class'] = type(error).__name__
        raise
    finally:
        try:
            report['runtime_after'] = runtime()
            report['runtime_unchanged'] = report['runtime_after'] == before
            if not report['runtime_unchanged']:
                report['status'] = 'failed_runtime_changed_requires_review'
        except BaseException:
            report['runtime_after'] = 'not_verified_no_automatic_service_actions'
            report['status'] = 'failed_runtime_closure_requires_review'
        try:
            report['quiet_after'] = quiet()
        except BaseException:
            report['quiet_after'] = 'not_verified_preserve_fixture_and_native_identity_for_reconciliation'
            report['status'] = 'failed_requires_reconciliation_review'
        try:
            report['disposable_containers_remaining'] = len(checked(['docker', 'ps', '-a', '--filter',
                'name=template_ai3605_', '--format', '{{.Names}}']).decode().splitlines())
            if report['disposable_containers_remaining']:
                report['status'] = 'failed_fixture_retained_requires_review'
        except BaseException:
            report['disposable_containers_remaining'] = None
            report['status'] = 'failed_fixture_cleanup_not_verified'
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        save()
        print(json.dumps(report, indent=2))
    if report['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
