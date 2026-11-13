#!/usr/bin/env python3
"""Account-free systemd/credential/namespace verification in the disposable image.

Run only in a container with private cgroup namespace, --network none and no host
secret/cgroup mounts. The host runner must remove its own container afterwards.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
from uuid import uuid4

assert os.geteuid() == 0 and Path('/.dockerenv').exists()
assert Path('/proc/1/comm').read_text().strip() == 'systemd'
assert os.environ.get('NODIA_ISOLATED_CODEX_KEYRING_TEST') == '1'
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('provision', HERE / 'codex-provision.py')
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)


def command(arguments):
    result = subprocess.run(arguments, text=True, capture_output=True, timeout=35)
    if result.returncode:
        raise RuntimeError(json.dumps({'command': arguments[:3], 'code': result.returncode,
            'stdout': result.stdout[-6000:], 'stderr': result.stderr[-6000:]}))
    return result.stdout.strip()


def pid():
    return int(command(['systemctl', 'show', 'nodia-codex-keyring.service',
                        '--property=MainPID', '--value']))


def nonce(action, token, expected):
    # The production consumers retain these filesystem protections. The nonce only
    # reads directory metadata; all encrypted writes belong to the Secret Service.
    return json.loads(command(['systemd-run', '--quiet', '--wait', '--pipe', '--collect',
        '--service-type=exec', '--property=User=nodia', '--property=Group=nodia',
        '--property=ProtectHome=true', '--property=ProtectSystem=strict',
        '--property=PrivateTmp=true', '--property=NoNewPrivileges=true',
        '--property=ReadWritePaths=/var/lib/nodia/home /var/lib/nodia/codex',
        '--setenv=HOME=/var/lib/nodia/home',
        '--setenv=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/nodia-codex/bus',
        '--setenv=XDG_RUNTIME_DIR=/run/nodia-codex-keyring',
        '--setenv=XDG_DATA_HOME=/var/lib/nodia/codex-keyring',
        '/usr/bin/python3', '-I', '/usr/local/lib/nodia/ai-runtime/codex-keyring.py',
        'nonce', action, token, str(expected)]).splitlines()[-1])


provision.prepare()
for directory in ['/var/lib/nodia/home', '/var/lib/nodia/codex']:
    Path(directory).mkdir(mode=0o700)
    os.chown(directory, 900, 900)
consumer = 'nodia-codex-fixture-consumer.service'
Path('/etc/systemd/system/' + consumer).write_text('''[Unit]
Description=Synthetic consumer; no application or provider operation
[Service]
Type=exec
User=nodia
Group=nodia
ExecStart=/usr/bin/sleep infinity
ProtectHome=true
ProtectSystem=strict
PrivateTmp=true
''', encoding='utf-8')
dropin = Path('/etc/systemd/system/' + consumer + '.d')
dropin.mkdir()
(dropin / '70-codex-runtime.conf').write_bytes(
    Path('/etc/nodia/ai-runtime/staged/nodia-api/70-codex-runtime.conf').read_bytes())
command(['systemctl', 'daemon-reload'])
try:
    command(['systemctl', 'start', consumer])
    consumer_before = command(['systemctl', 'show', consumer, '--property=MainPID', '--value'])
    bus_before = command(['systemctl', 'show', 'nodia-codex-bus.service', '--property=MainPID', '--value'])
    first = pid()
    token = uuid4().hex
    assert nonce('create', token, first)['synthetic_nonce_roundtrip']
    command(['systemctl', 'restart', 'nodia-codex-keyring.service'])
    second = pid()
    assert second != first
    assert command(['systemctl', 'show', 'nodia-codex-bus.service', '--property=MainPID', '--value']) == bus_before
    assert nonce('read-delete', token, second)['nonce_deleted']
    assert command(['systemctl', 'show', consumer, '--property=MainPID', '--value']) == consumer_before
    command(['systemctl', 'stop', 'nodia-codex-keyring.service'])
    assert command(['systemctl', 'is-active', consumer]) == 'active'
    assert command(['systemctl', 'show', consumer, '--property=MainPID', '--value']) == consumer_before
    assert not Path('/etc/systemd/system/nodia-api.service.d').exists()
    print(json.dumps({'status': 'systemd_verified', 'real_systemd_pid1': True,
        'credential_delivery': 'systemd_LoadCredential', 'protect_home': True,
        'protect_system': 'strict', 'private_tmp': True, 'keyring_restarted': True,
        'same_private_bus': True, 'nonce_persisted_across_restart': True,
        'nonce_deleted': True, 'application_dropins_staged_only': True,
        'keyring_stop_preserves_consumer_pid': True,
        'provider_login_requested': False, 'real_entries_read': 0}))
except Exception:
    print(command(['journalctl', '-u', 'nodia-codex-keyring.service', '--no-pager', '-n', '30']))
    raise
finally:
    subprocess.run(['systemctl', 'stop', consumer, 'nodia-codex-keyring.service', 'nodia-codex-bus.service'],
                   capture_output=True, timeout=25)
