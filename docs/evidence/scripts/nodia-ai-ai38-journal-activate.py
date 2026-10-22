"""Reviewed one-shot activation of the exact AI-38 journal package in the local VM.

Root reviews and executes explicitly. Never generates provider requests, runs a
migration, restores SQL, starts backup timers or rolls back to unjournaled writers.
Failure closes API admission; an unsafe-to-stop worker is left draining.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import subprocess
import sys
import time
import urllib.error
import urllib.request


ORIGINAL = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
RELEASE = Path('/opt/nodia/releases/nodia-server-ai38-journal-r01')
WORK = Path('/opt/nodia/verification/ai38-journal-r01')
NGINX = Path('/etc/nginx/sites-available/nodia-lab')
RECOVERY = Path('/etc/nodia-ai-recovery/recovery.json')
BACKUP = Path('/etc/nodia-ai-recovery/backup.json')
PUBLIC = Path('/etc/nodia-ai-recovery/backup-public.pem')
RUNNER_ENV = Path('/etc/nodia-ai-recovery/backup-runner.env')
RUNTIME_SOURCE = Path('/tmp/nodia-ai-ai38-adoption-runtime.py')
R03_SOURCE = Path('/tmp/nodia-ai-ai38-adoption-r03.py')
RUNTIME_SHA = 'a0a8ab1afa2dc433da1a0265cb1ee16fa7a5246a734887120e968a93ae7cd336'
R03_SHA = '703a068c6dcd1089b12c0961646d4768bc916d7b56c908ba389d902f2c4e2bee'
MANIFEST_SHA = 'fb4c52fc19c82a9cdb0aa610e7b0a5d3b97641de78980cb76900381cad6bc3d0'
NGINX_SHA = '2f96d9f04d2bc2eba6e1d8bc126ec7d4a5c5b5202bfa3238d87d23e94c52a857'
KNOWLEDGE = '4189005373b4e6040a0e441d21c2978fe1d423ae568e53f74df1592e6f900130'
CONSUMERS = ('nodia-api', 'nodia-ai-worker')
UNCHANGED = ('nodia-gemini-lab', 'nginx')
UNIT_FILES = ('nodia-ai-backup.service', 'nodia-ai-backup.timer',
              'nodia-ai-backup-rotate.service', 'nodia-ai-backup-rotate.timer')
TIMERS = tuple(name for name in UNIT_FILES if name.endswith('.timer'))
DROPINS = {unit: Path('/etc/systemd/system') / (unit + '.service.d') / '99-ai38-journal.conf'
           for unit in CONSUMERS}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, code):
    if not condition:
        raise ValueError(code)


def checked(argv, timeout=20, cwd=None):
    value = subprocess.run(argv, cwd=cwd, capture_output=True, timeout=timeout, check=False)
    if value.returncode:
        raise ValueError('operator_command_failed')
    return value.stdout


def write_new(path, payload, mode=0o600):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())


def freeze(name, value):
    write_new(WORK / name, (json.dumps(value, indent=2) + '\n').encode())


def state(unit):
    raw = checked(['systemctl', 'show', unit, '--no-pager',
                   '--property=ActiveState,SubState,MainPID,WorkingDirectory'])
    value = dict(line.split('=', 1) for line in raw.decode().splitlines() if '=' in line)
    return {'active': value['ActiveState'], 'sub': value.get('SubState', 'unknown'),
            'pid': int(value.get('MainPID', '0')), 'working_directory': value.get('WorkingDirectory', '')}


def stopped(unit):
    value = state(unit)
    return value['active'] in ('inactive', 'failed') and value['pid'] == 0


def load_helpers():
    require(sha(RUNTIME_SOURCE) == RUNTIME_SHA and sha(R03_SOURCE) == R03_SHA, 'helper_pin_mismatch')
    spec = importlib.util.spec_from_file_location('pinned_ai38_readonly_runtime', RUNTIME_SOURCE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, module.pinned_readonly_helpers(str(R03_SOURCE))


def manifest():
    source = RELEASE / 'release-manifest.json'
    require(sha(source) == MANIFEST_SHA, 'manifest_pin_mismatch')
    data = json.loads(source.read_bytes())
    require(data['knowledge_release'] == KNOWLEDGE, 'knowledge_pin_mismatch')
    for name, expected in data['files'].items():
        path = PurePosixPath(name)
        require(not path.is_absolute() and '..' not in path.parts and '\\' not in name and
                '.env' not in path.parts and 'node_modules' not in path.parts, 'unsafe_manifest_member')
        target = RELEASE / path
        require(not target.is_symlink() and target.is_file() and target.resolve().is_relative_to(RELEASE.resolve())
                and sha(target) == expected, 'release_member_mismatch')
    outputs = [name for name in data['files'] if name.startswith('dist/')]
    require(len(outputs) == 2848, 'release_dist_count_mismatch')
    actual = {p.relative_to(RELEASE).as_posix() for p in (RELEASE / 'dist').rglob('*') if p.is_file()}
    require(actual == set(outputs), 'release_dist_inventory_mismatch')
    return {'manifest_sha256': MANIFEST_SHA, 'files': len(data['files']), 'dist_outputs': len(outputs),
            'knowledge_release': KNOWLEDGE}


def operator_configuration():
    identity = pwd.getpwnam('nodia')
    result = {}
    for file in (RECOVERY, BACKUP, PUBLIC, RUNNER_ENV):
        info = file.lstat()
        expected_owner = 0 if file == RUNNER_ENV else identity.pw_uid
        modes = (0o600, 0o644) if file == PUBLIC else (0o600,)
        require(file.is_file() and not file.is_symlink() and info.st_uid == expected_owner and
                info.st_nlink == 1 and (info.st_mode & 0o777) in modes, 'operator_file_identity_mismatch')
        # Hashes and file metadata only. Contents and credentials are not copied or emitted.
        result[file.name] = {'sha256': sha(file), 'uid': info.st_uid, 'mode': oct(info.st_mode & 0o777)}
    return result


def wait_quiet(helpers, seconds=40):
    deadline = time.monotonic() + seconds
    while True:
        try:
            return helpers['quiet']()
        except (AssertionError, ValueError, RuntimeError, subprocess.SubprocessError):
            if time.monotonic() >= deadline:
                raise ValueError('consumer_work_not_drained')
            time.sleep(1)


def selected_env(pid):
    raw = (Path('/proc') / str(pid) / 'environ').read_bytes()
    require(len(raw) <= 1024 * 1024, 'process_environment_oversized')
    names = (b'NODIA_AI_RECOVERY_CONFIG_FILE', b'DOTENV_CONFIG_PATH')
    selected = {name: [] for name in names}
    for part in raw.rstrip(b'\0').split(b'\0'):
        key, separator, value = part.partition(b'=')
        if separator and key in selected:
            selected[key].append(value)
    require(selected[names[0]] == [str(RECOVERY).encode()] and
            selected[names[1]] == [str(ORIGINAL / '.env').encode()], 'consumer_environment_mismatch')
    return {'recovery_config_path_verified': True, 'original_dotenv_path_verified': True,
            'other_environment_fields_emitted': False}


def active_new_processes():
    result = {}
    for unit in CONSUMERS:
        value = state(unit)
        require(value['active'] == 'active' and value['pid'] > 0 and
                value['working_directory'] == str(RELEASE), 'new_consumer_not_active')
        proc = Path('/proc') / str(value['pid'])
        entry = RELEASE / 'dist' / ('main.js' if unit == 'nodia-api' else 'nodia-ai-worker.js')
        require(os.readlink(proc / 'cwd') == str(RELEASE) and
                (proc / 'cmdline').read_bytes().rstrip(b'\0').split(b'\0') ==
                [b'/usr/local/bin/node', str(entry).encode()], 'new_consumer_identity_mismatch')
        result[unit] = {**value, **selected_env(value['pid']), 'entrypoint_sha256': sha(entry),
                        'argv_exact_match': True}
    return result


def wait_health():
    deadline = time.monotonic() + 40
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while True:
        try:
            with opener.open('http://127.0.0.1:8080/api/v1', timeout=2) as response:
                require(response.status == 200, 'health_not_ready')
                response.read(65537)
            return active_new_processes()
        except (OSError, ValueError, urllib.error.URLError):
            if time.monotonic() >= deadline:
                raise ValueError('health_deadline_exceeded')
            time.sleep(1)


def journal(command):
    output = checked(['sudo', '-u', 'nodia', '/usr/local/bin/node',
                      str(RELEASE / 'scripts/nodia-ai-journal.mjs'), command, str(RECOVERY)], timeout=20)
    require(len(output) <= 16384, 'journal_output_oversized')
    result = json.loads(output)
    if command == 'bootstrap':
        require(result == {'operation': 'bootstrap', 'initialized_new_era': True,
                           'historical_coverage_claimed': False}, 'bootstrap_receipt_invalid')
    elif command == 'status':
        fields = {'operation', 'coverage_from', 'updated_at', 'first_sequence', 'last_sequence', 'entries',
                  'unconfirmed', 'coverage_closed_at', 'backups', 'expired_backups', 'release_authorized'}
        require(set(result) == fields and result['operation'] == 'status' and
                result['coverage_closed_at'] is None and result['release_authorized'] is False,
                'journal_status_invalid')
    return result


def install_units():
    installed = {}
    for name in UNIT_FILES:
        path = Path('/etc/systemd/system') / name
        require(not path.exists() and not path.is_symlink(), 'refuse_preexisting_backup_unit')
    for timer in TIMERS:
        probe = subprocess.run(['systemctl', 'is-active', timer], capture_output=True, timeout=5, check=False)
        require(probe.returncode in (3, 4) and probe.stdout.decode().strip() in ('inactive', 'unknown'),
                'backup_timer_already_active_or_uninspectable')
    for name in UNIT_FILES:
        source = RELEASE / 'ops/nodia-ai-backups' / name
        payload = source.read_text()
        if name.endswith('.service'):
            require(payload.count('User=nodia\n') == 1 and payload.count('Group=nodia\n') == 1,
                    'service_template_identity_mismatch')
        path = Path('/etc/systemd/system') / name
        write_new(path, payload.encode(), 0o644)
        installed[name] = {'source_sha256': sha(source), 'installed_sha256': sha(path),
                           'service_user': 'nodia' if name.endswith('.service') else None}
    checked(['systemctl', 'daemon-reload'])
    checked(['systemd-analyze', 'verify', *[str(Path('/etc/systemd/system') / name) for name in UNIT_FILES]], timeout=20)
    checked(['systemctl', 'enable', *TIMERS])
    require(all(stopped(timer) for timer in TIMERS), 'backup_timer_unexpectedly_started')
    return installed


def activate():
    require(os.geteuid() == 0, 'root_required')
    WORK.mkdir(mode=0o700, exist_ok=True)
    require(not WORK.is_symlink() and WORK.stat().st_uid == 0 and
            (WORK.stat().st_mode & 0o777) == 0o700, 'private_work_directory_invalid')
    lock_fd = os.open(WORK / 'activation.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    lock = os.fdopen(lock_fd, 'r+b')
    require(os.fstat(lock.fileno()).st_uid == 0 and (os.fstat(lock.fileno()).st_mode & 0o777) == 0o600,
            'activation_lock_identity_invalid')
    fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    require(not (WORK / 'activation-before.json').exists(), 'refuse_activation_replay')
    module, helpers = load_helpers()
    pre = module.inspect(argparse.Namespace(phase='original', adoption_script=str(R03_SOURCE)))
    require(sha(NGINX) == NGINX_SHA, 'nginx_pin_mismatch')
    package = manifest()
    operator_files = operator_configuration()
    require(all(not path.exists() and not path.is_symlink() for path in DROPINS.values()),
            'refuse_existing_journal_override')
    for unit in CONSUMERS:
        # Private recovery snapshot only. Never print arbitrary unit Environment values.
        write_new(WORK / (unit + '.unit-before.private'), checked(['systemctl', 'cat', unit]))
    freeze('activation-before.json', {'runtime': pre, 'package': package, 'operator_files': operator_files,
                                     'self_sha256': sha(Path(__file__))})
    began_stopping = False
    bootstrap_attempted = False
    phase = 'prepared'
    try:
        phase = 'stop_API_admission'
        began_stopping = True
        checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
        require(stopped('nodia-api'), 'API_not_stopped')
        quiet_drained = wait_quiet(helpers)
        phase = 'stop_quiet_worker'
        checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
        require(all(stopped(unit) for unit in CONSUMERS), 'consumers_not_stopped')
        require(helpers['native_epoch']() == pre['Gemini'], 'Gemini_changed_during_stop')
        phase = 'exclusive_release_overrides'
        for unit, path in DROPINS.items():
            path.parent.mkdir(mode=0o755, exist_ok=True)
            require(path.parent.resolve() == path.parent, 'dropin_directory_symlink')
            entry = 'main.js' if unit == 'nodia-api' else 'nodia-ai-worker.js'
            payload = ('[Service]\nWorkingDirectory=' + str(RELEASE) + '\nExecStart=\nExecStart=/usr/local/bin/node ' +
                       str(RELEASE / 'dist' / entry) + '\nEnvironment=DOTENV_CONFIG_PATH=' + str(ORIGINAL / '.env') +
                       '\nEnvironment=NODIA_AI_RECOVERY_CONFIG_FILE=' + str(RECOVERY) + '\n')
            write_new(path, payload.encode(), 0o644)
        checked(['systemctl', 'daemon-reload'])
        phase = 'bootstrap_external_era'
        bootstrap_attempted = True
        bootstrap = journal('bootstrap')
        phase = 'start_journaled_consumers'
        checked(['systemctl', 'start', *CONSUMERS], timeout=45)
        new_processes = wait_health()
        phase = 'verify_environment'
        require(helpers['native_epoch']() == pre['Gemini'], 'Gemini_epoch_changed')
        require(helpers['schema_and_selection']() == pre['SQL_schema_and_selection'], 'schema_or_provider_selection_changed')
        require(sha(NGINX) == NGINX_SHA, 'nginx_changed')
        for unit in UNCHANGED:
            old = pre['units'][unit]
            current = state(unit)
            require(current['active'] == 'active' and current['pid'] == old['MainPID'], 'unrelated_unit_changed')
        require(helpers['original_files']() == pre['frozen_original_Node']['manifest_sha256'], 'original_files_changed')
        quiet_after = wait_quiet(helpers)
        status = journal('status')
        require(status['entries'] == 0 and status['unconfirmed'] == 0 and status['backups'] == 0 and
                status['expired_backups'] == 0 and status['first_sequence'] == 1 and status['last_sequence'] == 0,
                'new_era_not_empty')
        phase = 'install_inactive_backup_timers'
        installed = install_units()
        require(active_new_processes() == new_processes and helpers['native_epoch']() == pre['Gemini'] and
                sha(NGINX) == NGINX_SHA and manifest() == package and operator_configuration() == operator_files,
                'environment_changed_during_unit_install')
        result = {'stage': 'AI-38', 'status': 'journaled_package_activated_backup_timers_installed_not_started',
                  'finished_at_utc': datetime.now(timezone.utc).isoformat(), 'phase': 'complete',
                  'package': package, 'new_consumers': new_processes, 'quiet_drained': quiet_drained,
                  'quiet_after': quiet_after, 'external_bootstrap': bootstrap, 'external_status': status,
                  'Gemini_unchanged': True, 'nginx_unchanged': True, 'schema_and_selection_unchanged': True,
                  'original_932_outputs_unchanged': True, 'original_Node_active': False,
                  'backup_units': installed, 'backup_timers_started': False, 'new_backup_created': False,
                  'migrations_run': 0, 'provider_requests': 0, 'business_effects': 0,
                  'historical_journal_coverage_claimed': False, 'release_authorized': False}
        freeze('activation-after.json', result)
        return result
    except Exception:
        failure = {'stage': 'AI-38', 'status': 'activation_failed_admission_closed_no_legacy_rollback',
                   'phase': phase, 'bootstrap_attempted_external_era_may_be_active': bootstrap_attempted,
                   'legacy_consumers_restarted': False, 'raw_details_emitted': False}
        if began_stopping:
            try:
                checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
                failure['API_stopped'] = stopped('nodia-api')
                try:
                    wait_quiet(helpers, seconds=10)
                    checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
                    failure['worker_stopped'] = stopped('nodia-ai-worker')
                except Exception:
                    failure['worker_left_draining_without_forced_kill'] = True
            except Exception:
                failure['admission_close_requires_operator_attention'] = True
        try:
            freeze('activation-failure.json', failure)
            failure['private_failure_receipt_written'] = True
        except OSError:
            # A full/unavailable disk must not relabel a post-stop failure as an
            # untouched precondition failure or erase the last operational phase.
            failure['private_failure_receipt_written'] = False
        return failure


if __name__ == '__main__':
    try:
        if sys.argv[1:] != ['--execute']:
            raise ValueError('explicit_execute_required')
        value = activate()
        print(json.dumps(value))
        if value['status'] != 'journaled_package_activated_backup_timers_installed_not_started':
            sys.exit(1)
    except Exception as error:
        print(json.dumps({'stage': 'AI-38', 'status': 'activation_precondition_failed',
                          'failure_class': type(error).__name__, 'raw_details_emitted': False}))
        sys.exit(1)
