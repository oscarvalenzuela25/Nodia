"""Restricted loopback adoption rehearsal. Root executes phases serially after review.

No provider requests, Gemini restarts, schema migrations, business SQL writes,
database restore, dependency installation or public listener changes are performed.
Failure leaves admission closed; uncertain work is never killed or replayed.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import time
import urllib.error
import urllib.request


ORIGINAL = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
CANDIDATE = Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
FRESH = Path('/opt/nodia/verification/ai38-dependencies-r01/nodia-server')
SERVER = Path('/opt/nodia/releases/nodia-server-ai38-candidate01')
CLIENT = Path('/opt/nodia/releases/nodia-client-ai38-candidate01')
NGINX = Path('/etc/nginx/sites-available/nodia-lab')
CLIENT_ARCHIVE = Path('/tmp/ai38-client-adoption01.tar.gz')
SERVER_MANIFEST_SHA = '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'
CLIENT_MANIFEST_SHA = '0c54fcafebe607a661b169288daa92fe12ca7110278d94eac9160478214ee49b'
CLIENT_ARCHIVE_SHA = '753d96960b66da76b44bc1f93f23e3c5098aad128fdcb4fb21644cd540c206cc'
ORIGINAL_MANIFEST_SHA = 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
UNITS = ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')
CONSUMERS = UNITS[:2]
DROPINS = {name: Path('/etc/systemd/system/' + name + '.service.d/zz-ai38-adoption.conf') for name in CONSUMERS}
DESCRIPTORS = [Path('/etc/systemd/system/nodia-api.service'),
               Path('/etc/systemd/system/nodia-api.service.d/ai15-release.conf'),
               Path('/etc/systemd/system/nodia-ai-worker.service'), NGINX]
NATIVE_KEYS = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
               'temporary_attachment_directories', 'temporary_cli_directories')
SQL_KEYS = ('pending_jobs', 'open_attempts', 'retained_slots')
FENCE_TAG = 'nodia-ai38-adoption-r01-only'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def freeze(path, value):
    with path.open('x', encoding='utf-8') as output:
        output.write(json.dumps(value, indent=2) + '\n')


def checked(args, timeout=60, cwd=None):
    result = subprocess.run(args, capture_output=True, timeout=timeout, cwd=cwd, check=False)
    if result.returncode:
        raise RuntimeError('command_failed_' + Path(args[0]).name)
    return result.stdout


def states():
    return {unit: checked(['systemctl', 'show', unit, '-p', 'ActiveState', '--value']).decode().strip() for unit in UNITS}


def fence_arguments():
    return ['INPUT', '!', '-i', 'lo', '-p', 'tcp', '--dport', '3000', '-m', 'comment',
            '--comment', FENCE_TAG, '-j', 'REJECT']


def fence_present(binary):
    result = subprocess.run([binary, '-w', '5', '-C', *fence_arguments()], capture_output=True, timeout=10)
    assert result.returncode in (0, 1), 'cannot_inspect_exclusive_INPUT_fence'
    return result.returncode == 0


def require_fences():
    assert all(fence_present(binary) for binary in ('/usr/sbin/iptables', '/usr/sbin/ip6tables'))


def insert_fences():
    for binary in ('/usr/sbin/iptables', '/usr/sbin/ip6tables'):
        assert not fence_present(binary), 'refuse_preexisting_owned_fence'
        checked([binary, '-w', '5', '-I', *fence_arguments()])
        assert fence_present(binary)


def remove_fences():
    for binary in ('/usr/sbin/iptables', '/usr/sbin/ip6tables'):
        if fence_present(binary):
            checked([binary, '-w', '5', '-D', *fence_arguments()])
        assert not fence_present(binary)


def native_epoch():
    value = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    assert value['State']['Running']
    assert value['Id'] == '802d6d8792ff9c6f2c8d491b151e984966f854661da172cb6887f69fb8912678'
    assert value['Image'] == 'sha256:b8efad6217a4f04cb135db027fd899c1826b39c3a16154cca79f1b4f0deb977e'
    assert value['State']['StartedAt'] == '2026-10-20T19:14:35.412657745Z'
    return {'id': value['Id'], 'image': value['Image'], 'started_at': value['State']['StartedAt'],
            'descriptor_sha256': digest({'Env': sorted(value['Config']['Env']),
                'Mounts': sorted(value['Mounts'], key=lambda item: item['Destination']),
                'User': value['Config']['User'], 'HostConfig': value['HostConfig']})}


def quiet():
    native = Path('/tmp/ai32-r04-cleanup.py')
    sql = Path('/tmp/nodia-ai-ai36-c05-live-health.mjs')
    assert sha(native) == 'a42831dce6f458af03f8a405014ebd8de8aafda6d39ca60fb00cd24829c243b7'
    assert sha(sql) == 'e4f32a756acbd2ab1ae15056352eca4429a59cb780a2ab8dfe861f9d2287f395'
    n = json.loads(checked(['python3', str(native)]))
    s = json.loads(checked(['/usr/local/bin/node', str(sql), str(ORIGINAL)]))
    assert all(n[key] == 0 for key in NATIVE_KEYS), 'native_pending_do_not_stop_or_replay'
    assert all(s[key] == 0 for key in SQL_KEYS), 'SQL_pending_do_not_stop_or_replay'
    return {'native': n, 'SQL': s}


def schema_and_selection():
    # Hash only: no environment, provider fields, IDs of users or business data leave this process.
    program = """import{createRequire}from'node:module';import{createHash}from'node:crypto';
const r=createRequire(process.cwd()+'/package.json');r('dotenv').config({quiet:true});
const{DataSource}=r('typeorm');const e=process.env;const d=new DataSource({type:'postgres',
host:e.POSTGRES_HOST,port:Number(e.POSTGRES_PORT),database:e.POSTGRES_DB,username:e.POSTGRES_USER,
password:e.POSTGRES_PASSWORD,entities:[],synchronize:false});await d.initialize();
try{await d.query('BEGIN READ ONLY');await d.query(\"SET LOCAL statement_timeout='10000ms'\");
const ledger=await d.query('SELECT timestamp,name FROM migrations ORDER BY timestamp,name');
const schema=await d.query(\"SELECT table_name,column_name,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position\");
const selection=await d.query('SELECT to_jsonb(p) AS value FROM ai_providers p ORDER BY id');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
console.log(JSON.stringify({migrations:ledger.length,migration_ledger_sha256:hash(ledger),
schema_sha256:hash(schema),provider_configuration_sha256:hash(selection),read_only:true}));
await d.query('ROLLBACK');}finally{await d.destroy();}"""
    return json.loads(checked(['/usr/local/bin/node', '--input-type=module', '-e', program], cwd=ORIGINAL))


def original_files():
    values = {p.relative_to(ORIGINAL).as_posix(): sha(p) for p in sorted((ORIGINAL / 'dist').rglob('*')) if p.is_file()}
    assert len(values) == 932 and digest(values) == ORIGINAL_MANIFEST_SHA
    return digest(values)


def validate_manifest(directory, expected):
    assert sha(directory / 'manifest.json') == expected
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    for name, expected_file in manifest['files'].items():
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and '..' not in relative.parts and '\\' not in name
        value = directory / relative
        assert value.resolve().is_relative_to(directory.resolve()), 'member_resolves_outside_release'
        assert not value.is_symlink() and value.is_file() and sha(value) == expected_file
    return manifest


def dependencies_hash(directory):
    values = {}
    for value in sorted(directory.rglob('*')):
        name = value.relative_to(directory).as_posix()
        if value.is_symlink():
            assert value.resolve().is_relative_to(directory.resolve()), 'dependency_link_escapes_release'
            values[name] = {'link': os.readlink(value)}
        elif value.is_file():
            values[name] = {'sha256': sha(value)}
    assert values
    return digest(values)


def make_readable(directory):
    # Only newly created release trees: never chmod private verification/dependency roots.
    assert directory in (SERVER, CLIENT)
    os.chmod(directory, 0o755)
    for value in directory.rglob('*'):
        if not value.is_symlink():
            if value.is_dir():
                os.chmod(value, 0o755)
            else:
                os.chmod(value, 0o755 if value.stat().st_mode & 0o111 else 0o644)


def stage_server():
    manifest = validate_manifest(CANDIDATE, SERVER_MANIFEST_SHA)
    assert not SERVER.exists(), 'never_overwrite_release'
    assert not (CANDIDATE / '.env').exists() and not (FRESH / '.env').exists()
    assert sha(FRESH / 'package-lock.json') == manifest['files']['package-lock.json']
    assert sha(FRESH / 'package.json') == manifest['files']['package.json']
    SERVER.mkdir(mode=0o755)
    for name in ['manifest.json', *manifest['files']]:
        target = SERVER / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(CANDIDATE / name, target)
    before = dependencies_hash(FRESH / 'node_modules')
    shutil.copytree(FRESH / 'node_modules', SERVER / 'node_modules', symlinks=True)
    make_readable(SERVER)
    assert dependencies_hash(SERVER / 'node_modules') == before
    validate_manifest(SERVER, SERVER_MANIFEST_SHA)
    assert not (SERVER / '.env').exists()
    return {'manifest_sha256': SERVER_MANIFEST_SHA, 'files': len(manifest['files']),
            'fresh_dependencies_sha256': before, 'fresh_dependencies_copied_physically': True}


def stage_client():
    assert sha(CLIENT_ARCHIVE) == CLIENT_ARCHIVE_SHA and not CLIENT.exists()
    with tarfile.open(CLIENT_ARCHIVE, 'r:gz') as archive:
        members = archive.getmembers()
        names = [item.name for item in members]
        assert len(names) == len(set(names)) == 178 and all(item.isfile() for item in members)
        expected_manifest = archive.extractfile('nodia-client/manifest.json').read()
        assert hashlib.sha256(expected_manifest).hexdigest() == CLIENT_MANIFEST_SHA
        manifest = json.loads(expected_manifest)
        assert set(names) == {'nodia-client/manifest.json', *('nodia-client/' + name for name in manifest['files'])}
        CLIENT.mkdir(mode=0o755)
        for item in members:
            relative = PurePosixPath(item.name).relative_to('nodia-client')
            assert '..' not in relative.parts and not relative.is_absolute() and '\\' not in item.name
            payload = archive.extractfile(item).read()
            if str(relative) != 'manifest.json':
                assert hashlib.sha256(payload).hexdigest() == manifest['files'][str(relative)]
            target = CLIENT / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
    make_readable(CLIENT)
    validate_manifest(CLIENT, CLIENT_MANIFEST_SHA)
    return {'manifest_sha256': CLIENT_MANIFEST_SHA, 'files': len(manifest['files']),
            'dist_files': len([name for name in manifest['files'] if name.startswith('dist/')]), 'rebuilt': False}


def dropin(unit):
    entry = 'main.js' if unit == 'nodia-api' else 'nodia-ai-worker.js'
    return ('[Service]\nWorkingDirectory=' + str(SERVER) + '\nExecStart=\nExecStart=/usr/local/bin/node ' +
            str(SERVER / 'dist' / entry) + '\nEnvironment=DOTENV_CONFIG_PATH=' + str(ORIGINAL / '.env') + '\n').encode()


def require_processes(candidate):
    for unit in CONSUMERS:
        pid = int(checked(['systemctl', 'show', unit, '-p', 'MainPID', '--value']).decode())
        assert pid > 0
        entry = 'main.js' if unit == 'nodia-api' else 'nodia-ai-worker.js'
        argv = (Path('/proc') / str(pid) / 'cmdline').read_bytes().rstrip(b'\0').split(b'\0')
        expected = [b'/usr/local/bin/node', str(SERVER / 'dist' / entry).encode()] if candidate else [b'/usr/local/bin/node', ('dist/' + entry).encode()]
        assert argv == expected, 'effective_process_entrypoint_mismatch'
        assert (Path('/proc') / str(pid) / 'cwd').resolve() == (SERVER if candidate else ORIGINAL)
        if candidate:
            environment = (Path('/proc') / str(pid) / 'environ').read_bytes().split(b'\0')
            assert ('DOTENV_CONFIG_PATH=' + str(ORIGINAL / '.env')).encode() in environment


def nginx_bytes(private, maintenance):
    original = (private / 'descriptor-3').read_bytes()
    assert original.count(b'location / { return 404; }') == 1
    if maintenance:
        assert original.count(b'location /api/v1 {') == 1
        return original.replace(b'location /api/v1 {', b'location /api/v1 { return 503;').replace(
            b'location / { return 404; }', b'location / { return 503; }')
    return original.replace(b'location / { return 404; }',
        ('root ' + str(CLIENT / 'dist') + ';\n    add_header Cross-Origin-Opener-Policy same-origin-allow-popups always;\n'
         '    location / { try_files $uri $uri/ /index.html; }').encode())


def write_nginx(payload):
    temporary = NGINX.with_name('nodia-lab.ai38-building')
    before = NGINX.read_bytes()
    assert not temporary.exists()
    def replace(value):
        with temporary.open('xb') as output:
            output.write(value)
        os.chmod(temporary, 0o644)
        os.replace(temporary, NGINX)
    try:
        replace(payload)
        try:
            checked(['nginx', '-t'])
        except Exception:
            replace(before)
            checked(['nginx', '-t'])
            raise
    finally:
        if temporary.exists():
            temporary.unlink()
    checked(['systemctl', 'reload', 'nginx'])


def http_status(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return response.status, response.read(10 * 1024 * 1024), response.headers.get('Cross-Origin-Opener-Policy')
    except urllib.error.HTTPError as error:
        return error.code, b'', None


def wait_API():
    for _ in range(15):
        try:
            if http_status('http://127.0.0.1:3000/api/v1')[0] == 200:
                return
        except (OSError, TimeoutError):
            pass
        time.sleep(1)
    raise RuntimeError('API_health_failed_admission_remains_closed')


def closed_admission(private):
    write_nginx(nginx_bytes(private, True))
    assert http_status('http://127.0.0.1:8080/api/v1')[0] == 503
    assert http_status('http://127.0.0.1:8080/')[0] == 503


def stop_quiet(private):
    closed_admission(private)
    before = quiet()
    time.sleep(1)
    second = quiet()
    checked(['systemctl', 'stop', *CONSUMERS], timeout=90)
    assert all(states()[unit] == 'inactive' for unit in CONSUMERS)
    stopped = {}
    for unit in CONSUMERS:
        raw = checked(['systemctl', 'show', unit, '-p', 'Result,ExecMainCode,ExecMainStatus,MainPID']).decode()
        value = dict(line.split('=', 1) for line in raw.splitlines() if '=' in line)
        assert value['Result'] == 'success' and value['MainPID'] == '0', 'consumer_stop_not_clean'
        assert (value['ExecMainCode'], value['ExecMainStatus']) in (('1', '0'), ('2', '15')), 'consumer_stop_not_clean'
        stopped[unit] = value
    return {'before_stop': before, 'second_pre_stop': second, 'after_stop': quiet(), 'stop_results': stopped,
            'active_job_drain_exercised': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('phase', choices=('prepare', 'quiesce', 'adopt', 'rollback'))
    parser.add_argument('--backup-receipt-sha256')
    args = parser.parse_args()
    assert os.geteuid() == 0
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-adoption-r01')
    lock = Path('/run/lock/nodia-ai38-adoption.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    if args.phase == 'prepare':
        work.mkdir(mode=0o700, exist_ok=False)
    assert work.is_dir() and not (work / (args.phase + '.json')).exists()
    private = work / 'private'
    if args.phase == 'prepare':
        private.mkdir(mode=0o700)
    report = {'stage': 'AI-38', 'scope': 'restricted_loopback_full_package_adoption_reversal_rehearsal',
              'phase': args.phase, 'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'script_sha256': sha(Path(__file__)), 'provider_generations': 0, 'Gemini_restarts': 0,
              'migrations_executed': 0, 'database_restores': 0, 'direct_business_SQL_writes': 0,
              'public_traffic_opened': False, 'full_environment_release_authorized': False,
              'existing_proxy_body_limit_MiB': 11, 'attachment_limit_acceptance': False}
    try:
        report['epoch'] = native_epoch()
        report['original_Node_manifest_sha256'] = original_files()
        if args.phase == 'prepare':
            assert states() == dict.fromkeys(UNITS, 'active')
            require_processes(False)
            assert not any(value.exists() for value in DROPINS.values())
            assert not any(fence_present(binary) for binary in ('/usr/sbin/iptables', '/usr/sbin/ip6tables'))
            assert Path('/etc/nginx/sites-enabled/nodia-lab').resolve() == NGINX
            report['quiet'] = quiet()
            report['SQL_baseline'] = schema_and_selection()
            assert report['SQL_baseline']['migrations'] == 29
            report['descriptors'] = {}
            for index, value in enumerate(DESCRIPTORS):
                payload = value.read_bytes()
                (private / ('descriptor-' + str(index))).write_bytes(payload)
                report['descriptors'][str(value)] = hashlib.sha256(payload).hexdigest()
            report['original_env_sha256'] = sha(ORIGINAL / '.env')
            old = {p.name: sha(p) for p in (ORIGINAL / 'dist/migrations').glob('*.js')}
            new = {p.name: sha(p) for p in (CANDIDATE / 'dist/migrations').glob('*.js')}
            assert old == new and len(old) == 29
            report['migration_code_unchanged'] = True
            report['Server'] = stage_server()
            report['Client'] = stage_client()
            assert report['Client']['dist_files'] == 171
            for user, path in [('nodia', SERVER / 'dist/main.js'), ('nodia', ORIGINAL / '.env'),
                               ('www-data', CLIENT / 'dist/index.html')]:
                checked(['runuser', '-u', user, '--', 'test', '-r', str(path)])
        else:
            baseline = json.loads((work / 'prepare.json').read_text(encoding='utf-8'))
            assert baseline['status'] == 'passed' and baseline['script_sha256'] == sha(Path(__file__))
            assert report['epoch'] == baseline['epoch']
            assert sha(ORIGINAL / '.env') == baseline['original_env_sha256']
            for path, expected in baseline['descriptors'].items():
                if Path(path) != NGINX:
                    assert sha(Path(path)) == expected
            validate_manifest(SERVER, SERVER_MANIFEST_SHA)
            validate_manifest(CLIENT, CLIENT_MANIFEST_SHA)
            assert not (SERVER / '.env').exists() and not (CLIENT / '.env').exists()
            assert dependencies_hash(SERVER / 'node_modules') == baseline['Server']['fresh_dependencies_sha256']
            if args.phase == 'quiesce':
                insert_fences()
                report['quiescence'] = stop_quiet(private)
                require_fences()
                report['IPv4_IPv6_non_loopback_API_fences_active'] = True
            elif args.phase == 'adopt':
                require_fences()
                quiesced = json.loads((work / 'quiesce.json').read_text(encoding='utf-8'))
                assert quiesced['status'] == 'passed' and quiesced['epoch'] == report['epoch']
                assert quiesced['script_sha256'] == report['script_sha256']
                assert all(states()[unit] == 'inactive' for unit in CONSUMERS)
                assert NGINX.read_bytes() == nginx_bytes(private, True)
                receipt_path = Path('/opt/nodia/verification/ai38-adoption-backup-r01/public-report.json')
                assert args.backup_receipt_sha256 and sha(receipt_path) == args.backup_receipt_sha256
                receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
                assert receipt['status'] == 'passed' and receipt['configured_database_backup'] is True
                assert receipt['disposable_restore_verified'] is True and receipt['original_database_restored'] is False
                assert receipt['encryption'] == {'format': 'openpgp', 'cipher': 'AES256', 'integrity': 'MDC'}
                assert datetime.fromisoformat(receipt['source_snapshot_finished_at_utc']) >= datetime.fromisoformat(quiesced['finished_at_utc'])
                report['backup_receipt_sha256'] = args.backup_receipt_sha256
                report['quiet'] = quiet()
                assert schema_and_selection() == baseline['SQL_baseline']
                for unit, target in DROPINS.items():
                    target.parent.mkdir(exist_ok=True)
                    with target.open('xb') as output:
                        output.write(dropin(unit))
                checked(['systemctl', 'daemon-reload'])
                checked(['systemctl', 'start', *CONSUMERS], timeout=90)
                wait_API()
                assert states() == dict.fromkeys(UNITS, 'active')
                require_processes(True)
                assert schema_and_selection() == baseline['SQL_baseline']
                report['quiet'] = quiet()
                write_nginx(nginx_bytes(private, False))
                for relative in ('index.html', 'assets/api-ARnSH-iB.js'):
                    status, data, coop = http_status('http://127.0.0.1:8080/' + relative)
                    assert status == 200 and hashlib.sha256(data).hexdigest() == sha(CLIENT / 'dist' / relative)
                    assert coop == 'same-origin-allow-popups'
                assert http_status('http://127.0.0.1:8080/tools/nodia-ai')[0] == 200
                assert http_status('http://127.0.0.1:8080/api/v1')[0] == 200
                report['restricted_UI_available_for_separate_authenticated_acceptance'] = True
                report['IPv4_IPv6_non_loopback_API_fences_active'] = True
            else:
                # Recovery also covers a known partial quiesce/adopt failure. Never overwrite snapshots.
                assert NGINX.read_bytes() in ((private / 'descriptor-3').read_bytes(),
                    nginx_bytes(private, True), nginx_bytes(private, False)), 'unexpected_nginx_state_review'
                for binary in ('/usr/sbin/iptables', '/usr/sbin/ip6tables'):
                    if not fence_present(binary):
                        checked([binary, '-w', '5', '-I', *fence_arguments()])
                require_fences()
                report['quiescence'] = stop_quiet(private)
                assert schema_and_selection() == baseline['SQL_baseline'], 'schema_or_provider_changed_review_before_rollback'
                for unit, target in DROPINS.items():
                    if target.exists():
                        assert target.read_bytes() == dropin(unit)
                        target.unlink()
                checked(['systemctl', 'daemon-reload'])
                checked(['systemctl', 'start', *CONSUMERS], timeout=90)
                wait_API()
                require_processes(False)
                assert http_status('http://127.0.0.1:3000/api/v1')[0] == 200
                write_nginx((private / 'descriptor-3').read_bytes())
                assert http_status('http://127.0.0.1:8080/')[0] == 404
                assert http_status('http://127.0.0.1:8080/api/v1')[0] == 200
                report['rollback_descriptors_byte_exact'] = all(sha(p) == baseline['descriptors'][str(p)] for p in DESCRIPTORS)
                assert report['rollback_descriptors_byte_exact']
                report['quiet'] = quiet()
                remove_fences()
                report['only_owned_IPv4_IPv6_fences_removed'] = True
        report['services'] = states()
        assert native_epoch() == report['epoch']
        assert original_files() == report['original_Node_manifest_sha256']
        report['status'] = 'passed'
    except Exception as error:
        report['status'] = 'failed_requires_review_no_automatic_replay_or_database_restore'
        report['failure_class'] = type(error).__name__
        raise
    finally:
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        freeze(work / (args.phase + '.json'), report)
        print(json.dumps(report))


if __name__ == '__main__':
    main()
