#!/usr/bin/env python3
"""Apply the reviewed initial API proxy after a fresh root attestation of off-host isolated restore."""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

SITE = Path('/etc/nginx/sites-available/nodia-api.conf')
ENABLED = Path('/etc/nginx/sites-enabled/nodia-api.conf')
STATE = Path('/var/lib/nodia-https/proxy')
RESTORE = Path('/var/lib/nodia-backend-setup/restore-verification.json')
SOURCE_SHA = 'f01b493336883403a84b1c80759ce4fc43cbd370'
TREE_SHA = 'ff33b6fdbbbc05167745da9c2fde5f3d19355baf51d51214bbc7121cb6ea1e6f'
BASELINE_SHA = '450e70cd4f812275051a6161f76366f6e0379a4667ee1fe64b459697b2183509'
HEX = re.compile(r'^[a-f0-9]{64}$')
IP = '166.0.112.187'


def require(condition, code):
    if not condition:
        raise ValueError(code)


def unique_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate_json_key')
            result[key] = value
        return result
    return json.loads(data, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('non_finite_json')))


def validate_restore(value, *, now=None):
    """Trust root's explicit off-host test attestation; this does not re-run that Docker restore."""
    keys = {'schema_version', 'status', 'source_sha', 'package_tree_sha256', 'backup_id', 'cipher_sha256',
            'restore_receipt_sha256', 'data_fingerprint_matched', 'migrations_verified', 'entity_tables_verified',
            'quarantine_prepare_verified', 'source_database_restored', 'evidence_origin', 'operator_attestation', 'verified_at_utc'}
    require(isinstance(value, dict) and set(value) == keys and type(value['schema_version']) is int and value['schema_version'] == 1 and
            value['status'] == 'verified_isolated_restore' and value['source_sha'] == SOURCE_SHA and
            value['package_tree_sha256'] == TREE_SHA and value['data_fingerprint_matched'] is True and
            type(value['migrations_verified']) is int and value['migrations_verified'] == 45 and
            type(value['entity_tables_verified']) is int and value['entity_tables_verified'] == 68 and
            value['quarantine_prepare_verified'] is True and value['source_database_restored'] is False and
            value['evidence_origin'] == 'offhost_isolated_docker_restore' and value['operator_attestation'] is True,
            'restore_attestation_gates_missing')
    require(isinstance(value['backup_id'], str) and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', value['backup_id']) and
            isinstance(value['cipher_sha256'], str) and HEX.fullmatch(value['cipher_sha256']) and
            isinstance(value['restore_receipt_sha256'], str) and HEX.fullmatch(value['restore_receipt_sha256']), 'restore_attestation_identity_invalid')
    require(isinstance(value['verified_at_utc'], str), 'restore_attestation_time_invalid')
    checked = datetime.datetime.fromisoformat(value['verified_at_utc'].replace('Z', '+00:00'))
    require(checked.tzinfo is not None and checked.utcoffset() == datetime.timedelta(0), 'restore_attestation_time_invalid')
    age = ((now or datetime.datetime.now(datetime.timezone.utc)) - checked).total_seconds()
    require(0 <= age < 24 * 60 * 60, 'restore_attestation_stale_or_future')
    return value


def existing_site_reviewed(original_hash, candidate_hash):
    require(original_hash in (BASELINE_SHA, candidate_hash), 'existing_site_not_reviewed_baseline')
    return original_hash == candidate_hash


def protected_directory(directory):
    require(directory.resolve(strict=True) == directory, 'symlinked_directory')
    for entry in (directory, *directory.parents):
        info = entry.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == info.st_gid == 0 and not info.st_mode & 0o022, 'unsafe_directory')


def protected_file(filename, mode=0o644):
    protected_directory(filename.parent)
    info = filename.lstat()
    require(filename.resolve(strict=True) == filename and stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0 and
            info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == mode, 'unsafe_file')
    return info


def atomic_write(filename, data, mode):
    descriptor, temporary = tempfile.mkstemp(prefix='.nodia-proxy-', dir=filename.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(data)
            os.fchmod(stream.fileno(), mode)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, filename)
        parent = os.open(filename.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(parent)
        finally:
            os.close(parent)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def command(arguments):
    result = subprocess.run(arguments, capture_output=True, timeout=20, check=False)
    target = STATE / 'nginx-operator.log'
    if target.exists() or target.is_symlink():
        protected_file(target, 0o600)
    descriptor = os.open(target, os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'ab') as log:
        log.write(result.stdout + result.stderr)
    require(result.returncode == 0, 'nginx_command_failed')


def validate_enabled_site():
    protected_directory(ENABLED.parent)
    require(set(path.name for path in ENABLED.parent.iterdir()) == {ENABLED.name}, 'unexpected_enabled_site')
    info = ENABLED.lstat()
    require(stat.S_ISLNK(info.st_mode) and info.st_uid == info.st_gid == 0 and info.st_nlink == 1 and os.readlink(ENABLED) == str(SITE),
            'enabled_site_link_mismatch')


def validate_writers():
    current = Path('/opt/nodia/current')
    require(current.is_symlink() and current.lstat().st_uid == current.lstat().st_gid == 0, 'current_link_not_owned')
    root = current.resolve(strict=True)
    protected_directory(root)
    manifest = root / 'release-manifest.json'
    protected_file(manifest)
    require(manifest.stat().st_size <= 8 * 1024 * 1024, 'release_manifest_too_large')
    value = unique_json(manifest.read_bytes())
    require(value.get('source_sha') == SOURCE_SHA and value.get('package_tree_sha256') == TREE_SHA and
            value.get('deployment_eligible') is True, 'adopted_release_mismatch')
    for unit in ('nodia-api.service', 'nodia-ai-worker.service'):
        result = subprocess.run(['systemctl', 'show', unit, '--property=ActiveState,MainPID', '--no-pager'], capture_output=True, text=True, timeout=10, check=True)
        fields = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
        pid = int(fields.get('MainPID', '0'))
        require(fields.get('ActiveState') == 'active' and pid > 0 and Path(f'/proc/{pid}').stat().st_uid == 900 and
                Path(f'/proc/{pid}/cwd').resolve(strict=True) == root, 'application_writers_not_ready')
        if unit == 'nodia-api.service':
            with open(f'/proc/{pid}/environ', 'rb') as source:
                environment = source.read(1024 * 1024 + 1)
            require(len(environment) <= 1024 * 1024, 'api_environment_too_large')
            settings = [item.removeprefix(b'TRUST_PROXY=') for item in environment.split(b'\0') if item.startswith(b'TRUST_PROXY=')]
            require(len(settings) == 1 and [part.strip() for part in settings[0].decode().split(',')] == ['127.0.0.1', '::1'], 'api_trust_proxy_mismatch')


def check_http(url, code, body=None, *, location=None):
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, file, status, message, headers, target):
            return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        response = opener.open(url, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        observed = response.read(4096)
        require(response.status == code and (body is None or observed == body) and
                (location is None or response.headers.get('Location') == location), 'proxy_transport_probe_failed')


def apply_candidate(previous, candidate, *, write, test, reload, probe):
    """Rollback both on-disk configuration and running proxy after a failed change."""
    try:
        write(candidate)
        test()
        reload()
        probe()
    except Exception as original:
        try:
            write(previous)
            test()
            reload()
        except Exception as rollback:
            raise ValueError('proxy_change_failed_rollback_incomplete') from rollback
        raise ValueError('proxy_change_failed_previous_site_restored') from original


def await_read_only_probe(probe, *, sleep=time.sleep, attempts=12):
    # A successful reload signal can precede new workers accepting their first request.
    # Only the fixed GET transport probes are retried; no application write is replayed.
    for attempt in range(attempts):
        try:
            probe()
            return
        except (ValueError, urllib.error.URLError, TimeoutError):
            if attempt == attempts - 1:
                raise
            sleep(0.25)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-sha256', required=True)
    parser.add_argument('--candidate-sha256', required=True)
    args = parser.parse_args(argv)
    require(sys.platform == 'linux' and os.geteuid() == 0, 'root_linux_required')
    os.umask(0o077)
    require(args.baseline_sha256 == BASELINE_SHA and HEX.fullmatch(args.candidate_sha256), 'reviewed_hashes_required')
    protected_directory(STATE.parent)
    if not STATE.exists() and not STATE.is_symlink():
        STATE.mkdir(mode=0o700)
    protected_directory(STATE)
    require(stat.S_IMODE(STATE.stat().st_mode) == 0o700, 'proxy_state_must_be_private')
    descriptor = os.open(STATE / 'setup.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'a') as lock:
        protected_file(STATE / 'setup.lock', 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        info = protected_file(RESTORE)
        require(info.st_size <= 65536, 'restore_attestation_too_large')
        restore = validate_restore(unique_json(RESTORE.read_bytes()))
        validate_enabled_site()
        protected_file(SITE)
        original = SITE.read_bytes()
        original_hash = hashlib.sha256(original).hexdigest()
        existing_site_reviewed(original_hash, args.candidate_sha256)
        source = Path(__file__).resolve().parent / 'nodia-api.nginx.conf'
        descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(descriptor, 'rb') as stream:
            require(stat.S_ISREG(os.fstat(stream.fileno()).st_mode), 'candidate_regular_file_required')
            candidate = stream.read(65537)
        require(len(candidate) <= 65536 and hashlib.sha256(candidate).hexdigest() == args.candidate_sha256, 'candidate_digest_mismatch')
        validate_writers()
        command(['nginx', '-t'])
        require(subprocess.run(['systemctl', 'is-active', '--quiet', 'nginx'], timeout=10, check=False).returncode == 0, 'nginx_not_active')
        check_http('http://127.0.0.1:3000/api/v1', 200, b'Hello World!')
        backup = STATE / f'baseline-{BASELINE_SHA}.conf'
        if original_hash == BASELINE_SHA:
            if backup.exists() or backup.is_symlink():
                protected_file(backup, 0o600)
                require(backup.read_bytes() == original, 'baseline_backup_mismatch')
            else:
                atomic_write(backup, original, 0o600)
        def probe():
            check_http(f'http://{IP}/', 308, location=f'https://{IP}/')
            check_http(f'https://{IP}/tls-check', 200, b'nodia-https-ok\n')
            check_http(f'https://{IP}/api/v1', 200, b'Hello World!')
            check_http(f'https://{IP}/', 404)
            check_http(f'https://{IP}/api/v10', 404)
        if original_hash != args.candidate_sha256:
            validate_restore(restore)
            apply_candidate(original, candidate, write=lambda data: atomic_write(SITE, data, 0o644),
                            test=lambda: command(['nginx', '-t']), reload=lambda: command(['systemctl', 'reload', 'nginx']),
                            probe=lambda: await_read_only_probe(probe))
        else:
            probe()
        status = {'schema_version': 1, 'status': 'proxy_configured_transport_verified', 'source_sha': SOURCE_SHA,
                  'package_tree_sha256': TREE_SHA, 'candidate_sha256': args.candidate_sha256,
                  'restore_receipt_sha256': restore['restore_receipt_sha256'], 'restore_evidence_origin': restore['evidence_origin'],
                  'operator_restore_attestation': True, 'business_or_provider_readiness_claimed': False,
                  'frontend_oauth_cookies_verified': False, 'port_3000_opened': False,
                  'updated_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        atomic_write(STATE.parent / 'proxy-status.json', (json.dumps(status, indent=2) + '\n').encode(), 0o644)
        print('[Nodia API proxy] complete: HTTPS API transport verified; frontend auth and feature qualification remain separate.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'proxy_preparation_or_apply_failed'
        print(f'[Nodia API proxy] failed: {code}. Inspect protected operator logs; no application start or firewall change requested.', file=sys.stderr)
        sys.exit(1)
