#!/usr/bin/env python3
"""Run a reviewed CV canary against the active backend and its existing worker."""
import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
from uuid import uuid4

CURRENT = Path('/opt/nodia/current')
RELEASES = Path('/opt/nodia/releases')
ENVIRONMENT = (
    (Path('/etc/nodia/runtime.env'), {0o600, 0o640}),
    (Path('/etc/nodia/codex-cv-runtime.env'), {0o600, 0o640, 0o644}),
)
MAINTENANCE = Path('/var/lib/nodia-maintenance/backend')
SYSTEMCTL = '/usr/bin/systemctl'
SAFE_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8'}


def require(condition, code):
    if not condition:
        raise ValueError(code)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['catalog', 'check', 'admit', 'verify'])
    parser.add_argument('--release', required=True)
    parser.add_argument('--helper-sha256', required=True)
    parser.add_argument('--profile-name', required=True)
    parser.add_argument('--connection-id')
    parser.add_argument('--model-id')
    parser.add_argument('--effort-id')
    parser.add_argument('--request-key')
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    require(re.fullmatch(r'backend-[a-f0-9]{12}-[a-f0-9]{12}', args.release),
            'release_id_invalid')
    require(re.fullmatch(r'[a-f0-9]{64}', args.helper_sha256), 'helper_digest_invalid')
    require(re.fullmatch(r'CV QA [A-Za-z0-9 -]{4,60}', args.profile_name), 'qa_profile_name_invalid')
    selection = (args.connection_id, args.model_id, args.effort_id)
    if args.action == 'catalog':
        require(not any(selection), 'selection_not_expected')
    else:
        require(all(selection)
                and re.fullmatch(r'[1-9][0-9]{0,18}', args.connection_id)
                and int(args.connection_id) <= 9223372036854775807
                and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}', args.model_id)
                and re.fullmatch(r'[a-z][a-z0-9_-]{0,31}', args.effort_id),
                'exact_agentic_selection_required')
    if args.action in {'admit', 'verify'}:
        require(re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4})-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}',
                             args.request_key or ''), 'request_key_required')
    else:
        require(args.request_key is None, 'request_key_not_expected')
    require(args.execute == (args.action == 'admit'), 'explicit_admission_required')
    return args


def active_release(args):
    release = RELEASES / args.release
    require(CURRENT.resolve(strict=True) == release, 'active_release_changed')
    require(not os.path.lexists(MAINTENANCE), 'backend_in_maintenance')
    for item, allowed_modes in ENVIRONMENT:
        info = item.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1 and
                stat.S_IMODE(info.st_mode) in allowed_modes,
                'unsafe_runtime_environment')
    for service in ('nodia-api.service', 'nodia-ai-worker.service'):
        pid = subprocess.check_output(
            [SYSTEMCTL, 'show', service, '--property=MainPID', '--value'],
            env=SAFE_ENV, text=True, timeout=5,
        ).strip()
        require(pid.isdigit() and int(pid) > 1 and
                Path(f'/proc/{pid}/cwd').resolve(strict=True) == release,
                'active_process_release_mismatch')
    return release


def run(args):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'root_linux_required')
    release = active_release(args)
    source = Path(__file__).with_suffix('.mjs')
    with os.fdopen(os.open(source, os.O_RDONLY | os.O_NOFOLLOW), 'rb') as stream:
        data = stream.read(64 * 1024 + 1)
    require(0 < len(data) <= 64 * 1024 and sha256(data).hexdigest() == args.helper_sha256,
            'helper_digest_mismatch')
    with tempfile.TemporaryDirectory(prefix='nodia-cv-qualification-', dir='/run') as directory:
        path = Path(directory)
        path.chmod(0o755)
        helper = path / source.name
        helper.write_bytes(data)
        helper.chmod(0o644)
        unit = f'nodia-cv-qualification-{uuid4().hex}.service'
        command = [
            '/usr/bin/systemd-run', '--quiet', f'--unit={unit}', '--wait', '--pipe', '--collect',
            '--service-type=exec', f'--working-directory={release}', '--property=User=nodia',
            '--property=Group=nodia',
            *(f'--property=EnvironmentFile={item}' for item, _ in ENVIRONMENT),
            '--setenv=NODE_ENV=production', '--setenv=PGSSLMODE=verify-full',
            '--setenv=NODE_OPTIONS=', '--setenv=NODE_PATH=', '--setenv=HOME=/var/lib/nodia/home',
            '--setenv=PATH=/usr/local/bin:/usr/bin:/bin',
            '--setenv=NODIA_CODEX_ENABLED=true', '--setenv=NODIA_CODEX_PROFILE_ROOT=/var/lib/nodia/codex',
            '--setenv=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/nodia-codex/bus',
            '--setenv=XDG_RUNTIME_DIR=/run/nodia-codex', '--property=UMask=0077',
            '--property=NoNewPrivileges=yes', '--property=CapabilityBoundingSet=',
            '--property=ProtectSystem=strict', '--property=ProtectHome=yes', '--property=PrivateTmp=yes',
            '--property=PrivateDevices=yes', '--property=RestrictSUIDSGID=yes',
            '--property=RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK',
            '--property=ReadWritePaths=/var/lib/nodia/home /var/lib/nodia/codex',
            '--property=RuntimeMaxSec=80s', '--property=TimeoutStopSec=5s', '--property=KillMode=control-group',
            '/usr/local/bin/node', str(helper), args.action, args.release, args.profile_name,
            *filter(None, [args.connection_id, args.model_id, args.effort_id, args.request_key]),
        ]
        try:
            return subprocess.run(command, env=SAFE_ENV, check=False, timeout=90).returncode
        finally:
            subprocess.run([SYSTEMCTL, 'stop', unit], env=SAFE_ENV, check=False, timeout=10,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    try:
        sys.exit(run(parse_args()))
    except Exception as error:
        message = str(error) if isinstance(error, ValueError) else ''
        code = message if re.fullmatch(r'[a-z_]{1,80}', message) else 'cv_probe_wrapper_failed'
        print(json.dumps({'status': 'failed', 'error_code': code}))
        sys.exit(1)
