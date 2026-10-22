"""One schema-only isolated restore diagnostic. No business rows or real backup."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import time


NODE = r'''
import fs from 'node:fs';import{createRequire}from'node:module';
const root=process.argv[2],require=createRequire(root+'/package.json');
const env=require('dotenv').parse(fs.readFileSync(root+'/.env'));const{DataSource}=require('typeorm');
const db=await new DataSource({type:'postgres',host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),username:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB,entities:[],synchronize:false,extra:{options:'-c default_transaction_read_only=on'}}).initialize();
try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='10000ms'");
const snapshot=(await db.query('SELECT pg_export_snapshot() id'))[0].id;
const metadata=(await db.query(`SELECT jsonb_build_object('constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid)) ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')) value`))[0].value;
const locale=(await db.query("SELECT pg_encoding_to_char(encoding) encoding,datcollate,datctype,datlocprovider FROM pg_database WHERE datname=current_database()"))[0];
process.stdout.write(JSON.stringify({snapshot,metadata,locale,pg:{PGHOST:env.POSTGRES_HOST,PGPORT:env.POSTGRES_PORT,PGUSER:env.POSTGRES_USER,PGPASSWORD:env.POSTGRES_PASSWORD,PGDATABASE:env.POSTGRES_DB}})+'\n');
await new Promise(resolve=>process.stdin.once('data',resolve));await db.query('ROLLBACK');
}finally{await db.destroy();}
'''
TARGET_SQL = r"""BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object('constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid)) ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'));
SELECT jsonb_build_object('encoding',pg_encoding_to_char(encoding),'datcollate',datcollate,'datctype',datctype,'datlocprovider',datlocprovider) FROM pg_database WHERE datname=current_database();
ROLLBACK;
"""


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def main():
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-backup-schema-only-control-r01')
    work.mkdir(mode=0o700, exist_ok=False)
    before = set(subprocess.run(['docker', 'ps', '-a', '--format', '{{.ID}}'], capture_output=True, check=True).stdout.decode().splitlines())
    report = {'stage': 'AI-38', 'scope': 'schema_only_disposable_restore_constraint_set_diagnostic',
              'status': 'running', 'configured_SQL_writes': 0, 'provider_requests': 0,
              'business_rows_dumped': False, 'real_backup_created': False, 'original_database_restored': False,
              'started_at_utc': datetime.now(timezone.utc).isoformat()}
    suffix = str(os.getpid()) + '_' + secrets.token_hex(4)
    restore_name, dump_name = ['ai38_schema_only_' + kind + '_' + suffix for kind in ('restore', 'dump')]
    children, own = [], []
    source = None
    started = time.monotonic()
    deadline = started + 90

    def remaining(cap=10):
        value = min(cap, deadline - time.monotonic())
        assert value > 0
        return value

    def run(argv, **kwargs):
        return subprocess.run(argv, capture_output=True, check=True, timeout=remaining(kwargs.pop('timeout', 10)), **kwargs)

    try:
        # Keep stdin for the completion signal; --eval contains public SQL only.
        source = subprocess.Popen(['/usr/local/bin/node', '--input-type=module', '--eval', NODE.replace('process.argv[2]', 'process.argv[1]'), '/opt/nodia/releases/nodia-server-ai15-20261016'],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True,
                                  env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/nonexistent', 'DOTENV_CONFIG_PATH': '/dev/null'})
        children.append(source)
        import select
        assert select.select([source.stdout], [], [], remaining(20))[0]
        private = json.loads(source.stdout.readline(4 * 1024 * 1024))
        assert re.fullmatch(r'[A-Fa-f0-9]+-[A-Fa-f0-9]+-[0-9]+', private['snapshot'])
        assert private['pg']['PGHOST'] in ('localhost', '127.0.0.1', '::1')
        report['source_locale'] = private['locale']
        target_password = secrets.token_hex(24)
        run(['docker', 'run', '-d', '--rm', '--pull=never', '--network=none', '--name', restore_name,
             '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,nodev,size=512m', '-e', 'POSTGRES_USER=ai38schema',
             '-e', 'POSTGRES_DB=ai38schema', '-e', 'POSTGRES_PASSWORD', '-e', 'PGPASSWORD', 'postgres:16-alpine'],
            env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'POSTGRES_PASSWORD': target_password, 'PGPASSWORD': target_password})
        own.append(restore_name)
        inspected = json.loads(run(['docker', 'inspect', restore_name]).stdout)[0]
        assert inspected['HostConfig']['NetworkMode'] == 'none' and not inspected['HostConfig']['PortBindings']
        for index in range(100):
            ready = subprocess.run(['docker', 'exec', restore_name, 'psql', '-X', '-qAt', '-h', '127.0.0.1', '-U', 'ai38schema', '-d', 'ai38schema', '-c', 'SELECT 1'], capture_output=True, timeout=remaining(5))
            if ready.returncode == 0 and ready.stdout.strip() == b'1':
                break
            assert index < 99; time.sleep(0.1)
        env = {'PATH': '/usr/local/bin:/usr/bin:/bin', **private['pg'], 'PGOPTIONS': '-c default_transaction_read_only=on -c statement_timeout=30000'}
        flags = [part for key in (*private['pg'], 'PGOPTIONS') for part in ('--env', key)]
        dump = subprocess.Popen(['docker', 'run', '--rm', '--pull=never', '--network=host', '--name', dump_name, *flags,
                                 'postgres:16-alpine', 'pg_dump', '--schema-only', '--format=custom', '--snapshot=' + private['snapshot']],
                                env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True)
        children.append(dump); own.append(dump_name)
        restore = subprocess.Popen(['docker', 'exec', '-i', restore_name, 'pg_restore', '--exit-on-error', '--no-owner', '--no-acl', '-h', '127.0.0.1', '-U', 'ai38schema', '-d', 'ai38schema'],
                                   stdin=dump.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        children.append(restore); dump.stdout.close(); restore.wait(timeout=remaining(40)); dump.wait(timeout=remaining(5))
        assert restore.returncode == dump.returncode == 0
        result = run(['docker', 'exec', '-i', restore_name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-U', 'ai38schema', '-d', 'ai38schema'], input=TARGET_SQL.encode())
        values = [json.loads(line) for line in result.stdout.decode().splitlines()]
        restored, locale = values
        report['restored_locale'] = locale
        report['locale_fields_equal'] = private['locale'] == locale
        original_rows, restored_rows = private['metadata']['constraints'], restored['constraints']
        a, b = {(row[0], row[1]): row[2] for row in original_rows}, {(row[0], row[1]): row[2] for row in restored_rows}
        assert len(a) == len(original_rows) and len(b) == len(restored_rows)
        changed = []
        for key in sorted(a.keys() | b.keys()):
            if a.get(key) != b.get(key):
                assert all(re.fullmatch(r'[A-Za-z0-9_]{1,128}', name) for name in key)
                left, right = a.get(key), b.get(key)
                changed.append({'table': key[0], 'constraint': key[1], 'present_in_source': left is not None,
                                'present_in_restore': right is not None, 'source_sha256': digest(left), 'restore_sha256': digest(right),
                                'source_length': len(left) if left is not None else None, 'restore_length': len(right) if right is not None else None,
                                'equal_ignoring_whitespace': left is not None and right is not None and re.sub(r'\s+', '', left) == re.sub(r'\s+', '', right)})
        report.update(status='observed_not_backup_acceptance', original_constraints=len(a), restored_constraints=len(b),
                      exact_constraint_key_sets_equal=a.keys() == b.keys(), exact_definitions_by_key_equal=a == b,
                      source_array_sha256=digest(original_rows), restored_array_sha256=digest(restored_rows),
                      sorted_source_sha256=digest(sorted(original_rows, key=lambda row: (row[0], row[1]))),
                      sorted_restored_sha256=digest(sorted(restored_rows, key=lambda row: (row[0], row[1]))),
                      changed_constraints=changed)
    except Exception as error:
        report['status'] = 'failed_preserved_no_retry'; report['failure_class'] = type(error).__name__
    finally:
        if source and source.poll() is None:
            source.stdin.write(b'done\n'); source.stdin.flush()
            try:
                source.wait(timeout=3)
            except subprocess.TimeoutExpired:
                source.kill()
        for child in children:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGKILL); child.wait(timeout=3)
        names = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, check=True, timeout=10).stdout.decode().splitlines()
        for name in set(own).intersection(names):
            assert re.fullmatch(r'ai38_schema_only_(?:restore|dump)_[0-9]+_[a-f0-9]{8}', name)
            subprocess.run(['docker', 'rm', '-f', name], capture_output=True, check=True, timeout=10)
        after = set(subprocess.run(['docker', 'ps', '-a', '--format', '{{.ID}}'], capture_output=True, check=True, timeout=10).stdout.decode().splitlines())
        names = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, check=True, timeout=10).stdout.decode().splitlines()
        report['preexisting_container_ids_preserved'] = before.issubset(after)
        report['owned_containers_remaining'] = len(set(own).intersection(names))
        report['elapsed_seconds'] = round(time.monotonic() - started, 3)
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        with (work / 'public-report.json').open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
