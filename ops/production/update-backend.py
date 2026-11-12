#!/usr/bin/env python3
"""Operator-only backend updater. Install reviewed assets first; default is plan.

No SSH/sudoers grant is made by this program. No seed, rebuild, rollback or retry.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import uuid
import zipfile

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
RELEASES = Path('/opt/nodia/releases')
CURRENT = Path('/opt/nodia/current')
UPLOAD = STATE / 'incoming'
MAINTENANCE = Path('/var/lib/nodia-maintenance/backend')
ENVIRONMENT = Path('/etc/nodia/backup-runner.env')
SERVICES = ('nodia-api.service', 'nodia-ai-worker.service')
TIMERS = ('nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer')
BACKUPS = ('nodia-ai-backup.service', 'nodia-ai-backup-rotate.service', 'nodia-ai-journal-reconcile.service')
SAFE_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'TZ': 'UTC'}
RELEASE = re.compile(r'backend-[a-f0-9]{12}-[a-f0-9]{12}')
HEX = re.compile(r'[a-f0-9]{64}')


def unique_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('duplicate_json_key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('invalid_json_number')))


def sha_file(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def protected(path, *, mode=None, directory=False):
    info = path.lstat()
    if path.resolve(strict=True) != path or info.st_uid != 0 or info.st_gid != 0 or info.st_mode & 0o022:
        raise ValueError('unsafe_protected_path')
    if directory:
        if not stat.S_ISDIR(info.st_mode): raise ValueError('directory_required')
    elif not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
        raise ValueError('regular_file_required')
    if mode is not None and stat.S_IMODE(info.st_mode) != mode:
        raise ValueError('protected_mode_mismatch')
    return info


def atomic_write(filename, content, mode=0o600):
    if filename.exists() or filename.is_symlink(): protected(filename, mode=mode)
    descriptor, temporary = tempfile.mkstemp(prefix='.backend-update-', dir=filename.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            os.fchmod(output.fileno(), mode)
            output.write(content); output.flush(); os.fsync(output.fileno())
        os.replace(temporary, filename)
        descriptor = os.open(filename.parent, os.O_RDONLY | os.O_DIRECTORY)
        try: os.fsync(descriptor)
        finally: os.close(descriptor)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def load_asset(name, expected):
    filename = LIB / name
    protected(filename, mode=0o644)
    if sha_file(filename) != expected: raise ValueError('updater_asset_changed')
    spec = importlib.util.spec_from_file_location('nodia_update_' + name.replace('-', '_'), filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Host:
    def __init__(self, policy, stage, settings):
        self.p, self.stage, self.settings = policy, stage, settings
        self.attempt = None
        self.request = self.candidate = self.current = None

    def must(self, condition, code): self.p.require(condition, code)

    def command(self, arguments, seconds=30):
        result = subprocess.run(arguments, env=SAFE_ENV, capture_output=True, timeout=seconds)
        if result.returncode:
            # Diagnostics remain private; never print the child stderr/connection details.
            if self.attempt:
                atomic_write(self.attempt / 'last-command.log', (result.stdout + result.stderr)[-1024 * 1024:])
            raise self.p.Rejected('host_command_failed_inspect_private_diagnostics')
        return result.stdout.decode('utf-8')

    def reserve(self, directory, required):
        # A point-in-time headroom gate, not a guarantee against unrelated disk writers.
        self.must(shutil.disk_usage(directory).free >= required + 2 * 1024 ** 3, 'insufficient_disk_headroom')

    def show(self, unit):
        values = self.command(['/usr/bin/systemctl', 'show', unit, '--no-pager',
            '--property=ActiveState,SubState,Result,MainPID,ExecMainCode,ExecMainStatus,ControlGroup,InvocationID,UnitFileState,DropInPaths'])
        return dict(line.split('=', 1) for line in values.splitlines() if '=' in line)

    def begin(self, request, state):
        protected(STATE, directory=True)
        protected(STATE / 'attempts', directory=True)
        self.must(not (STATE / 'BLOCKED.json').exists(), 'prior_update_requires_reconciliation')
        for previous in (STATE / 'attempts').iterdir():
            protected(previous, directory=True)
            status = previous / 'state.json'
            if status.exists():
                protected(status, mode=0o600)
                prior = unique_json(status.read_bytes())
                self.must(not prior.get('effects_started') or prior.get('phase') in ('complete', 'planned'),
                          'unfinished_update_requires_reconciliation')
        self.attempt = STATE / 'attempts' / request['operation_id']
        self.must(not self.attempt.exists(), 'operation_id_already_recorded')
        self.attempt.mkdir(mode=0o700)
        self.request = request
        atomic_write(self.attempt / 'request.json', (json.dumps(request, sort_keys=True) + '\n').encode())
        self.record(state)

    def record(self, state):
        atomic_write(self.attempt / 'state.json', (json.dumps(state, sort_keys=True) + '\n').encode())

    def block(self, state):
        atomic_write(STATE / 'BLOCKED.json', (json.dumps({'operation_id': state['operation_id'],
            'failed_phase': state['failed_phase'], 'error_code': state['error_code']}) + '\n').encode())

    def copy_input(self, directory, name, digest, maximum):
        self.must(isinstance(name, str) and re.fullmatch(r'[a-zA-Z0-9_.-]+', name) and '/' not in name and
                  isinstance(digest, str) and HEX.fullmatch(digest), 'invalid_artifact_child')
        source = directory / name
        descriptor = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
        try:
            for part in source.parts[1:-1]:
                following = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
                os.close(descriptor); descriptor = following
            file = os.open(source.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=descriptor)
        finally: os.close(descriptor)
        target = self.attempt / name
        with os.fdopen(file, 'rb') as incoming:
            info = os.fstat(incoming.fileno())
            self.must(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= maximum,
                      'invalid_artifact_upload')
            self.reserve(self.attempt, info.st_size)
            h, copied = hashlib.sha256(), 0
            with target.open('xb') as output:
                os.fchmod(output.fileno(), 0o600)
                for block in iter(lambda: incoming.read(1024 * 1024), b''):
                    copied += len(block)
                    self.must(copied <= maximum, 'artifact_upload_too_large')
                    h.update(block); output.write(block)
                output.flush(); os.fsync(output.fileno())
            self.must(copied == info.st_size and h.hexdigest() == digest, 'artifact_upload_digest_mismatch')
        return target

    def github(self, resource):
        url = 'https://api.github.com/repos/oscarvalenzuela25/Nodia/' + resource
        request = urllib.request.Request(url, headers={'User-Agent': 'Nodia-reviewed-updater',
                                                      'Accept': 'application/vnd.github+json'})
        with urllib.request.urlopen(request, timeout=15) as response:
            self.must(response.url == url and response.status == 200, 'github_verification_failed')
            raw = response.read(1024 * 1024 + 1)
        self.must(len(raw) <= 1024 * 1024, 'github_response_too_large')
        return unique_json(raw)

    def verify_ci(self, ci, source):
        self.must(set(ci) == {'repository', 'run_id', 'run_attempt', 'event', 'ref'} and
                  ci['repository'] == 'oscarvalenzuela25/Nodia' and ci['event'] == 'push' and
                  ci['ref'] == 'refs/heads/master' and all(isinstance(ci[key], str) and
                  re.fullmatch(r'[1-9][0-9]{0,19}', ci[key]) for key in ('run_id', 'run_attempt')),
                  'production_ci_metadata_required')
        run = self.github('actions/runs/' + ci['run_id'])
        self.must(run.get('head_sha') == source and run.get('event') == 'push' and run.get('head_branch') == 'master' and
                  run.get('status') == 'completed' and run.get('conclusion') == 'success' and
                  run.get('run_attempt') == int(ci['run_attempt']) and run.get('path') == '.github/workflows/ci.yml' and
                  run.get('repository', {}).get('full_name') == ci['repository'], 'successful_final_ci_run_required')
        branch = self.github('git/ref/heads/master')
        self.must(branch.get('object', {}).get('sha') == source and branch['object'].get('type') == 'commit',
                  'candidate_is_not_current_master')

    def official_artifact_ci(self, official, request):
        self.must(type(official.get('id')) is int and official.get('id') == int(request['artifact_id']) and official.get('expired') is False and
                  official.get('digest') == 'sha256:' + request['artifact_zip_sha256'] and
                  official.get('workflow_run', {}).get('head_sha') == request['source_sha'] and
                  official.get('workflow_run', {}).get('head_branch') == 'master',
                  'github_artifact_digest_or_source_mismatch')
        name = re.fullmatch(r'server-([a-f0-9]{40})-([1-9][0-9]{0,19})-([1-9][0-9]{0,19})', official.get('name', ''))
        self.must(name and name[1] == request['source_sha'] and
                  int(name[2]) == official['workflow_run'].get('id') and
                  request['artifact_directory'] == f'server-{name[2]}-{name[3]}', 'github_artifact_name_mismatch')
        return {'repository': 'oscarvalenzuela25/Nodia', 'run_id': name[2], 'run_attempt': name[3],
                'event': 'push', 'ref': 'refs/heads/master'}

    def extract_authenticated_zip(self, filename, official, request):
        self.must(sha_file(filename) == request['artifact_zip_sha256'], 'github_zip_digest_changed')
        ci = self.official_artifact_ci(official, request)
        with zipfile.ZipFile(filename) as archive:
            members = archive.infolist()
            names = [entry.filename for entry in members]
            self.must(len(members) == 4 and len(set(names)) == 4 and 'artifact-result.json' in names and
                      all(re.fullmatch(r'[a-zA-Z0-9_.-]+', entry.filename) and not entry.is_dir() and
                          entry.flag_bits & 1 == 0 and entry.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) and
                          stat.S_IFMT(entry.external_attr >> 16) in (0, stat.S_IFREG) for entry in members),
                      'github_zip_inventory_invalid')
            result_info = archive.getinfo('artifact-result.json')
            self.must(result_info.file_size <= 64 * 1024, 'artifact_result_too_large')
            result = unique_json(archive.read(result_info))
            release_id = result.get('release_id', '')
            self.must(isinstance(release_id, str) and RELEASE.fullmatch(release_id), 'zip_release_identity_invalid')
            expected = {'artifact-result.json', 'build-metadata.json', release_id + '.tar.gz', release_id + '.manifest.json'}
            self.must(set(names) == expected and result.get('ci', {}).get('run_id') == ci['run_id'] and
                      result['ci'].get('run_attempt') == ci['run_attempt'], 'zip_run_identity_mismatch')
            self.must(sum(item.file_size for item in members) <= self.stage.MAX_ARCHIVE + self.stage.MAX_MANIFEST + 128 * 1024,
                      'github_zip_expansion_limit')
            self.reserve(self.attempt, sum(item.file_size for item in members))
            for item in members:
                limit = self.stage.MAX_ARCHIVE if item.filename.endswith('.tar.gz') else self.stage.MAX_MANIFEST
                if item.filename in ('artifact-result.json', 'build-metadata.json'): limit = 64 * 1024
                self.must(0 < item.file_size <= limit, 'github_zip_member_limit')
                count = 0
                with archive.open(item) as incoming, (self.attempt / item.filename).open('xb') as output:
                    os.fchmod(output.fileno(), 0o600)
                    for chunk in iter(lambda: incoming.read(1024 * 1024), b''):
                        count += len(chunk); self.must(count <= limit, 'github_zip_member_limit'); output.write(chunk)
                    output.flush(); os.fsync(output.fileno())
                self.must(count == item.file_size, 'github_zip_member_size_mismatch')
        return result

    def manifest(self, directory):
        protected(directory, directory=True)
        filename = directory / 'release-manifest.json'
        protected(filename, mode=0o644)
        value = self.stage.strict_json(filename.read_bytes())
        self.must(set(value) == self.stage.MANIFEST_KEYS and value.get('schema_version') == 1 and value.get('source_provenance') == 'git_archive' and
                  value.get('deployment_eligible') is True and value.get('release_id') == directory.name and
                  RELEASE.fullmatch(directory.name), 'installed_release_manifest_invalid')
        files = value['files']
        self.must(hashlib.sha256(json.dumps(files, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest() ==
                  value['package_tree_sha256'], 'installed_inventory_hash_mismatch')
        nodes = {'': {'type': 'directory'}, 'release-manifest.json': {'type': 'file'}}
        expected = {}
        for entry in files:
            name = self.stage.relative_name(entry['path'])
            self.must(name not in nodes and name != 'release-manifest.json', 'installed_inventory_duplicate')
            for parent in self.stage.parent_names(name):
                self.must(parent not in nodes or nodes[parent]['type'] == 'directory', 'installed_parent_invalid')
                nodes[parent] = {'type': 'directory'}
            nodes[name] = {'type': entry['type']}
            if entry['type'] == 'symlink': nodes[name]['target'] = entry['target']
            expected[name] = entry
        self.stage.validate_links(nodes)
        self.stage.verify_tree(directory, {'nodes': nodes, 'expected': expected, 'manifest_sha256': sha_file(filename)})
        return value

    def verify_writers(self, release):
        groups = {}
        import pwd
        uid = pwd.getpwnam('nodia').pw_uid
        for unit in SERVICES:
            state = self.show(unit)
            self.must(state.get('ActiveState') == 'active' and state.get('SubState') == 'running' and
                      state.get('Result') == 'success' and state.get('MainPID', '').isdigit() and
                      int(state['MainPID']) > 1 and state.get('DropInPaths') == '', 'writers_not_running_or_overridden')
            process = Path('/proc') / state['MainPID']
            self.must(process.stat().st_uid == uid and (process / 'cwd').resolve(strict=True) == release,
                      'writer_identity_or_release_mismatch')
            expected_entry = 'dist/main.js' if unit == 'nodia-api.service' else 'dist/nodia-ai-worker.js'
            self.must(os.path.samefile(process / 'exe', '/usr/local/bin/node') and
                      (process / 'cmdline').read_bytes().split(b'\0') ==
                      [b'/usr/local/bin/node', expected_entry.encode(), b''], 'writer_executable_mismatch')
            group = state.get('ControlGroup', '')
            self.must(group == '/system.slice/' + unit, 'writer_cgroup_invalid')
            groups[unit] = group
        return groups

    def backup_environment(self, release):
        protected(ENVIRONMENT, mode=0o600)
        values = dict(line.split('=', 1) for line in ENVIRONMENT.read_text().splitlines() if line and not line.startswith('#'))
        expected = {'NODIA_AI_BACKUP_SCRIPT': str(release / 'scripts/nodia-ai-backups.mjs'),
                    'NODIA_AI_JOURNAL_SCRIPT': str(release / 'scripts/nodia-ai-journal.mjs'),
                    'NODIA_AI_BACKUP_CONFIG': '/var/lib/nodia/config/backup.json',
                    'NODIA_AI_RECOVERY_CONFIG': '/var/lib/nodia/config/recovery.json'}
        self.must(values == expected, 'backup_runner_release_mismatch')
        return expected

    def prepare(self, request):
        self.must(CURRENT.is_symlink(), 'current_release_missing')
        self.must(CURRENT.lstat().st_uid == CURRENT.lstat().st_gid == 0, 'current_link_owner_invalid')
        protected(RELEASES, directory=True)
        self.current = CURRENT.resolve(strict=True)
        self.must(self.current.parent == RELEASES and self.current.name == request['expected_current_release'],
                  'expected_current_release_mismatch')
        old = self.manifest(self.current)
        self.must(old['package_tree_sha256'] == request['expected_current_tree_sha256'], 'current_tree_mismatch')
        for name, digest in self.settings['service_hashes'].items():
            unit = Path('/etc/systemd/system') / name
            protected(unit, mode=0o644)
            self.must(sha_file(unit) == digest and self.show(name).get('DropInPaths') == '', 'installed_service_changed_or_overridden')
        site = Path('/etc/nginx/sites-available/nodia-api.conf')
        protected(site, mode=0o644)
        enabled = Path('/etc/nginx/sites-enabled/nodia-api.conf')
        protected(enabled.parent, directory=True)
        self.must(enabled.is_symlink() and enabled.lstat().st_uid == enabled.lstat().st_gid == 0 and
                  enabled.resolve(strict=True) == site, 'reviewed_proxy_not_enabled')
        self.must(sha_file(site) == self.settings['nginx_site_sha256'] and not MAINTENANCE.exists(),
                  'maintenance_hook_missing_or_already_active')
        protected(MAINTENANCE.parent, directory=True)
        self.command(['/usr/sbin/nginx', '-t'])
        self.groups = self.verify_writers(self.current)
        self.backup_environment(self.current)
        directory = UPLOAD / request['artifact_directory']
        archive_zip = self.copy_input(directory, request['artifact_id'] + '.zip', request['artifact_zip_sha256'],
                                      self.stage.MAX_ARCHIVE + self.stage.MAX_MANIFEST + 1024 * 1024)
        official = self.github('actions/artifacts/' + request['artifact_id'])
        trusted_ci = self.official_artifact_ci(official, request)
        # Reject failed/PR/obsolete CI before parsing its uploaded ZIP as root.
        self.verify_ci(trusted_ci, request['source_sha'])
        result = self.extract_authenticated_zip(archive_zip, official, request)
        release_id = result.get('release_id', '')
        self.must(result.get('schema_version') == 1 and result.get('component') == 'server' and
                  result.get('source_sha') == request['source_sha'] and result.get('production_eligible') is True and
                  result.get('build_invoked_by_packager') is False and isinstance(release_id, str) and
                  RELEASE.fullmatch(release_id) and result.get('archive_file') == release_id + '.tar.gz' and
                  result.get('manifest_file') == release_id + '.manifest.json' and
                  result.get('metadata_file') == 'build-metadata.json', 'production_server_artifact_required')
        archive_file = self.attempt / result['archive_file']
        manifest_file = self.attempt / result['manifest_file']
        metadata_file = self.attempt / 'build-metadata.json'
        self.must(all(sha_file(filename) == expected for filename, expected in
                  ((archive_file, result['archive_sha256']), (manifest_file, result['manifest_sha256']),
                   (metadata_file, result['metadata_sha256']))), 'authenticated_bundle_digest_mismatch')
        metadata = unique_json(metadata_file.read_bytes())
        for name in ('component', 'source_sha', 'release_id', 'package_tree_sha256', 'archive_sha256',
                     'manifest_sha256', 'archive_file', 'manifest_file', 'production_eligible', 'ci'):
            self.must(metadata.get(name) == result.get(name), 'artifact_metadata_mismatch')
        self.must(metadata['ci'] == trusted_ci, 'authenticated_ci_identity_mismatch')
        with tarfile.open(archive_file, mode='r:gz') as archive:
            plan = self.stage.read_plan(archive, allow_git_release=True)
            self.must(plan['manifest_bytes'] == manifest_file.read_bytes() and plan['manifest']['release_id'] == release_id and
                      plan['manifest']['source_sha'] == request['source_sha'] and
                      plan['manifest']['package_tree_sha256'] == result['package_tree_sha256'] and
                      plan['manifest']['source']['archive_sha256'] == metadata.get('source_archive_sha256') and
                      plan['manifest']['source']['source_manifest_sha256'] == metadata.get('source_manifest_sha256'),
                      'archive_identity_mismatch')
            runtime = plan['manifest']['runtime']
            self.must(runtime.get('node') == 'v24.22.2' and runtime.get('platform') == 'linux' and
                      runtime.get('arch') == 'x64' and runtime.get('executable_sha256') == sha_file(Path('/usr/local/bin/node')),
                      'host_node_runtime_mismatch')
            self.candidate = RELEASES / release_id
            if self.candidate.exists(): self.stage.verify_tree(self.candidate, plan)
            else:
                self.reserve(RELEASES, sum(node['member'].size for node in plan['nodes'].values() if node['type'] == 'file'))
                temporary = Path(tempfile.mkdtemp(prefix='.update-stage-', dir=RELEASES))
                self.stage.extract_verified(archive, plan, temporary)
                os.chmod(temporary, 0o755)
                os.rename(temporary, self.candidate)
                self.stage.verify_tree(self.candidate, plan)
        self.metadata = metadata
        self.must(self.node_action('inspect').get('read_only') is True, 'database_preflight_not_read_only')
        self.probe_candidate()
        return {'candidate_release': release_id, 'source_sha': request['source_sha']}

    def node_job(self, action, arguments, seconds=60):
        token = uuid.uuid4().hex
        unit = 'nodia-update-action-' + token + '.service'
        unit_file = Path('/run/systemd/system') / unit
        output, error = self.attempt / (token + '.json'), self.attempt / (token + '.log')
        for filename in (output, error):
            with filename.open('xb') as stream: os.fchmod(stream.fileno(), 0o600)
        content = f'''[Unit]
Description=Nodia isolated backend update action
[Service]
Type=oneshot
User=nodia
Group=nodia
WorkingDirectory={self.candidate}
EnvironmentFile=/etc/nodia/runtime.env
EnvironmentFile=/etc/nodia/redis.env
Environment=NODE_ENV=production
Environment=HOME=/var/lib/nodia/home
Environment=PGSSLMODE=verify-full
Environment=DOTENV_CONFIG_PATH=/dev/null
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/node {action} {' '.join(arguments)}
TimeoutStartSec={seconds}s
TimeoutStopSec=10s
KillMode=control-group
UMask=0077
NoNewPrivileges=true
CapabilityBoundingSet=
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadOnlyPaths=/var/lib/nodia/config /opt/nodia
LimitFSIZE=2M
StandardOutput=file:{output}
StandardError=file:{error}
'''
        with unit_file.open('x') as stream:
            os.fchmod(stream.fileno(), 0o644); stream.write(content)
        self.command(['/usr/bin/systemd-analyze', 'verify', str(unit_file)])
        self.command(['/usr/bin/systemctl', 'daemon-reload'])
        try:
            self.command(['/usr/bin/systemctl', 'start', '--wait', unit], seconds + 20)
            state = self.show(unit)
            self.must(state.get('ActiveState') == 'inactive' and state.get('Result') == 'success' and
                      state.get('MainPID') == '0' and state.get('ExecMainStatus') == '0' and
                      self.cgroup_empty('/system.slice/' + unit), 'node_action_not_complete')
            self.must(output.stat().st_size <= 1024 * 1024, 'node_action_output_too_large')
            return unique_json(output.read_bytes())
        finally:
            state = self.show(unit)
            if state.get('MainPID') == '0' and state.get('ActiveState') in ('inactive', 'failed') and self.cgroup_empty('/system.slice/' + unit):
                if state['ActiveState'] == 'failed':
                    self.command(['/usr/bin/systemctl', 'reset-failed', unit])
                unit_file.unlink()
                self.command(['/usr/bin/systemctl', 'daemon-reload'])

    def node_action(self, mode):
        value = self.node_job(LIB / 'update-backend-action.mjs', [mode, str(self.current), str(self.candidate)],
                              600 if mode == 'migrate' else 60)
        self.must(value.get('status') == ('migrated' if mode == 'migrate' else 'verified') and
                  value.get('client_tls_authorized') is True, 'database_action_rejected')
        return value

    def probe_candidate(self):
        value = self.node_job(LIB / 'probe-backend-dependencies.mjs', [])
        checked = self.stage.validate_probe_result(json.dumps(value).encode())
        self.must(checked.get('status') == 'verified', 'candidate_dependencies_not_verified')

    def pause_timers(self):
        before = {unit: {'active': self.show(unit).get('ActiveState') == 'active',
                         'enabled': self.show(unit).get('UnitFileState')} for unit in TIMERS}
        atomic_write(self.attempt / 'timers-before.json', (json.dumps(before) + '\n').encode())
        self.command(['/usr/bin/systemctl', 'stop', *TIMERS])
        deadline = time.monotonic() + 400
        while any(self.show(unit).get('ActiveState') in ('active', 'activating', 'deactivating') for unit in BACKUPS):
            self.must(time.monotonic() < deadline, 'backup_units_still_busy')
            time.sleep(1)
        return before

    def maintenance(self, enabled):
        if enabled:
            if MAINTENANCE.exists() or MAINTENANCE.is_symlink():
                protected(MAINTENANCE, mode=0o644)
                self.must(MAINTENANCE.read_text().strip() == self.request['operation_id'], 'another_maintenance_owner')
            atomic_write(MAINTENANCE, (self.request['operation_id'] + '\n').encode(), 0o644)
        else:
            protected(MAINTENANCE, mode=0o644)
            self.must(MAINTENANCE.read_text().strip() == self.request['operation_id'], 'maintenance_owner_mismatch')
            MAINTENANCE.unlink()
        expected = 503 if enabled else 200
        self.http('https://166.0.112.187/api/v1', expected)

    def http(self, url, status):
        import urllib.error
        try:
            with urllib.request.urlopen(url, timeout=15) as response:
                self.must(response.status == status and response.url == url, 'http_smoke_mismatch')
        except urllib.error.HTTPError as error:
            self.must(error.code == status and error.url == url, 'http_smoke_mismatch')

    def backup(self):
        self.verify_writers(self.current)
        self.reserve(Path('/var/lib/nodia/backups/spool'), 512 * 1024 ** 2)
        previous = self.show('nodia-ai-backup.service').get('InvocationID')
        cursor_log = self.command(['/usr/bin/journalctl', '-u', 'nodia-ai-backup.service', '-n', '1',
                                   '--show-cursor', '--no-pager', '-o', 'json'])
        cursors = [line.removeprefix('-- cursor: ') for line in cursor_log.splitlines() if line.startswith('-- cursor: ')]
        self.must(len(cursors) == 1 and 0 < len(cursors[0]) < 2048 and '\n' not in cursors[0],
                  'backup_journal_cursor_required')
        started = datetime.datetime.now(datetime.timezone.utc)
        self.command(['/usr/bin/systemctl', 'start', '--wait', 'nodia-ai-backup.service'], 500)
        state = self.show('nodia-ai-backup.service')
        self.must(state.get('ActiveState') == 'inactive' and state.get('Result') == 'success' and
                  state.get('ExecMainStatus') == '0' and state.get('MainPID') == '0', 'fresh_backup_invocation_required')
        raw = self.command(['/usr/bin/journalctl', '-u', 'nodia-ai-backup.service', '--after-cursor=' + cursors[0],
                            '--no-pager', '-o', 'json'])
        self.must(len(raw.encode()) <= 2 * 1024 * 1024, 'backup_journal_too_large')
        message = self.p.fresh_backup_message([unique_json(line) for line in raw.splitlines()], previous)
        return self.p.validate_backup_result(message, started_at=started, now=datetime.datetime.now(datetime.timezone.utc))

    def require_quiescent(self, stopped):
        deadline = time.monotonic() + (1 if stopped else 120)
        while True:
            result = self.node_action('inspect')
            if result.get('quiescent') is True: return
            self.must(not stopped and time.monotonic() < deadline, 'live_or_unconfirmed_runtime_work')
            time.sleep(1)

    def stop_writers(self):
        self.command(['/usr/bin/systemctl', 'stop', *SERVICES], 400)
        for unit in SERVICES:
            state = self.show(unit)
            self.must(state.get('ActiveState') == 'inactive' and state.get('Result') == 'success' and
                      state.get('MainPID') == '0' and state.get('ExecMainStatus') == '0' and
                      state.get('ExecMainCode') in ('0', '1'), 'writer_shutdown_not_clean')
            self.must(self.cgroup_empty(self.groups[unit]), 'writer_cgroup_not_empty')

    def cgroup_empty(self, name):
        self.must(re.fullmatch(r'/system.slice/nodia-(?:api|ai-worker|update-action-[a-f0-9]{32})\.service', name),
                  'invalid_unit_cgroup')
        group = Path('/sys/fs/cgroup') / name.lstrip('/')
        return not group.exists() or not any(file.read_text().strip() for file in group.rglob('cgroup.procs'))

    def migrate_once(self): return self.node_action('migrate')

    def switch_release(self):
        self.backup_environment(self.current)
        atomic_write(self.attempt / 'backup-runner-before.env', ENVIRONMENT.read_bytes())
        values = {'NODIA_AI_BACKUP_SCRIPT': str(self.candidate / 'scripts/nodia-ai-backups.mjs'),
                  'NODIA_AI_JOURNAL_SCRIPT': str(self.candidate / 'scripts/nodia-ai-journal.mjs'),
                  'NODIA_AI_BACKUP_CONFIG': '/var/lib/nodia/config/backup.json',
                  'NODIA_AI_RECOVERY_CONFIG': '/var/lib/nodia/config/recovery.json'}
        atomic_write(ENVIRONMENT, ''.join(f'{key}={value}\n' for key, value in values.items()).encode())
        link = CURRENT.with_name('.current-update-' + self.request['operation_id'])
        self.must(CURRENT.resolve(strict=True) == self.current and not link.exists() and not link.is_symlink(),
                  'current_changed_during_update')
        os.symlink(str(self.candidate), link)
        os.replace(link, CURRENT)
        self.backup_environment(self.candidate)

    def start_and_verify(self):
        self.command(['/usr/bin/systemctl', 'start', *SERVICES], 220)
        deadline = time.monotonic() + 60
        while True:
            try:
                self.verify_writers(self.candidate)
                self.http('http://127.0.0.1:3000/api/v1', 200)
                break
            except Exception as error:
                if isinstance(error, self.p.Rejected) and str(error) == 'operator_interrupted': raise
                self.must(time.monotonic() < deadline, 'writers_readiness_failed')
                time.sleep(1)
        self.must(self.node_action('verify').get('read_only') is True, 'poststart_ledger_not_verified')
        self.probe_candidate()

    def public_smoke(self): self.http('https://166.0.112.187/api/v1', 200)

    def restore_timers(self, before):
        for unit, state in before.items():
            if state['active']: self.command(['/usr/bin/systemctl', 'start', unit])
            actual = self.show(unit)
            self.must((actual.get('ActiveState') == 'active') == state['active'] and
                      actual.get('UnitFileState') == state['enabled'], 'timer_state_not_restored')

    def finish(self, request, _prepared, state):
        atomic_write(STATE / 'deployed-backend.json', (json.dumps({'schema_version': 1,
            'release_id': self.candidate.name, 'source_sha': request['source_sha'],
            'package_tree_sha256': self.metadata['package_tree_sha256'], 'ci': self.metadata['ci'],
            'backup': state['backup']}) + '\n').encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--request', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0 or Path(__file__).resolve() != LIB / 'update-backend.py':
        raise ValueError('installed_root_updater_required')
    protected(LIB, directory=True)
    protected(STATE / 'settings.json', mode=0o600)
    settings = unique_json((STATE / 'settings.json').read_bytes())
    policy = load_asset('backend_update.py', settings['assets']['backend_update.py'])
    def interrupted(_signal, _frame): raise policy.Rejected('operator_interrupted')
    for name in (signal.SIGINT, signal.SIGTERM): signal.signal(name, interrupted)
    stage = load_asset('stage-backend-candidate.py', settings['assets']['stage-backend-candidate.py'])
    for name, digest in settings['assets'].items():
        protected(LIB / name, mode=0o644)
        policy.require(sha_file(LIB / name) == digest, 'updater_asset_changed')
    import fcntl
    lock = Path('/var/lib/nodia-backend-setup/installation.lock')
    info = protected(lock, mode=0o600)
    policy.require(info.st_size == 0, 'installation_lock_invalid')
    with lock.open('r+b') as stream:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        policy.require(args.request.parent == STATE / 'requests', 'protected_request_directory_required')
        protected(args.request.parent, directory=True)
        protected(args.request, mode=0o600)
        descriptor = os.open(args.request, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(descriptor, 'rb') as stream:
            info = os.fstat(stream.fileno())
            policy.require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_uid == info.st_gid == 0 and
                           0 < info.st_size <= 16 * 1024, 'invalid_request_file')
            raw = stream.read(16 * 1024 + 1)
        policy.require(len(raw) <= 16 * 1024, 'request_too_large')
        request = policy.validate_request(unique_json(raw))
        host = Host(policy, stage, settings)
        result = policy.run_update(request, host, apply=args.apply)
        print(json.dumps(result))


if __name__ == '__main__':
    try: main()
    except Exception as error:
        code = str(error) if re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'updater_failed_inspect_private_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False, 'automatic_rollback_requested': False}))
        sys.exit(1)
