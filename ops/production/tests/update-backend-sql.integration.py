#!/usr/bin/env python3
"""Disposable PostgreSQL16/TLS integration. No production credentials or TS build."""
import json
import argparse
import hashlib
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]
TOKEN = uuid.uuid4().hex[:12]
PREFIX = 'nodia-update-sql-' + TOKEN
NETWORK = PREFIX + '-net'
CERTS = PREFIX + '-certs'
RELEASES = PREFIX + '-releases'
PG = PREFIX + '-pg'
NODE = PREFIX + '-node'
NODE_IMAGE = 'node:24.22.2-bookworm'
PG_IMAGE = 'postgres:16-bookworm'
PASSWORD = 'synthetic-sql-fixture-password'


def command(args, *, stdin=None, timeout=240, check=True):
    # Binary stdin preserves LF when driving Linux shells from Windows.
    result = subprocess.run(args, input=stdin.encode('utf-8') if stdin is not None else None,
                            capture_output=True, timeout=timeout)
    result.stdout = result.stdout.decode('utf-8', errors='replace')
    result.stderr = result.stderr.decode('utf-8', errors='replace')
    if check and result.returncode:
        raise RuntimeError(json.dumps({'command': args[:3], 'exit_code': result.returncode,
                                       'stdout': result.stdout[-12000:], 'stderr': result.stderr[-12000:]}))
    return result


def docker(*args, **kwargs):
    return command(['docker', *args], **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--runtime-volume', help='Explicit local fixture volume with runtime-r02; never a production volume')
    source.add_argument('--runtime-archive', type=Path, help='Prebuilt f01 v1 backend tar.gz, no recompilation')
    parser.add_argument('--runtime-sha256')
    parser.add_argument('--candidate-dist', type=Path, help='Optional compiled Teacher48 fixture, never production-eligible')
    args = parser.parse_args()
    resources = {'containers': [], 'volumes': [], 'network': False}
    try:
        # Pull before creating an internal network; the test containers have no internet route.
        docker('image', 'inspect', NODE_IMAGE)
        if docker('image', 'inspect', PG_IMAGE, check=False).returncode:
            docker('pull', PG_IMAGE, timeout=300)
        runtime_volume = args.runtime_volume
        if args.runtime_archive:
            archive = args.runtime_archive.resolve(strict=True)
            with archive.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            if digest != args.runtime_sha256:
                raise ValueError('reviewed_runtime_archive_digest_required')
            runtime_volume = PREFIX + '-runtime'
            docker('volume', 'create', runtime_volume)
            resources['volumes'].append(runtime_volume)
            extraction = '''import importlib.util,pathlib,sys,tarfile,os
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('stage','/input/stage.py')
stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)
with tarfile.open('/input/runtime.tar.gz','r:gz') as archive:
    plan=stage.read_plan(archive,allow_git_release=True)
    assert plan['manifest']['source_sha']=='f01b493336883403a84b1c80759ce4fc43cbd370'
    target=pathlib.Path('/artifact/runtime-r02');target.mkdir(mode=0o700)
    stage.extract_verified(archive,plan,target);target.chmod(0o755)
'''
            docker('run', '--rm', '-i', '--network', 'none',
                   '--mount', f'type=volume,source={runtime_volume},target=/artifact',
                   '--mount', f'type=bind,source={archive},target=/input/runtime.tar.gz,readonly',
                   '--mount', f'type=bind,source={ROOT / "ops/production/stage-backend-candidate.py"},target=/input/stage.py,readonly',
                   NODE_IMAGE, 'python3', '-I', '-', stdin=extraction, timeout=180)
        else:
            docker('volume', 'inspect', runtime_volume)
        docker('network', 'create', '--internal', NETWORK)
        resources['network'] = True
        for volume in (CERTS, RELEASES):
            docker('volume', 'create', volume)
            resources['volumes'].append(volume)
        certificate_script = r'''set -eu
cd /certs
openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 1 -subj /CN=Nodia-Synthetic-SQL-CA >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj /CN=update-pg >/dev/null 2>&1
printf 'subjectAltName=DNS:update-pg\nextendedKeyUsage=serverAuth\n' >server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 1 -extfile server.ext >/dev/null 2>&1
chmod 600 ca.key server.key
chmod 644 ca.crt server.crt
chown 999:999 server.key
'''
        docker('run', '--rm', '-i', '--network', 'none', '--mount', f'type=volume,source={CERTS},target=/certs',
               NODE_IMAGE, 'bash', '-s', stdin=certificate_script)
        docker('run', '-d', '--name', PG, '--network', NETWORK, '--network-alias', 'update-pg',
               '--network-alias', 'wrong-pg',
               '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=768m',
               '--mount', f'type=volume,source={CERTS},target=/certs,readonly',
               '-e', 'POSTGRES_USER=fixture_admin', '-e', f'POSTGRES_PASSWORD={PASSWORD}',
               PG_IMAGE, 'postgres', '-c', 'ssl=on', '-c', 'ssl_cert_file=/certs/server.crt',
               '-c', 'ssl_key_file=/certs/server.key')
        resources['containers'].append(PG)
        print(json.dumps({'phase': 'postgres_starting'}), flush=True)
        for _ in range(60):
            # initdb's temporary socket server also accepts pg_isready; TCP waits
            # for the final server, avoiding a stop/restart race before CREATE DB.
            if docker('exec', PG, 'pg_isready', '-h', '127.0.0.1', '-U', 'fixture_admin', check=False).returncode == 0:
                break
            if docker('inspect', PG, '--format', '{{.State.Running}}').stdout.strip() != 'true':
                logs = docker('logs', PG, '--tail', '50', check=False)
                raise RuntimeError(logs.stdout + logs.stderr)
            time.sleep(0.5)
        else:
            raise RuntimeError('disposable_postgres_not_ready')
        sql = f"""CREATE ROLE fixture_user LOGIN PASSWORD '{PASSWORD}';
CREATE DATABASE fixture_update OWNER fixture_user;
CREATE DATABASE fixture_gates OWNER fixture_user;
CREATE DATABASE fixture_rollback OWNER fixture_user;
CREATE DATABASE fixture_teacher OWNER fixture_user;
"""
        docker('exec', '-i', PG, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'fixture_admin', '-d', 'postgres', stdin=sql)
        docker('exec', '-i', PG, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'fixture_admin', '-d', 'fixture_update',
               stdin='CREATE EXTENSION "uuid-ossp"; CREATE EXTENSION pg_trgm;\n')
        docker('exec', '-i', PG, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'fixture_admin', '-d', 'fixture_rollback',
               stdin='CREATE EXTENSION "uuid-ossp"; CREATE EXTENSION pg_trgm;\n')
        candidate_mount = []
        if args.candidate_dist:
            candidate_dist = args.candidate_dist.resolve(strict=True)
            if not (candidate_dist / 'config/data-source.js').is_file():
                raise ValueError('compiled_candidate_data_source_required')
            candidate_mount = ['--mount', f'type=bind,source={candidate_dist},target=/input/teacher-dist,readonly']
            docker('exec', '-i', PG, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'fixture_admin', '-d', 'fixture_teacher',
                   stdin='CREATE EXTENSION "uuid-ossp"; CREATE EXTENSION pg_trgm;\n')
        docker('run', '-d', '--name', NODE, '--network', NETWORK,
               '--mount', f'type=volume,source={runtime_volume},target=/artifact,readonly',
               '--mount', f'type=volume,source={RELEASES},target=/opt/nodia/releases',
               '--mount', f'type=volume,source={CERTS},target=/certs,readonly',
               '--mount', f'type=bind,source={ROOT / "ops/production/update-backend-action.mjs"},target=/input/update-backend-action.mjs,readonly',
               '--mount', f'type=bind,source={Path(__file__).with_suffix(".mjs")},target=/input/test.mjs,readonly',
               *candidate_mount,
               '-e', 'NODE_EXTRA_CA_CERTS=/certs/ca.crt', '-e', 'PGSSLMODE=verify-full',
               '-e', 'DOTENV_CONFIG_PATH=/dev/null', '-e', 'NODE_ENV=production',
               '-e', 'POSTGRES_HOST=update-pg', '-e', 'POSTGRES_PORT=5432',
               '-e', 'POSTGRES_USER=fixture_user', '-e', f'POSTGRES_PASSWORD={PASSWORD}',
               '-e', 'POSTGRES_DB=fixture_update', NODE_IMAGE, 'sleep', '600')
        resources['containers'].append(NODE)
        setup = '''set -eu
groupadd --gid 900 nodia
useradd --uid 900 --gid 900 --no-create-home --shell /usr/sbin/nologin nodia
cp -a /artifact/runtime-r02 /opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc
cp -al /opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc /opt/nodia/releases/backend-aaaaaaaaaaaa-bbbbbbbbbbbb
rm /opt/nodia/releases/backend-aaaaaaaaaaaa-bbbbbbbbbbbb/release-manifest.json
chown -R 900:900 /opt/nodia/releases
'''
        docker('exec', '-i', NODE, 'bash', '-s', stdin=setup, timeout=180)
        print(json.dumps({'phase': 'sql_actions_running'}), flush=True)
        result = docker('exec', '--user', '900:900', NODE, 'node', '/input/test.mjs', timeout=240)
        summary = json.loads(result.stdout.strip().splitlines()[-1])
        output = ROOT / 'output/production' / f'update-backend-sql-{TOKEN}.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
        print(json.dumps({'result': summary, 'local_receipt': str(output)}))
    finally:
        for container in reversed(resources['containers']):
            docker('rm', '-f', '-v', container, check=False)
        for volume in reversed(resources['volumes']):
            docker('volume', 'rm', volume, check=False)
        if resources['network']:
            docker('network', 'rm', NETWORK, check=False)


if __name__ == '__main__':
    main()
