#!/usr/bin/env python3
"""Provision backup configuration and encrypted configuration custody; no backup or app activation.

The custody payload is NOT a PostgreSQL dump. Transfer its cipher digest and key ID
with the operator receipt, decrypt only off the VPS, and review restoration manually.
"""
import argparse
import base64
import datetime
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
import tempfile
import uuid

PRIVATE = Path('/var/lib/nodia-backend-setup/private')
LIBRARY = Path('/usr/local/lib/nodia')
CONFIG = Path('/var/lib/nodia/config/backup.json')
PUBLIC_KEY = Path('/var/lib/nodia/config/backup-public.pem')
RECOVERY = Path('/var/lib/nodia/config/recovery.json')
BACKUPS = Path('/var/lib/nodia/backups')
SPOOL = BACKUPS / 'spool'
DUMP = Path('/usr/lib/postgresql/16/bin/pg_dump')
UPLOAD = Path('/home/nodia-admin/nodia-setup/backend')
KEY_SOURCE = UPLOAD / 'recovery-public.pem'
CIPHER = PRIVATE / 'recovery-config-custody.enc'
EXPORT = UPLOAD / 'recovery-config-custody.enc'
KEY_ID = 'f7af9aea7868daa71a9500f9bbd91f35a3fe6fea396f82d5f5a9c78ab8510bbd'
GUARD_SHA = 'dd3a1e39cb13daaa6b7607a6685ef8a2f59d953ddc712c3fa27d225a69ee6ac9'
HEX = re.compile(r'^[a-f0-9]{64}$')
SAFE_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8'}


def require(condition, code):
    if not condition:
        raise ValueError(code)


def install_pinned(source, expected, name):
    require(HEX.fullmatch(expected), 'invalid_helper_pin')
    descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= 1024 * 1024, 'invalid_helper_input')
        data = stream.read(1024 * 1024 + 1)
    require(hashlib.sha256(data).hexdigest() == expected, 'helper_digest_mismatch')
    target = LIBRARY / name
    if os.path.lexists(target):
        info = target.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1 and
                stat.S_IMODE(info.st_mode) == 0o644 and hashlib.sha256(target.read_bytes()).hexdigest() == expected,
                'installed_helper_mismatch')
    else:
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(data)
            os.fchmod(stream.fileno(), 0o644)
            stream.flush()
            os.fsync(stream.fileno())
    return target


def new_private_file(filename, data, *, owner, group, mode):
    """Creation-exclusive: partial/preexisting configuration is never overwritten."""
    descriptor = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fchown(stream.fileno(), owner, group)
        os.fchmod(stream.fileno(), mode)
        os.fsync(stream.fileno())
    parent = os.open(filename.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(parent)
    finally:
        os.close(parent)


def validate_installation_lock(descriptor):
    # Lock files legitimately contain zero bytes; validate the open FD, not a config-file rule.
    info = os.fstat(descriptor)
    require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0 and
            info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600 and
            0 <= info.st_size <= 1024, 'unsafe_installation_lock')


def custody_payload(originals, now):
    require(set(originals) == {'runtime.env', 'redis.env', 'recovery.json'}, 'custody_file_set_invalid')
    files = []
    for name in ('runtime.env', 'redis.env', 'recovery.json'):
        data = originals[name]
        require(isinstance(data, bytes) and 0 < len(data) <= 65536, 'custody_input_size_invalid')
        files.append({'name': name, 'encoding': 'base64', 'sha256': hashlib.sha256(data).hexdigest(),
                      'content': base64.b64encode(data).decode('ascii')})
    result = {'schema_version': 1, 'purpose': 'nodia_configuration_custody', 'created_at_utc': now,
              'restore_policy': 'operator_review_only', 'files': files}
    payload = json.dumps(result, separators=(',', ':')).encode('utf-8')
    require(len(payload) <= 256 * 1024, 'custody_payload_size_invalid')
    return payload


def admin_directory(filename, uid):
    require(filename.is_absolute() and filename.resolve(strict=True) == filename, 'admin_directory_not_canonical')
    for target in (Path('/home/nodia-admin'), Path('/home/nodia-admin/nodia-setup'), UPLOAD):
        require(target == filename or target in filename.parents, 'admin_destination_outside_upload')
        info = target.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and info.st_uid == uid and
                not info.st_mode & 0o022, 'admin_directory_owner_or_mode_invalid')


def export_ciphertext(data, uid, gid):
    """Pin the verified administrator directory by FD; only ciphertext crosses this boundary."""
    require(isinstance(data, bytes) and 28 < len(data) <= 512 * 1024 and data[:8] == b'NODCFG01', 'ciphertext_export_invalid')
    directory_fd = os.open(UPLOAD, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        before = os.fstat(directory_fd)
        require(stat.S_ISDIR(before.st_mode) and before.st_uid == uid and not before.st_mode & 0o022, 'ciphertext_export_directory_invalid')
        descriptor = os.open('recovery-config-custody.enc', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory_fd)
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fchown(stream.fileno(), uid, gid)
            os.fchmod(stream.fileno(), 0o600)
            os.fsync(stream.fileno())
        os.fsync(directory_fd)
        after = UPLOAD.lstat()
        require(UPLOAD.resolve(strict=True) == UPLOAD and (after.st_dev, after.st_ino) == (before.st_dev, before.st_ino),
                'ciphertext_export_directory_changed')
    finally:
        os.close(directory_fd)


def run_nodia(guards, candidate, action, mode, maximum, seconds):
    guards.writers_stopped()
    token = uuid.uuid4().hex
    unit = f'nodia-backup-configuration-{token}.service'
    unit_file = Path('/run/systemd/system') / unit
    output = PRIVATE / f'backup-configuration-{token}.json'
    error = PRIVATE / f'backup-configuration-{token}.log'
    for filename in (output, error):
        descriptor = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        os.close(descriptor)
    content = f'''[Unit]
Description=Nodia private backup configuration validation
[Service]
Type=oneshot
User=nodia
Group=nodia
WorkingDirectory={candidate}
EnvironmentFile=/etc/nodia/runtime.env
EnvironmentFile=/etc/nodia/redis.env
Environment=NODE_ENV=production
Environment=HOME=/var/lib/nodia/home
Environment=PGSSLMODE=verify-full
Environment=DOTENV_CONFIG_PATH=/dev/null
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/node {action} {mode} {KEY_ID} {maximum} {seconds}
TimeoutStartSec=30s
TimeoutStopSec=5s
KillMode=control-group
UMask=0077
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadOnlyPaths=/var/lib/nodia
ReadWritePaths=/var/lib/nodia/backups/spool
LimitFSIZE=1M
StandardOutput=file:{output}
StandardError=file:{error}
'''
    try:
        descriptor = os.open(unit_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
        with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as stream:
            stream.write(content)
        subprocess.run(['/usr/bin/systemd-analyze', 'verify', str(unit_file)], env=SAFE_ENV, capture_output=True, timeout=15, check=True)
        subprocess.run(['/usr/bin/systemctl', 'daemon-reload'], env=SAFE_ENV, capture_output=True, timeout=15, check=True)
        result = subprocess.run(['/usr/bin/systemctl', 'start', '--wait', unit], env=SAFE_ENV, capture_output=True, timeout=40, check=False)
        require(result.returncode == 0 and output.stat().st_size <= 65536, 'private_configuration_action_failed')
        return output.read_bytes()
    finally:
        # stdout can contain the new private DB config; never copy it into public diagnostics.
        if error.exists():
            with error.open('rb') as stream:
                raw = stream.read(16384)
            if raw:
                target = PRIVATE / 'backup-configuration-last-error.log'
                if os.path.lexists(target):
                    guards.regular(target, mode=0o600)
                descriptor, temporary = tempfile.mkstemp(prefix='.backup-error-', dir=PRIVATE)
                with os.fdopen(descriptor, 'wb') as stream:
                    stream.write(raw)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temporary, target)
        try:
            for operation in ('stop', 'reset-failed'):
                subprocess.run(['/usr/bin/systemctl', operation, unit], env=SAFE_ENV, capture_output=True, timeout=10, check=False)
            unit_file.unlink(missing_ok=True)
            subprocess.run(['/usr/bin/systemctl', 'daemon-reload'], env=SAFE_ENV, capture_output=True, timeout=15, check=True)
            result = subprocess.run(['/usr/bin/systemctl', 'show', unit, '--property=ActiveState,MainPID,FragmentPath', '--no-pager'],
                                    env=SAFE_ENV, capture_output=True, text=True, timeout=10, check=False)
            fields = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
            require(fields.get('ActiveState') == 'inactive' and fields.get('MainPID') == '0' and fields.get('FragmentPath') == '' and
                    not os.path.lexists(unit_file), 'configuration_unit_cleanup_failed')
        finally:
            output.unlink(missing_ok=True)
            error.unlink(missing_ok=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate')
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--tree-sha256', required=True)
    parser.add_argument('--helper-sha256', required=True)
    parser.add_argument('--action-sha256', required=True)
    parser.add_argument('--max-dump-bytes', type=int, default=268435456)
    parser.add_argument('--timeout-seconds', type=int, default=300)
    args = parser.parse_args(argv)
    require(sys.platform == 'linux' and os.geteuid() == 0, 'root_linux_required')
    require(re.fullmatch(r'[a-f0-9]{40}', args.source_sha) and HEX.fullmatch(args.tree_sha256) and
            HEX.fullmatch(args.helper_sha256) and HEX.fullmatch(args.action_sha256) and
            0 < args.max_dump_bytes <= 1024 ** 3 and 0 < args.timeout_seconds <= 3600, 'arguments_invalid')
    source = Path(__file__).absolute().parent
    require(hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == args.helper_sha256, 'launcher_digest_mismatch')
    for target in (PRIVATE, LIBRARY):
        require(target.resolve(strict=True) == target and target.is_dir() and target.stat().st_uid == 0 and
                not target.stat().st_mode & 0o022, 'unsafe_library_or_state')
        for ancestor in target.parents:
            info = ancestor.lstat()
            require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022, 'unsafe_library_or_state')
    guards_file = install_pinned(source / 'bootstrap-recovery-journal.py', GUARD_SHA, f'backup-guards-{GUARD_SHA}.py')
    sys.dont_write_bytecode = True
    specification = importlib.util.spec_from_file_location('production_backup_guards', guards_file)
    guards = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(guards)
    for filename in (PRIVATE, LIBRARY):
        guards.directory(filename)
    require(stat.S_IMODE(PRIVATE.stat().st_mode) == 0o700, 'private_state_mode_invalid')
    action = install_pinned(source / 'configure-production-backups.mjs', args.action_sha256,
                            f'configure-production-backups-{args.action_sha256}.mjs')
    descriptor = os.open(PRIVATE / 'installation.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'a+b') as lock:
        validate_installation_lock(lock.fileno())
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        guards.writers_stopped()
        candidate = Path(args.candidate)
        manifest = guards.verify_release(candidate, args.source_sha, args.tree_sha256)
        installation_states = []
        for filename in (PRIVATE / 'installation-status.json', PRIVATE.parent / 'installation-status.json'):
            guards.regular(filename, mode=0o600 if filename.parent == PRIVATE else 0o644)
            installed = guards.unique_json(filename.read_bytes())
            result = installed.get('result', {})
            require(installed.get('phase') == 'complete' and installed.get('source_sha') == args.source_sha and
                    installed.get('release_id') == candidate.name and result.get('status') == 'verified' and
                    result.get('source_sha') == args.source_sha and result.get('release_id') == candidate.name and
                    result.get('migrations_verified') == 45 and result.get('entity_tables_verified') == 68 and
                    result.get('users') == 1 and result.get('core_assignments') == 4 and
                    result.get('provider_credentials') == 0 and result.get('client_tls_authorized') is True and
                    result.get('postcheck_read_only') is True and
                    result.get('application_started') is False and result.get('worker_started') is False,
                    'complete_database_installation_required')
            installation_states.append(installed)
        require(installation_states[0] == installation_states[1], 'installation_receipts_disagree')
        stage_receipt = guards.unique_json((PRIVATE.parent / 'candidate-receipts' / f'{candidate.name}.json').read_bytes())
        require(installation_states[0].get('archive_sha256') == stage_receipt.get('archive_sha256'), 'installation_archive_mismatch')
        runtime = pwd.getpwnam('nodia')
        admin = pwd.getpwnam('nodia-admin')
        require(runtime.pw_uid == runtime.pw_gid == 900 and set(os.getgrouplist('nodia', 900)) == {900}, 'runtime_identity_invalid')
        guards.directory(CONFIG.parent)
        guards.regular(RECOVERY, owner=900, mode=0o400, maximum=16384)
        original_files = [('runtime.env', Path('/etc/nodia/runtime.env'), 0, 0o600),
                          ('redis.env', Path('/etc/nodia/redis.env'), 0, 0o600), ('recovery.json', RECOVERY, 900, 0o400)]
        originals = {}
        for name, filename, owner, mode in original_files:
            guards.directory(filename.parent)
            guards.regular(filename, owner=owner, mode=mode, maximum=65536)
            originals[name] = filename.read_bytes()
        bindings = {name: hashlib.sha256(value).hexdigest() for name, value in originals.items()}
        guards.directory(DUMP.parent)
        for binary in (DUMP, DUMP.with_name('pg_restore')):
            info = guards.regular(binary, maximum=64 * 1024 * 1024)
            require(info.st_mode & 0o111, 'postgres_client_must_be_executable')
            version = subprocess.run([str(binary), '--version'], env=SAFE_ENV, capture_output=True, text=True, timeout=5, check=False)
            require(version.returncode == 0 and re.match(r'^pg_(?:dump|restore) \(PostgreSQL\) 16(?:\.[0-9]+)?(?:\s|$)', version.stdout),
                    'postgres16_client_required')
        node = Path('/usr/local/bin/node').resolve(strict=True)
        guards.directory(node.parent)
        guards.regular(node, maximum=256 * 1024 * 1024)
        require(guards.sha_file(node) == manifest['runtime']['executable_sha256'], 'node_digest_mismatch')
        admin_directory(UPLOAD, admin.pw_uid)
        for filename in (CONFIG, PUBLIC_KEY, CIPHER, EXPORT, PRIVATE / 'backup-preparation-status.json'):
            require(not os.path.lexists(filename), 'previous_or_partial_preparation_requires_inspection')
        key_descriptor = os.open(KEY_SOURCE, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(key_descriptor, 'rb') as stream:
            key_info = os.fstat(stream.fileno())
            require(stat.S_ISREG(key_info.st_mode) and key_info.st_uid == admin.pw_uid and key_info.st_nlink == 1 and
                    not key_info.st_mode & 0o022 and 0 < key_info.st_size <= 16384, 'unsafe_uploaded_public_key')
            public_bytes = stream.read(16385)
        key_result = subprocess.run([str(node), str(action), 'public-key', KEY_ID], input=public_bytes,
                                    env=SAFE_ENV, capture_output=True, timeout=10, check=False)
        require(key_result.returncode == 0, 'uploaded_public_key_rejected')
        checked_key = guards.unique_json(key_result.stdout)
        require(checked_key.get('key_id') == KEY_ID and checked_key.get('spki_public_only') is True, 'public_key_validation_failed')
        state = {'schema_version': 1, 'phase': 'preparing', 'source_sha': args.source_sha, 'tree_sha256': args.tree_sha256,
                 'release_id': candidate.name, 'key_id': KEY_ID, 'helper_sha256': args.helper_sha256,
                 'action_sha256': args.action_sha256, 'application_started': False, 'worker_started': False,
                 'backup_requested': False, 'remote_calls_requested': False, 'restore_verified': False}
        guards.durable_json(PRIVATE / 'backup-preparation-status.json', state, exclusive=True)
        new_private_file(PUBLIC_KEY, public_bytes, owner=900, group=900, mode=0o400)
        if not os.path.lexists(BACKUPS):
            BACKUPS.mkdir(mode=0o750)
            os.chown(BACKUPS, 0, 900)
            os.chmod(BACKUPS, 0o750)
        guards.directory(BACKUPS)
        require(BACKUPS.stat().st_gid == 900 and stat.S_IMODE(BACKUPS.stat().st_mode) == 0o750, 'backup_parent_mode_invalid')
        if not os.path.lexists(SPOOL):
            SPOOL.mkdir(mode=0o700)
            os.chown(SPOOL, 900, 900)
            os.chmod(SPOOL, 0o700)
        spool_info = SPOOL.lstat()
        require(SPOOL.resolve(strict=True) == SPOOL and stat.S_ISDIR(spool_info.st_mode) and spool_info.st_uid == spool_info.st_gid == 900 and
                stat.S_IMODE(spool_info.st_mode) == 0o700 and not any(SPOOL.iterdir()), 'private_empty_spool_required')
        raw_config = run_nodia(guards, candidate, action, 'generate', args.max_dump_bytes, args.timeout_seconds)
        config = guards.unique_json(raw_config)
        require(set(config) == {'recovery_config', 'public_key_file', 'spool_directory', 'pg_dump_binary', 'database', 'max_dump_bytes', 'timeout_seconds'} and
                config['recovery_config'] == str(RECOVERY) and config['public_key_file'] == str(PUBLIC_KEY) and
                config['spool_directory'] == str(SPOOL) and config['pg_dump_binary'] == str(DUMP), 'generated_configuration_invalid')
        new_private_file(CONFIG, raw_config, owner=900, group=900, mode=0o600)
        validated = guards.unique_json(run_nodia(guards, candidate, action, 'validate', args.max_dump_bytes, args.timeout_seconds))
        require(validated.get('status') == 'validated' and validated.get('key_id') == KEY_ID and
                validated.get('backup_requested') is False and validated.get('remote_calls_requested') is False,
                'saved_configuration_not_validated')
        payload = custody_payload(originals, datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'))
        cipher_descriptor = os.open(CIPHER, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(cipher_descriptor, 'wb') as destination:
            encrypted = subprocess.run([str(node), str(action), 'seal', KEY_ID], input=payload,
                                       env=SAFE_ENV, stdout=destination, stderr=subprocess.PIPE, timeout=15, check=False)
            require(encrypted.returncode == 0, 'configuration_custody_encryption_failed')
            destination.flush()
            os.fsync(destination.fileno())
        guards.sync_directory(PRIVATE)
        cipher_info = guards.regular(CIPHER, mode=0o600, maximum=512 * 1024)
        cipher_bytes = CIPHER.read_bytes()
        require(cipher_bytes[:8] == b'NODCFG01', 'custody_envelope_type_invalid')
        for name, filename, _, _ in original_files:
            require(guards.sha_file(filename) == bindings[name], 'original_private_configuration_changed')
        admin_directory(UPLOAD, admin.pw_uid)
        export_ciphertext(cipher_bytes, admin.pw_uid, admin.pw_gid)
        guards.writers_stopped()
        state.update(phase='complete', configured=True, public_key_owner=900, public_key_mode='0400', configuration_owner=900,
                     configuration_mode='0600', postgres_client_major=16, max_dump_bytes=args.max_dump_bytes, timeout_seconds=args.timeout_seconds,
                     custody={'format': 'NODCFG01', 'purpose': 'nodia_configuration_custody', 'cipher_bytes': cipher_info.st_size,
                              'cipher_sha256': hashlib.sha256(cipher_bytes).hexdigest(), 'key_id': KEY_ID,
                              'files': ['runtime.env', 'redis.env', 'recovery.json'], 'export_file': str(EXPORT),
                              'plaintext_exported': False, 'postgres_dump': False, 'offline_decryption_verified': False})
        guards.durable_json(PRIVATE / 'backup-preparation-status.json', state)
        guards.durable_json(PRIVATE.parent / 'backup-preparation-status.json', state, mode=0o644)
        print(json.dumps(state, separators=(',', ':')), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'backup_preparation_failed'
        print(json.dumps({'schema_version': 1, 'phase': 'blocked', 'error_code': code,
                          'automatic_retry_allowed': False, 'backup_requested': False, 'remote_calls_requested': False}), flush=True)
        sys.exit(1)
