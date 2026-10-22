"""Exact completed-run SQL and native HTTP metadata; no provider/ACK calls or raw log output."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

RUN_ID = 'ad1d1c79-5658-4649-8261-9f4dc6984fff'
CONVERSATION_ID = 'a160f615-ea41-4a05-831d-acdbb413ec4d'
CLEANUP = Path('/tmp/ai32-r04-cleanup.py')
CLEANUP_SHA = 'a42831dce6f458af03f8a405014ebd8de8aafda6d39ca60fb00cd24829c243b7'
UUID = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
SQL = r'''
import{createRequire}from'node:module';import fs from'node:fs';
const root='/opt/nodia/releases/nodia-server-ai15-20261016';const require=createRequire(root+'/package.json');
const c=require('dotenv').parse(fs.readFileSync(root+'/.env'));const{DataSource}=require('typeorm');
const d=new DataSource({type:'postgres',host:c.POSTGRES_HOST,port:Number(c.POSTGRES_PORT),database:c.POSTGRES_DB,
username:c.POSTGRES_USER,password:c.POSTGRES_PASSWORD,synchronize:false,migrationsRun:false,logging:false,
ssl:c.POSTGRES_SSL==='true'?{rejectUnauthorized:false}:undefined,
extra:{connectionTimeoutMillis:5000,statement_timeout:5000,idle_in_transaction_session_timeout:15000}});
let r;try{await d.initialize();r=d.createQueryRunner();await r.connect();await r.startTransaction('REPEATABLE READ');
await r.query('SET TRANSACTION READ ONLY');
const[tx]=await r.query("SELECT current_setting('transaction_read_only') read_only,current_setting('transaction_isolation') isolation,now() observed_at");
const runs=await r.query(`SELECT id,conversation_id,state,phase,created_at,completed_at,provider_dispatches_used,tool_calls_used,mcp_rpc_messages_used
FROM nodia_ai_runs WHERE id=$1 AND conversation_id=$2 LIMIT 1`,['ad1d1c79-5658-4649-8261-9f4dc6984fff','a160f615-ea41-4a05-831d-acdbb413ec4d']);
const attempts=await r.query(`SELECT a.id,a.external_operation_ref,a.phase,a.stage_key,a.started_at,a.ended_at
FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id
WHERE j.run_id=$1 AND j.conversation_id=$2 ORDER BY a.started_at,a.id LIMIT 17`,['ad1d1c79-5658-4649-8261-9f4dc6984fff','a160f615-ea41-4a05-831d-acdbb413ec4d']);
await r.commitTransaction();console.log(JSON.stringify({transaction:tx,runs,attempts}));
}finally{if(r?.isTransactionActive)await r.rollbackTransaction();if(r)await r.release();if(d.isInitialized)await d.destroy();}
'''


def command(argv, timeout=30, payload=None):
    value = subprocess.run(argv, input=payload, capture_output=True, timeout=timeout, check=False)
    if value.returncode:
        raise RuntimeError('read_only_command_failed')
    return value.stdout


def main():
    assert hashlib.sha256(CLEANUP.read_bytes()).hexdigest() == CLEANUP_SHA
    sql = json.loads(command(['/usr/local/bin/node', '--input-type=module'], payload=SQL.encode()))
    assert sql['transaction']['read_only'] == 'on' and sql['transaction']['isolation'] == 'repeatable read'
    assert len(sql['runs']) == 1 and len(sql['attempts']) <= 16
    run = sql['runs'][0]
    assert run['id'] == RUN_ID and run['conversation_id'] == CONVERSATION_ID
    assert run['completed_at'] is not None, 'run_still_active'
    attempts = [row for row in sql['attempts'] if row['external_operation_ref'] is not None]
    assert attempts and all(UUID.fullmatch(row['id']) and UUID.fullmatch(row['external_operation_ref']) for row in attempts)
    assert all(row['external_operation_ref'] == row['id'] for row in attempts), 'native_identity_not_exact'
    identities = {row['external_operation_ref'] for row in attempts}
    started = datetime.fromisoformat(run['created_at'].replace('Z', '+00:00'))
    until = datetime.now(timezone.utc)
    assert 0 <= (until - started).total_seconds() <= 3600, 'log_window_out_of_bounds'
    info = json.loads(command(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    epoch = {key: info[key] for key in ('Id', 'Image')}
    epoch['started_at'] = info['State']['StartedAt']
    assert info['State']['Running']
    # Combined stdout/stderr stays only in memory; only closed route/terminal metadata is emitted.
    captured = subprocess.run(['docker', 'logs', '--timestamps', '--since', started.isoformat(),
                              '--until', until.isoformat(), 'nodia-gemini-microservice'],
                             capture_output=True, timeout=30, check=False)
    assert captured.returncode == 0
    data = captured.stdout + b'\n' + captured.stderr
    assert len(data) <= 16 * 1024 * 1024, 'log_window_too_large'
    route = re.compile(r'"(GET|POST) (/nodia-ai/agentic/attempts/([a-f0-9-]{36})/(?:mcp/)?(events|results|attest|reconcile|acknowledge|cancel)) HTTP/[0-9.]+" (\d{3})\b')
    routes = Counter()
    terminals = {identity: [] for identity in identities}
    for raw in data.splitlines():
        line = raw.decode('utf-8', errors='replace')
        matched = route.search(line)
        if matched and matched[3] in identities:
            routes[(matched[3], matched[1], matched[4], int(matched[5]))] += 1
        marker = 'nodia_ai_mcp_terminal '
        if marker not in line:
            continue
        text = line.split(marker, 1)[1]
        if len(text.encode()) > 131072:
            continue
        try:
            value = json.loads(text)
        except (ValueError, RecursionError):
            continue
        if not isinstance(value, dict) or value.get('attempt_id') not in identities:
            continue
        safe = {'attempt_id': value['attempt_id']}
        for key in ('phase', 'state'):
            if value.get(key) in ('completed', 'unknown', 'running', 'failed', 'succeeded', 'cancelled'):
                safe[key] = value[key]
        for key in ('elapsed_ms', 'rpc_messages', 'callbacks', 'exit_code'):
            item = value.get(key)
            if type(item) is int and -1 <= item <= 100000000:
                safe[key] = item
        if type(value.get('gate_verified')) is bool:
            safe['gate_verified'] = value['gate_verified']
        terminals[value['attempt_id']].append(safe)
    native = json.loads(command(['python3', str(CLEANUP)]))
    count_keys = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
                  'temporary_attachment_directories', 'temporary_cli_directories')
    absence = all(native.get(key) == 0 for key in count_keys)
    per_attempt = []
    for identity in sorted(identities):
        ack_count = routes[(identity, 'POST', 'acknowledge', 200)]
        per_attempt.append({'attempt_id': identity, 'HTTP_200_ACK_count': ack_count,
                            'ACK_HTTP_metadata_observed': ack_count > 0,
                            'exact_terminal_diagnostics': terminals[identity],
                            'route_counts': [{'method': key[1], 'endpoint': key[2], 'status': key[3], 'count': count}
                                             for key, count in sorted(routes.items()) if key[0] == identity]})
    after = json.loads(command(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    same_epoch = after['Id'] == epoch['Id'] and after['Image'] == epoch['Image'] and after['State']['StartedAt'] == epoch['started_at']
    assert same_epoch
    print(json.dumps({'schema': 'ai38-live-native-r01', 'status': 'metadata_observed_read_only',
                      'observed_at_VM_utc': until.isoformat(), 'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                      'SQL': sql, 'container_epoch': epoch, 'same_container_epoch_after': same_epoch,
                      'log_window': {'since': started.isoformat(), 'until': until.isoformat(), 'bytes_read': len(data), 'raw_emitted': False, 'raw_saved': False},
                      'per_attempt': per_attempt, 'all_attempt_ACK_HTTP_200_observed': all(row['ACK_HTTP_metadata_observed'] for row in per_attempt),
                      'native_artifact_counts': {key: native.get(key) for key in count_keys},
                      'global_native_artifacts_absent': absence,
                      'provider_requests': 0, 'configured_SQL_writes': 0, 'ACK_or_reconcile_requested': False,
                      'services_restarted': False, 'profile_bytes_read': False,
                      'limits': ['HTTP ACK observations do not expose or reconstruct terminal proof tokens.',
                                 'Artifact absence alone does not establish why a proof disappeared.',
                                 'No HTTP callback, acknowledgement or reconciliation is invoked by this observer.']}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'schema': 'ai38-live-native-r01', 'status': 'failed', 'diagnostic_details_withheld': True}))
        raise SystemExit(1)
