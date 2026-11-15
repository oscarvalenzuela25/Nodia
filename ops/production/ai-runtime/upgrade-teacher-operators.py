#!/usr/bin/env python3
"""Explicit healthy-host CAS refresh of Teacher operators; default inert.

No deploy, service restart, database, profile, provider or runtime activation.
An interrupted reservation requires private reconciliation, never replay.
"""
import argparse
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
CURRENT = Path('/opt/nodia/current')
SYSTEMD = Path('/etc/systemd/system')
REGISTRY = Path('/etc/nodia/ai-runtime/consumers.json')
TEACHER_ENVIRONMENT = Path('/etc/nodia/teacher-runtime.env')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
REPLACE = {'update-backend.py', 'ai-runtime/register-consumers.py'}
CREATE = {'ai-runtime/prepare-teacher-runtime.py'}
IMMUTABLE = {'update-backend-action.mjs', 'ai-runtime/runtime-preflight.mjs', 'ai-runtime/codex-provision.py'}
ASSETS = {'update-backend.py', 'backend_update.py', 'update-backend-action.mjs',
          'stage-backend-candidate.py', 'probe-backend-dependencies.mjs'}
SERVICES = ('nodia-api.service', 'nodia-ai-worker.service')
BASE_UNITS = {*SERVICES, 'nodia-ai-backup.service', 'nodia-ai-backup-rotate.service',
              'nodia-ai-journal-reconcile.service', 'nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer'}
RUNTIME_UNITS = (*SERVICES, 'nodia-codex-bus.service', 'nodia-codex-keyring.service',
                 'nodia-gemini.service', 'nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer')
HEX = re.compile(r'[a-f0-9]{64}')
MAX_SOURCE = 128 * 1024


def require(condition, code):
    if not condition:
        raise ValueError(code)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def unique_json(raw):
    def pairs(items):
        value = {}
        for key, item in items:
            require(key not in value, 'duplicate_json_key')
            value[key] = item
        return value
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: require(False, 'invalid_json_number'))


def protected(path, mode=None, directory=False):
    path = Path(path)
    require(path.is_absolute() and '..' not in path.parts, 'absolute_protected_path_required')
    for parent in [*reversed(path.parents), path]:
        info = parent.lstat()
        require(not stat.S_ISLNK(info.st_mode) and info.st_uid == info.st_gid == 0
                and not info.st_mode & 0o022, 'unsafe_protected_path')
        if parent != path:
            require(stat.S_ISDIR(info.st_mode), 'unsafe_protected_parent')
    require(stat.S_ISDIR(info.st_mode) if directory else
            stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'invalid_protected_file_type')
    require(mode is None or stat.S_IMODE(info.st_mode) == mode, 'invalid_protected_mode')
    return info


def read_source(path, *, installed=False, mode=0o644, bound=MAX_SOURCE):
    path = Path(path)
    if installed:
        protected(path, mode)
    else:
        require(path.is_absolute() and path.resolve(strict=True) == path, 'canonical_source_required')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and not info.st_mode & 0o022
                and 0 < info.st_size <= bound, 'bounded_regular_source_required')
        raw = stream.read(bound + 1)
        after = os.fstat(stream.fileno())
        require(len(raw) <= bound and (info.st_ino, info.st_size, info.st_mtime_ns) ==
                (after.st_ino, after.st_size, after.st_mtime_ns), 'source_changed_or_grew')
    return raw


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def exclusive(path, raw, mode=0o600):
    protected(path.parent, directory=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'wb') as stream:
        os.fchmod(stream.fileno(), mode)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    sync_directory(path.parent)


def replace(path, raw, mode):
    protected(path, mode)
    fd, temporary = tempfile.mkstemp(prefix='.teacher-operator-upgrade-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            os.fchmod(stream.fileno(), mode)
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        sync_directory(path.parent)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load_bytes(raw, path, name):
    scope = {'__name__': name, '__file__': str(path)}
    exec(compile(raw, str(path), 'exec'), scope)
    return SimpleNamespace(**scope)


def validate_manifest(value):
    require(type(value) is dict and set(value) == {'schema', 'current_release', 'current_manifest_sha256',
            'settings_sha256', 'receiver_settings_sha256', 'registry_sha256', 'files', 'immutable'}, 'manifest_shape_invalid')
    require(value['schema'] == 'teacher-operator-upgrade/1' and type(value['current_release']) is str and
            re.fullmatch(r'backend-[a-f0-9]{12}-[a-f0-9]{12}', value['current_release'] or ''), 'manifest_scope_invalid')
    for key in ('current_manifest_sha256', 'settings_sha256', 'receiver_settings_sha256', 'registry_sha256'):
        require(type(value[key]) is str and HEX.fullmatch(value[key]), 'manifest_digest_invalid')
    require(type(value['files']) is dict and set(value['files']) == REPLACE | CREATE
            and type(value['immutable']) is dict and set(value['immutable']) == IMMUTABLE, 'closed_operator_scope_required')
    for name, entry in value['files'].items():
        require(type(entry) is dict and set(entry) == {'previous_sha256', 'sha256'}
                and type(entry['sha256']) is str and HEX.fullmatch(entry['sha256']), 'candidate_digest_invalid')
        if name in CREATE:
            require(entry['previous_sha256'] is None, 'new_prepare_must_be_absent')
        else:
            require(type(entry['previous_sha256']) is str and HEX.fullmatch(entry['previous_sha256'])
                    and entry['previous_sha256'] != entry['sha256'], 'distinct_replacement_digests_required')
    require(all(type(pin) is str and HEX.fullmatch(pin) for pin in value['immutable'].values()), 'immutable_digest_invalid')
    return value


def digest_map(value, names):
    require(type(value) is dict and set(value) == names and
            all(type(pin) is str and HEX.fullmatch(pin) for pin in value.values()), 'installed_digest_map_invalid')
    return value


def snapshot(receiver, settings):
    units = {}
    for unit in RUNTIME_UNITS:
        state = dict(receiver.unit_state(unit))
        if unit.endswith('.timer'):
            state['UnitFileState'] = timer_enabled(unit)
        pid = state.get('MainPID', '0')
        if pid and pid != '0':
            require(pid.isdigit(), 'runtime_pid_invalid')
            raw = (Path('/proc') / pid / 'stat').read_text()
            state['process_start_ticks'] = raw[raw.rfind(')') + 2:].split()[19]
        units[unit] = state
    hashes = {name: sha(read_source(SYSTEMD / name, installed=True)) for name in settings['service_hashes']}
    require(hashes == settings['service_hashes'], 'base_unit_pin_changed')
    return {'units': units, 'base_units_sha256': hashes}


def timer_enabled(unit):
    result = subprocess.run(['/usr/bin/systemctl', 'show', unit, '-p', 'UnitFileState', '--value'],
                            capture_output=True, timeout=15)
    value = result.stdout.decode().strip()
    require(result.returncode == 0 and re.fullmatch('[a-z-]{1,40}', value), 'timer_enable_state_unavailable')
    return value


def ready(receiver):
    value = receiver.deployment_status()
    require(value.get('status') == 'deployment_ready' and value.get('blocked') is False and
            value.get('application') == {'api_active': True, 'worker_active': True}, 'healthy_unblocked_backend_required')
    return value


def upgrade(bundle, manifest_path, expected):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_root_required')
    require(type(expected) is str and HEX.fullmatch(expected), 'reviewed_manifest_digest_required')
    raw = read_source(Path(manifest_path).absolute())
    require(sha(raw) == expected, 'manifest_digest_mismatch')
    plan = validate_manifest(unique_json(raw))
    bundle = Path(bundle).absolute()
    require(bundle.resolve(strict=True) == bundle and bundle.is_dir(), 'canonical_bundle_required')
    candidates = {}
    for name, entry in plan['files'].items():
        content = read_source(bundle / name)
        require(sha(content) == entry['sha256'] and b'\r' not in content, 'candidate_source_digest_or_LF_invalid')
        content.decode('utf-8')
        compile(content, str(LIB / name), 'exec')
        candidates[name] = content
    for directory in (LIB, LIB / 'ai-runtime', STATE, INSTALL_LOCK.parent, REGISTRY.parent):
        protected(directory, directory=True)
    record = STATE / ('teacher-operators-upgrade-' + expected)
    import fcntl
    with ExitStack() as stack:
        for path in (STATE / 'receiver.lock', INSTALL_LOCK):
            require(protected(path, 0o600).st_size == 0, 'empty_protected_lock_required')
            stream = stack.enter_context(path.open('r+b'))
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(not record.exists() and not record.is_symlink(), 'upgrade_already_reserved_no_replay')
        settings_raw = read_source(STATE / 'settings.json', installed=True, mode=0o600, bound=16384)
        receiver_raw = read_source(STATE / 'receiver-settings.json', installed=True, mode=0o600, bound=16384)
        registry_raw = read_source(REGISTRY, installed=True, mode=0o600, bound=16384)
        for content, key in ((settings_raw, 'settings_sha256'), (receiver_raw, 'receiver_settings_sha256'), (registry_raw, 'registry_sha256')):
            require(sha(content) == plan[key], 'protected_metadata_CAS_changed')
        settings, receiver_settings, registry = map(unique_json, (settings_raw, receiver_raw, registry_raw))
        require(type(settings.get('schema_version')) is int and settings['schema_version'] == 1, 'settings_schema_invalid')
        digest_map(settings.get('assets'), ASSETS)
        digest_map(settings.get('service_hashes'), BASE_UNITS)
        receiver_assets = digest_map(receiver_settings.get('assets'), {'deploy-backend-receiver.py', 'deploy-gateway.py'})
        installed = {}
        for pins in (settings['assets'], receiver_assets, plan['immutable']):
            for name, pin in pins.items():
                content = read_source(LIB / name, installed=True, mode=0o755 if name == 'deploy-gateway.py' else 0o644)
                require(sha(content) == pin, 'installed_asset_digest_changed')
                installed[name] = content
        for name, entry in plan['files'].items():
            target = LIB / name
            if name in CREATE:
                require(not target.exists() and not target.is_symlink(), 'prepare_operator_already_exists')
            else:
                content = read_source(target, installed=True)
                require(sha(content) == entry['previous_sha256'], 'previous_operator_digest_changed')
                installed[name] = content
        require(settings['assets']['update-backend.py'] == plan['files']['update-backend.py']['previous_sha256'], 'updater_pin_changed')
        for path in (LIB / 'teacher-runtime', TEACHER_ENVIRONMENT):
            require(not path.exists() and not path.is_symlink(), 'teacher_runtime_already_configured')
        previous = load_bytes(installed['update-backend.py'], LIB / 'update-backend.py', 'teacher_upgrade_previous')
        require(set(registry.get('units', {})) == set(SERVICES) and 'teacher_host' not in registry, 'initial_70_71_registry_required')
        previous.ai_runtime_registry(registry)
        reviewed = load_bytes(candidates['update-backend.py'], LIB / 'update-backend.py', 'teacher_upgrade_candidate')
        require(reviewed.AI_RUNTIME_TEMPLATES == previous.AI_RUNTIME_TEMPLATES and
                reviewed.TEACHER_RUNTIME_NAME == '72-teacher-runtime.conf' and
                reviewed.TEACHER_RUNTIME_TEMPLATE == b'[Service]\nEnvironmentFile=/etc/nodia/teacher-runtime.env\n', 'reviewed_additive_72_contract_required')
        reviewed.ai_runtime_registry(registry)
        receiver = load_bytes(installed['deploy-backend-receiver.py'], LIB / 'deploy-backend-receiver.py', 'teacher_upgrade_receiver')
        before = ready(receiver)
        require(before.get('current', {}).get('release_id') == plan['current_release'] and
                CURRENT.is_symlink() and CURRENT.resolve(strict=True).name == plan['current_release'] and
                sha(read_source(CURRENT.resolve() / 'release-manifest.json', installed=True, bound=32*1024*1024)) == plan['current_manifest_sha256'], 'current_release_CAS_changed')
        runtime = snapshot(receiver, settings)
        new_settings = unique_json(settings_raw)
        new_settings['assets']['update-backend.py'] = plan['files']['update-backend.py']['sha256']
        policy = load_bytes(installed['backend_update.py'], LIB / 'backend_update.py', 'teacher_upgrade_policy')
        host = reviewed.Host(policy, None, new_settings)
        for unit in BASE_UNITS:
            host.service_overrides(unit, receiver.unit_state(unit))
        record.mkdir(mode=0o700)
        sync_directory(STATE)
        try:
            exclusive(record / 'manifest.json', raw)
            originals = record / 'originals'; originals.mkdir(mode=0o700)
            for name in sorted(REPLACE):
                path = originals / name
                path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                exclusive(path, installed[name])
            for name, content in (('settings.json', settings_raw), ('receiver-settings.json', receiver_raw), ('consumers.json', registry_raw)):
                exclusive(originals / name, content)
            exclusive(record / 'before.json', (json.dumps({'deployment_status': before, 'runtime': runtime, 'absent': sorted(CREATE)}, sort_keys=True) + '\n').encode())
            exclusive(record / 'intent.json', (json.dumps({'manifest_sha256': expected, 'automatic_retry_allowed': False, 'phase': 'originals_complete'}, sort_keys=True) + '\n').encode())
            for name in sorted(REPLACE | CREATE):
                target = LIB / name
                if name in CREATE:
                    exclusive(target, candidates[name], 0o644)
                else:
                    replace(target, candidates[name], 0o644)
                exclusive(record / ('applied-' + sha(name.encode()) + '.json'), (json.dumps({'path': name, 'sha256': sha(candidates[name])}) + '\n').encode())
            new_raw = (json.dumps(new_settings, sort_keys=True, indent=2) + '\n').encode()
            replace(STATE / 'settings.json', new_raw, 0o600)
            require(read_source(STATE / 'settings.json', installed=True, mode=0o600, bound=16384) == new_raw, 'new_settings_verification_failed')
            require(read_source(STATE / 'receiver-settings.json', installed=True, mode=0o600, bound=16384) == receiver_raw and
                    read_source(REGISTRY, installed=True, mode=0o600, bound=16384) == registry_raw, 'unrelated_metadata_changed')
            for name, pin in plan['immutable'].items():
                require(sha(read_source(LIB / name, installed=True)) == pin, 'immutable_runtime_asset_changed')
            for name, entry in plan['files'].items():
                require(sha(read_source(LIB / name, installed=True)) == entry['sha256'], 'new_operator_verification_failed')
            require(ready(receiver) == before and snapshot(receiver, settings) == runtime, 'backend_or_runtime_changed_during_upgrade')
            result = {'schema': 'teacher-operator-upgrade-receipt/1', 'status': 'teacher_operators_upgraded',
                      'manifest_sha256': expected, 'current': before['current'], 'runtime_snapshot_sha256': sha(json.dumps(runtime, sort_keys=True).encode()),
                      'settings_before_sha256': sha(settings_raw), 'settings_after_sha256': sha(new_raw), 'registry_sha256': sha(registry_raw),
                      'operators_changed': sorted(REPLACE | CREATE), 'immutable_assets_verified': sorted(IMMUTABLE),
                      'application_restarted': False, 'deployment_requested': False, 'SQL_writes': 0, 'provider_calls': 0,
                      'runtime_activated': False, 'automatic_retry_allowed': False}
            exclusive(record / 'receipt.json', (json.dumps(result, sort_keys=True) + '\n').encode())
            return result
        except Exception as error:
            code = str(error) if isinstance(error, ValueError) and re.fullmatch('[a-zA-Z0-9_]{1,100}', str(error)) else 'private_reconciliation_required'
            if not (record / 'failure.json').exists():
                exclusive(record / 'failure.json', (json.dumps({'error_code': code, 'preserve_state': True, 'automatic_retry_allowed': False}) + '\n').encode())
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--bundle', type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--manifest-sha256')
    args = parser.parse_args()
    if not args.execute:
        print(json.dumps({'inert': True, 'production_writes': 0, 'provider_calls': 0}))
        return
    require(args.bundle and args.manifest and args.manifest_sha256, 'reviewed_explicit_inputs_required')
    print(json.dumps(upgrade(args.bundle, args.manifest, args.manifest_sha256)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[a-zA-Z0-9_]{1,100}', str(error)) else 'teacher_operator_upgrade_requires_private_reconciliation'
        print(json.dumps({'status': 'failed', 'error_code': code, 'preserve_state': True, 'automatic_retry_allowed': False,
                          'application_restarted': False, 'deployment_requested': False, 'provider_calls': 0}))
        raise SystemExit(1) from None
