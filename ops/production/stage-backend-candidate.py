#!/usr/bin/env python3
"""Stage an artifact in candidates and run an isolated, read-only dependency probe.

Exact git releases require explicit --allow-git-release; neither kind is activated.

No API/worker activation, current symlink, SQL migration or environment output.
"""
import argparse
import datetime
import fcntl
import grp
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import uuid

UPLOAD = Path('/home/nodia-admin/nodia-setup/backend')
CANDIDATES = Path('/opt/nodia/candidates')
STATE = Path('/var/lib/nodia-backend-setup')
PRIVATE = STATE / 'private'
PROBE = Path('/usr/local/lib/nodia/probe-backend-dependencies.mjs')
UNIT_DIRECTORY = Path('/run/systemd/system')
MAX_ARCHIVE = 512 * 1024 ** 2
MAX_UNPACKED = 2 * 1024 ** 3
MAX_MEMBER = 512 * 1024 ** 2
MAX_MANIFEST = 8 * 1024 ** 2
MAX_MEMBERS = 100_000
HEX = re.compile(r'^[a-f0-9]{64}$')
RELEASE = re.compile(r'^backend(?:-candidate)?-[a-f0-9]{12}-[a-f0-9]{12}$')
SOURCE_KEYS = {'source_sha', 'archive_sha256', 'source_manifest_sha256', 'snapshot_tree_sha256',
               'files_verified', 'source_provenance', 'deployment_eligible', 'overlay'}
MANIFEST_KEYS = {'schema_version', 'release_id', 'source_sha', 'source', 'source_provenance',
                 'deployment_eligible', 'eligibility_scope', 'filesystem_policy',
                 'package_tree_sha256', 'runtime', 'tooling', 'checks', 'compiled_assets',
                 'package_lock_sha256', 'native_packages', 'files'}


class Rejected(Exception):
    pass


def require(condition, code):
    if not condition:
        raise Rejected(code)


def digest(stream):
    result = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        result.update(block)
    return result.hexdigest()


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, 'duplicate_json_key')
        result[key] = value
    return result


def strict_json(data):
    require(len(data) <= MAX_MANIFEST and not data.startswith(b'\xef\xbb\xbf'), 'invalid_json_size')
    try:
        return json.loads(data.decode('utf-8'), object_pairs_hook=pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(Rejected('invalid_json_number')))
    except (UnicodeError, ValueError, RecursionError) as error:
        raise Rejected('invalid_json') from error


def relative_name(name, *, directory=False):
    require(isinstance(name, str) and len(name.encode('utf-8')) <= 1024, 'invalid_archive_path')
    if name.startswith('./'):
        name = name[2:]
    if directory and name.endswith('/'):
        name = name[:-1]
    if directory and name in ('', '.'):
        return ''
    require(name and not name.startswith('/') and '\\' not in name and
            not any(ord(char) < 32 or ord(char) == 127 for char in name), 'invalid_archive_path')
    require(all(part not in ('', '.', '..') for part in name.split('/')), 'invalid_archive_path')
    return name


def parent_names(name):
    parts = name.split('/')
    return ['/'.join(parts[:index]) for index in range(1, len(parts))]


def validate_link_text(target):
    require(isinstance(target, str) and target and len(target.encode('utf-8')) <= 1024 and
            not target.startswith('/') and '\\' not in target and
            not any(ord(char) < 32 or ord(char) == 127 for char in target), 'invalid_symlink_target')


def validate_links(nodes):
    for name, node in nodes.items():
        for parent in parent_names(name):
            require(parent in nodes and nodes[parent]['type'] == 'directory', 'non_directory_parent')
        if node['type'] != 'symlink':
            continue
        validate_link_text(node['target'])
        resolved = name.split('/')[:-1]
        pending = node['target'].split('/')
        seen = {name}
        while pending:
            component = pending.pop(0)
            if component in ('', '.'):
                continue
            if component == '..':
                require(resolved, 'symlink_escape')
                resolved.pop()
                continue
            current = '/'.join(resolved + [component])
            require(current in nodes, 'symlink_target_missing')
            target = nodes[current]
            if target['type'] == 'symlink':
                require(current not in seen, 'symlink_cycle')
                seen.add(current)
                validate_link_text(target['target'])
                pending = target['target'].split('/') + pending
            else:
                require(not pending or target['type'] == 'directory', 'symlink_target_not_directory')
                resolved.append(component)


def read_plan(archive, *, allow_git_release=False):
    """Read all metadata before creating output. Tar member payloads stay streamed."""
    nodes, members, total = {}, [], 0
    for member in archive:
        require(len(members) < MAX_MEMBERS, 'too_many_archive_members')
        require(member.type in (tarfile.DIRTYPE, tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.SYMTYPE)
                and member.sparse is None, 'archive_special_file_denied')
        kind = 'directory' if member.isdir() else 'symlink' if member.issym() else 'file'
        name = relative_name(member.name, directory=kind == 'directory')
        require(name not in nodes, 'duplicate_archive_path')
        require(member.uid == 0 and member.gid == 0, 'archive_owner_mismatch')
        if kind == 'file':
            require(0 <= member.size <= MAX_MEMBER and member.mode in (0o644, 0o755), 'invalid_archive_file')
            total += member.size
            require(total <= MAX_UNPACKED, 'archive_unpacked_limit')
        elif kind == 'directory':
            require(member.mode == 0o755, 'archive_directory_mode_mismatch')
        node = {'type': kind, 'member': member}
        if kind == 'symlink':
            node['target'] = member.linkname
        nodes[name] = node
        members.append((name, member))
    require('' in nodes and nodes['']['type'] == 'directory', 'archive_root_missing')
    manifest_node = nodes.get('release-manifest.json')
    require(manifest_node and manifest_node['type'] == 'file' and
            manifest_node['member'].size <= MAX_MANIFEST, 'manifest_missing')
    with archive.extractfile(manifest_node['member']) as stream:
        manifest_bytes = stream.read(MAX_MANIFEST + 1)
    manifest = strict_json(manifest_bytes)
    require(isinstance(manifest, dict) and set(manifest) == MANIFEST_KEYS and
            type(manifest['schema_version']) is int and manifest['schema_version'] == 1,
            'invalid_artifact_manifest')
    provenance = manifest['source_provenance']
    require(provenance in ('workspace_documentation_candidate', 'git_archive'), 'invalid_source_provenance')
    git_release = provenance == 'git_archive'
    require(not git_release or allow_git_release, 'git_release_opt_in_required')
    require(manifest['deployment_eligible'] is git_release, 'source_eligibility_mismatch')
    release_id = manifest['release_id']
    prefix = 'backend' if git_release else 'backend-candidate'
    require(isinstance(release_id, str) and RELEASE.fullmatch(release_id) and
            isinstance(manifest['source_sha'], str) and re.fullmatch(r'[a-f0-9]{40}', manifest['source_sha']) and
            isinstance(manifest['package_tree_sha256'], str) and HEX.fullmatch(manifest['package_tree_sha256']) and
            release_id == f"{prefix}-{manifest['source_sha'][:12]}-{manifest['package_tree_sha256'][:12]}",
            'invalid_release_identity')
    source, checks = manifest['source'], manifest['checks']
    require(isinstance(checks, dict) and isinstance(source, dict) and
            checks.get('status') == 'passed' and checks.get('source_sha') == manifest['source_sha'] and
            source.get('source_sha') == manifest['source_sha'] and
            source.get('source_provenance') == provenance and
            source.get('deployment_eligible') is git_release, 'source_checks_mismatch')
    if git_release:
        require(set(source) == SOURCE_KEYS and source['overlay'] == [] and
                isinstance(source['overlay'], list) and type(source['files_verified']) is int and
                source['files_verified'] > 0 and all(isinstance(source[field], str) and HEX.fullmatch(source[field])
                for field in ('archive_sha256', 'source_manifest_sha256', 'snapshot_tree_sha256')),
                'invalid_git_archive_source')
    files = manifest['files']
    require(isinstance(files, list) and 0 < len(files) < MAX_MEMBERS, 'invalid_manifest_inventory')
    serialized = json.dumps(files, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    require(hashlib.sha256(serialized).hexdigest() == manifest['package_tree_sha256'], 'manifest_tree_hash_mismatch')
    expected = {}
    for entry in files:
        require(isinstance(entry, dict) and entry.get('type') in ('file', 'symlink'), 'invalid_manifest_entry')
        name = relative_name(entry.get('path'))
        require(name not in expected and name != 'release-manifest.json' and HEX.fullmatch(entry.get('sha256', '')),
                'invalid_manifest_entry')
        if entry['type'] == 'file':
            require(set(entry) == {'path', 'type', 'bytes', 'mode', 'sha256'} and
                    type(entry['bytes']) is int and 0 <= entry['bytes'] <= MAX_MEMBER and
                    entry['mode'] in ('0644', '0755'), 'invalid_manifest_file')
        else:
            require(set(entry) == {'path', 'type', 'target', 'sha256'} and isinstance(entry['target'], str) and
                    hashlib.sha256(entry['target'].encode('utf-8')).hexdigest() == entry['sha256'],
                    'invalid_manifest_symlink')
            validate_link_text(entry['target'])
        expected[name] = entry
    actual_files = {name for name, node in nodes.items() if node['type'] != 'directory'}
    require(actual_files == set(expected) | {'release-manifest.json'}, 'archive_inventory_mismatch')
    for name, entry in expected.items():
        node = nodes[name]
        require(node['type'] == entry['type'], 'archive_entry_type_mismatch')
        if entry['type'] == 'file':
            require(node['member'].size == entry['bytes'] and node['member'].mode == int(entry['mode'], 8),
                    'archive_entry_metadata_mismatch')
        else:
            require(node['target'] == entry['target'], 'archive_symlink_mismatch')
    validate_links(nodes)
    return {'manifest': manifest, 'manifest_bytes': manifest_bytes,
            'manifest_sha256': hashlib.sha256(manifest_bytes).hexdigest(),
            'nodes': nodes, 'members': members, 'expected': expected}


def verify_tree(root, plan, *, require_root=True, root_mode=0o755):
    expected = plan['nodes']
    found = set()

    def visit(filename, name):
        metadata = filename.lstat()
        node = expected.get(name)
        require(node is not None, 'candidate_extra_entry')
        found.add(name)
        if require_root:
            require(metadata.st_uid == 0 and metadata.st_gid == 0, 'candidate_owner_mismatch')
        kind = node['type']
        if kind == 'directory':
            require(stat.S_ISDIR(metadata.st_mode) and not stat.S_ISLNK(metadata.st_mode) and
                    stat.S_IMODE(metadata.st_mode) == (root_mode if not name else 0o755), 'candidate_directory_mismatch')
            for child in filename.iterdir():
                visit(child, f'{name}/{child.name}' if name else child.name)
        elif kind == 'symlink':
            require(stat.S_ISLNK(metadata.st_mode) and os.readlink(filename) == node['target'], 'candidate_symlink_mismatch')
        else:
            mode = 0o644 if name == 'release-manifest.json' else int(plan['expected'][name]['mode'], 8)
            expected_hash = plan['manifest_sha256'] if name == 'release-manifest.json' else plan['expected'][name]['sha256']
            require(stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1 and
                    stat.S_IMODE(metadata.st_mode) == mode, 'candidate_file_mismatch')
            with filename.open('rb') as stream:
                require(digest(stream) == expected_hash, 'candidate_file_hash_mismatch')
    visit(root, '')
    require(found == set(expected), 'candidate_inventory_mismatch')


def extract_verified(archive, plan, destination, *, root_owner=True):
    """Destination must be a fresh private directory; never use tar.extract()."""
    require(destination.is_dir() and not destination.is_symlink() and not any(destination.iterdir()), 'invalid_staging_directory')
    for name, node in sorted(plan['nodes'].items(), key=lambda pair: (pair[0].count('/'), pair[0])):
        if name and node['type'] == 'directory':
            directory = destination / name
            directory.mkdir(mode=0o755)
            if root_owner:
                os.chown(directory, 0, 0)
            os.chmod(directory, 0o755)
    for name, member in plan['members']:
        if plan['nodes'][name]['type'] != 'file':
            continue
        filename = destination / name
        descriptor = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        result, count = hashlib.sha256(), 0
        try:
            with os.fdopen(descriptor, 'wb', closefd=False) as output, archive.extractfile(member) as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    count += len(block)
                    require(count <= member.size, 'archive_file_size_mismatch')
                    result.update(block)
                    output.write(block)
                output.flush()
            expected_hash = plan['manifest_sha256'] if name == 'release-manifest.json' else plan['expected'][name]['sha256']
            require(count == member.size and result.hexdigest() == expected_hash, 'archive_file_hash_mismatch')
            if root_owner:
                os.fchown(descriptor, 0, 0)
            os.fchmod(descriptor, member.mode)
        finally:
            os.close(descriptor)
    for name, node in plan['nodes'].items():
        if node['type'] == 'symlink':
            os.symlink(node['target'], destination / name)
            if root_owner:
                os.chown(destination / name, 0, 0, follow_symlinks=False)
    # Parent stays root0700 until every byte/link has been checked. Final mode is
    # set immediately before the private staging directory is atomically adopted.
    verify_tree(destination, plan, require_root=root_owner, root_mode=0o700)


def cleanup_staging(directory, identity, *, root_owner=True):
    """Delete only this invocation's fresh, unadopted directory; never a candidate."""
    if not directory.exists() and not directory.is_symlink():
        return
    info = directory.lstat()
    require(directory.parent.resolve(strict=True) == CANDIDATES.resolve(strict=True) and
            directory.name.startswith('.candidate-stage-') and not stat.S_ISLNK(info.st_mode) and
            stat.S_ISDIR(info.st_mode) and (info.st_dev, info.st_ino, info.st_uid) == identity and
            info.st_uid == (0 if root_owner else os.geteuid()) and
            shutil.rmtree.avoids_symlink_attacks, 'unsafe_staging_cleanup')
    shutil.rmtree(directory)


def root_directory(path, mode=0o755):
    current = Path('/')
    for part in path.parts[1:]:
        current /= part
        if not current.exists() and not current.is_symlink():
            current.mkdir(mode=mode if current == path else 0o755)
        info = current.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and
                info.st_uid == 0 and info.st_gid == 0 and not info.st_mode & 0o022, 'unsafe_root_directory')
    os.chmod(path, mode)


def atomic_json(filename, payload, mode):
    descriptor, temporary = tempfile.mkstemp(prefix='.candidate-json-', dir=filename.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
            os.fchmod(stream.fileno(), mode)
        os.replace(temporary, filename)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def protected_file(filename, mode=0o600):
    require(filename.resolve(strict=True) == filename, 'symlinked_private_file')
    info = filename.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_uid == 0 and
            info.st_gid == 0 and stat.S_IMODE(info.st_mode) == mode, 'unsafe_private_file')


def copy_uploaded(archive_path, expected_sha):
    absolute = Path(os.path.abspath(archive_path))
    require(absolute != UPLOAD and absolute.is_relative_to(UPLOAD), 'archive_outside_upload_directory')
    descriptor = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    temporary = None
    try:
        for component in absolute.parts[1:-1]:
            following = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = following
        source = os.open(absolute.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=descriptor)
        with os.fdopen(source, 'rb') as stream:
            info = os.fstat(stream.fileno())
            require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= MAX_ARCHIVE, 'invalid_archive_upload')
            target, temporary = tempfile.mkstemp(prefix='candidate-input-', suffix='.tar.gz', dir=PRIVATE)
            result, copied = hashlib.sha256(), 0
            with os.fdopen(target, 'wb') as output:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    copied += len(block)
                    require(copied <= MAX_ARCHIVE, 'archive_upload_limit')
                    result.update(block)
                    output.write(block)
                output.flush()
                os.fsync(output.fileno())
            require(copied == info.st_size and result.hexdigest() == expected_sha, 'archive_sha256_mismatch')
        return Path(temporary)
    except BaseException:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)
        raise
    finally:
        os.close(descriptor)


def services_stopped():
    for unit in ('nodia-api.service', 'nodia-ai-worker.service'):
        result = subprocess.run(['systemctl', 'show', unit, '--property=LoadState,ActiveState,UnitFileState', '--no-pager'],
                                capture_output=True, text=True, timeout=10, check=False)
        fields = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
        require(result.returncode == 0 and fields.get('LoadState') == 'loaded' and
                fields.get('ActiveState') == 'inactive' and fields.get('UnitFileState') == 'disabled', 'application_units_not_stopped_disabled')


def validate_probe_result(data):
    value = strict_json(data)
    base = {'schema_version', 'status', 'checks', 'application_started', 'migrations_executed', 'mutations_requested'}
    require(isinstance(value, dict) and set(value) in (base, base | {'failed_component', 'error_code'}) and
            type(value.get('schema_version')) is int and value['schema_version'] == 1 and
            value.get('status') in ('verified', 'failed') and
            all(value.get(key) is False for key in ('application_started', 'migrations_executed', 'mutations_requested')),
            'invalid_probe_result')
    failed = value['status'] == 'failed'
    require(set(value) == (base | {'failed_component', 'error_code'} if failed else base), 'invalid_probe_result')
    if failed:
        require(value['failed_component'] in ('configuration', 'postgres', 'redis', 'r2') and
                value['error_code'] in ('configuration_invalid', 'dns_error', 'connection_error', 'authentication_error',
                                        'tls_error', 'query_error', 'timeout', 'head_bucket_error', 'unknown'), 'invalid_probe_error')
    checks = value['checks']
    require(isinstance(checks, dict) and set(checks) == {'local_configuration', 'postgres', 'redis', 'r2'} and
            checks['local_configuration'] in ('passed', 'not_run'), 'invalid_probe_checks')
    for component in ('postgres', 'redis', 'r2'):
        result = checks[component]
        require(isinstance(result, dict) and result.get('status') in ('passed', 'not_run'), 'invalid_probe_checks')
        if result['status'] == 'not_run':
            require(failed and set(result) == {'status'}, 'invalid_probe_checks')
        elif component == 'postgres':
            require(set(result) == {'status', 'database_matched', 'server_version_num', 'transaction_read_only',
                                    'client_tls_authorized', 'client_tls_protocol', 'backend_tls'} and
                    all(result[key] is True for key in ('database_matched', 'transaction_read_only', 'client_tls_authorized')) and
                    type(result['server_version_num']) is int and 0 < result['server_version_num'] < 10_000_000 and
                    result['client_tls_protocol'] in ('TLSv1.2', 'TLSv1.3') and
                    (result['backend_tls'] is None or type(result['backend_tls']) is bool), 'invalid_postgres_probe')
        else:
            flag = 'authenticated_ping' if component == 'redis' else 'head_bucket'
            require(set(result) == {'status', flag} and result[flag] is True, 'invalid_probe_checks')
    require(failed or checks['local_configuration'] == 'passed', 'invalid_probe_checks')
    return value


def install_probe(expected_sha):
    require(HEX.fullmatch(expected_sha or ''), 'probe_sha256_required')
    source = Path(__file__).resolve().with_name('probe-backend-dependencies.mjs')
    require(not source.is_symlink() and source.is_file(), 'probe_source_missing')
    descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= 256 * 1024, 'invalid_probe_source')
        content = stream.read(256 * 1024 + 1)
    require(0 < len(content) <= 256 * 1024 and hashlib.sha256(content).hexdigest() == expected_sha, 'probe_sha256_mismatch')
    root_directory(PROBE.parent)
    if PROBE.exists() or PROBE.is_symlink():
        protected_file(PROBE, 0o644)
    descriptor, temporary = tempfile.mkstemp(prefix='.dependency-probe-', dir=PROBE.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
            os.fchmod(output.fileno(), 0o644)
        os.replace(temporary, PROBE)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def cleanup_probe_unit(unit, unit_path, *, runner=None):
    """Check the resulting state, since systemd may already have unloaded oneshot units."""
    require(re.fullmatch(r'nodia-backend-check-[a-f0-9]{32}\.service', unit) and
            unit_path.parent == UNIT_DIRECTORY and unit_path.name == unit, 'unsafe_probe_unit_cleanup')
    runner = runner or subprocess.run
    failed = False
    for command, timeout in [(['systemctl', 'stop', unit], 20), (['systemctl', 'reset-failed', unit], 10)]:
        try:
            # A nonzero result can simply mean that an inactive oneshot was
            # already garbage-collected. The final properties below decide.
            runner(command, capture_output=True, timeout=timeout, check=False)
        except (OSError, subprocess.TimeoutExpired):
            failed = True
    try:
        unit_path.unlink(missing_ok=True)
    except OSError:
        failed = True
    try:
        result = runner(['systemctl', 'daemon-reload'], capture_output=True, timeout=20, check=False)
        failed = failed or result.returncode != 0
    except (OSError, subprocess.TimeoutExpired):
        failed = True
    try:
        result = runner(['systemctl', 'show', unit, '--property=LoadState,ActiveState,MainPID,FragmentPath', '--no-pager'],
                        capture_output=True, text=True, timeout=10, check=False)
        fields = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
        require(fields.get('LoadState') in ('not-found', 'loaded') and fields.get('ActiveState') == 'inactive' and
                fields.get('MainPID') == '0' and fields.get('FragmentPath') == '', 'probe_unit_cleanup_failed')
    except (OSError, subprocess.TimeoutExpired):
        failed = True
    require(not failed and not unit_path.exists() and not unit_path.is_symlink(), 'probe_unit_cleanup_failed')


def run_probe(candidate, manifest, expected_probe_sha):
    services_stopped()
    identity = pwd.getpwnam('nodia')
    require(identity.pw_uid != 0 and identity.pw_gid != 0 and
            identity.pw_gid == grp.getgrnam('nodia').gr_gid and
            set(os.getgrouplist('nodia', identity.pw_gid)) == {identity.pw_gid}, 'unsafe_runtime_identity')
    for filename in (Path('/etc/nodia/runtime.env'), Path('/etc/nodia/redis.env')):
        protected_file(filename)
    node = Path('/usr/local/bin/node').resolve(strict=True)
    info = node.stat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022, 'unsafe_node_binary')
    with node.open('rb') as stream:
        require(digest(stream) == manifest['runtime'].get('executable_sha256'), 'node_binary_hash_mismatch')
    install_probe(expected_probe_sha)
    token = uuid.uuid4().hex
    unit = f'nodia-backend-check-{token}.service'
    unit_path = UNIT_DIRECTORY / unit
    output = PRIVATE / f'probe-result-{token}.json'
    error_output = PRIVATE / f'probe-error-{token}.log'
    for filename in (output, error_output):
        descriptor = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        os.close(descriptor)
    text = f'''[Unit]
Description=Nodia candidate read-only dependency check
After=network-online.target docker.service

[Service]
Type=oneshot
User=nodia
Group=nodia
WorkingDirectory={candidate}
EnvironmentFile=/etc/nodia/runtime.env
EnvironmentFile=/etc/nodia/redis.env
Environment=NODE_ENV=production
Environment=HOME=/var/lib/nodia/home
Environment=NODIA_CODEX_PROFILE_ROOT=/var/lib/nodia/codex
Environment=PGSSLMODE=verify-full
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/node {PROBE}
TimeoutStartSec=60
TimeoutStopSec=10
KillMode=control-group
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
CapabilityBoundingSet=
AmbientCapabilities=
ReadOnlyPaths=/var/lib/nodia/config
ReadWritePaths=/var/lib/nodia/home /var/lib/nodia/codex
UMask=0077
LimitFSIZE=4M
StandardOutput=file:{output}
StandardError=file:{error_output}
'''
    try:
        with unit_path.open('x', encoding='utf-8', newline='\n') as stream:
            stream.write(text)
        os.chmod(unit_path, 0o644)
        subprocess.run(['systemd-analyze', 'verify', str(unit_path)], capture_output=True, timeout=20, check=True)
        subprocess.run(['systemctl', 'daemon-reload'], capture_output=True, timeout=20, check=True)
        started = subprocess.run(['systemctl', 'start', '--wait', unit], capture_output=True, timeout=80, check=False)
        require(output.stat().st_size <= 16 * 1024, 'probe_result_too_large')
        result = validate_probe_result(output.read_bytes())
        require((started.returncode == 0) == (result['status'] == 'verified'), 'probe_exit_result_mismatch')
        services_stopped()
        atomic_json(STATE / 'dependency-result.json', result, 0o644)
        return result
    finally:
        cleanup_error = None
        try:
            cleanup_probe_unit(unit, unit_path)
        except Rejected as error:
            cleanup_error = error
        if error_output.exists():
            os.replace(error_output, PRIVATE / 'candidate-probe-stderr.log')
        if output.exists():
            output.unlink()
        if cleanup_error:
            raise cleanup_error


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('sha256')
    parser.add_argument('--stage-only', action='store_true')
    parser.add_argument('--allow-git-release', action='store_true',
                        help='Also accept exact git archives; staging remains isolated and does not activate services.')
    parser.add_argument('--probe-sha256')
    args = parser.parse_args(argv)
    require(os.geteuid() == 0 and sys.platform == 'linux', 'root_linux_required')
    require(HEX.fullmatch(args.sha256), 'invalid_archive_sha256')
    require(args.stage_only or HEX.fullmatch(args.probe_sha256 or ''), 'probe_sha256_required')
    root_directory(STATE)
    root_directory(PRIVATE, 0o700)
    root_directory(CANDIDATES)
    receipts = STATE / 'candidate-receipts'
    root_directory(receipts, 0o700)
    payload = {'schema_version': 1, 'archive_sha256': args.sha256, 'deployment_eligible': False,
               'application_started': False, 'migrations_executed': False}

    def status(phase, **fields):
        payload.update(phase=phase, updated_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), **fields)
        atomic_json(STATE / 'candidate-status.json', payload, 0o644)
        print(f'[Nodia candidate] {phase}', flush=True)

    private_archive = None
    staging = None
    staging_identity = None
    with (PRIVATE / 'candidate.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            services_stopped()
            status('copying_verified_input')
            private_archive = copy_uploaded(args.archive, args.sha256)
            status('validating_archive')
            with private_archive.open('rb') as stream, tarfile.open(fileobj=stream, mode='r:gz') as archive:
                plan = read_plan(archive, allow_git_release=args.allow_git_release)
                release_id = plan['manifest']['release_id']
                destination = CANDIDATES / release_id
                receipt_path = receipts / f'{release_id}.json'
                receipt = {'schema_version': 1, 'release_id': release_id, 'archive_sha256': args.sha256,
                           'manifest_sha256': plan['manifest_sha256'],
                           'source_provenance': plan['manifest']['source_provenance'],
                           'deployment_eligible': plan['manifest']['deployment_eligible'],
                           'files_verified': len(plan['expected'])}
                status('verifying_candidate', release_id=release_id, files_expected=len(plan['expected']),
                       source_sha=plan['manifest']['source_sha'],
                       source_provenance=plan['manifest']['source_provenance'],
                       deployment_eligible=plan['manifest']['deployment_eligible'])
                if destination.exists() or destination.is_symlink():
                    protected_file(receipt_path)
                    require(strict_json(receipt_path.read_bytes()) == receipt, 'existing_candidate_receipt_mismatch')
                    verify_tree(destination, plan)
                else:
                    staging = Path(tempfile.mkdtemp(prefix='.candidate-stage-', dir=CANDIDATES))
                    identity = staging.lstat()
                    staging_identity = (identity.st_dev, identity.st_ino, identity.st_uid)
                    extract_verified(archive, plan, staging)
                    require(not destination.exists() and not destination.is_symlink(), 'candidate_destination_appeared')
                    os.rename(staging, destination)
                    staging = None
                    os.chmod(destination, 0o755)
                    atomic_json(receipt_path, receipt, 0o600)
            status('candidate_staged', candidate_staged=True)
            if not args.stage_only:
                status('checking_dependencies')
                result = run_probe(destination, plan['manifest'], args.probe_sha256)
                status('dependencies_verified' if result['status'] == 'verified' else 'dependency_check_failed',
                       dependency_probe=result)
                return 0 if result['status'] == 'verified' else 1
            return 0
        except BaseException as error:
            code = str(error) if isinstance(error, Rejected) else 'interrupted' if isinstance(error, KeyboardInterrupt) else 'candidate_setup_failed'
            status('failed', error_code=code)
            return 1
        finally:
            if private_archive and private_archive.exists():
                private_archive.unlink()
            if staging is not None:
                cleanup_staging(staging, staging_identity)


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(Rejected('interrupted')))
    try:
        sys.exit(main())
    except Exception:
        print('[Nodia candidate] rejected before staging; inspect operator prerequisites.', file=sys.stderr)
        sys.exit(1)
