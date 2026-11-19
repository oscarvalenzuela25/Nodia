#!/usr/bin/env python3
"""Test two verified Linux release artifacts in disposable PostgreSQL 16."""
import argparse
import importlib.util
import secrets
import subprocess
import sys
import tempfile
import time
from pathlib import Path

TESTS = Path(__file__).resolve().parent
PRODUCTION = TESTS.parent
NODE = 'node:24.22.2-bookworm@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40'
POSTGRES = 'postgres:16-bookworm@sha256:5264710be20f409750ac6dc4e5706dcef929c87e241605463f0f9aefa932a8d9'
REDIS = 'redis:7-alpine@sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf'

# Reuse the updater SQL fixture's bounded Docker command wrapper.
spec = importlib.util.spec_from_file_location('sql_fixture', TESTS / 'update-backend-sql.integration.py')
sql_fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sql_fixture)
docker = sql_fixture.docker

STAGE = '''import importlib.util, pathlib, re, sys, tarfile
stage_spec = importlib.util.spec_from_file_location('stage', '/input/stage.py')
stage = importlib.util.module_from_spec(stage_spec)
stage_spec.loader.exec_module(stage)
root = pathlib.Path('/opt/nodia/releases')
for position in ('baseline', 'candidate'):
    directory = pathlib.Path('/input') / position
    result = stage.strict_json((directory / 'artifact-result.json').read_bytes())
    release = result['release_id']
    stage.require(re.fullmatch(r'backend-[a-f0-9]{12}-[a-f0-9]{12}', release), 'invalid_release_identity')
    archive_path = directory / (release + '.tar.gz')
    manifest_path = directory / (release + '.manifest.json')
    with archive_path.open('rb') as stream:
        stage.require(stage.digest(stream) == result['archive_sha256'], 'archive_digest_mismatch')
    with manifest_path.open('rb') as stream:
        stage.require(stage.digest(stream) == result['manifest_sha256'], 'manifest_digest_mismatch')
    with tarfile.open(archive_path, 'r:gz') as archive:
        plan = stage.read_plan(archive, allow_git_release=True)
        manifest = plan['manifest']
        stage.require(plan['manifest_sha256'] == result['manifest_sha256'] and
            manifest['deployment_eligible'] is True and result['production_eligible'] is True and
            all(manifest[key] == result[key] for key in ('release_id','source_sha','package_tree_sha256')),
            'release_artifact_identity_mismatch')
        target = root / release
        target.mkdir(mode=0o700)
        stage.extract_verified(archive, plan, target)
        target.chmod(0o755)
    print(release)
'''

CERTIFICATES = '''set -eu
cd /certs
openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 1 -subj /CN=Nodia-Migration-CI >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj /CN=update-pg >/dev/null 2>&1
printf 'subjectAltName=DNS:update-pg\nextendedKeyUsage=serverAuth\n' >server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 1 -extfile server.ext >/dev/null 2>&1
chmod 644 ca.crt server.crt
chmod 600 server.key
chown 999:999 server.key
rm ca.key server.csr server.ext ca.srl
'''


def mount(kind, source, target, *, readonly=True):
    return ['--mount', f'type={kind},source={source},target={target}' + (',readonly' if readonly else '')]


def rehearse(baseline, candidate):
    prefix = 'nodia-release-migration-' + secrets.token_hex(6)
    network, certs, releases, pg, redis, runner = [prefix + '-' + kind for kind in
                                                 ('net', 'certs', 'releases', 'pg', 'redis', 'runner')]
    containers, volumes = [], []
    network_created = False
    admin_password, password, redis_password = (secrets.token_hex(24) for _ in range(3))
    # Pull images before attaching any package or disposable database.
    for image in (NODE, POSTGRES, REDIS):
        if docker('image', 'inspect', image, check=False).returncode:
            docker('pull', image, timeout=300)
    try:
        for volume in (certs, releases):
            docker('volume', 'create', volume)
            volumes.append(volume)
        ids = docker('run', '--rm', '-i', '--network', 'none',
                     *mount('bind', PRODUCTION / 'stage-backend-candidate.py', '/input/stage.py'),
                     *mount('bind', baseline, '/input/baseline'), *mount('bind', candidate, '/input/candidate'),
                     *mount('volume', releases, '/opt/nodia/releases', readonly=False),
                     NODE, 'python3', '-I', '-B', '-', stdin=STAGE, timeout=300).stdout.splitlines()
        if len(ids) != 2:
            raise RuntimeError('staged_release_pair_required')
        print(f'Verified Linux packages: {ids[0]} -> {ids[1]}', file=sys.stderr, flush=True)
        docker('run', '--rm', '-i', '--network', 'none', *mount('volume', certs, '/certs', readonly=False),
               NODE, 'bash', '-s', stdin=CERTIFICATES)
        docker('network', 'create', '--internal', network)
        network_created = True
        containers.append(pg)
        docker('run', '-d', '--name', pg, '--network', network, '--network-alias', 'update-pg',
               '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=768m', *mount('volume', certs, '/certs'),
               '-e', 'POSTGRES_USER=fixture_admin', '-e', f'POSTGRES_PASSWORD={admin_password}',
               POSTGRES, 'postgres', '-c', 'ssl=on', '-c', 'ssl_cert_file=/certs/server.crt',
               '-c', 'ssl_key_file=/certs/server.key')
        for _ in range(60):
            if docker('exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'fixture_admin',
                      check=False).returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError('disposable_postgres_not_ready')
        def psql(database, statement):
            docker('exec', '-i', pg, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'fixture_admin',
                   '-d', database, stdin=statement)

        psql('postgres', f"CREATE ROLE fixture_user LOGIN PASSWORD '{password}';\n"
             "CREATE DATABASE fixture_upgrade OWNER fixture_user;\nCREATE DATABASE fixture_clean OWNER fixture_user;\n")
        for database in ('fixture_upgrade', 'fixture_clean'):
            psql(database, 'CREATE EXTENSION "uuid-ossp"; CREATE EXTENSION pg_trgm;\n')

        containers.append(redis)
        docker('run', '-d', '--name', redis, '--network', network, '--network-alias', 'update-redis',
               REDIS, 'redis-server', '--save', '', '--appendonly', 'no', '--requirepass', redis_password)
        # The API smoke checks readiness with a bounded polling loop.
        containers.append(runner)
        with tempfile.TemporaryDirectory(prefix=prefix) as temp:
            machine_id = Path(temp) / 'machine-id'
            machine_id.write_text(secrets.token_hex(16) + '\n', encoding='ascii', newline='\n')
            result = docker('run', '--name', runner, '--network', network, '--user', '900:900', '--read-only',
                        '--tmpfs', '/tmp:rw,nosuid,size=64m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                        *mount('bind', machine_id, '/etc/machine-id'),
                        *mount('volume', certs, '/certs'), *mount('volume', releases, '/opt/nodia/releases'),
                        *mount('bind', TESTS / 'release-migration.integration.mjs', '/input/release-migration.integration.mjs'),
                        *mount('bind', TESTS / 'migration-release-smoke.mjs', '/input/migration-release-smoke.mjs'),
                        *mount('bind', PRODUCTION / 'update-backend-action.mjs', '/input/update-backend-action.mjs'),
                        '-e', 'HOME=/tmp', '-e', 'DOTENV_CONFIG_PATH=/dev/null', '-e', 'NODE_ENV=production',
                        '-e', 'NODE_EXTRA_CA_CERTS=/certs/ca.crt', '-e', 'PGSSLMODE=verify-full',
                        '-e', 'POSTGRES_HOST=update-pg', '-e', 'POSTGRES_PORT=5432', '-e', 'POSTGRES_USER=fixture_user',
                        '-e', f'POSTGRES_PASSWORD={password}', '-e', f'REDIS_PASSWORD={redis_password}',
                        NODE, 'node', '/input/release-migration.integration.mjs', *ids, timeout=360)
        print(result.stdout.strip(), flush=True)
    finally:
        for container in reversed(containers):
            docker('rm', '-f', '-v', container, check=False)
        for volume in reversed(volumes):
            docker('volume', 'rm', volume, check=False)
        if network_created:
            docker('network', 'rm', network, check=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline_artifact', type=Path)
    parser.add_argument('candidate_artifact', type=Path)
    args = parser.parse_args()
    rehearse(args.baseline_artifact.resolve(strict=True), args.candidate_artifact.resolve(strict=True))


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
