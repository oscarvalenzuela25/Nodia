"""Operator-only image acceptance on a frozen candidate and disposable SQL.

Preflight never starts a provider process. Probe requires an explicit flag and
one MIME; a per-MIME exclusive intent prevents replay after an uncertain exit.
No adoption, service/configuration change, credential copy or profile cleanup.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys

ACTIVE = Path('/opt/nodia/releases/nodia-server-ai40-r03')
CANDIDATE = Path('/opt/nodia/verification/ai40-image-candidate-r01/server')
BASE = Path('/opt/nodia/verification/ai40-operator-r05/nodia-ai-ai40-adopt-r01.py')
BASE_SHA = 'c952cf7136c61ddb531789e52e47972e16f4bc1d9c481a9d519ff43b66f7a000'
BINARY = Path('/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex')
BINARY_SHA = '9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c'
DEPENDENCIES = Path('/opt/nodia/nodia-server/node_modules')
PROFILE = Path('/var/lib/nodia/codex')
MIMES = {'png': 'image/png', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def command(args, *, cwd=None, env=None, source=None, timeout=30):
    return subprocess.run(args, cwd=cwd, env=env, input=source,
                          capture_output=True, timeout=timeout, check=False)


def service(name):
    result = command(['systemctl', 'show', name, '--property=MainPID,ActiveState,WorkingDirectory,User'])
    require(result.returncode == 0, 'service_observation_failed')
    fields = dict(line.split('=', 1) for line in result.stdout.decode().splitlines() if '=' in line)
    require(fields.get('ActiveState') == 'active' and fields.get('User') == 'nodia', 'service_not_ready')
    pid = fields.get('MainPID', '')
    require(re.fullmatch(r'[1-9][0-9]*', pid), 'service_pid_invalid')
    if name in ('nodia-api', 'nodia-ai-worker'):
        require(fields.get('WorkingDirectory') == str(ACTIVE) and Path('/proc', pid, 'cwd').resolve() == ACTIVE,
                'active_release_changed')
    return {'pid': int(pid), 'active': fields['ActiveState'], 'working_directory': fields.get('WorkingDirectory', '')}


def selected_environment(pid, names):
    # Filter at the byte boundary; unrelated values never become strings/output.
    selected = {}
    for entry in Path('/proc', str(pid), 'environ').read_bytes().split(b'\0'):
        key, separator, value = entry.partition(b'=')
        if separator and key.decode('ascii', errors='ignore') in names:
            name = key.decode('ascii')
            require(name not in selected, 'duplicate_environment_field')
            selected[name] = value.decode()
    return selected


def validate_candidate(pin):
    require(CANDIDATE.is_dir() and CANDIDATE.resolve() == CANDIDATE, 'candidate_path_invalid')
    manifest_file = CANDIDATE.parent / 'candidate-manifest.json'
    require(sha(manifest_file) == pin, 'candidate_manifest_changed')
    manifest = json.loads(manifest_file.read_bytes())
    require(manifest['schema'] == 'nodia-ai-ai40-image-candidate-v1', 'candidate_schema_invalid')
    files = manifest['files']
    require(type(files) is dict and 100 < len(files) < 10000, 'candidate_inventory_invalid')
    for name, digest in files.items():
        relative = Path(name)
        require(not relative.is_absolute() and '..' not in relative.parts and not any(p.startswith('.env') for p in relative.parts),
                'candidate_member_invalid')
        path = CANDIDATE / relative
        require(path.resolve().is_relative_to(CANDIDATE), 'candidate_member_escaped')
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) and not path.is_symlink() and info.st_nlink == 1 and sha(path) == digest,
                'candidate_bytes_changed')
    require((CANDIDATE / 'node_modules').is_symlink() and (CANDIDATE / 'node_modules').resolve() == DEPENDENCIES,
            'candidate_dependencies_changed')
    require(sha(CANDIDATE / 'package-lock.json') == sha(ACTIVE / 'package-lock.json'), 'dependency_lock_mismatch')
    info = BINARY.lstat()
    require(stat.S_ISREG(info.st_mode) and not BINARY.is_symlink() and sha(BINARY) == BINARY_SHA, 'native_binary_changed')
    require(type(manifest.get('source_sha256')) is dict and
            'src/common/ai/codex/codex-chat-images.ts' in manifest['source_sha256'], 'source_build_provenance_missing')
    require(sha(CANDIDATE.parent / 'public-canary-input.mjs') == manifest['public_input_sha256'], 'public_input_source_changed')
    required = ('dist/common/ai/codex/codex-chat-images.js',
                'test/nodia-ai-ai40-real-canary.mjs', 'test/nodia-ai-ai40-real-canary-parent.mjs',
                'test/nodia-ai.integration.fixture.mjs')
    require(all(name in files for name in required), 'candidate_missing_boundary')
    return {'manifest_sha256': pin, 'files': len(files), 'source_files_pinned': len(manifest['source_sha256']),
            'dist_files': sum(n.startswith('dist/') for n in files), 'native_binary_sha256': BINARY_SHA,
            'source_build_pair_manifest_verified': True, 'dependency_lock_matches_active': True}


def public_preflight(services):
    require(sha(BASE) == BASE_SHA, 'historical_operator_changed')
    spec = importlib.util.spec_from_file_location('pinned_ai40_operator', BASE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.NEW = ACTIVE
    operator, _ = module.load_helper()
    operator.RELEASE = ACTIVE
    consumers = operator.active_new_processes()
    codex = module.codex_barrier(operator, PROFILE, frozenset(c['pid'] for c in consumers.values()))
    journal = module.journal_open(operator)
    sql = chat_projection(services['nodia-api']['pid'])
    require(all(sql[key] == 0 for key in ('pending_jobs', 'open_attempts', 'retained_slots')), 'operational_sql_not_quiet')
    return {'consumers': consumers, 'codex': codex, 'journal': journal, 'SQL': sql}


def chat_projection(api_pid):
    api_env = selected_environment(api_pid, {'DOTENV_CONFIG_PATH', 'POSTGRES_HOST', 'POSTGRES_PORT',
        'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL'})
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', **api_env}
    # Reuse only the versioned DB connection preamble; replace its query with bounded counts.
    preamble = (CANDIDATE.parent / 'public-canary-input.mjs').read_text().split('try {', 1)[0]
    query = """
try { await db.initialize();
const projection=await db.transaction(async m=>{await m.query('SET TRANSACTION READ ONLY');
const [counts]=await m.query(`SELECT
 (SELECT count(*)::integer FROM nodia_ai_conversations WHERE id=$1) chats,
 (SELECT count(*)::integer FROM nodia_ai_messages WHERE conversation_id=$1) messages,
 (SELECT count(*)::integer FROM nodia_ai_runs WHERE conversation_id=$1) runs,
 (SELECT COALESCE(sum(provider_dispatches_used),0)::integer FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,
 (SELECT count(*)::integer FROM nodia_ai_tool_calls t JOIN nodia_ai_runs r ON r.id=t.run_id WHERE r.conversation_id=$1) tool_receipts,
 (SELECT count(*)::integer FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,
 (SELECT count(*)::integer FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1 AND s.minimal_receipt IS NOT NULL) effect_receipts,
 (SELECT count(*)::integer FROM finance_movements WHERE name=$2) financial_effects,
 (SELECT count(*)::integer FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting') OR kind='reconcile' AND state<>'done') pending_jobs,
 (SELECT count(*)::integer FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
 (SELECT count(*)::integer FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots`,
 ['ec626b72-1f32-4486-9f3a-8263cffce267','AI40-UI-CODEX-R01']); return counts;});
console.log(JSON.stringify(projection));
}finally{if(db.isInitialized)await db.destroy();}
"""
    result = command(['/usr/local/bin/node', '--input-type=module', '-e', preamble + query], cwd=ACTIVE, env=env, timeout=25)
    require(result.returncode == 0 and len(result.stdout) < 4096, 'chat_projection_failed')
    value = json.loads(result.stdout)
    require(type(value) is dict and len(value) == 11 and all(type(n) is int and n >= 0 for n in value.values()),
            'chat_projection_invalid')
    return value


def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0, 'root_linux_operator_required')
    require(sha(Path(__file__).resolve()) == args.operator_sha256, 'operator_source_changed')
    candidate = validate_candidate(args.manifest_sha256)
    services = {name: service(name) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-keyring')}
    before = public_preflight(services)
    preflight = {'schema': 'nodia-ai-ai40-image-operator-v1', 'mode': args.mode,
                 'observed_at_VM_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                 'candidate': candidate, 'services': services, 'before': before,
                 'services_changed': False, 'profile_removed_or_copied': False,
                 'credential_values_emitted': False, 'provider_requests': 0}
    if args.mode == 'preflight':
        require(not args.authorize_one_real_generation and args.mime is None, 'preflight_cannot_authorize_generation')
        return {**preflight, 'status': 'preflight_passed'}, 0
    require(args.authorize_one_real_generation and args.mime in MIMES, 'one_generation_authorization_required')
    private_file = CANDIDATE.parent / 'fixtures' / 'private-probes.json'
    uid = pwd.getpwnam('nodia').pw_uid
    info = private_file.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1,
            'probe_metadata_not_private')
    probe = json.loads(private_file.read_bytes())[args.mime]
    require(set(probe) == {'path', 'media_type', 'sha256', 'expected_code'} and probe['media_type'] == MIMES[args.mime],
            'private_probe_invalid')
    image = Path(probe['path'])
    require(image.parent == private_file.parent and image.resolve() == image and sha(image) == probe['sha256'], 'image_bytes_changed')
    info = image.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1,
            'image_not_private')
    api_env = selected_environment(services['nodia-api']['pid'], {'DOTENV_CONFIG_PATH', 'TZ', 'POSTGRES_HOST', 'POSTGRES_PORT',
        'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL'})
    require(api_env.get('TZ') in (None, 'UTC', 'Etc/UTC'), 'timezone_requires_review')
    read_env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'AI40_CONNECTION_ID': '1',
                **{k: v for k, v in api_env.items() if k != 'TZ'}}
    config_read = command(['/usr/local/bin/node', '--input-type=module', '-e', (CANDIDATE.parent / 'public-canary-input.mjs').read_text()],
                          cwd=ACTIVE, env=read_env, timeout=25)
    require(config_read.returncode == 0 and len(config_read.stdout) < 1024 * 1024, 'public_configuration_read_failed')
    config = json.loads(config_read.stdout)
    require(config['selection']['connection_id'] == '1' and config['expected_binary_sha256'] == BINARY_SHA, 'selection_identity_changed')
    config['image_probe'] = probe
    broker = selected_environment(services['nodia-keyring']['pid'], {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'})
    require(set(broker) == {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'}, 'broker_transport_missing')
    require(broker['DBUS_SESSION_BUS_ADDRESS'] == 'unix:path=' + broker['XDG_RUNTIME_DIR'] + '/bus', 'broker_transport_mismatch')
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODIA_CODEX_ENABLED': 'true',
           'NODIA_CODEX_PROFILE_ROOT': str(PROFILE), **broker}
    # Exclusive durable intent is created BEFORE dispatch. Existence prohibits a rerun, even after a failed wrapper.
    intent = CANDIDATE.parent / ('intent-' + args.mime + '.json')
    with intent.open('x', encoding='utf-8', newline='\n') as stream:
        os.chmod(intent, 0o600)
        json.dump({'schema': 'nodia-ai-ai40-image-intent-v1', 'mime': MIMES[args.mime], 'candidate': candidate['manifest_sha256'],
                   'image_sha256': probe['sha256'], 'selection': config['selection'], 'generation_may_have_started': True}, stream)
        stream.flush()
        os.fsync(stream.fileno())
    result = command(['/usr/local/bin/node', str(CANDIDATE / 'test/nodia-ai-ai40-real-canary-parent.mjs')],
                     cwd=CANDIDATE, env=env, source=json.dumps(config).encode(), timeout=380)
    require(len(result.stdout) < 4 * 1024 * 1024, 'parent_output_exceeded')
    receipt = json.loads(result.stdout)
    require(receipt['schema'] == 'nodia-ai-ai40-real-canary-parent-v1', 'parent_receipt_invalid')
    receipt_file = CANDIDATE.parent / ('receipt-' + args.mime + '.json')
    with receipt_file.open('x', encoding='utf-8', newline='\n') as stream:
        os.chmod(receipt_file, 0o600)
        json.dump(receipt, stream)
        stream.flush()
        os.fsync(stream.fileno())
    after = public_preflight(services)
    after_services = {name: service(name) for name in services}
    require(after_services == services and after['SQL'] == before['SQL'],
            'operational_state_changed')
    return {**preflight, 'status': receipt['status'], 'provider_requests': receipt.get('child', {}).get('provider_dispatches_armed'),
            'image_media_type': probe['media_type'], 'image_sha256': probe['sha256'], 'parent': receipt,
            'after': after, 'operator_transport_source': 'nodia-keyring_public_environment'}, result.returncode


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['preflight', 'probe'], required=True)
    parser.add_argument('--mime', choices=sorted(MIMES))
    parser.add_argument('--authorize-one-real-generation', action='store_true')
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    options = parser.parse_args()
    try:
        receipt, exit_code = run(options)
        print(json.dumps(receipt))
        sys.exit(exit_code)
    except Exception as error:
        # Do not forward argv, subprocess stdout/stderr, private config, synthetic code or exception text.
        code = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-image-operator-v1', 'status': 'operator_failed',
                          'error_class': type(error).__name__, 'mode': options.mode, 'generation_not_replayed': True,
                          'error_code': code if re.fullmatch(r'[a-z][a-z0-9_]{1,95}', code) else None,
                          'candidate_preserved': True, 'private_details_emitted': False}))
        sys.exit(1)
