"""Explicit two-phase Gemini image adoption; no build, HTTP, inference or replay.

Each phase is a new pinned plan/image with independent work/dropin and receipts.
Adopting or rolling back necessarily creates a new Gemini process epoch.
Root must inspect failures; uncertain work is never forcibly stopped or replayed.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time

BASE = Path('/opt/nodia/verification')
UNIT = 'nodia-gemini-lab'
CONTAINER = 'nodia-gemini-microservice'
HELPER = Path('/tmp/nodia-ai-ai38-journal-activate.py')
HELPER_SHA = '56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
SERVER = Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
SERVER_MANIFEST_SHA = '4c3fe6d600adab362a71c5f76357383e98aa7acda7c93aa73e61bfb29c626f92'
IMAGE = re.compile(r'sha256:[a-f0-9]{64}')
NAME = re.compile(r'[A-Za-z0-9_]+\.py')


def require(ok, code):
    if not ok:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checked(argv, timeout=30):
    value = subprocess.run(argv, capture_output=True, timeout=timeout, check=False)
    require(value.returncode == 0, 'operator_command_failed')
    return value.stdout


def inspect():
    return json.loads(checked(['docker', 'inspect', CONTAINER]))[0]


def load_plan(path, pin):
    require(re.fullmatch('[a-f0-9]{64}', pin) and sha(path) == pin, 'plan_pin_mismatch')
    value = json.loads(path.read_bytes())
    fields = {'schema_version', 'phase', 'source_image_id', 'target_image_id', 'source_python_hashes',
              'target_python_hashes', 'changed_python_files'}
    require(set(value) == fields and value['schema_version'] == 1 and value['phase'] in ('diag', 'fix'), 'plan_invalid')
    require(all(IMAGE.fullmatch(value[k]) for k in ('source_image_id', 'target_image_id')) and
            value['source_image_id'] != value['target_image_id'], 'image_ids_invalid')
    for key in ('source_python_hashes', 'target_python_hashes'):
        hashes = value[key]
        require(isinstance(hashes, dict) and 1 <= len(hashes) <= 128 and
                all(NAME.fullmatch(n) and re.fullmatch('[a-f0-9]{64}', h) for n, h in hashes.items()),
                'public_source_plan_invalid')
    old, new = value['source_python_hashes'], value['target_python_hashes']
    changed = {n for n in set(old) | set(new) if old.get(n) != new.get(n)}
    require(isinstance(value['changed_python_files'], list) and 1 <= len(changed) <= 12 and
            changed == set(value['changed_python_files']) and len(changed) == len(value['changed_python_files']),
            'changed_source_inventory_invalid')
    return value


def public_sources():
    program = "import pathlib,hashlib,json;print(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path('/app').glob('*.py') if p.is_file() and not p.is_symlink()}))"
    return json.loads(checked(['docker', 'exec', '--user', '10001:10001', CONTAINER, 'python', '-B', '-c', program]))


def same_configuration(old, new):
    require(new['State']['Running'], 'new_container_not_running')
    require(sorted(old['Mounts'], key=lambda m: m['Destination']) == sorted(new['Mounts'], key=lambda m: m['Destination']),
            'mount_configuration_changed')
    require(sorted(old['Config']['Env']) == sorted(new['Config']['Env']) and
            old['Config']['User'] == new['Config']['User'] and old['Config']['Cmd'] == new['Config']['Cmd'] and
            old['Config']['Entrypoint'] == new['Config']['Entrypoint'], 'process_configuration_changed')
    keys = ('PortBindings', 'Memory', 'NanoCpus', 'Tmpfs', 'RestartPolicy', 'NetworkMode',
            'PidsLimit', 'SecurityOpt', 'Init', 'ShmSize')
    require(all(old['HostConfig'][k] == new['HostConfig'][k] for k in keys), 'resource_configuration_changed')


def epoch(value):
    return dict(container_id=value['Id'], image_id=value['Image'], started_at_utc=value['State']['StartedAt'])


def image_derivative(source, target):
    old, new = [json.loads(checked(['docker', 'image', 'inspect', image]))[0] for image in (source, target)]
    require(old['Id'] == source and new['Id'] == target, 'local_image_identity_mismatch')
    layers = old['RootFS']['Layers']
    require(new['RootFS']['Layers'][:len(layers)] == layers and len(new['RootFS']['Layers']) > len(layers),
            'target_not_derived_from_exact_source_image')
    # COPY-only image build provenance is reviewed separately; this check alone
    # does not prove what a new layer contains.
    return dict(source_layers=len(layers), target_layers=len(new['RootFS']['Layers']), source_layer_prefix_preserved=True)


def wait_idle(a):
    deadline = time.monotonic() + 45
    while any(a.state(u)['active'] not in ('inactive', 'failed') for u in ('nodia-ai-backup', 'nodia-ai-backup-rotate')):
        require(time.monotonic() < deadline, 'backup_oneshot_not_idle')
        time.sleep(.5)


def safe_code(error):
    value = str(error)
    return value if isinstance(error, ValueError) and re.fullmatch('[a-z_]{1,100}', value) else 'operation_failed'


def run(args):
    require(os.geteuid() == 0 and sys.flags.optimize == 0, 'root_unoptimized_python_required')
    require(args.action == 'preflight' or args.execute, 'explicit_execute_required')
    plan = load_plan(Path(args.plan), args.plan_sha256)
    require(sha(HELPER) == HELPER_SHA, 'helper_pin_mismatch')
    spec = importlib.util.spec_from_file_location('pinned_activation', HELPER)
    a = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(a)
    _, h = a.load_helpers()
    a.RELEASE = SERVER
    require(sha(SERVER / 'release-manifest.json') == SERVER_MANIFEST_SHA, 'Server_package_pin_mismatch')
    work = BASE / ('ai38-profile-reservation-' + plan['phase'] + '-r01')
    dropin = Path('/etc/systemd/system/nodia-gemini-lab.service.d') / ('zz-ai38-profile-reservation-' + plan['phase'] + '.conf')
    source_key, target_key = ('target_image_id', 'source_image_id') if args.action == 'rollback' else ('source_image_id', 'target_image_id')
    source_hashes, target_hashes = (plan['target_python_hashes'], plan['source_python_hashes']) if args.action == 'rollback' else (plan['source_python_hashes'], plan['target_python_hashes'])
    before = inspect()
    require(before['State']['Running'] and before['Image'] == plan[source_key], 'unexpected_live_source_image')
    require(public_sources() == source_hashes, 'source_public_inventory_mismatch')
    consumers = a.active_new_processes()
    schema = h['schema_and_selection']()
    journal = a.journal('status')
    require(journal['unconfirmed'] == journal['expired_backups'] == 0, 'journal_not_ready')
    quiet = h['quiet']()
    operator = a.operator_configuration()
    timers = {u: a.state(u)['active'] for u in a.TIMERS}
    require(all(v == 'active' for v in timers.values()), 'timers_not_active')
    package = dict(server_manifest_sha256=sha(SERVER / 'release-manifest.json'), server_consumers=consumers,
                   nginx_sha256=sha(a.NGINX), nginx_state=a.state('nginx'))
    derivative = image_derivative(plan['source_image_id'], plan['target_image_id'])
    report = dict(stage='AI-38', action=args.action, phase=plan['phase'], plan_sha256=args.plan_sha256,
                  self_sha256=sha(Path(__file__)), epoch_before=epoch(before), public_sources_before=source_hashes,
                  derivative=derivative, journal_before=journal, quiet_before=quiet, package=package)
    if args.action == 'preflight':
        require(not dropin.exists() and not work.exists(), 'phase_already_owned')
        return dict(report, status='preflight_passed_no_mutations', provider_generation_requests=0,
                    metadata_startup_checks_not_counted=True, services_restarted=False)
    require(not work.is_symlink(), 'unsafe_work_directory')
    if args.action == 'adopt':
        require(not work.exists() and not dropin.exists(), 'phase_already_owned')
        work.mkdir(mode=0o700)
    require(work.resolve() == work and work.stat().st_uid == 0 and stat.S_IMODE(work.stat().st_mode) == 0o700,
            'private_work_directory_invalid')
    lock_fd = os.open(work / 'deployment.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, 'r+b') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        a.WORK = work
        require(not (work / (args.action + '-before.json')).exists(), 'transition_replay_forbidden')
        if args.action == 'adopt':
            a.write_new(work / 'private-container-before.json', json.dumps(before).encode())
            a.write_new(work / 'private-unit-before.txt', checked(['systemctl', 'cat', UNIT]))
            labels = before['Config']['Labels']
            require(labels['com.docker.compose.project'] == 'nodia-gemini-lab' and
                    labels['com.docker.compose.service'] == CONTAINER, 'compose_owner_mismatch')
            override = work / 'docker-compose.image.yml'
            a.write_new(override, ('services:\n  ' + CONTAINER + ':\n    image: "' + plan[target_key] + '"\n    pull_policy: never\n').encode())
            argv = ['/usr/bin/docker', 'compose', '-p', 'nodia-gemini-lab']
            for filename in labels['com.docker.compose.project.config_files'].split(','):
                path = Path(filename)
                require(path.is_absolute() and path.is_file() and path.resolve() == path, 'compose_source_file_invalid')
                argv += ['-f', filename]
            argv += ['-f', str(override), 'up', '-d', '--wait', '--wait-timeout', '90', '--no-build', '--pull', 'never']
            require(all(not any(char.isspace() for char in word) for word in argv), 'unsafe_ExecStart_argument')
            descriptor = ('[Service]\nExecStart=\nExecStart=' + ' '.join(argv) + '\n').encode()
            a.write_new(work / 'private-new-dropin.conf', descriptor)
        else:
            previous = json.loads((work / 'adopt-after.json').read_bytes())
            require(previous['status'] == 'adopt_completed' and previous['plan_sha256'] == args.plan_sha256,
                    'rollback_requires_successful_matching_adoption')
            require(dropin.read_bytes() == (work / 'private-new-dropin.conf').read_bytes(), 'dropin_changed')
        a.freeze(args.action + '-before.json', report)
        timers_paused = admission_closing = native_transition = False
        try:
            timers_paused = True
            checked(['systemctl', 'stop', *a.TIMERS])
            wait_idle(a)
            # Native CLI proves live journaled writers and encrypts stream to
            # the external catalog; no plaintext dump or private RSA is created.
            captured_begin = datetime.now(timezone.utc)
            backup = json.loads(checked(['sudo', '-u', 'nodia', '/usr/local/bin/node',
                        str(SERVER / 'scripts/nodia-ai-backups.mjs'), 'backup', str(a.BACKUP)], timeout=240))
            captured = datetime.fromisoformat(backup['captured_at'].replace('Z', '+00:00'))
            expires = datetime.fromisoformat(backup['expires_at'].replace('Z', '+00:00'))
            require(backup['operation'] == 'backup' and backup['status'] == 'ready' and
                    re.fullmatch('[a-f0-9]{64}', backup['cipher_sha256']) and backup['cipher_bytes'] > 0 and
                    captured_begin <= captured <= datetime.now(timezone.utc) and
                    (expires - captured).total_seconds() == 7 * 86400, 'fresh_backup_invalid')
            a.freeze(args.action + '-backup.json', backup)
            require(a.active_new_processes() == consumers, 'Server_changed_before_drain')
            admission_closing = True
            checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
            require(a.stopped('nodia-api'), 'API_not_stopped')
            report['drained'] = a.wait_quiet(h, seconds=45)
            checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
            require(all(a.stopped(u) for u in a.CONSUMERS), 'Server_consumers_not_stopped')
            native_transition = True
            checked(['systemctl', 'stop', UNIT], timeout=60)
            stopped = subprocess.run(['docker', 'inspect', CONTAINER], capture_output=True, timeout=15, check=False)
            require((stopped.returncode == 0 and not json.loads(stopped.stdout)[0]['State']['Running']) or
                    (stopped.returncode == 1 and b'No such object' in stopped.stderr), 'old_native_owner_not_stopped')
            if args.action == 'adopt':
                a.write_new(dropin, (work / 'private-new-dropin.conf').read_bytes(), 0o644)
            else:
                # Remove only this phase's exact own descriptor; never a parent
                # phase's override, source image, volume or journal artifact.
                require(dropin.read_bytes() == (work / 'private-new-dropin.conf').read_bytes(), 'dropin_changed')
                dropin.unlink()
            checked(['systemctl', 'daemon-reload'])
            if args.action == 'rollback':
                require(checked(['systemctl', 'cat', UNIT]) == (work / 'private-unit-before.txt').read_bytes(),
                        'previous_effective_descriptor_not_restored')
            checked(['systemctl', 'start', UNIT], timeout=120)
            after = inspect()
            require(after['Image'] == plan[target_key], 'new_image_mismatch')
            same_configuration(before, after)
            require(public_sources() == target_hashes, 'target_public_source_inventory_mismatch')
            require(after['State']['StartedAt'] != before['State']['StartedAt'], 'new_epoch_not_observed')
            require(h['schema_and_selection']() == schema and a.operator_configuration() == operator and
                    sha(a.NGINX) == package['nginx_sha256'] and a.state('nginx') == package['nginx_state'],
                    'unrelated_configuration_changed')
            checked(['systemctl', 'start', *a.CONSUMERS], timeout=45)
            new_consumers = a.wait_health()
            quiet_after = a.wait_quiet(h, seconds=45)
            journal_after = a.journal('status')
            require(all(journal_after[key] == journal[key] for key in (
                'coverage_from', 'first_sequence', 'last_sequence', 'coverage_closed_at')) and
                journal_after['unconfirmed'] == 0, 'journal_era_or_entries_changed')
            checked(['systemctl', 'start', *a.TIMERS])
            require(all(a.state(u)['active'] == timers[u] for u in a.TIMERS), 'timer_restoration_failed')
            timers_paused = False
            result = dict(report, status=args.action + '_completed', epoch_after=epoch(after),
                          new_epoch_requires_explicit_inference_MCP_acceptance=True,
                          public_sources_after=target_hashes, consumers_after=new_consumers,
                          journal_after=journal_after, quiet_after=quiet_after, fresh_backup=backup,
                          timers_restored=True, configured_SQL_writes=0, provider_generation_requests=0,
                          metadata_startup_checks_not_counted=True,
                          orderly_native_stop_may_cancel_non_generative_metadata_checks=True,
                          business_effects=0, migrations=0, journal_bootstrap_or_close=False,
                          session_or_profile_bytes_opened=False, observed_at_VM_utc=datetime.now(timezone.utc).isoformat())
            a.freeze(args.action + '-after.json', result)
            return result
        except Exception as error:
            failure = dict(status=args.action + '_failed', failure_class=type(error).__name__,
                           failure_code=safe_code(error), native_transition_attempted=native_transition,
                           raw_details_emitted=False, automatic_rollback_or_inference_replay=False)
            if admission_closing:
                try:
                    checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
                    failure['API_admission_closed'] = a.stopped('nodia-api')
                except Exception:
                    failure['API_close_requires_operator_attention'] = True
                # Do not stop/kill an uncertain worker, native owner, or profile.
                failure['worker_and_native_not_forcibly_killed'] = True
            if timers_paused and not admission_closing:
                try:
                    require(a.active_new_processes() == consumers, 'writers_changed')
                    checked(['systemctl', 'start', *a.TIMERS])
                    failure['timers_restored_before_any_consumer_stop'] = True
                except Exception:
                    failure['timers_left_stopped_requires_operator'] = True
            elif timers_paused:
                failure['timers_left_stopped_requires_operator'] = True
            a.freeze(args.action + '-failure.json', failure)
            return failure


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=('preflight', 'adopt', 'rollback'))
    p.add_argument('--plan', required=True)
    p.add_argument('--plan-sha256', required=True)
    p.add_argument('--execute', action='store_true')
    args = p.parse_args()
    try:
        result = run(args)
    except Exception as error:
        result = dict(status='precondition_failed', failure_code=safe_code(error), raw_details_emitted=False)
    print(json.dumps(result))
    sys.exit(0 if result['status'] in ('preflight_passed_no_mutations', 'adopt_completed', 'rollback_completed') else 1)
