"""One bounded, disposable standalone-worker SQL/Redis integration; no provider."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import signal
import subprocess
import sys


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    for name in ('candidate', 'manifest-sha', 'harness', 'harness-sha', 'attempt'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    assert re.fullmatch(r'0[1-9]', args.attempt)
    assert re.fullmatch(r'[a-f0-9]{64}', args.manifest_sha) and re.fullmatch(r'[a-f0-9]{64}', args.harness_sha)
    candidate, harness = Path(args.candidate), Path(args.harness)
    assert candidate == Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
    assert sha(candidate / 'manifest.json') == args.manifest_sha and sha(harness) == args.harness_sha
    manifest = json.loads((candidate / 'manifest.json').read_text(encoding='utf-8'))
    for name, digest in manifest['files'].items():
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and '..' not in relative.parts
        assert sha(candidate / relative) == digest
    assert (candidate / 'node_modules').resolve(strict=True) == Path('/opt/nodia/nodia-server/node_modules')
    assert not (candidate / '.env').exists()
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-worker-process' + args.attempt)
    work.mkdir(mode=0o700, exist_ok=False)
    overlay = work / 'nodia-server'
    (overlay / 'test').mkdir(mode=0o700, parents=True)
    for name in ('dist', 'package.json', 'package-lock.json', 'node_modules'):
        (overlay / name).symlink_to(candidate / name)
    fixture = 'test/nodia-ai.integration.fixture.mjs'
    assert sha(candidate / fixture) == manifest['files'][fixture]
    with (overlay / fixture).open('xb') as stream:
        stream.write((candidate / fixture).read_bytes())
    target = overlay / 'test/nodia-ai-ai38-worker-process.mjs'
    with target.open('xb') as stream:
        stream.write(harness.read_bytes())
    private_report = work / 'private-native-report.json'
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(Path.home()),
                   'NODE_ENV': 'test', 'RATE_LIMIT_STORAGE': 'memory', 'DOTENV_CONFIG_PATH': '/dev/null',
                   'NODIA_AI38_WORKER_PROCESS_ONLY': 'disposable', 'NODIA_AI_LAB_REPORT_JSON': str(private_report),
                   'AI38_PACKAGE_MANIFEST_SHA256': args.manifest_sha}
    report = {'stage': 'AI-38', 'scope': 'compiled_standalone_worker_disposable_PG_Redis_no_provider',
              'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'runner_sha256': sha(Path(__file__)), 'harness_sha256': args.harness_sha,
              'package_manifest_sha256': args.manifest_sha, 'provider_generations': 0,
              'configured_database_used': False, 'storage_operations': 0, 'operational_services_modified': False,
              'dependency_installation_reused': True, 'npm_ci_executed': False, 'timeout_seconds': 300}
    code = 1
    with (work / 'private-stdout.log').open('xb') as out, (work / 'private-stderr.log').open('xb') as err:
        process = subprocess.Popen(['/usr/local/bin/node', str(target)], cwd=overlay, env=environment,
                                   stdout=out, stderr=err, start_new_session=True)
        try:
            code = process.wait(timeout=300)
        except subprocess.TimeoutExpired:
            report['timeout'] = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=10)
            code = 124
    report['exit_code'] = code
    if private_report.is_file():
        assert private_report.stat().st_size <= 1048576
        native = json.loads(private_report.read_text(encoding='utf-8'))
        assert native['stage'] == 'AI-38' and native['scope'] == 'actual_compiled_standalone_worker_confirmed_finance_disposable_SQL_Redis'
        report['native_result'] = native
        report['status'] = 'passed' if code == 0 and native['status'] == 'passed' and native['disposable_cleanup_complete'] is True else 'failed'
    else:
        report['status'] = 'failed_missing_native_report'
    # Kill only this harness process group, never a discovered or operational PID.
    try:
        os.killpg(process.pid, 0)
    except ProcessLookupError:
        report['own_process_group_remaining'] = False
    else:
        os.killpg(process.pid, signal.SIGKILL)
        report['own_process_group_remaining'] = True
        report['status'] = 'failed_forced_owned_process_cleanup'
        code = code or 1
    patterns = (rf'template_ai3803_{process.pid}_[a-f0-9]{{8}}', rf'template_ai38worker_redis_{process.pid}_[a-f0-9]{{8}}')
    names = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, text=True, check=True).stdout.splitlines()
    owned = [name for name in names if any(re.fullmatch(pattern, name) for pattern in patterns)]
    report['emergency_owned_containers_removed'] = owned
    for name in owned:
        assert any(re.fullmatch(pattern, name) for pattern in patterns)
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True, check=True)
    remaining = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, text=True, check=True).stdout.splitlines()
    report['owned_containers_remaining'] = sum(any(re.fullmatch(pattern, name) for pattern in patterns) for name in remaining)
    assert report['owned_containers_remaining'] == 0
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    report['private_log_hashes'] = {name: sha(work / name) for name in ('private-stdout.log', 'private-stderr.log')}
    with (work / 'public-report.json').open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report['status'] == 'passed' else code or 1


if __name__ == '__main__':
    sys.exit(main())
