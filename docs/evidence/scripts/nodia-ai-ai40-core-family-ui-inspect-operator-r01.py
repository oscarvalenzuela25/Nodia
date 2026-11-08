"""Pinned read-only aggregate Core-module oracle and own-run inspector, R07 only. No provider process or service mutation.

Run as root with descriptor JSON on stdin. Release is derived from the active
API/worker and restricted to the one exact package below; not an input path.
Only selected DB environment fields reach a fresh child, never stdout.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

STAGE = Path('/opt/nodia/verification/ai40-core-family-inspection-r01')
INSPECTOR = STAGE / 'nodia-ai-ai40-core-family-ui-inspect-r01.mjs'
INSPECTOR_SHA = 'ad0c3656a31b734ed841558d18f6506ba517e26dc9f16876e1cc5cc5e121a3c6'
PACKAGES = {
    '/opt/nodia/releases/nodia-server-ai40-r07': '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476',
}
DEPENDENCIES = Path('/opt/nodia/nodia-server/node_modules')


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def private_file(path):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1
            and stat.S_IMODE(info.st_mode) == 0o600, 'operator_file_not_private')


def consumers():
    result = {}
    for name in ('nodia-api', 'nodia-ai-worker'):
        observed = subprocess.run(['systemctl', 'show', name, '--property=MainPID,ActiveState,WorkingDirectory,User'],
                                  capture_output=True, timeout=15, check=False)
        require(observed.returncode == 0, 'service_observation_failed')
        fields = dict(line.split('=', 1) for line in observed.stdout.decode().splitlines() if '=' in line)
        require(fields.get('ActiveState') == 'active' and fields.get('User') == 'nodia', 'consumer_not_active')
        pid = fields.get('MainPID', '')
        release = fields.get('WorkingDirectory', '')
        require(re.fullmatch(r'[1-9][0-9]*', pid) and release in PACKAGES, 'consumer_identity_not_allowlisted')
        require(Path('/proc', pid, 'cwd').resolve() == Path(release), 'consumer_cwd_mismatch')
        result[name] = {'pid': int(pid), 'release': release, 'state': 'active'}
    require(result['nodia-api']['release'] == result['nodia-ai-worker']['release'], 'consumer_release_mismatch')
    return result


def package(release):
    root = Path(release)
    require(root.resolve() == root, 'release_path_escaped')
    manifest = root / 'release-manifest.json'
    require(sha(manifest) == PACKAGES[release], 'release_manifest_changed')
    files = json.loads(manifest.read_bytes())['files']
    boundaries = ('package-lock.json',
                  'dist/config/envs.config.js', 'dist/rate-limit/rate-limit.config.js',
                  'dist/nodia-ai/nodia-ai-authorization.service.js',
                  'dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js',
                  'dist/authorization/authority-transaction.js',
                  'dist/nodia-ai/knowledge/manifest.json',
                  'dist/nodia-ai-products/contracts/core-settings.schema.json',
                  'dist/nodia-ai-products/core-settings/core-settings-read.family.js',
                  'dist/nodia-ai-products/core-settings/use-case/execute-nodia-ai-core-settings-read.use-case.js',
                  'dist/module/module.service.js', 'dist/module/use-case/get-all-modules.use-case.js',
                  'dist/common/utils/ransack-query.builder.js', 'dist/common/utils/ransack-query.policies.js')
    for name in boundaries:
        target = root / name
        info = target.lstat()
        require(name in files and stat.S_ISREG(info.st_mode) and info.st_nlink == 1
                and target.resolve().is_relative_to(root) and sha(target) == files[name], 'read_boundary_changed')
    require((root / 'node_modules').is_symlink() and (root / 'node_modules').resolve() == DEPENDENCIES,
            'dependency_path_changed')
    return {'release': release, 'release_manifest_sha256': PACKAGES[release],
            'boundary_files_pinned': len(boundaries), 'inspector_sha256': INSPECTOR_SHA}


def selected_environment(pid):
    names = {'DOTENV_CONFIG_PATH', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB',
             'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL', 'TZ'}
    selected = {}
    for entry in Path('/proc', str(pid), 'environ').read_bytes().split(b'\0'):
        key, separator, value = entry.partition(b'=')
        if separator and key.decode('ascii', errors='ignore') in names:
            name = key.decode('ascii')
            require(name not in selected, 'duplicate_environment_key')
            selected[name] = value.decode()
    source = selected.get('DOTENV_CONFIG_PATH', '')
    require(source and Path(source).is_absolute() and Path(source).resolve().is_relative_to('/opt/nodia')
            or source and Path(source).is_absolute() and Path(source).resolve().is_relative_to('/etc/nodia'),
            'configuration_source_not_allowlisted')
    # Presence/permissions only here; the pinned Node inspector parses the file.
    info = Path(source).stat()
    require(stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) & 0o077 == 0,
            'configuration_source_not_private')
    return selected


def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_root_linux_required')
    info = STAGE.lstat()
    require(STAGE.resolve() == STAGE and stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700, 'stage_directory_not_private')
    private_file(Path(__file__).resolve())
    require(sha(Path(__file__).resolve()) == args.operator_sha256, 'operator_source_changed')
    private_file(INSPECTOR)
    require(sha(INSPECTOR) == INSPECTOR_SHA, 'inspector_source_changed')
    raw = sys.stdin.buffer.read(8193)
    require(0 < len(raw) <= 8192, 'descriptor_size_invalid')
    descriptor = json.loads(raw)
    require(type(descriptor) is dict and set(descriptor) == {'schema_version', 'conversation_id', 'expected_owner_id', 'authority_run_id', 'run_id', 'after_user_seq'}, 'descriptor_invalid')
    before = consumers()
    provenance = package(before['nodia-api']['release'])
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'DOTENV_CONFIG_QUIET': 'true',
           **selected_environment(before['nodia-api']['pid'])}
    require(env.get('TZ') in (None, 'UTC', 'Etc/UTC'), 'timezone_requires_review')
    configuration = Path(env['DOTENV_CONFIG_PATH'])
    require(configuration.stat().st_size <= 1048576, 'configuration_source_too_large')
    configuration_digest = sha(configuration)
    child = subprocess.run(['/usr/local/bin/node', str(INSPECTOR)], input=raw, cwd=provenance['release'],
                           env=env, capture_output=True, timeout=90, check=False)
    require(len(child.stdout) <= 262144, 'inspection_output_exceeded')
    result = json.loads(child.stdout)
    require(result['schema'] == 'nodia-ai-ai40-core-family-inspection-v1' and result['sql_read_only'] is True
            and result['configured_sql_writes'] == 0 and result['provider_requests'] == 0
            and result['private_content_emitted'] is False and result['credentials_or_storage_keys_emitted'] is False,
            'inspection_receipt_invalid')
    after = consumers()
    require(before == after, 'consumer_changed_during_inspection')
    require(selected_environment(after['nodia-api']['pid']) == {key: value for key, value in env.items() if key not in {'PATH', 'HOME', 'DOTENV_CONFIG_QUIET'}}, 'consumer_environment_changed')
    require(sha(configuration) == configuration_digest, 'configuration_source_changed')
    require(package(after['nodia-api']['release']) == provenance, 'release_changed_during_inspection')
    return {'schema': 'nodia-ai-ai40-core-family-inspection-operator-v1', 'status': result['status'],
            'source_sha256': args.operator_sha256, 'provenance': provenance, 'consumers': after,
            'child_exit_code': child.returncode, 'stderr_bytes': len(child.stderr), 'private_stderr_emitted': False,
            'services_changed': False, 'configuration_changed': False, 'profile_accessed': False,
            'inspection': result}, child.returncode


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--operator-sha256', required=True)
    args = parser.parse_args()
    try:
        report, exit_code = run(args)
        print(json.dumps(report))
        sys.exit(exit_code)
    except Exception as error:
        code = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-core-family-inspection-operator-v1', 'status': 'operator_failed',
                          'error_code': code if re.fullmatch(r'[a-z][a-z0-9_]{1,95}', code) else None,
                          'error_class': type(error).__name__, 'private_details_emitted': False,
                          'provider_requests': 0, 'services_changed': False, 'configuration_changed': False}))
        sys.exit(1)
