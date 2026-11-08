"""One-shot R07 compiled Reservations navigation installation; maintenance/backup are external."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shlex
import stat
import subprocess
import sys

ROOT = '/opt/nodia/releases/nodia-server-ai40-r07'
MANIFEST = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'
STAGE = Path('/opt/nodia/verification/ai40-reservations-navigation-install-r01')
CHILD = STAGE / 'nodia-ai-ai40-reservations-navigation-install-r01.mjs'
CHILD_SHA = 'd3c73fb2f55fe7108f92a5405fe6691d1ecae0d5b5bf5b6e495e80ce207bbcee'
WORK = STAGE / 'work'
ACCESS = Path('/opt/nodia/verification/ai40-reservations-access-inspection-r01/nodia-ai-ai40-reservations-access-inspect-operator-r01.py')
ACCESS_SHA = '12d83bece500081793746179a5076a1f3e07f88d93f830f929b92c7b1ddf3597'
BASE = Path('/opt/nodia/verification/ai40-r06-image-ui-inspection-r01/nodia-ai-ai40-r06-image-ui-inspect-operator-r01.py')
BASE_SHA = '48324dbd99493d5e6ed202df21e7d686fe9fe9d0e5399d880e70e04e3840af20'


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def private(path):
    info = path.lstat()
    require(path.resolve() == path and stat.S_ISREG(info.st_mode) and info.st_uid == 0
            and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600, 'private_source_required')


def load(path, pin, name):
    private(path); require(sha(path) == pin, 'dependency_source_changed')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def stopped(configuration):
    observed = {}
    for unit in ('nodia-api', 'nodia-ai-worker'):
        response = subprocess.run(['systemctl', 'show', unit, '--property=MainPID,ActiveState,WorkingDirectory,User,Environment,EnvironmentFiles'], capture_output=True, timeout=15, check=False)
        require(response.returncode == 0, 'service_observation_failed')
        values = dict(line.split('=', 1) for line in response.stdout.decode().splitlines() if '=' in line)
        require(values.get('MainPID') == '0' and values.get('ActiveState') == 'inactive'
                and values.get('WorkingDirectory') == ROOT and values.get('User') == 'nodia', 'writers_not_stopped_on_r07')
        require(not values.get('EnvironmentFiles'), 'additional_environment_source_requires_review')
        environment = dict(item.split('=', 1) for item in shlex.split(values.get('Environment', '')) if '=' in item)
        require(environment.get('DOTENV_CONFIG_PATH') == str(configuration)
                and not any(key.startswith('POSTGRES_') for key in environment), 'database_environment_requires_review')
        observed[unit] = {key: values[key] for key in ('MainPID', 'ActiveState', 'WorkingDirectory', 'User')}
    return observed


def exclusive(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as handle:
        json.dump(value, handle); handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
    descriptor = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
    sys.dont_write_bytecode = True
    private(Path(__file__).resolve()); private(CHILD)
    require(sha(Path(__file__).resolve()) == args.operator_sha256 and sha(CHILD) == CHILD_SHA, 'operator_or_child_source_changed')
    access = load(ACCESS, ACCESS_SHA, 'pinned_reservations_transport')
    transport = load(BASE, BASE_SHA, 'pinned_package_transport')
    transport.PACKAGES = {ROOT: MANIFEST}; transport.INSPECTOR_SHA = CHILD_SHA
    raw = sys.stdin.buffer.read(8193); require(0 < len(raw) <= 8192, 'descriptor_size_invalid')
    value = json.loads(raw)
    keys = {'schema_version', 'conversation_id', 'expected_owner_id', 'authority_run_id', 'configuration_path', 'configuration_sha256', 'maintenance_receipt_sha256'}
    require(type(value) is dict and set(value) == keys, 'descriptor_keys_invalid')
    identity = access.validate_descriptor({key: value[key] for key in ('schema_version', 'conversation_id', 'expected_owner_id', 'authority_run_id')})
    for key in ('configuration_sha256', 'maintenance_receipt_sha256'):
        require(type(value[key]) is str and re.fullmatch('[a-f0-9]{64}', value[key]), 'descriptor_pin_invalid')
    require(type(value['configuration_path']) is str, 'configuration_path_invalid')
    configuration = Path(value['configuration_path'])
    require(configuration.is_absolute() and configuration.resolve() == configuration and
            (configuration.is_relative_to('/opt/nodia') or configuration.is_relative_to('/etc/nodia')), 'configuration_path_not_allowlisted')
    info = configuration.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_uid in (0, 10000)
            and stat.S_IMODE(info.st_mode) & 0o077 == 0 and sha(configuration) == value['configuration_sha256'], 'configuration_identity_changed')
    consumers = stopped(configuration); provenance = transport.package(ROOT)
    for name in ('src/rental-navigation/rental-navigation.service.ts', 'src/rental-navigation/use-case/seed-rental-navigation.use-case.ts',
                 'dist/rental-navigation/rental-navigation.service.js', 'dist/rental-navigation/use-case/seed-rental-navigation.use-case.js'):
        manifest = json.loads((Path(ROOT) / 'release-manifest.json').read_bytes())['files']
        target = Path(ROOT) / name
        require(target.resolve() == target and target.is_file() and sha(target) == manifest[name], 'compiled_seed_source_changed')
    require(WORK.is_dir() and not WORK.is_symlink() and WORK.resolve() == WORK and WORK.stat().st_uid == 0
            and stat.S_IMODE(WORK.stat().st_mode) == 0o700, 'private_work_required')
    require(not (WORK / 'intent.json').exists() and not (WORK / 'receipt.json').exists(), 'installation_intent_already_consumed')
    resolver = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-e', access.DB_RESOLVER], cwd=ROOT,
                             env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'DOTENV_CONFIG_PATH': str(configuration), 'DOTENV_CONFIG_QUIET': 'true'},
                             capture_output=True, timeout=15, check=False)
    require(resolver.returncode == 0 and len(resolver.stdout) <= 32768, 'private_database_configuration_unavailable')
    database = json.loads(resolver.stdout)
    mode = 'install' if args.execute else 'preflight'
    payload = json.dumps({**identity, 'mode': mode, 'database': database}).encode()
    require(len(payload) <= 16384, 'private_payload_exceeded')
    intent = {'schema': 'nodia-ai-ai40-reservations-navigation-install-intent-v1', 'operator_sha256': args.operator_sha256,
              'child_sha256': CHILD_SHA, 'descriptor_sha256': hashlib.sha256(raw).hexdigest(), 'maintenance_receipt_sha256': value['maintenance_receipt_sha256']}
    if args.execute:
        exclusive(WORK / 'intent.json', intent)
    report = {'schema': 'nodia-ai-ai40-reservations-navigation-install-operator-v1', 'status': 'operator_failed', 'mode': mode,
              'provenance': provenance, 'intent': intent, 'SDK_requests': 0, 'services_changed_by_operator': False, 'automatic_retry_allowed': False}
    try:
        child = subprocess.run(['/usr/sbin/runuser', '--preserve-environment', '-u', 'nodia', '--', '/usr/local/bin/node', '--input-type=module', '-e', CHILD.read_text()],
                               input=payload, cwd=ROOT, env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/home/nodia', 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null'},
                               capture_output=True, timeout=75, check=False)
        require(0 < len(child.stdout) <= 65536, 'child_receipt_unavailable')
        result = json.loads(child.stdout)
        require(result.get('schema') == 'nodia-ai-ai40-reservations-navigation-install-child-v1' and result.get('mode') in (None, mode)
                and result.get('compiled_seed_invocations') in (0, 1) and result.get('provider_requests') == 0, 'child_receipt_invalid')
        report.update(status=result['status'], child=result, child_exit_code=child.returncode, private_stderr_bytes=len(child.stderr), private_stderr_emitted=False)
        require(consumers == stopped(configuration) and sha(configuration) == value['configuration_sha256'], 'maintenance_or_configuration_changed')
        transport.package(ROOT)
        require(child.returncode == 0 and result['status'] == ('installed_verified' if args.execute else 'preflight_passed')
                and result['compiled_seed_invocations'] == int(args.execute), 'seed_or_verification_failed')
        return report
    except Exception:
        report['status'] = 'operator_failed'
        report['result_uncertain_or_requires_inspection'] = bool(args.execute)
        raise
    finally:
        if args.execute:
            exclusive(WORK / 'receipt.json', report)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--operator-sha256', required=True); parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(run(args)))
    except Exception as error:
        code = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-reservations-navigation-install-operator-v1', 'status': 'operator_failed',
                          'error_code': code if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', code) else 'private_dependency_or_protocol_failure',
                          'automatic_retry_allowed': False, 'private_details_emitted': False})); sys.exit(1)
