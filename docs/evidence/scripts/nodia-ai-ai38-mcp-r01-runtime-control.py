"""Single-owner diagnostics activation/rollback/resume; never infer or clear proofs."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path('/opt/nodia/verification/ai38-mcp-r01-activation')
DROPIN = Path('/etc/systemd/system/nodia-gemini-lab.service.d/ai38-mcp-r01.conf')
BASE = 'sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa'
CANDIDATE = 'sha256:b8efad6217a4f04cb135db027fd899c1826b39c3a16154cca79f1b4f0deb977e'
BUILD = Path('/opt/nodia/verification/ai38-mcp-r01-candidate-build02/report.json')
BUILD_SHA = 'ae4ccf3810ca7b1693e85eb54a93c6715537d8e6dc0ad72abf0f4cf1cc6b8dca'
ROLE = Path('/etc/systemd/system/nodia-gemini-lab.service.d/ai36-c05-role.conf')
ROLE_SHA = '4d322139517dbcf55a0750af722ed9b54719bcc49ea60f52545225ace8054a87'
UNITS = ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')
os.umask(0o077)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args, timeout=120):
    result = subprocess.run(args, capture_output=True, timeout=timeout, check=False)
    if result.returncode:
        raise RuntimeError('maintenance_command_failed')
    return result.stdout


def state(unit):
    return run(['systemctl', 'show', unit, '-p', 'ActiveState', '--value']).decode().strip()


def inspect():
    return json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']))[0]


def quiet():
    assert sha(Path('/tmp/nodia-ai-ai36-c05-live-health.mjs')) == 'e4f32a756acbd2ab1ae15056352eca4429a59cb780a2ab8dfe861f9d2287f395', 'SQL_helper_changed'
    assert sha(Path('/tmp/ai32-r04-cleanup.py')) == 'a42831dce6f458af03f8a405014ebd8de8aafda6d39ca60fb00cd24829c243b7', 'native_helper_changed'
    sql = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-live-health.mjs',
                          '/opt/nodia/releases/nodia-server-ai15-20261016']))
    assert sql['pending_jobs'] == sql['open_attempts'] == sql['retained_slots'] == 0, 'SQL_not_quiet'
    native = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    keys = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
            'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')
    assert all(native[key] == 0 for key in keys), 'native_not_quiet_do_not_restart'
    return {'SQL': sql, 'native': native}


def equivalent(before, after, image):
    assert after['Image'] == image and after['State']['Running'], 'image_or_running_mismatch'
    assert sorted(before['Mounts'], key=lambda x: x['Destination']) == sorted(after['Mounts'], key=lambda x: x['Destination'])
    env = lambda value: dict(item.split('=', 1) for item in value['Config']['Env'])
    assert len(env(before)) == len(before['Config']['Env']) and len(env(after)) == len(after['Config']['Env'])
    assert env(before) == env(after), 'environment_changed'
    assert before['Config']['User'] == after['Config']['User'], 'UID_changed'
    for key in ('PortBindings', 'Memory', 'NanoCpus', 'Tmpfs', 'RestartPolicy', 'NetworkMode'):
        assert before['HostConfig'][key] == after['HostConfig'][key], 'resources_changed'
    assert sha(ROLE) == ROLE_SHA, 'original_dropin_changed'


def node_pin():
    root = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
    values = {path.relative_to(root).as_posix(): sha(path) for path in sorted((root / 'dist').rglob('*')) if path.is_file()}
    assert len(values) == 932, 'operational_Node_file_count_changed'
    digest = hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()
    assert digest == 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792', 'operational_Node_pin_changed'
    return {'files': len(values), 'aggregate_sha256': digest}


mode = sys.argv[1]
assert mode in ('activate', 'restore', 'resume')
assert os.geteuid() == 0
if mode == 'activate':
    assert not ROOT.exists() and not DROPIN.exists(), 'activation_already_owned_or_present'
    assert sha(BUILD) == BUILD_SHA, 'build_report_changed'
    build = json.loads(BUILD.read_text(encoding='utf-8'))
    assert build['status'] == 'passed' and build['candidate_image_id'] == CANDIDATE
    assert build['Linux_tests_discovered_and_executed'] == 442 and build['Linux_runtime_skips'] == 0
    assert sha(ROLE) == ROLE_SHA
    before = inspect()
    assert before['Image'] == BASE and before['State']['Running']
    assert before['Config']['User'] == 'nodia' and len(before['Mounts']) == 6
    assert {unit: state(unit) for unit in UNITS} == dict.fromkeys(UNITS, 'active')
    ROOT.mkdir(mode=0o700)
    (ROOT / 'private-original-container.json').write_text(json.dumps(before), encoding='utf-8')
    (ROOT / 'private-original-unit.txt').write_bytes(run(['systemctl', 'cat', 'nodia-gemini-lab']))
    labels = before['Config']['Labels']
    assert labels['com.docker.compose.project'] == 'nodia-gemini-lab'
    assert labels['com.docker.compose.service'] == 'nodia-gemini-microservice'
    override = ROOT / 'docker-compose.candidate.yml'
    override.write_text('services:\n  nodia-gemini-microservice:\n    image: "' + CANDIDATE + '"\n    pull_policy: never\n', encoding='utf-8')
    argv = ['/usr/bin/docker', 'compose', '-p', labels['com.docker.compose.project']]
    for value in labels['com.docker.compose.project.config_files'].split(','):
        assert Path(value).is_file()
        argv += ['-f', value]
    argv += ['-f', str(override), 'up', '-d', '--wait', '--wait-timeout', '90', '--no-build', '--pull', 'never']
    assert all(not any(char.isspace() for char in value) for value in argv)
    content = '[Service]\nExecStart=\nExecStart=' + ' '.join(argv) + '\n'
    (ROOT / 'private-new-dropin.conf').write_text(content, encoding='utf-8')
    report = {'stage': 'AI-38-MCP-R01', 'scope': 'temporary_single_owner_diagnostics_activation',
              'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'original_image_id': BASE, 'candidate_image_id': CANDIDATE,
              'build_report_sha256': BUILD_SHA, 'provider_generations': 0, 'steps': [],
              'new_dropin_sha256': sha(ROOT / 'private-new-dropin.conf'), 'Node_before': node_pin()}
else:
    assert ROOT.is_dir()
    before = json.loads((ROOT / 'private-original-container.json').read_text(encoding='utf-8'))
    activation = json.loads((ROOT / 'activate.json').read_text(encoding='utf-8'))
    assert not (ROOT / (mode + '.json')).exists(), 'action_already_recorded'
    assert sha(ROLE) == ROLE_SHA
    report = {'stage': 'AI-38-MCP-R01', 'scope': 'resume_verified_minimal_diagnostics_runtime' if mode == 'resume' else 'restore_original_runtime_after_diagnostics',
              'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'original_image_id': BASE, 'candidate_image_id': CANDIDATE, 'provider_generations': 0,
              'steps': [], 'Node_before': activation['Node_before']}

target = ROOT / (mode + '.json')


def save():
    target.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


save()
try:
    if mode == 'resume':
        assert activation['status'] == 'passed' and sha(DROPIN) == activation['new_dropin_sha256']
        canary = json.loads(Path('/opt/nodia/verification/ai38-mcp-r01-live01/public-report.json').read_text(encoding='utf-8'))
        assert canary['status'] == 'passed' and canary['native_pending_identity'] is False
        native = canary['native_result']
        assert native['diagnostic_nonce_verified'] and native['native_terminal_proof_acknowledged'] and native['supports_mcp_after']
        current = inspect()
        assert current['Id'] == activation['container_id'] and current['State']['StartedAt'] == activation['container_started_at_utc']
        equivalent(before, current, CANDIDATE)
        report['quiet_before_resume'] = quiet()
        report['Node_after'] = node_pin()
        assert report['Node_after'] == report['Node_before']
        run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'])
        assert {unit: state(unit) for unit in UNITS} == dict.fromkeys(UNITS, 'active')
        after = inspect()
        assert after['Id'] == current['Id'] and after['State']['StartedAt'] == current['State']['StartedAt']
        report['candidate_container_id'] = current['Id']
        report['candidate_started_at_utc'] = current['State']['StartedAt']
        report['native_restarts_by_resume'] = 0
        report['minimal_Python_diagnostics_retained'] = True
        report['historical_timeout_cause'] = 'unproven_no_causal_fix_claim'
        report['canary_sha256'] = sha(Path('/opt/nodia/verification/ai38-mcp-r01-live01/public-report.json'))
        report['service_states_after'] = {unit: state(unit) for unit in UNITS}
        report['status'] = 'passed'
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        save()
        sys.exit(0)
    run(['systemctl', 'stop', 'nodia-ai-worker', 'nodia-api'])
    report['steps'].append('consumers_paused')
    report['quiet_before_restart'] = quiet()
    save()
    if mode == 'restore' and DROPIN.exists():
        assert sha(DROPIN) == activation['new_dropin_sha256'], 'owned_dropin_changed'
    run(['systemctl', 'stop', 'nodia-gemini-lab'])
    stopped = subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'], capture_output=True, check=False)
    if stopped.returncode == 0:
        assert json.loads(stopped.stdout)[0]['State']['Running'] is False, 'previous_owner_still_running'
    else:
        assert stopped.returncode == 1 and b'No such object' in stopped.stderr, 'container_stop_unknown'
    report['steps'].append('unique_native_owner_stopped')
    if mode == 'activate':
        with DROPIN.open('x', encoding='utf-8') as stream:
            stream.write(content)
    elif DROPIN.exists():
        DROPIN.unlink()
    save()
    run(['systemctl', 'daemon-reload'])
    run(['systemctl', 'start', 'nodia-gemini-lab'])
    after = inspect()
    equivalent(before, after, CANDIDATE if mode == 'activate' else BASE)
    report['steps'].append('verified_unique_native_owner_started')
    report['container_id'] = after['Id']
    report['container_started_at_utc'] = after['State']['StartedAt']
    report['MCP_after_restart'] = 'unknown_requires_current_instance_evidence'
    report['environment_mounts_UID_ports_resources_unchanged'] = True
    report['Node_after'] = node_pin()
    assert report['Node_after'] == report['Node_before'], 'operational_Node_changed'
    report['quiet_after_restart'] = quiet()
    if mode == 'restore':
        run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'])
        assert {unit: state(unit) for unit in UNITS} == dict.fromkeys(UNITS, 'active')
    else:
        assert state('nodia-api') == state('nodia-ai-worker') == 'inactive'
    report['service_states_after'] = {unit: state(unit) for unit in UNITS}
    report['status'] = 'passed'
except Exception as exc:
    report['status'] = 'failed_requires_review_no_inference_or_restart_retry'
    report['failure_class'] = type(exc).__name__
    raise
finally:
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    save()
    print(json.dumps(report))
