// Exact recovery of the retained failed exclusion fixture. No RunStage or generation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,lstat,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const ROOT='/opt/nodia/releases/nodia-server-ai40-r07',MANIFEST='1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476';
const JOB='eda1889e-e710-4b2e-ab14-e094a6420850',RUN='b4815402-d9dd-4afd-8e06-e486b975edf9',ATTEMPT='caa4505e-6566-470a-8438-fdcb64dc67b6';
const TERMINAL='ff69868c-11eb-4e98-8c9e-eee9a017f497',LOGIN='8ab7c99a-87f6-4c2e-849b-dabea8974d7d';
const PROFILE='/var/lib/nodia/codex',RESOURCE='codex-profile:c17db95bfdfba4ffee919e03da6cc09443c0c337a66ec234c4fef830ae2507f6';
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.getuid(),10000);
const chunks=[];for await(const b of process.stdin)chunks.push(b);const input=JSON.parse(Buffer.concat(chunks));
assert.deepEqual(Object.keys(input).sort(),['container','execute','options']);assert.equal(input.container,'template_ai40_3503696_c1fef0e4');assert.equal(typeof input.execute,'boolean');
assert.equal(input.options.host,'127.0.0.1');assert.equal(input.options.database,'ai40');assert.equal(input.options.username,'ai40');assert.ok(input.options.port>1024&&input.options.port!==5432);
const manifestBytes=await readFile(ROOT+'/release-manifest.json');assert.equal(sha(manifestBytes),MANIFEST);const manifest=JSON.parse(manifestBytes);
const load=async(name,key)=>{const path='dist/'+name+'.js';assert.equal(sha(await readFile(ROOT+'/'+path)),manifest.files[path]);return(await import(pathToFileURL(ROOT+'/'+path)))[key];};
const require=createRequire(ROOT+'/package.json');require('reflect-metadata');const {DataSource}=require('typeorm');const {Logger}=require('@nestjs/common');Logger.overrideLogger(false);
process.env.NODIA_CODEX_ENABLED='true';process.env.NODIA_CODEX_PROFILE_ROOT=PROFILE;
process.env.AUTH_JWT_SECRET=randomUUID()+randomUUID();process.env.GOOGLE_CLIENT_ID='synthetic-ai40.apps.googleusercontent.com';process.env.AUTH_ALLOWED_ORIGINS='http://127.0.0.1';
const [{Test},{TypeOrmModule}]=[require('@nestjs/testing'),require('@nestjs/typeorm')];
const [Conversation,Processing,Runtime,Users,Redis,Authorize,Reconcile,Journal,sameProcess,groupEmpty]=await Promise.all([
 ['nodia-ai-conversation/nodia-ai-conversation.module','NodiaAiConversationModule'],['nodia-ai-context/nodia-ai-processing.module','NodiaAiProcessingModule'],
 ['nodia-ai-runtime/nodia-ai-runtime.module','NodiaAiRuntimeModule'],['user/user.module','UserModule'],['common/redis/redis.service','RedisService'],
 ['nodia-ai/use-case/authorize-nodia-ai.use-case','AuthorizeNodiaAiUseCase'],['nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case','ReconcileNodiaAiRuntimeUseCase'],
 ['common/ai/codex/codex-chat-journal','CodexChatJournal'],['common/ai/codex/codex-process-ownership','sameCodexProcess'],['common/ai/codex/codex-process-ownership','assertCodexGroupEmpty']
].map(([file,name])=>load(file,name)));
const options={...input.options,type:'postgres',entities:[ROOT+'/dist/**/*.entity.js'],migrationsRun:false,synchronize:false,installExtensions:false,logging:false,
 extra:{max:2,statement_timeout:5000,connectionTimeoutMillis:5000,...(!input.execute?{options:'-c default_transaction_read_only=on'}:{})}};
let db,compiled,phase='fixture_database',result=null;
try{
 db=await new DataSource(options).initialize();
 const [job]=await db.query('SELECT id,state,fence,run_id,recovery_descriptor FROM nodia_ai_jobs WHERE id=$1',[JOB]);
 assert.equal(job.state,'unknown');assert.equal(job.fence,'2');assert.equal(job.run_id,RUN);
 assert.deepEqual(job.recovery_descriptor,{schema_version:2,runtime:{engine:'agentic',attempt_id:ATTEMPT,provider_key:'openai',resource_key:RESOURCE,connection_id:'1',operation_ref:ATTEMPT,session_generation:'2a552f6b8a434521b8b438a8f7b01dca',adapter_contract_version:'nodia-ai-codex-chat/1'}});
 const [slot]=await db.query('SELECT state,fence,job_id,external_operation_ref FROM nodia_ai_runtime_slots WHERE resource_key=$1',[RESOURCE]);
 assert.equal(slot.state,'unknown');assert.equal(slot.fence,'1');assert.equal(slot.job_id,JOB);assert.equal(slot.external_operation_ref,ATTEMPT);
 const [run]=await db.query('SELECT state,provider_dispatches_used FROM nodia_ai_runs WHERE id=$1',[RUN]);assert.equal(run.state,'unknown');assert.equal(run.provider_dispatches_used,1);
 const journal=new Journal();const before=journal.decode(JSON.parse(await readFile(PROFILE+'/chat-jobs/'+ATTEMPT+'.json')));
 assert.equal(before.identity.attemptId,ATTEMPT);assert.equal(before.state,'completed');assert.equal(before.terminalProofId,TERMINAL);assert.equal(before.acknowledged,false);
 assert.equal(await sameProcess(before.native),false);await groupEmpty(before.native.group);
 assert.equal(await lstat(PROFILE+'/login-jobs/'+LOGIN+'.json').then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}),false);
 const proofs={};for(const n of ['mcp','mcp-image-png','mcp-image-jpeg','mcp-image-webp'])proofs[n]=sha(await readFile(PROFILE+'/1/nodia-chat-'+n));
 phase='compiled_reconciliation_DI';
 compiled=await Test.createTestingModule({imports:[TypeOrmModule.forRootAsync({useFactory:()=>options,dataSourceFactory:async()=>db}),Conversation,Processing,Runtime,Users]})
 .overrideProvider(Redis).useValue({get:async()=>null,set:async()=>{},del:async()=>{},keys:async()=>[]}).setLogger(false).compile();
 const actor={userId:'3',sessionId:'3ea7a92f-06c0-48b2-9184-ead5b2be7681'};
 const authorized=await db.transaction(m=>compiled.get(Authorize).execute(actor,{},m));assert.equal(authorized.isSuperAdmin,true);
 phase=input.execute?'compiled_exact_reconciliation_once':'preflight_complete';
 if(input.execute){
  result=await compiled.get(Reconcile).execute(actor,JOB);
  assert.equal(result.resolved,true);assert.equal(result.cleanup_pending,false);
  const after=journal.decode(JSON.parse(await readFile(PROFILE+'/chat-jobs/'+ATTEMPT+'.json')));
  assert.equal(after.state,'completed');assert.equal(after.terminalProofId,TERMINAL);assert.equal(after.acknowledged,true);
  assert.equal(after.rpcCount,1);assert.equal(after.unforwardedRequests,0);
  assert.equal(await sameProcess(after.native),false);await groupEmpty(after.native.group);
  const [finalRun]=await db.query('SELECT state,error_code,provider_dispatches_used FROM nodia_ai_runs WHERE id=$1',[RUN]);
  assert.equal(finalRun.state,'failed');assert.equal(finalRun.error_code,'nodia_ai:response_unavailable');assert.equal(finalRun.provider_dispatches_used,1);
  const [counts]=await db.query("SELECT(SELECT count(*)::int FROM nodia_ai_jobs) jobs,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') slots,(SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,(SELECT count(*)::int FROM finance_movements) effects,(SELECT count(*)::int FROM nodia_ai_executions) executions,(SELECT count(*)::int FROM nodia_ai_tool_calls) tools,(SELECT count(*)::int FROM nodia_ai_messages WHERE role='assistant') assistant_messages");
  assert.ok(Object.values(counts).every(v=>v===0));
  const staging={};for(const name of ['nodia-chat-images','nodia-chat-audio']){let entries=[];try{entries=await readdir(PROFILE+'/1/'+name);}catch(e){if(e.code!=='ENOENT')throw e;}assert.equal(entries.length,0);staging[name]={entries:0};}
  for(const [n,pin]of Object.entries(proofs))assert.equal(sha(await readFile(PROFILE+'/1/nodia-chat-'+n)),pin);
  console.log(JSON.stringify({schema:'nodia-ai-ai40-recovery-exact-reconcile-v1',status:'passed',phase,job_id:JOB,run_id:RUN,attempt_id:ATTEMPT,terminal_proof_id:TERMINAL,native_outcome:'completed',exact_completed_ACK:true,rpc_count:after.rpcCount,unforwarded_requests:after.unforwardedRequests,staging,provider_requests:0,RunStage_called:false,executed:true,reconciliation:result,final_run:finalRun,counts,proofs_preserved:proofs,fixture_safe_to_remove:true}));
 }else console.log(JSON.stringify({schema:'nodia-ai-ai40-recovery-exact-reconcile-v1',status:'preflight_passed',phase,job_id:JOB,run_id:RUN,attempt_id:ATTEMPT,terminal_proof_id:TERMINAL,native_outcome:'completed',admin_fixture_authorized:true,provider_requests:0,SQL_writes:0,RunStage_called:false,executed:false,proofs_preserved:proofs,fixture_safe_to_remove:false}));
}catch(error){console.log(JSON.stringify({schema:'nodia-ai-ai40-recovery-exact-reconcile-v1',status:'failed',phase,executed:input.execute,error_class:error.name,error_code:typeof error.code==='string'&&/^[A-Za-z0-9_:]{1,95}$/.test(error.code)?error.code:null,job_id:JOB,run_id:RUN,attempt_id:ATTEMPT,terminal_proof_id:TERMINAL,provider_requests:0,replay_allowed:false,fixture_safe_to_remove:false,private_details_emitted:false}));process.exitCode=1;}
finally{if(compiled)await compiled.close();if(db?.isInitialized)await db.destroy();}
