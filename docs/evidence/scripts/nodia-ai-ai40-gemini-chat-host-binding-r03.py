"""Bounded PRESTOP binding for the one observed AI40 legacy Gemini chat.

Default is read-only. --execute creates one immutable root-owned host binding;
it never changes a native receipt, SQL, a session, a process or a cgroup.
The host generation existed before dispatch. This composite operational witness
is explicitly not a per-attempt owner persisted by the original v1 runtime.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
from uuid import UUID

HELPER_SHA = 'e8b525c777446c69e0c67a90db29c0932a565b288cca7f88c422d28032c6a463'
ATTEMPT = 'c6cc8739-7de7-4c13-a5c9-6b230fb3b1de'
CONTAINER = 'c4814c5a184b55cd95c751ed904d0c957c0311148f8732169928ce6c3b2d5bd3'
IMAGE = 'sha256:6b9e2f7e3273f89c4c2285c852135213bb82a3391bfe06895f523554033acb49'
RESOURCE = 'gemini-profile:433e10d914ee92a1484882d4a4860fcde80cd41f4abc6fb53ce17f97f0904e7d'
SESSION = 'a1a03da0914644f89de106905d1c3257'
RECORD_SHA = 'eec6a5f80405b2ba2a1510d7d5a3fd3bfe413a1dfee55256741d49da0865cf90'
STATE_SHA = 'eea7136e6d4f0bf52bf7430efa3541d0529100be081ffcabd17f6e9000d6528f'
VOLUME_SHA = 'df92478c1c4cd518e179b7372d0428f80dea184a1fdda50c94b647908e6c8576'
RECEIPTS = {
    'qualified-final-state-r01.json': '25dbf5f6db62fe81efaa0ff56b6e174dc5770b3b7abde56d7a71eb0199eddbb5',
    'Gemini-exact-unknown-readonly-r01.json': 'ae826e1b035c4d63e8778afc24d41103d90d392a0c28a073d3697469cc4f9431',
    'Gemini-host-containment-readonly-r01.json': '3dfafd2980db3656fb1afcf9f2be7ef27e31b3e96c8c1367bcb0c493e4bfd192',
    'Gemini-legacy-owner-witness-readonly-r01.json': 'aae26caee69e1f7f3339a177a85b27e864f7ee1a8c4d64a13646e3c8a4fb303b',
}
SOURCES = {
    'native_attempts.py': '102cd400cd5400798984ae37fb4b497f3cb58cc5420488e62360134a46615f60',
    'nodia_ai_chat.py': 'a25bc89db5946ca246bda1d243a75b38ed3d18ec8a3bb5cd42bad90619f3f7a8',
    'agentic_cli.py': '3605f0f300c15cf8bc66b94b38ee8b09da40f3427a88844c0d3cd47785903d08',
    'main.py': 'f5d449e606947fd23afdc0e766566ffa04e5055bd2087969667045216dbfc55a',
    'profile_admission.py': '341e0faf3b2c5c473a760b92119e89bc4821452fa98d49c497dc94f545b0406b',
}
SOURCE_METADATA = {
    'native_attempts.py': (10001, 10001, 0o664),
    'nodia_ai_chat.py': (0, 0, 0o644),
    'agentic_cli.py': (10001, 10001, 0o664),
    'main.py': (0, 0, 0o644),
    'profile_admission.py': (0, 0, 0o644),
}
GENERATION_KEYS = {'container_id', 'started_at', 'boot', 'device', 'parent_inode', 'host_device', 'host_inode', 'cgroup_path'}
PUBLIC_KEYS = {'version', 'kind', 'binding_id', 'engine', 'attempt_id', 'resource_key', 'session_generation',
               'operation_ref', 'record_sha256', 'record_bytes', 'record_observed_at', 'bound_at', 'generation', 'lineage_sha256'}


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def strict_json(raw):
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, 'duplicate_json_key')
            value[key] = item
        return value
    return json.loads(raw, object_pairs_hook=unique)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def instant(value):
    require(isinstance(value, str) and len(value) <= 64, 'timestamp_invalid')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'timestamp_timezone_missing')
    return result


def validate_public(value):
    require(isinstance(value, dict) and set(value) == PUBLIC_KEYS, 'binding_schema_invalid')
    require(type(value['version']) is int and value['version'] == 1 and value['kind'] == 'legacy_chat_pre_stop', 'binding_version_invalid')
    for key in ('binding_id', 'attempt_id', 'operation_ref'):
        require(isinstance(value[key], str) and str(UUID(value[key])) == value[key], 'binding_uuid_invalid')
    require(value['operation_ref'] == value['attempt_id'] and value['engine'] == 'agentic', 'binding_scope_invalid')
    require(isinstance(value['resource_key'], str) and re.fullmatch(r'gemini-profile:[0-9a-f]{64}', value['resource_key']), 'binding_resource_invalid')
    require(isinstance(value['session_generation'], str) and re.fullmatch(r'[0-9a-f]{32}', value['session_generation']), 'binding_session_invalid')
    for key in ('record_sha256', 'lineage_sha256'):
        require(isinstance(value[key], str) and re.fullmatch(r'[0-9a-f]{64}', value[key]), 'binding_digest_invalid')
    require(type(value['record_bytes']) is int and 0 < value['record_bytes'] <= 4096, 'binding_record_size_invalid')
    generation = value['generation']
    require(isinstance(generation, dict) and set(generation) == {'container_id', 'started_at', 'boot', 'device', 'parent_inode'}, 'binding_generation_invalid')
    require(re.fullmatch(r'[0-9a-f]{64}', generation['container_id']) and str(UUID(generation['boot'])) == generation['boot'], 'binding_generation_identity_invalid')
    require(all(type(generation[key]) is int and 0 < generation[key] < 2**64 for key in ('device', 'parent_inode')), 'binding_generation_numbers_invalid')
    require(instant(generation['started_at']) <= instant(value['record_observed_at']) <= instant(value['bound_at']), 'binding_time_order_invalid')
    return value


def safe_directory(path, uid=0, private=True):
    require(path.is_absolute() and '..' not in path.parts, 'directory_path_invalid')
    for part in reversed([path, *path.parents]):
        info = part.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode), 'directory_symlink_or_type_invalid')
        require(info.st_uid == uid and not info.st_mode & 0o022, 'directory_owner_or_write_invalid')
    require(not private or not path.stat().st_mode & 0o077, 'directory_not_private')


def read_file(path, *, uid=0, mode=None, maximum=131072):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and info.st_nlink == 1 and not info.st_mode & 0o022, 'file_identity_unsafe')
        require(mode is None or stat.S_IMODE(info.st_mode) == mode, 'file_mode_unsafe')
        require(info.st_size <= maximum, 'file_too_large')
        raw = stream.read(maximum + 1)
        require(len(raw) == info.st_size, 'file_changed_during_read')
        return raw



def read_pinned_source(path, expected):
    """Five observed sources: exact per-file UID/GID/mode and content SHA.

    Base COPY and historical selective overlay have different ownership. There
    is no fallback between them and no exception in the general file reader.
    """
    require(path.name in SOURCES and SOURCES[path.name] == expected, 'source_not_allowlisted')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1
                and (info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode)) == SOURCE_METADATA[path.name]
                and info.st_size <= 262144,
                'source_file_identity_unsafe')
        raw = stream.read(262145)
        require(len(raw) == info.st_size and sha(raw) == expected, 'original_native_source_changed')
        return raw


def load_helper(path):
    safe_directory(path.parent, private=False)
    raw = read_file(path, mode=0o755, maximum=65536)
    require(sha(raw) == HELPER_SHA, 'host_helper_pin_mismatch')
    module = importlib.util.module_from_spec(importlib.util.spec_from_loader('ai40_original_cgroup_helper', loader=None))
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module


def read_bindings(directory):
    """Only immutable root files; called under the host attachment lock."""
    path = directory / 'chat-bindings'
    if not path.exists():
        require(not path.is_symlink(), 'binding_directory_symlink')
        return []
    safe_directory(path)
    names = list(path.iterdir())
    require(len(names) <= 8, 'binding_capacity_exceeded')
    result = []
    for file in sorted(names):
        require(re.fullmatch(r'[0-9a-f-]{36}\.json', file.name), 'binding_filename_invalid')
        raw = read_file(file, mode=0o444, maximum=16384)
        value = strict_json(raw)
        require(set(value) == {'version', 'public', 'generation', 'lineage'}, 'host_binding_schema_invalid')
        public = validate_public(value['public'])
        require(value['version'] == 1 and file.stem == public['attempt_id'], 'host_binding_identity_invalid')
        generation = value['generation']
        require(set(generation) == GENERATION_KEYS and {k: generation[k] for k in public['generation']} == public['generation'], 'host_binding_generation_mismatch')
        require(sha(json.dumps(value['lineage'], sort_keys=True, separators=(',', ':')).encode()) == public['lineage_sha256'], 'host_binding_lineage_mismatch')
        result.append(value)
    require(len({x['public']['binding_id'] for x in result}) == len(result), 'duplicate_binding_id')
    return result


def validate_lineage(receipts, state_raw, proof_raw, generation):
    require(set(receipts) == set(RECEIPTS), 'witness_set_invalid')
    for name, raw in receipts.items():
        require(sha(raw) == RECEIPTS[name], 'witness_pin_mismatch')
    before = strict_json(receipts['qualified-final-state-r01.json'])
    host = strict_json(receipts['Gemini-host-containment-readonly-r01.json'])
    sql = strict_json(receipts['Gemini-exact-unknown-readonly-r01.json'])
    owner = strict_json(receipts['Gemini-legacy-owner-witness-readonly-r01.json'])
    require(sha(state_raw) == STATE_SHA and sha(proof_raw) == RECORD_SHA and len(proof_raw) == 441, 'original_record_or_generation_changed')
    proof = strict_json(proof_raw)
    require(proof['schema_version'] == 1 and proof['engine'] == 'agentic' and proof['attempt_id'] == ATTEMPT and proof['operation_ref'] == ATTEMPT and proof['resource_key'] == RESOURCE and proof['session_generation'] == SESSION, 'original_scope_changed')
    require(proof['state'] == 'dispatch_armed' and proof['process_closed'] is False and proof['terminal_proof_id'] is None, 'original_not_armed')
    expected = host['host_state']['generations'][0]
    require({key: expected[key] for key in GENERATION_KEYS} == generation and generation['container_id'] == CONTAINER, 'original_host_generation_changed')
    require(host['container']['image'] == IMAGE and host['host_state']['sha256'] == STATE_SHA, 'host_lineage_invalid')
    require(instant(host['host_state']['mtime_utc']) < instant(proof['observed_at']), 'generation_not_pre_dispatch')
    descriptor = sql['selection']['jobs'][0]['recovery_descriptor']['runtime']
    require(descriptor == {key: proof[key] for key in descriptor} and descriptor['attempt_id'] == ATTEMPT and sql['selection']['current_authority_verified'] is True, 'sql_witness_scope_mismatch')
    require(sql['selection']['run']['state'] == 'unknown' and sql['selection']['run']['provider_dispatches_used'] == 1, 'sql_witness_not_original_unknown')
    require(owner['record']['sha256'] == RECORD_SHA and owner['session_volume']['single_running_RW_container'] is True and owner['session_volume']['source_sha256'] == VOLUME_SHA, 'owner_witness_invalid')
    require(CONTAINER in before['Gemini_container_public_descriptor'] and IMAGE in before['Gemini_container_public_descriptor'] and generation['started_at'] in before['Gemini_container_public_descriptor'], 'pre_dispatch_container_missing')
    require(all(instant(v['verified_at']) < instant(proof['observed_at']) for v in before['proofs'].values()), 'pre_dispatch_cut_not_earlier')
    return proof


def observe(helper, directory, witnesses):
    safe_directory(directory)
    safe_directory(witnesses)
    state_raw = read_file(directory / 'state.json', mode=0o600)
    generations = helper.load_state(directory, 'nodia-gemini-microservice')
    require(len(generations) == 1, 'legacy_original_generation_ambiguous')
    generation = generations[0]
    container = helper.inspect_container(CONTAINER)
    require(container['name'] == '/nodia-gemini-microservice', 'original_container_name_changed')
    actual = helper.current_generation(container)
    require(actual == {key: value for key, value in generation.items() if key not in ('device', 'parent_inode')}, 'original_current_generation_mismatch')
    root = Path('/proc') / str(container['state']['Pid']) / 'root'
    for relative in ('app/session_state', 'app/session_state/runtime_admission', 'app/session_state/runtime_admission/attempts'):
        info = (root / relative).lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and info.st_uid == 10001 and not info.st_mode & 0o022, 'native_directory_unsafe')
    proof_raw = read_file(root / f'app/session_state/runtime_admission/attempts/{ATTEMPT}.json', uid=10001, mode=0o600, maximum=4096)
    for name, expected in SOURCES.items():
        read_pinned_source(root / 'app' / name, expected)
    run_info = (root / 'run').lstat()
    require(stat.S_ISDIR(run_info.st_mode) and not stat.S_ISLNK(run_info.st_mode) and run_info.st_uid == 0 and not run_info.st_mode & 0o022, 'native_certificate_parent_unsafe')
    certificate = strict_json(read_file(root / 'run/nodia-login-containment.json', mode=0o444, maximum=32768))
    require(certificate == {'version': 1, 'root_device': generation['device'], 'root_inode': generation['parent_inode'], 'host_boot': generation['boot'], 'closed_roots': []}, 'original_certificate_changed')
    data = {name: read_file(witnesses / name, mode=0o600, maximum=131072) for name in RECEIPTS}
    proof = validate_lineage(data, state_raw, proof_raw, generation)
    # Source volume must still have exactly this running RW writer. No env read.
    mounts = strict_json(helper.command('docker', 'inspect', '--format', '{{json .Mounts}}', CONTAINER))
    session = [m for m in mounts if m['Destination'] == '/app/session_state']
    require(len(session) == 1 and session[0]['Type'] == 'bind' and session[0]['RW'] and sha(session[0]['Source'].encode()) == VOLUME_SHA, 'session_bind_changed')
    writers = []
    for identity in helper.command('docker', 'ps', '-q', '--no-trunc').splitlines():
        mounts = strict_json(helper.command('docker', 'inspect', '--format', '{{json .Mounts}}', identity))
        if any(m['Source'] == session[0]['Source'] and m['RW'] for m in mounts):
            writers.append(identity)
    require(writers == [CONTAINER], 'session_bind_not_single_writer')
    require(helper.current_generation(helper.inspect_container(CONTAINER)) == actual, 'container_changed_during_observation')
    return generation, proof


def write_once(path, raw):
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o444)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fchmod(stream.fileno(), 0o444)
        os.fsync(stream.fileno())
    descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--helper', type=Path, default=Path('/usr/local/libexec/nodia/attach-gemini-login-cgroup.py'))
    parser.add_argument('--state-directory', type=Path, default=Path('/var/lib/nodia-login-containment'))
    parser.add_argument('--witness-directory', type=Path, default=Path('/var/lib/nodia-login-containment/witnesses/ai40-c6cc8739'))
    parser.add_argument('--binding-id', required=True)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_host_root_required')
    require(str(UUID(args.binding_id)) == args.binding_id, 'binding_id_invalid')
    helper = load_helper(args.helper)
    # Lock an existing attachment lock; default preflight creates no file.
    fd = os.open(args.state_directory / 'attach.lock', os.O_RDONLY | os.O_NOFOLLOW)
    import fcntl
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600, 'attachment_lock_unsafe')
        fcntl.flock(fd, fcntl.LOCK_EX)
        generation, proof = observe(helper, args.state_directory, args.witness_directory)
        bindings = args.state_directory / 'chat-bindings'
        require(not bindings.exists() or len(read_bindings(args.state_directory)) < 8, 'binding_capacity_exceeded')
        target = bindings / (ATTEMPT + '.json')
        require(not target.exists() and not target.is_symlink(), 'binding_already_exists')
        lineage = {'receipt_sha256': RECEIPTS, 'helper_sha256': HELPER_SHA, 'source_sha256': SOURCES,
                   'host_state_sha256': STATE_SHA, 'session_volume_source_sha256': VOLUME_SHA}
        public = validate_public({'version': 1, 'kind': 'legacy_chat_pre_stop', 'binding_id': args.binding_id, 'engine': 'agentic',
            'attempt_id': ATTEMPT, 'resource_key': RESOURCE, 'session_generation': SESSION, 'operation_ref': ATTEMPT,
            'record_sha256': RECORD_SHA, 'record_bytes': 441, 'record_observed_at': proof['observed_at'],
            'bound_at': datetime.now(timezone.utc).isoformat(), 'generation': {key: generation[key] for key in ('container_id', 'started_at', 'boot', 'device', 'parent_inode')},
            'lineage_sha256': sha(json.dumps(lineage, sort_keys=True, separators=(',', ':')).encode())})
        raw = (json.dumps({'version': 1, 'public': public, 'generation': generation, 'lineage': lineage}, sort_keys=True, separators=(',', ':')) + '\n').encode()
        if args.execute:
            if not bindings.exists():
                bindings.mkdir(mode=0o700)
            safe_directory(bindings)
            write_once(target, raw)
            require(read_file(target, mode=0o444, maximum=16384) == raw, 'binding_postwrite_mismatch')
        print(json.dumps({'status': 'bound_pre_stop' if args.execute else 'ready_no_mutation', 'binding': public,
            'binding_file_sha256': sha(raw) if args.execute else None, 'native_ledger_writes': 0, 'SDK_requests': 0, 'SQL_writes': 0,
            'service_mutations': 0, 'physical_closure_certified': False}))
    finally:
        os.close(fd)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, RuntimeError) and re.fullmatch(r'[a-z_]+', str(error)) else type(error).__name__
        print(json.dumps({'status': 'failed', 'code': code}), file=sys.stderr)
        raise SystemExit(1) from None
