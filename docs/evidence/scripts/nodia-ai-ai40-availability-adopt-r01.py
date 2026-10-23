"""AI-40 availability successor r02 -> r03 after the exact successful r02 adoption.

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
OLD = Path('/opt/nodia/releases/nodia-server-ai40-r02')
OLD_SHA = 'a555aa8f35e3fffe22b9293e62f2585e2004d55a9c9ab5ecce78d8486bbc35dc'
OLD_KNOWLEDGE = '49935f292d476721ee9825fcc6e0cbce434da0d2461e2f6dd5a758faeb6840ca'
TARGET = Path('/opt/nodia/releases/nodia-server-ai40-r03')
TARGET_SHA = '0e769ded9a0a36e6d62a17415ea15d1843ce48735ff746ce5e238c5c3b2ea341'
WORK = Path('/opt/nodia/verification/ai40-availability-adopt-r01')
PRIOR_WORK = Path('/opt/nodia/verification/ai40-runtime-fix-adopt-r03')
PRIOR_WRAPPER_SHA = '0c772ab68292cb60e769e0958c4bf8cc532b37c3bfe2017a5b3a8e465daf6a9d'
PRIOR_PLAN_SHA = '6605f871a11543ca6a54d3571f9b8cb0009bd0bf45d85f5c2bd794c1d21e899c'
PLAN_SHA = '1edc3fa69a83d79be98d31831b1fcafd3da99b68b324b0cab1a79eeac52793b5'
PRIOR_SOURCE = Path('/opt/nodia/releases/nodia-server-ai40-r01')
PRIOR_SOURCE_SHA = '5815fc87fb5e7ce600267470774dddd9eaafdbae6ead388d0589b982205b4429'
DROPINS = tuple(Path('/etc/systemd/system') / (unit + '.service.d/zz-ai40-codex-keyring.conf') for unit in ('nodia-api', 'nodia-ai-worker'))
STATUS_READ_ATTEMPTS = []
PROTECTED_CONTEXT = None
PRIOR_SUCCESS = None
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


def completed_prior_attempt():
    before_path, after_path = PRIOR_WORK / 'adopt-before.json', PRIOR_WORK / 'adopt-after.json'
    require(before_path.is_file() and not before_path.is_symlink() and after_path.is_file()
            and not after_path.is_symlink() and not (PRIOR_WORK / 'adopt-failure.json').exists(),
            'prior_success_receipts_required')
    before, after = json.loads(before_path.read_bytes()), json.loads(after_path.read_bytes())
    require(type(before) is dict and type(after) is dict, 'prior_success_receipts_invalid')
    for receipt in (before, after):
        require(receipt.get('operator_wrapper_sha256') == PRIOR_WRAPPER_SHA
                and receipt.get('plan_sha256') == PRIOR_PLAN_SHA
                and receipt.get('phase') == 'adopt'
                and receipt.get('source') == str(PRIOR_SOURCE) and receipt.get('target') == str(OLD)
                and receipt.get('old_manifest_sha256') == PRIOR_SOURCE_SHA
                and receipt.get('new_manifest_sha256') == OLD_SHA,
                'prior_success_identity_mismatch')
    require(after.get('status') == 'adopt_completed' and after.get('timers_restored') is True
            and after.get('journal_era_preserved') is True and after.get('journal_bootstrap_or_close') is False
            and after.get('new_publication') is False and after.get('knowledge_release') == OLD_KNOWLEDGE
            and all(type(after.get(key)) is int and after[key] == 0
                    for key in ('migrations', 'SQL_restores', 'configured_SQL_writes', 'provider_requests', 'business_effects')),
            'prior_success_invariants_invalid')
    return {'work': str(PRIOR_WORK), 'wrapper_sha256': PRIOR_WRAPPER_SHA, 'plan_sha256': PRIOR_PLAN_SHA,
            'source': str(PRIOR_SOURCE), 'target': str(OLD), 'old_manifest_sha256': PRIOR_SOURCE_SHA,
            'new_manifest_sha256': OLD_SHA, 'before_receipt_sha256': sha(before_path),
            'after_receipt_sha256': sha(after_path), 'status': 'adopt_completed',
            'timers_restored': True, 'replayed_in_place': False}


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
    spec = importlib.util.spec_from_file_location('ai40_availability_pinned_adoption', path)
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
        require(value['manifest_sha256'] == TARGET_SHA and value['knowledge_release'] == OLD_KNOWLEDGE,
                'successor_package_pin_mismatch')
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
                            previous_completed_attempt=PRIOR_SUCCESS, backup_commands=list(BACKUP_COMMANDS))
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
    global PROTECTED_CONTEXT, PRIOR_SUCCESS
    STATUS_READ_ATTEMPTS.clear(); BACKUP_COMMANDS.clear(); PROTECTED_CONTEXT = None
    require(args.plan_sha256 == PLAN_SHA, 'successor_plan_pin_mismatch')
    PRIOR_SUCCESS = completed_prior_attempt()
    base = configure(load_base(Path(args.base_driver)), args.phase)
    result = base.run(args)
    return dict(result, operator_wrapper_sha256=sha(Path(__file__)), protected_context=PROTECTED_CONTEXT,
                journal_status_reads=list(STATUS_READ_ATTEMPTS), frozen_base_driver_sha256=BASE_SHA,
                previous_completed_attempt=PRIOR_SUCCESS, backup_commands=list(BACKUP_COMMANDS))


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
