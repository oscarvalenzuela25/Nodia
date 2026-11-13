"""One bounded activation of prepared AI login support; never starts a login.

Consumers are stopped and READ ONLY quiescence is checked again before applying
drop-ins. The release symlink, database, API contracts and credentials are kept.
Failure preserves private diagnostics and requires operator reconciliation.
"""
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path('/usr/local/lib/nodia/ai-runtime')
STATE = Path('/var/lib/nodia-ai-runtime-setup')
CONSUMERS = ['nodia-api.service', 'nodia-ai-worker.service']


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def command(arguments, seconds=60):
    result = subprocess.run(arguments, capture_output=True, timeout=seconds, check=False)
    if result.returncode != 0:
        # Manager diagnostics stay private; a caller receives only a fixed code.
        diagnostic = STATE / ('activation-command-error-' + uuid.uuid4().hex + '.json')
        descriptor = os.open(diagnostic, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, 'w') as output:
            json.dump({'command': arguments[:3], 'exit_code': result.returncode,
                       'stdout': result.stdout[:16384].decode(errors='replace'),
                       'stderr': result.stderr[:16384].decode(errors='replace')}, output)
    require(result.returncode == 0 and len(result.stdout) <= 65536, 'activation_command_failed')
    return result.stdout.decode().strip()


def module(path):
    spec = importlib.util.spec_from_file_location('codex_provision', path)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def transient(arguments, environment, seconds=60):
    name = 'nodia-ai-runtime-probe-' + uuid.uuid4().hex
    output, error = STATE / (name + '.json'), STATE / (name + '.log')
    arguments = ['systemd-run', '--quiet', '--wait', '--collect', '--unit=' + name,
        '--property=Type=oneshot', '--property=User=nodia', '--property=Group=nodia',
        '--property=WorkingDirectory=/opt/nodia/current', '--property=UMask=0077',
        '--property=NoNewPrivileges=yes', '--property=CapabilityBoundingSet=',
        '--property=ProtectSystem=strict', '--property=ProtectHome=yes', '--property=PrivateTmp=yes',
        '--property=KillMode=control-group', '--property=TimeoutStartSec=' + str(seconds),
        '--property=TimeoutStopSec=10', '--property=StandardOutput=file:' + str(output),
        '--property=StandardError=file:' + str(error), *environment, '--', *arguments]
    command(arguments, seconds + 20)
    require(output.stat().st_size <= 65536, 'probe_output_too_large')
    result = json.loads(output.read_bytes())
    return result


def preflight():
    checked = transient(['/usr/local/bin/node', str(ROOT / 'runtime-preflight.mjs')],
        ['--property=EnvironmentFile=/etc/nodia/runtime.env', '--setenv=PGSSLMODE=verify-full',
         '--setenv=DOTENV_CONFIG_PATH=/dev/null'], 60)
    require(checked.get('read_only') is True and checked.get('client_tls_authorized') is True
            and checked.get('quiescent') is True, 'runtime_not_quiescent')
    return checked


def nonce(action, token):
    owner = command(['systemctl', 'show', 'nodia-codex-keyring.service', '-p', 'MainPID', '--value'])
    require(owner.isdigit() and int(owner) > 1, 'keyring_owner_missing')
    result = transient(['/usr/bin/python3', '-I', str(ROOT / 'codex-keyring.py'), 'nonce', action, token, owner],
        ['--setenv=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/nodia-codex/bus',
         '--setenv=XDG_RUNTIME_DIR=/run/nodia-codex-keyring',
         '--setenv=XDG_DATA_HOME=/var/lib/nodia/codex-keyring'], 30)
    require(result.get('synthetic_nonce_roundtrip') is True and result.get('real_entries_read') == 0,
            'keyring_nonce_unverified')
    return result


def backend_operation_lock(safe, path=Path('/var/lib/nodia-backend-setup/installation.lock')):
    # The installed updater creates this lock on its first operation, not at
    # installation time. Claim it with the same exclusive creation/permissions.
    require(safe.checked(path.parent, directory=True), 'backend_operation_directory_unsafe')
    safe.install_file(path, b'', 0o600)
    fd = os.open(path, os.O_RDWR | os.O_NOFOLLOW)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return fd
    except Exception:
        os.close(fd)
        raise


def http_smoke():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + 35
    while True:
        try:
            with opener.open('http://127.0.0.1:3000/api/v1', timeout=2) as response:
                require(response.status == 200, 'api_liveness_invalid')
            break
        except (OSError, urllib.error.URLError):
            require(time.monotonic() < deadline, 'api_startup_timeout')
            time.sleep(0.5)
    try:
        with opener.open('http://127.0.0.1:3000/api/v1/auth/me', timeout=5):
            raise RuntimeError('api_accepted_anonymous_session')
    except urllib.error.HTTPError as error:
        require(error.code == 401, 'api_anonymous_policy_invalid')


def activate():
    require(sys.platform == 'linux' and os.geteuid() == 0
            and sys.argv[1:] in ([], ['--resume-infrastructure']), 'linux_root_arguments_invalid')
    resume = sys.argv[1:] == ['--resume-infrastructure']
    safe = module(ROOT / 'codex-provision.py')
    require(safe.checked(STATE, directory=True, mode=0o700), 'setup_directory_unsafe')
    fd = os.open(STATE / 'activate.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    shared = None
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        shared = backend_operation_lock(safe)
        state = STATE / 'activation.json'
        exists = state.exists() or state.is_symlink()
        require(exists == resume, 'previous_activation_requires_review')
        for unit in CONSUMERS:
            require(command(['systemctl', 'is-active', unit]) == 'active', 'application_not_active')
        current = Path('/opt/nodia/current').resolve(strict=True)
        require(current.parent == Path('/opt/nodia/releases') and re.fullmatch('backend-[a-f0-9]{12}-[a-f0-9]{12}', current.name),
                'application_release_invalid')
        if resume:
            previous = json.loads(safe.read_regular(state, 0o600))
            require(previous.get('status') == 'activating' and previous.get('release') == current.name
                    and previous.get('real_login_requested') is False
                    and not (STATE / 'activation-complete.json').exists(), 'unsafe_activation_resume')
            for unit in CONSUMERS:
                parent = Path('/etc/systemd/system') / (unit + '.d')
                require(not (parent / '70-codex-runtime.conf').exists()
                        and not (parent / '71-gemini-runtime.conf').exists(), 'consumer_already_changed')
        before = preflight()
        reservation = STATE / 'activation-resume-infrastructure.json' if resume else state
        require(not reservation.exists() and not reservation.is_symlink(), 'activation_attempt_requires_review')
        safe.install_file(reservation, (json.dumps({'status': 'activating', 'release': current.name,
            'preflight': before, 'real_login_requested': False}) + '\n').encode(), 0o600)
        print('[Nodia AI runtime] checking_private_infrastructure', flush=True)
        command(['systemctl', 'daemon-reload'])
        command(['systemctl', 'start', 'nodia-codex-bus.service', 'nodia-codex-keyring.service', 'nodia-gemini.service'], 150)
        token = uuid.uuid4().hex
        nonce('create', token)
        command(['systemctl', 'restart', 'nodia-codex-keyring.service'], 40)
        nonce('read-delete', token)
        native = transient(['/usr/local/bin/node', str(ROOT / 'codex-native-probe.mjs')],
            ['--setenv=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/nodia-codex/bus',
             '--setenv=XDG_RUNTIME_DIR=/run/nodia-codex'], 60)
        require(native.get('native_protocol_verified') is True and native.get('native_closed') is True,
                'native_codex_unverified')
        print('[Nodia AI runtime] draining_api_and_worker', flush=True)
        changed = False
        try:
            command(['systemctl', 'stop', 'nodia-api.service'], 195)
            command(['systemctl', 'stop', 'nodia-ai-worker.service'], 195)
            preflight()
            for unit in CONSUMERS:
                # Drop-ins remain staged until the post-stop READ ONLY gate passes.
                staged = Path('/etc/nodia/ai-runtime/staged') / unit.removesuffix('.service') / '70-codex-runtime.conf'
                target = Path('/etc/systemd/system') / (unit + '.d') / '70-codex-runtime.conf'
                safe.install_file(target, safe.read_regular(staged, 0o644), 0o644)
                changed = True
                safe.install_file(target.with_name('71-gemini-runtime.conf'),
                    b'[Unit]\nWants=nodia-gemini.service\nAfter=nodia-gemini.service\n', 0o644)
            require(Path('/opt/nodia/current').resolve() == current, 'application_release_changed')
            command(['systemctl', 'daemon-reload'])
            command(['systemctl', 'start', *CONSUMERS], 90)
            for unit in [*CONSUMERS, 'nodia-codex-bus.service', 'nodia-codex-keyring.service', 'nodia-gemini.service']:
                require(command(['systemctl', 'is-active', unit]) == 'active', 'service_activation_unverified')
            http_smoke()
            require(Path('/opt/nodia/current').resolve() == current, 'application_release_changed')
            command(['systemctl', 'enable', 'nodia-codex-bus.service', 'nodia-codex-keyring.service', 'nodia-gemini.service'])
            result = {'schema_version': 1, 'status': 'login_infrastructure_active', 'release_unchanged': current.name,
                      'keyring_persistence_verified': True, 'native_codex_handshake_verified': True,
                      'api_liveness_and_anonymous_401_verified': True, 'application_restarted': True,
                      'real_login_requested': False, 'inference_requested': False, 'human_authorization_pending': True}
            # The reserved status is never overwritten during failure; successful finalization is explicit.
            safe.install_file(STATE / 'activation-complete.json', (json.dumps(result) + '\n').encode(), 0o600)
            return result
        except Exception:
            if not changed:
                # No app descriptor changed: resume original consumers, preserving work.
                subprocess.run(['systemctl', 'start', *CONSUMERS], capture_output=True, timeout=90, check=False)
            raise
    finally:
        if shared is not None:
            os.close(shared)
        os.close(fd)


if __name__ == '__main__':
    try:
        print(json.dumps(activate()))
    except Exception as error:
        code = str(error) if type(error) is RuntimeError and re.fullmatch('[a-z0-9_]{1,100}', str(error)) else 'ai_runtime_activation_failed'
        print(json.dumps({'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False, 'preserve_state': True}))
        raise SystemExit(1) from None
