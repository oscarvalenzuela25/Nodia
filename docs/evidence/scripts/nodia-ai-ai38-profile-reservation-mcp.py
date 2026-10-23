"""One explicit MCP nonce/ACK on a pinned new Gemini epoch using frozen harness.

No adoption, fallback, SQL mutation, business tool or inference replay. On timeout
preserve the single native identity for reconciliation; never retry this driver.
Service credentials exist only in the unchanged harness process memory.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

SERVER = Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
SERVER_SHA = '4c3fe6d600adab362a71c5f76357383e98aa7acda7c93aa73e61bfb29c626f92'
HARNESS_SHA = '95cdfdc53e86cf44c892273185c11ee2d319c636fbb0db6cd39980b12d42c87d'
ENV = Path('/opt/nodia/releases/nodia-server-ai15-20261016/.env')
WORK = Path('/opt/nodia/verification/ai38-profile-reservation-fix-mcp-r01')
NODE = '/usr/local/bin/node'
SELECTION = r"""
import fs from'node:fs';import assert from'node:assert/strict';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';
const[root,envPath,output]=process.argv.slice(2);const r=createRequire(root+'/package.json');r('reflect-metadata');
const c=r('dotenv').parse(fs.readFileSync(envPath));assert.notEqual(c.POSTGRES_SSL,'true');
assert.ok(['127.0.0.1','localhost','::1','[::1]'].includes(c.POSTGRES_HOST));
const service=new URL(c.GEMINI_MICROSERVICE_URL);assert.equal(service.protocol,'http:');assert.equal(service.username,'');assert.equal(service.password,'');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(service.hostname));assert.match(c.GEMINI_SERVICE_TOKEN,/^[a-f0-9]{64}$/i);
process.env.GEMINI_MICROSERVICE_URL=c.GEMINI_MICROSERVICE_URL;process.env.GEMINI_SERVICE_TOKEN=c.GEMINI_SERVICE_TOKEN;
const{projectNodiaAiConnection:project}=await import(pathToFileURL(root+'/dist/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.js'));
const{DataSource}=r('typeorm');const d=await new DataSource({type:'postgres',host:c.POSTGRES_HOST,port:Number(c.POSTGRES_PORT),
username:c.POSTGRES_USER,password:c.POSTGRES_PASSWORD,database:c.POSTGRES_DB,entities:[],migrations:[],synchronize:false,migrationsRun:false,
extra:{options:'-c default_transaction_read_only=on',connectionTimeoutMillis:5000,statement_timeout:5000}}).initialize();
try{const[t]=await d.query('SHOW default_transaction_read_only');assert.equal(t.default_transaction_read_only,'on');
const[quiet]=await d.query(`SELECT(SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN('ready','leased','waiting','unknown')) pending_jobs,
(SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN('held','unknown')) retained_slots`);
assert.ok(Object.values(quiet).every(n=>n===0));
const[row]=await d.query(`SELECT p.id::text,p.is_active,p.use_api_key,p.use_token_plan_web,p.use_token_plan_agentic,p.fields,
c.key provider_key,c.is_active catalog_active,c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`,['2']);
assert.ok(row&&row.provider_key==='gemini'&&row.is_active&&row.catalog_active&&row.use_token_plan_agentic);
const mode=project(row).modes.find(m=>m.mode==='token_plan_agentic');assert.equal(mode.configuration,'configured');const s=mode.configured_selection;assert.ok(s);
fs.writeFileSync(output,JSON.stringify({rows:[{connection_id:s.connection_id,provider_key:'gemini',is_active:true,
agentic_model:s.model_id,agentic_effort:s.effort_id}],configured_database_read_only:true,quiet}),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'exact_connection_2_selection_read_only',quiet,configured_selection_from_database:true}));
}finally{await d.destroy();}
"""


def require(ok, code):
    if not ok:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def epoch(image):
    result = subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'], capture_output=True, timeout=15, check=True)
    value = json.loads(result.stdout)[0]
    require(value['State']['Running'] and value['Image'] == image, 'unexpected_native_epoch')
    return dict(id=value['Id'], image=value['Image'], started_at=value['State']['StartedAt'])


def native_projection(value):
    require(isinstance(value, dict), 'native_report_invalid')
    output = {}
    for key in ('status', 'error_code'):
        if key in value:
            require(isinstance(value[key], str) and re.fullmatch('[a-z_:-]{1,160}', value[key]), 'native_status_invalid')
            output[key] = value[key]
    for key in ('configured_database_read_only', 'configured_database_modified', 'configured_selection_modified',
                'available_before', 'supports_mcp_before', 'supports_mcp_after', 'diagnostic_nonce_verified',
                'native_terminal_proof_acknowledged', 'inference_replayed', 'native_pending_identity'):
        if key in value:
            require(type(value[key]) is bool, 'native_boolean_invalid')
            output[key] = value[key]
    for key in ('real_provider_dispatch_requests', 'maximum_provider_dispatch_requests'):
        require(type(value.get(key)) is int and 0 <= value[key] <= 1, 'generation_budget_invalid')
        output[key] = value[key]
    d = value['diagnostics']
    require(d['schema_version'] == 1, 'diagnostic_schema_invalid')
    diagnostics = dict(schema_version=1)
    for key in ('callbacks', 'protocol_progress_notifications', 'last_rpc_messages', 'last_unforwarded_tool_requests', 'valid_progress_snapshots'):
        require(d[key] is None or (type(d[key]) is int and 0 <= d[key] <= 100000), 'diagnostic_count_invalid')
        diagnostics[key] = d[key]
    require(d['start_admission'] in {'not_requested', 'requested', 'running', 'uncertain', 'rejected_no_admission'}, 'admission_invalid')
    diagnostics['start_admission'] = d['start_admission']
    require(d['attempt_id'] is None or re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', d['attempt_id']), 'attempt_invalid')
    diagnostics['attempt_id'] = d['attempt_id']
    require(type(d['post_start_not_dispatched_error']) is bool, 'admission_risk_invalid')
    diagnostics['post_start_not_dispatched_error'] = d['post_start_not_dispatched_error']
    for key, length in (('configuration_generation', 64), ('session_generation', 32)):
        require(d[key] is None or re.fullmatch('[a-f0-9]{' + str(length) + '}', d[key]), 'generation_binding_invalid')
        diagnostics[key] = d[key]
    selection = d['selection']
    if selection is not None:
        require(set(selection) == {'connection_id', 'mode', 'model_id', 'effort_id'} and
                selection['connection_id'] == '2' and selection['mode'] == 'token_plan_agentic' and
                isinstance(selection['model_id'], str) and 0 < len(selection['model_id'].encode()) <= 1024 and
                (selection['effort_id'] is None or (isinstance(selection['effort_id'], str) and
                 0 < len(selection['effort_id'].encode()) <= 256)), 'selection_binding_invalid')
    diagnostics['selection'] = selection
    phases = {'verify_configured_selection', 'observe_before', 'probe', 'probe_returned', 'acknowledge_completed',
              'observe_after', 'passed', 'failed', 'reconcile', 'acknowledge_recovered', 'cleanup'}
    require(set(d['phases']) <= phases and all(type(v) is int and 0 <= v <= 100 for v in d['phases'].values()),
            'diagnostic_phases_invalid')
    diagnostics['phases'] = d['phases']
    endpoints = {'observe', 'start', 'events', 'results', 'attest', 'cancel', 'reconcile', 'acknowledge'}
    require(set(d['endpoints']) == endpoints, 'endpoint_set_invalid')
    diagnostics['endpoints'] = {}
    for endpoint, counters in d['endpoints'].items():
        require(set(counters) == {'requests', 'completed', 'failed'} and
                all(type(n) is int and 0 <= n <= 100000 for n in counters.values()), 'endpoint_count_invalid')
        diagnostics['endpoints'][endpoint] = counters
    require(diagnostics['endpoints']['start']['requests'] <= 1, 'more_than_one_start_forbidden')
    output['diagnostics'] = diagnostics
    return output


def run(args):
    require(os.geteuid() == 0 and args.execute_one_live, 'explicit_root_live_generation_required')
    require(re.fullmatch('sha256:[a-f0-9]{64}', args.expected_image), 'image_pin_invalid')
    require(sha(SERVER / 'release-manifest.json') == SERVER_SHA, 'Server_package_pin_mismatch')
    harness = Path(args.harness)
    require(sha(harness) == HARNESS_SHA, 'frozen_harness_pin_mismatch')
    require(not WORK.exists(), 'one_generation_work_already_exists_no_replay')
    before = epoch(args.expected_image)
    os.umask(0o077)
    WORK.mkdir(mode=0o700)
    overlay = WORK / 'nodia-server'
    (overlay / 'test').mkdir(parents=True, mode=0o700)
    for name in ('dist', 'package.json', 'package-lock.json', 'node_modules'):
        (overlay / name).symlink_to(SERVER / name, target_is_directory=name in ('dist', 'node_modules'))
    require((overlay / 'node_modules').resolve() == Path('/opt/nodia/nodia-server/node_modules').resolve(),
            'dependency_target_mismatch')
    target = overlay / 'test/nodia-ai-ai38-mcp-diagnostic.mjs'
    with target.open('xb') as stream:
        stream.write(harness.read_bytes())
    require(sha(target) == HARNESS_SHA, 'copied_harness_pin_mismatch')
    private_selection = WORK / 'private-selection.json'
    private_native = WORK / 'private-native-report.json'
    environment = dict(PATH='/usr/local/bin:/usr/bin:/bin', HOME='/root', NODE_ENV='test',
                       RATE_LIMIT_STORAGE='memory', DOTENV_CONFIG_PATH='/dev/null')
    report = dict(scope='one_real_MCP_nonce_callback_and_ACK_no_business_effect', status='prepared',
                  source_sha256=sha(Path(__file__)), harness_sha256=HARNESS_SHA, Server_manifest_sha256=SERVER_SHA,
                  native_epoch_before=before, began_at_utc=datetime.now(timezone.utc).isoformat(),
                  maximum_provider_generation_requests=1, automatic_inference_retries=0,
                  configured_SQL_writes=0, business_effects=0, services_restarted=False,
                  raw_stdout_stderr_saved=False, provider_harness_started=False, native_pending_identity=False)
    code = 1
    try:
        selection = subprocess.run([NODE, '--input-type=module', '-', str(SERVER), str(ENV), str(private_selection)],
                                   input=SELECTION.encode(), cwd=overlay, env=environment, capture_output=True, timeout=30, check=False)
        require(selection.returncode == 0 and private_selection.is_file(), 'read_only_selection_preflight_failed')
        require(len(selection.stdout) <= 8192, 'selection_output_oversized')
        report['selection'] = json.loads(selection.stdout)
        report['selection_sha256'] = sha(private_selection)
        environment.update(NODIA_AI_ALLOW_LIVE='yes', NODIA_AI_ATTEST_CONFIGURED_DB='read_only',
                           NODIA_AI_LAB_API_ENV=str(ENV), NODIA_AI_LAB_SELECTION_JSON=str(private_selection),
                           NODIA_AI_LAB_REPORT_JSON=str(private_native))
        report['provider_harness_started'] = True
        report['native_pending_identity'] = None
        result = subprocess.run([NODE, str(target)], cwd=overlay, env=environment,
                                capture_output=True, timeout=300, check=False)
        code = result.returncode
        report['exit_code'] = code
        # stdout/stderr may include controlled Nest messages; do not persist or
        # print either. Read only the harness' independently closed report.
        require(private_native.is_file() and private_native.stat().st_size <= 65536, 'native_report_missing_or_oversized')
        native = native_projection(json.loads(private_native.read_bytes()))
        accepted = (code == 0 and native.get('status') == 'passed' and
                    native.get('native_pending_identity') is False and native.get('diagnostic_nonce_verified') is True and
                    native.get('native_terminal_proof_acknowledged') is True and native.get('supports_mcp_after') is True and
                    native.get('real_provider_dispatch_requests') == 1 and native['diagnostics']['callbacks'] == 1)
        report.update(native_result=native, native_pending_identity=native.get('native_pending_identity'),
                      status='passed' if accepted else 'failed_no_replay')
        require(epoch(args.expected_image) == before, 'native_epoch_changed')
        report['same_native_epoch_after'] = True
    except subprocess.TimeoutExpired:
        code = 124
        report.update(status='runner_timeout_native_identity_requires_reconciliation_no_replay', exit_code=code)
    except Exception as error:
        report.update(status='driver_failed_no_replay', failure_code=str(error) if isinstance(error, ValueError) and
                      re.fullmatch('[A-Za-z_]{1,100}', str(error)) else 'operation_failed')
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    raw = (json.dumps(report, indent=2) + '\n').encode()
    with (WORK / 'public-report.json').open('xb') as stream:
        stream.write(raw)
    if report['status'] == 'passed':
        capture = dict(input_report_sha256=hashlib.sha256(raw).hexdigest(),
                       attempt_id=report['native_result']['diagnostics']['attempt_id'],
                       same_container_epoch_after_capture=True, container_id=before['id'],
                       container_image=before['image'], container_started_at_utc=before['started_at'])
        require(epoch(args.expected_image) == before, 'native_epoch_changed_before_capture')
        with (WORK / 'qualification-epoch.json').open('x') as stream:
            json.dump(capture, stream, indent=2)
            stream.write('\n')
    sys.stdout.buffer.write(raw)
    return code if report['status'] == 'passed' else 1


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--expected-image', required=True)
    p.add_argument('--harness', required=True)
    p.add_argument('--execute-one-live', action='store_true')
    args = p.parse_args()
    try:
        raise SystemExit(run(args))
    except (OSError, ValueError, KeyError, TypeError):
        print(json.dumps(dict(status='precondition_failed_or_control_error_no_replay', raw_details_emitted=False)))
        raise SystemExit(1)
