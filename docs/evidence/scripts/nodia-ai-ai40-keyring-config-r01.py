"""AI-40 coordinated public keyring transport drop-ins; no credentials or inference.

Preflight reads only. Apply/rollback require explicit execution and SQL/native/
Codex quiescence. A failure after closing admission keeps maintenance closed.
Only the two named new drop-ins change; release, recovery, timers and SQL remain.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import time

BASE_SHA = 'c952cf7136c61ddb531789e52e47972e16f4bc1d9c481a9d519ff43b66f7a000'
PLAN_SHA = 'e53e4eb9400bb96d988b416311291f09593962111ec425bb6b3587606e93c9df'
RELEASE = Path('/opt/nodia/releases/nodia-server-ai40-r01')
MANIFEST_SHA = '5815fc87fb5e7ce600267470774dddd9eaafdbae6ead388d0589b982205b4429'
KNOWLEDGE = '49935f292d476721ee9825fcc6e0cbce434da0d2461e2f6dd5a758faeb6840ca'
WORK = Path('/opt/nodia/verification/ai40-keyring-config-r01')
ADOPTION = Path('/opt/nodia/verification/ai40-adopt-r01')
KEYRING = 'nodia-keyring'
UNITS = ('nodia-api', 'nodia-ai-worker')
DROPINS = tuple(Path('/etc/systemd/system') / (unit + '.service.d/zz-ai40-codex-keyring.conf') for unit in UNITS)
STATUS_READ_ATTEMPTS = []


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class StatusReadJournal:
    """At most three attempts only for status command transport failures.

    The frozen original still parses and validates every status response. No
    mutation, malformed JSON or structural/business validation is retried.
    """
    def __init__(self, original, events, sleep=time.sleep):
        self.original, self.events, self.sleep = original, events, sleep
        self.calls = 0

    def __call__(self, command):
        if command != 'status':
            return self.original(command)
        self.calls += 1
        for attempt in range(1, 4):
            try:
                result = self.original(command)
            except Exception as error:
                timeout = isinstance(error, subprocess.TimeoutExpired)
                command_failed = type(error) is ValueError and str(error) == 'operator_command_failed'
                transient = timeout or command_failed
                self.events.append({'call': self.calls, 'attempt': attempt,
                                    'outcome': 'timeout' if timeout else 'command_failed' if command_failed else 'validation_or_other_error'})
                if transient and attempt < 3:
                    self.sleep(0.25 * attempt)
                    continue
                raise
            self.events.append({'call': self.calls, 'attempt': attempt, 'outcome': 'ok'})
            return result
        raise ValueError('journal_status_read_attempts_exhausted')


def load_base(path):
    require(sha(path) == BASE_SHA and path.is_file() and not path.is_symlink(), 'base_driver_pin_mismatch')
    spec = importlib.util.spec_from_file_location('ai40_frozen_adoption', path)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    value.NEW = RELEASE
    return value


def public_env(pid):
    raw = (Path('/proc') / str(pid) / 'environ').read_bytes()
    require(len(raw) <= 1024 * 1024, 'process_environment_oversized')
    names = ('DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR')
    result = {}
    for entry in raw.split(b'\0'):
        key, separator, value = entry.partition(b'=')
        if separator and key.decode('ascii', errors='ignore') in names:
            name = key.decode('ascii')
            require(name not in result, 'duplicate_public_environment_key')
            result[name] = value.decode('utf-8')
    return result


def validated_transport(values, uid):
    expected = {'DBUS_SESSION_BUS_ADDRESS': f'unix:path=/run/user/{uid}/bus', 'XDG_RUNTIME_DIR': f'/run/user/{uid}'}
    require(values == expected, 'keyring_transport_environment_invalid')
    runtime = Path(expected['XDG_RUNTIME_DIR']); bus = runtime / 'bus'
    ri, bi = runtime.lstat(), bus.lstat()
    require(runtime.resolve() == runtime and not runtime.is_symlink() and stat.S_ISDIR(ri.st_mode)
            and ri.st_uid == uid and stat.S_IMODE(ri.st_mode) == 0o700, 'keyring_runtime_directory_invalid')
    require(bus.resolve() == bus and not bus.is_symlink() and stat.S_ISSOCK(bi.st_mode) and bi.st_uid == uid,
            'keyring_bus_socket_invalid')
    return expected


def keyring_transport(base, a):
    state = a.state(KEYRING); pid = state['pid']; uid = pwd.getpwnam('nodia').pw_uid
    require(state['active'] == 'active' and type(pid) is int and pid > 1, 'keyring_service_not_active')
    proc = Path('/proc') / str(pid)
    require(proc.stat().st_uid == uid, 'keyring_runtime_owner_invalid')
    raw = (proc / 'stat').read_text(); fields = raw[raw.rfind(')') + 2:].split()
    require(len(fields) >= 20, 'keyring_process_identity_invalid')
    boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    base.same_live_process(pid, fields[19], boot)
    values = validated_transport(public_env(pid), uid)
    require(a.state(KEYRING) == state, 'keyring_process_changed')
    return {'service': KEYRING, 'pid': pid, 'uid': uid, 'birth': fields[19], 'boot': boot, 'environment': values}


def dropin_payload(values):
    # validated_transport admits only these public canonical Unix paths.
    require(set(values) == {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'} and
            re.fullmatch('unix:path=/run/user/[1-9][0-9]*/bus', values['DBUS_SESSION_BUS_ADDRESS']) and
            re.fullmatch('/run/user/[1-9][0-9]*', values['XDG_RUNTIME_DIR']) and
            values['DBUS_SESSION_BUS_ADDRESS'] == 'unix:path=' + values['XDG_RUNTIME_DIR'] + '/bus', 'dropin_environment_invalid')
    return ('[Service]\nEnvironment="DBUS_SESSION_BUS_ADDRESS=' + values['DBUS_SESSION_BUS_ADDRESS'] + '"\n'
            'Environment="XDG_RUNTIME_DIR=' + values['XDG_RUNTIME_DIR'] + '"\n').encode()


def pinned_adoption(base, a):
    receipt = json.loads((ADOPTION / 'adopt-after.json').read_bytes())
    require(receipt.get('status') == 'adopt_completed' and receipt.get('plan_sha256') == PLAN_SHA and
            receipt.get('self_sha256') == BASE_SHA and receipt.get('target') == str(RELEASE) and
            receipt.get('new_manifest_sha256') == MANIFEST_SHA and receipt.get('knowledge_release') == KNOWLEDGE,
            'completed_adoption_pin_mismatch')
    base.manifest(RELEASE, MANIFEST_SHA, KNOWLEDGE)
    transitions = base.descriptor_bytes(RELEASE, base.OLD)
    for index, (_, _, original, _) in enumerate(transitions):
        require(original == (ADOPTION / ('descriptor-' + str(index) + '.private')).read_bytes(), 'adopted_descriptor_changed')
    require(hashes(a.operator_configuration()) == hashes(receipt['before']['operator']), 'operator_configuration_changed')
    backup = receipt['fresh_backup']; journal = base.journal_open(a)
    now = datetime.now(timezone.utc)
    require(backup['status'] == 'ready' and re.fullmatch('[a-f0-9]{64}', backup['cipher_sha256']) and
            backup['journal_sequence'] == journal['last_sequence'] and
            datetime.fromisoformat(backup['captured_at'].replace('Z', '+00:00')) <= now <
            datetime.fromisoformat(backup['expires_at'].replace('Z', '+00:00')), 'existing_encrypted_backup_not_applicable')
    return {'adoption_plan_sha256': PLAN_SHA, 'adoption_receipt_sha256': sha(ADOPTION / 'adopt-after.json'),
            'backup_id': backup['backup_id'], 'cipher_sha256': backup['cipher_sha256'], 'captured_at': backup['captured_at'],
            'new_backup_created': False}


def hashes(value):
    return {key: item for key, item in value.items() if key != 'backup-runner.env'}


def snapshot(base, a, h, consumers):
    return {'Gemini': base.native_epoch(a), 'codex_sdk_binary': base.codex_sdk_binary(),
            'schema_and_selection': h['schema_and_selection'](), 'operator': a.operator_configuration(),
            'nginx_sha256': sha(a.NGINX), 'unrelated': {unit: a.state(unit) for unit in ('nginx', 'nodia-gemini-lab')},
            'journal': base.journal_open(a), 'quiet': base.validated_quiet(h['quiet']()),
            'codex': base.codex_barrier(a, Path('/var/lib/nodia/codex'), frozenset(item['pid'] for item in consumers.values())),
            'timers': {unit: a.state(unit) for unit in a.TIMERS}, 'keyring': keyring_transport(base, a),
            'public_consumer_environment': {unit: public_env(info['pid']) for unit, info in consumers.items()}}


def preserved(base, a, h, before):
    base.unchanged(a, h, before)
    require(a.operator_configuration() == before['operator'] and
            {unit: a.state(unit) for unit in a.TIMERS} == before['timers'] and
            keyring_transport(base, a) == before['keyring'], 'unrelated_configuration_changed')


def stop_consumers(base, a, h):
    a.checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
    require(a.stopped('nodia-api'), 'api_not_stopped')
    drained = base.validated_quiet(a.wait_quiet(h, seconds=45))
    a.checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
    require(all(a.stopped(unit) for unit in UNITS), 'consumers_not_stopped')
    base.validated_quiet(h['quiet']()); base.codex_barrier(a, Path('/var/lib/nodia/codex'))
    return drained


def run(args):
    require(os.geteuid() == 0 and sys.flags.optimize == 0, 'root_unoptimized_python_required')
    require(args.phase == 'preflight' or args.execute, 'explicit_execute_required')
    STATUS_READ_ATTEMPTS.clear()
    base = load_base(Path(args.base_driver)); a, h = base.load_helper(); a.RELEASE = RELEASE
    a.journal = StatusReadJournal(a.journal, STATUS_READ_ATTEMPTS)
    consumers = a.active_new_processes(); adoption = pinned_adoption(base, a)
    before = snapshot(base, a, h, consumers); payload = dropin_payload(before['keyring']['environment'])
    for path in DROPINS:
        require(path.parent.is_dir() and not path.parent.is_symlink(), 'dropin_parent_invalid')
        if args.phase == 'rollback':
            base.identity(path, 0o644); require(path.read_bytes() == payload, 'owned_dropin_changed')
        else:
            require(not path.exists() and not path.is_symlink(), 'refuse_existing_dropin')
    common = {'stage': 'AI40', 'phase': args.phase, 'self_sha256': sha(Path(__file__)), 'base_driver_sha256': BASE_SHA,
              'release': str(RELEASE), 'manifest_sha256': MANIFEST_SHA, 'knowledge_release': KNOWLEDGE,
              'adoption': adoption, 'before': before, 'desired_public_environment': before['keyring']['environment'],
              'dropin_sha256': hashlib.sha256(payload).hexdigest(), 'journal_status_reads': list(STATUS_READ_ATTEMPTS)}
    if args.phase == 'preflight':
        return dict(common, status='preflight_passed_no_mutations')
    WORK.mkdir(mode=0o700, exist_ok=True)
    require(WORK.resolve() == WORK and WORK.stat().st_uid == 0 and stat.S_IMODE(WORK.stat().st_mode) == 0o700, 'work_directory_invalid')
    fd = os.open(WORK / 'configuration.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'r+b') as lock:
        base.identity(WORK / 'configuration.lock', 0o600); fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(not (WORK / (args.phase + '-before.json')).exists(), 'refuse_transition_replay')
        a.WORK = WORK; a.freeze(args.phase + '-before.json', common)
        if args.phase == 'rollback':
            applied = json.loads((WORK / 'apply-after.json').read_bytes())
            require(applied['status'] == 'apply_completed' and applied['dropin_sha256'] == common['dropin_sha256'] and
                    applied['release'] == str(RELEASE), 'rollback_requires_matching_apply')
        closed = False
        try:
            closed = True
            drained = stop_consumers(base, a, h)
            preserved(base, a, h, before)
            for path in DROPINS:
                if args.phase == 'apply':
                    a.write_new(path, payload, 0o644)
                else:
                    base.identity(path, 0o644); require(path.read_bytes() == payload, 'owned_dropin_changed')
                    path.unlink()
                directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
                try: os.fsync(directory)
                finally: os.close(directory)
            a.checked(['systemctl', 'daemon-reload'])
            a.checked(['systemctl', 'start', *UNITS], timeout=45)
            after_consumers = a.wait_health(); preserved(base, a, h, before)
            after_env = {unit: public_env(info['pid']) for unit, info in after_consumers.items()}
            expected = before['keyring']['environment'] if args.phase == 'apply' else json.loads((WORK / 'apply-before.json').read_bytes())['before']['public_consumer_environment']
            require(all(after_env[unit] == expected for unit in UNITS) if args.phase == 'apply' else after_env == expected,
                    'effective_public_environment_mismatch')
            quiet = base.validated_quiet(a.wait_quiet(h)); codex = base.codex_barrier(a, Path('/var/lib/nodia/codex'))
            result = dict(common, status=args.phase + '_completed', after_consumers=after_consumers,
                          after_public_environment=after_env, drained=drained, quiet_after=quiet, codex_after=codex,
                          journal_after=base.journal_open(a), journal_status_reads=list(STATUS_READ_ATTEMPTS), timers_changed=False, keyring_restarted=False,
                          backup_created=False, configured_SQL_writes=0, provider_requests=0, migrations=0,
                          observed_at_VM_utc=datetime.now(timezone.utc).isoformat())
            a.freeze(args.phase + '-after.json', result); return result
        except Exception as error:
            failure = dict(common, status=args.phase + '_failed', failure_code=base.safe_error(error), admission_closed=closed)
            if closed:
                try:
                    a.checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
                    base.validated_quiet(a.wait_quiet(h, seconds=10)); base.codex_barrier(a, Path('/var/lib/nodia/codex'))
                    a.checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
                    failure['worker_stopped_after_quiet'] = a.stopped('nodia-ai-worker')
                except Exception:
                    failure['worker_left_draining_no_forced_kill'] = True
            failure['journal_status_reads'] = list(STATUS_READ_ATTEMPTS)
            a.freeze(args.phase + '-failure.json', failure); return failure


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('preflight', 'apply', 'rollback'))
    parser.add_argument('--base-driver', required=True)
    parser.add_argument('--execute', action='store_true')
    try:
        value = run(parser.parse_args())
    except Exception as error:
        value = {'stage': 'AI40', 'status': 'precondition_failed', 'failure_code': str(error) if isinstance(error, ValueError) and re.fullmatch('[a-z_]+', str(error)) else 'operation_failed', 'raw_details_emitted': False, 'journal_status_reads': list(STATUS_READ_ATTEMPTS)}
    print(json.dumps(value))
    return 0 if value['status'] in ('preflight_passed_no_mutations', 'apply_completed', 'rollback_completed') else 1


if __name__ == '__main__':
    sys.exit(main())
