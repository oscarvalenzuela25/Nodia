"""AI-40 controlled second r01 -> r02 deployment after a rejected first attempt.

Only constants, a strict successor target and read-only status resilience are
injected. Original backup, admission, SQL/native/Codex barriers, descriptor
switching and failure maintenance remain in the pinned driver. Optional keyring
drop-ins and public transport are fingerprinted in each service's own namespace.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path, PurePosixPath
import stat
import subprocess
import sys
import time

BASE_SHA = 'c952cf7136c61ddb531789e52e47972e16f4bc1d9c481a9d519ff43b66f7a000'
OLD = Path('/opt/nodia/releases/nodia-server-ai40-r01')
OLD_SHA = '5815fc87fb5e7ce600267470774dddd9eaafdbae6ead388d0589b982205b4429'
OLD_KNOWLEDGE = '49935f292d476721ee9825fcc6e0cbce434da0d2461e2f6dd5a758faeb6840ca'
TARGET = Path('/opt/nodia/releases/nodia-server-ai40-r02')
WORK = Path('/opt/nodia/verification/ai40-runtime-fix-adopt-r02')
PRIOR_WORK = Path('/opt/nodia/verification/ai40-runtime-fix-adopt-r01')
PRIOR_WRAPPER_SHA = '629d1675610fd95f91d3d322c9af669c527b8fa2a96e8951ec23870733ebd3c5'
PRIOR_PLAN_SHA = '6605f871a11543ca6a54d3571f9b8cb0009bd0bf45d85f5c2bd794c1d21e899c'
DROPINS = tuple(Path('/etc/systemd/system') / (unit + '.service.d/zz-ai40-codex-keyring.conf') for unit in ('nodia-api', 'nodia-ai-worker'))
STATUS_READ_ATTEMPTS = []
PROTECTED_CONTEXT = None
PRIOR_FAILURE = None
BACKUP_COMMANDS = []


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class StatusReadJournal:
    def __init__(self, original, events, sleep=time.sleep):
        self.original, self.events, self.sleep = original, events, sleep
        self.calls = 0

    def __call__(self, command):
        if command != 'status':
            return self.original(command)
        self.calls += 1
        for attempt in range(1, 4):
            try:
                value = self.original(command)
            except Exception as error:
                timeout = isinstance(error, subprocess.TimeoutExpired)
                failed = type(error) is ValueError and str(error) == 'operator_command_failed'
                self.events.append({'call': self.calls, 'attempt': attempt,
                                    'outcome': 'timeout' if timeout else 'command_failed' if failed else 'validation_or_other_error'})
                if (timeout or failed) and attempt < 3:
                    self.sleep(0.25 * attempt)
                    continue
                raise
            self.events.append({'call': self.calls, 'attempt': attempt, 'outcome': 'ok'})
            return value
        raise ValueError('journal_status_read_attempts_exhausted')


def rejected_prior_attempt():
    before_path, failure_path = PRIOR_WORK / 'adopt-before.json', PRIOR_WORK / 'adopt-failure.json'
    before, failed = json.loads(before_path.read_bytes()), json.loads(failure_path.read_bytes())
    require(before.get('operator_wrapper_sha256') == PRIOR_WRAPPER_SHA and before.get('plan_sha256') == PRIOR_PLAN_SHA
            and before.get('phase') == 'adopt' and before.get('source') == str(OLD) and before.get('target') == str(TARGET)
            and failed.get('operator_wrapper_sha256') == PRIOR_WRAPPER_SHA and failed.get('status') == 'adopt_failed'
            and failed.get('admission_closed') is False and failed.get('timers_restored') is True
            and not (PRIOR_WORK / 'adopt-after.json').exists(), 'prior_rejection_not_safe_for_successor')
    return {'work': str(PRIOR_WORK), 'wrapper_sha256': PRIOR_WRAPPER_SHA, 'plan_sha256': PRIOR_PLAN_SHA,
            'before_receipt_sha256': sha(before_path), 'failure_receipt_sha256': sha(failure_path),
            'admission_closed': False, 'timers_restored': True, 'replayed_in_place': False}


def checked_with_backup_diagnostic(a, original, events):
    def checked(argv, timeout=20, cwd=None):
        expected = ['sudo', '-u', 'nodia', '/usr/local/bin/node', str(a.RELEASE / 'scripts/nodia-ai-backups.mjs'), 'backup', str(a.BACKUP)]
        if argv != expected:
            return original(argv, timeout=timeout, cwd=cwd)
        try:
            result = subprocess.run(argv, cwd=cwd, capture_output=True, timeout=timeout, check=False)
        except subprocess.TimeoutExpired as error:
            events.append({'operation': 'backup', 'attempt': 1, 'outcome': 'timeout_result_unknown',
                           'stdout_bytes': len(error.stdout or b''), 'stderr_bytes': len(error.stderr or b''), 'retried': False})
            raise ValueError('backup_cli_result_unknown') from None
        code = None
        if len(result.stderr) <= 256:
            try:
                text = result.stderr.decode('ascii').strip()
                if re.fullmatch('nodia_ai:[a-z0-9_]{1,100}', text):
                    code = text
            except UnicodeDecodeError:
                pass
        events.append({'operation': 'backup', 'attempt': 1, 'outcome': 'command_completed' if result.returncode == 0 else 'command_failed',
                       'exit_code': result.returncode, 'safe_error_code': code, 'stdout_bytes': len(result.stdout),
                       'stderr_bytes': len(result.stderr), 'retried': False, 'raw_details_emitted': False})
        if result.returncode != 0:
            raise ValueError('backup_cli_failed')
        return result.stdout
    return checked


def public_environment(pid):
    raw = (Path('/proc') / str(pid) / 'environ').read_bytes()
    require(len(raw) <= 1024 * 1024, 'process_environment_oversized')
    fields = {}
    for part in raw.split(b'\0'):
        key, separator, value = part.partition(b'=')
        if separator and key in (b'DBUS_SESSION_BUS_ADDRESS', b'XDG_RUNTIME_DIR'):
            require(key.decode() not in fields, 'duplicate_public_environment_key')
            fields[key.decode()] = value.decode('utf-8')
    return fields


def namespace_entry(pid, public_path):
    # Never resolve through the host namespace. These are only public runtime
    # paths; no account/keyring contents or credential files are opened.
    if not isinstance(public_path, str) or not public_path.startswith('/run/'):
        return {'observed': False}
    parts = PurePosixPath(public_path).parts
    if '..' in parts or public_path != PurePosixPath(public_path).as_posix():
        return {'observed': False}
    path = Path('/proc') / str(pid) / 'root' / public_path.lstrip('/')
    try:
        info = path.stat()
    except FileNotFoundError:
        return {'observed': True, 'missing': True}
    return {'observed': True, 'kind': stat.S_IFMT(info.st_mode), 'uid': info.st_uid,
            'mode': stat.S_IMODE(info.st_mode), 'device': info.st_dev, 'inode': info.st_ino}


def protected_context(consumers):
    dropins = {}
    for path in DROPINS:
        if not path.exists() and not path.is_symlink():
            dropins[str(path)] = {'present': False}
            continue
        require(path.is_file() and not path.is_symlink(), 'keyring_dropin_kind_invalid')
        info = path.stat()
        dropins[str(path)] = {'present': True, 'sha256': sha(path), 'uid': info.st_uid, 'mode': stat.S_IMODE(info.st_mode)}
    environment = {}
    for unit, consumer in consumers.items():
        fields = public_environment(consumer['pid'])
        address = fields.get('DBUS_SESSION_BUS_ADDRESS', '')
        bus = address[len('unix:path='):] if address.startswith('unix:path=') and ',' not in address else None
        xdg = namespace_entry(consumer['pid'], fields.get('XDG_RUNTIME_DIR'))
        # A systemd-private runtime directory can be recreated on restart.
        # Its ownership/type/mode/device remain protected; the live bus socket
        # retains its exact inode, so changing the transport still fails closed.
        xdg.pop('inode', None)
        environment[unit] = {'public_environment_sha256': digest(fields),
                             'bus': namespace_entry(consumer['pid'], bus),
                             'xdg': xdg}
    return {'dropins': dropins, 'consumer_transport': environment}


def load_base(path):
    require(path.is_file() and not path.is_symlink() and sha(path) == BASE_SHA, 'base_driver_pin_mismatch')
    spec = importlib.util.spec_from_file_location('ai40_runtime_fix_pinned_adoption', path)
    base = importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
    return base


def configure(base, phase):
    base.OLD, base.OLD_SHA, base.OLD_KNOWLEDGE, base.WORK = OLD, OLD_SHA, OLD_KNOWLEDGE, WORK
    original_plan, original_load = base.plan_file, base.load_helper
    original_unchanged = base.unchanged
    state = {'context': None, 'helper': None}

    def plan_file(path, pin):
        value = original_plan(path, pin)
        require(value['release'] == str(TARGET), 'successor_release_required')
        return value

    def load_helper():
        a, h = original_load()
        original_active, original_freeze = a.active_new_processes, a.freeze
        a.journal = StatusReadJournal(a.journal, STATUS_READ_ATTEMPTS)
        a.checked = checked_with_backup_diagnostic(a, a.checked, BACKUP_COMMANDS)

        def active():
            global PROTECTED_CONTEXT
            consumers = original_active()
            current = protected_context(consumers)
            if state['context'] is None:
                if phase == 'rollback':
                    previous = json.loads((WORK / 'adopt-after.json').read_bytes())
                    require(previous.get('operator_wrapper_sha256') == sha(Path(__file__)) and
                            previous.get('protected_context') == current, 'rollback_transport_context_changed')
                state['context'] = current
                PROTECTED_CONTEXT = current
            require(current == state['context'], 'runtime_transport_context_changed')
            return consumers

        def freeze(name, value):
            enriched = dict(value, operator_wrapper_sha256=sha(Path(__file__)),
                            protected_context=state['context'], journal_status_reads=list(STATUS_READ_ATTEMPTS),
                            previous_rejected_attempt=PRIOR_FAILURE, backup_commands=list(BACKUP_COMMANDS))
            original_freeze(name, enriched)

        a.active_new_processes, a.freeze = active, freeze
        state['helper'] = a
        return a, h

    def unchanged(a, h, before):
        result = original_unchanged(a, h, before)
        a.active_new_processes()  # Checks the same public transport in the live namespace.
        return result

    base.plan_file, base.load_helper, base.unchanged = plan_file, load_helper, unchanged
    return base


def run(args):
    global PROTECTED_CONTEXT, PRIOR_FAILURE
    STATUS_READ_ATTEMPTS.clear(); BACKUP_COMMANDS.clear(); PROTECTED_CONTEXT = None
    require(args.plan_sha256 == PRIOR_PLAN_SHA, 'successor_plan_pin_mismatch')
    PRIOR_FAILURE = rejected_prior_attempt()
    base = configure(load_base(Path(args.base_driver)), args.phase)
    result = base.run(args)
    return dict(result, operator_wrapper_sha256=sha(Path(__file__)), protected_context=PROTECTED_CONTEXT,
                journal_status_reads=list(STATUS_READ_ATTEMPTS), frozen_base_driver_sha256=BASE_SHA,
                previous_rejected_attempt=PRIOR_FAILURE, backup_commands=list(BACKUP_COMMANDS))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('preflight', 'adopt', 'rollback'))
    parser.add_argument('--base-driver', required=True)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--execute', action='store_true')
    try:
        value = run(parser.parse_args())
    except Exception as error:
        message = str(error)
        value = {'stage': 'AI40', 'status': 'precondition_failed', 'failure_code': message if isinstance(error, ValueError) and message.isascii() and all(char.islower() or char == '_' for char in message) else 'operation_failed',
                 'raw_details_emitted': False, 'journal_status_reads': list(STATUS_READ_ATTEMPTS), 'backup_commands': list(BACKUP_COMMANDS)}
    print(json.dumps(value))
    return 0 if value['status'] in ('preflight_passed_no_mutations', 'adopt_completed', 'rollback_completed') else 1


if __name__ == '__main__':
    sys.exit(main())
