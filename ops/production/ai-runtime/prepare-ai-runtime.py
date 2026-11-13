"""Prepare verified login infrastructure without activating/restarting the app.

The manifest digest is provided out of band by the operator. Source/configuration
is copied to root-owned paths before execution; private runtime.env is never
sourced or passed wholesale to Docker. Repeating a different partial installation
is rejected. No application release, PostgreSQL data, profile or SSH rule changes.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tarfile

ROOT = Path('/usr/local/lib/nodia/ai-runtime')
CONFIG = Path('/etc/nodia/ai-runtime')
STATE = Path('/var/lib/nodia-ai-runtime-setup')


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_input(path, maximum=10485760):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size <= maximum,
                'unsafe_bundle_input')
        data = stream.read(maximum + 1)
    require(len(data) <= maximum, 'bundle_input_too_large')
    return data


def verified_bundle(directory, digest):
    require(re.fullmatch('[a-f0-9]{64}', digest) is not None, 'manifest_digest_invalid')
    raw = read_input(directory / 'manifest.json', 65536)
    require(hashlib.sha256(raw).hexdigest() == digest, 'manifest_digest_mismatch')
    manifest = json.loads(raw)
    require(set(manifest) == {'schema_version', 'source_sha', 'files'} and manifest['schema_version'] == 1
            and re.fullmatch('[a-f0-9]{40}', manifest['source_sha']) is not None
            and type(manifest['files']) is dict and 6 <= len(manifest['files']) <= 32, 'manifest_invalid')
    payloads = {}
    for name, expected in manifest['files'].items():
        require(re.fullmatch('[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}', name) is not None
                and re.fullmatch('[a-f0-9]{64}', expected) is not None, 'manifest_path_invalid')
        payload = read_input(directory / name)
        require(hashlib.sha256(payload).hexdigest() == expected, 'bundle_digest_mismatch')
        payloads[name] = payload
    required = {'codex-provision.py', 'codex-keyring.py', 'codex-bus.service', 'codex-bus.conf', 'codex-keyring.service',
                'codex-runtime.conf', 'gemini-host.py', 'nodia-gemini.service', 'attach-login-cgroup.py',
                'native-context.tar.gz', 'activate-ai-runtime.py', 'runtime-preflight.mjs',
                'codex-native-probe.mjs', 'update-backend-action.mjs', 'verify-gemini-host.py',
                'verify-login-cgroup-host.py', 'register-consumers.py'}
    require(required <= payloads.keys(), 'bundle_incomplete')
    return manifest, payloads


def archive_members(package):
    members = package.getmembers()
    require(len(members) <= 2500 and sum(member.size for member in members) <= 30 * 1048576,
            'native_context_too_large')
    names = set()
    for member in members:
        path = PurePosixPath(member.name)
        require(not path.is_absolute() and '..' not in path.parts and member.name not in names
                and (member.isdir() or member.isfile()) and not member.islnk() and not member.issym()
                and not any(part in {'.env', 'session_state', 'agentic_profile', '.git', '.venv'} for part in path.parts),
                'native_context_unsafe')
        names.add(member.name)
    require('Dockerfile' in names and 'antigravity-cli.lock.json' in names, 'native_context_incomplete')
    return members


def service_token(raw):
    lines = [line for line in raw.decode('utf-8').splitlines() if line.startswith('GEMINI_SERVICE_TOKEN=')]
    require(len(lines) == 1, 'backend_service_token_invalid')
    match = re.fullmatch(r'GEMINI_SERVICE_TOKEN=(?:"([a-fA-F0-9]{64})"|([a-fA-F0-9]{64}))', lines[0])
    require(match is not None, 'backend_service_token_invalid')
    return match.group(1) or match.group(2)


def create_root_directory(path, mode):
    if path.exists() or path.is_symlink():
        info = path.lstat()
        require(stat.S_ISDIR(info.st_mode) and not path.is_symlink() and info.st_uid == 0
                and stat.S_IMODE(info.st_mode) == mode, 'unsafe_setup_directory_mode')
    else:
        path.mkdir(mode=mode)
        # Preparation deliberately uses umask0077; public operator code must
        # still be readable by the non-root service identity.
        os.chmod(path, mode)


def command(arguments, seconds=60, log=None):
    environment = {**os.environ, 'DEBIAN_FRONTEND': 'noninteractive', 'NEEDRESTART_MODE': 'l'}
    if log:
        with log.open('ab') as output:
            result = subprocess.run(arguments, stdout=output, stderr=output, stdin=subprocess.DEVNULL,
                                    timeout=seconds, check=False, env=environment)
    else:
        result = subprocess.run(arguments, capture_output=True, stdin=subprocess.DEVNULL,
                                timeout=seconds, check=False, env=environment)
    require(result.returncode == 0, 'operator_command_failed')
    return result.stdout.decode().strip() if not log else ''


def prepare(directory, digest):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_root_required')
    os.umask(0o077)
    manifest, payloads = verified_bundle(directory, digest)
    # Bootstrap the checked filesystem helper from verified bytes, before executing it.
    # System paths and every existing parent must be root-owned and non-writable.
    for base in (Path('/usr/local/lib'), Path('/etc'), Path('/var/lib')):
        for path in [base, *base.parents]:
            info = path.lstat()
            require(stat.S_ISDIR(info.st_mode) and not path.is_symlink() and info.st_uid == 0
                    and not info.st_mode & 0o022, 'unsafe_system_path')
    for path in (Path('/usr/local/lib/nodia'), ROOT, STATE):
        create_root_directory(path, 0o700 if path == STATE else 0o755)
    provision = ROOT / 'codex-provision.py'
    if provision.exists() or provision.is_symlink():
        require(not provision.is_symlink() and provision.stat().st_uid == 0
                and not provision.stat().st_mode & 0o022
                and read_input(provision) == payloads['codex-provision.py'], 'existing_provision_conflict')
    else:
        with provision.open('xb') as output:
            os.fchmod(output.fileno(), 0o644)
            output.write(payloads['codex-provision.py'])
            output.flush(); os.fsync(output.fileno())
    safe = load_module(provision, 'codex_provision')
    require(safe.read_regular(ROOT.parent / 'update-backend-action.mjs', 0o644) == payloads['update-backend-action.mjs'],
            'installed_quiescence_contract_mismatch')
    safe.make_directory(CONFIG, mode=0o700)
    for name, data in payloads.items():
        safe.install_file(ROOT / name, data, 0o644)
    safe.install_file(CONFIG / 'bundle-manifest.json', read_input(directory / 'manifest.json', 65536), 0o600)
    log = STATE / 'prepare.log'
    if log.exists():
        require(safe.checked(log, mode=0o600), 'private_log_unsafe')
    else:
        safe.install_file(log, b'', 0o600)
    print('[Nodia AI runtime] installing_keyring_dependencies', flush=True)
    command(['apt-get', 'update'], 180, log)
    command(['apt-get', '-o', 'Dpkg::Use-Pty=0', 'install', '-y', '--no-install-recommends',
             'gnome-keyring', 'python3-dbus'], 600, log)
    safe.prepare()
    runtime = Path('/etc/nodia/runtime.env')
    raw = safe.read_regular(runtime, 0o600)
    require(not any(line.startswith(('NODIA_CODEX_ENABLED=', 'DBUS_SESSION_BUS_ADDRESS=', 'XDG_RUNTIME_DIR='))
                    for line in raw.decode().splitlines()), 'runtime_override_conflict')
    safe.install_file(CONFIG / 'gemini.env', ('GEMINI_SERVICE_TOKEN=' + service_token(raw) + '\n').encode(), 0o600)
    for path in (Path('/var/lib/nodia-gemini'), Path('/var/lib/nodia-gemini/session_state'), Path('/var/lib/nodia-gemini/profile')):
        # This private tree belongs to the container UID, not the backend user.
        if path.exists() or path.is_symlink():
            info = path.lstat()
            require(stat.S_ISDIR(info.st_mode) and not path.is_symlink() and info.st_uid == 10001
                    and info.st_gid == 10001 and stat.S_IMODE(info.st_mode) == 0o700, 'existing_native_state_conflict')
        else:
            path.mkdir(mode=0o700)
            os.chown(path, 10001, 10001)
    image_config = CONFIG / 'gemini-image.json'
    if not image_config.exists():
        context = STATE / 'native-context'
        safe.make_directory(context, mode=0o700)
        require(not any(context.iterdir()), 'partial_native_context_preserve_state')
        with tarfile.open(ROOT / 'native-context.tar.gz', 'r:gz') as package:
            for member in archive_members(package):
                target = context / member.name
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True, mode=0o755)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                    with package.extractfile(member) as source, target.open('xb') as output:
                        os.fchmod(output.fileno(), 0o755 if member.mode & 0o111 else 0o644)
                        output.write(source.read())
        iid = STATE / 'image.id'
        require(not iid.exists(), 'partial_image_build_preserve_state')
        print('[Nodia AI runtime] building_verified_private_adapter', flush=True)
        command(['docker', 'build', '--iidfile', str(iid), '--tag', 'nodia-antigravity:' + manifest['source_sha'][:12],
                 str(context)], 900, log)
        image = safe.read_regular(iid).decode().strip()
        require(re.fullmatch('sha256:[a-f0-9]{64}', image) is not None, 'built_image_id_invalid')
        safe.install_file(image_config, (json.dumps({'schema_version': 1, 'image_id': image,
                          'source_sha': manifest['source_sha']}) + '\n').encode(), 0o600)
    else:
        image = json.loads(safe.read_regular(image_config, 0o600))['image_id']
    command(['docker', 'run', '--rm', '--network', 'none', image, 'python', '-m', 'pip', 'check'], 60, log)
    safe.install_file(Path('/etc/systemd/system/nodia-gemini.service'), payloads['nodia-gemini.service'], 0o644)
    command(['systemd-analyze', 'verify', '/etc/systemd/system/nodia-codex-bus.service',
             '/etc/systemd/system/nodia-codex-keyring.service', '/etc/systemd/system/nodia-gemini.service'])
    return {'schema_version': 1, 'status': 'prepared', 'source_sha': manifest['source_sha'],
            'manifest_sha256': digest, 'application_restarted': False, 'services_started': False,
            'credentials_copied_from_pc': False, 'login_requested': False, 'inference_requested': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--manifest-sha256', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.bundle, args.manifest_sha256)))
    except Exception as error:
        code = str(error) if type(error) is RuntimeError and re.fullmatch('[a-z0-9_]{1,100}', str(error)) else 'ai_runtime_prepare_failed'
        print(json.dumps({'status': 'failed', 'error_code': code, 'preserve_state': True, 'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
