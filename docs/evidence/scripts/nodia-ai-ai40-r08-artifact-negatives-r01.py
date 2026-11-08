"""Run the immutable 24 artifact checks once in an isolated R08 snapshot.

No operational DB, JWT, provider profile, SDK or R2 access. PostgreSQL and
storage are explicitly synthetic; native quiet/proofs have an external witness.
"""
import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path('/opt/nodia/verification/ai40-artifact-negatives-r01')
WORK = ROOT / 'work'
SERVER = Path('/opt/nodia/releases/nodia-server-ai40-r08')
MANIFEST = '08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
TEST = 'nodia-ai-ai15-artifacts.integration.mjs'
PINS = {TEST: '94dafb25924f02cb987f7827e886c883359f7f16f88cb32d002325a843e22d3e',
        'nodia-ai.integration.fixture.mjs': '6d595c1fa88e29c42149573dc9bdcb805a7b495aee39ac5cac4c50147bc806df'}
UNITS = ('nodia-api', 'nodia-ai-worker', 'nodia-keyring', 'nginx', 'nodia-gemini-lab')


def require(ok, code):
    if not ok:
        raise ValueError(code)


def sha(value):
    return hashlib.sha256(value).hexdigest()


def command(argv):
    result = subprocess.run(argv, capture_output=True, timeout=20, check=False)
    require(result.returncode == 0, 'metadata_command_failed')
    return result.stdout.decode().strip()


def durable(name, value):
    fd = os.open(WORK / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write((json.dumps(value, sort_keys=True) + '\n').encode())
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def services():
    return {unit: command(['systemctl', 'show', unit, '--property=MainPID,ActiveState,WorkingDirectory', '--no-pager']) for unit in UNITS}


def containers():
    lines = command(['docker', 'ps', '-a', '--format', '{{.ID}} {{.Names}}']).splitlines()
    return {line.split()[1]: line.split()[0] for line in lines if len(line.split()) == 2 and line.split()[1].startswith('template_ai')}


def main(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
    require(sha(Path(__file__).resolve().read_bytes()) == args.operator_sha256 and args.execute_isolated_pg, 'source_pin_and_explicit_flag_required')
    for path in (ROOT, WORK):
        info = path.lstat()
        require(path.resolve() == path and stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700, 'private_work_changed')
    require(not (WORK / 'intent.json').exists() and not (WORK / 'receipt.json').exists(), 'one_shot_intent_consumed')
    manifest_bytes = (SERVER / 'release-manifest.json').read_bytes()
    require(sha(manifest_bytes) == MANIFEST, 'r08_manifest_changed')
    manifest = json.loads(manifest_bytes)
    for name, pin in manifest['files'].items():
        member = SERVER / name
        require(not member.is_symlink() and member.is_file() and sha(member.read_bytes()) == pin, 'r08_member_changed')
    require((SERVER / 'node_modules').is_symlink() and (SERVER / 'node_modules').resolve() == Path('/opt/nodia/nodia-server/node_modules'), 'dependency_link_changed')
    for name, pin in PINS.items():
        require(manifest['files'].get('test/' + name) == pin, 'immutable_test_changed')
    before = services()
    for unit, pid in (('nodia-api', '3741433'), ('nodia-ai-worker', '3741434')):
        require('MainPID=' + pid in before[unit].splitlines() and 'ActiveState=active' in before[unit].splitlines() and 'WorkingDirectory=' + str(SERVER) in before[unit].splitlines(), 'active_r08_service_changed')
    require(not containers(), 'another_synthetic_fixture_present')
    image = command(['docker', 'image', 'inspect', '--format', '{{.Id}}', 'postgres:16-alpine'])
    require(re.fullmatch('sha256:[a-f0-9]{64}', image) and image == command(['docker', 'inspect', '--format', '{{.Image}}', 'nodia-lab-postgres-1']), 'installed_postgres_image_changed')
    node = command(['/usr/local/bin/node', '--version'])
    require(re.fullmatch(r'v\d+\.\d+\.\d+', node) and tuple(map(int, node[1:].split('.'))) >= (24, 20, 0), 'node_version_invalid')
    snapshot = WORK / 'snapshot'
    for path in (snapshot, snapshot / 'server', snapshot / 'server/test', snapshot / 'docs', snapshot / 'docs/evidence', WORK / 'home'):
        path.mkdir(mode=0o700)
    for name in PINS:
        target = snapshot / 'server/test' / name
        target.write_bytes((SERVER / 'test' / name).read_bytes())
        target.chmod(0o600)
    for name in ('dist', 'node_modules'):
        (snapshot / 'server' / name).symlink_to(SERVER / name, target_is_directory=True)
    report = {'schema': 'nodia-ai-ai40-r08-artifact-negatives-v1', 'status': 'failed_isolated_pg', 'operator_sha256': args.operator_sha256, 'manifest_sha256': MANIFEST, 'immutable_test_sha256': PINS, 'node_version': node, 'PostgreSQL_image_id': image, 'services_before': before, 'operational_database_accessed': False, 'operational_SQL_writes': 0, 'fixture_SQL_writes': True, 'JWT_tested': False, 'real_R2': False, 'SDK_requests': 0, 'provider_requests': 0, 'native_profile_accessed': False, 'native_quiet_proof_external': True, 'no_replay': True}
    durable('intent.json', report)
    process = None
    observed = {}
    try:
        with (WORK / 'stdout.private').open('xb') as stdout, (WORK / 'stderr.private').open('xb') as stderr:
            os.chmod(stdout.name, 0o600)
            os.chmod(stderr.name, 0o600)
            process = subprocess.Popen(['/usr/local/bin/node', str(snapshot / 'server/test' / TEST)], cwd=snapshot / 'server', env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(WORK / 'home'), 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'}, stdout=stdout, stderr=stderr, start_new_session=True)
            report['child_pid'] = process.pid
            durable('child-identity.json', {'pid': process.pid, 'container_name_pattern': '^template_ai15_' + str(process.pid) + '_[a-f0-9]{8}$'})
            deadline = time.monotonic() + 180
            while process.poll() is None:
                for name, identity in containers().items():
                    require(re.fullmatch('template_ai15_' + str(process.pid) + '_[a-f0-9]{8}', name), 'unexpected_synthetic_fixture')
                    observed[name] = identity
                require(time.monotonic() < deadline, 'child_timeout_retained_for_recovery')
                time.sleep(0.2)
        report.update(child_exit=process.returncode, observed_fixture_containers=observed, remaining_fixture_containers=containers(), services_after=services(), private_stderr_bytes=(WORK / 'stderr.private').stat().st_size, private_output_emitted=False)
        require(process.returncode == 0, 'integration_failed_private_logs_retained')
        result_path = snapshot / 'docs/evidence/nodia-ai-ai15-artifacts-integration.json'
        result_bytes = result_path.read_bytes()
        result = json.loads(result_bytes)
        require(result.get('checks') == 24 and len(result.get('passed', [])) == 24 and result.get('realGeminiInference') is False and result.get('realR2') is False, 'integration_report_invalid')
        require(len(observed) == 1 and not report['remaining_fixture_containers'] and not Path('/proc/' + str(process.pid)).exists(), 'fixture_or_child_cleanup_not_proven')
        require(report['services_after'] == before, 'operative_services_changed')
        report.update(status='passed_isolated_pg', checks=24, passed=result['passed'], synthetic_storage_calls=result['storageCalls'], report_sha256=sha(result_bytes), fixture_container_removed=True, child_process_absent=True, real_HTTP_authority_rechecked=True, synthetic_session_guard=True)
    except Exception as error:
        report['error_code'] = str(error) if isinstance(error, ValueError) and re.fullmatch('[a-z_]{1,100}', str(error)) else 'private_dependency_failure'
        if process is not None:
            report.update(child_pid=process.pid, child_exit=process.poll())
        report['observed_fixture_containers'] = observed
        report['remaining_fixture_containers'] = containers()
        report['services_after'] = services()
    finally:
        durable('receipt.json', report)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--execute-isolated-pg', action='store_true')
    try:
        output = main(parser.parse_args())
        print(json.dumps(output))
        sys.exit(0 if output['status'] == 'passed_isolated_pg' else 1)
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[a-z_]{1,100}', str(error)) else 'private_precondition_failure'
        print(json.dumps({'schema': 'nodia-ai-ai40-r08-artifact-negatives-v1', 'status': 'precondition_failed', 'code': code, 'SDK_requests': 0, 'private_details_emitted': False}))
        sys.exit(1)
