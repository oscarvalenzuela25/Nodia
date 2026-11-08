"""Root-only cgroup attachment plus bounded legacy CHAT generation retention.

Operator command, not an HTTP or model capability. No Docker privilege/socket,
host-wide cgroup mount, controller delegation, resource limit or profile changes
are introduced inside the container. The public proof contains no host paths.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime
import fcntl
import json
import hashlib
import importlib.util
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
from uuid import UUID, uuid4

UID = 10001
CGROUP_BASE = Path('/sys/fs/cgroup')
TARGET = '/run/nodia-login-cgroups'
PROOF = '/run/nodia-login-containment.json'
MAX_GENERATIONS = 128
BINDING_PRODUCER = Path('/usr/local/libexec/nodia/gemini-chat-host-binding-r02.py')
BINDING_PRODUCER_SHA = '822c1fc84166d065c61b9482fd552a6af2122d54118dc62d393ab75dc01f74eb'


def chat_bindings(directory):
    # Execute only the reviewed pure parser, never the producer's CLI/main.
    for parent in [BINDING_PRODUCER.parent, *BINDING_PRODUCER.parent.parents]:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode)
                and info.st_uid == 0 and not info.st_mode & 0o022, 'binding_parser_parent_unsafe')
    descriptor = os.open(BINDING_PRODUCER, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1
                and not info.st_mode & 0o022 and info.st_size <= 65536, 'binding_parser_unsafe')
        raw = source.read(65537)
    require(hashlib.sha256(raw).hexdigest() == BINDING_PRODUCER_SHA, 'binding_parser_pin_mismatch')
    module = importlib.util.module_from_spec(importlib.util.spec_from_loader('ai40_host_binding_parser', loader=None))
    exec(compile(raw, str(BINDING_PRODUCER), 'exec'), module.__dict__)
    return module.read_bindings(directory)


def bound_references(old, bindings):
    references = set()
    for binding in bindings:
        # Never reconstruct a lost generation from a client or a native file.
        require(binding['generation'] in old, 'chat_binding_generation_not_retained')
        safe_cgroup_path(binding['generation']['cgroup_path'])
        references.add(tuple_key(binding['generation']))
    return references


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def command(*arguments, input=None):
    result = subprocess.run(arguments, input=input, text=True, capture_output=True,
                            timeout=20, check=False)
    require(result.returncode == 0, 'operator_command_failed:' + arguments[0])
    require(len(result.stdout.encode()) <= 1_048_576, 'operator_response_too_large')
    return result.stdout.strip()


def strict_json(value):
    def object_pairs(pairs):
        result = {}
        for key, item in pairs:
            require(key not in result, 'duplicate_json_key')
            result[key] = item
        return result
    return json.loads(value, object_pairs_hook=object_pairs)


def boot_id():
    value = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    require(str(UUID(value)) == value, 'host_boot_invalid')
    return value


def inspect_container(identity, missing_ok=False):
    # Select only operational fields; never read/export container environment.
    template = '{"id":{{json .Id}},"name":{{json .Name}},"state":{{json .State}},"user":{{json .Config.User}}}'
    result = subprocess.run(['docker', 'inspect', '--type', 'container', '--format', template, identity],
                            text=True, capture_output=True, timeout=15, check=False)
    if result.returncode:
        if missing_ok and re.search(r'No such (?:object|container)', result.stderr, re.IGNORECASE):
            return None
        raise RuntimeError('container_inspection_failed')
    require(len(result.stdout.encode()) <= 16_384, 'container_inspection_too_large')
    value = strict_json(result.stdout)
    require(re.fullmatch(r'[0-9a-f]{64}', value['id']) is not None, 'container_id_invalid')
    require(isinstance(value['state']['Pid'], int), 'container_pid_invalid')
    require(isinstance(value['state']['Running'], bool), 'container_state_invalid')
    started = value['state']['StartedAt']
    require(isinstance(started, str) and len(started) <= 64 and datetime.fromisoformat(started.replace('Z', '+00:00')).tzinfo is not None,
            'container_generation_invalid')
    return value


def numeric(value):
    return type(value) is int and 0 < value <= 2**64 - 1


def tuple_key(value):
    return value['boot'], value['device'], value['parent_inode']


def safe_cgroup_path(value):
    candidate = Path(value)
    require(candidate.is_absolute() and '..' not in candidate.parts and candidate != CGROUP_BASE,
            'cgroup_path_invalid')
    require(candidate.is_relative_to(CGROUP_BASE), 'cgroup_path_outside_subtree')
    for part in [candidate, *candidate.parents]:
        if part == CGROUP_BASE.parent:
            break
        try:
            info = part.lstat()
            require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode), 'cgroup_path_unsafe')
        except FileNotFoundError:
            pass  # A removed old subtree is a kernel closure witness.
    return candidate


def current_generation(container):
    pid = container['state']['Pid']
    require(container['state']['Running'] and pid > 1, 'container_not_running')
    uid_lines = [line for line in Path(f'/proc/{pid}/status').read_text().splitlines() if line.startswith('Uid:')]
    require(len(uid_lines) == 1 and [int(x) for x in uid_lines[0].split()[1:]] == [UID] * 4,
            'container_main_uid_mismatch')
    require(os.readlink(f'/proc/{pid}/ns/cgroup') != os.readlink('/proc/self/ns/cgroup'), 'private_cgroup_namespace_required')
    lines = Path(f'/proc/{pid}/cgroup').read_text().splitlines()
    require(len(lines) == 1 and lines[0].startswith('0::/'), 'unified_cgroup_required')
    membership = lines[0][3:]
    mounts = []
    for line in Path(f'/proc/{pid}/mountinfo').read_text().splitlines():
        before, separator, after = line.partition(' - ')
        fields = before.split()
        if separator and len(fields) >= 6 and fields[4] == '/sys/fs/cgroup' and after.split()[0] == 'cgroup2':
            mounts.append(fields[3])
    require(len(mounts) == 1 and mounts[0].startswith('/') and mounts[0] != '/', 'private_cgroup_root_required')
    relative = mounts[0]
    require(membership == relative or membership.startswith(relative.rstrip('/') + '/'), 'container_cgroup_membership_mismatch')
    root = safe_cgroup_path(str(CGROUP_BASE / relative.lstrip('/')))
    require((root / 'cgroup.controllers').is_file() and (root / 'cgroup.events').is_file(), 'cgroup_v2_required')
    info = root.stat()
    return {'container_id': container['id'], 'started_at': container['state']['StartedAt'],
            'boot': boot_id(), 'host_device': info.st_dev, 'host_inode': info.st_ino,
            'cgroup_path': str(root)}


def ensure_private_directory(directory):
    require(directory.is_absolute() and '..' not in directory.parts, 'state_directory_invalid')
    for part in reversed([directory, *directory.parents]):
        try:
            info = part.lstat()
        except FileNotFoundError:
            part.mkdir(mode=0o700)
            info = part.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and info.st_uid == 0,
                'state_directory_unsafe')
        require(info.st_mode & 0o022 == 0, 'state_parent_writable')
    require(directory.stat().st_mode & 0o077 == 0, 'state_directory_not_private')


@contextmanager
def locked_state(directory):
    ensure_private_directory(directory)
    fd = os.open(directory / 'attach.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_mode & 0o077 == 0, 'state_lock_unsafe')
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def load_state(directory, name):
    try:
        fd = os.open(directory / 'state.json', os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        return []
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_mode & 0o077 == 0 and info.st_size <= 131_072,
                'state_file_unsafe')
        with os.fdopen(fd, encoding='utf8') as source:
            fd = -1
            value = strict_json(source.read())
        require(set(value) == {'version', 'container_name', 'generations'} and value['version'] == 1 and value['container_name'] == name,
                'state_schema_invalid')
        records = value['generations']
        require(isinstance(records, list) and len(records) <= MAX_GENERATIONS, 'state_generations_invalid')
        seen = set()
        for record in records:
            require(set(record) == {'container_id', 'started_at', 'boot', 'device', 'parent_inode', 'host_device', 'host_inode', 'cgroup_path'}, 'generation_schema_invalid')
            require(re.fullmatch(r'[0-9a-f]{64}', record['container_id']) is not None and str(UUID(record['boot'])) == record['boot'], 'generation_identity_invalid')
            require(all(numeric(record[key]) for key in ('device', 'parent_inode', 'host_device', 'host_inode')), 'generation_proof_invalid')
            require(isinstance(record['started_at'], str) and len(record['started_at']) <= 64, 'generation_time_invalid')
            safe_cgroup_path(record['cgroup_path'])
            require(tuple_key(record) not in seen, 'generation_duplicate')
            seen.add(tuple_key(record))
        return records
    finally:
        if fd >= 0:
            os.close(fd)


def write_state(directory, name, generations):
    temporary = directory / (uuid4().hex + '.tmp')
    try:
        fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'w', encoding='utf8') as target:
            json.dump({'version': 1, 'container_name': name, 'generations': generations}, target, separators=(',', ':'))
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, directory / 'state.json')
        descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    finally:
        temporary.unlink(missing_ok=True)


def journal_references(pid):
    descriptor = os.open(f'/proc/{pid}/root', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in ('app', 'session_state', 'login_requests'):
            try:
                next_descriptor = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
            except FileNotFoundError:
                return set()
            os.close(descriptor)
            descriptor = next_descriptor
        info = os.fstat(descriptor)
        require(info.st_uid == UID and info.st_mode & 0o077 == 0, 'journal_directory_unsafe')
        names = os.listdir(descriptor)
        require(len(names) <= 512, 'journal_too_large')
        references = set()
        for name in names:
            if re.fullmatch(r'[0-9a-f]{32}\.json', name) is None:
                continue
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=descriptor)
            with os.fdopen(fd, encoding='utf8') as source:
                info = os.fstat(source.fileno())
                require(stat.S_ISREG(info.st_mode) and info.st_uid == UID and info.st_mode & 0o077 == 0 and info.st_size <= 32_768,
                        'journal_file_unsafe')
                record = strict_json(source.read())
            proof = record.get('containment')
            if proof is None:
                continue
            require(isinstance(proof, dict) and set(proof) == {'kind', 'name', 'boot', 'device', 'inode', 'parent_inode'} and proof['kind'] == 'cgroup_v2',
                    'journal_containment_invalid')
            require(re.fullmatch(r'[0-9a-f]{32}', proof['name']) is not None and str(UUID(proof['boot'])) == proof['boot'] and all(numeric(proof[key]) for key in ('device', 'inode', 'parent_inode')),
                    'journal_containment_identity_invalid')
            references.add(tuple_key(proof))
        require(len(references) <= MAX_GENERATIONS, 'journal_generations_full')
        return references
    finally:
        os.close(descriptor)


def generation_closed(old, current, current_container):
    if tuple_key(old) == tuple_key(current):
        return False
    if old['boot'] != current['boot']:
        return True  # Kernel reboot closed every process of that boot.
    observed = inspect_container(old['container_id'], missing_ok=True)
    if observed is not None and observed['state']['Running']:
        if observed['id'] != current_container['id'] or observed['state']['StartedAt'] == old['started_at']:
            return False
        # Same Docker ID restarted: require a different actual cgroup identity.
        if old['host_device'] == current['host_device'] and old['host_inode'] == current['host_inode']:
            return False
    elif observed is not None and observed['state']['Pid'] != 0:
        return False
    previous_path = safe_cgroup_path(old['cgroup_path'])
    try:
        info = previous_path.stat()
    except FileNotFoundError:
        return True
    if (info.st_dev, info.st_ino) != (old['host_device'], old['host_inode']):
        return True  # An old cgroup cannot be removed/replaced while populated.
    fields = dict(line.split() for line in (previous_path / 'cgroup.events').read_text().splitlines())
    require(fields.get('populated') in ('0', '1'), 'old_cgroup_events_invalid')
    return fields['populated'] == '0'


def enter(pid, *arguments, input=None):
    return command('nsenter', '--target', str(pid), '--mount', '--cgroup', '--root', '--wd=/', '--', *arguments, input=input)


PREPARE = '''import json,os,stat
from pathlib import Path
r=Path('/run');s=r.lstat();assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022
assert Path('/proc/1/cgroup').read_text().strip()=='0::/'
p=Path('/run/nodia-login-cgroups')
if not p.exists():p.mkdir(mode=0o700)
s=p.lstat();assert stat.S_ISDIR(s.st_mode) and not stat.S_ISLNK(s.st_mode)
a=Path('/sys/fs/cgroup').stat();print(json.dumps({'device':a.st_dev,'inode':a.st_ino}))
'''
VERIFY = '''import json,os,stat,sys
from pathlib import Path
v=json.loads(sys.stdin.read());p=Path('/run/nodia-login-cgroups');s=p.stat()
assert s.st_dev==v['root_device'] and s.st_ino==v['root_inode'] and s.st_uid==10001
assert (p/'cgroup.procs').stat().st_uid==10001 and (p/'cgroup.kill').stat().st_uid==0
found=[]
for line in Path('/proc/1/mountinfo').read_text().splitlines():
 a,_,b=line.partition(' - ');f=a.split()
 if len(f)>5 and f[4]==str(p):found.append((f[5],b.split()[0]))
assert len(found)==1 and found[0][1]=='cgroup2' and {'rw','nosuid','nodev','noexec'}<=set(found[0][0].split(','))
print('verified')
'''
WRITE_PROOF = '''import json,os,stat,sys,uuid
from pathlib import Path
value=json.loads(sys.stdin.read());root=Path('/run');s=root.lstat()
assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022
temporary=root/('.nodia-containment-'+uuid.uuid4().hex)
try:
 fd=os.open(temporary,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o444);os.fchmod(fd,0o444)
 with os.fdopen(fd,'w') as f:json.dump(value,f,separators=(',',':'));f.flush();os.fsync(f.fileno())
 os.replace(temporary,root/'nodia-login-containment.json')
finally:temporary.unlink(missing_ok=True)
'''


def attach(name, directory):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_host_root_required')
    require(re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}', name) is not None, 'container_name_invalid')
    with locked_state(directory):
        container = inspect_container(name)
        require(container['name'] == '/' + name, 'exact_container_name_required')
        current = current_generation(container)
        pid = container['state']['Pid']
        inside = strict_json(enter(pid, 'python', '-I', '-c', PREPARE))
        require(set(inside) == {'device', 'inode'} and all(numeric(inside[key]) for key in inside), 'namespace_root_invalid')
        # Device/inode identities are recorded in their own filesystem view;
        # public certificates must use the container's actual mounted view.
        current.update(device=inside['device'], parent_inode=inside['inode'])
        references = journal_references(container['state']['Pid'])
        old = load_state(directory, name)
        bindings = chat_bindings(directory)
        references.update(bound_references(old, bindings))
        retained = [item for item in old if tuple_key(item) in references and tuple_key(item) != tuple_key(current)]
        require(len(retained) + 1 <= MAX_GENERATIONS, 'host_generations_full')
        closed = [{key: item[key] for key in ('boot', 'device', 'parent_inode')}
                  for item in retained if generation_closed(item, current, container)]
        # Persist reservation/generation before making any subtree writable.
        write_state(directory, name, [*retained, current])
        root = Path(current['cgroup_path'])
        root_info = root.stat()
        require((root_info.st_dev, root_info.st_ino) == (current['host_device'], current['host_inode']), 'cgroup_changed_before_attach')
        require((root / 'cgroup.kill').stat().st_uid == 0, 'root_kill_must_remain_privileged')
        os.chown(root, UID, UID)
        os.chown(root / 'cgroup.procs', UID, UID)
        # The source resolves INSIDE the already-private container cgroup namespace.
        # An existing exact mount is reused; no stack of repeated bind mounts.
        mounted = enter(pid, 'python', '-I', '-c', "from pathlib import Path;print(sum(line.split(' - ')[0].split()[4]=='/run/nodia-login-cgroups' for line in Path('/proc/1/mountinfo').read_text().splitlines()))")
        require(mounted in ('0', '1'), 'containment_mount_ambiguous')
        if mounted == '0':
            enter(pid, 'mount', '--bind', '/sys/fs/cgroup', TARGET)
            enter(pid, 'mount', '-o', 'remount,bind,rw,nosuid,nodev,noexec', TARGET)
        proof = {'version': 2, 'root_device': current['device'], 'root_inode': current['parent_inode'],
                 'host_boot': current['boot'], 'closed_roots': closed,
                 'chat_bindings': [item['public'] for item in bindings]}
        require(len(json.dumps(proof).encode()) <= 32768, 'public_certificate_too_large')
        require(enter(pid, 'python', '-I', '-c', VERIFY, input=json.dumps(proof)) == 'verified', 'containment_mount_unverified')
        expected_host = {key: value for key, value in current.items() if key not in ('device', 'parent_inode')}
        require(current_generation(inspect_container(name)) == expected_host, 'container_restarted_during_attach')
        enter(pid, 'python', '-I', '-c', WRITE_PROOF, input=json.dumps(proof))
        require(current_generation(inspect_container(name)) == expected_host, 'container_restarted_during_proof')
        return {'status': 'attached', 'container_name': name, 'service_uid': UID,
                'current_generation_persisted': True, 'closed_referenced_roots': len(closed),
                'unresolved_referenced_roots': len(retained) - len(closed),
                'capabilities_added': False, 'namespace_mode_changed': False,
                'resource_limits_changed': False, 'profile_data_changed': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--container-name', default='nodia-gemini-microservice')
    parser.add_argument('--state-directory', type=Path, default=Path('/var/lib/nodia-login-containment'))
    arguments = parser.parse_args()
    print(json.dumps(attach(arguments.container_name, arguments.state_directory), sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # No Docker response, host paths, journal body or subprocess stderr in evidence.
        print(json.dumps({'status': 'failed', 'code': str(error) if isinstance(error, RuntimeError) else type(error).__name__}), file=sys.stderr)
        raise SystemExit(1) from None
