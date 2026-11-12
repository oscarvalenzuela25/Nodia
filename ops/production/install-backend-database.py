#!/usr/bin/env python3
"""Explicit first SQL installation; stopped writers, existing journal, no retry after uncertainty."""
import argparse
import datetime
import fcntl
import grp
import hashlib
import importlib.util
import json
import os
import pwd
from pathlib import Path
import re
import stat
import subprocess
import sys
import tarfile
import uuid

PRIVATE = Path('/var/lib/nodia-backend-setup/private')
STATE = PRIVATE / 'installation-status.json'
PUBLIC = PRIVATE.parent / 'installation-status.json'
LIBRARY = Path('/usr/local/lib/nodia')
CURRENT = Path('/opt/nodia/current')
UNIT_DIRECTORY = Path('/run/systemd/system')
HEX = re.compile(r'^[a-f0-9]{64}$')
PREFLIGHT_SHA = 'd720a261ddb9d414949b395c6a10fcb05faccf67b57ac48bbaf3072f189d05d3'
BASELINE_SHA = '7f4977ac62b5bae24e193f8848b7ec6dd1fda8b3e94cdb19a76c554a5e69dd7f'


def require(condition, code):
    if not condition:
        raise ValueError(code)


def protected_directory(path):
    require(path.is_absolute() and path.resolve(strict=True) == path, 'unsafe_directory')
    for entry in [path, *path.parents]:
        info = entry.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and info.st_gid == 0 and not info.st_mode & 0o022,
                'unsafe_directory')


def protected_file(path, mode=0o644):
    protected_directory(path.parent)
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_gid == 0 and info.st_nlink == 1 and
            stat.S_IMODE(info.st_mode) == mode, 'unsafe_file')


def install_pinned(source, sha, name):
    require(HEX.fullmatch(sha), 'invalid_helper_digest')
    descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(descriptor)
        require(stat.S_ISREG(info.st_mode) and info.st_size <= 1024 * 1024, 'invalid_helper_source')
        data = os.read(descriptor, 1024 * 1024 + 1)
    finally:
        os.close(descriptor)
    require(hashlib.sha256(data).hexdigest() == sha, 'helper_digest_mismatch')
    target = LIBRARY / name
    if target.exists() or target.is_symlink():
        protected_file(target)
        require(hashlib.sha256(target.read_bytes()).hexdigest() == sha, 'installed_helper_digest_mismatch')
    else:
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
            os.fchmod(output.fileno(), 0o644)
            output.flush()
            os.fsync(output.fileno())
    return target


def execution_mode(existing, identity, *, reconcile_only=False):
    if existing is None:
        require(not reconcile_only, 'reconciliation_requires_existing_attempt')
        return 'install'
    require(all(existing.get(key) == value for key, value in identity.items()), 'installation_identity_changed')
    if reconcile_only:
        require(existing.get('phase') in ('failed', 'installation_started', 'verifying_completed_installation',
                                         'reconciling_read_only', 'complete'), 'unsupported_reconciliation_phase')
        return 'verify'
    require(existing.get('phase') == 'complete', 'previous_installation_failed_or_unknown_no_automatic_retry')
    return 'verify'


def safe_result(value, identity, mode):
    keys = {'schema_version', 'status', 'mode', 'source_sha', 'release_id', 'migrations_verified', 'entity_tables_verified',
            'migration_ledger_sha256', 'users', 'core_assignments', 'provider_credentials', 'migration_names', 'journal',
            'application_started', 'worker_started', 'migrations_requested', 'postcheck_read_only', 'client_tls_authorized'}
    require(isinstance(value, dict) and set(value) == keys and value['schema_version'] == 1 and value['status'] == 'verified' and
            value['mode'] == mode and value['source_sha'] == identity['source_sha'] and value['release_id'] == identity['release_id'],
            'invalid_action_result')
    require(value['migrations_verified'] == 45 and value['entity_tables_verified'] == 68 and value['users'] == 1 and
            value['core_assignments'] == 4 and value['provider_credentials'] == 0 and
            value['application_started'] is False and value['worker_started'] is False and
            value['migrations_requested'] is (mode == 'install') and value['postcheck_read_only'] is True and
            value['client_tls_authorized'] is True and HEX.fullmatch(value['migration_ledger_sha256']), 'invalid_action_result')
    names = value['migration_names']
    require(isinstance(names, list) and len(names) == len(set(names)) == 45 and
            all(isinstance(name, str) and re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{1,150}', name) for name in names) and
            names == sorted(names) and hashlib.sha256(json.dumps(names, separators=(',', ':')).encode()).hexdigest() == value['migration_ledger_sha256'],
            'invalid_migration_result')
    require(value['journal'] == {'first_sequence': 1, 'last_sequence': 0, 'entries': 0, 'backups': 0, 'open': True}, 'invalid_journal_result')
    return value


def guards(stage):
    require(not CURRENT.exists() and not CURRENT.is_symlink(), 'current_must_be_absent')
    stage.services_stopped()
    for name in ('nodia-api.service', 'nodia-ai-worker.service'):
        observed = subprocess.run(['systemctl', 'show', name, '--property=ActiveState,MainPID', '--no-pager'],
                                  capture_output=True, text=True, timeout=10, check=True)
        fields = dict(line.split('=', 1) for line in observed.stdout.strip().splitlines())
        require(fields.get('ActiveState') == 'inactive' and fields.get('MainPID') == '0', 'writers_must_be_inactive')


def installation_unit_paths(unit):
    matched = re.fullmatch(r'nodia-first-install-([a-f0-9]{32})\.service', unit)
    require(matched is not None, 'unsafe_installation_unit_namespace')
    token = matched.group(1)
    return UNIT_DIRECTORY / unit, PRIVATE / f'installation-{token}.json', PRIVATE / f'installation-{token}.log'


def destination_guard_command():
    # No connection is created. Only the exact private environment destination is compared to the pinned baseline.
    library = f'file:///usr/local/lib/nodia/inspect-postgres-installation-{PREFLIGHT_SHA}.mjs'
    baseline = f'/usr/local/lib/nodia/postgres-provider-baseline-{BASELINE_SHA}.json'
    script = f"const p=await import('{library}');const b=await p.loadProviderBaselineFile('{baseline}');const c=p.validatePostgresEnvironment(process.env);p.assertProviderBaselineDestination(b,{{host:c.host,port:c.port,database:c.database}});"
    return f'ExecStartPre=/usr/local/bin/node --input-type=module -e "{script}"\n'


def unit_content(candidate, action, mode, identity, output, error, *, bind_destination=True):
    guard = destination_guard_command() if bind_destination else ''
    return f'''[Unit]
Description=Nodia controlled first database installation
After=network-online.target docker.service
[Service]
Type=oneshot
User=nodia
Group=nodia
WorkingDirectory={candidate}
EnvironmentFile=/etc/nodia/runtime.env
EnvironmentFile=/etc/nodia/redis.env
Environment=NODE_ENV=production
Environment=PGSSLMODE=verify-full
Environment=HOME=/var/lib/nodia/home
Environment=PATH=/usr/local/bin:/usr/bin:/bin
{guard}ExecStart=/usr/local/bin/node {action} {mode} {identity['source_sha']}
TimeoutStartSec=240
TimeoutStopSec=10
KillMode=control-group
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
CapabilityBoundingSet=
AmbientCapabilities=
ReadOnlyPaths=/var/lib/nodia
UMask=0077
LimitFSIZE=8M
StandardOutput=file:{output}
StandardError=file:{error}
'''


def unit_properties(unit, runner):
    result = runner(['systemctl', 'show', unit, '--property=LoadState,ActiveState,MainPID,FragmentPath,DropInPaths', '--no-pager'],
                    capture_output=True, text=True, timeout=10, check=False)
    return dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)


def cleanup_installation_unit(unit, expected_content, *, allow_stop=False, runner=None):
    """Remove only our exact, root-owned unit. Explicit orphan cleanup never stops an active unit."""
    runner = runner or subprocess.run
    unit_path, _, _ = installation_unit_paths(unit)
    protected_file(unit_path)
    require(unit_path.read_text(encoding='utf-8') == expected_content, 'installation_unit_metadata_mismatch')
    before = unit_properties(unit, runner)
    require(before.get('FragmentPath') in ('', str(unit_path)), 'installation_unit_fragment_mismatch')
    require(not before.get('DropInPaths'), 'installation_unit_dropins_not_allowed')
    if not allow_stop:
        require(before.get('ActiveState') == 'inactive' and before.get('MainPID') == '0', 'orphan_unit_must_be_inactive')
    operations_failed = False
    if allow_stop:
        try:
            runner(['systemctl', 'stop', unit], capture_output=True, timeout=20, check=False)
        except (OSError, subprocess.TimeoutExpired):
            operations_failed = True
    try:
        runner(['systemctl', 'reset-failed', unit], capture_output=True, timeout=10, check=False)
        quiescent = unit_properties(unit, runner)
        require(quiescent.get('ActiveState') == 'inactive' and quiescent.get('MainPID') == '0', 'installation_unit_not_quiescent')
        protected_file(unit_path)
        require(unit_path.read_text(encoding='utf-8') == expected_content, 'installation_unit_metadata_mismatch')
        unit_path.unlink()
        reloaded = runner(['systemctl', 'daemon-reload'], capture_output=True, timeout=20, check=False)
        operations_failed = operations_failed or reloaded.returncode != 0
        final = unit_properties(unit, runner)
        require(final.get('ActiveState') == 'inactive' and final.get('MainPID') == '0' and final.get('FragmentPath') == '' and
                final.get('LoadState') in ('not-found', 'loaded') and not unit_path.exists() and not unit_path.is_symlink() and
                not operations_failed, 'installation_unit_cleanup_failed')
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ValueError('installation_unit_cleanup_failed') from error


def preserve_action_logs(output, error, *, private=None):
    private = private or PRIVATE
    for source, name in ((output, 'installation-action-output.json'), (error, 'installation-action-stderr.log')):
        if source.exists():
            os.replace(source, private / name)


def finish_action(unit, content, output, error, *, primary_error=None):
    secondary = None
    try:
        cleanup_installation_unit(unit, content, allow_stop=True)
    except Exception as failure:
        secondary = failure
    finally:
        try:
            preserve_action_logs(output, error)
        except Exception as failure:
            if secondary is None:
                secondary = failure
    if secondary is not None:
        if primary_error is None:
            raise secondary
        print('[Nodia first installation] secondary cleanup/log preservation failed; primary failure retained.', file=sys.stderr)


def original_action_result(output, identity, stage, *, modes=('install', 'verify')):
    try:
        protected_file(output, 0o600)
        require(output.stat().st_size <= 65536, 'original_action_result_too_large')
        value = stage.strict_json(output.read_bytes())
        for mode in modes:
            try:
                return safe_result(value, identity, mode)
            except (ValueError, TypeError, KeyError):
                continue
    except (OSError, ValueError, TypeError, KeyError, stage.Rejected):
        pass
    return None


def reconcile_orphan(unit, candidate, action, identity, stage):
    unit_path, output, _ = installation_unit_paths(unit)
    protected_file(unit_path)
    actual = unit_path.read_text(encoding='utf-8')
    mode = next((mode for mode in ('install', 'verify') for bound in (True, False)
                 if actual == unit_content(candidate, action, mode, identity, output,
                                           installation_unit_paths(unit)[2], bind_destination=bound)), None)
    require(mode is not None, 'orphan_unit_metadata_mismatch')
    observed = unit_properties(unit, subprocess.run)
    require(observed.get('ActiveState') == 'inactive' and observed.get('MainPID') == '0' and
            observed.get('FragmentPath') in ('', str(unit_path)), 'orphan_unit_must_be_inactive')
    # Missing/invalid evidence never authorizes SQL replay; the new verify action still must pass.
    original = original_action_result(output, identity, stage, modes=(mode,))
    cleanup_installation_unit(unit, actual, allow_stop=False)
    # Keep the original UUID logs in the private directory; new action logs use a fresh UUID.
    return original


def run_action(stage, candidate, manifest, action, mode, identity):
    guards(stage)
    account = pwd.getpwnam('nodia')
    require(account.pw_uid != 0 and account.pw_gid == grp.getgrnam('nodia').gr_gid and
            set(os.getgrouplist('nodia', account.pw_gid)) == {account.pw_gid}, 'unsafe_runtime_identity')
    for path in (Path('/etc/nodia/runtime.env'), Path('/etc/nodia/redis.env')):
        stage.protected_file(path)
    node = Path('/usr/local/bin/node').resolve(strict=True)
    protected_directory(node.parent)
    info = node.stat()
    require(info.st_uid == 0 and stat.S_ISREG(info.st_mode) and not info.st_mode & 0o022 and
            hashlib.sha256(node.read_bytes()).hexdigest() == manifest['runtime']['executable_sha256'], 'node_identity_mismatch')
    token = uuid.uuid4().hex
    unit = f'nodia-first-install-{token}.service'
    unit_path = Path('/run/systemd/system') / unit
    output = PRIVATE / f'installation-{token}.json'
    error = PRIVATE / f'installation-{token}.log'
    for path in (output, error):
        os.close(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600))
    content = unit_content(candidate, action, mode, identity, output, error)
    try:
        with unit_path.open('x', encoding='utf-8', newline='\n') as stream:
            stream.write(content)
        os.chmod(unit_path, 0o644)
        subprocess.run(['systemd-analyze', 'verify', str(unit_path)], capture_output=True, timeout=20, check=True)
        subprocess.run(['systemctl', 'daemon-reload'], capture_output=True, timeout=20, check=True)
        result = subprocess.run(['systemctl', 'start', '--wait', unit], capture_output=True, timeout=260, check=False)
        require(result.returncode == 0, 'installation_action_failed_no_automatic_retry')
        require(output.stat().st_size <= 65536, 'action_result_too_large')
        verified = safe_result(stage.strict_json(output.read_bytes()), identity, mode)
        guards(stage)
        return verified
    finally:
        finish_action(unit, content, output, error, primary_error=sys.exc_info()[1])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate')
    parser.add_argument('source_sha')
    parser.add_argument('archive')
    parser.add_argument('archive_sha256')
    parser.add_argument('--stage-helper-sha256', required=True)
    parser.add_argument('--action-sha256', required=True)
    parser.add_argument('--reconcile-only', action='store_true', help='Explicit read-only reconciliation; never requests seed or migration.')
    parser.add_argument('--cleanup-unit', help='Exact inactive first-install orphan to validate and remove; requires --reconcile-only.')
    args = parser.parse_args(argv)
    require(not args.cleanup_unit or args.reconcile_only, 'orphan_cleanup_requires_read_only_reconciliation')
    require(sys.platform == 'linux' and os.geteuid() == 0, 'root_linux_required')
    candidate = Path(args.candidate)
    require(re.fullmatch(r'/opt/nodia/candidates/backend-[a-f0-9]{12}-[a-f0-9]{12}', str(candidate)) and
            re.fullmatch(r'[a-f0-9]{40}', args.source_sha) and HEX.fullmatch(args.archive_sha256), 'invalid_installation_identity')
    for directory in (PRIVATE, LIBRARY, candidate):
        protected_directory(directory)
    require(stat.S_IMODE(PRIVATE.lstat().st_mode) == 0o700, 'private_directory_must_be_0700')
    for filename, expected in (
        ('inspect-postgres-installation-d720a261ddb9d414949b395c6a10fcb05faccf67b57ac48bbaf3072f189d05d3.mjs',
         'd720a261ddb9d414949b395c6a10fcb05faccf67b57ac48bbaf3072f189d05d3'),
        ('postgres-provider-baseline-7f4977ac62b5bae24e193f8848b7ec6dd1fda8b3e94cdb19a76c554a5e69dd7f.json',
         '7f4977ac62b5bae24e193f8848b7ec6dd1fda8b3e94cdb19a76c554a5e69dd7f')):
        installed = LIBRARY / filename
        protected_file(installed)
        require(hashlib.sha256(installed.read_bytes()).hexdigest() == expected, 'installed_preflight_digest_mismatch')
    source = Path(__file__).resolve().parent
    validator = install_pinned(source / 'stage-backend-candidate.py', args.stage_helper_sha256,
                               f'stage-validator-{args.stage_helper_sha256}.py')
    spec = importlib.util.spec_from_file_location('installation_stager', validator)
    stage = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stage)
    action = install_pinned(source / 'install-backend-database.mjs', args.action_sha256,
                            f'install-backend-database-{args.action_sha256}.mjs')
    lock_path = PRIVATE / 'installation.lock'
    descriptor = os.open(lock_path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'a') as lock:
        protected_file(lock_path, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        guards(stage)
        private_archive = stage.copy_uploaded(args.archive, args.archive_sha256)
        try:
            with tarfile.open(private_archive, 'r:gz') as archive:
                plan = stage.read_plan(archive, allow_git_release=True)
                manifest = plan['manifest']
                require(manifest['deployment_eligible'] is True and manifest['source_provenance'] == 'git_archive' and
                        manifest['source_sha'] == args.source_sha and manifest['release_id'] == candidate.name,
                        'exact_git_release_required')
                stage.verify_tree(candidate, plan)
        finally:
            private_archive.unlink()
        identity = {'source_sha': args.source_sha, 'release_id': candidate.name, 'archive_sha256': args.archive_sha256,
                    'action_sha256': args.action_sha256, 'stage_helper_sha256': args.stage_helper_sha256}
        previous = None
        if STATE.exists() or STATE.is_symlink():
            protected_file(STATE, 0o600)
            previous = stage.strict_json(STATE.read_bytes())
        mode = execution_mode(previous, identity, reconcile_only=args.reconcile_only)
        reconciliation = {}

        if args.reconcile_only:
            # Preserve the original durable failure before inspecting or cleaning its private evidence.
            history_path = PRIVATE / f'installation-history-{uuid.uuid4().hex}.json'
            stage.atomic_json(history_path, previous, 0o600)
            history_directory = os.open(PRIVATE, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(history_directory)
            finally:
                os.close(history_directory)
            reconciliation = {'reconcile_only': True, 'migrations_requested': False,
                              'original_attempt': {key: previous.get(key) for key in ('phase', 'error_code', 'updated_at_utc')},
                              'original_action_result_adopted': False}
            if args.cleanup_unit:
                adopted = reconcile_orphan(args.cleanup_unit, candidate, action, identity, stage)
            else:
                adopted = original_action_result(PRIVATE / 'installation-action-output.json', identity, stage)
            if adopted is not None:
                reconciliation.update(original_action_result_adopted=True, original_action_result=adopted)

        def status(phase, **extra):
            payload = {'schema_version': 1, **identity, **reconciliation, 'phase': phase,
                       'updated_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), **extra}
            for filename, permissions in ((STATE, 0o600), (PUBLIC, 0o644)):
                stage.atomic_json(filename, payload, permissions)
                parent = os.open(filename.parent, os.O_RDONLY | os.O_DIRECTORY)
                try:
                    os.fsync(parent)
                finally:
                    os.close(parent)

        # Persist before any child can request SQL. Any incomplete/failed phase refuses automatic retry.
        status('reconciling_read_only' if args.reconcile_only else ('installation_started' if mode == 'install' else 'verifying_completed_installation'),
               migrations_requested=mode == 'install')
        try:
            result = run_action(stage, candidate, manifest, action, mode, identity)
            status('complete', result=result, **({'completion_kind': 'reconciled_read_only', 'migrations_requested': False}
                                               if args.reconcile_only else {}))
            print('[Nodia first installation] complete: database verified; API/worker remain inactive. No app activation or backup acceptance.')
        except Exception as error:
            code = str(error) if re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'installation_failed_or_unknown'
            status('failed', error_code=code, automatic_retry_allowed=False)
            raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'installation_failed_or_unknown'
        print(f'[Nodia first installation] failed: {code}. Preserve DB/config; no automatic rollback or retry.', file=sys.stderr)
        sys.exit(1)
