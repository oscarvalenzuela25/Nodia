// Exact existing Gemini job. No AppModule, SDK observation, generation or RunStage.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fstatSync,writeSync,fsyncSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const ROOT='/opt/nodia/releases/nodia-server-ai40-r08';
const MANIFEST='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc';
const CONFIG='/opt/nodia/releases/nodia-server-ai15-20261016/.env';
const CONFIG_SHA='63bc843ea102795ffee40cf5d3a7bbe42bb71ea40795b30897c10872ca129105';
const CHAT='ec626b72-1f32-4486-9f3a-8263cffce267',RUN='814bc560-a61f-4365-95fa-7c6a13099067';
const JOB='c2a3e7dc-330b-4bd4-a88f-ea1678dea581',ATTEMPT='c6cc8739-7de7-4c13-a5c9-6b230fb3b1de';
const SESSION='a1a03da0914644f89de106905d1c3257';
const RESOURCE='gemini-profile:433e10d914ee92a1484882d4a4860fcde80cd41f4abc6fb53ce17f97f0904e7d';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [mode,descriptorPin]=process.argv.slice(2);
assert.ok(['snapshot','reconcile','cleanup'].includes(mode));
if(mode!=='snapshot')assert.match(descriptorPin,/^[a-f0-9]{64}$/u);
const require=createRequire(ROOT+'/package.json');require('reflect-metadata');
assert.equal(process.getuid(),0);
const configBytes=await readFile(CONFIG);assert.equal(sha(configBytes),CONFIG_SHA);
Object.assign(process.env,require('dotenv').parse(configBytes));
Object.assign(process.env,{DOTENV_CONFIG_PATH:CONFIG,NODE_ENV:'test',RATE_LIMIT_STORAGE:'memory'});
const manifestBytes=await readFile(ROOT+'/release-manifest.json');assert.equal(sha(manifestBytes),MANIFEST);
const manifest=JSON.parse(manifestBytes);
const load=async(path,name)=>{assert.equal(sha(await readFile(ROOT+'/dist/'+path+'.js')),manifest.files['dist/'+path+'.js']);return(await import(pathToFileURL(ROOT+'/dist/'+path+'.js').href))[name];};
let witnessFD;
if(mode!=='snapshot'){
 witnessFD=Number(process.env.NODIA_AI_RECOVERY_WITNESS_FD);assert.ok(Number.isInteger(witnessFD)&&witnessFD>=3);
 const s=fstatSync(witnessFD);assert.ok(s.isFile()&&s.uid===0&&s.nlink===1&&(s.mode&0o777)===0o600&&s.size===0);
}
process.setgid(10000);process.setuid(10000);
const {DataSource}=require('typeorm');
let db,terminal,terminalFsynced=false,acknowledged=false,reconcileCalls=0,ackCalls=0;
const witnessErrors=[];
const safeProof=p=>({engine:p.engine,attempt_id:p.attemptId,resource_key:p.resourceKey,session_generation:p.sessionGeneration,
 operation_ref:p.operationRef,terminal_proof_id:p.terminalProofId,process_closed:p.processClosed,outcome:p.outcome,observed_at:p.observedAt.toISOString()});
function persist(value){
 // A complete proof must be durable before allowing deletion of its native file.
 try{const frame=Buffer.from(JSON.stringify(value)+'\n');let offset=0;
  while(offset<frame.length){const written=writeSync(witnessFD,frame,offset,frame.length-offset);assert.ok(Number.isInteger(written)&&written>0&&written<=frame.length-offset);offset+=written;}
  fsyncSync(witnessFD);return true;
 }catch{witnessErrors.push('witness_write_or_fsync_failed');return false;}
}
try{
 db=await new DataSource({type:'postgres',host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT),database:process.env.POSTGRES_DB,
  username:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,ssl:process.env.POSTGRES_SSL==='true'?{rejectUnauthorized:false}:undefined,
  synchronize:false,migrationsRun:false,installExtensions:false,logging:false,entities:[ROOT+'/dist/**/*.entity.js'],
  extra:{connectionTimeoutMillis:5000,statement_timeout:15000,...(mode==='snapshot'?{options:'-c default_transaction_read_only=on'}:{})}}).initialize();
 const Auth=await load('nodia-ai/nodia-ai-authorization.service','NodiaAiAuthorizationService');
 const Authorize=await load('nodia-ai/use-case/authorize-nodia-ai.use-case','AuthorizeNodiaAiUseCase');
 const Runtime=await load('nodia-ai-runtime/nodia-ai-runtime.service','NodiaAiRuntimeService');
 const Reconcile=await load('nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case','ReconcileNodiaAiRuntimeUseCase');
 const Cleanup=await load('nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case','CleanupNodiaAiRuntimeProofsUseCase');
 const readRequest=await load('nodia-ai-runtime/use-case/runtime-reconciliation-descriptor','readRuntimeProofRequest');
 const readTerminal=await load('nodia-ai-runtime/use-case/runtime-reconciliation-descriptor','readTerminalProof');
 const Validate=await load('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case','ValidateNodiaAiRuntimePolicyUseCase');
 const policyPath=ROOT+'/dist/nodia-ai-runtime/config/runtime-policy.json';const policyBytes=await readFile(policyPath);
 assert.equal(sha(policyBytes),manifest.files['dist/nodia-ai-runtime/config/runtime-policy.json']);const policy=new Validate().execute(JSON.parse(policyBytes));
 const authorize=new Authorize(new Auth(db));
 const [grant]=await db.query('SELECT actor_id::text,session_public_id::text FROM nodia_ai_execution_grants WHERE run_id=$1',['8e4c0db1-6b07-4524-a1cf-f33d09210766']);
 assert.equal(grant.actor_id,'1');assert.match(grant.session_public_id,/^[a-f0-9-]{36}$/u);
 const identity={userId:'1',sessionId:grant.session_public_id};assert.equal((await authorize.execute(identity)).isSuperAdmin,true);
 const [job]=await db.query('SELECT * FROM nodia_ai_jobs WHERE id=$1',[JOB]);
 assert.ok(job);assert.equal(job.conversation_id,CHAT);assert.equal(job.run_id,RUN);assert.equal(job.recovery_descriptor.schema_version,1);
 const cleanupPending=job.kind==='reconcile'&&job.stage_key==='reconcile_ack';
 if(cleanupPending){assert.ok(['waiting','failed','leased'].includes(job.state));assert.ok(BigInt(job.fence)>=3n);
  if(job.state==='leased'){const [lease]=await db.query('SELECT lease_until<=clock_timestamp() expired FROM nodia_ai_jobs WHERE id=$1',[JOB]);assert.equal(lease.expired,true);}
 }else{assert.equal(job.kind,'turn');assert.equal(job.state,'unknown');assert.equal(String(job.fence),'2');}
 if(mode==='reconcile')assert.equal(cleanupPending,false);if(mode==='cleanup')assert.equal(cleanupPending,true);
 const descriptorSha=sha(JSON.stringify(job.recovery_descriptor));if(mode!=='snapshot')assert.equal(descriptorSha,descriptorPin);
 const request=readRequest(job.recovery_descriptor);
 assert.deepEqual(request,{engine:'agentic',attemptId:ATTEMPT,resourceKey:RESOURCE,sessionGeneration:SESSION,operationRef:ATTEMPT});
 const [attempt]=await db.query('SELECT phase,job_id,fence::text,runtime_fence::text,runtime_resource_key,external_operation_ref,ended_at FROM nodia_ai_job_attempts WHERE id=$1',[ATTEMPT]);
 assert.equal(attempt.phase,cleanupPending?'reconciled':'unknown');assert.equal(attempt.job_id,JOB);assert.equal(attempt.fence,'2');assert.equal(attempt.runtime_fence,'11');assert.equal(attempt.runtime_resource_key,RESOURCE);assert.equal(attempt.external_operation_ref,ATTEMPT);assert.ok(attempt.ended_at);
 const [slot]=await db.query('SELECT state,fence::text,job_id,external_operation_ref FROM nodia_ai_runtime_slots WHERE resource_key=$1',[RESOURCE]);
 assert.deepEqual(slot,cleanupPending?{state:'free',fence:'12',job_id:null,external_operation_ref:null}:{state:'unknown',fence:'11',job_id:JOB,external_operation_ref:ATTEMPT});
 const cleanupProof=cleanupPending?readTerminal(job.recovery_descriptor):undefined;
 if(cleanupProof){assert.deepEqual({engine:cleanupProof.engine,attemptId:cleanupProof.attemptId,resourceKey:cleanupProof.resourceKey,sessionGeneration:cleanupProof.sessionGeneration,operationRef:cleanupProof.operationRef},request);
  assert.equal(cleanupProof.outcome,'abandoned_unknown');assert.equal(cleanupProof.processClosed,true);}
 async function snapshot(){return db.transaction(async m=>{await m.query('SET TRANSACTION READ ONLY');
  const [counts]=await m.query(`SELECT (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,(SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,(SELECT sum(provider_dispatches_used)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,(SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments,(SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,(SELECT count(*)::int FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1 AND s.minimal_receipt IS NOT NULL) effect_receipts`,[CHAT]);
  const [domain]=await m.query(`SELECT (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM nodia_ai_preferences p WHERE owner_id=1) preferences_sha256,(SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) finance_sha256`);
  const [chat]=await m.query('SELECT owner_id::text,selected_connection_id::text connection_id,selected_mode mode,selected_model_id model_id,selected_effort_id effort_id,routing_enabled,routing_revision FROM nodia_ai_conversations WHERE id=$1',[CHAT]);assert.equal(chat.owner_id,'1');
  const providers=await m.query('SELECT row_to_json(p) value FROM ai_providers p ORDER BY id');
  return{counts,domain,chat,provider_configuration_sha256:sha(JSON.stringify(providers))};});}
 const before=await snapshot();assert.deepEqual(before.counts,{messages:50,runs:27,dispatches:39,attachments:6,executions:2,effect_receipts:3});
 assert.deepEqual(before.domain,{preferences_sha256:'b3cffd91df324d06e640ff3c9e169db2d2fb5a24692ff11dbbc2cc7297443237',finance_sha256:'5335e312c7b542552f924cf266fc007ff1a3691e522e6c682bb20e374b5b7871'});
 const [pending]=await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state<>'done' AND id<>$1) other_jobs,(SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL AND (NOT $3::boolean OR job_id<>$1 OR stage_key<>'reconcile_ack')) open_attempts,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free' AND resource_key<>$2) other_slots`,[JOB,RESOURCE,cleanupPending]);assert.deepEqual(pending,{other_jobs:0,open_attempts:0,other_slots:0});
 const common={schema:'nodia-ai-ai40-Gemini-original-native-recovery-v1',mode,release_manifest_sha256:MANIFEST,config_sha256:CONFIG_SHA,
  job_id:JOB,run_id:RUN,attempt_id:ATTEMPT,descriptor_sha256:descriptorSha,job_fence:job.fence,runtime_fence:'11',authority_source:'persisted_own_run_grant_reauthorized_current_SA',actor_id:'1',actor_session_emitted:false,before,pending,provider_generations:0,direct_provider_observations:0,business_SQL_writes:0};
 if(mode==='snapshot'){console.log(JSON.stringify({...common,status:cleanupPending?'ready_cleanup_no_mutation':'ready_no_mutation',cleanup_terminal:cleanupProof?safeProof(cleanupProof):null,Native_calls:0,configured_SQL_writes:0}));}
 else{
  const Transport=await load('nodia-ai-adapter/nodia-ai-adapter.service','NodiaAiAdapterTransport');
  const Port=await load('nodia-ai-adapter/use-case/reconcile-gemini-nodia-ai-runtime.use-case','ReconcileGeminiNodiaAiRuntimeUseCase');
  const native=new Port(new Transport());
  const observed={
   reconcile(...args){if(mode==='cleanup')throw Object.assign(new Error(),{code:'cleanup_must_not_reconcile_native_again'});reconcileCalls++;const promise=Reflect.apply(native.reconcile,native,args);promise.then(proof=>{terminal=safeProof(proof);terminalFsynced=persist({event:'terminal_observed',descriptor_sha256:descriptorSha,job_fence:job.fence,runtime_fence:'11',proof:terminal});}).catch(()=>{});return promise;},
   acknowledge(...args){
    // Operator precondition, not a substituted native response: leave cleanup
    // pending when the sole terminal witness cannot safely survive Native ACK.
    if(!terminalFsynced||witnessErrors.length||JSON.stringify(safeProof(args[0]))!==JSON.stringify(terminal)
      ||!persist({event:'before_acknowledge',descriptor_sha256:descriptorSha,proof:terminal}))
     throw Object.assign(new Error(),{code:'witness_durability_unverified'});
    ackCalls++;const promise=Reflect.apply(native.acknowledge,native,args);promise.then(()=>{acknowledged=true;persist({event:'acknowledged',proof:safeProof(args[0]),evidence:'compiled NativePort fulfilled after strict acknowledged:true HTTP body validation'});}).catch(()=>{});return promise;
   },
  };
  if(mode==='cleanup'){
   // This descriptor was durably committed by the first ReconcileUC before
   // Native ACK. Hash/scope pin it, then fsync a new operator witness before
   // using the compiled UC's existing authorized cleanup-only fast path.
   terminal=safeProof(cleanupProof);terminalFsynced=persist({event:'terminal_from_durable_cleanup_descriptor',descriptor_sha256:descriptorSha,job_fence:job.fence,origin_runtime_fence:'11',proof:terminal});
   if(!terminalFsynced)throw Object.assign(new Error(),{code:'witness_durability_unverified'});
  }
  const runtime=new Runtime(db);const cleanup=new Cleanup(runtime,observed,policy);const uc=new Reconcile(runtime,authorize,observed,cleanup,policy);
  const result=await uc.execute(identity,JOB);assert.equal(result.resolved,true);assert.equal(result.cleanup_pending,false);
  assert.equal(reconcileCalls,mode==='cleanup'?0:1);assert.equal(ackCalls,1);assert.equal(acknowledged,true);assert.equal(terminal.outcome,'abandoned_unknown');assert.equal(terminal.process_closed,true);assert.deepEqual(witnessErrors,[]);
  const after=await snapshot();assert.deepEqual(after,before);
  assert.equal((await db.query('SELECT id FROM nodia_ai_jobs WHERE id=$1',[JOB])).length,0);
  const [run]=await db.query('SELECT state,error_code FROM nodia_ai_runs WHERE id=$1',[RUN]);assert.deepEqual(run,{state:'failed',error_code:'nodia_ai:outcome_unknown'});
  const [finalSlot]=await db.query('SELECT state,external_operation_ref FROM nodia_ai_runtime_slots WHERE resource_key=$1',[RESOURCE]);assert.deepEqual(finalSlot,{state:'free',external_operation_ref:null});
  const [chat]=await db.query('SELECT active_job_id FROM nodia_ai_conversations WHERE id=$1',[CHAT]);assert.equal(chat.active_job_id,null);
  const [remaining]=await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state<>'done') jobs,(SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) attempts,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') slots`);assert.deepEqual(remaining,{jobs:0,attempts:0,slots:0});
  persist({event:'compiled_reconcile_and_cleanup_completed',result,proof:terminal,acknowledged:true,remaining});assert.deepEqual(witnessErrors,[]);
  console.log(JSON.stringify({...common,status:mode==='cleanup'?'cleanup_and_ACK_verified':'reconciled_and_ACK_verified',result,after,terminal,acknowledged:true,reconcile_calls:reconcileCalls,acknowledge_calls:ackCalls,remaining,final_run:run,job_absent:true,chat_active_job_cleared:true,technical_SQL_writes:mode==='cleanup'?'compiled ReconcileUC authorized cleanup-only fast path + CleanupUC':'compiled ReconcileUC and CleanupUC only',ACK_source:'compiled NativePort response validation, not file absence'}));
 }
}catch(error){console.log(JSON.stringify({schema:'nodia-ai-ai40-Gemini-original-native-recovery-v1',mode,status:'failed_closed',error_type:error?.constructor?.name,
 code:typeof error?.code==='string'&&/^[A-Za-z0-9_:.-]{1,100}$/u.test(error.code)?error.code:null,terminal:terminal??null,terminal_witness_fsynced:terminalFsynced,acknowledged,reconcile_calls:reconcileCalls,acknowledge_calls:ackCalls,witness_errors:witnessErrors,
 cleanup_recovery_hint:'Keep API/worker claims closed. Inspect exact job and persisted terminal witness; if reconcile_ack, use separately reviewed compiled CleanupUC/manual with readTerminalProof, never rerun this unknown-turn command or infer ACK from absence.',
 provider_generations:0,direct_provider_observations:0,private_error_emitted:false}));process.exitCode=1;}
finally{if(db?.isInitialized)await db.destroy();}
