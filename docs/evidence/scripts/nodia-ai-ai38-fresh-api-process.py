"""Bounded real API bootstrap using the existing fresh production dependency tree.

VM only: --harness PATH --harness-sha SHA --execute-isolated-no-provider.
No configured .env, operational DB/provider, install, R2 or service is used.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import socket
import subprocess
import time


MANIFEST = '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'
PROJECT = Path('/opt/nodia/verification/ai38-dependencies-r01/nodia-server')
CANDIDATE = Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--harness', type=Path, required=True)
    parser.add_argument('--harness-sha', required=True)
    parser.add_argument('--execute-isolated-no-provider', action='store_true', required=True)
    args = parser.parse_args()
    assert args.harness.is_absolute() and sha(args.harness) == args.harness_sha
    assert re.fullmatch(r'[a-f0-9]{64}', args.harness_sha)
    assert sha(CANDIDATE / 'manifest.json') == MANIFEST
    manifest = json.loads((CANDIDATE / 'manifest.json').read_text(encoding='utf-8'))
    expected = {name: digest for name, digest in manifest['files'].items()
                if name in ('package.json', 'package-lock.json') or name.startswith('dist/')}
    assert len(expected) == 2829
    assert not (PROJECT / '.env').exists()
    assert (PROJECT / 'node_modules').is_dir() and not (PROJECT / 'node_modules').is_symlink()
    assert not (PROJECT / 'node_modules/@nestjs/testing').exists()
    for name, digest in expected.items():
        assert not (PROJECT / name).is_symlink() and sha(PROJECT / name) == digest
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-fresh-api-process-r01')
    work.mkdir(mode=0o700, exist_ok=False)
    started = time.monotonic()
    deadline = started + 300
    report = {'stage': 'AI-38', 'scope': 'fresh_production_dependencies_actual_API_entrypoint',
              'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'source_sha256': sha(Path(__file__)), 'harness_sha256': args.harness_sha,
              'candidate_manifest_sha256': MANIFEST, 'fresh_tree': str(PROJECT),
              'outputs_verified_before': len(expected), 'provider_requests': 0,
              'configured_database_access': False, 'configured_environment_read': False,
              'storage_operations': 0, 'operational_services_modified': False,
              'automatic_retries': 0, 'outer_deadline_seconds': 300,
              'Nest_testing_used': False, 'adopted': False}
    own = []
    child = None

    def remaining(cap=30):
        value = min(cap, deadline - time.monotonic())
        if value <= 0:
            raise TimeoutError('outer_deadline')
        return value

    def docker(*argv, timeout=30):
        return subprocess.run(['docker', *argv], capture_output=True, check=True,
                              timeout=remaining(timeout)).stdout.decode().strip()

    before = set(docker('ps', '-a', '--format', '{{.ID}}').splitlines())
    suffix = str(os.getpid()) + '_' + secrets.token_hex(4)
    names = ['ai38_fresh_api_pg_' + suffix, 'ai38_fresh_api_redis_' + suffix]
    code = 1
    try:
        password = secrets.token_hex(24)
        docker('run', '-d', '--rm', '--pull=never', '--name', names[0], '-p', '127.0.0.1::5432',
               '-e', 'POSTGRES_USER=ai38api', '-e', 'POSTGRES_DB=ai38api',
               '-e', 'POSTGRES_PASSWORD=' + password, 'postgres:16-alpine')
        own.append(names[0])
        docker('run', '-d', '--rm', '--pull=never', '--name', names[1], '-p', '127.0.0.1::6379', 'redis:7-alpine')
        own.append(names[1])
        for name, command in [(names[0], ['pg_isready', '-h', '127.0.0.1', '-U', 'ai38api']),
                              (names[1], ['redis-cli', 'ping'])]:
            for index in range(80):
                value = subprocess.run(['docker', 'exec', name, *command], capture_output=True, timeout=remaining(5))
                if value.returncode == 0:
                    break
                assert index < 79
                time.sleep(0.1)
        pg_port = int(docker('port', names[0], '5432/tcp').split(':')[-1])
        redis_port = int(docker('port', names[1], '6379/tcp').split(':')[-1])
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            api_port = listener.getsockname()[1]
        assert len({pg_port, redis_port, api_port}) == 3
        assert all(1024 < port < 65536 and port not in (3000, 3001, 5174, 5432, 6379, 8000) for port in (pg_port, redis_port, api_port))
        report['disposable_image_ids'] = [json.loads(docker('inspect', name))[0]['Image'] for name in names]
        payload = {'project': str(PROJECT), 'work': str(work), 'pg_port': pg_port, 'redis_port': redis_port,
                   'api_port': api_port, 'pg_password': password, 'candidate_manifest_sha256': MANIFEST}
        environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(work),
                       'DOTENV_CONFIG_PATH': '/dev/null', 'NODE_ENV': 'production'}
        with (work / 'private-harness-stdout.log').open('xb') as out, (work / 'private-harness-stderr.log').open('xb') as err:
            child = subprocess.Popen(['/usr/local/bin/node', str(args.harness)], cwd=work,
                                     env=environment, stdin=subprocess.PIPE, stdout=out, stderr=err, start_new_session=True)
            child.communicate(input=json.dumps(payload).encode(), timeout=remaining(240))
        report['harness_exit_code'] = child.returncode
        native_path = work / 'public-native-report.json'
        assert native_path.is_file()
        report['native_report_sha256'] = sha(native_path)
        native = json.loads(native_path.read_text(encoding='utf-8'))
        report['native_result'] = native
        assert child.returncode == 0 and native['status'] == 'passed'
        assert native['own_API_stopped'] is True and native['network_isolation_verified'] is True
        report['status'] = 'passed'
        code = 0
    except Exception as error:
        report['status'] = 'failed_preserved_no_retry'
        report['failure_class'] = type(error).__name__
    finally:
        forced = False
        if child is not None:
            try:
                os.killpg(child.pid, 0)
                os.killpg(child.pid, signal.SIGTERM)
                child.wait(timeout=5)
                forced = True
            except ProcessLookupError:
                pass
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=5)
                forced = True
        report['emergency_owned_process_group_terminated'] = forced
        cleanup = []
        for name in own:
            assert re.fullmatch(r'ai38_fresh_api_(?:pg|redis)_' + re.escape(suffix), name)
            result = subprocess.run(['docker', 'rm', '-f', name], capture_output=True, timeout=20)
            cleanup.append(result.returncode == 0)
        after = set(subprocess.run(['docker', 'ps', '-a', '--format', '{{.ID}}'], capture_output=True, check=True, timeout=15).stdout.decode().splitlines())
        names_after = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, check=True, timeout=15).stdout.decode().splitlines()
        report['owned_containers_removed'] = len(own)
        report['owned_containers_remaining'] = len(set(own).intersection(names_after))
        report['preexisting_container_ids_preserved'] = before.issubset(after)
        report['disposable_cleanup_complete'] = all(cleanup) and report['owned_containers_remaining'] == 0
        report['fresh_compiled_tree_unchanged_after'] = all(sha(PROJECT / name) == digest for name, digest in expected.items())
        if code == 0 and (forced or not report['disposable_cleanup_complete'] or not report['preexisting_container_ids_preserved'] or not report['fresh_compiled_tree_unchanged_after']):
            report['status'] = 'failed_cleanup_or_source_mutation'; code = 1
        report['elapsed_seconds'] = round(time.monotonic() - started, 3)
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        report['private_log_sha256'] = {file.name: sha(file) for file in work.glob('private-*.log')}
        with (work / 'public-report.json').open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
