"""AI-40 explicit, journal-preserving owner-r01 <-> pinned full Codex package driver.

Run preflight first with a pinned JSON plan; adopt/rollback require --execute.
No archive extraction, installs, migrations, SQL restores, provider dispatch,
journal bootstrap/close or unjournaled release activation is implemented here.
Failure after closing admission leaves API closed and an uncertain worker draining.
Private descriptor snapshots permit rollback only after SQL/native/Codex ACK barriers.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import time

OLD = Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
OLD_SHA = '4c3fe6d600adab362a71c5f76357383e98aa7acda7c93aa73e61bfb29c626f92'
NEW = None  # Resolved only from the SHA-pinned, strictly validated operator plan.
WORK = Path('/opt/nodia/verification/ai40-adopt-r01')
GEMINI_SERVICE = 'nodia-gemini-lab'
GEMINI_CONTAINER = 'nodia-gemini-microservice'
CODEX_SDK_BINARY = Path('/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex')
CODEX_SDK_SHA256 = '9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c'
CODEX_ARG0_NAMES = frozenset(('applypatch', 'apply_patch', 'codex-linux-sandbox', 'codex-execve-wrapper'))
HELPER = Path('/tmp/nodia-ai-ai38-journal-activate.py')
HELPER_SHA = '56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
OLD_KNOWLEDGE = '4189005373b4e6040a0e441d21c2978fe1d423ae568e53f74df1592e6f900130'
DESCRIPTORS = tuple(Path('/etc/systemd/system') / (u + '.service.d/zz-ai38-journal.conf')
                    for u in ('nodia-api', 'nodia-ai-worker')) + (Path('/etc/nodia-ai-recovery/backup-runner.env'),)



def require(ok, code):
    if not ok:
        raise ValueError(code)


def safe_error(error):
    text = str(error)
    return text if isinstance(error, ValueError) and re.fullmatch('[a-z_]{1,100}', text) else 'operation_failed'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def identity(path, mode=None):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and not path.is_symlink() and path.resolve() == path and
            info.st_uid == 0 and info.st_nlink == 1 and (mode is None or stat.S_IMODE(info.st_mode) == mode),
            'operator_file_identity_mismatch')
    return info


def plan_file(path, pin):
    require(re.fullmatch('[a-f0-9]{64}', pin) and sha(path) == pin, 'plan_pin_mismatch')
    plan = json.loads(path.read_bytes())
    require(type(plan) is dict and set(plan) == {'release', 'manifest_sha256', 'files', 'dist_outputs', 'knowledge_release', 'codex_profile_root'} and
            type(plan['release']) is str and re.fullmatch('/opt/nodia/releases/nodia-server-ai40-r[0-9]{2}', plan['release']) and
            type(plan['manifest_sha256']) is str and re.fullmatch('[a-f0-9]{64}', plan['manifest_sha256']) and
            type(plan['knowledge_release']) is str and re.fullmatch('[a-f0-9]{64}', plan['knowledge_release']) and
            type(plan['files']) is int and 0 < plan['files'] <= 20000 and
            type(plan['dist_outputs']) is int and 0 < plan['dist_outputs'] <= plan['files'] and
            type(plan['codex_profile_root']) is str and plan['codex_profile_root'] == '/var/lib/nodia/codex' and
            PurePosixPath(plan['codex_profile_root']).as_posix() == plan['codex_profile_root'] and
            '..' not in PurePosixPath(plan['codex_profile_root']).parts,
            'plan_invalid')
    return plan


def manifest(root, pin, knowledge):
    require(root.resolve() == root and not root.is_symlink(), 'release_root_invalid')
    require(sha(root / 'release-manifest.json') == pin, 'manifest_pin_mismatch')
    value = json.loads((root / 'release-manifest.json').read_bytes())
    require(value['knowledge_release'] == knowledge and isinstance(value['files'], dict), 'manifest_invalid')
    for name, digest in value['files'].items():
        path = PurePosixPath(name)
        require(name == path.as_posix() and not path.is_absolute() and '..' not in path.parts and
                '\\' not in name and '.env' not in path.parts and 'node_modules' not in path.parts and
                re.fullmatch('[a-f0-9]{64}', digest), 'unsafe_manifest_member')
        target = root / path
        require(not target.is_symlink() and target.is_file() and target.resolve().is_relative_to(root) and
                sha(target) == digest, 'manifest_member_mismatch')
    # Dependencies are the sole permitted extra. Reject unlisted files or symlink trees.
    actual = set()
    for current, directories, files in os.walk(root, followlinks=False):
        directory = Path(current)
        for name in tuple(directories):
            member = directory / name
            if member == root / 'node_modules':
                directories.remove(name)
                require(member.is_symlink() and member.resolve() == Path('/opt/nodia/nodia-server/node_modules').resolve(),
                        'dependencies_target_invalid')
            else:
                require(not member.is_symlink(), 'unlisted_directory_symlink')
        for name in files:
            member = directory / name
            require(not member.is_symlink() and member.is_file(), 'unlisted_special_file')
            actual.add(member.relative_to(root).as_posix())
    require(actual == set(value['files']) | {'release-manifest.json'}, 'full_release_inventory_mismatch')
    require((root / 'node_modules').is_symlink(), 'dependencies_link_missing')
    return value


def load_helper():
    require(sha(HELPER) == HELPER_SHA, 'helper_pin_mismatch')
    spec = importlib.util.spec_from_file_location('pinned_journal_activation', HELPER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _, helpers = module.load_helpers()
    return module, helpers


def descriptor_transition(payload, source, destination):
    old, new = str(source).encode(), str(destination).encode()
    require(payload.count(old) == 2 and new not in payload, 'descriptor_source_mismatch')
    return payload.replace(old, new)


def descriptor_bytes(source, destination):
    result = []
    for path in DESCRIPTORS:
        info = identity(path, 0o600 if path == DESCRIPTORS[-1] else 0o644)
        payload = path.read_bytes()
        result.append((path, payload, descriptor_transition(payload, source, destination), stat.S_IMODE(info.st_mode)))
    return result


def atomic_replace(path, expected, desired, mode, tag):
    identity(path, mode)
    require(path.read_bytes() == expected, 'descriptor_changed_concurrently')
    temporary = path.with_name(path.name + '.ai40-' + tag)
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(desired)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def validate_backup(value, began, finished):
    require(value.get('schema_version') == 1 and value.get('operation') == 'backup' and
            value.get('status') == 'ready' and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', value.get('backup_id', '')) and
            re.fullmatch('[a-f0-9]{64}', value.get('cipher_sha256', '')) and
            type(value.get('cipher_bytes')) is int and value['cipher_bytes'] > 0 and
            type(value.get('journal_sequence')) is int and value['journal_sequence'] >= 0,
            'fresh_encrypted_backup_receipt_invalid')
    captured = datetime.fromisoformat(value['captured_at'].replace('Z', '+00:00'))
    expires = datetime.fromisoformat(value['expires_at'].replace('Z', '+00:00'))
    require(began <= captured <= finished and (expires - captured).total_seconds() == 7 * 86400,
            'fresh_backup_capture_or_retention_invalid')
    return value


def oneshots_idle(a):
    deadline = time.monotonic() + 45
    while any(a.state(u)['active'] not in ('inactive', 'failed') for u in ('nodia-ai-backup', 'nodia-ai-backup-rotate')):
        require(time.monotonic() < deadline, 'backup_oneshot_still_busy_no_forced_stop')
        time.sleep(.5)


def journal_open(a):
    status = a.journal('status')
    require(status['unconfirmed'] == 0 and status['coverage_closed_at'] is None and
            status['expired_backups'] == 0, 'journal_not_ready')
    return status


def native_epoch(a):
    # Observe the actual current Gemini epoch; no historical image/epoch fallback.
    require(a.state(GEMINI_SERVICE)['active'] == 'active', 'gemini_service_not_active')
    value = json.loads(a.checked(['docker', 'inspect', GEMINI_CONTAINER]))
    require(type(value) is list and len(value) == 1, 'gemini_observation_invalid')
    item = value[0]
    require(item.get('Name') == '/' + GEMINI_CONTAINER, 'gemini_container_identity_mismatch')
    require(item['State']['Running'] is True, 'gemini_not_running')
    descriptor = {name: item[name] for name in ('Config', 'HostConfig', 'Mounts')}
    return {'id': item['Id'], 'image': item['Image'], 'started_at': item['State']['StartedAt'],
            'descriptor_sha256': hashlib.sha256(json.dumps(descriptor, sort_keys=True).encode()).hexdigest()}


def same_live_process(pid, birth, boot):
    require(type(pid) is int and pid > 1 and type(birth) is str and re.fullmatch('[0-9]{1,32}', birth)
            and type(boot) is str and re.fullmatch('[a-f0-9-]{36}', boot), 'codex_idle_certificate_invalid')
    require(Path('/proc/sys/kernel/random/boot_id').read_text().strip() == boot, 'codex_idle_boot_changed')
    raw = (Path('/proc') / str(pid) / 'stat').read_text()
    fields = raw[raw.rfind(')') + 2:].split()
    require(len(fields) >= 20 and fields[19] == birth and fields[0] not in ('Z', 'X'), 'codex_idle_process_changed')
    return int(fields[2])


def idle_lock(path, allowed):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_size <= 4096 and info.st_nlink == 1
            and stat.S_IMODE(info.st_mode) == 0o600, 'codex_idle_lock_invalid')
    value = json.loads(path.read_bytes())
    require(type(value) is dict and value.get('gated') is False and value.get('serverPid') in allowed,
            'codex_idle_lock_owner_unverified')
    same_live_process(value['serverPid'], value.get('serverBirth'), value.get('serverBoot'))
    group = same_live_process(value.get('runtimePid'), value.get('runtimeBirth'), value.get('runtimeBoot'))
    require(group == value['runtimePid'], 'codex_idle_native_group_invalid')


def codex_sdk_binary():
    import pwd
    expected_uid = pwd.getpwnam('nodia').pw_uid
    path = CODEX_SDK_BINARY
    require(path.resolve() == path and not path.is_symlink(), 'codex_sdk_binary_identity_invalid')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_size > 4 and info.st_mode & 0o111 != 0
                and info.st_uid == expected_uid and stream.read(4) == b'\x7fELF', 'codex_sdk_binary_invalid')
        stream.seek(0)
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
        require(digest.hexdigest() == CODEX_SDK_SHA256, 'codex_sdk_binary_pin_mismatch')
        after = path.lstat()
        require((info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns) ==
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), 'codex_sdk_binary_changed')
    return {'path': str(path), 'sha256': digest.hexdigest(), 'bytes': info.st_size, 'uid': info.st_uid, 'elf': True}


def codex_arg0_link(path, root, uid):
    relative = path.relative_to(root).as_posix()
    parts = PurePosixPath(relative).parts
    require(len(parts) == 5 and re.fullmatch('[1-9][0-9]{0,18}', parts[0])
            and int(parts[0]) <= 9223372036854775807 and parts[1:3] == ('tmp', 'arg0')
            and re.fullmatch('codex-arg0[A-Za-z0-9]{6}', parts[3]) and parts[4] in CODEX_ARG0_NAMES,
            'codex_sdk_symlink_path_invalid')
    info = path.lstat()
    require(stat.S_ISLNK(info.st_mode) and info.st_uid == uid and info.st_nlink == 1
            and os.readlink(path) == str(CODEX_SDK_BINARY) and path.resolve() == CODEX_SDK_BINARY,
            'codex_sdk_symlink_target_invalid')


def codex_quiet(root, allow_idle_pids=frozenset()):
    # Strict read-only aggregate: malformed metadata and unacknowledged terminal
    # receipts block rollback just as active operations do. No deletion/replay.
    import pwd
    uid = pwd.getpwnam('nodia').pw_uid
    if not root.exists():
        require(not root.is_symlink(), 'codex_root_invalid')
        return {'profile_absent': True, 'pending': 0, 'locks_or_sockets': 0, 'records': 0}
    info = root.lstat()
    require(root.resolve() == root and not root.is_symlink() and stat.S_ISDIR(info.st_mode)
            and info.st_uid == uid and stat.S_IMODE(info.st_mode) == 0o700, 'codex_root_invalid')
    pending, active, records, entries, sdk_links = 0, 0, 0, 0, 0
    sdk_binary = None
    for current, directories, files in os.walk(root, followlinks=False):
        folder = Path(current)
        for name in directories:
            target = folder / name
            require(not target.is_symlink() and target.stat().st_uid == uid, 'codex_directory_invalid')
        for name in files:
            entries += 1
            require(entries <= 20000, 'codex_inventory_oversized')
            path = folder / name
            if path.is_symlink():
                codex_arg0_link(path, root, uid)
                if sdk_binary is None:
                    sdk_binary = codex_sdk_binary()
                sdk_links += 1
                continue
            if name in ('native.lock', 'nodia.lock') or name.endswith('.sock'):
                if name == 'nodia.lock' and allow_idle_pids:
                    require(path.stat().st_uid == uid, 'codex_idle_lock_invalid')
                    idle_lock(path, allow_idle_pids)
                else:
                    active += 1
            if folder.name not in ('chat-jobs', 'login-jobs') or not name.endswith('.json'):
                continue
            info = path.lstat()
            require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and info.st_nlink == 1
                    and stat.S_IMODE(info.st_mode) == 0o600 and info.st_size <= 4096, 'codex_record_invalid')
            record = json.loads(path.read_bytes())
            terminal = ('completed', 'abandoned_unknown') if folder.name == 'chat-jobs' else ('succeeded', 'failed', 'cancelled')
            require(type(record) is dict and type(record.get('version')) is int and record['version'] == 1 and type(record.get('acknowledged')) is bool
                    and type(record.get('state')) is str, 'codex_record_invalid')
            records += 1
            if not record['acknowledged'] or record['state'] not in terminal:
                pending += 1
    require(pending == 0 and active == 0, 'codex_pending_do_not_downgrade_or_stop')
    return {'profile_absent': False, 'pending': pending, 'locks_or_sockets': active, 'records': records, 'sdk_arg0_links': sdk_links, 'sdk_binary': sdk_binary}


def codex_barrier(a, root, allow_idle_pids=frozenset()):
    result = codex_quiet(root, allow_idle_pids)
    if not result['records']:
        return result
    # The pinned target decoders are the source of truth, including schema,
    # certificate and terminal-proof coherence. Never emit journal contents.
    program = """import {readdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root=ROOT;const release=RELEASE;let count=0;
try {for (const [name,file,clazz] of [['chat-jobs','codex-chat-journal.js','CodexChatJournal'],['login-jobs','codex-login-journal.js','CodexLoginJournal']]) {
const module=await import(pathToFileURL(release+'/dist/common/ai/codex/'+file).href);
const decoder=new module[clazz](root);
let names;try{names=await readdir(root+'/'+name)}catch(e){if(e.code==='ENOENT')continue;throw e}
for(const n of names){if(!n.endsWith('.json'))continue;
decoder.decode(JSON.parse(await readFile(root+'/'+name+'/'+n,'utf8')));count++;}}
console.log(JSON.stringify({valid:true,records:count}));
}catch{console.log(JSON.stringify({valid:false}));process.exitCode=1}
""".replace('ROOT', json.dumps(str(root))).replace('RELEASE', json.dumps(str(NEW)))
    value = json.loads(a.checked(['sudo', '-u', 'nodia', '/usr/local/bin/node', '--input-type=module', '-e', program], timeout=20, cwd=str(NEW)))
    require(value == {'valid': True, 'records': result['records']}, 'codex_decoded_inventory_changed')
    return result


def unchanged(a, h, before):
    require(native_epoch(a) == before['Gemini'] and codex_sdk_binary() == before['codex_sdk_binary'] and
            h['schema_and_selection']() == before['schema_and_selection'] and
            a.operator_configuration()['recovery.json'] == before['operator']['recovery.json'] and
            all(a.operator_configuration()[name] == before['operator'][name]
                for name in ('backup.json', 'backup-public.pem')) and
            sha(a.NGINX) == before['nginx_sha256'] and
            all(a.state(u) == before['unrelated'][u] for u in ('nginx', 'nodia-gemini-lab')),
            'unrelated_environment_changed')
    status = journal_open(a)
    require(status['coverage_from'] == before['journal']['coverage_from'] and
            status['first_sequence'] == before['journal']['first_sequence'] and
            status['last_sequence'] == before['journal']['last_sequence'], 'journal_era_or_entries_changed')
    return status


def validated_quiet(value):
    require(type(value) is dict and type(value.get('native')) is dict and type(value.get('SQL')) is dict,
            'quiet_observation_invalid')
    native = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
              'temporary_attachment_directories', 'temporary_cli_directories')
    sql = ('pending_jobs', 'open_attempts', 'retained_slots')
    require(all(type(value['native'].get(key)) is int and value['native'][key] == 0 for key in native)
            and all(type(value['SQL'].get(key)) is int and value['SQL'][key] == 0 for key in sql),
            'consumer_work_not_drained')
    return value


def run(args):
    require(os.geteuid() == 0, 'root_required')
    require(sys.flags.optimize == 0, 'optimized_python_forbidden_for_pinned_assertions')
    require(args.phase == 'preflight' or args.execute, 'explicit_execute_required')
    plan = plan_file(Path(args.plan), args.plan_sha256)
    global NEW
    NEW = Path(plan['release'])
    old, new = manifest(OLD, OLD_SHA, OLD_KNOWLEDGE), manifest(NEW, plan['manifest_sha256'], plan['knowledge_release'])
    require(len(new['files']) == plan['files'] and
            sum(n.startswith('dist/') for n in new['files']) == plan['dist_outputs'], 'package_inventory_changed')
    changed = {n for n in set(new['files']) | set(old['files']) if old['files'].get(n) != new['files'].get(n)}
    a, h = load_helper()
    source, target = (NEW, OLD) if args.phase == 'rollback' else (OLD, NEW)
    a.RELEASE = source
    consumers = a.active_new_processes()
    before = dict(Gemini=native_epoch(a), codex_sdk_binary=codex_sdk_binary(), schema_and_selection=h['schema_and_selection'](),
                  operator=a.operator_configuration(), nginx_sha256=sha(a.NGINX),
                  unrelated={u: a.state(u) for u in ('nginx', 'nodia-gemini-lab')},
                  journal=journal_open(a), quiet=validated_quiet(h['quiet']()), codex=codex_barrier(a, Path(plan['codex_profile_root']), frozenset(item['pid'] for item in consumers.values())))
    transitions = descriptor_bytes(source, target)
    timer_states = {u: a.state(u)['active'] for u in a.TIMERS}
    require(all(v == 'active' for v in timer_states.values()), 'timers_not_active_at_entry')
    common = dict(stage='AI-40', phase=args.phase, plan_sha256=args.plan_sha256,
                  self_sha256=sha(Path(__file__)), source=str(source), target=str(target),
                  changed_files=sorted(changed), pre_consumers=consumers, before=before,
                  old_manifest_sha256=OLD_SHA, new_manifest_sha256=plan['manifest_sha256'])
    if args.phase == 'preflight':
        return dict(common, status='preflight_passed_no_mutations', service_changes=0, provider_requests=0)
    WORK.mkdir(mode=0o700, exist_ok=True)
    require(WORK.resolve() == WORK and WORK.stat().st_uid == 0 and stat.S_IMODE(WORK.stat().st_mode) == 0o700,
            'private_work_directory_invalid')
    lockfd = os.open(WORK / 'deployment.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lockfd, 'r+b') as lock:
        identity(WORK / 'deployment.lock', 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(not (WORK / (args.phase + '-before.json')).exists(), 'refuse_transition_replay')
        a.WORK = WORK
        a.freeze(args.phase + '-before.json', common)
        if args.phase == 'adopt':
            for index, (path, payload, _, mode) in enumerate(transitions):
                a.write_new(WORK / ('descriptor-' + str(index) + '.private'), payload, mode)
        else:
            previous = json.loads((WORK / 'adopt-after.json').read_bytes())
            require(previous['status'] == 'adopt_completed' and previous['plan_sha256'] == args.plan_sha256,
                    'rollback_requires_successful_matching_adoption')
            require(all(desired == (WORK / ('descriptor-' + str(i) + '.private')).read_bytes()
                        for i, (_, _, desired, _) in enumerate(transitions)), 'rollback_descriptor_snapshot_mismatch')
        admission_closed = False
        timers_stopped = False
        try:
            timers_stopped = True
            a.checked(['systemctl', 'stop', *a.TIMERS])
            oneshots_idle(a)
            # Native backup CLI verifies both live writers, encrypts in-stream,
            # HEAD/GET/hash verifies exact R2 ciphertext and uses existing lock/CAS.
            began = datetime.now(timezone.utc)
            backup = json.loads(a.checked(['sudo', '-u', 'nodia', '/usr/local/bin/node',
                              str(source / 'scripts/nodia-ai-backups.mjs'), 'backup', str(a.BACKUP)], timeout=240))
            backup = validate_backup(backup, began, datetime.now(timezone.utc))
            a.freeze(args.phase + '-backup.json', backup)
            require(a.active_new_processes() == consumers, 'writers_changed_during_backup')
            unchanged(a, h, before)
            admission_closed = True
            a.checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
            require(a.stopped('nodia-api'), 'API_not_stopped')
            drained = validated_quiet(a.wait_quiet(h, seconds=45))
            codex_drained = codex_barrier(a, Path(plan['codex_profile_root']))
            a.checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
            require(all(a.stopped(u) for u in a.CONSUMERS), 'consumers_not_stopped')
            codex_stopped = codex_barrier(a, Path(plan['codex_profile_root']))
            validated_quiet(h['quiet']())  # Recheck with admission and both writers stopped before descriptor changes.
            for path, expected, desired, mode in transitions:
                atomic_replace(path, expected, desired, mode, args.phase)
            a.checked(['systemctl', 'daemon-reload'])
            a.RELEASE = target
            require(all(a.state(u)['working_directory'] == str(target) for u in a.CONSUMERS),
                    'effective_descriptor_target_mismatch')
            a.checked(['systemctl', 'start', *a.CONSUMERS], timeout=45)
            after_consumers = a.wait_health()
            status = unchanged(a, h, before)
            quiet = validated_quiet(a.wait_quiet(h))
            codex_after = codex_barrier(a, Path(plan['codex_profile_root']))
            require(sorted(p.name for p in Path('/var/lib/nodia-ai-recovery/spool').iterdir()) == ['.backup.lock'],
                    'ciphertext_spool_not_empty')
            a.checked(['systemctl', 'start', *a.TIMERS])
            require(all(a.state(u)['active'] == timer_states[u] for u in a.TIMERS), 'timer_restoration_failed')
            timers_stopped = False
            require(a.active_new_processes() == after_consumers, 'new_consumers_changed')
            result = dict(common, status=args.phase + '_completed', post_consumers=after_consumers,
                          drained=drained, quiet_after=quiet, codex_drained=codex_drained, codex_stopped=codex_stopped, codex_after=codex_after, external_status=status, fresh_backup=backup,
                          timers_restored=True, journal_era_preserved=True, journal_bootstrap_or_close=False,
                          migrations=0, SQL_restores=0, configured_SQL_writes=0, provider_requests=0,
                          business_effects=0, new_publication=False, knowledge_release=plan["knowledge_release"], observed_at_VM_utc=datetime.now(timezone.utc).isoformat())
            a.freeze(args.phase + '-after.json', result)
            return result
        except Exception as error:
            # Never automatically restart old writers or kill/replay uncertain work.
            failure = dict(status=args.phase + '_failed', failure_class=type(error).__name__,
                           failure_code=safe_error(error), raw_details_emitted=False, admission_closed=admission_closed)
            if admission_closed:
                try:
                    a.checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
                    validated_quiet(a.wait_quiet(h, seconds=10))
                    codex_barrier(a, Path(plan['codex_profile_root']))
                    a.checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
                    failure['worker_stopped_after_quiet'] = a.stopped('nodia-ai-worker')
                except Exception:
                    failure['worker_left_draining_no_forced_kill'] = True
            # Restore timers only when both verified writers still execute the
            # same source/target and runner agrees; otherwise remain fail-closed.
            if timers_stopped and admission_closed:
                failure['timers_left_stopped_requires_operator'] = True
            if timers_stopped and not admission_closed:
                try:
                    a.active_new_processes()
                    descriptor_bytes(a.RELEASE, OLD if a.RELEASE == NEW else NEW)
                    a.checked(['systemctl', 'start', *a.TIMERS])
                    failure['timers_restored'] = all(a.state(u)['active'] == 'active' for u in a.TIMERS)
                except Exception:
                    failure['timers_left_stopped_requires_operator'] = True
            a.freeze(args.phase + '-failure.json', failure)
            return failure


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('preflight', 'adopt', 'rollback'))
    parser.add_argument('--plan', required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    try:
        value = run(args)
    except Exception as error:
        value = dict(status='precondition_failed', failure_class=type(error).__name__,
                     failure_code=safe_error(error), raw_details_emitted=False)
    print(json.dumps(value))
    return 0 if value['status'] in ('preflight_passed_no_mutations', 'adopt_completed', 'rollback_completed') else 1


if __name__ == '__main__':
    sys.exit(main())
