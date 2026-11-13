#!/usr/bin/env python3
"""Provision a separate, forced-command SSH identity. No deploy or sudo privilege."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import subprocess

USER = 'nodia-deploy'
HOME = Path('/var/lib/nodia-deploy')
GATEWAY = Path('/usr/local/lib/nodia/deploy-gateway.py')
COMMAND = f'/usr/bin/python3 -I {GATEWAY}'
GATEWAY_BYTES = b'''#!/usr/bin/env python3
import json,os,pwd,sys
identity=pwd.getpwnam('nodia-deploy')
if os.getuid()!=identity.pw_uid or os.environ.get('SSH_ORIGINAL_COMMAND')!='status':
    print(json.dumps({'status':'denied','error_code':'only_status_is_enabled','deployment_requested':False}),file=sys.stderr)
    sys.exit(64)
print(json.dumps({'schema_version':1,'status':'identity_verified','user':'nodia-deploy',
    'forced_command':True,'deployment_implemented':False,'privileged_helper_enabled':False,
    'deployment_requested':False}))
'''


def require(condition, code):
    if not condition:
        raise ValueError(code)


def public_key(raw):
    require(len(raw) < 1024, 'invalid_public_key_file')
    # ssh-keygen on Windows writes CRLF. Hash the original bytes in provision();
    # accept only one optional line terminator here, without rewriting the key.
    line = raw[:-2] if raw.endswith(b'\r\n') else raw[:-1] if raw.endswith(b'\n') else raw
    require(b'\r' not in line and b'\n' not in line, 'invalid_public_key_file')
    fields = line.decode('ascii').strip().split()
    require(len(fields) in (2, 3) and fields[0] == 'ssh-ed25519', 'ed25519_public_key_required')
    blob = base64.b64decode(fields[1], validate=True)
    prefix = struct.pack('>I', 11) + b'ssh-ed25519' + struct.pack('>I', 32)
    require(len(blob) == len(prefix) + 32 and blob.startswith(prefix), 'invalid_ed25519_key_blob')
    require(base64.b64encode(blob).decode() == fields[1], 'noncanonical_public_key')
    fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip('=')
    return f'ssh-ed25519 {fields[1]} nodia-actions-production', fingerprint


def directory(path, create=False):
    if create and not path.exists():
        path.mkdir(mode=0o700)
        path.chmod(0o755)
    info = path.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == info.st_gid == 0 and
            stat.S_IMODE(info.st_mode) == 0o755, 'unsafe_directory_' + path.name)


def exact_file(path, content, mode):
    if path.exists() or path.is_symlink():
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0 and info.st_nlink == 1 and
                stat.S_IMODE(info.st_mode) == mode and path.read_bytes() == content,
                'existing_file_mismatch_' + path.name)
        return
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(descriptor, 'wb') as stream:
        os.fchmod(stream.fileno(), mode)
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())


def provision(public_path, expected_hash):
    import grp
    import pwd
    require(os.geteuid() == 0, 'root_required')
    os.umask(0o077)
    info = public_path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size < 1024,
            'regular_public_key_file_required')
    raw = public_path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == expected_hash, 'public_key_hash_mismatch')
    key, fingerprint = public_key(raw)
    for path in (Path('/var'), Path('/var/lib'), Path('/usr'), Path('/usr/local'), Path('/usr/local/lib')):
        directory(path)
    marker = (json.dumps({'schema_version': 1, 'purpose': 'nodia-actions-ssh-identity',
                          'public_key_fingerprint': fingerprint}, sort_keys=True) + '\n').encode()
    try:
        existing = pwd.getpwnam(USER)
    except KeyError:
        existing = None
    if existing:
        require(HOME.exists() and (HOME / 'identity.json').exists(), 'unmanaged_existing_user')
    directory(HOME, create=True)
    exact_file(HOME / 'identity.json', marker, 0o644)
    if not existing:
        try:
            grp.getgrnam(USER)
        except KeyError:
            pass
        else:
            raise ValueError('unmanaged_existing_group')
        subprocess.run(['/usr/sbin/useradd', '--user-group', '--no-create-home', '--home-dir', str(HOME),
                        '--shell', '/bin/sh', USER], check=True, capture_output=True)
    identity = pwd.getpwnam(USER)
    require(identity.pw_uid >= 1000 and identity.pw_dir == str(HOME) and identity.pw_shell == '/bin/sh' and
            grp.getgrgid(identity.pw_gid).gr_name == USER and
            all(USER not in group.gr_mem for group in grp.getgrall()), 'unexpected_account_privileges')
    password_status = subprocess.run(['/usr/bin/passwd', '--status', USER], check=True,
                                     capture_output=True, text=True, env={**os.environ, 'LC_ALL': 'C'}).stdout.split()
    require(len(password_status) >= 2 and password_status[:2] == [USER, 'L'], 'account_password_not_locked')
    directory(HOME / '.ssh', create=True)
    directory(GATEWAY.parent, create=True)
    exact_file(GATEWAY, GATEWAY_BYTES, 0o755)
    authorized = f'restrict,command="{COMMAND}" {key}\n'.encode()
    exact_file(HOME / '.ssh' / 'authorized_keys', authorized, 0o644)
    return {'schema_version': 1, 'status': 'identity_prepared', 'user': USER,
            'public_key_fingerprint': fingerprint, 'forced_command': True,
            'sudo_grant_created': False, 'deployment_implemented': False,
            'services_changed': False, 'ssh_configuration_changed': False,
            'new_ssh_connection_verified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public-key', type=Path, required=True)
    parser.add_argument('--public-key-sha256', required=True)
    args = parser.parse_args()
    try:
        result = provision(args.public_key, args.public_key_sha256)
        print(json.dumps(result))
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) else 'provision_failed_inspect_host'
        print(json.dumps({'status': 'failed', 'error_code': code, 'automatic_retry_allowed': False}))
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()
