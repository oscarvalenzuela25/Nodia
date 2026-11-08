"""Explicit rollback of one successfully adopted FX04 release, never a data restore.

Preflight is read-only. Execution requires a pinned adoption receipt, operator
notes, an unchanged complete SQL projection (except auth_sessions), a fresh
encrypted backup and stopped writers. Any post-adoption business/order change
requires a new reviewed recovery plan; this operator cannot discard it silently.
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

DELIVERY = Path('/opt/nodia/verification/core-fx04-r01/core-fx04-delivery-r01.py')
DELIVERY_SHA = 'bac8b134f16f7b81709516539c0dbd5ebd58ebb6c07535313303c346098e1753'
CLIENT_OLD_SHA = 'c40c15e5e616a7d1d257c1a072141a93e02ba7f1f91ade7187b997e82092a821'
WORK = Path('/opt/nodia/verification/core-fx04-rollback-r01')


def require(ok, code):
    if not ok:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def private(path, pin=None):
    info = path.lstat()
    require(path.resolve() == path and stat.S_ISREG(info.st_mode)
            and info.st_uid == 0 and info.st_nlink == 1
            and stat.S_IMODE(info.st_mode) == 0o600
            and info.st_size <= 4 * 1024 * 1024, 'private_file_identity_changed')
    raw = path.read_bytes()
    require(pin is None or digest(raw) == pin, 'private_file_pin_changed')
    return raw


def load_delivery():
    raw = private(DELIVERY, DELIVERY_SHA)
    value = importlib.util.module_from_spec(
        importlib.util.spec_from_loader('pinned_fx04_delivery_for_rollback', loader=None))
    value.__file__ = str(DELIVERY)
    exec(compile(raw, str(DELIVERY), 'exec'), value.__dict__)
    return value


def write(name, value):
    raw = (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()
    fd = os.open(WORK / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def same_adoption_sql(observed, receipt):
    # Delivery's SQL snapshot explicitly excludes auth_sessions from hashes.
    # Full groups/modules rows still include order: even an order-only change
    # after acceptance rejects this rollback, as does any unrelated table change.
    require(observed == receipt['after']['SQL'], 'post_adoption_data_changed_new_plan_required')


def guarded_materials(d, receipt, plan):
    require(receipt['phase'] == 'adopt' and receipt['status'] == 'adopted_verified'
            and receipt['migration_committed'] is True
            and receipt['descriptors_changed'] is True
            and receipt['timers_restored'] is True, 'successful_adoption_required')
    before = receipt['before']['SQL']
    after = receipt['after']['SQL']
    require(len(before['migrations']) == 29 and len(after['migrations']) == 30
            and after['migrations'][:-1] == before['migrations']
            and after['migrations'][-1]['name'] == d.MIGRATION
            and after['migrations'][-1]['timestamp'] == '1793200000000'
            and not before['sort_columns'] and len(after['sort_columns']) == 2,
            'adoption_schema_history_invalid')
    old, new = Path(plan['server_old']), Path(plan['server_new'])
    d.verify_release(old, plan['server_old_manifest_sha256'])
    d.verify_release(new, plan['server_new_manifest_sha256'])
    d.verify_release(Path(plan['client_old']), CLIENT_OLD_SHA)
    d.verify_release(Path(plan['client_new']), plan['client_new_manifest_sha256'])
    transitions = d.helpers()[0].descriptor_bytes(new, old)
    require(len(transitions) == 3, 'descriptor_count_changed')
    for index, (_, _, desired, _) in enumerate(transitions):
        require(desired == private(d.WORK / f'descriptor-{index}.private'),
                'original_descriptor_does_not_match_rollback')
    site_new = d.SITE.read_bytes()
    require(digest(site_new) == receipt['site_new_sha256']
            and site_new.count(plan['client_new'].encode()) == 1, 'site_target_changed')
    site_old = site_new.replace(plan['client_new'].encode(), plan['client_old'].encode())
    require(site_old == private(d.WORK / 'site-before.private')
            and digest(site_old) == plan['site_old_sha256'], 'site_original_changed')
    return old, new, transitions, site_new, site_old


def main(args):
    require(sys.platform == 'linux' and os.getuid() == 0, 'root_linux_required')
    require(re.fullmatch('[a-f0-9]{64}', args.operator_sha256)
            and digest(Path(__file__).read_bytes()) == args.operator_sha256,
            'rollback_operator_changed')
    require(re.fullmatch('[a-f0-9]{64}', args.adopt_receipt_sha256)
            and bool(args.notes.strip()) and len(args.notes) <= 2000,
            'pinned_receipt_and_operator_notes_required')
    d = load_delivery()
    raw = private(d.WORK / 'plan.json', d.PLAN_SHA)
    plan = json.loads(raw)
    receipt_raw = private(d.WORK / 'adopt-receipt.json', args.adopt_receipt_sha256)
    receipt = json.loads(receipt_raw)
    old, new, transitions, site_new, site_old = guarded_materials(d, receipt, plan)
    b, a, h = d.helpers()
    a.RELEASE = new
    before, env = d.snapshot(new, b, a, h)
    same_adoption_sql(before['SQL'], receipt)
    require(before['configuration_sha256'] == receipt['after']['configuration_sha256']
            and before['Gemini'] == receipt['after']['Gemini'],
            'protected_runtime_changed_new_plan_required')
    require(all(d.state(n)['ActiveState'] == 'active' for n in d.TIMERS),
            'backup_timers_not_active')
    result = {'phase': args.phase, 'status': 'rollback_preflight_passed',
              'adopt_receipt_sha256': args.adopt_receipt_sha256,
              'delivery_operator_sha256': DELIVERY_SHA,
              'before': before, 'notes': args.notes.strip(), 'data_restore': False,
              'configured_order_will_be_discarded': True, 'provider_generations': 0}
    if args.phase == 'preflight':
        return result
    require(args.execute and not WORK.exists(), 'fresh_rollback_execute_required')
    WORK.mkdir(mode=0o700)
    write('rollback-intent.json', result)
    result.update(status='rollback_failed', migration_reverted=False,
                  descriptors_restored=False, admission_closed=False)
    writers_stopped = False
    try:
        d.command(['systemctl', 'stop', *d.TIMERS])
        b.oneshots_idle(a)
        began = datetime.now(timezone.utc)
        backup = json.loads(d.command([
            'sudo', '-u', 'nodia', '/usr/local/bin/node',
            str(new / 'scripts/nodia-ai-backups.mjs'), 'backup',
            '/etc/nodia-ai-recovery/backup.json'], timeout=240, cwd=new))
        b.validate_backup(backup, began, datetime.now(timezone.utc))
        write('fresh-backup.json', backup)
        result['backup'] = backup
        fresh, _ = d.snapshot(new, b, a, h)
        same_adoption_sql(fresh['SQL'], receipt)
        writers_stopped = True
        d.command(['systemctl', 'stop', 'nodia-api'], timeout=60)
        result['admission_closed'] = True
        require(d.state('nodia-api')['ActiveState'] == 'inactive', 'api_not_stopped')
        worker_pid = int(fresh['services']['nodia-ai-worker']['MainPID'])
        require(h.chat_projection(worker_pid) == fresh['quiet'], 'worker_not_drained')
        b.codex_barrier(a, Path('/var/lib/nodia/codex'), frozenset({worker_pid}))
        d.command(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
        require(all(d.state(n)['ActiveState'] == 'inactive' for n in d.SERVICES),
                'writers_not_stopped')
        b.codex_barrier(a, Path('/var/lib/nodia/codex'))
        same_adoption_sql(d.node(d.SQL_PREFIX + d.SQL_SNAPSHOT, new, env), receipt)
        # Down is one pinned class under a transaction, only when history is
        # exactly 30 and that class is its final member. It never runs a CLI
        # that could revert another migration and never restores SQL data.
        result['migration'] = d.migrate(new, env, reverse=True)
        result['migration_reverted'] = True
        write('migration-down-receipt.json', result['migration'])
        sql = d.node(d.SQL_PREFIX + d.SQL_SNAPSHOT, old, env)
        require(sql == receipt['before']['SQL'], 'sql_original_projection_not_restored')
        for path, expected, desired, mode in transitions:
            b.atomic_replace(path, expected, desired, mode, 'core-fx04-rollback')
        result['descriptors_restored'] = True
        b.atomic_replace(d.SITE, site_new, site_old, 0o644, 'core-fx04-rollback')
        d.command(['nginx', '-t'])
        result['cache'] = d.invalidate(old, env)
        d.command(['systemctl', 'daemon-reload'])
        require(all(d.state(n)['WorkingDirectory'] == str(old) for n in d.SERVICES),
                'effective_original_target_wrong')
        d.command(['systemctl', 'start', *d.SERVICES], timeout=45)
        d.health()
        d.command(['systemctl', 'reload', 'nginx'])
        after, _ = d.snapshot(old, b, a, h)
        require(after['SQL'] == receipt['before']['SQL'], 'rollback_sql_postcondition_failed')
        require(after['Gemini'] == before['Gemini']
                and after['configuration_sha256'] == before['configuration_sha256']
                and after['quiet'] == before['quiet'], 'protected_runtime_changed')
        d.command(['systemctl', 'start', *d.TIMERS])
        require(all(d.state(n)['ActiveState'] == 'active' for n in d.TIMERS),
                'timers_not_restored')
        result.update(status='rolled_back_verified', after=after,
                      admission_closed=False, timers_restored=True)
        return result
    except Exception as error:
        result['code'] = str(error) if isinstance(error, ValueError) else 'private_dependency_failure'
        if writers_stopped:
            # A failure can occur after down, during partial descriptor CAS or
            # after starts. Keep both writers closed; never reopen either
            # schema/code combination or automatically replay rollback.
            try:
                d.command(['systemctl', 'stop', 'nodia-api'], timeout=60)
            except Exception:
                result.setdefault('stop_failures', []).append('nodia-api')
            worker = d.state('nodia-ai-worker')
            if worker['ActiveState'] == 'active':
                try:
                    worker_pid = int(worker['MainPID'])
                    quiet = h.chat_projection(worker_pid)
                    require(all(quiet[k] == 0 for k in
                                ('pending_jobs', 'open_attempts', 'retained_slots')),
                            'worker_still_draining')
                    b.codex_barrier(a, Path('/var/lib/nodia/codex'), frozenset({worker_pid}))
                    d.command(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
                except Exception:
                    result['worker_left_draining'] = True
            result['services_observed'] = {n: d.state(n) for n in d.SERVICES}
            result['admission_closed'] = all(
                value['ActiveState'] == 'inactive'
                for value in result['services_observed'].values())
        else:
            d.command(['systemctl', 'start', *d.TIMERS])
            result['timers_restored'] = True
        raise
    finally:
        write('rollback-receipt.json', result)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=('preflight', 'rollback'), required=True)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--adopt-receipt-sha256', required=True)
    parser.add_argument('--notes', required=True)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    try:
        import fcntl
        # Serialize against delivery as well as other rollback invocations.
        lock_path = DELIVERY.parent / 'phase.lock'
        with os.fdopen(os.open(lock_path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600), 'r+b') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            print(json.dumps(main(args)))
    except Exception as error:
        print(json.dumps({'status': 'failed', 'phase': args.phase,
                          'code': str(error) if isinstance(error, ValueError)
                          else 'private_dependency_failure', 'automatic_retry': False}))
        sys.exit(1)
