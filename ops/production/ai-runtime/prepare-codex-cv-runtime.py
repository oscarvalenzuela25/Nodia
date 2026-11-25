#!/usr/bin/env python3
"""Prepare, activate or remove the reviewed Codex CV host without account access."""
import argparse
from contextlib import ExitStack
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile

LIB = Path('/usr/local/lib/nodia')
RUNTIME = LIB / 'ai-runtime'
STATE = Path('/var/lib/nodia-ai-runtime-setup')
SETTINGS = Path('/var/lib/nodia-updates/settings.json')
LOCKS = (Path('/var/lib/nodia-updates/receiver.lock'),
         Path('/var/lib/nodia-backend-setup/installation.lock'))
PREPARED = LIB / 'codex-cv-runtime/prepared.json'
MAX_MANIFEST = 128 * 1024
MAX_CATALOG = 1024 * 1024
MAX_MODEL_BYTES = 96_000
SOURCES = {
    'schema_version': 1,
    'source_sha': '907407843d6c9460d80fbd2daf44665a9d6aee6c',
    'source_tree_sha': '174765ff83c3820b01d4a8741f702472c0b466d6',
    'binary_sha512': '04b1280594776487aee50169b00055550c911a739e1d3f984f2c84bed481a04270aafe28e1f88d4e107cd521346585e34457ee269edd15e869a1e6ad44e22d2d',
    'catalog_sha512': '52f18aa24deab36a9c8f12983fac45e859710db3642b9af79544e1afb7c9c35ac978767a98b7e8481cda15e2c0d9dad787341227524adb88623cc609e087b7f6',
    'manifest_sha256': '4e2a718a42bcc1d5b584b2175a5676079db5a7cdfebff994292a349a7d3a65f9',
}
VERSION = '0.171.0'
CAPABILITIES = {
    'protocol': 'nodia-cv-codex-host/1', 'purpose': 'cv-tailoring/1',
    'source_commit': '979011409de0a60b52f179721948e65531d26144',
    'policy_hash': 'ae1b378d2d8af7792ea83975548048b95228b6c752e376cdea5c39bef6ccb73b',
    'compiled_native': True, 'provider_id': 'nodia_codex', 'tools': [], 'attachments': [],
    'maximum_prompt_utf8_bytes': 131072, 'maximum_result_utf8_bytes': 32768,
    'maximum_request_frame_bytes': 800000, 'maximum_terminal_frame_bytes': 262144,
    'retries': 0, 'qualification': 'required_per_selection_and_epoch',
}
SYNTHETIC_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8'}


def require(condition, code):
    if not condition:
        raise ValueError(code)


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def load(path, expected=None):
    for item in (path, *path.parents):
        info = item.lstat()
        require(item.resolve(strict=True) == item and info.st_uid == info.st_gid == 0
                and not info.st_mode & 0o022, 'unprotected_codex_cv_operator')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1
            and 0 < info.st_size <= MAX_MANIFEST, 'invalid_codex_cv_operator')
    raw = path.read_bytes()
    require(expected is None or hashlib.sha256(raw).hexdigest() == expected, 'codex_cv_operator_pin_changed')
    module = importlib.util.module_from_spec(importlib.util.spec_from_file_location(path.stem, path))
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module


def open_input(path, maximum):
    require(path.is_absolute() and path.resolve(strict=True) == path, 'codex_cv_input_path_invalid')
    stream = os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb')
    info = os.fstat(stream.fileno())
    if not (stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and not info.st_mode & 0o022
            and 0 < info.st_size <= maximum):
        stream.close()
        raise ValueError('codex_cv_input_file_invalid')
    return stream


def checked_manifest(updater, manifest, artifact, digest):
    require(type(digest) is str and digest == SOURCES['manifest_sha256'], 'codex_cv_reviewed_manifest_required')
    with open_input(manifest, MAX_MANIFEST) as stream:
        raw = stream.read(MAX_MANIFEST + 1)
    require(hashlib.sha256(raw).hexdigest() == digest, 'codex_cv_manifest_digest_mismatch')
    value = updater.unique_json(raw)
    require(type(value) is dict and value.get('schema') == 'nodia-cv-codex-host-artifact/1'
            and encoded(value.get('capabilities')) == encoded(CAPABILITIES), 'codex_cv_manifest_invalid')
    source, item = value.get('source'), value.get('artifact')
    require(type(source) is dict and source.get('codex_commit') == CAPABILITIES['source_commit']
            and source.get('codex_release_tag') == 'rust-v0.161.0'
            and source.get('sdk_model_metadata_release') == VERSION, 'codex_cv_manifest_source_invalid')
    require(type(item) is dict and item.get('architecture') == 'linux-x86_64'
            and item.get('cargo_profile') == 'release' and item.get('stripped') is True
            and item.get('sha512') == SOURCES['binary_sha512']
            and type(item.get('sha256')) is str and re.fullmatch(r'[a-f0-9]{64}', item['sha256'])
            and type(item.get('bytes')) is int and 0 < item['bytes'] <= 1024 ** 3
            and item.get('filename') == artifact.name == 'nodia-cv-codex-host-' + item['sha256'][:16],
            'codex_cv_artifact_profile_invalid')
    abi = item.get('maximum_glibc_symbol')
    require(type(abi) is str and re.fullmatch(r'2\.[0-9]{1,2}', abi)
            and tuple(map(int, abi.split('.'))) <= (2, 39), 'codex_cv_artifact_abi_invalid')
    return raw, item


def install_artifact(safe, updater, artifact, manifest, metadata):
    target = updater.codex_cv_host_path(SOURCES)
    safe.make_directory(target.parent)
    if target.exists() or target.is_symlink():
        updater.codex_cv_executable(SOURCES, target, 'binary_sha512')
    else:
        with open_input(artifact, metadata['bytes']) as source:
            descriptor, temporary = tempfile.mkstemp(prefix='.codex-cv-host-', dir=target.parent)
            try:
                sha256, sha512, size = hashlib.sha256(), hashlib.sha512(), 0
                with os.fdopen(descriptor, 'wb') as output:
                    for block in iter(lambda: source.read(1024 * 1024), b''):
                        size += len(block)
                        require(size <= metadata['bytes'], 'codex_cv_artifact_size_changed')
                        if size == len(block):
                            require(block.startswith(b'\x7fELF\x02\x01\x01') and block[18:20] == b'\x3e\x00',
                                    'codex_cv_artifact_elf_invalid')
                        sha256.update(block)
                        sha512.update(block)
                        output.write(block)
                    require(size == metadata['bytes'] and sha256.hexdigest() == metadata['sha256']
                            and sha512.hexdigest() == SOURCES['binary_sha512'], 'codex_cv_artifact_digest_mismatch')
                    os.fchmod(output.fileno(), 0o755)
                    output.flush()
                    os.fsync(output.fileno())
                require(not target.exists() and not target.is_symlink(), 'codex_cv_immutable_target_conflict')
                os.replace(temporary, target)
                sync_parent(target)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
    safe.install_file(target.with_suffix('.manifest.json'), manifest, 0o644)
    return updater.codex_cv_installed_host(SOURCES)


def sync_parent(path):
    descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def offline_command(arguments, maximum):
    # No nodia HOME, D-Bus/keyring, production environment or provider network.
    result = subprocess.run(['/usr/bin/systemd-run', '--quiet', '--wait', '--pipe', '--collect',
        '--service-type=exec', '--property=User=nodia', '--property=Group=nodia',
        '--property=PrivateNetwork=yes', '--property=ProtectSystem=strict',
        '--property=ProtectHome=yes', '--property=PrivateTmp=yes', '--property=WorkingDirectory=/',
        '--property=NoNewPrivileges=yes', '--property=CapabilityBoundingSet=',
        '--property=RuntimeMaxSec=15s', '--property=MemoryMax=512M',
        '--property=TemporaryFileSystem=/proc:ro',
        '--property=InaccessiblePaths=/var/lib/nodia /etc/nodia -/run/nodia-codex -/run/user -/run/dbus',
        '--setenv=HOME=/tmp/codex-cv-offline', '--setenv=CODEX_HOME=/tmp/codex-cv-offline',
        '--setenv=XDG_CONFIG_HOME=/tmp/codex-cv-offline', '--', *arguments],
        capture_output=True, timeout=25, env=SYNTHETIC_ENV, check=False)
    require(result.returncode == 0 and 0 < len(result.stdout) <= maximum, 'codex_cv_offline_probe_failed')
    return result.stdout


def exact_model_metadata(catalog, model, effort):
    models = catalog.get('models') if type(catalog) is dict else None
    require(type(models) is list and len(models) <= 1000
            and all(type(item) is dict and type(item.get('slug')) is str for item in models),
            'codex_cv_catalog_invalid')
    found = [item for item in models if item['slug'] == model]
    require(len(found) == 1, 'codex_cv_offline_model_unavailable')
    levels = found[0].get('supported_reasoning_levels')
    require(type(levels) is list and len(levels) <= 24
            and all(type(item) is dict and type(item.get('effort')) is str for item in levels)
            and any(item['effort'] == effort for item in levels), 'codex_cv_offline_effort_unavailable')
    raw = json.dumps(found[0], ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    require(len(raw.encode()) <= MAX_MODEL_BYTES, 'codex_cv_offline_model_metadata_too_large')
    return raw


def probe(updater, target, cli, model, effort):
    caps = updater.unique_json(offline_command([str(target), '--capabilities'], 16384))
    require(encoded(caps) == encoded(CAPABILITIES), 'codex_cv_offline_capabilities_mismatch')
    require(offline_command([str(cli), '--version'], 128).strip() == ('codex-cli ' + VERSION).encode(),
            'codex_cv_offline_catalog_version_changed')
    catalog = updater.unique_json(offline_command([str(cli), 'debug', 'models', '--bundled'], MAX_CATALOG))
    row = exact_model_metadata(catalog, model, effort)
    checked = updater.unique_json(offline_command([str(target), '--check-model', model, json.dumps(effort),
        '--model-metadata-json', row], 16384))
    require(checked == {'model_id': model, 'effort_id': effort}, 'codex_cv_offline_selection_mismatch')
    return checked


def staged(updater, safe):
    record = updater.unique_json(safe.read_regular(PREPARED, 0o644))
    require(type(record) is dict and set(record) == {'codex_cv_runtime', 'offline_selection'}
            and record['codex_cv_runtime'] == SOURCES, 'codex_cv_prepared_receipt_invalid')
    updater.validate_codex_cv_proof(record['codex_cv_runtime'])
    selection = record['offline_selection']
    require(type(selection) is dict and set(selection) == {'model_id', 'effort_id'}
            and selection_valid(selection['model_id'], selection['effort_id']), 'codex_cv_prepared_selection_invalid')
    return record


def selection_valid(model, effort):
    return (type(model) is str and re.fullmatch(r'[a-z0-9][a-z0-9._-]{0,126}', model)
            and type(effort) is str and re.fullmatch(r'[a-z][a-z0-9_-]{0,62}', effort))


def prepare(updater, safe, release, args):
    require(selection_valid(args.model, args.effort), 'codex_cv_exact_offline_selection_required')
    manifest, metadata = checked_manifest(updater, args.manifest, args.artifact, args.manifest_sha256)
    cli = updater.codex_cv_executable(SOURCES, release / updater.CODEX_CV_CLI, 'catalog_sha512')
    target = install_artifact(safe, updater, args.artifact, manifest, metadata)
    selection = probe(updater, target, cli, args.model, args.effort)
    record = {'codex_cv_runtime': dict(SOURCES), 'offline_selection': selection}
    safe.install_file(PREPARED, encoded(record), 0o644)
    return {'status': 'codex_cv_runtime_prepared', **record, 'provider_calls': 0}


def active_files(updater):
    return {updater.CODEX_CV_ENVIRONMENT: updater.codex_cv_environment_bytes(SOURCES),
            updater.CODEX_CV_ACTIVE: encoded(SOURCES),
            **{updater.SYSTEMD_UNITS / (unit + '.d') / updater.CODEX_CV_RUNTIME_NAME:
               updater.CODEX_CV_RUNTIME_TEMPLATE for unit in updater.SERVICES}}


def normalized_previous(updater, safe, activated, previous):
    original = safe.read_regular(activated / 'previous-registry.json', 0o600)
    before = updater.ai_runtime_registry(updater.unique_json(original))
    clean = {**previous, 'units': {unit: {name: digest for name, digest in hashes.items()
                                        if name != updater.CODEX_CV_RUNTIME_NAME}
                                  for unit, hashes in previous['units'].items()}}
    del clean['codex_cv_runtime']
    require(clean == before, 'codex_cv_previous_registry_changed')
    return original


def change(updater, safe, policy, activation, registry, settings, release, remove):
    direction = 'rollback' if remove else 'activate'
    proof = staged(updater, safe)
    ready = STATE / ('codex-cv-activate-' + SOURCES['source_tree_sha'])
    attempt = STATE / ('codex-cv-' + direction + '-' + SOURCES['source_tree_sha'])
    files = active_files(updater)
    host = updater.Host(policy, None, settings)
    host.current = host.candidate = release
    host.groups = host.verify_writers(release)
    attached = host.codex_cv_attestation(release)
    prior = safe.read_regular(updater.AI_CONSUMERS, 0o600)
    current = updater.ai_runtime_registry(updater.unique_json(prior))
    if remove:
        completed = updater.unique_json(safe.read_regular(ready / 'complete.json', 0o600))
        require(attached == SOURCES and completed.get('status') == 'codex_cv_runtime_ready_for_cd'
                and completed.get('codex_cv_runtime') == SOURCES
                and completed.get('current_release') == release.name, 'codex_cv_rollback_identity_mismatch')
        restore = normalized_previous(updater, safe, ready, current)
    else:
        require(attached is None, 'codex_cv_runtime_already_attached')
        updater.codex_cv_executable(SOURCES, release / updater.CODEX_CV_CLI, 'catalog_sha512')
        updater.codex_cv_installed_host(SOURCES)
        restore = None
    require(not updater.MAINTENANCE.exists() and not updater.MAINTENANCE.is_symlink()
            and not host.prior_updates_blocked(), 'codex_cv_backend_not_ready')
    host.backup_environment(release)
    attempt.mkdir(mode=0o700)
    host.attempt = attempt
    host.request = {'operation_id': SOURCES['source_tree_sha'][:32]}
    updater.atomic_write(attempt / 'previous-registry.json', prior)
    updater.atomic_write(attempt / 'intent.json', encoded({'action': direction, 'release': release.name,
                                                          'codex_cv_runtime': SOURCES}))
    phase = 'maintenance'
    try:
        host.maintenance(True)
        timers = host.pause_timers()
        host.require_quiescent(stopped=False)
        phase = 'stop_requested'
        host.stop_writers()
        host.require_quiescent(stopped=True)
        activation.preflight()
        require(updater.CURRENT.resolve(strict=True) == release
                and safe.read_regular(updater.AI_CONSUMERS, 0o600) == prior, 'codex_cv_backend_changed')
        phase = 'consumer_configuration'
        if remove:
            for path, expected in files.items():
                require(safe.read_regular(path, 0o644) == expected, 'codex_cv_remove_file_changed')
            for path in reversed(files):
                path.unlink()
                sync_parent(path)
            updater.atomic_write(updater.AI_CONSUMERS, restore)
        else:
            for path, contents in files.items():
                safe.install_file(path, contents, 0o644)
        host.command(['/usr/bin/systemctl', 'daemon-reload'])
        if not remove:
            registered = registry.register(lock_held=True)
            require(registered.get('status') == 'runtime_consumers_verified', 'codex_cv_registration_failed')
        phase = 'restore_consumers'
        host.command(['/usr/bin/systemctl', 'start', *updater.SERVICES], 220)
        activation.http_smoke()
        after = updater.Host(policy, None, settings)
        after.verify_writers(release)
        attestation = after.codex_cv_attestation(release)
        require(attestation == (None if remove else SOURCES), 'codex_cv_live_attestation_mismatch')
        host.maintenance(False)
        host.restore_timers(timers)
        receipt = {'status': 'codex_cv_runtime_rolled_back' if remove else 'codex_cv_runtime_ready_for_cd',
                   'current_release': release.name, 'codex_cv_runtime': attestation,
                   'offline_selection': proof['offline_selection'], 'provider_calls': 0}
        updater.atomic_write(attempt / 'complete.json', encoded(receipt))
        return receipt
    except BaseException:
        updater.atomic_write(attempt / 'failure.json', encoded({
            'phase': phase, 'preserve_state': True, 'automatic_retry_allowed': False,
        }))
        raise


def run(args):
    import fcntl
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_root_required')
    require(Path(__file__).resolve(strict=True) == RUNTIME / 'prepare-codex-cv-runtime.py',
            'installed_codex_cv_operator_required')
    expected = args.expected_backend_release
    require(expected and re.fullmatch(r'backend-[a-f0-9]{12}-[a-f0-9]{12}', expected),
            'expected_backend_release_required')
    os.umask(0o077)
    safe = load(RUNTIME / 'codex-provision.py')
    settings_raw = safe.read_regular(SETTINGS, 0o600)
    digest = json.loads(settings_raw)['assets']['update-backend.py']
    updater = load(LIB / 'update-backend.py', digest)
    settings = updater.unique_json(settings_raw)
    with ExitStack() as stack:
        for path in LOCKS:
            require(updater.protected(path, mode=0o600).st_size == 0, 'codex_cv_lock_invalid')
            stream = stack.enter_context(path.open('r+b'))
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(safe.read_regular(SETTINGS, 0o600) == settings_raw, 'codex_cv_settings_changed')
        updater.protected(STATE, mode=0o700, directory=True)
        info = updater.CURRENT.lstat()
        release = updater.CURRENT.resolve(strict=True)
        require(stat.S_ISLNK(info.st_mode) and info.st_uid == info.st_gid == 0 and release.parent == updater.RELEASES
                and release.name == expected, 'unexpected_current_backend_release')
        if args.phase == 'prepare':
            require(args.artifact is not None and args.manifest is not None, 'codex_cv_artifact_and_manifest_required')
            return prepare(updater, safe, release, args)
        require(not any((args.artifact, args.manifest, args.manifest_sha256, args.model, args.effort)),
                'codex_cv_activation_arguments_invalid')
        policy = load(LIB / 'backend_update.py', settings['assets']['backend_update.py'])
        action = LIB / 'update-backend-action.mjs'
        updater.protected(action, mode=0o644)
        require(updater.sha_file(action) == settings['assets'][action.name], 'codex_cv_preflight_asset_changed')
        activation = load(RUNTIME / 'activate-ai-runtime.py')
        registry = load(RUNTIME / 'register-consumers.py')
        return change(updater, safe, policy, activation, registry, settings, release, args.phase == 'rollback')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('prepare', 'activate', 'rollback'))
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--expected-backend-release')
    parser.add_argument('--artifact', type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--manifest-sha256')
    parser.add_argument('--model')
    parser.add_argument('--effort')
    args = parser.parse_args()
    print(json.dumps(run(args) if args.execute else {'status': 'inert', 'production_writes': 0}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if type(error) is ValueError and re.fullmatch(r'[a-z_]{1,100}', str(error)) else 'codex_cv_runtime_review_required'
        print(json.dumps({'status': 'failed', 'error_code': code, 'provider_calls': 0,
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
