"""Register only the reviewed runtime extensions with the installed CD guard.

No app change/restart, database, network, account or deployment is requested.
The operator must first install the compatible reviewed updater source.
"""
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def register(*, lock_held=False):
    if sys.platform != 'linux' or os.geteuid() != 0:
        raise RuntimeError('linux_root_no_arguments_required')
    host_module = load('host', LIB / 'update-backend.py')
    safe = load('safe', LIB / 'ai-runtime/codex-provision.py')
    settings = host_module.unique_json(safe.read_regular(STATE / 'settings.json', 0o600))
    if not all(hasattr(host_module, name) for name in (
            'AI_RUNTIME_HASHES', 'TEACHER_RUNTIME_NAME', 'TEACHER_RUNTIME_TEMPLATE', 'teacher_runtime_descriptor',
            'CODEX_CV_ACTIVE', 'CODEX_CV_ENVIRONMENT', 'CODEX_CV_RUNTIME_NAME',
            'CODEX_CV_RUNTIME_TEMPLATE', 'codex_cv_runtime_descriptor')):
        raise RuntimeError('compatible_updater_required')
    for name in ('update-backend.py', 'backend_update.py'):
        if host_module.sha_file(LIB / name) != settings['assets'][name]:
            raise RuntimeError('updater_asset_mismatch')
    policy = load('policy', LIB / 'backend_update.py')
    lock = Path('/var/lib/nodia-backend-setup/installation.lock')
    safe.read_regular(lock, 0o600)
    with lock.open('r+b') as handle:
        if not lock_held:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        value = {'schema_version': 1, 'purpose': 'nodia_ai_runtime_consumers',
                 'units': {name: host_module.AI_RUNTIME_HASHES for name in host_module.SERVICES}}
        templates = dict(host_module.AI_RUNTIME_TEMPLATES)
        optional = [host_module.SYSTEMD_UNITS / (name + '.d') / host_module.TEACHER_RUNTIME_NAME
                    for name in host_module.SERVICES]
        if any(path.exists() or path.is_symlink() for path in optional):
            value['teacher_host'] = host_module.teacher_runtime_descriptor()
            templates[host_module.TEACHER_RUNTIME_NAME] = host_module.TEACHER_RUNTIME_TEMPLATE
        cv = (host_module.CODEX_CV_ACTIVE, host_module.CODEX_CV_ENVIRONMENT,
              *(host_module.SYSTEMD_UNITS / (name + '.d') / host_module.CODEX_CV_RUNTIME_NAME
                for name in host_module.SERVICES))
        if any(path.exists() or path.is_symlink() for path in cv):
            value['codex_cv_runtime'] = host_module.codex_cv_runtime_descriptor()
            templates[host_module.CODEX_CV_RUNTIME_NAME] = host_module.CODEX_CV_RUNTIME_TEMPLATE
        hashes = {name: hashlib.sha256(raw).hexdigest() for name, raw in templates.items()}
        value['units'] = {name: hashes for name in host_module.SERVICES}
        host_module.ai_runtime_registry(value)
        host = host_module.Host(policy, None, settings)
        for name in host_module.SERVICES:
            parent = host_module.SYSTEMD_UNITS / (name + '.d')
            host_module.protected(parent, directory=True)
            if {p.name for p in parent.iterdir()} != set(templates):
                raise RuntimeError('unexpected_dropin_inventory')
            for filename, contents in templates.items():
                if safe.read_regular(parent / filename, 0o644) != contents:
                    raise RuntimeError('unreviewed_dropin')
        # This is metadata only; the guard still hardcodes the reviewed bytes.
        raw = (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()
        for name, digest in settings['service_hashes'].items():
            path = host_module.SYSTEMD_UNITS / name
            host_module.protected(path, mode=0o644)
            policy.require(host_module.sha_file(path) == digest, 'base_unit_hash_changed')
        if host_module.AI_CONSUMERS.exists() or host_module.AI_CONSUMERS.is_symlink():
            previous_raw = safe.read_regular(host_module.AI_CONSUMERS, 0o600)
            previous = host_module.ai_runtime_registry(host_module.unique_json(previous_raw))
            if previous_raw != raw:
                current_lanes = set(previous) & {'teacher_host', 'codex_cv_runtime'}
                requested_lanes = set(value) & {'teacher_host', 'codex_cv_runtime'}
                if not current_lanes < requested_lanes or any(previous[key] != value[key] for key in current_lanes):
                    raise RuntimeError('runtime_consumer_replacement_not_allowed')
                # Never overwrite an existing host or remove a lane.
                host_module.atomic_write(host_module.AI_CONSUMERS, raw)
        else:
            safe.install_file(host_module.AI_CONSUMERS, raw, 0o600)
        for name in settings['service_hashes']:
            host.service_overrides(name, host.show(name))
        return {'schema_version': 1, 'status': 'runtime_consumers_verified',
                'registry_sha256': host_module.sha_file(host_module.AI_CONSUMERS),
                'reviewed_dropin_files': len(templates) * len(host_module.SERVICES), 'base_units_unchanged': True,
                'application_restarted': False, 'deployment_requested': False}


if __name__ == '__main__':
    try:
        if sys.argv[1:]:
            raise RuntimeError('no_arguments_required')
        print(json.dumps(register()))
    except Exception:
        print(json.dumps({'status': 'failed', 'error_code': 'runtime_consumer_registration_failed',
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
