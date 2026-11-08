"""One-shot R07 API/worker stop and restart for externally approved navigation seed.

Backup/restore are external pinned witnesses. Only these two systemd units may
change. No SQL writes, SDK, login, release adoption or automatic recovery.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shlex
import stat
import subprocess
import sys
import time

STAGE = Path('/opt/nodia/verification/ai40-reservations-maintenance-r01')
WORK = STAGE / 'work'
ROOT = Path('/opt/nodia/releases/nodia-server-ai40-r07')
CONFIG = Path('/opt/nodia/releases/nodia-server-ai15-20261016/.env')
CONFIG_SHA = '63bc843ea102795ffee40cf5d3a7bbe42bb71ea40795b30897c10872ca129105'
BACKUP_SHA = 'a27d4f272dc3d8dfb348fb4ddfe90117615c9b535ff6fc960a1d572f40dccc66'
RESTORE_SHA = '8ffd3eb9df82c1a7f8e66ca99f172941f9581dbae203bcaebf9822d52d3b71af'
GUARD = Path('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py')
GUARD_SHA = '753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58'
IMAGES = Path('/opt/nodia/verification/ai40-r06-image-operator-r01/nodia-ai-ai40-r06-image-operator-r01.py')
IMAGES_SHA = 'b048369c1abe3b31df801bf1e94b70462dfca4196f14d276387da737cdb38355'
UNITS = ('nodia-api', 'nodia-ai-worker')
ORIGINAL_PIDS = {'nodia-api': 3317860, 'nodia-ai-worker': 3317861}
PROOF_SHAS = {
    'mcp': '970510a8b38137e3168c74c8322bd33b90994659523977d492339cba6501cf0a',
    'mcp-image-png': '6f72f27340f46a397954b6a6e2b024fd117a617cfbe7cddd64ab429c6f030cc7',
    'mcp-image-jpeg': '7f196301cd8cc616f090d478622e59f4a0eb60d86b5400f2bb1e4e4decaefff5',
    'mcp-image-webp': 'b33981d06c07e487c841a088c938446fb8920b00a646509e401fbe8beb08a35c',
}
DATABASE_NAMES = {'DOTENV_CONFIG_PATH', 'TZ', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL'}

# Counts only; no provider/runtime imports. Connection and every transaction are
# read only, including while API is stopped. Credentials never leave memory.
SQL_SOURCE = r"""
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(process.cwd()+'/package.json');
const env={...require('dotenv').parse(await readFile(process.env.DOTENV_CONFIG_PATH)),...process.env};
const {DataSource}=require('typeorm');
const db=new DataSource({type:'postgres',host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),database:env.POSTGRES_DB,
 username:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,ssl:env.POSTGRES_SSL==='true'?{rejectUnauthorized:false}:undefined,
 synchronize:false,migrationsRun:false,installExtensions:false,logging:false,
 extra:{max:1,connectionTimeoutMillis:3000,statement_timeout:3000,options:'-c default_transaction_read_only=on'}});
try{await db.initialize();const result=await db.transaction(async m=>{await m.query('SET TRANSACTION READ ONLY');
const [counts]=await m.query(`SELECT
 (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,
 (SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,
 (SELECT COALESCE(sum(provider_dispatches_used),0)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,
 (SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments,
 (SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,
 (SELECT count(*)::int FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1 AND s.minimal_receipt IS NOT NULL) effect_receipts,
 (SELECT count(*)::int FROM finance_movements WHERE name=$2) financial_effects,
 (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting') OR kind='reconcile' AND state<>'done') pending_jobs,
 (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
 (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots`,
 ['ec626b72-1f32-4486-9f3a-8263cffce267','AI40-UI-CODEX-R01']);return counts;});
assert.ok(Object.values(result).every(n=>Number.isSafeInteger(n)&&n>=0));console.log(JSON.stringify(result));
}finally{if(db.isInitialized)await db.destroy();}
"""


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def private(path, mode=0o600):
    info = path.lstat()
    require(path.resolve() == path and stat.S_ISREG(info.st_mode) and info.st_uid == 0
            and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == mode, 'private_operator_identity_invalid')


def load(path, pin, name, mode=0o600):
    private(path, mode); require(sha(path) == pin, 'pinned_guard_changed')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def command(args, timeout=15, **kwargs):
    result = subprocess.run(args, capture_output=True, timeout=timeout, check=False, **kwargs)
    require(result.returncode == 0, 'maintenance_command_failed')
    return result


def unit(name, validate=False):
    result = command(['systemctl', 'show', name, '--property=MainPID,ActiveState,SubState,WorkingDirectory,User,Environment,EnvironmentFiles'])
    values = dict(line.split('=', 1) for line in result.stdout.decode().splitlines() if '=' in line)
    if validate:
        require(values.get('WorkingDirectory') == str(ROOT) and values.get('User') == 'nodia', 'writer_unit_identity_changed')
        require(not values.get('EnvironmentFiles'), 'additional_environment_source_requires_review')
        environment = dict(item.split('=', 1) for item in shlex.split(values.get('Environment', '')) if '=' in item)
        require(environment.get('DOTENV_CONFIG_PATH') == str(CONFIG) and not any(key.startswith('POSTGRES_') for key in environment), 'writer_database_environment_changed')
    return {key: values[key] for key in ('MainPID', 'ActiveState', 'SubState', 'WorkingDirectory', 'User')}


def writers(active):
    values = {name: unit(name, True) for name in UNITS}
    for name, value in values.items():
        require(value['ActiveState'] == ('active' if active else 'inactive')
                and (int(value['MainPID']) > 0 if active else value['MainPID'] == '0'), 'writer_state_unexpected')
        if active:
            require(Path('/proc/' + value['MainPID'] + '/cwd').resolve() == ROOT, 'writer_process_release_changed')
    return values


def configuration():
    info = CONFIG.lstat()
    require(CONFIG.resolve() == CONFIG and stat.S_ISREG(info.st_mode) and info.st_nlink == 1
            and info.st_uid in (0, 10000) and stat.S_IMODE(info.st_mode) == 0o600 and sha(CONFIG) == CONFIG_SHA, 'configuration_changed')


def protected():
    units = {name: unit(name) for name in ('nodia-keyring', 'nodia-gemini-lab', 'nginx')}
    require(all(value['ActiveState'] == 'active' for value in units.values()), 'protected_service_not_active')
    docker = command(['docker', 'inspect', '--format', '{{json .Id}} {{json .Image}} {{json .State.StartedAt}} {{json .State.Running}}',
                      'c4814c5a184b55cd95c751ed904d0c957c0311148f8732169928ce6c3b2d5bd3'])
    return {'units': units, 'gemini_container_state_sha256': hashlib.sha256(docker.stdout).hexdigest()}


def read_environment(helper, pid=None):
    selected = helper.selected_environment(pid, DATABASE_NAMES) if pid else {'DOTENV_CONFIG_PATH': str(CONFIG)}
    require(selected.get('DOTENV_CONFIG_PATH') == str(CONFIG) and selected.get('TZ') in (None, 'UTC', 'Etc/UTC'), 'private_database_environment_changed')
    return {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'DOTENV_CONFIG_QUIET': 'true', **selected}


def sql(env, timeout=12):
    result = command(['/usr/local/bin/node', '--input-type=module', '-e', SQL_SOURCE], timeout=timeout, cwd=ROOT, env=env)
    require(len(result.stdout) < 4096, 'sql_projection_exceeded')
    value = json.loads(result.stdout)
    require(type(value) is dict and len(value) == 10 and all(type(n) is int and n >= 0 for n in value.values()), 'sql_projection_invalid')
    return value


def quiet(value):
    return all(value[name] == 0 for name in ('pending_jobs', 'open_attempts', 'retained_slots'))


def public_configuration(helper, env):
    source = (helper.CANDIDATE.parent / 'public-canary-input.mjs').read_text()
    result = command(['/usr/local/bin/node', '--input-type=module', '-e', source], timeout=25, cwd=ROOT, env={**env, 'AI40_CONNECTION_ID': '1'})
    require(len(result.stdout) < 1048576, 'public_configuration_projection_exceeded')
    value = json.loads(result.stdout); selection = value['selection']
    require(type(selection) is dict and set(selection) == {'connection_id', 'mode', 'model_id', 'effort_id'}
            and selection['connection_id'] == '1' and selection['mode'] == 'token_plan_agentic'
            and type(selection['model_id']) is str and selection['model_id'].strip(), 'public_selection_changed')
    return {'sha256': hashlib.sha256(result.stdout).hexdigest(), 'selection': selection}


def proofs(images, helper, selection, fingerprint):
    value = images.proof_snapshot(helper, selection, fingerprint)
    require(set(value) == set(PROOF_SHAS) and all(value[key].get('present') is True and value[key].get('sha256') == pin for key, pin in PROOF_SHAS.items()), 'current_acceptance_proofs_changed')
    return value


def encode(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def exclusive(path, value):
    require(path.parent == WORK, 'receipt_path_invalid')
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(encode(value)); stream.flush(); os.fsync(stream.fileno())
    descriptor = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
    sys.dont_write_bytecode = True
    private(Path(__file__).resolve()); require(sha(Path(__file__).resolve()) == args.operator_sha256, 'operator_source_changed')
    guard = load(GUARD, GUARD_SHA, 'maintenance_r07_guard')
    images = load(IMAGES, IMAGES_SHA, 'maintenance_proof_guard')
    helper = load(guard.HELPER, guard.HELPER_SHA, 'maintenance_public_guard', 0o644)
    helper.ACTIVE = ROOT; helper.validate_candidate(guard.LEGACY_MANIFEST_SHA)
    release = guard.validate_release(); configuration()
    info = WORK.lstat()
    require(WORK.resolve() == WORK and stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700, 'private_work_required')
    raw = sys.stdin.buffer.read(4097); require(0 < len(raw) <= 4096, 'descriptor_size_invalid')
    descriptor = json.loads(raw)
    keys = {'schema_version', 'backup_receipt_sha256', 'restore_receipt_sha256'} | ({'stop_receipt_sha256'} if args.phase == 'start' else set())
    require(type(descriptor) is dict and set(descriptor) == keys and type(descriptor['schema_version']) is int
            and descriptor['schema_version'] == 1 and descriptor['backup_receipt_sha256'] == BACKUP_SHA
            and descriptor['restore_receipt_sha256'] == RESTORE_SHA, 'external_backup_restore_witness_invalid')
    require(not (WORK / (args.phase + '-intent.json')).exists() and not (WORK / (args.phase + '-receipt.json')).exists(), 'maintenance_phase_already_consumed')
    before_units = writers(args.phase == 'stop')
    if args.phase == 'stop':
        require(all(int(before_units[name]['MainPID']) == pid for name, pid in ORIGINAL_PIDS.items()), 'original_writer_process_changed')
    else:
        path = WORK / 'stop-receipt.json'; private(path)
        require(re.fullmatch('[a-f0-9]{64}', descriptor['stop_receipt_sha256']) and sha(path) == descriptor['stop_receipt_sha256'], 'stop_receipt_pin_invalid')
        stopped = json.loads(path.read_bytes())
        require(stopped['status'] == 'stopped_verified' and stopped['operator_sha256'] == args.operator_sha256, 'verified_stop_required')
    env = read_environment(helper, int(before_units['nodia-api']['MainPID']) if args.phase == 'stop' else None)
    public = public_configuration(helper, env); accepted = proofs(images, helper, public['selection'], guard.EXPECTED_RUNTIME_FINGERPRINT)
    other = protected(); before_sql = sql(env); require(quiet(before_sql), 'premaintenance_sql_not_quiet')
    if args.phase == 'start':
        require(public == stopped['public_configuration'] and accepted == stopped['acceptance_proofs']
                and other == stopped['protected_services'] and before_sql == stopped['SQL_after'], 'stopped_state_changed_before_restart')
    report = {'schema': 'nodia-ai-ai40-reservations-maintenance-v1', 'phase': args.phase, 'status': 'maintenance_failed',
              'operator_sha256': args.operator_sha256, 'descriptor_sha256': hashlib.sha256(raw).hexdigest(), 'external_witnesses': descriptor,
              'release': release, 'configuration_sha256': CONFIG_SHA, 'public_configuration': public, 'acceptance_proofs': accepted,
              'protected_services': other, 'SQL_before': before_sql, 'services_before': before_units,
              'provider_requests': 0, 'SQL_writes': 0, 'release_or_configuration_changed': False,
              'automatic_retry_allowed': False, 'private_details_emitted': False}
    exclusive(WORK / (args.phase + '-intent.json'), {'schema': 'nodia-ai-ai40-reservations-maintenance-intent-v1', 'phase': args.phase,
              'operator_sha256': args.operator_sha256, 'descriptor_sha256': report['descriptor_sha256'], 'service_mutation_may_have_started': True})
    try:
        if args.phase == 'stop':
            command(['systemctl', 'stop', 'nodia-api'])
            require(unit('nodia-api', True)['MainPID'] == '0' and unit('nodia-api')['ActiveState'] == 'inactive', 'api_not_stopped')
            deadline = time.monotonic() + 30
            while True:
                remaining = deadline - time.monotonic(); require(remaining > 0, 'worker_drain_deadline_exceeded')
                drained = sql(env, min(12, remaining))
                if quiet(drained):
                    break
                time.sleep(min(0.5, max(0, deadline - time.monotonic())))
            command(['systemctl', 'stop', 'nodia-ai-worker'])
            after_units = writers(False); after_sql = sql(env)
        else:
            command(['systemctl', 'start', 'nodia-ai-worker'])
            require(unit('nodia-ai-worker', True)['ActiveState'] == 'active', 'worker_not_started')
            command(['systemctl', 'start', 'nodia-api'])
            after_units = writers(True)
            env = read_environment(helper, int(after_units['nodia-api']['MainPID'])); after_sql = sql(env)
        configuration(); require(guard.validate_release() == release, 'release_changed_during_maintenance')
        require(public_configuration(helper, env) == public and proofs(images, helper, public['selection'], guard.EXPECTED_RUNTIME_FINGERPRINT) == accepted,
                'configuration_or_proofs_changed_during_maintenance')
        require(protected() == other and quiet(after_sql) and after_sql == before_sql, 'protected_or_operational_state_changed')
        report.update(status='stopped_verified' if args.phase == 'stop' else 'started_verified', services_after=after_units, SQL_after=after_sql)
    except Exception as error:
        report['error_code'] = safe_error(error)
        try:
            report['services_after'] = {name: unit(name) for name in UNITS}
        except Exception:
            report['service_observation_failed'] = True
    finally:
        exclusive(WORK / (args.phase + '-receipt.json'), report)
    return report


def safe_error(error):
    code = str(error)
    return code if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', code) else 'private_dependency_or_protocol_failure'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--operator-sha256', required=True); parser.add_argument('--phase', choices=('stop', 'start'), required=True)
    arguments = parser.parse_args()
    try:
        result = run(arguments)
        sys.stdout.buffer.write(encode(result))
        if result['status'] == 'maintenance_failed':
            sys.exit(1)
    except Exception as error:
        sys.stdout.buffer.write(encode({'schema': 'nodia-ai-ai40-reservations-maintenance-v1', 'status': 'maintenance_failed',
            'phase': arguments.phase, 'error_code': safe_error(error), 'automatic_retry_allowed': False, 'private_details_emitted': False,
            'receipt_requires_inspection': True})); sys.exit(1)
