"""Isolated kernel/consumer integration. No configured SDK, profile or database.

Only labeled fixture containers are started/stopped/removed. The production
helper, original ARMED record, container generation, Server PIDs and four Codex
proofs are read before/after. A synthetic binding is explicitly created inside
the fixture state; the real-owner producer main/observe are never invoked.
"""
import argparse
from datetime import datetime, timezone
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
from uuid import uuid4

HELPER_SHA = '170c795228f1154ea8e3b330c50780ebff742103314da91173214df1cdbd9549'
PRODUCER_SHA = '91ffd3fa488958d9809777f88e855a90b546b3809ac7fa0e263d789db2465b87'
OLD_HELPER_SHA = 'e8b525c777446c69e0c67a90db29c0932a565b288cca7f88c422d28032c6a463'
ORIGINAL = 'c4814c5a184b55cd95c751ed904d0c957c0311148f8732169928ce6c3b2d5bd3'
PROOFS = {'mcp': 'a1f1ee2742324a87d8f96fc4207fb7845fa5deb51eb5d772d30faa6858e1eff0',
    'mcp-image-png': '9a1848159f6e0756db7986233516e4fe6b6d180c37acf8fe26b6b0384cfea131',
    'mcp-image-jpeg': '2b6426566681eaa95e0fa9a0c5686061069451a84f42c80a5967bd0608510772',
    'mcp-image-webp': '744b7224928083c5703bc01a0e6575db9e10589a85b7dd86c43f99f4222e3c38'}


def require(value, code):
    if not value:
        raise RuntimeError(code)


def run(*args, input=None):
    result = subprocess.run(args, input=input, capture_output=True, text=True, timeout=45)
    require(result.returncode == 0, 'fixture_command_failed')
    require(len(result.stdout.encode()) <= 131072, 'fixture_output_too_large')
    return result.stdout.strip()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def guarded_bytes(path, uid, mode, maximum=65536):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and info.st_nlink == 1
                and stat.S_IMODE(info.st_mode) == mode and info.st_size <= maximum, 'original_file_metadata_changed')
        raw = source.read(maximum + 1)
        require(len(raw) == info.st_size, 'original_file_read_changed')
        return raw


def module(path, name, pin):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022 and info.st_nlink == 1, 'fixture_source_unsafe')
    raw = path.read_bytes()
    require(digest(raw) == pin, 'fixture_source_pin_mismatch')
    loaded = importlib.util.module_from_spec(importlib.util.spec_from_loader(name, loader=None))
    exec(compile(raw, str(path), 'exec'), loaded.__dict__)
    return loaded


def original_snapshot():
    value = json.loads(run('docker', 'inspect', '--format', '{"id":{{json .Id}},"image":{{json .Image}},"started_at":{{json .State.StartedAt}},"pid":{{json .State.Pid}},"running":{{json .State.Running}}}', ORIGINAL))
    require(value['id'] == ORIGINAL and value['image'] == 'sha256:6b9e2f7e3273f89c4c2285c852135213bb82a3391bfe06895f523554033acb49'
            and value['started_at'] == '2026-10-24T16:27:29.789816885Z' and value['running'], 'original_generation_changed')
    root = Path('/proc') / str(value['pid']) / 'root'
    paths = {'native_armed': root / 'app/session_state/runtime_admission/attempts/c6cc8739-7de7-4c13-a5c9-6b230fb3b1de.json',
        'root_certificate': root / 'run/nodia-login-containment.json',
        'active_helper': Path('/usr/local/libexec/nodia/attach-gemini-login-cgroup.py'),
        'host_state': Path('/var/lib/nodia-login-containment/state.json')}
    metadata = {'native_armed': (10001, 0o600), 'root_certificate': (0, 0o444), 'active_helper': (0, 0o755), 'host_state': (0, 0o600)}
    raw = {key: guarded_bytes(path, *metadata[key]) for key, path in paths.items()}
    value['sha256'] = {key: digest(content) for key, content in raw.items()}
    require(value['sha256'] == {'native_armed': 'eec6a5f80405b2ba2a1510d7d5a3fd3bfe413a1dfee55256741d49da0865cf90',
        'root_certificate': '54e6cebf62e0891045f487521d1b1c7b670946322986688faff68ab0933002ea',
        'active_helper': OLD_HELPER_SHA, 'host_state': 'eea7136e6d4f0bf52bf7430efa3541d0529100be081ffcabd17f6e9000d6528f'}, 'original_receipt_or_host_authority_changed')
    require(json.loads(raw['root_certificate'])['version'] == 1, 'original_certificate_not_v1')
    value['services'] = {unit: run('systemctl', 'show', unit, '--property=MainPID,ActiveState,WorkingDirectory') for unit in ('nodia-api', 'nodia-ai-worker')}
    require('MainPID=3758224\n' in value['services']['nodia-api'] and 'MainPID=3758225\n' in value['services']['nodia-ai-worker']
            and all('ActiveState=active' in v and '/opt/nodia/releases/nodia-server-ai40-r08' in v for v in value['services'].values()), 'original_server_services_changed')
    value['Codex_proof_sha256'] = {kind: digest(guarded_bytes(Path('/var/lib/nodia/codex/1/nodia-chat-' + kind), 10000, 0o600)) for kind in PROOFS}
    require(value['Codex_proof_sha256'] == PROOFS, 'original_codex_proof_changed')
    return value


CONSUMER = '''import json,sys,hashlib
from pathlib import Path
from types import SimpleNamespace
from nodia_ai_chat import ChatAdapter
from native_attempts import ReconcileAttempt,AcknowledgeAttempt
from profile_admission import ProfileAdmission
from service_errors import ServiceError
args=json.loads(sys.stdin.read());phase=args['phase'];attempt=args['attempt_id']
assert __import__('os').getuid()==10001
state=Path('/app/session_state/runtime_admission')
profiles=ProfileAdmission(Path('/app/session_state/fixture-web'),Path('/app/session_state/fixture-agentic'),state)
# Explicit dependency fixture: no Agentic service construction, no CLI/SDK calls.
fake=SimpleNamespace(session_generation='b'*32,runner=SimpleNamespace(_processes=set()))
adapter=ChatAdapter(None,fake,profiles)
reference=ReconcileAttempt(resource_key=profiles.identity('agentic'),session_generation='a'*32,operation_ref=attempt)
if phase=='create':
 proof=adapter.ledger.arm(attempt,'agentic',reference)
 raw=(adapter.ledger.directory/(attempt+'.json')).read_bytes()
 print(json.dumps({'proof':proof.model_dump(),'record_sha256':hashlib.sha256(raw).hexdigest(),'record_bytes':len(raw)}))
elif phase=='reject':
 before=(adapter.ledger.directory/(attempt+'.json')).read_bytes()
 try:adapter.reconcile('agentic',attempt,reference)
 except ServiceError as error:assert error.code=='native_operation_active_or_unverified'
 else:raise AssertionError('Live old root cannot authorize terminal')
 assert (adapter.ledger.directory/(attempt+'.json')).read_bytes()==before
 print(json.dumps({'rejected':True,'ledger_unchanged':True}))
elif phase=='recover':
 reply=adapter.reconcile('agentic',attempt,reference)
 assert reply['outcome']=='abandoned_unknown' and reply['process_closed'] is True
 assert adapter.reconcile('agentic',attempt,reference)==reply
 ack=AcknowledgeAttempt(**reference.model_dump(),terminal_proof_id=reply['terminal_proof_id'])
 assert adapter.acknowledge('agentic',attempt,ack)=={'acknowledged':True}
 assert adapter.ledger.read(attempt) is None
 print(json.dumps({'outcome':reply['outcome'],'terminal_proof_id':reply['terminal_proof_id'],'ACK':True,'record_absent':True,'SDK_requests':0}))
else:raise AssertionError('Unknown fixture phase')
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--helper', type=Path, required=True)
    parser.add_argument('--producer', type=Path, required=True)
    parser.add_argument('--image', required=True, help='Reviewed selective candidate image SHA256, never a mutable tag')
    args = parser.parse_args()
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_host_root_required')
    require(re.fullmatch(r'sha256:[0-9a-f]{64}', args.image), 'candidate_image_identity_invalid')
    require(run('docker', 'image', 'inspect', '--format', '{{.Id}}', args.image) == args.image, 'candidate_image_missing')
    h = module(args.helper, 'fixture_chat_cgroup_helper', HELPER_SHA)
    p = module(args.producer, 'fixture_chat_binding_parser', PRODUCER_SHA)
    # Fixture source location only. The parser's digest and all logic stay pinned.
    h.BINDING_PRODUCER = args.producer
    before = original_snapshot()
    marker = uuid4().hex[:12]
    name, label = 'nodia-chat-cgroup-test-' + marker, 'nodia.ai40.host-fixture=' + marker
    base = Path('/var/lib/nodia-chat-containment-tests-r01')
    if not base.exists():
        base.mkdir(mode=0o700)
    p.safe_directory(base)
    workspace = base / marker
    workspace.mkdir(mode=0o700)
    session = workspace / 'session'
    session.mkdir(mode=0o700)
    os.chown(session, 10001, 10001)
    state = workspace / 'state'
    containers, checks = set(), []
    def start():
        identity = run('docker', 'run', '-d', '--name', name, '--label', label, '--network', 'none', '--user', '10001:10001',
            '--memory', '384m', '--pids-limit', '96', '--mount', f'type=bind,src={session},dst=/app/session_state',
            '--entrypoint', 'python', args.image, '-I', '-c', 'import time;time.sleep(360)')
        require(re.fullmatch(r'[0-9a-f]{64}', identity), 'fixture_container_identity_invalid')
        containers.add(identity)
        return identity
    def consumer(identity, phase, attempt):
        return json.loads(run('docker', 'exec', '-i', '--user', '10001:10001', identity, 'python', '-B', '-c', CONSUMER,
            input=json.dumps({'phase': phase, 'attempt_id': attempt})))
    def certificate(identity):
        return json.loads(run('docker', 'exec', '--user', '10001:10001', identity, 'python', '-I', '-c',
            "import json,stat;from pathlib import Path;p=Path('/run/nodia-login-containment.json');s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and stat.S_IMODE(s.st_mode)==0o444 and s.st_nlink==1;print(p.read_text())"))
    result = {'status': 'failed', 'checks': checks, 'fixture_label': label, 'fixture_workspace': str(workspace), 'synthetic_binding_not_real_producer': True, 'consumer_dependency': 'FakeAgentic only; real ChatAdapter/ProfileAdmission/NativeAttemptLedger/attestation/ACK', 'SDK_requests': 0, 'operational_SQL_writes': 0}
    try:
        old_id = start()
        h.attach(name, state)
        generation = h.load_state(state, name)[0]
        attempt = str(uuid4())
        record = consumer(old_id, 'create', attempt)
        public = p.validate_public({'version': 1, 'kind': 'legacy_chat_pre_stop', 'binding_id': str(uuid4()), 'engine': 'agentic',
            'attempt_id': attempt, 'resource_key': record['proof']['resource_key'], 'session_generation': record['proof']['session_generation'],
            'operation_ref': attempt, 'record_sha256': record['record_sha256'], 'record_bytes': record['record_bytes'],
            'record_observed_at': record['proof']['observed_at'], 'bound_at': datetime.now(timezone.utc).isoformat(),
            'generation': {k: generation[k] for k in ('container_id', 'started_at', 'boot', 'device', 'parent_inode')}, 'lineage_sha256': digest(b'{"fixture_only":true}')})
        bindings = state / 'chat-bindings'
        bindings.mkdir(mode=0o700)
        raw = json.dumps({'version': 1, 'public': public, 'generation': generation, 'lineage': {'fixture_only': True}}, separators=(',', ':')).encode()
        p.write_once(bindings / (attempt + '.json'), raw)
        h.attach(name, state)
        current = certificate(old_id)
        require(current['version'] == 2 and current['chat_bindings'] == [public] and current['closed_roots'] == [], 'live_root_not_failclosed')
        require(consumer(old_id, 'reject', attempt)['rejected'], 'live_consumer_not_rejected')
        checks.append('binding_of_current_root_never_authorizes_native_terminal')
        run('docker', 'rename', old_id, name + '-old')
        new_id = start()
        h.attach(name, state)
        current = certificate(new_id)
        require(current['closed_roots'] == [] and len(h.load_state(state, name)) == 2, 'running_old_root_not_retained')
        require(consumer(new_id, 'reject', attempt)['ledger_unchanged'], 'replacement_namespace_authorized_without_kernel_closure')
        checks.append('old_running_container_still_blocks_after_name_and_namespace_replacement')
        run('docker', 'stop', '--time', '1', old_id)
        h.attach(name, state)
        current = certificate(new_id)
        closed = {k: generation[k] for k in ('boot', 'device', 'parent_inode')}
        require(current['closed_roots'] == [closed] and current['chat_bindings'] == [public], 'old_kernel_root_closure_missing')
        require((bindings / (attempt + '.json')).read_bytes() == raw, 'fixture_binding_bytes_changed')
        checks.append('kernel_closed_old_root_is_retained_and_certified_without_login_journal')
        result['native'] = consumer(new_id, 'recover', attempt)
        checks.append('real_native_consumer_abandoned_unknown_then_idempotent_reconcile_and_normal_ACK')
        result['status'] = 'checks_passed_cleanup_pending'
        result['fixture_container_ids'] = sorted(containers)
    finally:
        try:
            # Discovery is bounded to our unpredictable label, including a start
            # that returned no identity. No command against an operative name.
            containers.update(run('docker', 'ps', '-aq', '--no-trunc', '--filter', 'label=' + label).splitlines())
            result['fixture_container_ids'] = sorted(containers)
            for identity in containers:
                require(re.fullmatch(r'[0-9a-f]{64}', identity), 'fixture_cleanup_identity_invalid')
                require(run('docker', 'inspect', '--format', '{{index .Config.Labels "nodia.ai40.host-fixture"}}', identity) == marker
                        and run('docker', 'inspect', '--format', '{{.Image}}', identity) == args.image, 'fixture_cleanup_identity_mismatch')
                run('docker', 'rm', '-f', identity)
            result['remaining_fixture_containers'] = run('docker', 'ps', '-aq', '--filter', 'label=' + label).splitlines()
            require(result['remaining_fixture_containers'] == [], 'fixture_containers_remain')
            after = original_snapshot()
            require(after == before, 'original_state_changed_during_fixture')
            result['original_before_after_equal'] = True
            result['original_snapshot'] = after
            # Only the exact generated private fixture path; no real profile mounts.
            require(workspace.parent == base and workspace.resolve().parent == base.resolve() and not workspace.is_symlink(), 'fixture_workspace_cleanup_invalid')
            shutil.rmtree(workspace)
            result['fixture_workspace_removed'] = not workspace.exists()
            if result['status'] == 'checks_passed_cleanup_pending':
                result['status'] = 'passed'
        finally:
            print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, RuntimeError) and re.fullmatch(r'[a-z_]+', str(error)) else type(error).__name__
        print(json.dumps({'status': 'failed_closed', 'code': code}), file=sys.stderr)
        raise SystemExit(1) from None
