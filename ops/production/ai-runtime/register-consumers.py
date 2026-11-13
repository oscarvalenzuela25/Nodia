"""Register only the reviewed runtime extensions with the installed CD guard.

No app change/restart, database, network, account or deployment is requested.
The operator must first install the compatible reviewed updater source.
"""
import fcntl
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


def register():
    if sys.platform != 'linux' or os.geteuid() != 0 or sys.argv[1:]:
        raise RuntimeError('linux_root_no_arguments_required')
    host_module = load('host', LIB / 'update-backend.py')
    safe = load('safe', LIB / 'ai-runtime/codex-provision.py')
    settings = host_module.unique_json(safe.read_regular(STATE / 'settings.json', 0o600))
    if not hasattr(host_module, 'AI_RUNTIME_HASHES'):
        raise RuntimeError('compatible_updater_required')
    for name in ('update-backend.py', 'backend_update.py'):
        if host_module.sha_file(LIB / name) != settings['assets'][name]:
            raise RuntimeError('updater_asset_mismatch')
    policy = load('policy', LIB / 'backend_update.py')
    lock = Path('/var/lib/nodia-backend-setup/installation.lock')
    safe.read_regular(lock, 0o600)
    with lock.open('r+b') as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        value = {'schema_version': 1, 'purpose': 'nodia_ai_runtime_consumers',
                 'units': {name: host_module.AI_RUNTIME_HASHES for name in host_module.SERVICES}}
        host_module.ai_runtime_registry(value)
        host = host_module.Host(policy, None, settings)
        for name in host_module.SERVICES:
            parent = host_module.SYSTEMD_UNITS / (name + '.d')
            host_module.protected(parent, directory=True)
            if {p.name for p in parent.iterdir()} != set(host_module.AI_RUNTIME_TEMPLATES):
                raise RuntimeError('unexpected_dropin_inventory')
            for filename, contents in host_module.AI_RUNTIME_TEMPLATES.items():
                if safe.read_regular(parent / filename, 0o644) != contents:
                    raise RuntimeError('unreviewed_dropin')
        # This is metadata only; the guard still hardcodes the reviewed bytes.
        raw = (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()
        safe.install_file(host_module.AI_CONSUMERS, raw, 0o600)
        for name, digest in settings['service_hashes'].items():
            path = host_module.SYSTEMD_UNITS / name
            host_module.protected(path, mode=0o644)
            policy.require(host_module.sha_file(path) == digest, 'base_unit_hash_changed')
            host.service_overrides(name, host.show(name))
        return {'schema_version': 1, 'status': 'runtime_consumers_verified',
                'registry_sha256': host_module.sha_file(host_module.AI_CONSUMERS),
                'reviewed_dropin_files': 4, 'base_units_unchanged': True,
                'application_restarted': False, 'deployment_requested': False}


if __name__ == '__main__':
    try:
        print(json.dumps(register()))
    except Exception:
        print(json.dumps({'status': 'failed', 'error_code': 'runtime_consumer_registration_failed',
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
