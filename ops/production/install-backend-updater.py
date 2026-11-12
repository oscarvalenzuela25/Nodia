#!/usr/bin/env python3
"""Prepare a reviewed updater bundle or install it as operator. Never performs an update."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile

ASSETS = ('update-backend.py', 'backend_update.py', 'update-backend-action.mjs',
          'stage-backend-candidate.py', 'probe-backend-dependencies.mjs')
UNITS = ('nodia-api.service', 'nodia-ai-worker.service', 'nodia-ai-backup.service',
         'nodia-ai-backup-rotate.service', 'nodia-ai-journal-reconcile.service',
         'nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer')
LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
SITE = Path('/etc/nginx/sites-available/nodia-api.conf')
SNIPPET = Path('/etc/nginx/snippets/nodia-update-maintenance.conf')
HOOK = b'if (-f /var/lib/nodia-maintenance/backend) { return 503; }\n'
NEEDLE = b'    location ~ ^/api/v1(?:/|$) {\n'
INCLUDE = b'        include /etc/nginx/snippets/nodia-update-maintenance.conf;\n'


def require(condition, code):
    if not condition: raise ValueError(code)


def sha(value): return hashlib.sha256(value).hexdigest()


def site_with_hook(original):
    require(original.count(NEEDLE) == 1 and INCLUDE not in original and
            b'/var/lib/nodia-maintenance/' not in original, 'reviewed_api_location_required')
    return original.replace(NEEDLE, NEEDLE + INCLUDE)


def prepare(output):
    source = Path(__file__).resolve().parent
    require(not output.exists(), 'bundle_destination_already_exists')
    output.mkdir(parents=True, mode=0o700)
    names = (*ASSETS, *UNITS, 'nodia-api.nginx.conf', 'install-backend-updater.py')
    files = {}
    for name in names:
        path = source / name
        require(path.is_file() and not path.is_symlink(), 'bundle_source_invalid')
        content = path.read_bytes()
        require(b'\r' not in content, 'bundle_source_requires_lf')
        (output / name).write_bytes(content)
        files[name] = sha(content)
    manifest = (json.dumps({'schema_version': 1, 'purpose': 'operator_backend_updater', 'files': files},
                          sort_keys=True, indent=2) + '\n').encode()
    (output / 'updater-bundle.json').write_bytes(manifest)
    return {'status': 'prepared', 'bundle_manifest_sha256': sha(manifest),
            'assets': len(files), 'services_changed': False, 'deployment_performed': False}


def safe_directory(path):
    current = Path('/')
    for part in path.parts[1:]:
        current /= part
        if not current.exists() and not current.is_symlink():
            current.mkdir(mode=0o700); current.chmod(0o755)
        info = current.lstat()
        require(stat.S_ISDIR(info.st_mode) and current.resolve(strict=True) == current and
                info.st_uid == info.st_gid == 0 and not info.st_mode & 0o022, 'unsafe_install_directory')


def exact_install(path, data, mode=0o644):
    if path.exists() or path.is_symlink():
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0 and info.st_nlink == 1 and
                stat.S_IMODE(info.st_mode) == mode and path.read_bytes() == data, 'installed_asset_conflict')
        return
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, mode)
    with os.fdopen(descriptor, 'wb') as stream:
        os.fchmod(stream.fileno(), mode); stream.write(data); stream.flush(); os.fsync(stream.fileno())


def replace_site(data):
    descriptor, name = tempfile.mkstemp(prefix='.updater-site-', dir=SITE.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            os.fchmod(stream.fileno(), 0o644); stream.write(data); stream.flush(); os.fsync(stream.fileno())
        os.replace(name, SITE)
    finally:
        if os.path.exists(name): os.unlink(name)


def install(bundle, digest):
    require(os.geteuid() == 0, 'root_required')
    os.umask(0o077)
    raw = (bundle / 'updater-bundle.json').read_bytes()
    require(sha(raw) == digest, 'reviewed_bundle_digest_required')
    value = json.loads(raw)
    names = set((*ASSETS, *UNITS, 'nodia-api.nginx.conf', 'install-backend-updater.py'))
    require(value.get('schema_version') == 1 and value.get('purpose') == 'operator_backend_updater' and
            set(value.get('files', {})) == names, 'bundle_manifest_invalid')
    contents = {}
    for name, expected in value['files'].items():
        source = bundle / name
        require(source.is_file() and not source.is_symlink() and source.stat().st_size < 256 * 1024,
                'bundle_asset_invalid')
        content = source.read_bytes()
        require(sha(content) == expected, 'bundle_asset_hash_mismatch')
        contents[name] = content
    original = contents['nodia-api.nginx.conf']
    wanted = site_with_hook(original)
    for path in (LIB, STATE, STATE / 'attempts', STATE / 'requests', SNIPPET.parent, SITE.parent,
                 Path('/etc/nginx/sites-enabled'), Path('/var/lib/nodia-maintenance')):
        safe_directory(path)
    for path in (STATE, STATE / 'attempts', STATE / 'requests'): path.chmod(0o700)
    require(not Path('/var/lib/nodia-maintenance/backend').exists(), 'maintenance_already_active')
    require(SITE.is_file() and not SITE.is_symlink() and SITE.read_bytes() in (original, wanted),
            'installed_proxy_not_reviewed_baseline')
    site_info = SITE.lstat()
    require(site_info.st_uid == site_info.st_gid == 0 and site_info.st_nlink == 1 and
            stat.S_IMODE(site_info.st_mode) == 0o644, 'installed_proxy_metadata_invalid')
    enabled = Path('/etc/nginx/sites-enabled/nodia-api.conf')
    require(enabled.is_symlink() and enabled.lstat().st_uid == enabled.lstat().st_gid == 0 and
            enabled.resolve(strict=True) == SITE, 'reviewed_proxy_not_enabled')
    for name in UNITS:
        unit = Path('/etc/systemd/system') / name
        info = unit.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0 and not info.st_mode & 0o022 and
                sha(unit.read_bytes()) == value['files'][name], 'installed_unit_not_reviewed_baseline')
    for name in ASSETS: exact_install(LIB / name, contents[name])
    exact_install(SNIPPET, HOOK)
    settings = {'schema_version': 1, 'bundle_manifest_sha256': digest,
                'assets': {name: value['files'][name] for name in ASSETS},
                'service_hashes': {name: value['files'][name] for name in UNITS},
                'nginx_site_sha256': sha(wanted)}
    exact_install(STATE / 'settings.json', (json.dumps(settings, sort_keys=True, indent=2) + '\n').encode(), 0o600)
    if SITE.read_bytes() != wanted:
        exact_install(STATE / 'nginx-before.conf', original, 0o600)
        subprocess.run(['/usr/sbin/nginx', '-t'], check=True, capture_output=True, timeout=20)
        replace_site(wanted)
        checked = subprocess.run(['/usr/sbin/nginx', '-t'], capture_output=True, timeout=20)
        if checked.returncode:
            replace_site(original)
            raise ValueError('nginx_hook_rejected_original_restored')
        # A reload failure preserves actual configuration and requires operator reconciliation.
        subprocess.run(['/usr/bin/systemctl', 'reload', 'nginx'], check=True, capture_output=True, timeout=20)
    return {'schema_version': 1, 'status': 'operator_updater_installed', 'application_services_restarted': False,
            'ssh_gateway_changed': False, 'sudo_grant_created': False, 'deployment_performed': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare', type=Path)
    parser.add_argument('--install', type=Path)
    parser.add_argument('--manifest-sha256')
    args = parser.parse_args()
    require(bool(args.prepare) != bool(args.install), 'choose_prepare_or_install')
    result = prepare(args.prepare.resolve()) if args.prepare else install(args.install.resolve(), args.manifest_sha256)
    print(json.dumps(result))


if __name__ == '__main__':
    try: main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) else 'updater_install_failed_inspect_operator_state'
        print(json.dumps({'status': 'failed', 'error_code': code, 'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
