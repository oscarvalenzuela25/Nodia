#!/usr/bin/env python3
"""First adoption of the verified f01 release. No service start, SQL or remote call.

Existing target/current/receipt always requires inspection; failed copies and an
already-created current link are preserved, never removed or overwritten here.
"""
import argparse
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys

SOURCE_SHA = 'f01b493336883403a84b1c80759ce4fc43cbd370'
TREE_SHA = 'ff33b6fdbbbc05167745da9c2fde5f3d19355baf51d51214bbc7121cb6ea1e6f'
RELEASE_ID = f'backend-{SOURCE_SHA[:12]}-{TREE_SHA[:12]}'
CANDIDATE = Path('/opt/nodia/candidates') / RELEASE_ID
RELEASES = Path('/opt/nodia/releases')
CURRENT = Path('/opt/nodia/current')
PRIVATE = Path('/var/lib/nodia-backend-setup/private')
STATE = PRIVATE / 'release-adoption-status.json'
PUBLIC = PRIVATE.parent / 'release-adoption-status.json'
LIBRARY = Path('/usr/local/lib/nodia')
GUARD_SHA = 'dd3a1e39cb13daaa6b7607a6685ef8a2f59d953ddc712c3fa27d225a69ee6ac9'
STAGE_SHA = 'f3b96b790ac1c98d69614f72e1a839ca791f47e0729e100e5f0ec10dc287b723'
HEX = re.compile(r'^[a-f0-9]{64}$')


def require(condition, code):
    if not condition:
        raise ValueError(code)


def digest(filename):
    value = hashlib.sha256()
    with filename.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def protected_directory(filename):
    require(filename.is_absolute() and filename.resolve(strict=True) == filename, 'unsafe_directory')
    for parent in (filename, *filename.parents):
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == info.st_gid == 0 and not info.st_mode & 0o022,
                'unsafe_directory')


def import_pinned(filename, expected, name):
    protected_directory(filename.parent)
    info = filename.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0 and info.st_nlink == 1 and
            stat.S_IMODE(info.st_mode) == 0o644 and 0 < info.st_size <= 1024 * 1024 and
            digest(filename) == expected, 'installed_validator_mismatch')
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location(name, filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_lock(descriptor):
    info = os.fstat(descriptor)
    require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0 and info.st_nlink == 1 and
            stat.S_IMODE(info.st_mode) == 0o600 and info.st_size == 0, 'unsafe_installation_lock')


def validate_receipts(installed, installed_public, configured, configured_public, manifest, stage_receipt):
    require(isinstance(installed, dict) and installed == installed_public and isinstance(configured, dict) and
            configured == configured_public, 'preparation_receipts_disagree')
    release_id, source_sha, tree_sha = manifest['release_id'], manifest['source_sha'], manifest['package_tree_sha256']
    require(installed.get('phase') == 'complete' and installed.get('source_sha') == source_sha and
            installed.get('release_id') == release_id and installed.get('archive_sha256') == stage_receipt.get('archive_sha256') and
            isinstance(installed.get('archive_sha256'), str) and HEX.fullmatch(installed['archive_sha256']),
            'completed_database_installation_required')
    result = installed.get('result', {})
    require(isinstance(result, dict) and result.get('status') == 'verified' and result.get('source_sha') == source_sha and
            result.get('release_id') == release_id and result.get('migrations_verified') == 45 and
            result.get('entity_tables_verified') == 68 and result.get('users') == 1 and result.get('core_assignments') == 4 and
            result.get('provider_credentials') == 0 and result.get('client_tls_authorized') is True and
            result.get('postcheck_read_only') is True and result.get('application_started') is False and
            result.get('worker_started') is False, 'database_installation_result_invalid')
    require(configured.get('phase') == 'complete' and configured.get('configured') is True and
            configured.get('source_sha') == source_sha and configured.get('tree_sha256') == tree_sha and
            configured.get('release_id') == release_id and configured.get('postgres_client_major') == 16 and
            configured.get('configuration_owner') == 900 and configured.get('configuration_mode') == '0600' and
            configured.get('public_key_owner') == 900 and configured.get('public_key_mode') == '0400' and
            configured.get('application_started') is False and configured.get('worker_started') is False and
            configured.get('backup_requested') is False and configured.get('remote_calls_requested') is False,
            'completed_backup_configuration_required')
    custody = configured.get('custody', {})
    require(isinstance(custody, dict) and custody.get('format') == 'NODCFG01' and
            custody.get('purpose') == 'nodia_configuration_custody' and custody.get('plaintext_exported') is False and
            custody.get('postgres_dump') is False and isinstance(custody.get('cipher_sha256'), str) and
            HEX.fullmatch(custody['cipher_sha256']) and isinstance(configured.get('key_id'), str) and HEX.fullmatch(configured['key_id']) and
            custody.get('key_id') == configured['key_id'], 'configuration_custody_receipt_invalid')


def plan_from_manifest(manifest, manifest_bytes, stage):
    """Recreate the exact filesystem closure; there is no tar extraction or mutable source import."""
    require(isinstance(manifest, dict) and manifest.get('source_provenance') == 'git_archive' and
            manifest.get('deployment_eligible') is True, 'exact_git_manifest_required')
    require(isinstance(manifest_bytes, bytes) and stage.strict_json(manifest_bytes) == manifest, 'manifest_bytes_mismatch')
    files = manifest.get('files')
    require(isinstance(files, list) and 0 < len(files) < stage.MAX_MEMBERS and
            hashlib.sha256(json.dumps(files, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest() ==
            manifest.get('package_tree_sha256'), 'manifest_tree_digest_invalid')
    expected, nodes = {}, {'': {'type': 'directory'}}
    for item in files:
        require(isinstance(item, dict), 'invalid_manifest_entry')
        name = stage.relative_name(item.get('path'))
        require(name != 'release-manifest.json' and name not in expected and isinstance(item.get('sha256'), str) and
                HEX.fullmatch(item['sha256']),
                'invalid_manifest_entry')
        kind = item.get('type')
        if kind == 'file':
            require(set(item) == {'path', 'type', 'bytes', 'mode', 'sha256'} and type(item['bytes']) is int and
                    0 <= item['bytes'] <= stage.MAX_MEMBER and item['mode'] in ('0644', '0755'), 'invalid_manifest_file')
            node = {'type': 'file'}
        else:
            require(kind == 'symlink' and set(item) == {'path', 'type', 'target', 'sha256'} and
                    isinstance(item['target'], str) and hashlib.sha256(item['target'].encode()).hexdigest() == item['sha256'],
                    'invalid_manifest_link')
            stage.validate_link_text(item['target'])
            node = {'type': 'symlink', 'target': item['target']}
        require(name not in nodes or nodes[name]['type'] != 'directory', 'manifest_parent_type_conflict')
        expected[name], nodes[name] = item, node
        for parent in stage.parent_names(name):
            require(parent not in nodes or nodes[parent]['type'] == 'directory', 'manifest_parent_type_conflict')
            nodes[parent] = {'type': 'directory'}
    nodes['release-manifest.json'] = {'type': 'file'}
    stage.validate_links(nodes)
    return {'manifest': manifest, 'manifest_bytes': manifest_bytes,
            'manifest_sha256': hashlib.sha256(manifest_bytes).hexdigest(), 'expected': expected, 'nodes': nodes}


def sync_directory(filename):
    descriptor = os.open(filename, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def copy_verified_release(candidate, target, plan, stage, *, require_root=True):
    require(not os.path.lexists(target), 'release_target_exists_inspection_required')
    stage.verify_tree(candidate, plan, require_root=require_root)
    shutil.copytree(candidate, target, symlinks=True, copy_function=shutil.copy2)
    # No cleanup on failure: ownership-protected partial copies remain inspectable.
    stage.verify_tree(target, plan, require_root=require_root)
    for name, node in plan['nodes'].items():
        filename = target / name if name else target
        if node['type'] == 'file':
            descriptor = os.open(filename, os.O_RDONLY | os.O_NOFOLLOW)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
    for filename in sorted((target / name if name else target for name, node in plan['nodes'].items()
                            if node['type'] == 'directory'), key=lambda path: len(path.parts), reverse=True):
        sync_directory(filename)
    sync_directory(target.parent)
    stage.verify_tree(candidate, plan, require_root=require_root)
    stage.verify_tree(target, plan, require_root=require_root)


def write_receipt(filename, value, guards, *, exclusive, mode):
    if not exclusive:
        guards.durable_json(filename, value, mode=mode)
        return
    payload = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    descriptor = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(descriptor, 'wb') as stream:
        os.fchmod(stream.fileno(), mode)  # Public 0644 must survive an operator umask of 077.
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    sync_directory(filename.parent)


def create_current_exclusive(target, current):
    require(not os.path.lexists(current), 'current_exists_inspection_required')
    require(target.is_absolute() and target.resolve(strict=True) == target and target.is_dir(), 'invalid_current_target')
    os.symlink(str(target), current)
    sync_directory(current.parent)
    require(current.is_symlink() and os.readlink(current) == str(target) and current.resolve(strict=True) == target,
            'current_link_postcondition_failed')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate')
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--tree-sha256', required=True)
    parser.add_argument('--helper-sha256', required=True)
    args = parser.parse_args(argv)
    require(sys.platform == 'linux' and os.geteuid() == 0, 'root_linux_required')
    require(Path(args.candidate) == CANDIDATE and args.source_sha == SOURCE_SHA and args.tree_sha256 == TREE_SHA and
            HEX.fullmatch(args.helper_sha256) and digest(Path(__file__)) == args.helper_sha256, 'exact_f01_adoption_identity_required')
    for directory in (PRIVATE, LIBRARY, RELEASES, CURRENT.parent):
        protected_directory(directory)
    require(stat.S_IMODE(PRIVATE.stat().st_mode) == 0o700 and stat.S_IMODE(RELEASES.stat().st_mode) == 0o755,
            'adoption_directory_mode_invalid')
    guards = import_pinned(LIBRARY / f'backup-guards-{GUARD_SHA}.py', GUARD_SHA, 'adoption_guards')
    stage = import_pinned(LIBRARY / f'stage-validator-{STAGE_SHA}.py', STAGE_SHA, 'adoption_stage')
    descriptor = os.open(PRIVATE / 'installation.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'a+b') as lock:
        validate_lock(lock.fileno())
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        validate_lock(lock.fileno())
        target = RELEASES / RELEASE_ID
        require(not any(os.path.lexists(path) for path in (STATE, PUBLIC, target, CURRENT)), 'previous_or_partial_adoption_requires_inspection')
        guards.writers_stopped()
        manifest = guards.verify_release(CANDIDATE, SOURCE_SHA, TREE_SHA)
        manifest_bytes = (CANDIDATE / 'release-manifest.json').read_bytes()
        require(guards.unique_json(manifest_bytes) == manifest, 'manifest_changed_during_verification')
        plan = plan_from_manifest(manifest, manifest_bytes, stage)
        stage.verify_tree(CANDIDATE, plan)
        receipts = []
        for name in ('installation-status.json', 'backup-preparation-status.json'):
            values = []
            for parent, mode in ((PRIVATE, 0o600), (PRIVATE.parent, 0o644)):
                filename = parent / name
                guards.regular(filename, mode=mode)
                values.append(guards.unique_json(filename.read_bytes()))
            receipts.extend(values)
        staging_receipt = guards.unique_json((PRIVATE.parent / 'candidate-receipts' / f'{RELEASE_ID}.json').read_bytes())
        validate_receipts(*receipts, manifest, staging_receipt)
        state = {'schema_version': 1, 'phase': 'copying_release', 'source_sha': SOURCE_SHA, 'package_tree_sha256': TREE_SHA,
                 'release_id': RELEASE_ID, 'candidate_path': str(CANDIDATE), 'release_path': str(target),
                 'current_path': str(CURRENT), 'archive_sha256': staging_receipt['archive_sha256'], 'helper_sha256': args.helper_sha256,
                 'guard_sha256': GUARD_SHA, 'stage_sha256': STAGE_SHA, 'application_started': False, 'worker_started': False,
                 'services_enabled': False, 'migrations_requested': False, 'remote_calls_requested': False,
                 'automatic_retry_allowed': False, 'current_created_this_run': False}

        def status(phase, *, exclusive=False, **extra):
            state.update(phase=phase, updated_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), **extra)
            write_receipt(STATE, state, guards, exclusive=exclusive, mode=0o600)
            write_receipt(PUBLIC, state, guards, exclusive=exclusive, mode=0o644)

        status('copying_release', exclusive=True)
        try:
            copy_verified_release(CANDIDATE, target, plan, stage)
            status('release_verified', files_verified=len(plan['expected']), candidate_preserved=True)
            guards.writers_stopped()
            create_current_exclusive(target, CURRENT)
            state['current_created_this_run'] = True
            info = CURRENT.lstat()
            require(info.st_uid == info.st_gid == 0 and info.st_nlink == 1, 'current_owner_invalid')
            stage.verify_tree(target, plan)
            status('complete', current_target_verified=True)
            print(json.dumps(state, separators=(',', ':')), flush=True)
        except Exception as error:
            code = str(error) if re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'release_adoption_failed'
            try:
                status('failed', error_code=code, current_created_this_run=os.path.lexists(CURRENT))
            except Exception:
                print('[Nodia adoption] failed to persist failure; inspect existing receipt and protected paths.', file=sys.stderr)
            raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'release_adoption_failed'
        print(json.dumps({'schema_version': 1, 'phase': 'blocked', 'error_code': code,
                          'automatic_retry_allowed': False, 'application_started': False,
                          'worker_started': False, 'migrations_requested': False, 'remote_calls_requested': False}), flush=True)
        sys.exit(1)
