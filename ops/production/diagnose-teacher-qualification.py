#!/usr/bin/env python3
"""Install one pinned read-only diagnostic and run it as nodia. Never restart the app."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import uuid

RELEASE = Path('/opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc')
LIBRARY = Path('/usr/local/lib/nodia')
SAFE_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8'}


def require(condition, code):
    if not condition:
        raise ValueError(code)


def protected_directory(path):
    require(path.resolve(strict=True) == path, 'unsafe_directory')
    for entry in (path, *path.parents):
        info = entry.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022,
                'unsafe_directory_owner_or_mode')


def install_helper(source, digest):
    require(re.fullmatch('[a-f0-9]{64}', digest) is not None, 'invalid_helper_digest')
    with os.fdopen(os.open(source, os.O_RDONLY | os.O_NOFOLLOW), 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= 256 * 1024,
                'unsafe_helper_source')
        data = stream.read(256 * 1024 + 1)
    require(hashlib.sha256(data).hexdigest() == digest, 'helper_digest_mismatch')
    target = LIBRARY / f'diagnose-teacher-qualification-{digest}.mjs'
    if os.path.lexists(target):
        info = target.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1
                and stat.S_IMODE(info.st_mode) == 0o644, 'unsafe_installed_helper')
        require(hashlib.sha256(target.read_bytes()).hexdigest() == digest, 'installed_helper_digest_mismatch')
    else:
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(data)
            os.fchown(stream.fileno(), 0, 0)
            os.fchmod(stream.fileno(), 0o644)
            stream.flush()
            os.fsync(stream.fileno())
    return target


def diagnostic_command(helper, unit):
    require(re.fullmatch(r'nodia-teacher-diagnostic-[a-f0-9]{32}\.service', unit) is not None,
            'invalid_transient_unit')
    require(helper.parent == LIBRARY and re.fullmatch(r'diagnose-teacher-qualification-[a-f0-9]{64}\.mjs', helper.name)
            is not None, 'invalid_helper_path')
    return ['/usr/bin/systemd-run', '--quiet', f'--unit={unit}', '--wait', '--pipe', '--collect', '--service-type=exec',
            f'--working-directory={RELEASE}', '--property=User=nodia', '--property=Group=nodia',
            '--property=EnvironmentFile=/etc/nodia/runtime.env', '--setenv=NODE_ENV=production',
            '--setenv=PGSSLMODE=verify-full', '--setenv=NODE_OPTIONS=', '--setenv=NODE_PATH=',
            '--setenv=HOME=/var/lib/nodia/home', '--property=UMask=0077', '--property=NoNewPrivileges=yes',
            '--property=CapabilityBoundingSet=', '--property=ProtectSystem=strict', '--property=ProtectHome=yes',
            '--property=PrivateTmp=yes', '--property=PrivateDevices=yes', '--property=RestrictSUIDSGID=yes',
            '--property=RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6', '--property=RuntimeMaxSec=60s',
            '--property=TimeoutStopSec=5s', '--property=KillMode=control-group',
            '--property=ReadOnlyPaths=/var/lib/nodia', '/usr/local/bin/node', str(helper)]


def run_helper(helper, runner=subprocess.run):
    unit = f'nodia-teacher-diagnostic-{uuid.uuid4().hex}.service'
    try:
        # PID1 reads EnvironmentFile. This Python process never reads or logs credentials.
        return runner(diagnostic_command(helper, unit), env=SAFE_ENV, check=False, timeout=75).returncode
    finally:
        # Only our unique transient unit: no application stop, restart, enable or reset.
        runner(['/usr/bin/systemctl', 'stop', unit], env=SAFE_ENV, check=False, timeout=10,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--helper-sha256', required=True)
    args = parser.parse_args()
    require(sys.platform == 'linux' and os.geteuid() == 0, 'root_linux_required')
    require(Path('/opt/nodia/current').resolve(strict=True) == RELEASE, 'release_changed')
    protected_directory(RELEASE)
    protected_directory(LIBRARY)
    protected_directory(Path('/etc/nodia'))
    config = Path('/etc/nodia/runtime.env').lstat()
    require(stat.S_ISREG(config.st_mode) and config.st_uid == 0 and config.st_nlink == 1
            and not config.st_mode & 0o007 and not config.st_mode & 0o022, 'unsafe_runtime_environment')
    helper = install_helper(Path(__file__).with_suffix('.mjs'), args.helper_sha256)
    return run_helper(helper)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[a-z_]{1,80}', str(error)) else 'diagnostic_wrapper_failed'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'inference_requested': False, 'qualification_requested': False, 'application_restart_requested': False}))
        sys.exit(1)
