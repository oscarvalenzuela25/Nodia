"""Prepare a LOCAL encrypted backup/isolated restore before a closed adoption drill.

No execution without --execute and explicit --retention-hours (maximum 168).
--dry-run is offline and performs no file, service, DB, Docker or network operation.
The original database is NEVER restored. Opening restored content is NEVER authorized.
Root must review before execution. Requires API/worker already inactive and quiet.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import select
import shutil
import signal
import subprocess
import time


WORK = Path('/opt/nodia/verification/ai38-adoption-backup-r02')
ORIGINAL = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
UNIT = 'nodia-ai38-backup-expiry-r02'
MANIFEST = '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'
META = r"""
SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'),
 'columns',(SELECT jsonb_agg(jsonb_build_array(table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(tablename,indexname,indexdef) ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public'),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid)) ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 'migrations',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM public.migrations m),
 'guard',jsonb_build_object(
  'pending_jobs',(SELECT count(*) FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')),
  'open_attempts',(SELECT count(*) FROM nodia_ai_job_attempts WHERE ended_at IS NULL),
  'retained_slots',(SELECT count(*) FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')),
  'active_executions',(SELECT count(*) FROM nodia_ai_executions WHERE state IN ('queued','running','waiting_for_user','cancel_requested','unknown'))));
"""


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def file_sha(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def count_sql(tables):
    assert isinstance(tables, list) and 0 < len(tables) < 1000
    assert all(isinstance(name, str) and re.fullmatch(r'[a-z_][a-z0-9_]{0,62}', name) for name in tables)
    return 'SELECT jsonb_object_agg(name,n) FROM (' + ' UNION ALL '.join(
        "SELECT '" + name + "'::text name,count(*)::bigint n FROM public.\"" + name + '\"' for name in tables) + ') t;\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--dry-run', action='store_true')
    action.add_argument('--execute', action='store_true')
    parser.add_argument('--retention-hours', type=int)
    args = parser.parse_args()
    if args.retention_hours is not None:
        assert 1 <= args.retention_hours <= 168
    if args.dry_run:
        print(json.dumps({'status': 'prepared_not_executed', 'configured_database_backup': False,
                          'encryption': {'format': 'openpgp', 'cipher': 'AES256', 'integrity': 'MDC'},
                          'original_database_restored': False, 'restored_content_served': False,
                          'outer_deadline_seconds': 300, 'retention_hours_must_be_explicit': True,
                          'maximum_retention_hours': 168, 'persistent_expiry_timer_required': True,
                          'backup_and_passphrase_retained_until_closed_drill_or_expiry': True,
                          'publication_authorized': False, 'provider_requests': 0}, indent=2))
        return 0
    assert os.name == 'posix' and os.geteuid() == 0
    assert args.retention_hours is not None and 1 <= args.retention_hours <= 168
    assert not WORK.exists()
    for binary in ('docker', 'gpg', 'gpgconf', 'systemctl', 'node'):
        assert shutil.which(binary), 'required_local_tool_missing'
    for unit in ('nodia-api', 'nodia-ai-worker'):
        state = subprocess.run(['systemctl', 'show', unit, '--property=ActiveState', '--value'],
                               capture_output=True, check=True, timeout=15).stdout.decode().strip()
        assert state == 'inactive', 'writers_must_be_quiesced_by_drill_coordinator'
    candidate = Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
    assert hashlib.sha256((candidate / 'manifest.json').read_bytes()).hexdigest() == MANIFEST
    migration_hashes = lambda root: {file.name: hashlib.sha256(file.read_bytes()).hexdigest()
                                   for file in (root / 'dist/migrations').glob('*.js')}
    assert migration_hashes(candidate) == migration_hashes(ORIGINAL)
    assert len(migration_hashes(candidate)) == 29
    os.umask(0o077)
    WORK.mkdir(mode=0o700)
    started = time.monotonic()
    deadline = started + 270  # reserve 30 seconds of the outer limit for owned cleanup
    report = {'stage': 'AI-38', 'scope': 'local_original_database_encrypted_backup_and_unserved_isolated_restore',
              'status': 'running', 'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'configured_database_backup': True, 'configured_database_writes': 0,
              'disposable_restore_verified': False, 'original_database_restored': False,
              'restored_content_served': False, 'provider_requests': 0, 'storage_operations': 0,
              'encryption': {'format': 'openpgp', 'cipher': 'AES256', 'integrity': 'MDC'},
              'retention_hours': args.retention_hours, 'maximum_retention_hours': 168,
              'external_rotation_journal_or_production_restore_verified': False,
              'release_authorized': False, 'started_at_utc': datetime.now(timezone.utc).isoformat()}
    processes, owned, created_units = [], [], []
    labels = {}
    buffers = {}
    unit_paths = [Path('/etc/systemd/system') / (UNIT + suffix) for suffix in ('.service', '.timer')]
    backup, passfile = WORK / 'private-original-db.pgdump.gpg', WORK / 'private-passphrase'
    gnupg = WORK / 'private-gnupg'
    gnupg.mkdir(mode=0o700)
    expiry_installed = False
    source = None
    code = 1

    def remaining(cap=30):
        value = min(cap, deadline - time.monotonic())
        if value <= 0:
            raise TimeoutError('outer_deadline')
        return value

    def run(argv, **kwargs):
        return subprocess.run(argv, timeout=remaining(kwargs.pop('timeout', 30)), check=True, capture_output=True, **kwargs)

    def launch(argv, env=None, stdin=None, label='process'):
        # A failed COPY could include a row in its error context: never write PG stderr.
        err = open(os.devnull, 'wb') if label in ('source', 'dump', 'restore', 'target') else (WORK / ('private-' + label + '-stderr.log')).open('xb')
        child = subprocess.Popen(argv, env=env, stdin=subprocess.PIPE if stdin is None else stdin,
                                 stdout=subprocess.PIPE, stderr=err, bufsize=0, start_new_session=True)
        err.close(); processes.append(child); labels[child.pid] = label
        return child

    def json_line(child):
        raw = buffers.pop(child.pid, bytearray())
        while True:
            assert len(raw) <= 4 * 1024 * 1024, 'metadata_bound'
            if b'\n' in raw:
                line, rest = raw.split(b'\n', 1)
                buffers[child.pid] = bytearray(rest)
                return json.loads(line)
            ready, _, _ = select.select([child.stdout], [], [], remaining(60))
            assert ready, 'metadata_deadline'
            chunk = os.read(child.stdout.fileno(), 4096)
            assert chunk, 'metadata_process_closed'
            raw.extend(chunk)

    def query(child, sql):
        child.stdin.write(sql.encode()); child.stdin.flush()
        return json_line(child)

    try:
        report['execution_stage'] = 'prepare_retention'
        expiry = datetime.now(timezone.utc) + timedelta(hours=args.retention_hours)
        passfile.write_bytes(secrets.token_hex(32).encode() + b'\n')
        assert passfile.stat().st_mode & 0o777 == 0o600 and WORK.stat().st_mode & 0o777 == 0o700
        # Persistent system units survive a reboot; only these two exact private files are removed.
        cleanup = WORK / 'private-expiry.py'
        cleanup.write_text("from pathlib import Path\nroot=Path(" + repr(str(WORK)) + ")\n"
                           "assert root.is_dir() and not root.is_symlink()\n"
                           "for name in ('private-original-db.pgdump.gpg','private-passphrase'):\n"
                           " p=root/name\n assert not p.is_symlink()\n p.unlink(missing_ok=True)\n", encoding='utf-8')
        assert all(not path.exists() for path in unit_paths)
        unit_paths[0].write_text('[Unit]\nDescription=NodiaAI closed-drill private backup expiry\n[Service]\nType=oneshot\nUser=root\nUMask=0077\nExecStart=/usr/bin/python3 ' + str(cleanup) + '\n', encoding='utf-8')
        created_units.append(unit_paths[0])
        unit_paths[1].write_text('[Unit]\nDescription=NodiaAI closed-drill bounded backup retention\n[Timer]\nOnCalendar=' + expiry.strftime('%Y-%m-%d %H:%M:%S UTC') + '\nPersistent=true\nAccuracySec=1s\nUnit=' + UNIT + '.service\n[Install]\nWantedBy=timers.target\n', encoding='utf-8')
        created_units.append(unit_paths[1])
        expiry_installed = True
        run(['systemctl', 'daemon-reload'])
        run(['systemctl', 'enable', '--now', UNIT + '.timer'])
        assert run(['systemctl', 'is-active', UNIT + '.timer']).stdout.strip() == b'active'
        report['expiry_timer_persistent'] = True
        report['backup_expires_at_utc'] = expiry.isoformat()
        report['execution_stage'] = 'open_source_snapshot'
        # Parse only PostgreSQL settings through a private pipe; never emit or copy the .env.
        env_reader = "const fs=require('node:fs');const dotenv=require(process.argv[1]+'/node_modules/dotenv');const e=dotenv.parse(fs.readFileSync(process.argv[1]+'/.env'));process.stdout.write(JSON.stringify(Object.fromEntries(['POSTGRES_HOST','POSTGRES_PORT','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_DB'].map(k=>[k,e[k]]))));"
        private = json.loads(run(['/usr/local/bin/node', '-e', env_reader, str(ORIGINAL)], env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(WORK)}).stdout)
        assert private['POSTGRES_HOST'] in ('localhost', '127.0.0.1', '::1')
        assert all(isinstance(value, str) and value for value in private.values())
        pg_env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(WORK),
                  'PGHOST': private['POSTGRES_HOST'], 'PGPORT': private['POSTGRES_PORT'],
                  'PGUSER': private['POSTGRES_USER'], 'PGPASSWORD': private['POSTGRES_PASSWORD'],
                  'PGDATABASE': private['POSTGRES_DB'], 'PGOPTIONS': '-c default_transaction_read_only=on -c statement_timeout=60000'}
        pg_flags = [value for key in ('PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGOPTIONS') for value in ('--env', key)]
        suffix = str(os.getpid()) + '_' + secrets.token_hex(4)
        source_name, dump_name, restore_name = ['ai38_backup_' + kind + '_' + suffix for kind in ('source', 'dump', 'restore')]
        owned.extend([source_name, dump_name, restore_name])
        source = launch(['docker', 'run', '--rm', '-i', '--pull=never', '--network=host', '--name', source_name,
                         *pg_flags, 'postgres:16-alpine', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], pg_env, label='source')
        snapshot = query(source, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT json_build_object('id',pg_export_snapshot(),'version',current_setting('server_version_num')::int);\n")
        assert 160000 <= snapshot['version'] < 170000
        assert re.fullmatch(r'[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+', snapshot['id'])
        original = query(source, META)
        assert len(original['migrations']) == 29 and all(value == 0 for value in original['guard'].values())
        counts_sql = count_sql(original['tables'])
        original_counts = query(source, counts_sql)
        report['execution_stage'] = 'dump_and_encrypt'
        dump = launch(['docker', 'run', '--rm', '--pull=never', '--network=host', '--name', dump_name,
                       *pg_flags, 'postgres:16-alpine', 'pg_dump', '--format=custom', '--compress=0', '--snapshot=' + snapshot['id']], pg_env, label='dump')
        gpg_base = ['gpg', '--no-options', '--homedir', str(gnupg), '--batch', '--pinentry-mode=loopback', '--no-symkey-cache', '--passphrase-file', str(passfile)]
        encrypt = launch([*gpg_base, '--cipher-algo=AES256', '--force-mdc', '--symmetric', '--output', str(backup)], stdin=dump.stdout, label='encrypt')
        dump.stdout.close(); encrypt.wait(timeout=remaining(120)); dump.wait(timeout=remaining(10))
        assert encrypt.returncode == dump.returncode == 0 and backup.stat().st_size > 0
        source.stdin.write(b'ROLLBACK;\n'); source.stdin.close(); source.wait(timeout=remaining(10)); assert source.returncode == 0
        report['source_snapshot_finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        assert backup.stat().st_mode & 0o777 == 0o600
        report['encrypted_backup_sha256'] = file_sha(backup)
        report['encrypted_backup_bytes'] = backup.stat().st_size
        report['execution_stage'] = 'start_restore_container'
        restore_password = secrets.token_hex(24)
        # PostgreSQL restore has no network interface, published port, operational mounts or app.
        run(['docker', 'run', '-d', '--rm', '--pull=never', '--network=none', '--name', restore_name,
             '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,nodev,size=512m',
             '-e', 'POSTGRES_USER=ai38restore', '-e', 'POSTGRES_DB=ai38restore', '-e', 'POSTGRES_PASSWORD', '-e', 'PGPASSWORD', 'postgres:16-alpine'],
            env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'POSTGRES_PASSWORD': restore_password, 'PGPASSWORD': restore_password})
        inspected = json.loads(run(['docker', 'inspect', restore_name]).stdout)[0]
        assert inspected['HostConfig']['NetworkMode'] == 'none' and not inspected['HostConfig']['PortBindings']
        assert '/var/lib/postgresql/data' in inspected['HostConfig']['Tmpfs']
        report['restore_network_none_no_ports_tmpfs'] = True
        report['execution_stage'] = 'wait_final_TCP_database'
        for index in range(80):
            # The entrypoint's temporary initdb server listens only on Unix
            # sockets. TCP readiness avoids mistaking that server for the final
            # process, and SELECT additionally verifies the requested database.
            ready = subprocess.run(['docker', 'exec', restore_name, 'pg_isready', '-h', '127.0.0.1', '-U', 'ai38restore', '-d', 'ai38restore'], capture_output=True, timeout=remaining(5))
            if ready.returncode == 0:
                database_ready = subprocess.run(['docker', 'exec', restore_name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-U', 'ai38restore', '-d', 'ai38restore', '-c', 'SELECT 1'], capture_output=True, timeout=remaining(5))
                if database_ready.returncode == 0 and database_ready.stdout.strip() == b'1':
                    report['final_TCP_database_ready'] = True
                    break
            assert index < 79; time.sleep(0.1)
        report['execution_stage'] = 'decrypt_and_restore'
        status_path = WORK / 'private-decrypt-status.log'
        decrypt = launch([*gpg_base, '--status-file', str(status_path), '--decrypt', str(backup)], label='decrypt')
        restore = launch(['docker', 'exec', '-i', restore_name, 'pg_restore', '--exit-on-error', '--no-owner', '--no-acl', '-h', '127.0.0.1', '-U', 'ai38restore', '-d', 'ai38restore'], stdin=decrypt.stdout, label='restore')
        decrypt.stdout.close(); restore.wait(timeout=remaining(120)); decrypt.wait(timeout=remaining(10))
        assert decrypt.returncode == restore.returncode == 0
        report['execution_stage'] = 'verify_integrity'
        status = status_path.read_text(encoding='utf-8')
        assert '[GNUPG:] GOODMDC' in status and '[GNUPG:] DECRYPTION_OKAY' in status
        assert re.search(r'^\[GNUPG:\] DECRYPTION_INFO 2 9(?: 0)?$', status, re.MULTILINE)
        report['execution_stage'] = 'collect_restored_metadata'
        target = launch(['docker', 'exec', '-i', restore_name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-U', 'ai38restore', '-d', 'ai38restore'], label='target')
        target.stdin.write(('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n' + META + counts_sql + 'ROLLBACK;\n').encode()); target.stdin.close()
        restored, restored_counts = json_line(target), json_line(target)
        target.wait(timeout=remaining(10)); assert target.returncode == 0
        report['execution_stage'] = 'compare_metadata'
        allowed_keys = ('tables', 'columns', 'indexes', 'constraints', 'migrations', 'guard')
        assert set(restored) == set(original) == set(allowed_keys)
        report['metadata_comparison'] = {
            'mismatched_keys': [key for key in allowed_keys if restored[key] != original[key]],
            'source_digests': {key: digest(original[key]) for key in allowed_keys},
            'restored_digests': {key: digest(restored[key]) for key in allowed_keys},
            'source_table_count': len(original['tables']), 'restored_table_count': len(restored['tables']),
            'row_count_mismatches': sum(restored_counts.get(key) != original_counts.get(key) for key in set(restored_counts) | set(original_counts)),
        }
        assert restored == original and restored_counts == original_counts
        report.update(disposable_restore_verified=True, migration_count=29, public_table_count=len(original['tables']),
                      schema_and_ledger_sha256=digest(original), table_counts_sha256=digest(original_counts),
                      migration_ledger_sha256=digest(original['migrations']), guard_state=original['guard'],
                      backup_retained_for_closed_drill=True, passphrase_retained_privately=True, status='passed')
        report['execution_stage'] = 'completed'
        code = 0
    except Exception as error:
        report['status'] = 'failed_preserved_no_retry'
        report['failure_class'] = type(error).__name__
    finally:
        cleanup_deadline = started + 300

        def cleanup_timeout(cap):
            return max(0.1, min(cap, cleanup_deadline - time.monotonic()))

        for child in processes:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=cleanup_timeout(2))
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL); child.wait(timeout=cleanup_timeout(1))
        report['child_exit_codes'] = {labels[child.pid]: child.poll() for child in processes}
        names = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], check=True, capture_output=True, timeout=cleanup_timeout(3)).stdout.decode().splitlines()
        for name in set(owned).intersection(names):
            assert re.fullmatch(r'ai38_backup_(?:source|dump|restore)_[0-9]+_[a-f0-9]{8}', name)
            subprocess.run(['docker', 'rm', '-f', name], check=True, capture_output=True, timeout=cleanup_timeout(3))
        names_after = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], check=True, capture_output=True, timeout=cleanup_timeout(3)).stdout.decode().splitlines()
        report['owned_containers_remaining'] = len(set(owned).intersection(names_after))
        subprocess.run(['gpgconf', '--homedir', str(gnupg), '--kill', 'gpg-agent'], capture_output=True, timeout=cleanup_timeout(3))
        if code != 0:
            backup.unlink(missing_ok=True); passfile.unlink(missing_ok=True)
            report['failed_copy_and_passphrase_removed'] = True
            if created_units:
                subprocess.run(['systemctl', 'disable', '--now', UNIT + '.timer'], capture_output=True, timeout=cleanup_timeout(3))
                for path in created_units:
                    path.unlink()
                subprocess.run(['systemctl', 'daemon-reload'], capture_output=True, timeout=cleanup_timeout(3))
        if expiry_installed:
            report['expiry_timer_active_after'] = subprocess.run(['systemctl', 'is-active', UNIT + '.timer'], capture_output=True, timeout=cleanup_timeout(3)).stdout.strip() == b'active'
        if code == 0 and (report['owned_containers_remaining'] != 0 or not report.get('expiry_timer_active_after')):
            report['status'] = 'failed_cleanup_or_expiry'; code = 1
        report['elapsed_seconds'] = round(time.monotonic() - started, 3)
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        with (WORK / 'public-report.json').open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
