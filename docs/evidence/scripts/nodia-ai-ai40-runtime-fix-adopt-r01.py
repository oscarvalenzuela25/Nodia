"""AI-40 r01 -> r02 serializer fix deployment through the frozen c952 driver.

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
WORK = Path('/opt/nodia/verification/ai40-runtime-fix-adopt-r01')
DROPINS = tuple(Path('/etc/systemd/system') / (unit + '.service.d/zz-ai40-codex-keyring.conf') for unit in ('nodia-api', 'nodia-ai-worker'))
STATUS_READ_ATTEMPTS = []
PROTECTED_CONTEXT = None


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
            'device': info.st_dev, 'inode': info.st_ino}


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
        environment[unit] = {'public_environment_sha256': digest(fields),
                             'bus': namespace_entry(consumer['pid'], bus),
                             'xdg': namespace_entry(consumer['pid'], fields.get('XDG_RUNTIME_DIR'))}
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
                            protected_context=state['context'], journal_status_reads=list(STATUS_READ_ATTEMPTS))
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
    global PROTECTED_CONTEXT
    STATUS_READ_ATTEMPTS.clear(); PROTECTED_CONTEXT = None
    base = configure(load_base(Path(args.base_driver)), args.phase)
    result = base.run(args)
    return dict(result, operator_wrapper_sha256=sha(Path(__file__)), protected_context=PROTECTED_CONTEXT,
                journal_status_reads=list(STATUS_READ_ATTEMPTS), frozen_base_driver_sha256=BASE_SHA)


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
                 'raw_details_emitted': False, 'journal_status_reads': list(STATUS_READ_ATTEMPTS)}
    print(json.dumps(value))
    return 0 if value['status'] in ('preflight_passed_no_mutations', 'adopt_completed', 'rollback_completed') else 1


if __name__ == '__main__':
    sys.exit(main())
