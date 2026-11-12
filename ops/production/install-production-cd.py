#!/usr/bin/env python3
"""Prepare/install the reviewed fixed-command CD transport. Never deploys an app."""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import re
import struct
import subprocess
import tempfile

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
RULE = Path('/etc/sudoers.d/nodia-production-cd')
SUDOERS = b'nodia-deploy ALL=(root) NOPASSWD: /usr/bin/python3 -I /usr/local/lib/nodia/deploy-backend-receiver.py\n'
ASSETS = ('deploy-backend-receiver.py', 'deploy-gateway.py', 'install-production-cd.py')


def require(condition, code):
    if not condition: raise ValueError(code)


def sha(data): return hashlib.sha256(data).hexdigest()


def load(path):
    spec = importlib.util.spec_from_file_location('reviewed_' + path.stem.replace('-', '_'), path)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value


def prepare(target):
    require(not target.exists(), 'bundle_destination_already_exists')
    target.mkdir(parents=True, mode=0o700)
    source = Path(__file__).resolve().parent
    updater = load(source / 'install-backend-updater.py')
    nested = updater.prepare(target / 'updater')
    assets = {}
    for name in ASSETS:
        data = (source / name).read_bytes()
        require(b'\r' not in data, 'source_requires_lf')
        (target / name).write_bytes(data); assets[name] = sha(data)
    # Trust exactly the old status-only gateway during a one-time upgrade.
    bootstrap = load(source / 'bootstrap-deploy-identity.py')
    value = {'schema_version': 1, 'purpose': 'nodia-production-cd-transport', 'assets': assets,
             'updater_bundle_sha256': nested['bundle_manifest_sha256'],
             'previous_gateway_sha256': sha(bootstrap.GATEWAY_BYTES)}
    raw = (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()
    (target / 'production-cd-bundle.json').write_bytes(raw)
    return {'schema_version': 1, 'status': 'prepared', 'bundle_manifest_sha256': sha(raw),
            'updater_bundle_sha256': nested['bundle_manifest_sha256'], 'deployment_performed': False,
            'privilege_installed': False}


def install(bundle, digest):
    import pwd
    require(os.geteuid() == 0, 'root_required')
    os.umask(0o077)
    raw = (bundle / 'production-cd-bundle.json').read_bytes()
    require(sha(raw) == digest, 'reviewed_transport_digest_required')
    manifest = json.loads(raw)
    require(manifest.get('schema_version') == 1 and manifest.get('purpose') == 'nodia-production-cd-transport' and
            set(manifest.get('assets', {})) == set(ASSETS), 'invalid_transport_manifest')
    contents = {}
    for name, expected in manifest['assets'].items():
        path = bundle / name
        require(path.is_file() and not path.is_symlink() and path.stat().st_size < 100 * 1024,
                'invalid_transport_asset')
        contents[name] = path.read_bytes()
        require(sha(contents[name]) == expected, 'transport_asset_digest_mismatch')
    # Verify nested installer bytes before importing any of its Python.
    nested_raw = (bundle / 'updater/updater-bundle.json').read_bytes()
    require(sha(nested_raw) == manifest['updater_bundle_sha256'], 'updater_bundle_digest_mismatch')
    nested = json.loads(nested_raw)
    installer_path = bundle / 'updater/install-backend-updater.py'
    require(installer_path.is_file() and not installer_path.is_symlink() and
            sha(installer_path.read_bytes()) == nested['files']['install-backend-updater.py'],
            'updater_installer_digest_mismatch')
    updater = load(installer_path)
    identity = pwd.getpwnam('nodia-deploy')
    require(identity.pw_uid >= 1000 and identity.pw_dir == '/var/lib/nodia-deploy' and
            identity.pw_shell == '/bin/sh', 'prepared_deploy_identity_required')
    require(os.getgrouplist('nodia-deploy', identity.pw_gid) == [identity.pw_gid],
            'deploy_account_has_extra_groups')
    password = subprocess.run(['/usr/bin/passwd', '--status', 'nodia-deploy'], capture_output=True,
                              check=True, text=True, env={**os.environ, 'LC_ALL': 'C'}).stdout.split()
    require(password[:2] == ['nodia-deploy', 'L'], 'deploy_password_not_locked')
    for directory in (Path('/var/lib/nodia-deploy'), Path('/var/lib/nodia-deploy/.ssh'), RULE.parent):
        require(directory.is_dir() and directory.resolve(strict=True) == directory, 'unsafe_identity_directory')
        updater.safe_directory(directory)
    authorized = Path(identity.pw_dir) / '.ssh/authorized_keys'
    metadata = authorized.lstat()
    require(stat.S_ISREG(metadata.st_mode) and metadata.st_uid == metadata.st_gid == 0 and
            stat.S_IMODE(metadata.st_mode) == 0o644 and metadata.st_nlink == 1 and
            authorized.resolve(strict=True) == authorized,
            'restricted_authorized_key_required')
    key = re.fullmatch(rb'restrict,command="/usr/bin/python3 -I /usr/local/lib/nodia/deploy-gateway.py" ssh-ed25519 ([A-Za-z0-9+/=]+) nodia-actions-production\n',
                       authorized.read_bytes())
    require(key is not None, 'single_restricted_authorized_key_required')
    blob = base64.b64decode(key[1], validate=True)
    require(blob.startswith(struct.pack('>I', 11) + b'ssh-ed25519' + struct.pack('>I', 32)) and
            len(blob) == 51 and base64.b64encode(blob) == key[1], 'invalid_identity_ed25519_key')
    marker = Path(identity.pw_dir) / 'identity.json'
    marker_info = marker.lstat()
    require(stat.S_ISREG(marker_info.st_mode) and marker_info.st_uid == marker_info.st_gid == 0 and
            marker_info.st_nlink == 1 and stat.S_IMODE(marker_info.st_mode) == 0o644 and
            marker.resolve(strict=True) == marker and marker_info.st_size < 1024, 'invalid_identity_marker')
    marker_value = json.loads(marker.read_bytes())
    fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip('=')
    require(marker_value == {'schema_version': 1, 'purpose': 'nodia-actions-ssh-identity',
                             'public_key_fingerprint': fingerprint}, 'identity_marker_mismatch')
    gateway = LIB / 'deploy-gateway.py'
    info = gateway.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0 and info.st_nlink == 1 and
            stat.S_IMODE(info.st_mode) == 0o755 and sha(gateway.read_bytes()) in
            (manifest['previous_gateway_sha256'], manifest['assets']['deploy-gateway.py']),
            'unreviewed_existing_gateway')
    # No overwrite of existing unmanaged sudo rule. Validate exact command rule first.
    if RULE.exists() or RULE.is_symlink():
        info = RULE.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0 and
                stat.S_IMODE(info.st_mode) == 0o440 and RULE.read_bytes() == SUDOERS, 'sudo_rule_conflict')
    descriptor, tempname = tempfile.mkstemp(prefix='nodia-sudoers-', dir='/run')
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            os.fchmod(stream.fileno(), 0o440); stream.write(SUDOERS)
        subprocess.run(['/usr/sbin/visudo', '-cf', tempname], capture_output=True, check=True, timeout=20)
    finally: os.unlink(tempname)
    updater.install(bundle / 'updater', manifest['updater_bundle_sha256'])
    for directory in (STATE / 'incoming', STATE / 'submissions'):
        updater.safe_directory(directory); directory.chmod(0o700)
    updater.exact_install(STATE / 'receiver.lock', b'', 0o600)
    updater.exact_install(LIB / 'deploy-backend-receiver.py', contents['deploy-backend-receiver.py'])
    receiver_settings = {'schema_version': 1, 'assets': {name: manifest['assets'][name]
                         for name in ('deploy-backend-receiver.py', 'deploy-gateway.py')}}
    updater.exact_install(STATE / 'receiver-settings.json',
                          (json.dumps(receiver_settings, sort_keys=True, indent=2) + '\n').encode(), 0o600)
    # Grant fixed argv only; header parsing and enum validation live in root-owned code.
    updater.exact_install(RULE, SUDOERS, 0o440)
    subprocess.run(['/usr/sbin/visudo', '-c'], capture_output=True, check=True, timeout=20)
    if gateway.read_bytes() != contents['deploy-gateway.py']:
        descriptor, temporary = tempfile.mkstemp(prefix='.nodia-gateway-', dir=LIB)
        try:
            with os.fdopen(descriptor, 'wb') as stream:
                os.fchmod(stream.fileno(), 0o755); stream.write(contents['deploy-gateway.py'])
                stream.flush(); os.fsync(stream.fileno())
            os.replace(temporary, gateway)
        finally:
            if os.path.exists(temporary): os.unlink(temporary)
    return {'schema_version': 1, 'status': 'production_cd_transport_installed',
            'fixed_command_sudo_grant_created': True, 'arbitrary_shell_enabled': False,
            'application_services_restarted': False, 'deployment_performed': False,
            'new_ssh_connection_verified': False}


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
        code = str(error) if isinstance(error, ValueError) else 'transport_install_failed_inspect_private_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
