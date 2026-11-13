#!/usr/bin/env python3
"""Prepare private Codex credential infrastructure. No package install/start/restart.

Run as root only after the orchestrator verifies its source bundle. Fresh production
setup is supported; an unmanaged existing store or descriptor is a closed failure.
Repeat preparation preserves the existing independent password and encrypted store.
"""
import hashlib
import json
import os
from pathlib import Path
import pwd
import secrets
import stat
import sys

HERE = Path(__file__).resolve().parent
MANIFEST = Path('/etc/nodia/codex-runtime.json')
PASSWORD = Path('/etc/nodia/codex-keyring.password')
STORE = Path('/var/lib/nodia/codex-keyring')
FILES = {
    'codex-bus.conf': (Path('/usr/local/lib/nodia/ai-runtime/codex-bus.conf'), 0o644),
    'codex-keyring.py': (Path('/usr/local/lib/nodia/ai-runtime/codex-keyring.py'), 0o644),
    'codex-bus.service': (Path('/etc/systemd/system/nodia-codex-bus.service'), 0o644),
    'codex-keyring.service': (Path('/etc/systemd/system/nodia-codex-keyring.service'), 0o644),
    'codex-runtime.conf': (Path('/etc/nodia/ai-runtime/staged/nodia-api/70-codex-runtime.conf'), 0o644),
}
WORKER_DROPIN = Path('/etc/nodia/ai-runtime/staged/nodia-ai-worker/70-codex-runtime.conf')


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def checked(path, directory=False, owner=0, mode=None):
    """Reject symlinks at every parent before reading, installing or changing mode."""
    require(path.is_absolute() and '..' not in path.parts, 'path_invalid')
    for parent in [*reversed(path.parents), path]:
        try:
            info = parent.lstat()
        except FileNotFoundError:
            return False
        require(not stat.S_ISLNK(info.st_mode), 'symlink_rejected')
        if parent != path:
            require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0
                    and not info.st_mode & 0o022, 'parent_directory_unsafe')
    require(info.st_uid == owner and not info.st_mode & 0o022,
            'file_owner_or_mode_invalid')
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode),
            'file_type_invalid')
    if mode is not None:
        require(stat.S_IMODE(info.st_mode) == mode, 'file_owner_or_mode_invalid')
    if not directory:
        require(info.st_nlink == 1, 'file_hardlink_rejected')
    return True


def make_directory(path, mode=0o755, owner=0, group=0):
    # Shared root directories such as /etc/nodia already use stricter modes.
    if checked(path, directory=True, owner=owner, mode=mode if owner else None):
        return
    if not path.parent.exists():
        make_directory(path.parent)
    # The final owned nodia directory is the only exception to root-owned ancestors.
    require(checked(path.parent, directory=True), 'parent_directory_missing')
    path.mkdir(mode=mode)
    os.chown(path, owner, group)
    os.chmod(path, mode)


def read_regular(path, mode=None):
    require(checked(path, mode=mode), 'file_missing')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(info.st_size <= 128 * 1024, 'file_too_large')
        return stream.read(128 * 1024 + 1)


def install_file(path, data, mode):
    make_directory(path.parent)
    if checked(path, mode=mode):
        require(read_regular(path, mode) == data, 'existing_descriptor_conflict')
        return
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(descriptor, 'wb') as stream:
        os.fchmod(stream.fileno(), mode)
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def prepare():
    require(os.geteuid() == 0, 'root_required')
    os.umask(0o077)
    user = pwd.getpwnam('nodia')
    require(900 <= user.pw_uid < 990 and user.pw_uid == user.pw_gid
            and user.pw_shell == '/usr/sbin/nologin', 'service_identity_invalid')
    # Source input bytes are intentionally public. The caller verifies its transfer hash.
    inputs = {name: (HERE / name).read_bytes() for name in FILES}
    require(all(0 < len(content) <= 128 * 1024 and b'\r' not in content
                for content in inputs.values()), 'source_input_invalid')
    descriptor = {'schema_version': 1, 'owner_uid': user.pw_uid,
        'sources': {name: hashlib.sha256(content).hexdigest() for name, content in inputs.items()},
        'password_file': str(PASSWORD), 'store': str(STORE)}
    manifest = (json.dumps(descriptor, sort_keys=True, indent=2) + '\n').encode()
    managed = checked(MANIFEST, mode=0o600)
    if managed:
        require(read_regular(MANIFEST, 0o600) == manifest, 'managed_source_conflict')
        require(checked(PASSWORD, mode=0o600), 'managed_credential_missing')
        require(checked(STORE, directory=True, owner=user.pw_uid, mode=0o700),
                'managed_store_missing')
    else:
        require(not PASSWORD.exists() and not PASSWORD.is_symlink(),
                'unmanaged_password_present')
        if checked(STORE, directory=True, owner=user.pw_uid, mode=0o700):
            require(not any(STORE.iterdir()), 'unmanaged_store_present')
        for name, (target, mode) in FILES.items():
            if checked(target, mode=mode):
                require(read_regular(target, mode) == inputs[name], 'existing_descriptor_conflict')
        if checked(WORKER_DROPIN, mode=0o644):
            require(read_regular(WORKER_DROPIN, 0o644) == inputs['codex-runtime.conf'],
                    'existing_descriptor_conflict')
        # Claim first-setup ownership before generating any credential. If interrupted
        # before password/store creation, a later invocation fails closed for explicit
        # reconciliation rather than guessing whether state may have been removed.
        install_file(MANIFEST, manifest, 0o600)
    if checked(PASSWORD, mode=0o600):
        value = read_regular(PASSWORD, 0o600)
        require(len(value) == 64 and all(byte in b'0123456789abcdef' for byte in value),
                'credential_format_invalid')
    else:
        # A managed nonempty store without its password must never be recreated/reset.
        if checked(STORE, directory=True, owner=user.pw_uid, mode=0o700):
            require(not any(STORE.iterdir()), 'credential_missing_existing_store')
        install_file(PASSWORD, secrets.token_hex(32).encode(), 0o600)
    make_directory(STORE, 0o700, user.pw_uid, user.pw_gid)
    for name, (target, mode) in FILES.items():
        install_file(target, inputs[name], mode)
    install_file(WORKER_DROPIN, inputs['codex-runtime.conf'], 0o644)
    return {'schema_version': 1, 'status': 'prepared', 'credential_reused': managed,
        'daemon_reload_requested': False, 'services_started': False,
        'application_restarted': False, 'login_requested': False,
        'real_entries_read': 0}


if __name__ == '__main__':
    try:
        require(not sys.argv[1:], 'arguments_invalid')
        print(json.dumps(prepare()))
    except Exception as error:
        code = str(error) if type(error) is RuntimeError else 'codex_preparation_failed'
        print(json.dumps({'status': 'failed', 'error_code': code,
                          'preserve_state': True}), file=sys.stderr)
        raise SystemExit(1)
