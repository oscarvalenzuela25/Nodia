#!/usr/bin/env python3
"""Reviewed Teacher-only maintenance window. Default inert; no automatic recovery."""
from contextlib import ExitStack
import argparse
import hashlib
import os
from pathlib import Path
import re
import signal
import sys
import time

sys.dont_write_bytecode = True
LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
CURRENT = Path('/opt/nodia/current')
REGISTRY = Path('/etc/nodia/ai-runtime/consumers.json')
ENVIRONMENT = Path('/etc/nodia/teacher-runtime.env')
MAINTENANCE = Path('/var/lib/nodia-maintenance/backend')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
IO_SHA256 = 'bdb432360273384c61c4d308bdd17fd689bc16be5dc8dd4ed57988c7755dc632'
PINS = {'update-backend.py', 'backend_update.py', 'deploy-backend-receiver.py', 'update-backend-action.mjs',
        'ai-runtime/prepare-teacher-runtime.py', 'ai-runtime/register-consumers.py', 'ai-runtime/activate-ai-runtime.py',
        'ai-runtime/codex-provision.py', 'ai-runtime/runtime-preflight.mjs'}
COUNTERS = {'jobs', 'runs', 'executions', 'steps', 'slots', 'api_dispatches', 'teacher_jobs', 'teacher_attempts', 'generation_operations'}
RECOVERY_BINDINGS = {'backup_id', 'cipher_sha256', 'package_sha256', 'node_sha256',
                     'source_fingerprint_file_sha256', 'source_fingerprint_sha256', 'fingerprint_helper_sha256'}


def require(value, code):
    if not value:
        raise ValueError(code)


def io_policy():
    path = Path(__file__).resolve().with_name('upgrade-teacher-operators.py')
    require(path.resolve(strict=True) == path and path.stat().st_size < 128*1024, 'reviewed_io_source_required')
    raw = path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == IO_SHA256, 'reviewed_io_digest_required')
    scope = {'__name__': 'teacher_window_reviewed_io', '__file__': str(path)}
    exec(compile(raw, str(path), 'exec'), scope)
    from types import SimpleNamespace
    return SimpleNamespace(**scope)


def validate_plan(io, value):
    require(type(value) is dict and set(value) == {'schema', 'window_id', 'current_release', 'current_manifest_sha256',
            'settings_sha256', 'receiver_settings_sha256', 'registry_before_sha256', 'prepared_receipt_sha256',
            'binary_sha512', 'staged_environment_sha256', 'restore_receipt_sha256', 'recovery', 'operator_pins'}, 'window_plan_shape_invalid')
    require(value['schema'] == 'teacher-runtime-window/1' and type(value['window_id']) is str and
            type(value['current_release']) is str and re.fullmatch('[a-f0-9]{32}', value['window_id'])
            and re.fullmatch('backend-[a-f0-9]{12}-[a-f0-9]{12}', value['current_release']), 'window_identity_invalid')
    for key in ('current_manifest_sha256', 'settings_sha256', 'receiver_settings_sha256', 'registry_before_sha256',
                'prepared_receipt_sha256', 'staged_environment_sha256', 'restore_receipt_sha256'):
        require(type(value[key]) is str and io.HEX.fullmatch(value[key]), 'window_digest_invalid')
    require(type(value['binary_sha512']) is str and re.fullmatch('[a-f0-9]{128}', value['binary_sha512']), 'window_binary_digest_invalid')
    io.digest_map(value['operator_pins'], PINS)
    recovery = value['recovery']
    require(type(recovery) is dict and set(recovery) == RECOVERY_BINDINGS and
            type(recovery['backup_id']) is str and
            re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',recovery['backup_id']),
            'window_backup_binding_invalid')
    require(all(type(recovery[k]) is str and io.HEX.fullmatch(recovery[k]) for k in RECOVERY_BINDINGS-{'backup_id'}), 'window_recovery_digest_invalid')
    return value


def validate_restore(io, receipt, plan, manifest):
    require(type(receipt) is dict and type(receipt.get('schema_version')) is int and receipt['schema_version'] == 1 and receipt.get('status') == 'verified'
            and receipt.get('phase') == 'complete', 'verified_restore_receipt_required')
    require(all(receipt.get(key) == expected for key, expected in plan['recovery'].items()), 'restore_artifact_binding_changed')
    decrypted=receipt.get('decryption',{})
    require(decrypted.get('status')=='decrypted' and decrypted.get('gcm_verified') is True and
            decrypted.get('backup_id')==plan['recovery']['backup_id'], 'authenticated_backup_decryption_required')
    require(receipt.get('release_id') == plan['current_release'] and
            receipt.get('release_manifest_sha256') == plan['current_manifest_sha256'] and
            receipt.get('source_sha') == manifest['source_sha'] and
            receipt.get('package_tree_sha256') == manifest['package_tree_sha256'], 'restore_release_binding_changed')
    before = receipt.get('before_prepare', {})
    require(before.get('status') == 'verified' and before.get('source_content_verified_before_prepare') is True and
            before.get('fingerprint_sha256') == plan['recovery']['source_fingerprint_sha256'], 'restore_source_equality_unverified')
    migrations = sum(1 for item in manifest.get('files', []) if item.get('type') == 'file' and
                     re.fullmatch(r'dist/migrations/[0-9]{13}-[A-Za-z][A-Za-z0-9_]*\.js', item.get('path', '')))
    require(migrations > 0 and type(before.get('migrations_verified')) is int and
            before['migrations_verified'] == migrations, 'restore_migrations_unverified')
    require(receipt.get('cleanup', {}).get('plaintext_quarantine_volume_removed') is True and
            receipt.get('cleanup', {}).get('errors') == [], 'restore_cleanup_unverified')
    require(receipt.get('restore_scope') == 'database_equality_only_before_prepare' and
            receipt.get('release_authorized') is False and receipt.get('runtime_recovery_authorized') is False and
            receipt.get('journal_reconciled') is False, 'restore_scope_must_remain_database_only')


def checked_preflight(activation):
    value = activation.preflight()
    require(value.get('read_only') is True and value.get('client_tls_authorized') is True and
            value.get('quiescent') is True and type(value.get('counts')) is dict and set(value['counts']) == COUNTERS and
            all(type(n) is int and n == 0 for n in value['counts'].values()), 'nine_readonly_counters_unverified')
    return value


def drain(host):
    deadline = time.monotonic() + 120
    while True:
        # Unlike runtime-preflight's exit2, inspect returns a verified nonquiet result.
        value = host.node_action('inspect')
        counts = value.get('counts')
        require(value.get('read_only') is True and value.get('client_tls_authorized') is True and
                type(counts) is dict and set(counts) == COUNTERS and
                all(type(n) is int and n >= 0 for n in counts.values()) and
                value.get('quiescent') is all(n == 0 for n in counts.values()), 'drain_counters_unverified')
        if value['quiescent']:
            return value
        require(time.monotonic() < deadline, 'runtime_drain_timed_out')
        time.sleep(1)


def activate_window(plan_file, plan_sha256, restore_file):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_root_required')
    io = io_policy()
    plan_raw = io.read_source(Path(plan_file).absolute(), bound=32768)
    require(io.HEX.fullmatch(plan_sha256 or '') and io.sha(plan_raw) == plan_sha256, 'reviewed_window_plan_digest_required')
    plan = validate_plan(io, io.unique_json(plan_raw))
    restore_raw = io.read_source(Path(restore_file).absolute(), bound=128*1024)
    require(io.sha(restore_raw) == plan['restore_receipt_sha256'], 'reviewed_restore_digest_required')
    restore = io.unique_json(restore_raw)
    record = STATE / ('teacher-runtime-window-' + plan['window_id'])
    import fcntl
    with ExitStack() as stack:
        for path in (STATE/'receiver.lock', INSTALL_LOCK):
            require(io.protected(path, 0o600).st_size == 0, 'empty_window_lock_required')
            handle = stack.enter_context(path.open('r+b'))
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(not record.exists() and not record.is_symlink(), 'window_already_reserved_no_replay')
        require(CURRENT.is_symlink() and CURRENT.resolve(strict=True).name == plan['current_release'], 'window_current_changed')
        current = CURRENT.resolve(strict=True)
        manifest_raw = io.read_source(current/'release-manifest.json', installed=True, bound=32*1024*1024)
        require(io.sha(manifest_raw) == plan['current_manifest_sha256'], 'window_current_manifest_changed')
        manifest = io.unique_json(manifest_raw)
        validate_restore(io, restore, plan, manifest)
        settings_raw = io.read_source(STATE/'settings.json', installed=True, mode=0o600, bound=16384)
        receiver_raw = io.read_source(STATE/'receiver-settings.json', installed=True, mode=0o600, bound=16384)
        registry_raw = io.read_source(REGISTRY, installed=True, mode=0o600, bound=16384)
        require(io.sha(settings_raw) == plan['settings_sha256'] and io.sha(receiver_raw) == plan['receiver_settings_sha256'] and
                io.sha(registry_raw) == plan['registry_before_sha256'], 'window_previous_metadata_changed')
        settings = io.unique_json(settings_raw)
        pins = {**io.digest_map(settings['assets'], io.ASSETS), **io.digest_map(io.unique_json(receiver_raw)['assets'],
                {'deploy-backend-receiver.py', 'deploy-gateway.py'})}
        code = {}
        for mapping in (pins, plan['operator_pins']):
            for name, pin in mapping.items():
                raw = io.read_source(LIB/name, installed=True, mode=0o755 if name == 'deploy-gateway.py' else 0o644)
                require(io.sha(raw) == pin, 'window_operator_pin_changed')
                code[name] = raw
        loaded = lambda name: io.load_bytes(code[name], LIB/name, 'teacher_window_'+name.replace('/', '_').replace('.', '_'))
        updater, policy, receiver = [loaded(name) for name in ['update-backend.py','backend_update.py','deploy-backend-receiver.py']]
        prepare, activation, safe = [loaded('ai-runtime/'+name) for name in ['prepare-teacher-runtime.py','activate-ai-runtime.py','codex-provision.py']]
        before = io.ready(receiver)
        require(before.get('current', {}).get('release_id') == current.name, 'receiver_current_changed')
        io.digest_map(settings['service_hashes'], io.BASE_UNITS)
        runtime_before = io.snapshot(receiver, settings)
        prepared_raw = safe.read_regular(prepare.RECEIPT, 0o644)
        require(io.sha(prepared_raw) == plan['prepared_receipt_sha256'] and
                io.unique_json(prepared_raw).get('binary_sha512') == plan['binary_sha512'], 'prepared_receipt_changed')
        staged_env = safe.read_regular(prepare.STAGED/'teacher-runtime.env', 0o644)
        require(io.sha(staged_env) == plan['staged_environment_sha256'] and
                staged_env == prepare.environment_bytes(plan['binary_sha512']), 'staged_environment_changed')
        binary = prepare.HOSTS/('host-'+plan['binary_sha512'])
        require(safe.checked(binary, mode=0o755) and prepare.digest(binary, 'sha512') == plan['binary_sha512'], 'prepared_binary_changed')
        absent = [ENVIRONMENT, *[updater.SYSTEMD_UNITS/(unit+'.d')/updater.TEACHER_RUNTIME_NAME for unit in updater.SERVICES]]
        require(all(not p.exists() and not p.is_symlink() for p in absent) and 'teacher_host' not in io.unique_json(registry_raw),
                'initial_teacher_window_required')
        require(not MAINTENANCE.exists() and not MAINTENANCE.is_symlink(), 'maintenance_already_owned')
        io.protected(MAINTENANCE.parent, directory=True)
        host = updater.Host(policy, None, settings)
        host.current = current
        host.candidate = current
        for unit in settings['service_hashes']:
            host.service_overrides(unit, host.show(unit))
        host.groups = host.verify_writers(current)
        host.http('https://166.0.112.187/api/v1', 200)
        record.mkdir(mode=0o700); io.sync_directory(STATE)
        host.attempt = record
        phase = 'reserved'
        try:
            for name, raw in [('plan.json', plan_raw), ('restore-receipt.json', restore_raw), ('registry-before.json', registry_raw),
                              ('settings-before.json', settings_raw), ('receiver-settings-before.json', receiver_raw)]:
                io.exclusive(record/name, raw)
            io.exclusive(record/'before.json', (io.json.dumps({'runtime': runtime_before, 'absent_paths': list(map(str,absent)),
                         'current':str(current)}, sort_keys=True)+'\n').encode())
            io.exclusive(record/'intent.json', (io.json.dumps({'plan_sha256':plan_sha256,'automatic_retry_allowed':False})+'\n').encode())
            io.exclusive(MAINTENANCE, (plan['window_id']+'\n').encode(), 0o644)
            phase = 'maintenance_owned'; host.http('https://166.0.112.187/api/v1', 503)
            timers = host.pause_timers()
            phase = 'timers_paused'
            pre = drain(host)
            phase = 'stop_requested'; host.stop_writers()
            post = checked_preflight(activation)
            require(all(host.cgroup_empty(group) for group in host.groups.values()), 'writer_cgroup_not_empty')
            require(CURRENT.resolve(strict=True) == current and
                    io.sha(io.read_source(current/'release-manifest.json',installed=True,bound=32*1024*1024)) == plan['current_manifest_sha256'],
                    'current_changed_before_activation')
            phase = 'activate_requested'
            activated = prepare.activate(safe, updater, activation)
            require(activated.get('status') == 'teacher_runtime_activated_consumers_still_stopped' and
                    activated.get('binary_sha512') == plan['binary_sha512'], 'full_teacher_activation_unverified')
            expected_registry = io.unique_json(registry_raw)
            expected_registry['teacher_host'] = {'environment_sha256': plan['staged_environment_sha256'], 'binary_sha512':plan['binary_sha512']}
            for unit in updater.SERVICES:
                expected_registry['units'][unit][updater.TEACHER_RUNTIME_NAME] = io.sha(updater.TEACHER_RUNTIME_TEMPLATE)
            after_registry = io.read_source(REGISTRY, installed=True, mode=0o600, bound=16384)
            require(io.unique_json(after_registry) == expected_registry and updater.teacher_runtime_descriptor() == expected_registry['teacher_host'],
                    'activated_descriptor_or_registry_changed')
            require(io.read_source(STATE/'settings.json', installed=True,mode=0o600,bound=16384) == settings_raw and
                    io.read_source(STATE/'receiver-settings.json',installed=True,mode=0o600,bound=16384) == receiver_raw,
                    'settings_changed_during_window')
            io.exclusive(record/'activation.json', (io.json.dumps(activated,sort_keys=True)+'\n').encode())
            # The registry transition is deliberate and exact. A new Host starts a new snapshot phase.
            restarted = updater.Host(policy, None, settings); restarted.attempt=record; restarted.current=current
            phase = 'start_requested'; restarted.command(['/usr/bin/systemctl','start',*updater.SERVICES],220)
            activation.http_smoke(); restarted.verify_writers(current)
            require(CURRENT.resolve(strict=True) == current and
                    io.sha(io.read_source(current/'release-manifest.json',installed=True,bound=32*1024*1024)) == plan['current_manifest_sha256'],
                    'current_changed_after_activation')
            require(io.read_source(MAINTENANCE,installed=True).decode().strip() == plan['window_id'], 'maintenance_owner_changed')
            MAINTENANCE.unlink(); io.sync_directory(MAINTENANCE.parent)
            phase='maintenance_released'; restarted.public_smoke(); restarted.restore_timers(timers)
            runtime_after=io.snapshot(receiver,settings)
            require(runtime_after['base_units_sha256']==runtime_before['base_units_sha256'], 'base_units_changed_during_window')
            for unit in set(io.RUNTIME_UNITS)-set(updater.SERVICES):
                keys = ('ActiveState','UnitFileState') if unit.endswith('.timer') else tuple(runtime_before['units'][unit])
                require(all(runtime_after['units'][unit].get(k)==runtime_before['units'][unit].get(k) for k in keys), 'unrelated_runtime_or_timers_changed')
            require(io.ready(receiver)['current']==before['current'], 'final_receiver_current_changed')
            result={'schema':'teacher-runtime-window-receipt/1','status':'teacher_runtime_window_complete',
                    'window_id':plan['window_id'],'plan_sha256':plan_sha256,'current':before['current'],
                    'binary_sha512':plan['binary_sha512'],'registry_after_sha256':io.sha(after_registry),
                    'restore_receipt_sha256':plan['restore_receipt_sha256'],'restore_scope':'database_equality_only_before_prepare',
                    'pre_stop':pre,'post_stop':post,'timer_states_restored':True,'keyrings_and_current_preserved':True,
                    'SQL_writes':0,'provider_calls':0,'real_selection_eligibility_not_asserted':True,'automatic_retry_allowed':False}
            io.exclusive(record/'receipt.json',(io.json.dumps(result,sort_keys=True)+'\n').encode())
            return result
        except BaseException as error:
            code=str(error) if isinstance(error,ValueError) and re.fullmatch('[a-z_]{1,100}',str(error)) else 'teacher_window_private_reconciliation_required'
            io.exclusive(record/'failure.json',(io.json.dumps({'phase':phase,'error_code':code,'preserve_state':True,
                         'automatic_restart':False,'automatic_retry_allowed':False})+'\n').encode())
            raise


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute',action='store_true');parser.add_argument('--plan',type=Path)
    parser.add_argument('--plan-sha256');parser.add_argument('--restore-receipt',type=Path)
    args=parser.parse_args()
    if not args.execute:
        print('{"inert":true,"production_writes":0,"provider_calls":0}');return
    def interrupted(_signal,_frame):raise ValueError('teacher_window_interrupted')
    for number in (signal.SIGINT,signal.SIGTERM):signal.signal(number,interrupted)
    require(args.plan and args.plan_sha256 and args.restore_receipt,'reviewed_window_inputs_required')
    import json
    print(json.dumps(activate_window(args.plan,args.plan_sha256,args.restore_receipt)))


if __name__=='__main__':
    try:main()
    except BaseException as error:
        code=str(error) if isinstance(error,ValueError) and re.fullmatch('[a-z_]{1,100}',str(error)) else 'teacher_window_private_reconciliation_required'
        print('{"status":"failed","error_code":"'+code+'","automatic_restart":false,"automatic_retry_allowed":false,"provider_calls":0}')
        raise SystemExit(1) from None
