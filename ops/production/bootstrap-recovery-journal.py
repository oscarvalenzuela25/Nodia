#!/usr/bin/env python3
"""Prepare the first external journal once, with stopped writers and a durable no-replay intent.

Never starts API/worker, changes current, migrates SQL, closes an era or creates a backup.
"""
import argparse
import datetime
import fcntl
import hashlib
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

STATE = Path('/var/lib/nodia-backend-setup')
PRIVATE = STATE / 'private'
RECOVERY = Path('/var/lib/nodia/config/recovery.json')
NODE = Path('/usr/local/bin/node')
LIBRARY = Path('/usr/local/lib/nodia')
INSPECTOR_SHA = 'd720a261ddb9d414949b395c6a10fcb05faccf67b57ac48bbaf3072f189d05d3'
PROFILE_SHA = '7f4977ac62b5bae24e193f8848b7ec6dd1fda8b3e94cdb19a76c554a5e69dd7f'
INSPECTOR = LIBRARY / f'inspect-postgres-installation-{INSPECTOR_SHA}.mjs'
PROFILE = LIBRARY / f'postgres-provider-baseline-{PROFILE_SHA}.json'
MARKER = PRIVATE / 'journal-bootstrap-intent.json'
HEX = re.compile(r'^[a-f0-9]{64}$')
RELEASE = re.compile(r'^backend-[a-f0-9]{12}-[a-f0-9]{12}$')
SAFE_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8'}


class Rejected(Exception):
    pass


def require(condition, code):
    if not condition:
        raise Rejected(code)


def sha_file(filename):
    value = hashlib.sha256()
    with filename.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def unique_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate_json_key')
            result[key] = value
        return result
    try:
        require(len(data) <= 8 * 1024 * 1024, 'json_size_invalid')
        return json.loads(data.decode('utf-8'), object_pairs_hook=pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(Rejected('invalid_json_number')))
    except (ValueError, UnicodeError) as error:
        raise Rejected('invalid_json') from error


def directory(filename):
    require(filename.is_absolute() and filename.resolve(strict=True) == filename, 'directory_not_canonical')
    current = filename
    while True:
        info = current.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022,
                'directory_owner_or_mode_invalid')
        if current == Path('/'):
            break
        current = current.parent


def regular(filename, *, owner=0, mode=None, maximum=8 * 1024 * 1024):
    require(filename.resolve(strict=True) == filename, 'file_not_canonical')
    info = filename.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == owner and info.st_nlink == 1 and
            0 < info.st_size <= maximum and not info.st_mode & 0o022 and
            (mode is None or stat.S_IMODE(info.st_mode) == mode), 'file_owner_or_mode_invalid')
    return info


def sync_directory(filename):
    descriptor = os.open(filename, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def durable_json(filename, value, *, exclusive=False, mode=0o600):
    payload = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    if exclusive:
        descriptor = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
    else:
        if os.path.lexists(filename):
            regular(filename, mode=mode)
        descriptor, temporary = tempfile.mkstemp(prefix='.journal-status-', dir=filename.parent)
        try:
            with os.fdopen(descriptor, 'wb') as stream:
                os.fchmod(stream.fileno(), mode)
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, filename)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    sync_directory(filename.parent)


def private_diagnostic(name, data, limit):
    """Keep only the latest bounded raw unit output; never publish it on stdout."""
    require(name in ('journal-last-stdout.log', 'journal-last-stderr.log') and isinstance(data, bytes),
            'diagnostic_destination_invalid')
    filename = PRIVATE / name
    if os.path.lexists(filename):
        regular(filename, owner=os.geteuid(), mode=0o600)
    payload = data[:limit] + (b'\n[output truncated]\n' if len(data) > limit else b'')
    if not payload:
        payload = b'[no output]\n'
    descriptor, temporary = tempfile.mkstemp(prefix='.journal-diagnostic-', dir=PRIVATE)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, filename)
        sync_directory(PRIVATE)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def classify_status(result):
    """Only the selected era's validated, open, empty CLI snapshot can be adopted."""
    if not isinstance(result, dict) or set(result) != {'exit_code', 'stdout', 'stderr'} or type(result['exit_code']) is not int or \
            not isinstance(result['stdout'], str) or not isinstance(result['stderr'], str):
        return 'unknown'
    if result['exit_code'] != 0:
        return 'missing' if result['stderr'].strip() == 'nodia_ai:recovery_journal_missing' and not result['stdout'].strip() else 'unknown'
    if result['stderr'].strip():
        return 'unknown'
    try:
        status = unique_json(result['stdout'].encode('utf-8'))
        keys = {'operation', 'coverage_from', 'updated_at', 'first_sequence', 'last_sequence',
                'entries', 'unconfirmed', 'coverage_closed_at', 'backups', 'expired_backups', 'release_authorized'}
        require(isinstance(status, dict) and set(status) == keys and status['operation'] == 'status' and
                status['release_authorized'] is False, 'journal_status_invalid')
        for key in ('first_sequence', 'last_sequence', 'entries', 'unconfirmed', 'backups', 'expired_backups'):
            require(type(status[key]) is int and 0 <= status[key] <= 10_000, 'journal_status_invalid')
        for key in ('coverage_from', 'updated_at'):
            require(isinstance(status[key], str) and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z', status[key]), 'journal_status_invalid')
            datetime.datetime.fromisoformat(status[key].replace('Z', '+00:00'))
        require(status['coverage_from'] <= status['updated_at'], 'journal_status_invalid')
        require(datetime.datetime.fromisoformat(status['updated_at'].replace('Z', '+00:00')) <=
                datetime.datetime.now(datetime.timezone.utc), 'journal_status_invalid')
        if status['coverage_closed_at'] is not None:
            return 'closed'
        if status['first_sequence'] != 1 or any(status[key] != 0 for key in
                ('last_sequence', 'entries', 'unconfirmed', 'backups', 'expired_backups')):
            return 'not_empty'
        return 'empty_open'
    except (Rejected, ValueError, TypeError, AttributeError):
        return 'unknown'


def initialize_once(read_status, record_intent, bootstrap, *, prior_intent):
    """Persist-before-send; a prior intent can only be reconciled by fresh reads."""
    first = read_status()
    observed = classify_status(first)
    if observed == 'empty_open':
        return {'status': 'ready', 'adopted_existing': True, 'put_requested_this_run': False, 'observation': first}
    if observed != 'missing' or prior_intent:
        return {'status': 'blocked', 'reason': 'prior_write_unresolved' if prior_intent and observed == 'missing' else observed,
                'put_requested_this_run': False}
    record_intent()  # Must fsync both the file and its parent before invoking the CLI.
    try:
        bootstrap()
    except (Rejected, OSError, subprocess.SubprocessError):
        pass  # A fresh read may prove the unique write committed; never resend it.
    after = read_status()
    if classify_status(after) == 'empty_open':
        return {'status': 'ready', 'adopted_existing': False, 'put_requested_this_run': True, 'observation': after}
    return {'status': 'blocked', 'reason': 'write_unresolved', 'put_requested_this_run': True}


def writers_stopped():
    require(not os.path.lexists('/opt/nodia/current'), 'current_must_be_absent')
    for unit in ('nodia-api.service', 'nodia-ai-worker.service'):
        result = subprocess.run(['/usr/bin/systemctl', 'show', unit, '--property=LoadState,ActiveState,MainPID,UnitFileState', '--no-pager'],
                                env=SAFE_ENV, capture_output=True, text=True, timeout=10, check=False)
        values = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
        require(result.returncode == 0 and values.get('LoadState') == 'loaded' and values.get('ActiveState') == 'inactive' and
                values.get('MainPID') == '0' and values.get('UnitFileState') == 'disabled', 'writers_must_be_inactive_disabled')


def verify_release(root, source_sha, tree_sha):
    require(root.parent == Path('/opt/nodia/candidates') and RELEASE.fullmatch(root.name), 'release_path_invalid')
    directory(root)
    manifest_file = root / 'release-manifest.json'
    regular(manifest_file, mode=0o644)
    manifest_bytes = manifest_file.read_bytes()
    manifest = unique_json(manifest_bytes)
    require(manifest['source_provenance'] == 'git_archive' and manifest['deployment_eligible'] is True and
            manifest['source_sha'] == source_sha and manifest['package_tree_sha256'] == tree_sha and
            manifest['release_id'] == root.name == f'backend-{source_sha[:12]}-{tree_sha[:12]}', 'release_identity_invalid')
    files = manifest['files']
    require(isinstance(files, list) and 0 < len(files) <= 100_000 and
            hashlib.sha256(json.dumps(files, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest() == tree_sha,
            'release_tree_digest_invalid')
    receipt_path = STATE / 'candidate-receipts' / f'{root.name}.json'
    directory(receipt_path.parent)
    regular(receipt_path, mode=0o600)
    receipt = unique_json(receipt_path.read_bytes())
    require(receipt['release_id'] == root.name and receipt['source_provenance'] == 'git_archive' and
            receipt['deployment_eligible'] is True and receipt['files_verified'] == len(files) and
            receipt['manifest_sha256'] == hashlib.sha256(manifest_bytes).hexdigest(), 'staging_receipt_mismatch')
    expected = {}
    expected_directories = {''}
    for item in files:
        name = item['path']
        require(isinstance(name, str) and name and not name.startswith('/') and '\\' not in name and
                all(part not in ('', '.', '..') for part in name.split('/')) and name not in expected,
                'release_inventory_path_invalid')
        expected[name] = item
        components = name.split('/')
        expected_directories.update('/'.join(components[:index]) for index in range(1, len(components)))
    found = set()
    for parent, directories, filenames in os.walk(root, followlinks=False):
        parent = Path(parent)
        directory(parent)
        relative_parent = '' if parent == root else parent.relative_to(root).as_posix()
        require(relative_parent in expected_directories, 'release_extra_directory')
        require(stat.S_IMODE(parent.stat().st_mode) == 0o755, 'release_directory_mode_invalid')
        for name in directories + filenames:
            filename = parent / name
            relative = filename.relative_to(root).as_posix()
            info = filename.lstat()
            require(info.st_uid == 0 and info.st_gid == 0, 'release_owner_invalid')
            if stat.S_ISDIR(info.st_mode):
                require(stat.S_IMODE(info.st_mode) == 0o755, 'release_directory_mode_invalid')
                continue
            if relative == 'release-manifest.json':
                continue
            item = expected.get(relative)
            require(item is not None and relative not in found, 'release_inventory_mismatch')
            found.add(relative)
            if item['type'] == 'file':
                require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and
                        stat.S_IMODE(info.st_mode) == int(item['mode'], 8) and item['mode'] in ('0644', '0755') and
                        info.st_size == item['bytes'] and sha_file(filename) == item['sha256'], 'release_file_mismatch')
            else:
                require(item['type'] == 'symlink' and stat.S_ISLNK(info.st_mode) and os.readlink(filename) == item['target'] and
                        not os.path.isabs(item['target']) and filename.resolve(strict=True).is_relative_to(root) and
                        hashlib.sha256(item['target'].encode()).hexdigest() == item['sha256'], 'release_link_invalid')
    require(found == set(expected), 'release_inventory_mismatch')
    return manifest


def cleanup_unit(unit, unit_file):
    require(re.fullmatch(r'nodia-journal-maintenance-[a-f0-9]{32}\.service', unit) and
            unit_file == Path('/run/systemd/system') / unit, 'unit_cleanup_path_invalid')
    for action in ('stop', 'reset-failed'):
        subprocess.run(['/usr/bin/systemctl', action, unit], env=SAFE_ENV, capture_output=True, timeout=15, check=False)
    unit_file.unlink(missing_ok=True)
    result = subprocess.run(['/usr/bin/systemctl', 'daemon-reload'], env=SAFE_ENV, capture_output=True, timeout=15, check=False)
    require(result.returncode == 0, 'unit_cleanup_failed')
    result = subprocess.run(['/usr/bin/systemctl', 'show', unit, '--property=ActiveState,MainPID,FragmentPath', '--no-pager'],
                            env=SAFE_ENV, capture_output=True, text=True, timeout=10, check=False)
    values = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    require(values.get('ActiveState') == 'inactive' and values.get('MainPID') == '0' and values.get('FragmentPath') == '' and
            not os.path.lexists(unit_file), 'unit_cleanup_failed')


def run_as_nodia(root, program):
    writers_stopped()
    token = uuid.uuid4().hex
    unit = f'nodia-journal-maintenance-{token}.service'
    unit_file = Path('/run/systemd/system') / unit
    output = PRIVATE / f'journal-output-{token}.json'
    error = PRIVATE / f'journal-error-{token}.log'
    for filename in (output, error):
        descriptor = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        os.close(descriptor)
    argument = json.dumps(program, ensure_ascii=True).replace('%', '%%').replace('$', '$$')
    unit_text = f'''[Unit]
Description=Nodia first journal maintenance
After=network-online.target
[Service]
Type=oneshot
User=nodia
Group=nodia
WorkingDirectory={root}
EnvironmentFile=/etc/nodia/runtime.env
EnvironmentFile=/etc/nodia/redis.env
Environment=NODE_ENV=production
Environment=HOME=/var/lib/nodia/home
Environment=PGSSLMODE=verify-full
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/node --input-type=module --eval {argument}
TimeoutStartSec=45s
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
LimitFSIZE=1M
StandardOutput=file:{output}
StandardError=file:{error}
'''
    try:
        descriptor = os.open(unit_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
        with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as stream:
            stream.write(unit_text)
        subprocess.run(['/usr/bin/systemd-analyze', 'verify', str(unit_file)], env=SAFE_ENV, capture_output=True, timeout=15, check=True)
        subprocess.run(['/usr/bin/systemctl', 'daemon-reload'], env=SAFE_ENV, capture_output=True, timeout=15, check=True)
        result = subprocess.run(['/usr/bin/systemctl', 'start', '--wait', unit], env=SAFE_ENV, capture_output=True, timeout=55, check=False)
        require(output.stat().st_size <= 128 * 1024 and error.stat().st_size <= 16 * 1024, 'unit_output_too_large')
        return {'exit_code': result.returncode, 'stdout': output.read_text(encoding='utf-8'), 'stderr': error.read_text(encoding='utf-8')}
    finally:
        try:
            # Retain the last unit even when parsing/validation or cleanup fails afterwards.
            for filename, name, limit in ((output, 'journal-last-stdout.log', 128 * 1024),
                                           (error, 'journal-last-stderr.log', 16 * 1024)):
                with filename.open('rb') as stream:
                    private_diagnostic(name, stream.read(limit + 1), limit)
        finally:
            try:
                cleanup_unit(unit, unit_file)
            finally:
                output.unlink(missing_ok=True)
                error.unlink(missing_ok=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('release_path')
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--tree-sha256', required=True)
    parser.add_argument('--helper-sha256', required=True)
    args = parser.parse_args(argv)
    require(sys.platform == 'linux' and os.geteuid() == 0, 'root_linux_required')
    require(re.fullmatch(r'[a-f0-9]{40}', args.source_sha) and HEX.fullmatch(args.tree_sha256) and
            HEX.fullmatch(args.helper_sha256), 'arguments_invalid')
    own_file = Path(__file__).absolute()
    require(not own_file.is_symlink() and own_file.is_file() and sha_file(own_file) == args.helper_sha256, 'helper_digest_mismatch')
    for filename in (STATE, PRIVATE, LIBRARY):
        directory(filename)
    require(stat.S_IMODE(PRIVATE.stat().st_mode) == 0o700, 'private_state_mode_invalid')
    lock_path = PRIVATE / 'installation.lock'
    descriptor = os.open(lock_path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'a+b') as lock:
        info = os.fstat(lock.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1 and
                stat.S_IMODE(info.st_mode) == 0o600, 'installation_lock_invalid')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        writers_stopped()
        root = Path(args.release_path)
        manifest = verify_release(root, args.source_sha, args.tree_sha256)
        runtime = pwd.getpwnam('nodia')
        require(runtime.pw_uid == runtime.pw_gid == 900 and set(os.getgrouplist('nodia', runtime.pw_gid)) == {900} and
                runtime.pw_shell == '/usr/sbin/nologin', 'runtime_identity_invalid')
        directory(RECOVERY.parent)
        regular(RECOVERY, owner=900, mode=0o400, maximum=16384)
        recovery_digest = sha_file(RECOVERY)
        for filename, expected in ((INSPECTOR, INSPECTOR_SHA), (PROFILE, PROFILE_SHA)):
            regular(filename, mode=0o644)
            require(sha_file(filename) == expected, 'installed_preflight_pin_mismatch')
        for filename in (Path('/etc/nodia/runtime.env'), Path('/etc/nodia/redis.env')):
            directory(filename.parent)
            regular(filename, mode=0o600)
        node = NODE.resolve(strict=True)
        directory(node.parent)
        regular(node, maximum=256 * 1024 * 1024)
        require(sha_file(node) == manifest['runtime']['executable_sha256'], 'node_digest_mismatch')
        preflight_program = f'''import {{inspectPostgresInstallation}} from {json.dumps(str(INSPECTOR))};
const result=await inspectPostgresInstallation({{catalogDetails:true,providerBaselineFile:{json.dumps(str(PROFILE))}}});
process.stdout.write(JSON.stringify(result)+'\\n');
process.exitCode=result.status==='inspected'&&result.gates.first_installation_preconditions?0:1;'''
        preflight = run_as_nodia(root, preflight_program)
        value = unique_json(preflight['stdout'].encode())
        require(preflight['exit_code'] == 0 and value.get('status') == 'inspected' and
                value.get('gates', {}).get('first_installation_preconditions') is True and
                value['gates'].get('provider_baseline_matches') is True and value['gates'].get('application_destination_empty') is True and
                all(value.get(flag) is False for flag in ('application_started', 'migrations_executed', 'mutations_requested')),
                'fresh_read_only_preflight_failed')
        binding = {'release_id': root.name, 'source_sha': args.source_sha, 'tree_sha256': args.tree_sha256,
                   'recovery_config_sha256': recovery_digest, 'provider_profile_sha256': PROFILE_SHA}
        prior = os.path.lexists(MARKER)
        marker = None
        if prior:
            regular(MARKER, mode=0o600)
            marker = unique_json(MARKER.read_bytes())
            require(marker.get('schema_version') == 1 and marker.get('binding') == binding and
                    marker.get('initialization_guard_recorded') is True and type(marker.get('put_intent_recorded')) is bool,
                    'prior_journal_intent_binding_mismatch')

        def journal(command):
            require(sha_file(RECOVERY) == recovery_digest, 'recovery_configuration_changed')
            program = f'''import {{pathToFileURL}} from 'node:url';
if(process.getuid()!==900||process.env.NODIA_AI_RECOVERY_CONFIG_FILE!=={json.dumps(str(RECOVERY))})process.exit(72);
process.argv=[process.execPath,{json.dumps(str(root / 'scripts/nodia-ai-journal.mjs'))},{json.dumps(command)},{json.dumps(str(RECOVERY))}];
await import(pathToFileURL(process.argv[1]).href);'''
            return run_as_nodia(root, program)

        def record_intent():
            nonlocal marker
            marker = {'schema_version': 1, 'binding': binding, 'put_intent_recorded': True,
                      'initialization_guard_recorded': True,
                      'recorded_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                      'helper_sha256': args.helper_sha256, 'historical_coverage_claimed': False}
            durable_json(MARKER, marker, exclusive=True)

        result = initialize_once(lambda: journal('status'), record_intent, lambda: journal('bootstrap'), prior_intent=prior)
        writers_stopped()
        require(sha_file(RECOVERY) == recovery_digest, 'recovery_configuration_changed')
        public = {'schema_version': 1, 'status': result['status'], 'release_id': root.name,
                  'source_sha': args.source_sha, 'tree_sha256': args.tree_sha256, 'fresh_preflight_passed': True,
                  'put_requested_this_run': result['put_requested_this_run'], 'application_started': False,
                  'worker_started': False, 'migrations_executed': False, 'backup_created': False,
                  'historical_coverage_claimed': False, 'release_authorized': False}
        if result['status'] == 'ready':
            # Even adoption is durable: disappearance of this era must never permit reconstruction.
            if marker is None:
                marker = {'schema_version': 1, 'binding': binding, 'put_intent_recorded': False,
                          'initialization_guard_recorded': True, 'adopted_existing': True,
                          'recorded_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                          'helper_sha256': args.helper_sha256, 'historical_coverage_claimed': False}
                durable_json(MARKER, marker, exclusive=True)
            status = unique_json(result['observation']['stdout'].encode())
            public.update(adopted_existing=result['adopted_existing'], journal={key: status[key] for key in
                ('coverage_from', 'updated_at', 'first_sequence', 'last_sequence', 'entries', 'unconfirmed', 'coverage_closed_at', 'backups', 'expired_backups')})
        else:
            public['error_code'] = result['reason']
        durable_json(STATE / 'journal-bootstrap-status.json', public, mode=0o644)
        print(json.dumps(public, separators=(',', ':')), flush=True)
        return 0 if result['status'] == 'ready' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (Rejected, OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as error:
        code = str(error) if isinstance(error, Rejected) else 'maintenance_failed'
        print(json.dumps({'schema_version': 1, 'status': 'blocked', 'error_code': code,
                          'application_started': False, 'migrations_executed': False, 'release_authorized': False}), flush=True)
        sys.exit(1)
