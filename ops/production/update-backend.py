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
PUBLIC_API = 'https://166.0.112.187/api/v1'
PAGES_ORIGIN = 'https://nodia-1ge.pages.dev'
SERVICES = ('nodia-api.service', 'nodia-ai-worker.service')
TIMERS = ('nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer')
BACKUPS = ('nodia-ai-backup.service', 'nodia-ai-backup-rotate.service', 'nodia-ai-journal-reconcile.service')
SAFE_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'TZ': 'UTC'}
RELEASE = re.compile(r'backend-[a-f0-9]{12}-[a-f0-9]{12}')
HEX = re.compile(r'[a-f0-9]{64}')
SYSTEMD_UNITS = Path('/etc/systemd/system')
AI_CONSUMERS = Path('/etc/nodia/ai-runtime/consumers.json')
# Explicitly reviewed runtime-only extensions. This is not a generic permission
# for root-owned drop-ins: ExecStart/User/environment and all unknown bytes reject.
AI_RUNTIME_TEMPLATES = {
    '70-codex-runtime.conf': (
        b'[Unit]\nWants=nodia-codex-keyring.service\nAfter=nodia-codex-keyring.service\n\n'
        b'[Service]\nEnvironment=NODIA_CODEX_ENABLED=true\n'
        b'Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/nodia-codex/bus\n'
        b'Environment=XDG_RUNTIME_DIR=/run/nodia-codex\n'),
    '71-gemini-runtime.conf': (
        b'[Unit]\nWants=nodia-gemini.service\nAfter=nodia-gemini.service\n'),
}
AI_RUNTIME_HASHES = {name: hashlib.sha256(value).hexdigest()
                     for name, value in AI_RUNTIME_TEMPLATES.items()}
TEACHER_RUNTIME_TEMPLATE = b'[Service]\nEnvironmentFile=/etc/nodia/teacher-runtime.env\n'
TEACHER_RUNTIME_NAME = '72-teacher-runtime.conf'
TEACHER_ENVIRONMENT = Path('/etc/nodia/teacher-runtime.env')
TEACHER_HOST_ROOT = Path('/usr/local/lib/nodia/teacher-runtime')
CODEX_CV_RUNTIME_TEMPLATE = b'[Service]\nEnvironmentFile=/etc/nodia/codex-cv-runtime.env\n'
CODEX_CV_RUNTIME_NAME = '73-codex-cv-runtime.conf'
CODEX_CV_ENVIRONMENT = Path('/etc/nodia/codex-cv-runtime.env')
CODEX_CV_ROOT = LIB / 'codex-cv-runtime'
CODEX_CV_ACTIVE = CODEX_CV_ROOT / 'active.json'
CODEX_CV_CLI = Path('node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex')
CODEX_CV_VARIABLES = (b'NODIA_CODEX_CV_HOST', b'NODIA_CODEX_CV_HOST_SHA512', b'NODIA_CODEX_CV_CATALOG_SHA512')


def teacher_runtime_descriptor():
    """Only two exact Teacher environment entries and their immutable host."""
    for parent in reversed(TEACHER_ENVIRONMENT.parents):
        protected(parent, directory=True)
    info = protected(TEACHER_ENVIRONMENT, mode=0o644)
    if not 0 < info.st_size < 512:
        raise ValueError('teacher_runtime_environment_invalid')
    raw = TEACHER_ENVIRONMENT.read_bytes()
    match = re.fullmatch(rb'NODIA_CODEX_TEACHER_HOST=/usr/local/lib/nodia/teacher-runtime/host-([a-f0-9]{128})\n'
                         rb'NODIA_CODEX_TEACHER_HOST_SHA512=([a-f0-9]{128})\n', raw)
    if not match or match[1] != match[2]:
        raise ValueError('teacher_runtime_environment_invalid')
    digest = match[1].decode('ascii')
    target = TEACHER_HOST_ROOT / ('host-' + digest)
    for parent in reversed(target.parents):
        protected(parent, directory=True)
    info = protected(target, mode=0o755)
    if not 0 < info.st_size <= 1024 ** 3:
        raise ValueError('teacher_runtime_binary_invalid')
    with target.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha512').hexdigest()
    if actual != digest:
        raise ValueError('teacher_runtime_binary_changed')
    return {'environment_sha256': hashlib.sha256(raw).hexdigest(), 'binary_sha512': digest}


def validate_codex_cv_proof(value):
    patterns = {'source_sha': '[a-f0-9]{40}', 'source_tree_sha': '[a-f0-9]{40}',
                'binary_sha512': '[a-f0-9]{128}', 'catalog_sha512': '[a-f0-9]{128}',
                'manifest_sha256': '[a-f0-9]{64}'}
    if (type(value) is not dict or set(value) != {'schema_version', *patterns}
            or type(value['schema_version']) is not int or value['schema_version'] != 1
            or not all(type(value[key]) is str and re.fullmatch(pattern, value[key])
                       for key, pattern in patterns.items())):
        raise ValueError('codex_cv_runtime_attestation_invalid')
    return value


def codex_cv_host_path(proof):
    return CODEX_CV_ROOT / ('host-' + validate_codex_cv_proof(proof)['binary_sha512'])


def codex_cv_environment_bytes(proof):
    target = codex_cv_host_path(proof)
    values = (os.fsencode(target), proof['binary_sha512'].encode(), proof['catalog_sha512'].encode())
    return b''.join(key + b'=' + value + b'\n' for key, value in zip(CODEX_CV_VARIABLES, values))


def codex_cv_checked_file(path, mode, maximum):
    for parent in reversed(path.parents):
        protected(parent, directory=True)
    size = protected(path, mode=mode).st_size
    if not 0 < size <= maximum:
        raise ValueError('codex_cv_runtime_file_size_invalid')
    return path


def codex_cv_executable(proof, path, hash_key):
    checked = codex_cv_checked_file(path, 0o755, 1024 ** 3)
    with checked.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha512').hexdigest()
    if actual != proof[hash_key]:
        raise ValueError('codex_cv_runtime_binary_changed')
    return checked


def codex_cv_installed_host(proof):
    target = codex_cv_host_path(proof)
    manifest = codex_cv_checked_file(target.with_suffix('.manifest.json'), 0o644, 128 * 1024)
    if sha_file(manifest) != proof['manifest_sha256']:
        raise ValueError('codex_cv_runtime_manifest_changed')
    return codex_cv_executable(proof, target, 'binary_sha512')


def codex_cv_runtime_descriptor():
    receipt = codex_cv_checked_file(CODEX_CV_ACTIVE, 0o644, 4096)
    proof = validate_codex_cv_proof(unique_json(receipt.read_bytes()))
    env = codex_cv_checked_file(CODEX_CV_ENVIRONMENT, 0o644, 1024)
    if env.read_bytes() != codex_cv_environment_bytes(proof):
        raise ValueError('codex_cv_runtime_environment_changed')
    codex_cv_installed_host(proof)
    return proof


def ai_runtime_registry(value):
    """Exact base extensions and independently pinned optional hosts."""
    hashes = dict(AI_RUNTIME_HASHES)
    expected = {'schema_version': 1, 'purpose': 'nodia_ai_runtime_consumers',
                'units': {name: hashes for name in SERVICES}}
    if type(value) is dict and 'teacher_host' in value:
        host = value['teacher_host']
        if (type(host) is not dict or set(host) != {'environment_sha256', 'binary_sha512'}
                or not isinstance(host['environment_sha256'], str) or not HEX.fullmatch(host['environment_sha256'])
                or not isinstance(host['binary_sha512'], str) or not re.fullmatch('[a-f0-9]{128}', host['binary_sha512'])):
            raise ValueError('ai_runtime_registry_invalid')
        hashes[TEACHER_RUNTIME_NAME] = hashlib.sha256(TEACHER_RUNTIME_TEMPLATE).hexdigest()
        expected['teacher_host'] = host
    if type(value) is dict and 'codex_cv_runtime' in value:
        expected['codex_cv_runtime'] = validate_codex_cv_proof(value['codex_cv_runtime'])
        hashes[CODEX_CV_RUNTIME_NAME] = hashlib.sha256(CODEX_CV_RUNTIME_TEMPLATE).hexdigest()
    if type(value) is not dict or type(value.get('schema_version')) is not int or value != expected:
        raise ValueError('ai_runtime_registry_invalid')
    return value


def clean_writer_shutdown(state):
    """Accept a zero exit or the reviewed SIGTERM, never another signal/failure.

    ExecMainCode uses waitid codes: 1=CLD_EXITED, 2=CLD_KILLED. Nest can
    re-send SIGTERM after closing its resources; systemd records success/2/15.
    This observation does not replace DB quiescence or an empty process cgroup.
    """
    return (isinstance(state, dict) and state.get('ActiveState') == 'inactive' and
            state.get('Result') == 'success' and state.get('MainPID') == '0' and
            (state.get('ExecMainCode'), state.get('ExecMainStatus')) in
            (('0', '0'), ('1', '0'), ('2', str(signal.SIGTERM))))


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


def registered_ai_runtimes():
    if not (AI_CONSUMERS.exists() or AI_CONSUMERS.is_symlink()):
        return None, None
    for parent in reversed(AI_CONSUMERS.parents):
        protected(parent, directory=True)
    info = protected(AI_CONSUMERS, mode=0o600)
    if not 0 < info.st_size <= 16384:
        raise ValueError('ai_runtime_registry_size_invalid')
    raw = AI_CONSUMERS.read_bytes()
    return ai_runtime_registry(unique_json(raw)), hashlib.sha256(raw).hexdigest()


def codex_cv_process_environment(pid, expected):
    with (Path('/proc') / pid / 'environ').open('rb') as stream:
        raw = stream.read(1024 * 1024 + 1)
    if len(raw) > 1024 * 1024 or not raw.endswith(b'\0'):
        raise ValueError('codex_cv_consumer_environment_invalid')
    selected = sorted(entry for entry in raw.split(b'\0')
                      if entry.partition(b'=')[0] in CODEX_CV_VARIABLES)
    if selected != sorted(expected.splitlines()):
        raise ValueError('codex_cv_consumer_environment_changed')


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
        self.runtime_registry_seen = False
        self.runtime_registry_snapshot = None
        self.service_unit_snapshots = {}

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

    def service_overrides(self, unit, state):
        # Backups/timers never inherit this allowance. Their reviewed unit hashes
        # and empty DropInPaths continue to be checked by the existing preflight.
        if unit not in SERVICES:
            self.must(state.get('DropInPaths') == '', 'installed_service_changed_or_overridden')
            return
        base = SYSTEMD_UNITS / unit
        protected(base, mode=0o644)
        digest = sha_file(base)
        reviewed = self.settings.get('service_hashes', {}).get(unit)
        self.must(reviewed is None or reviewed == digest, 'installed_service_changed_or_overridden')
        previous = self.service_unit_snapshots.setdefault(unit, digest)
        self.must(previous == digest, 'installed_service_changed_during_update')
        registered, registry = registered_ai_runtimes()
        if registered is not None:
            if 'teacher_host' in registered:
                self.must(teacher_runtime_descriptor() == registered['teacher_host'], 'teacher_runtime_changed')
            if 'codex_cv_runtime' in registered:
                self.must(codex_cv_runtime_descriptor() == registered['codex_cv_runtime'], 'codex_cv_runtime_changed')
        if not self.runtime_registry_seen:
            self.runtime_registry_snapshot = registry
            self.runtime_registry_seen = True
        self.must(registry == self.runtime_registry_snapshot, 'ai_runtime_registry_changed_during_update')
        parent = SYSTEMD_UNITS / (unit + '.d')
        expected = registered['units'][unit] if registry is not None else {}
        templates = {**AI_RUNTIME_TEMPLATES, TEACHER_RUNTIME_NAME: TEACHER_RUNTIME_TEMPLATE,
                     CODEX_CV_RUNTIME_NAME: CODEX_CV_RUNTIME_TEMPLATE}
        paths = [parent / name for name in expected]
        self.must(state.get('DropInPaths') == ' '.join(str(path) for path in paths),
                  'installed_service_changed_or_overridden')
        if parent.exists() or parent.is_symlink():
            protected(SYSTEMD_UNITS, directory=True)
            protected(parent, directory=True)
            self.must({path.name for path in parent.iterdir()} == set(expected),
                      'ai_runtime_dropin_inventory_changed')
        else:
            self.must(not expected, 'ai_runtime_dropin_missing')
        for path in paths:
            info = protected(path, mode=0o644)
            self.must(info.st_size == len(templates[path.name])
                      and sha_file(path) == expected[path.name], 'ai_runtime_dropin_changed')

    def codex_cv_attestation(self, release):
        registered, registry = registered_ai_runtimes()
        proof = None if registered is None else registered.get('codex_cv_runtime')
        if proof is None:
            paths = (CODEX_CV_ACTIVE, CODEX_CV_ENVIRONMENT,
                     *(SYSTEMD_UNITS / (unit + '.d') / CODEX_CV_RUNTIME_NAME for unit in SERVICES))
            self.must(not any(path.exists() or path.is_symlink() for path in paths), 'codex_cv_runtime_partial')
            return None
        self.must(CURRENT.is_symlink() and CURRENT.resolve(strict=True) == release
                  and release.parent == RELEASES, 'codex_cv_consumer_release_changed')
        states = {unit: self.show(unit) for unit in SERVICES}
        self.verify_writers(release)
        codex_cv_executable(proof, release / CODEX_CV_CLI, 'catalog_sha512')
        for unit, before in states.items():
            pid = before.get('MainPID', '')
            self.must(pid.isdigit() and int(pid) > 1 and before.get('InvocationID'), 'codex_cv_consumer_identity_invalid')
            codex_cv_process_environment(pid, codex_cv_environment_bytes(proof))
            after = self.show(unit)
            self.must(before == after and after.get('ActiveState') == 'active', 'codex_cv_consumer_changed')
        self.must(registered_ai_runtimes() == (registered, registry)
                  and CURRENT.resolve(strict=True) == release, 'codex_cv_runtime_changed')
        return proof

    def begin(self, request, state):
        protected(STATE, directory=True)
        protected(STATE / 'attempts', directory=True)
        self.must(not self.prior_updates_blocked(), 'prior_update_requires_reconciliation')
        self.attempt = STATE / 'attempts' / request['operation_id']
        self.must(not self.attempt.exists(), 'operation_id_already_recorded')
        self.attempt.mkdir(mode=0o700)
        self.request = request
        atomic_write(self.attempt / 'request.json', (json.dumps(request, sort_keys=True) + '\n').encode())
        self.record(state)

    def prior_updates_blocked(self, *, reconciliation_override=None):
        """Read-only admission: acknowledge only a fully bound historical failure."""
        def private(path, maximum=16384, mode=0o600):
            info = protected(path, mode=mode)
            self.must(0 < info.st_size <= maximum, 'update_history_size_invalid')
            return path.read_bytes()
        try:
            protected(STATE, directory=True)
            protected(STATE / 'attempts', directory=True)
            blocked_path = STATE / 'BLOCKED.json'
            blocked = private(blocked_path) if blocked_path.exists() or blocked_path.is_symlink() else None
            blocked_id = unique_json(blocked).get('operation_id') if blocked is not None else None
            if blocked is not None:
                self.must(isinstance(blocked_id, str) and re.fullmatch(r'[a-f0-9]{32}', blocked_id), 'invalid_blocked_operation')
            override_operation, override_receipt = reconciliation_override or (None, None)
            if reconciliation_override is not None:
                self.must(blocked_id is not None and override_operation == blocked_id and type(override_receipt) is bytes,
                          'invalid_reconciliation_preview')
            reconciled = set()
            for previous in (STATE / 'attempts').iterdir():
                protected(previous, directory=True)
                pre = previous / 'pre-migration-reconciliation.json'
                post = previous / 'post-migration-reconciliation.json'
                has_pre = pre.exists() or pre.is_symlink()
                has_post = post.exists() or post.is_symlink()
                preview = previous.name == override_operation
                self.must(not (has_pre and has_post) and not (preview and (has_pre or has_post)),
                          'conflicting_reconciliation_receipts')
                status = previous / 'state.json'
                if not (status.exists() or status.is_symlink()):
                    self.must(not (has_pre or has_post or preview), 'reconciliation_attempt_missing')
                    continue
                state_bytes = private(status)
                prior = unique_json(state_bytes)
                if not (has_pre or has_post or preview):
                    if ((prior.get('effects_started') is False and prior.get('migration_requested') is False)
                            or prior.get('phase') in ('complete', 'planned')): continue
                    return True
                self.must(re.fullmatch(r'[a-f0-9]{32}', previous.name) and prior.get('operation_id') == previous.name,
                          'invalid_update_history_identity')
                evidence = {
                    'state_bytes': state_bytes,
                    'request_bytes': private(previous / 'request.json'),
                    'manifest_bytes': private(previous / 'recovered-manifest.json', 32 * 1024 ** 2),
                    'blocked_bytes': blocked if previous.name == blocked_id else None,
                }
                acknowledgment = override_receipt if preview else private(pre if has_pre else post)
                self.must(0 < len(acknowledgment) <= 16384, 'update_history_size_invalid')
                receipt = unique_json(acknowledgment)
                if has_pre or (preview and receipt.get('status') in (
                        'backup_request_reconciled_before_migration', 'quiescence_reconciled_before_migration')):
                    recovery = private(STATE / ('same-release-recovery-' + previous.name + '.json'))
                    self.p.validate_pre_migration_reconciliation(receipt, recovery_bytes=recovery, **evidence)
                else:
                    evidence.update({field: private(previous / filename)
                                     for field, (filename, _) in self.p.POST_MIGRATION_EVIDENCE.items()})
                    self.p.validate_post_migration_reconciliation(receipt, **evidence)
                reconciled.add(previous.name)
            return blocked is not None and blocked_id not in reconciled
        except (OSError, ValueError, TypeError, AttributeError, RecursionError, self.p.Rejected):
            return True

    def record(self, state):
        atomic_write(self.attempt / 'state.json', (json.dumps(state, sort_keys=True) + '\n').encode())

    def block(self, state):
        atomic_write(STATE / 'BLOCKED.json', self.p.blocked_record_bytes(state))

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
                      int(state['MainPID']) > 1, 'writers_not_running_or_overridden')
            self.service_overrides(unit, state)
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
            self.must(sha_file(unit) == digest, 'installed_service_changed_or_overridden')
            self.service_overrides(name, self.show(name))
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
        registry, fingerprint = registered_ai_runtimes()
        self.must(fingerprint == self.runtime_registry_snapshot, 'ai_runtime_registry_changed_during_update')
        if registry is not None and 'codex_cv_runtime' in registry:
            codex_cv_executable(registry['codex_cv_runtime'], self.candidate / CODEX_CV_CLI, 'catalog_sha512')
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
ReadWritePaths=/var/lib/nodia/home /var/lib/nodia/codex
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
        self.http(PUBLIC_API, 503 if enabled else 200)

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

    def recover_backup_failure(self, timers):
        self.must(CURRENT.is_symlink() and CURRENT.resolve(strict=True) == self.current,
                  'current_changed_during_update')
        self.backup_environment(self.current)
        inspection = self.node_action('inspect')
        self.must(inspection.get('read_only') is True and inspection.get('migrations_executed') is False,
                  'database_preflight_not_read_only')
        self.verify_writers(self.current)
        self.http('http://127.0.0.1:3000/api/v1', 200)
        self.maintenance(False)
        self.public_cors_smoke()
        # An unfinished local backup must not keep verified application traffic in maintenance.
        try:
            for unit in BACKUPS:
                state = self.show(unit)
                if (state.get('ActiveState') not in ('inactive', 'failed') or state.get('MainPID') != '0' or
                        not self.cgroup_empty('/system.slice/' + unit)):
                    return 'deferred'
            self.restore_timers(timers)
        except (OSError, subprocess.SubprocessError, self.p.Rejected):
            return 'failed'
        return 'restored'

    def public_cors_smoke(self):
        request = urllib.request.Request(PUBLIC_API + '/auth/refresh', method='OPTIONS', headers={
            'Origin': PAGES_ORIGIN, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type'})
        with urllib.request.urlopen(request, timeout=15) as response:
            methods = {method.strip() for method in response.headers.get('Access-Control-Allow-Methods', '').split(',')}
            allowed_headers = response.headers.get('Access-Control-Allow-Headers', '').lower().split(',')
            self.must(response.url == request.full_url and response.status == 204 and 'POST' in methods and
                      'content-type' in {name.strip() for name in allowed_headers} and
                      response.headers.get('Access-Control-Allow-Origin') == PAGES_ORIGIN and
                      response.headers.get('Access-Control-Allow-Credentials') == 'true', 'cors_preflight_not_verified')

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
            self.must(clean_writer_shutdown(state), 'writer_shutdown_not_clean')
            self.must(self.cgroup_empty(self.groups[unit]), 'writer_cgroup_not_empty')

    def cgroup_empty(self, name):
        known = tuple('/system.slice/' + unit for unit in SERVICES + BACKUPS)
        self.must(name in known or re.fullmatch(r'/system.slice/nodia-update-action-[a-f0-9]{32}\.service', name),
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

    def public_smoke(self): self.http(PUBLIC_API, 200)

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
