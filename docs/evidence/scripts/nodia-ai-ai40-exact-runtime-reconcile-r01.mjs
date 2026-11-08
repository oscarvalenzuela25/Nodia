// One exact administrative recovery. No inference, readiness override or raw SQL release.
import assert from 'node:assert/strict';
import {readFile,open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const ROOT='/opt/nodia/releases/nodia-server-ai40-r05';
const JOB='e0b2c06f-db4f-4ac7-9583-96bbabd909ad',RUN='6dbc2faa-42ae-443d-a26d-828a946e7847',ATTEMPT='da1e950d-6b98-490c-bd4d-fc075a8dea9c',CHAT='ec626b72-1f32-4486-9f3a-8263cffce267';
const SESSION='2a552f6b8a434521b8b438a8f7b01dca', TERMINAL='e9e82e28-8e3a-410e-93e0-0927677fe66e';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [mode,descriptorPin]=process.argv.slice(2);assert.ok(['readiness','execute_once'].includes(mode));
if(mode==='execute_once')assert.match(descriptorPin,/^[a-f0-9]{64}$/u);
const require=createRequire(ROOT+'/package.json');
const cfg=require('dotenv').parse(await readFile(process.env.DOTENV_CONFIG_PATH));
const effective={...cfg,...process.env};
assert.equal(effective.NODIA_CODEX_PROFILE_ROOT,'/var/lib/nodia/codex');
process.env.NODIA_CODEX_PROFILE_ROOT=effective.NODIA_CODEX_PROFILE_ROOT;
const {DataSource}=require('typeorm');
const mb=await readFile(ROOT+'/release-manifest.json');assert.equal(sha(mb),'07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd');
const manifest=JSON.parse(mb);
const load=async(path,name)=>{assert.equal(sha(await readFile(ROOT+'/dist/'+path+'.js')),manifest.files['dist/'+path+'.js']);return(await import(pathToFileURL(ROOT+'/dist/'+path+'.js').href))[name];};
// Reduce privileges before touching the native journal. No native create/observe method is called.
assert.equal(process.getuid(),0);process.setgid(10000);process.setuid(10000);
const policyRaw=await readFile(ROOT+'/dist/nodia-ai-runtime/config/runtime-policy.json');assert.equal(sha(policyRaw),manifest.files['dist/nodia-ai-runtime/config/runtime-policy.json']);
const Validate=await load('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case','ValidateNodiaAiRuntimePolicyUseCase');const policy=new Validate().execute(JSON.parse(policyRaw));
let db,nativeRuntime;
try{
 db=await new DataSource({type:'postgres',host:effective.POSTGRES_HOST,port:Number(effective.POSTGRES_PORT),database:effective.POSTGRES_DB,username:effective.POSTGRES_USER,password:effective.POSTGRES_PASSWORD,ssl:effective.POSTGRES_SSL==='true'?{rejectUnauthorized:false}:undefined,synchronize:false,migrationsRun:false,logging:false,entities:[ROOT+'/dist/**/*.entity.js'],extra:{connectionTimeoutMillis:5000,statement_timeout:15000}}).initialize();
 const Runtime=await load('nodia-ai-runtime/nodia-ai-runtime.service','NodiaAiRuntimeService');
 const AuthService=await load('nodia-ai/nodia-ai-authorization.service','NodiaAiAuthorizationService');
 const Authorize=await load('nodia-ai/use-case/authorize-nodia-ai.use-case','AuthorizeNodiaAiUseCase');
 const Reconcile=await load('nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case','ReconcileNodiaAiRuntimeUseCase');
 const Cleanup=await load('nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case','CleanupNodiaAiRuntimeProofsUseCase');
 const CodexService=await load('common/ai/codex/codex-runtime.service','CodexRuntimeService');
 const ChatRuntime=await load('common/ai/codex/codex-chat-runtime','CodexChatRuntime');
 const NativePort=await load('nodia-ai-adapter/use-case/reconcile-codex-nodia-ai-runtime.use-case','ReconcileCodexNodiaAiRuntimeUseCase');
 const Journal=await load('common/ai/codex/codex-chat-journal','CodexChatJournal');
 const readRequest=await load('nodia-ai-runtime/use-case/runtime-reconciliation-descriptor','readRuntimeProofRequest');
 const sameProcess=await load('common/ai/codex/codex-process-ownership','sameCodexProcess');
 const groupEmpty=await load('common/ai/codex/codex-process-ownership','assertCodexGroupEmpty');
 const authorize=new Authorize(new AuthService(db));
 const [grant]=await db.query('SELECT actor_id::text,session_public_id::text FROM nodia_ai_execution_grants WHERE run_id=$1',[RUN]);
 assert.ok(grant);assert.equal(grant.actor_id,'1');assert.match(grant.session_public_id,/^[a-f0-9-]{36}$/u);
 // Existing persisted actor/session, never a fabricated session or token read.
 const identity={userId:grant.actor_id,sessionId:grant.session_public_id};
 assert.equal((await authorize.execute(identity)).isSuperAdmin,true);
 const [job]=await db.query('SELECT * FROM nodia_ai_jobs WHERE id=$1',[JOB]);assert.ok(job);assert.equal(job.kind,'turn');assert.equal(job.state,'unknown');assert.equal(job.fence,'2');assert.equal(job.run_id,RUN);assert.equal(job.conversation_id,CHAT);assert.equal(job.recovery_descriptor.schema_version,2);
 const descriptorSha=sha(JSON.stringify(job.recovery_descriptor));if(mode==='execute_once')assert.equal(descriptorSha,descriptorPin);
 const request=readRequest(job.recovery_descriptor);assert.equal(request.attemptId,ATTEMPT);assert.equal(request.operationRef,ATTEMPT);assert.equal(request.sessionGeneration,SESSION);assert.equal(request.adapterIdentity.connectionId,'1');
 const [slot]=await db.query('SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1',[request.resourceKey]);assert.equal(slot.state,'unknown');assert.equal(slot.fence,'11');assert.equal(slot.job_id,JOB);assert.equal(slot.external_operation_ref,ATTEMPT);
 const [attempt]=await db.query('SELECT * FROM nodia_ai_job_attempts WHERE id=$1',[ATTEMPT]);assert.equal(attempt.phase,'unknown');assert.equal(attempt.job_id,JOB);assert.equal(attempt.runtime_fence,'11');assert.equal(attempt.external_operation_ref,ATTEMPT);
 const jFile='/var/lib/nodia/codex/chat-jobs/'+ATTEMPT+'.json';
 const bytes=await readFile(jFile);const journal=new Journal();const record=journal.decode(JSON.parse(bytes));assert.equal(record.identity.attemptId,ATTEMPT);assert.equal(record.identity.sessionGeneration,SESSION);assert.deepEqual(record.identity,request);assert.equal(record.state,'abandoned_unknown');assert.equal(record.terminalProofId,TERMINAL);assert.equal(record.acknowledged,false);assert.equal(record.unforwardedRequests,0);assert.equal(await sameProcess(record.native),false);await groupEmpty(record.native.group);
 async function snapshot(){return db.transaction(async m=>{await m.query('SET TRANSACTION READ ONLY');const [c]=await m.query(`SELECT (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,(SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,(SELECT sum(provider_dispatches_used)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,(SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments,(SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,(SELECT count(*)::int FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1 AND s.minimal_receipt IS NOT NULL) effect_receipts,(SELECT count(*)::int FROM finance_movements WHERE name=$2 AND id=2) historical_movement2`,[CHAT,'AI40-UI-CODEX-R01']);const providers=await m.query('SELECT row_to_json(p) value FROM ai_providers p ORDER BY id');return{counts:c,provider_configuration_sha256:sha(JSON.stringify(providers))};});}
 const before=await snapshot();assert.deepEqual(before.counts,{messages:20,runs:11,dispatches:11,attachments:5,executions:1,effect_receipts:1,historical_movement2:1});
 const common={schema:'nodia-ai-ai40-exact-runtime-reconciliation-v1',mode,observed_at_VM_utc:new Date().toISOString(),release_manifest_sha256:sha(mb),job_id:JOB,run_id:RUN,attempt_id:ATTEMPT,descriptor_sha256:descriptorSha,journal_sha256_before:sha(bytes),native_terminal_proof_id:TERMINAL,native_outcome:'abandoned_unknown',native_process_closed:true,actor_source:'persisted_run_grant_revalidated_by_native_authorization',actor_id:'1',actor_super_admin:true,actor_session_emitted:false,before,provider_generations:0,provider_observations:0,business_SQL_writes:0,readiness_overrides:0,credential_content_emitted:false};
 if(mode==='readiness'){console.log(JSON.stringify({...common,status:'ready_no_mutation',configured_SQL_writes:0,native_ACK_writes:0}));}
 else{
  nativeRuntime=new CodexService();const chatRuntime=new ChatRuntime(nativeRuntime,journal);const native=new NativePort(chatRuntime,db);const runtime=new Runtime(db);const cleanup=new Cleanup(runtime,native,policy);const uc=new Reconcile(runtime,authorize,native,cleanup,policy);
  const result=await uc.execute(identity,JOB);assert.equal(result.resolved,true);assert.equal(result.cleanup_pending,false);
  const after=await snapshot();assert.deepEqual(after,before);
  const [finalJob]=await db.query('SELECT kind,state,stage_key FROM nodia_ai_jobs WHERE id=$1',[JOB]);assert.equal(finalJob.kind,'reconcile');assert.equal(finalJob.state,'done');
  const [finalRun]=await db.query('SELECT state,error_code FROM nodia_ai_runs WHERE id=$1',[RUN]);assert.equal(finalRun.state,'failed');assert.equal(finalRun.error_code,'nodia_ai:outcome_unknown');
  const [finalChat]=await db.query('SELECT active_job_id FROM nodia_ai_conversations WHERE id=$1',[CHAT]);assert.equal(finalChat.active_job_id,null);
  const [finalSlot]=await db.query('SELECT state,external_operation_ref FROM nodia_ai_runtime_slots WHERE resource_key=$1',[request.resourceKey]);assert.equal(finalSlot.state,'free');assert.equal(finalSlot.external_operation_ref,null);
  const acknowledged=journal.decode(JSON.parse(await readFile(jFile)));assert.equal(acknowledged.acknowledged,true);assert.equal(acknowledged.terminalProofId,TERMINAL);assert.equal(await sameProcess(acknowledged.native),false);await groupEmpty(acknowledged.native.group);
  console.log(JSON.stringify({...common,status:'reconciled_exact_identity',result,after,final_job:finalJob,final_run:finalRun,final_slot:finalSlot,chat_active_job_cleared:true,acknowledged:true,journal_sha256_after:sha(await readFile(jFile)),technical_SQL_writes:'only_compiled_reconcile_and_cleanup_use_cases',native_ACK_writes:1,HTTP_endpoint_available:false,UI_reconcile_control_verified:false}));
 }
}catch(error){console.log(JSON.stringify({schema:'nodia-ai-ai40-exact-runtime-reconciliation-v1',status:'operator_failed',mode,error_type:error?.constructor?.name,code:typeof error?.code==='string'&&/^[0-9A-Z]{5}$/u.test(error.code)?error.code:null,assertion:typeof error?.code==='string'&&error.code==='ERR_ASSERTION',private_error_emitted:false,provider_generations:0,provider_observations:0}));process.exitCode=1;}
finally{await nativeRuntime?.onModuleDestroy();if(db?.isInitialized)await db.destroy();}
