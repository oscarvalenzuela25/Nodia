"""One isolated actual R09 Registry/Context DI check with 150 published capabilities.

No synthetic publication override or operational AppModule is used.
External ports reject IO; domain handlers are never invoked.
No operational configuration enters the synthetic child environment.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path
import shutil
import stat
import subprocess
import sys

ROOT = Path('/opt/nodia/verification/ai36-c05-registry-di-r01')
WORK = ROOT / 'work'
SERVER = WORK / 'repository/nodia-server'
LIVE = Path('/opt/nodia/releases/nodia-server-ai36-c05-r09')
MANIFEST = 'edd279fa5f5f99a7529adcf4cf75b7016505bf6581fc57cb85a3000cf802ff85'
ASSETS = {'test/nodia-ai-ai36-c05-publication-registry.integration.mjs': 'fb0b63baa5742a465fb7c782dd2e6f1d056312d78e5e50a460a2afc1a62c79b8'}
BASELINE = 'f72f3cbd410d7b8c7cf1d57c4c823840afec7daeeac5398db26db2a9e0ddc957'

BASE_TESTS = {
    'test/nodia-ai-ai36-write-preparation.integration.mjs': 'b0bdaaf47608e8414e4adc47529dfef88b9f28a2bb6463117c1be2969ee48113',
    'test/nodia-ai-ai36-secure-preparation.integration.mjs': 'e55168cb4a73f0a0ae764481ecd61df592cc6154691dc0f69441615fd3b5c4fc',
    'test/nodia-ai-ai29.integration.mjs': 'a4cb168936dc990dfe326accff826a8a4ac42d0b314a0a23c37021654b5b1ed1',
    'test/nodia-ai.integration.fixture.mjs': '6d595c1fa88e29c42149573dc9bdcb805a7b495aee39ac5cac4c50147bc806df',
    'test/nodia-ai-ai29-worker.fixture.mjs': '822d25abdfe65e281ea67f2bddf242a1d4d4e1413e7b8bd0b26d8b62835e038f',
}
RECOVERY = Path('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01/nodia-ai-ai40-gemini-chat-recovery-operator-r01.py')
RECOVERY_SHA = '5b84e576d605f608388ce4c66988f40d1daecf2934bc4b2022e31406999ceeb1'
UNITS = ('nodia-api', 'nodia-ai-worker', 'nodia-keyring', 'nginx', 'nodia-gemini-lab')


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def command(argv, timeout=20):
    result = subprocess.run(argv, capture_output=True, timeout=timeout, check=False)
    require(result.returncode == 0, 'metadata_command_failed')
    return result.stdout


def freeze(name, value):
    raw = (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()
    fd = os.open(WORK / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def freeze_private_bytes(name, raw):
    require(len(raw) <= 2 * 1024 * 1024, 'private_output_exceeded')
    fd = os.open(WORK / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)
    return sha(raw)


def closed_diagnostic(raw):
    text = raw.decode('utf-8', 'replace')
    classes = re.findall(r'(?:^|\n)(AssertionError|TypeError|ReferenceError|SyntaxError|RangeError|Error|QueryFailedError)(?:\s|\[|:)', text)
    codes = re.findall(r'\[(ERR_[A-Z_]{1,80})\]', text)
    codes += re.findall(r'\b(ENOENT|EACCES|EPERM)\b', text)
    states = re.findall(r"code:\s*['\"]([A-Z0-9]{5})['\"]", text)
    frame = re.search(r'(?:/nodia-server/)((?:test|dist)/[A-Za-z0-9_./-]+):(\d+):(\d+)', text)
    source = 'relative_first_party' if frame else None
    if frame:
        first = frame.group(1) + ':' + frame.group(2) + ':' + frame.group(3)
    else:
        frame = re.search(r'data:text/javascript;base64,[A-Za-z0-9+/=]+:(\d+):(\d+)', text)
        first = 'test/C01-generated-in-memory.mjs:' + frame.group(1) + ':' + frame.group(2) if frame else None
        source = 'synthetic_data_URL_position' if frame else None
    return {'exception_class': classes[-1] if classes else None, 'node_code': codes[-1] if codes else None, 'SQLSTATE': states[-1] if states else None, 'first_party_frame': first, 'frame_source': source, 'raw_payloads_emitted': False}


def metadata():
    services = {unit: command(['systemctl', 'show', unit, '--no-pager', '--property=ActiveState,SubState,MainPID,WorkingDirectory']).decode() for unit in UNITS}
    epoch = command(['docker', 'inspect', '--format', '{{.Id}} {{.Image}} {{.State.StartedAt}}', '678d4f10274cf557590311af0bee81a7cb71be7015ec282a4154d48b71d6d38b']).decode().strip()
    proofs = {name: sha((Path('/var/lib/nodia/codex/1') / ('nodia-chat-' + name)).read_bytes()) for name in ('mcp', 'mcp-image-png', 'mcp-image-jpeg', 'mcp-image-webp')}
    return {'services': services, 'Gemini_epoch': epoch, 'proofs': proofs}


def fixtures():
    return command(['docker', 'ps', '-a', '--filter', 'name=^template_ai', '--format', '{{.Names}}']).decode().splitlines()


def active_manifest():
    raw = (LIVE / 'release-manifest.json').read_bytes()
    require(sha(raw) == MANIFEST, 'active_manifest_changed')
    manifest = json.loads(raw)
    for name, pin in manifest['files'].items():
        path = LIVE / name
        require(path.is_file() and not path.is_symlink() and sha(path.read_bytes()) == pin, 'active_member_changed')
    for name, pin in BASE_TESTS.items():
        require(manifest['files'][name] == pin, 'base_test_changed')
    require((LIVE / 'node_modules').resolve() == Path('/opt/nodia/nodia-server/node_modules'), 'runtime_dependency_target_changed')
    return manifest


def operational_guard():
    raw = RECOVERY.read_bytes()
    require(sha(raw) == RECOVERY_SHA, 'readonly_guard_changed')
    namespace = {'__name__': 'isolated_SQL_readonly_guards', '__file__': str(RECOVERY)}
    exec(compile(raw, str(RECOVERY), 'exec'), namespace)
    activation, *_ = namespace['dependencies']()
    consumers, sql, proofs = namespace['final_snapshot'](activation)
    return {'consumers': consumers, 'SQL': sql, 'proofs': proofs}


def json_objects(raw):
    text = raw.decode('utf-8', 'replace')
    decoder = json.JSONDecoder()
    values = []
    for index, character in enumerate(text):
        if character == '{':
            try:
                value, _ = decoder.raw_decode(text[index:])
                if isinstance(value, dict):
                    values.append(value)
            except ValueError:
                pass
    return values


def main(args):
    require(sys.platform == 'linux' and os.geteuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
    sys.dont_write_bytecode = True
    require(args.execute_isolated_sql and sha(Path(__file__).read_bytes()) == args.operator_sha256, 'explicit_execution_and_pin_required')
    for path in (ROOT, WORK):
        info = path.lstat()
        require(path.resolve() == path and stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700, 'private_work_changed')
    require(not (WORK / 'intent.json').exists() and not SERVER.exists(), 'isolated_intent_or_snapshot_consumed')
    manifest = active_manifest()
    require(command(['/usr/local/bin/node', '--version']).decode().strip() == 'v24.20.0', 'Node_version_changed')
    require(not fixtures(), 'another_SQL_fixture_exists')
    image = command(['docker', 'image', 'inspect', '--format', '{{.Id}}', 'postgres:16-alpine']).decode().strip()
    require(image == command(['docker', 'inspect', '--format', '{{.Image}}', 'nodia-lab-postgres-1']).decode().strip(), 'installed_PostgreSQL_image_changed')
    before = metadata()
    guard_before = operational_guard()
    for name, pin in ASSETS.items():
        require(sha((ROOT / Path(name).name).read_bytes()) == pin, 'reviewed_test_asset_changed')
    SERVER.mkdir(parents=True)
    shutil.copytree(LIVE / 'dist', SERVER / 'dist', symlinks=False)
    shutil.copytree(LIVE / 'test', SERVER / 'test', symlinks=False)
    shutil.copyfile(LIVE / 'package.json', SERVER / 'package.json')
    schema = 'scripts/nodia-ai-knowledge/contracts.schema.json'
    require(manifest['files'][schema] == 'cc93ecb978c5e74f6a3492661da8bcd4b4bdce0afc0da57efdc678ea21b1d23c', 'fixture_schema_source_changed')
    (SERVER / schema).parent.mkdir(parents=True)
    shutil.copyfile(LIVE / schema, SERVER / schema)
    require(sha((SERVER / schema).read_bytes()) == manifest['files'][schema], 'fixture_schema_copy_changed')
    os.symlink('/opt/nodia/nodia-server/node_modules', SERVER / 'node_modules', target_is_directory=True)
    evidence = WORK / 'repository/docs/evidence'
    evidence.mkdir(parents=True)
    baseline = ROOT / 'nodia-ai-ai36-c05-write-publication-r02-baseline.json'
    require(sha(baseline.read_bytes()) == BASELINE, 'published_baseline_changed')
    shutil.copyfile(baseline, evidence / baseline.name)
    (WORK / 'home').mkdir(mode=0o700)
    for name in ASSETS:
        shutil.copyfile(ROOT / Path(name).name, SERVER / name)
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(WORK / 'home'), 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'}
    report = {'schema': 'nodia-ai-ai36-c05-registry-DI-v1', 'status': 'failed_closed', 'active_manifest_sha256': MANIFEST, 'test_asset_pins': ASSETS, 'base_test_pins': BASE_TESTS, 'PostgreSQL_image_id': image, 'before': before, 'guard_before': guard_before, 'environment_allowlist': sorted(env), 'operational_database_used_by_tests': False, 'provider_generations': 0, 'synthetic_fixture_mutations': True, 'runtime_code_source': 'actual R09 publication and Nest registry/context composition; R08 application remains active', 'actual_R09_publication_metadata_tested': True, 'test_results': []}
    freeze('intent.json', report)
    try:
        precheck = subprocess.run(['/usr/local/bin/node', '--check', 'test/nodia-ai-ai36-c05-publication-registry.integration.mjs'], cwd=SERVER, env=env, capture_output=True, timeout=20, check=False)
        require(precheck.returncode == 0, 'DI_source_syntax_failed')
        report['source_syntax_checked'] = True
        cases = [('DI150', 'test/nodia-ai-ai36-c05-publication-registry.integration.mjs', 'AI36-C05-publication-registry', 12, None)]
        for label, test, stage, count, dispatches in cases:
            require(not fixtures(), 'another_fixture_before_stage')
            freeze('intent-' + label + '.json', {'test': test, 'stage': stage, 'provider_generations': 0})
            child = subprocess.run(['/usr/local/bin/node', test], cwd=SERVER, env=env, capture_output=True, timeout=420, check=False)
            require(len(child.stdout) <= 2 * 1024 * 1024 and len(child.stderr) <= 2 * 1024 * 1024, 'test_output_exceeded')
            stderr_sha = freeze_private_bytes(label + '-stderr.private', child.stderr)
            stdout_sha = freeze_private_bytes(label + '-stdout.private', child.stdout)
            values = [v for v in json_objects(child.stdout) if v.get('stage') == stage]
            result = {'stage': stage, 'child_exit_code': child.returncode, 'private_stderr_bytes': len(child.stderr), 'private_stderr_emitted': False, 'output_sha256': stdout_sha, 'private_stderr_sha256': stderr_sha, 'closed_diagnostic': closed_diagnostic(child.stderr), 'fixture_containers_after': fixtures()}
            if len(values) == 1:
                result['test'] = values[0]
            freeze('result-' + label + '.json', result)
            report['test_results'].append(result)
            require(child.returncode == 0 and len(values) == 1 and not result['fixture_containers_after'], 'SQL_stage_failed_' + label)
            native = values[0]
            require(native['status'] == 'passed' and native['checks'] == 12 and len(native['results']) == 12 and native['published'] == 150 and native['actual_registry_and_knowledge_DI'] is True and native['original_contracts_exact'] == 74 and native['added_change'] == 72 and native['added_secure'] == 4 and native['synthetic_publication_override'] is False and native['configured_database_used'] is False and native['SDK_requests'] == 0 and native['domain_handlers_invoked'] is False and native['fixture_permission_setup_only'] is True, 'actual_registry_DI_not_passed')
        report['after'] = metadata()
        report['guard_after'] = operational_guard()
        require(report['after'] == before and report['guard_after'] == guard_before and not fixtures(), 'operational_state_changed_or_fixture_retained')
        active_manifest()
        report['status'] = 'passed_actual_R09_registry_DI_isolated'
        report['fixture_cleanup_verified'] = True
    except Exception as error:
        report['failure_class'] = type(error).__name__
        report['failure_code'] = str(error) if isinstance(error, ValueError) and str(error).replace('_', '').isalnum() else None
        report['after_failure'] = metadata()
        report['remaining_fixture_containers'] = fixtures()
        freeze('receipt.json', report)
        raise
    freeze('receipt.json', report)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--execute-isolated-sql', action='store_true')
    try:
        print(json.dumps(main(parser.parse_args())))
    except Exception as error:
        print(json.dumps({'schema': 'nodia-ai-ai36-c05-registry-DI-v1', 'status': 'failed_closed', 'error_class': type(error).__name__, 'failure_code': str(error) if isinstance(error, ValueError) and str(error).replace('_', '').isalnum() else None, 'private_details_emitted': False, 'auto_replay': False}))
        raise SystemExit(1)
