"""One fresh production npm-ci installation and bounded isolated runtime checks.

No operational node_modules link, service, environment, account or profile is changed.
Logs/cache/HOME/npmrc stay private; install lifecycle scripts and TLS checks stay enabled.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import sys
import time


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def freeze(path, value):
    with path.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser()
    for name in ('candidate', 'manifest-sha', 'worker-harness', 'worker-harness-sha'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    candidate, worker_harness = Path(args.candidate), Path(args.worker_harness)
    assert candidate == Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
    assert re.fullmatch(r'[a-f0-9]{64}', args.manifest_sha)
    assert re.fullmatch(r'[a-f0-9]{64}', args.worker_harness_sha)
    assert sha(candidate / 'manifest.json') == args.manifest_sha and sha(worker_harness) == args.worker_harness_sha
    manifest = json.loads((candidate / 'manifest.json').read_text(encoding='utf-8'))
    for name, digest in manifest['files'].items():
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and '..' not in relative.parts
        assert sha(candidate / relative) == digest
    assert not (candidate / '.env').exists()
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-dependencies-r01')
    work.mkdir(mode=0o700, exist_ok=False)
    started = time.monotonic()
    deadline = started + 300
    report = {'stage': 'AI-38', 'scope': 'fresh_lock_pinned_production_dependencies_isolated_runtime',
              'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'runner_sha256': sha(Path(__file__)), 'candidate_manifest_sha256': args.manifest_sha,
              'npm_ci_invocations': 0, 'automatic_install_retries': 0, 'lifecycle_scripts_disabled': False,
              'TLS_verification_disabled': False, 'registry_or_dependency_fallbacks': False,
              'configured_database_used': False, 'provider_generations': 0, 'storage_operations': 0,
              'operational_services_or_dependencies_modified': False, 'adopted': False,
              'raw_logs_retained_privately': True, 'outer_deadline_seconds': 300,
              'checks': []}
    code = 1
    children = []
    allowed_containers = []

    def remaining(maximum):
        value = min(maximum, deadline - time.monotonic())
        if value <= 0:
            raise TimeoutError('outer_deadline')
        return value

    def command(argv, label, env, cwd, timeout, stdin=None):
        with (work / ('private-' + label + '-stdout.log')).open('xb') as out, (work / ('private-' + label + '-stderr.log')).open('xb') as err:
            process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.PIPE if stdin else subprocess.DEVNULL,
                                       stdout=out, stderr=err, start_new_session=True)
            children.append(process)
            if label == 'worker-proof':
                allowed_containers[:] = [rf'template_ai3803_{process.pid}_[a-f0-9]{{8}}',
                                         rf'template_ai38worker_redis_{process.pid}_[a-f0-9]{{8}}']
            try:
                process.communicate(input=stdin, timeout=remaining(timeout))
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=min(10, max(1, deadline - time.monotonic())))
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
                raise TimeoutError(label) from None
            return process

    try:
        memory = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
        available = int(memory['MemAvailable'].split()[0]) * 1024
        disk = shutil.disk_usage(work)
        report['resources_before'] = {'MemAvailable_bytes': available, 'disk_free_bytes': disk.free,
                                      'npm_heap_limit_MiB': 512,
                                      'heap_limit_reason': 'bound_install_heap_to_preserve_concurrent_lab_processes'}
        assert available >= 1536 * 1024 * 1024 and disk.free >= 3 * 1024 * 1024 * 1024, 'insufficient_isolated_install_resources'
        home, cache, project = work / 'home', work / 'npm-cache', work / 'nodia-server'
        home.mkdir(mode=0o700); cache.mkdir(mode=0o700); project.mkdir(mode=0o700)
        for name in ('user.npmrc', 'global.npmrc'):
            (home / name).touch(mode=0o600, exist_ok=False)
        for name in ('package.json', 'package-lock.json'):
            assert sha(candidate / name) == manifest['files'][name]
            shutil.copyfile(candidate / name, project / name)
        dist = {name: digest for name, digest in manifest['files'].items() if name.startswith('dist/')}
        assert len(dist) == 2827
        runtime = {name: digest for name, digest in dist.items() if name.endswith(('.js', '.json', '.md'))}
        assert len(runtime) == 979
        for name in dist:
            assert not (candidate / name).is_symlink()
            (project / name).parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            shutil.copyfile(candidate / name, project / name)
        report.update(package_sha256=sha(project / 'package.json'), lock_sha256=sha(project / 'package-lock.json'),
                      compiled_outputs_copied=2827, runtime_assets_copied=979)
        base_env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(home),
                    'NPM_CONFIG_USERCONFIG': str(home / 'user.npmrc'), 'NPM_CONFIG_GLOBALCONFIG': str(home / 'global.npmrc'),
                    'NPM_CONFIG_CACHE': str(cache), 'NPM_CONFIG_STRICT_SSL': 'true'}
        node, npm = shutil.which('node', path=base_env['PATH']), shutil.which('npm', path=base_env['PATH'])
        assert node and npm
        for label, binary in (('node', node), ('npm', npm)):
            value = subprocess.run([binary, '--version'], env=base_env, capture_output=True, timeout=10, check=True).stdout.decode().strip()
            assert re.fullmatch(r'v?[0-9]+(?:\.[0-9]+){2}(?:[-A-Za-z0-9.]*)?', value)
            report[label + '_version'] = value
        install_env = {**base_env, 'NODE_OPTIONS': '--max-old-space-size=512'}
        report['npm_ci_invocations'] = 1
        install = command([npm, 'ci', '--omit=dev'], 'npm-ci', install_env, project, 240)
        report['npm_ci_exit_code'] = install.returncode
        if install.returncode:
            raw = (work / 'private-npm-ci-stderr.log').read_text(encoding='utf-8', errors='replace')
            report['npm_error_codes'] = sorted(set(re.findall(r'npm (?:error|ERR!) code ([A-Z][A-Z0-9_]{0,63})', raw)))
            raise RuntimeError('npm_ci_failed_no_retry')
        assert sha(project / 'package.json') == report['package_sha256'] and sha(project / 'package-lock.json') == report['lock_sha256']
        assert (project / 'node_modules').is_dir() and not (project / 'node_modules').is_symlink()
        original_lock = json.loads((project / 'package-lock.json').read_text(encoding='utf-8'))
        installed = json.loads((project / 'node_modules/.package-lock.json').read_text(encoding='utf-8'))
        for name, item in installed['packages'].items():
            assert name in original_lock['packages'] and item['version'] == original_lock['packages'][name]['version']
        dependencies = json.loads((project / 'package.json').read_text(encoding='utf-8'))['dependencies']
        for name in dependencies:
            package = json.loads((project / 'node_modules' / name / 'package.json').read_text(encoding='utf-8'))
            assert package['version'] == original_lock['packages']['node_modules/' + name]['version']
        report['direct_production_dependencies'] = len(dependencies)
        report['installed_package_records'] = len(installed['packages'])
        report['all_installed_versions_match_lock'] = True
        assert not (project / 'node_modules/@nestjs/testing').exists(), 'Do not mistake a dev harness dependency for production readiness'
        report['Nest_testing_absent_as_expected_dev_dependency'] = True
        for name, digest in dist.items():
            assert sha(project / name) == digest
        report['all_979_runtime_assets_and_2827_outputs_match_candidate'] = True
        report['checks'].append('single_real_npm_ci_with_lifecycles_TLS_and_lock_unchanged')
        # Static ESM graphs for both real entrypoints load production dependencies,
        # then the ordinary quarantine gate rejects before Nest context or any I/O.
        for entry in ('main', 'nodia-ai-worker'):
            counters = work / ('private-' + entry + '-network.json')
            guard = work / ('private-' + entry + '-deny-network.cjs')
            guard.write_text("const fs=require('node:fs'),net=require('node:net');\n"
                             "const n={sockets:0,fetch:0,listeners:0};const save=()=>fs.writeFileSync(" + json.dumps(str(counters)) + ",JSON.stringify(n));save();\n"
                             "const deny=()=>{n.sockets++;save();throw Error('AI38_DEPENDENCY_SOCKET_FORBIDDEN');};net.Socket.prototype.connect=deny;net.connect=net.createConnection=deny;\n"
                             "net.Server.prototype.listen=()=>{n.listeners++;save();throw Error('AI38_DEPENDENCY_LISTEN_FORBIDDEN');};globalThis.fetch=()=>{n.fetch++;save();throw Error('AI38_DEPENDENCY_FETCH_FORBIDDEN');};\n", encoding='utf-8')
            environment = {**base_env, 'DOTENV_CONFIG_PATH': '/dev/null', 'NODE_ENV': 'test',
                           'RATE_LIMIT_STORAGE': 'memory', 'NODIA_AI_OPERATION_MODE': 'quarantine'}
            result = command([node, '--require', str(guard), str(project / ('dist/' + entry + '.js'))],
                             entry, environment, work, 30)
            error = (work / ('private-' + entry + '-stderr.log')).read_text(encoding='utf-8', errors='replace')
            assert result.returncode != 0 and 'nodia_ai:quarantine_blocks_startup' in error
            assert json.loads(counters.read_text()) == {'sockets': 0, 'fetch': 0, 'listeners': 0}
            report['checks'].append(entry + '_real_static_graph_loads_with_fresh_production_dependencies_no_IO')
        # Parent HTTP/test composition still uses its known development tooling.
        # Only the child entrypoint is redirected to the physically copied fresh dist,
        # whose own module resolution sees exclusively this npm-ci node_modules.
        control = work / 'worker-control'
        (control / 'test').mkdir(mode=0o700, parents=True)
        proof = work / 'worker-proof'; proof.mkdir(mode=0o700)
        for name in ('dist', 'node_modules', 'package.json', 'package-lock.json'):
            (control / name).symlink_to(candidate / name)
        shutil.copyfile(candidate / 'test/nodia-ai.integration.fixture.mjs', control / 'test/nodia-ai.integration.fixture.mjs')
        text = worker_harness.read_text(encoding='utf-8')
        old = "const entry = fileURLToPath(new URL('../dist/nodia-ai-worker.js', import.meta.url));"
        assert text.count(old) == 1
        text = text.replace(old, 'const entry = ' + json.dumps(str(project / 'dist/nodia-ai-worker.js')) + ';')
        target = control / 'test/nodia-ai-ai38-worker-process.mjs'
        target.write_text(text, encoding='utf-8')
        report['worker_harness_original_sha256'] = args.worker_harness_sha
        report['worker_harness_fresh_entry_only_sha256'] = sha(target)
        environment = {**base_env, 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory',
                       'NODIA_AI38_WORKER_PROCESS_ONLY': 'disposable', 'NODIA_AI_LAB_REPORT_JSON': str(proof / 'private-native-report.json'),
                       'AI38_PACKAGE_MANIFEST_SHA256': args.manifest_sha}
        worker = command([node, str(target)], 'worker-proof', environment, control, 90)
        allowed_containers = [rf'template_ai3803_{worker.pid}_[a-f0-9]{{8}}', rf'template_ai38worker_redis_{worker.pid}_[a-f0-9]{{8}}']
        report['worker_control_exit_code'] = worker.returncode
        native = json.loads((proof / 'private-native-report.json').read_text(encoding='utf-8'))
        assert worker.returncode == 0 and native['status'] == 'passed' and native['disposable_cleanup_complete'] is True
        report['worker_control'] = native
        report['checks'].append('fresh_production_dependencies_real_standalone_worker_11_SQL_HTTP_Redis_checks')
        assert sha(project / 'package-lock.json') == report['lock_sha256']
        report['status'] = 'passed'
        code = 0
    except Exception as error:
        report['status'] = 'failed_preserved_no_install_retry'
        report['failure_class'] = type(error).__name__
        code = 1
    finally:
        forced = 0
        for process in children:
            try:
                os.killpg(process.pid, 0)
            except ProcessLookupError:
                continue
            os.killpg(process.pid, signal.SIGKILL); forced += 1
        report['owned_process_groups_force_cleaned'] = forced
        if forced and code == 0:
            report['status'] = 'failed_unexpected_owned_process_group_remaining'; code = 1
        if allowed_containers:
            names = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, text=True, check=True).stdout.splitlines()
            owned = [name for name in names if any(re.fullmatch(pattern, name) for pattern in allowed_containers)]
            report['emergency_owned_containers_removed'] = owned
            for name in owned:
                subprocess.run(['docker', 'rm', '-f', name], capture_output=True, check=True)
            after = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, text=True, check=True).stdout.splitlines()
            report['owned_containers_remaining'] = sum(any(re.fullmatch(pattern, name) for pattern in allowed_containers) for name in after)
            if owned and code == 0:
                report['status'] = 'failed_unexpected_owned_container_remaining'; code = 1
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        report['elapsed_seconds'] = round(time.monotonic() - started, 3)
        report['private_log_hashes'] = {path.name: sha(path) for path in work.glob('private-*.log')}
        freeze(work / 'public-report.json', report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
    return code


if __name__ == '__main__':
    sys.exit(main())
