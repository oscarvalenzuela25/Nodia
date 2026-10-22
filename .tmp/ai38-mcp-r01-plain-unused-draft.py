"""DRAFT auxiliary control, NOT EXECUTED or accepted for operational use.

Preparation stopped when the real MCP nonce control passed; Docker diagnostic
projection and exceptional driver-exit persistence still require review before
any future execution. No availability or terminal-proof claim comes from this file.

Prepare/run exactly one explicit Agentic text control, never a retry of MCP.

VM only: DRIVER CANDIDATE MANIFEST_SHA MCP_LIVE_REPORT ACTIVATION_REPORT API_ENV --execute-one-live
The MCP report lacks its historical resource_key. We bind the current resource
from fresh observation, exact persisted selection/config/session and Docker epoch;
the public report explicitly records that historical resource was not compared.
"""
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import subprocess
import sys


NODE_CONTROL = r'''
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
const [candidate,envFile,previousFile,resultFile]=process.argv.slice(2);
const require=createRequire(path.join(candidate,'package.json'));
require('reflect-metadata');
const {parse}=require('dotenv'),{DataSource}=require('typeorm');
const config=parse(fs.readFileSync(envFile));
const url=new URL(config.GEMINI_MICROSERVICE_URL);
assert.ok(['127.0.0.1','localhost','::1','[::1]'].includes(url.hostname));
assert.match(config.GEMINI_SERVICE_TOKEN,/^[a-f0-9]{64}$/i);
process.env.GEMINI_SERVICE_TOKEN=config.GEMINI_SERVICE_TOKEN;
process.env.GEMINI_MICROSERVICE_URL=config.GEMINI_MICROSERVICE_URL;
const load=name=>import(pathToFileURL(path.join(candidate,'dist',name+'.js')).href);
const [{GeminiNodiaAiAdapterUseCase:Adapter},{NodiaAiAdapterTransport:Transport},
 {ReconcileGeminiNodiaAiRuntimeUseCase:Reconciliation},{projectNodiaAiConnection:project}]=await Promise.all([
 load('nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case'),load('nodia-ai-adapter/nodia-ai-adapter.service'),
 load('nodia-ai-adapter/use-case/reconcile-gemini-nodia-ai-runtime.use-case'),
 load('nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case')]);
const prior=JSON.parse(fs.readFileSync(previousFile,'utf8')).native_result;
const previous=prior.diagnostics;
assert.equal(prior.native_terminal_proof_acknowledged,true);
assert.equal(prior.native_pending_identity,false);
assert.equal(previous.callbacks,0);
assert.equal(previous.selection.mode,'token_plan_agentic');
const report={status:'not_dispatched',phase:'verify_selection',provider_dispatch_requests:0,
 maximum_provider_dispatch_requests:1,automatic_inference_retries:0,configured_SQL_writes:0,
 business_effects:0,tools_exposed:0,attachments:0,previous_resource_key_compared:false,
 native_pending_identity:false,terminal_proof_acknowledged:false,nonce_verified:false};
const save=()=>fs.writeFileSync(resultFile,JSON.stringify(report,null,2)+'\n',{mode:0o600});
save();
const source=await new DataSource({type:'postgres',host:config.POSTGRES_HOST,port:Number(config.POSTGRES_PORT),
 username:config.POSTGRES_USER,password:config.POSTGRES_PASSWORD,database:config.POSTGRES_DB,
 entities:[],migrations:[],synchronize:false,migrationsRun:false,
 extra:{options:'-c default_transaction_read_only=on'}}).initialize();
const transport=new Transport();
const original=transport.request.bind(transport);
transport.request=async function(route,payload,...args){
 if(route==='/nodia-ai/agentic/turn'){
  assert.equal(report.provider_dispatch_requests,0,'one text turn only');
  assert.equal(payload.model_id,previous.selection.model_id);
  assert.equal(payload.effort_id,previous.selection.effort_id);
  assert.ok(!payload.tools && !payload.attachments?.length);
  assert.ok(payload.timeout_seconds>=1&&payload.timeout_seconds<=120);
  report.provider_dispatch_requests++;report.native_pending_identity=true;save();
 }
 return original(route,payload,...args);
};
const adapter=new Adapter(source,transport),reconciliation=new Reconciliation(transport);
let reference,proof;
try{
 const [mode]=await source.query('SHOW default_transaction_read_only');
 assert.equal(mode.default_transaction_read_only,'on');report.configured_database_read_only=true;
 const [quiet]=await source.query(`SELECT
 (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
 (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
 (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`);
 assert.ok(Object.values(quiet).every(value=>value===0));report.quiet_before=quiet;
 const rows=await source.query(`SELECT p.id::text,p.is_active,p.use_api_key,p.use_token_plan_web,
 p.use_token_plan_agentic,p.fields,c.key provider_key,c.is_active catalog_active,
 c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
 FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`,[previous.selection.connection_id]);
 assert.equal(rows.length,1);
 const projected=project(rows[0]).modes.find(item=>item.mode==='token_plan_agentic');
 assert.equal(projected.configuration,'configured');
 const selection=projected.configured_selection;
 assert.deepEqual(selection,previous.selection);report.selection=selection;
 report.phase='fresh_observe';save();
 const observed=await adapter.observe(selection,AbortSignal.timeout(35000));
 assert.equal(observed.available,true);
 assert.equal(observed.configurationGeneration,previous.configuration_generation);
 assert.equal(observed.sessionGeneration,previous.session_generation);
 assert.match(observed.resourceKey,/^gemini-profile:[a-f0-9]{64}$/);
 report.configuration_generation=observed.configurationGeneration;
 report.session_generation=observed.sessionGeneration;report.resource_key=observed.resourceKey;
 reference={engine:'agentic',attemptId:randomUUID(),resourceKey:observed.resourceKey,
 sessionGeneration:observed.sessionGeneration,operationRef:null};reference.operationRef=reference.attemptId;
 report.attempt_id=reference.attemptId;
 const nonce='NODIA_PLAIN_'+randomBytes(16).toString('hex');
 const digest=value=>createHash('sha256').update(value).digest('hex');
 report.expected_answer_sha256=digest(nonce);
 report.phase='plain_turn';save();
 const reply=await adapter.execute({attemptId:reference.attemptId,selection,
 canonicalPrompt:'Control sintético de texto. Sin archivos ni herramientas de negocio. Devuelve exactamente '+JSON.stringify({kind:'answer',text:nonce}),
 resourceKey:observed.resourceKey,sessionGeneration:observed.sessionGeneration,
 configurationGeneration:observed.configurationGeneration,deadlineAt:new Date(Date.now()+120000)},AbortSignal.timeout(125000));
 proof=reply.terminalProof;report.nonce_verified=reply.kind==='answer'&&digest(reply.text)===report.expected_answer_sha256;
 report.phase='acknowledge';save();
 await reconciliation.acknowledge(proof,AbortSignal.timeout(15000));
 report.native_pending_identity=false;report.terminal_proof_acknowledged=true;report.native_outcome=proof.outcome;
 report.status=report.nonce_verified?'passed':'semantic_mismatch_acknowledged';
}catch(error){
 report.status=report.provider_dispatch_requests?'failed_no_replay':'rejected_before_turn';
 report.error_category=typeof error?.code==='string'&&/^[a-z0-9_:-]{1,100}$/i.test(error.code)?error.code:'control_error';
 if(report.provider_dispatch_requests&&reference&&!report.terminal_proof_acknowledged){
  try{
   report.phase='reconcile';save();
   proof??=await reconciliation.reconcile(reference,AbortSignal.timeout(15000));
   await reconciliation.acknowledge(proof,AbortSignal.timeout(15000));
   report.native_outcome=proof.outcome;report.terminal_proof_acknowledged=true;report.native_pending_identity=false;
  }catch{report.reconciliation_pending=true;}
 }
}finally{
 await source.destroy();report.finished_at_utc=new Date().toISOString();save();
}
process.exitCode=report.status==='passed'?0:1;
'''


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def inspect_epoch():
    result = subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'],
                            capture_output=True, check=True, timeout=15)
    item = json.loads(result.stdout)[0]
    assert item['State']['Running'] is True
    return {'container_id': item['Id'], 'container_started_at_utc': item['State']['StartedAt'],
            'candidate_image_id': item['Image']}


def main():
    assert len(sys.argv) == 7 and sys.argv[6] == '--execute-one-live'
    candidate, expected, previous, activation, api_env = sys.argv[1:6]
    candidate, previous, activation, api_env = map(Path, (candidate, previous, activation, api_env))
    assert candidate.is_absolute() and candidate.resolve().is_relative_to('/opt/nodia/verification')
    assert previous == Path('/opt/nodia/verification/ai38-mcp-r01-live01/public-report.json')
    assert activation == Path('/opt/nodia/verification/ai38-mcp-r01-activation/activate.json')
    assert api_env.is_absolute() and api_env.is_file() and not (candidate / '.env').exists()
    manifest_raw = (candidate / 'manifest.json').read_bytes()
    assert sha(manifest_raw) == expected
    for name, digest in json.loads(manifest_raw)['files'].items():
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and '..' not in relative.parts
        assert sha((candidate / relative).read_bytes()) == digest
    active = json.loads(activation.read_text(encoding='utf-8'))
    prior = json.loads(previous.read_text(encoding='utf-8'))
    assert active['status'] == 'passed' and prior['native_pending_identity'] is False
    assert prior['native_result']['diagnostics']['callbacks'] == 0
    epoch = inspect_epoch()
    assert all(epoch[key] == active[key] for key in epoch)
    assert datetime.fromisoformat(prior['started_at_utc']) >= datetime.fromisoformat(active['finished_at_utc'])
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-mcp-r01-plain01')
    work.mkdir(mode=0o700, exist_ok=False)
    started = datetime.now(timezone.utc).isoformat()
    result_path = work / 'private-native-report.json'
    public = {'stage': 'AI-38-MCP-R01', 'scope': 'one_Agentic_text_control_without_MCP',
              'status': 'running', 'started_at_utc': started, 'epoch_before': epoch,
              'maximum_provider_dispatch_requests': 1, 'automatic_inference_retries': 0,
              'previous_resource_key_compared': False, 'driver_sha256': sha(Path(__file__).read_bytes()),
              'candidate_manifest_sha256': expected, 'prior_report_sha256': sha(previous.read_bytes()),
              'activation_report_sha256': sha(activation.read_bytes())}
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(Path.home()),
                   'NODE_ENV': 'test', 'RATE_LIMIT_STORAGE': 'memory', 'DOTENV_CONFIG_PATH': '/dev/null'}
    with (work / 'private-stdout.log').open('xb') as out, (work / 'private-stderr.log').open('xb') as err:
        result = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-', str(candidate),
                                 str(api_env), str(previous), str(result_path)], input=NODE_CONTROL.encode(),
                                cwd=candidate, env=environment, stdout=out, stderr=err, timeout=240)
    public['exit_code'] = result.returncode
    public['native_result'] = json.loads(result_path.read_text(encoding='utf-8')) if result_path.exists() else None
    public['epoch_after'] = inspect_epoch()
    public['same_epoch'] = public['epoch_after'] == epoch
    public['status'] = 'passed' if result.returncode == 0 and public['same_epoch'] else 'control_incomplete_no_replay'
    public['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    with (work / 'public-report.json').open('x', encoding='utf-8') as stream:
        json.dump(public, stream, indent=2)
        stream.write('\n')
    print(json.dumps(public, indent=2))
    return 0 if public['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
