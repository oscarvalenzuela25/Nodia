"""Continue one failed pre-stop R09 adoption after its verified fresh backup.

The original adoption remains failed. This operator owns a new intent, evidence,
drain/descriptor transition and rollback; it never calls the backup CLI again.
Rollback is limited to the same operational projection and a backup no older
than one hour. Later work or expiry requires another reviewed plan.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import time
PARENT = Path('/opt/nodia/verification/ai36-c05-publication-adopt-r09-r01/nodia-ai-ai36-c05-publication-adopt-r09-r01.py')
PARENT_SHA = '36a90a5f15128147f219e9d33d08a330c33e72e4b597fb13922c67c61e918770'
ORIGINAL = PARENT.parent
BEFORE_SHA = 'c77fc73e2c7f3e6f7ba47aaeb199b6aa710ebd7ab5f4979c4c8ee19a5764c357'
FAILURE_SHA = '5809fc8c28ffbb6a6bd3f6796e0608f5d54d7dbff2f67ea5f79e44f76956f0bb'
BACKUP_SHA = '2574626e3c5efbc30d0a892531f67b5d62968d595cc453da2a44ac34caf36f4f'
WORK = Path('/opt/nodia/verification/ai36-c05-publication-continue-r09-r02')
BACKUP_ID = '5087e2df-c4b7-431d-a5f6-ab4ef47110b0'
CAPTURED = '2026-10-25T01:54:36.243Z'
EXPIRES = '2026-11-01T01:54:36.243Z'
CIPHER_SHA = 'd1df8e8f8a2e1ad91a13c74615eafece6621261cf06754f4515d0b7db1596c79'

def require(value, code):
    if not value:
        raise ValueError(code)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def private(path, pin=None):
    info = path.lstat()
    require(path.resolve() == path
        and stat.S_ISREG(info.st_mode)
        and (info.st_uid == 0)
        and (info.st_nlink == 1)
        and (stat.S_IMODE(info.st_mode) == 0o600)
        and (info.st_size <= 4 * 1024 * 1024),
         'private_file_changed')
    raw = path.read_bytes()
    require(pin is None or digest(raw) == pin, 'private_file_pin_changed')
    return raw

def sync_work():
    fd = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)

def write_raw(name, raw):
    fd = os.open(WORK / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    sync_work()

def write(name, value):
    write_raw(name, (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode())

def parent_module():
    raw = private(PARENT, PARENT_SHA)
    namespace = {'__name__': 'immutable_failed_adoption_pure_functions', '__file__': str(PARENT)}
    exec(compile(raw, str(PARENT), 'exec'), namespace)
    return type('Parent', (), namespace)

def lineage(p):
    before = json.loads(private(ORIGINAL / 'adopt-before.json', BEFORE_SHA))
    failed = json.loads(private(ORIGINAL / 'adopt-failure.json', FAILURE_SHA))
    backup = json.loads(private(ORIGINAL / 'adopt-backup.json', BACKUP_SHA))
    require(before['phase'] == 'adopt'
        and before['operator_sha256'] == PARENT_SHA
        and (before['plan_sha256'] == p.PLAN_SHA)
        and (before['source'] == str(p.OLD))
        and (before['target'] == str(p.NEW)),
         'original_before_lineage_changed')
    require(failed['status'] == 'adopt_failed'
        and failed['operator_sha256'] == PARENT_SHA
        and (failed['plan_sha256'] == p.PLAN_SHA)
        and (failed['admission_closed'] is False)
        and (failed['timers_restored'] is True),
         'original_failure_lineage_changed')
    require(not (ORIGINAL / 'adopt-after.json').exists(), 'original_adoption_must_remain_failed')
    require(backup['schema_version'] == 1
        and backup['operation'] == 'backup'
        and (backup['status'] == 'ready')
        and (backup['backup_id'] == BACKUP_ID)
        and (backup['captured_at'] == CAPTURED)
        and (backup['expires_at'] == EXPIRES)
        and (backup['cipher_bytes'] == 1077188)
        and (backup['cipher_sha256'] == CIPHER_SHA)
        and (backup['journal_sequence'] == 1),
         'original_ready_backup_changed')
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(CAPTURED.replace('Z', '+00:00'))).total_seconds()
    require(0 <= age <= 3600
        and (datetime.fromisoformat(EXPIRES.replace('Z',
         '+00:00')) - datetime.fromisoformat(CAPTURED.replace('Z',
         '+00:00'))).total_seconds() == 7 * 86400,
         'postbackup_age_or_retention_invalid')
    return (before, backup)

class Commands:
    """Observe the exact I/O boundary; never emit argv/env/stdout or retry a call."""

    def __init__(self, phase):
        self.phase = phase
        self.events = []
        self.fd = os.open(WORK / (phase + '-commands.jsonl'),
             os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
             384)
        sync_work()

    def category(self, argv):
        values = [str(v) for v in argv]
        require(not any((v.endswith('/nodia-ai-backups.mjs') for v in values)), 'backup_CLI_replay_forbidden')
        if values[0] == 'systemctl' and len(values) > 1 and (values[1] in ('show',
             'start',
             'stop',
             'daemon-reload')):
            return 'systemctl_' + values[1].replace('-', '_')
        if values[:2] == ['docker', 'inspect']:
            return 'Docker_epoch_metadata'
        if any((v.endswith('/nodia-ai-journal.mjs') for v in values)):
            require('status' in values
                and (not any((v in ('bootstrap',
                 'close',
                 'record',
                 'confirm',
                 'prune') for v in values))),
                 'journal_mutation_forbidden')
            return 'journal_status_read'
        if '/usr/local/bin/node' in values and '-e' in values:
            return 'compiled_readonly_Node'
        raise ValueError('unexpected_command_family')

    def observe(self, category, began, result=None, error=None):
        stderr = result.stderr or b'' if result is not None else error.stderr or b'' if isinstance(error,
             subprocess.TimeoutExpired) else b''
        record = {'command_id': len(self.events) + 1,
             'category': category,
             'elapsed_ms': round((time.monotonic() - began) * 1000),
             'returncode': result.returncode if result is not None else None,
             'timeout': isinstance(error,
             subprocess.TimeoutExpired),
             'exception_class': type(error).__name__ if error else None,
             'stdout_bytes': len(result.stdout
            or b'') if result is not None else None,
             'argv_env_stdout_emitted': False}
        if stderr:
            clipped = stderr[:131072]
            name = self.phase + '-stderr-' + str(record['command_id']) + '.private'
            write_raw(name, clipped)
            record.update(private_stderr_file=name,
                 private_stderr_bytes=len(stderr),
                 private_stderr_retained_sha256=digest(clipped),
                 private_stderr_truncated=len(clipped) != len(stderr))
        self.events.append(record)
        raw = (json.dumps(record, sort_keys=True) + '\n').encode()
        view = memoryview(raw)
        while view:
            size = os.write(self.fd, view)
            require(size > 0, 'command_journal_short_write')
            view = view[size:]
        os.fsync(self.fd)

    def command(self, argv, *, cwd=None, env=None, source=None, timeout=30):
        category = self.category(argv)
        began = time.monotonic()
        try:
            result = subprocess.run(argv,
                 cwd=cwd,
                 env=env,
                 input=source,
                 capture_output=True,
                 timeout=timeout,
                 check=False)
        except Exception as error:
            self.observe(category, began, error=error)
            raise
        self.observe(category, began, result=result)
        return result

    def checked(self, argv, timeout=20, cwd=None):
        result = self.command(argv, cwd=cwd, timeout=timeout)
        require(result.returncode == 0, 'closed_command_failed_' + self.category(argv))
        return result.stdout

    def close(self):
        os.close(self.fd)
CATALOG_SOURCE = r"""
import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';
const root='/opt/nodia/releases/nodia-server-ai40-r08',sha=b=>createHash('sha256').update(b).digest('hex');
const raw=await readFile(root+'/release-manifest.json');assert.equal(sha(raw),'08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc');const manifest=JSON.parse(raw);
for(const file of ['dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js','dist/nodia-ai-recovery/use-case/update-nodia-ai-external-state.use-case.js'])assert.equal(sha(await readFile(root+'/'+file)),manifest.files[file]);
const{loadNodiaAiExternalRecoveryConfig,createNodiaAiExternalRecovery}=await import(root+'/dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js');
const external=createNodiaAiExternalRecovery(loadNodiaAiExternalRecoveryConfig('/etc/nodia-ai-recovery/recovery.json'));
try{const snapshot=await external.store.snapshot();const matches=snapshot.state.backups.filter(b=>b.backup_id==='5087e2df-c4b7-431d-a5f6-ab4ef47110b0');assert.equal(matches.length,1);const b=matches[0];assert.equal(b.status,'ready');assert.equal(b.cipher_bytes,1077188);assert.equal(b.cipher_sha256,'d1df8e8f8a2e1ad91a13c74615eafece6621261cf06754f4515d0b7db1596c79');assert.equal(b.captured_at,'2026-10-25T01:54:36.243Z');assert.equal(b.expires_at,'2026-11-01T01:54:36.243Z');const age=Date.now()-Date.parse(b.captured_at);assert.ok(age>=0&&age<=3600000);assert.equal(Date.parse(b.expires_at)-Date.parse(b.captured_at),7*86400000);assert.equal(snapshot.state.last_sequence,1);assert.equal(snapshot.state.entries.filter(e=>e.confirmed_at===null).length,0);assert.equal(snapshot.state.backups.filter(b=>b.status==='pending').length,0);console.log(JSON.stringify({status:'exact_backup_unique_ready',backup_id:b.backup_id,capture_age_ms:age,cipher_sha256:b.cipher_sha256,journal_sequence:snapshot.state.last_sequence,R2_GETs:1,R2_PUTs:0}));}finally{external.client.destroy();}
"""

def ready_catalog(p, commands):
    user = pwd.getpwnam('nodia')
    require(user.pw_uid == 10000, 'catalog_reader_uid_changed')
    result = commands.command(['/usr/sbin/runuser',
         '--preserve-environment',
         '-u',
         'nodia',
         '--',
         '/usr/local/bin/node',
         '--input-type=module',
         '-e',
         CATALOG_SOURCE],
         cwd=p.OLD,
         env={'PATH': '/usr/local/bin:/usr/bin:/bin',
         'HOME': user.pw_dir,
         'NODE_ENV': 'test',
         'DOTENV_CONFIG_PATH': '/dev/null',
         'RATE_LIMIT_STORAGE': 'memory'},
         timeout=25)
    require(result.returncode == 0 and 0 < len(result.stdout) <= 8192, 'ready_backup_catalog_read_failed')
    value = json.loads(result.stdout)
    require(value['status'] == 'exact_backup_unique_ready'
        and value['backup_id'] == BACKUP_ID
        and (value['R2_PUTs'] == 0),
         'ready_backup_catalog_changed')
    return value

def run(args):
    require(sys.platform == 'linux'
        and os.getuid() == 0
        and (not sys.flags.optimize),
         'unoptimized_linux_root_required')
    sys.dont_write_bytecode = True
    require(digest(private(Path(__file__).resolve())) == args.operator_sha256, 'continuation_source_changed')
    require(args.phase == 'preflight' or args.execute, 'explicit_execute_required')
    info = WORK.lstat()
    require(WORK.resolve() == WORK
        and stat.S_ISDIR(info.st_mode)
        and (info.st_uid == 0)
        and (stat.S_IMODE(info.st_mode) == 0o700),
         'private_work_changed')
    p = parent_module()
    before_origin, backup = lineage(p)
    base = p.load(p.UTILITY, p.UTILITY_SHA, 'postbackup_transition_utilities')
    a = p.load(p.ACTIVATION, p.ACTIVATION_SHA, 'postbackup_journal_operations')
    plan, publication = p.publication_guard(base)
    scope = p.load(p.R07, p.R07_SHA, 'postbackup_pure_scope')
    scope.OLD, scope.NEW = (p.OLD, p.NEW)
    scope_value = scope.unchanged_scope()
    proof = p.load(p.R06, p.R06_SHA, 'postbackup_typed_proofs')
    g = p.load(p.MCP, p.MCP_SHA, 'postbackup_private_sources')
    g.historical_guard_file(g.HELPER)
    h = p.load(g.HELPER, g.HELPER_SHA, 'postbackup_SQL_projection', mode=0o644)
    h.validate_candidate(g.LEGACY_MANIFEST_SHA)
    reverse = args.phase == 'rollback' or (args.phase == 'preflight' and args.direction == 'rollback')
    source, target = (p.NEW, p.OLD) if reverse else (p.OLD, p.NEW)
    base.NEW = target
    command_key = args.phase if args.phase != 'preflight' else 'preflight-' + ('rollback' if reverse else 'continue')
    commands = Commands(command_key)
    a.checked = commands.checked
    h.command = commands.command
    try:
        before = p.snapshot(a, base, h, proof, source)
        if reverse:
            previous = json.loads(private(WORK / 'continue-after.json'))
            require(previous['status'] == 'continuation_completed'
                and previous['operator_sha256'] == args.operator_sha256
                and (previous['plan_sha256'] == p.PLAN_SHA)
                and (previous['post_consumers'] == before['consumers']),
                 'own_rollback_lineage_changed')
            require(before['SQL'] == previous['after']['SQL'], 'rollback_requires_new_backup_for_later_work')
        else:
            p.invariants(a, base, before_origin['before'], before)
            require(before['consumers'] == before_origin['before']['consumers'], 'original_source_owner_changed')
        transitions = base.descriptor_bytes(source, target)
        if not reverse:
            for i, (_, expected, _, mode) in enumerate(transitions):
                require(p.private(ORIGINAL / ('descriptor-' + str(i) + '.private'),
                     mode=mode) == expected,
                     'original_source_descriptor_changed')
        catalog = ready_catalog(p, commands)
        timers = {u: a.state(u)['active'] for u in a.TIMERS}
        require(all((v == 'active' for v in timers.values())), 'timers_not_active_at_entry')
        common = {'schema': 'nodia-ai-ai36-c05-publication-postbackup-continuation-v1',
             'phase': args.phase,
             'operator_sha256': args.operator_sha256,
             'plan_sha256': p.PLAN_SHA,
             'source': str(source),
             'target': str(target),
             'original_adopter_sha256': PARENT_SHA,
             'original_before_sha256': BEFORE_SHA,
             'original_failure_sha256': FAILURE_SHA,
             'original_adopt_status': 'adopt_failed',
             'original_backup_receipt_sha256': BACKUP_SHA,
             'backup_replayed': False,
             'backup': backup,
             'catalog_read': catalog,
             'before': before,
             'publication': publication,
             'technical_scope_transition': scope_value,
             'provider_requests': 0,
             'SQL_restores': 0,
             'migrations': 0}
        if args.phase == 'preflight':
            return {**common, 'status': 'preflight_passed_no_mutations', 'commands': commands.events}
        lockfd = os.open(WORK / 'deployment.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        with os.fdopen(lockfd, 'r+b') as lock:
            private(WORK / 'deployment.lock')
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            write(args.phase + '-before.json', common)
            if not reverse:
                for i, (_, raw, _, _) in enumerate(transitions):
                    write_raw('descriptor-' + str(i) + '.original', raw)
            else:
                for i, (_, _, desired, _) in enumerate(transitions):
                    require(private(WORK / ('descriptor-' + str(i) + '.original')) == desired,
                         'own_rollback_descriptor_changed')
            admission_closed = False
            timers_stopped = False
            try:
                timers_stopped = True
                a.checked(['systemctl', 'stop', *a.TIMERS])
                base.oneshots_idle(a)
                lineage(p)
                current = p.snapshot(a, base, h, proof, source)
                p.invariants(a, base, before, current)
                require(current['consumers'] == before['consumers'], 'source_changed_before_drain')
                catalog = ready_catalog(p, commands)
                admission_closed = True
                a.checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
                require(a.stopped('nodia-api'), 'API_not_stopped')
                deadline = time.monotonic() + 45
                while True:
                    value = h.chat_projection(before['consumers']['nodia-ai-worker']['pid'])
                    if all((value.get(k) == 0 for k in ('pending_jobs', 'open_attempts', 'retained_slots'))):
                        break
                    require(time.monotonic() < deadline, 'worker_not_drained_no_forced_stop')
                    time.sleep(0.5)
                require(value == before['SQL'], 'SQL_changed_during_drain')
                worker = h.service('nodia-ai-worker')
                require(worker['pid'] == before['consumers']['nodia-ai-worker']['pid'],
                     'worker_changed_during_drain')
                base.codex_barrier(a, Path('/var/lib/nodia/codex'), frozenset({worker['pid']}))
                a.checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
                require(all((a.stopped(u) for u in a.CONSUMERS)), 'claims_not_closed')
                base.codex_barrier(a, Path('/var/lib/nodia/codex'))
                for path, expected, desired, mode in transitions:
                    base.atomic_replace(path, expected, desired, mode, args.phase)
                a.checked(['systemctl', 'daemon-reload'])
                a.RELEASE = target
                h.ACTIVE = target
                require(all((a.state(u)['working_directory'] == str(target) for u in a.CONSUMERS)),
                     'effective_target_changed')
                a.checked(['systemctl', 'start', *a.CONSUMERS], timeout=45)
                a.wait_health()
                after = p.snapshot(a, base, h, proof, target)
                p.invariants(a, base, before, after)
                require(scope.unchanged_scope() == scope_value, 'native_scope_changed')
                require(sorted((x.name for x in Path('/var/lib/nodia-ai-recovery/spool').iterdir())) == ['.backup.lock'],
                     'backup_spool_not_empty')
                a.checked(['systemctl', 'start', *a.TIMERS])
                require(all((a.state(u)['active'] == timers[u] for u in a.TIMERS)), 'timers_not_restored')
                timers_stopped = False
                result = {**common,
                     'status': 'own_rollback_completed' if reverse else 'continuation_completed',
                     'post_consumers': after['consumers'],
                     'after': after,
                     'catalog_before_drain': catalog,
                     'timers_restored': True,
                     'new_publication': not reverse,
                     'proofs_copied_or_restored': False,
                     'journal_bootstrap_or_close': False,
                     'commands': commands.events}
                write(args.phase + '-after.json', result)
                return result
            except Exception as error:
                code = str(error) if isinstance(error,
                     ValueError) and re.fullmatch('[A-Za-z_]{1,120}',
                     str(error)) else 'closed_continuation_failure'
                failure = {**common,
                     'status': args.phase + '_failed',
                     'failure_code': code,
                     'admission_closed': admission_closed,
                     'automatic_replay_allowed': False}
                if admission_closed:
                    try:
                        a.checked(['systemctl', 'stop', *a.TIMERS])
                        a.checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
                        require(a.stopped('nodia-api'), 'API_not_reclosed')
                        state = a.state('nodia-ai-worker')
                        if state['active'] == 'active':
                            p.quiet_sql(h, state['pid'])
                            worker = h.service('nodia-ai-worker')
                            require(worker['pid'] == state['pid'], 'failure_worker_changed')
                            base.codex_barrier(a, Path('/var/lib/nodia/codex'), frozenset({worker['pid']}))
                            a.checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
                        failure['worker_stopped_after_quiet'] = a.stopped('nodia-ai-worker')
                    except Exception:
                        failure['worker_left_draining_no_forced_kill'] = True
                    failure['timers_left_stopped_requires_operator'] = True
                elif timers_stopped:
                    try:
                        a.active_new_processes()
                        a.checked(['systemctl', 'start', *a.TIMERS])
                        failure['timers_restored'] = all((a.state(u)['active'] == 'active' for u in a.TIMERS))
                    except Exception:
                        failure['timers_left_stopped_requires_operator'] = True
                try:
                    failure['observed_consumers'] = {u: a.state(u) for u in a.CONSUMERS}
                except Exception:
                    failure['consumer_observation_failed'] = True
                failure['commands'] = commands.events
                write(args.phase + '-failure.json', failure)
                return failure
    finally:
        commands.close()
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('preflight', 'continue', 'rollback'))
    parser.add_argument('--direction', choices=('continue', 'rollback'), default='continue')
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--execute', action='store_true')
    try:
        value = run(parser.parse_args())
        print(json.dumps(value))
        sys.exit(0 if value.get('status') in ('preflight_passed_no_mutations',
             'continuation_completed',
             'own_rollback_completed') else 1)
    except Exception as error:
        code = str(error) if isinstance(error,
             ValueError) and re.fullmatch('[A-Za-z_]{1,120}',
             str(error)) else 'closed_precondition_failure'
        print(json.dumps({'schema': 'nodia-ai-ai36-c05-publication-postbackup-continuation-v1',
             'status': 'precondition_failed',
             'failure_code': code,
             'automatic_replay_allowed': False,
             'private_details_emitted': False}))
        sys.exit(1)
