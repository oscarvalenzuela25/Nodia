#!/usr/bin/env python3
"""Prepare or activate a pinned Teacher host. Never stop/start app or infer."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys

LIBRARY = Path('/usr/local/lib/nodia')
ROOT = LIBRARY / 'ai-runtime'
HOSTS = LIBRARY / 'teacher-runtime'
STAGED = Path('/etc/nodia/ai-runtime/staged')
ENVIRONMENT = Path('/etc/nodia/teacher-runtime.env')
RECEIPT = HOSTS / 'prepared.json'
COMMIT = '979011409de0a60b52f179721948e65531d26144'
POLICY = 'teacher-text/1;tool-policy=empty;isolation=isolated;environments=empty;dynamic-tools=empty;attachments=empty;extensions=response-firewall;one-turn;retries=0;prompt=131072;result=32768'
CAPABILITIES = {
    'protocol': 'nodia-teacher-codex-host/1', 'purpose': 'teacher-text/1', 'source_commit': COMMIT,
    'policy_hash': hashlib.sha256(POLICY.encode()).hexdigest(), 'compiled_native': True,
    'provider_id': 'nodia_codex', 'tools': [], 'attachments': [], 'maximum_prompt_utf8_bytes': 131072,
    'maximum_result_utf8_bytes': 32768, 'maximum_request_frame_bytes': 800000,
    'maximum_terminal_frame_bytes': 262144, 'retries': 0, 'qualification': 'required_per_selection_and_epoch',
}
SAFE_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8'}


def require(condition, code):
    if not condition:
        raise ValueError(code)


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(path, algorithm):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()


def validate_artifact(manifest, artifact, expected):
    require(re.fullmatch('[a-f0-9]{64}', expected or '') is not None, 'manifest_digest_invalid')
    info = manifest.lstat()
    require(stat.S_ISREG(info.st_mode) and 0 < info.st_size <= 128 * 1024, 'manifest_file_invalid')
    raw = manifest.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == expected, 'manifest_digest_mismatch')
    value = json.loads(raw)
    require(value.get('schema') == 'nodia-teacher-codex-host-artifact/1', 'manifest_schema_invalid')
    source = value.get('source', {})
    require(source.get('codex_commit') == COMMIT and source.get('codex_release_tag') == 'rust-v0.161.0', 'source_pin_invalid')
    require(json.dumps(value.get('capabilities'), sort_keys=True) == json.dumps(CAPABILITIES, sort_keys=True), 'capabilities_invalid')
    metadata = value.get('artifact', {})
    require(metadata.get('architecture') == 'linux-x86_64' and metadata.get('cargo_profile') == 'release'
            and metadata.get('stripped') is True, 'release_artifact_required')
    version = metadata.get('maximum_glibc_symbol')
    require(isinstance(version, str) and re.fullmatch(r'2\.[0-9]{1,2}', version)
            and tuple(map(int, version.split('.'))) <= (2, 39), 'artifact_abi_invalid')
    checksum = metadata.get('sha256')
    require(isinstance(checksum, str) and re.fullmatch('[a-f0-9]{64}', checksum), 'artifact_digest_invalid')
    require(artifact.name == metadata.get('filename') == 'nodia-teacher-codex-host-' + checksum[:16], 'artifact_name_invalid')
    info = artifact.lstat()
    require(stat.S_ISREG(info.st_mode) and type(metadata.get('bytes')) is int
            and 0 < info.st_size == metadata['bytes'] <= 1024 ** 3, 'artifact_file_invalid')
    require(digest(artifact, 'sha256') == checksum, 'artifact_digest_mismatch')
    return {'manifest_sha256': expected, 'binary_sha512': digest(artifact, 'sha512')}


def environment_bytes(binary_sha512):
    require(isinstance(binary_sha512, str) and re.fullmatch('[a-f0-9]{128}', binary_sha512), 'binary_digest_invalid')
    target = HOSTS / ('host-' + binary_sha512)
    return (f'NODIA_CODEX_TEACHER_HOST={target}\nNODIA_CODEX_TEACHER_HOST_SHA512={binary_sha512}\n').encode()


def command(arguments, seconds=20):
    result = subprocess.run(arguments, capture_output=True, timeout=seconds, env=SAFE_ENV, check=False)
    require(result.returncode == 0 and len(result.stdout) <= 16384, 'teacher_runtime_command_failed')
    return result.stdout


def prepare(safe, artifact, manifest, expected):
    checked = validate_artifact(manifest, artifact, expected)
    safe.make_directory(HOSTS)
    target = HOSTS / ('host-' + checked['binary_sha512'])
    if target.exists() or target.is_symlink():
        require(safe.checked(target, mode=0o755) and digest(target, 'sha512') == checked['binary_sha512'], 'existing_host_conflict')
    else:
        # Exclusive immutable destination; a partial transfer is preserved on failure.
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o755)
        with os.fdopen(fd, 'wb') as output, artifact.open('rb') as source:
            os.fchmod(output.fileno(), 0o755)
            shutil.copyfileobj(source, output, length=1024 * 1024)
            output.flush()
            os.fsync(output.fileno())
        require(digest(target, 'sha512') == checked['binary_sha512'], 'installed_host_digest_mismatch')
    # --capabilities has no profile, environment or account access. Isolate it anyway.
    capabilities = command(['systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--service-type=exec',
        '--property=User=nodia', '--property=Group=nodia', '--property=PrivateNetwork=yes',
        '--property=ProtectSystem=strict', '--property=ProtectHome=yes', '--property=PrivateTmp=yes',
        '--property=NoNewPrivileges=yes', '--property=CapabilityBoundingSet=', '--property=RuntimeMaxSec=10s',
        '--property=InaccessiblePaths=/var/lib/nodia /etc/nodia', '--', str(target), '--capabilities'])
    require(json.dumps(json.loads(capabilities), sort_keys=True) == json.dumps(CAPABILITIES, sort_keys=True), 'installed_host_capabilities_mismatch')
    safe.install_file(STAGED / 'teacher-runtime.env', environment_bytes(checked['binary_sha512']), 0o644)
    safe.install_file(RECEIPT, (json.dumps(checked, sort_keys=True) + '\n').encode(), 0o644)
    return {'status': 'teacher_runtime_prepared', **checked, 'application_restarted': False,
            'provider_calls': 0, 'activation_requested': False}


def activate(safe, updater, activation):
    checked = json.loads(safe.read_regular(RECEIPT, 0o644))
    environment = safe.read_regular(STAGED / 'teacher-runtime.env', 0o644)
    require(environment == environment_bytes(checked['binary_sha512']), 'staged_environment_changed')
    target = HOSTS / ('host-' + checked['binary_sha512'])
    require(safe.checked(target, mode=0o755) and digest(target, 'sha512') == checked['binary_sha512'], 'installed_host_changed')
    for unit in updater.SERVICES:
        state = command(['systemctl', 'show', unit, '-p', 'ActiveState', '-p', 'MainPID']).decode()
        require(set(state.strip().splitlines()) == {'ActiveState=inactive', 'MainPID=0'}, 'consumers_must_be_drained_and_stopped')
    # Existing SQL READ ONLY/TLS proof includes Teacher/chat jobs and outstanding owners.
    activation.preflight()
    safe.install_file(ENVIRONMENT, environment, 0o644)
    for unit in updater.SERVICES:
        safe.install_file(updater.SYSTEMD_UNITS / (unit + '.d') / updater.TEACHER_RUNTIME_NAME,
                          updater.TEACHER_RUNTIME_TEMPLATE, 0o644)
    command(['systemctl', 'daemon-reload'])
    register = load('teacher_register_consumers', ROOT / 'register-consumers.py')
    registered = register.register(lock_held=True)
    require(registered['status'] == 'runtime_consumers_verified', 'teacher_registry_unverified')
    return {'status': 'teacher_runtime_activated_consumers_still_stopped', 'application_restarted': False,
            'provider_calls': 0, 'automatic_retry_allowed': False, **checked}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['prepare', 'activate'])
    parser.add_argument('--artifact', type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--manifest-sha256')
    args = parser.parse_args()
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_root_required')
    import fcntl
    safe = load('teacher_safe_provision', ROOT / 'codex-provision.py')
    updater = load('teacher_updater', LIBRARY / 'update-backend.py')
    require(hasattr(updater, 'TEACHER_RUNTIME_TEMPLATE'), 'compatible_updater_required')
    lock = Path('/var/lib/nodia-backend-setup/installation.lock')
    safe.read_regular(lock, 0o600)
    with lock.open('r+b') as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.phase == 'prepare':
            require(args.artifact is not None and args.manifest is not None, 'artifact_and_manifest_required')
            result = prepare(safe, args.artifact, args.manifest, args.manifest_sha256)
        else:
            require(not args.artifact and not args.manifest and not args.manifest_sha256, 'activation_arguments_invalid')
            result = activate(safe, updater, load('teacher_activation_preflight', ROOT / 'activate-ai-runtime.py'))
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[a-z0-9_]{1,100}', str(error)) else 'teacher_runtime_preparation_failed'
        print(json.dumps({'status': 'failed', 'error_code': code, 'preserve_state': True,
                          'automatic_retry_allowed': False, 'application_restarted': False, 'provider_calls': 0}))
        raise SystemExit(1) from None
