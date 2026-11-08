"""Exact own UI Stop ledger observation; read-only SQL, no SDK or cancellation."""
import hashlib,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
def load(path,pin,name):
 p=Path(path);assert not p.is_symlink()and hashlib.sha256(p.read_bytes()).hexdigest()==pin
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
g=load('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py','753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58','continuity_guard');g.RELEASE=Path('/opt/nodia/releases/nodia-server-ai40-r08');g.RELEASE_SHA='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc';g.validate_release()
h=load(g.HELPER,g.HELPER_SHA,'continuity_transport');h.ACTIVE=g.RELEASE;h.validate_candidate(g.LEGACY_MANIFEST_SHA)
api=h.service('nodia-api');assert api['pid']==3741433 and api['working_directory']==str(g.RELEASE)
env=h.selected_environment(api['pid'],{'DOTENV_CONFIG_PATH','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL'})
prefix=(h.CANDIDATE.parent/'public-canary-input.mjs').read_text().split('try {',1)[0]
query=r'''
const {NodiaAiAuthorizationService}=await import('/opt/nodia/releases/nodia-server-ai40-r08/dist/nodia-ai/nodia-ai-authorization.service.js');
const {AuthorizeNodiaAiUseCase}=await import('/opt/nodia/releases/nodia-server-ai40-r08/dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js');
const chat='ec626b72-1f32-4486-9f3a-8263cffce267',owner='1',authority='8e4c0db1-6b07-4524-a1cf-f33d09210766',marker='AI40-UI-STOP-R02';
try{await db.initialize();const out=await db.transaction('REPEATABLE READ',async m=>{
 await m.query('SET TRANSACTION READ ONLY');await m.query("SET LOCAL statement_timeout='8s'");
 const grant=await m.query('SELECT g.session_public_id::text FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2',[authority,chat,owner]);if(grant.length!==1)throw Error('owned_grant_missing');
 const actor=await new AuthorizeNodiaAiUseCase(new NodiaAiAuthorizationService(db)).execute({userId:owner,sessionId:grant[0].session_public_id},{},m);if(!actor.isSuperAdmin)throw Error('current_authority_invalid');
 const [conversation]=await m.query('SELECT id,owner_id::text,active_job_id,next_message_seq::text,selected_connection_id::text,selected_mode,selected_model_id,selected_effort_id FROM nodia_ai_conversations WHERE id=$1 AND owner_id=$2',[chat,owner]);if(!conversation)throw Error('own_chat_missing');
 const runs=await m.query(`SELECT r.id,r.state,r.phase,r.revision,r.error_code,r.provider_dispatches_used,r.tool_calls_used,r.mcp_rpc_messages_used,r.created_at,r.completed_at,r.assistant_message_id,u.seq::text user_seq FROM nodia_ai_runs r JOIN nodia_ai_messages u ON u.id=r.user_message_id AND u.conversation_id=r.conversation_id WHERE r.conversation_id=$1 AND r.actor_id=$2 AND u.author_id=$2 AND u.seq>48 AND EXISTS(SELECT 1 FROM nodia_ai_message_parts p WHERE p.message_id=u.id AND p.conversation_id=u.conversation_id AND p.kind='text' AND left(p.text,length($3))=$3) ORDER BY u.seq LIMIT 2`,[chat,owner,marker]);if(runs.length>1)throw Error('marker_run_not_unique');
 const run=runs[0]??null;
 const jobs=run?await m.query('SELECT id,kind,run_id,state,fence::text,stage_key,stage_seq,lease_until,(recovery_descriptor IS NOT NULL) recovery_descriptor_present FROM nodia_ai_jobs WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at LIMIT 4',[run.id,chat]):[];
 const attempts=run?await m.query('SELECT a.id,a.job_id,a.fence::text job_fence,a.runtime_fence::text,a.runtime_resource_key,a.stage_key,a.stage_seq,a.phase,a.external_operation_ref,a.error_code,a.started_at,a.ended_at FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 AND j.conversation_id=$2 ORDER BY a.started_at,a.id LIMIT 24',[run.id,chat]):[];
 const tools=run?await m.query('SELECT id,tool_name,state,arguments_hash,contract_hash,created_at,completed_at FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 12',[run.id,chat]):[];
 const [invariants]=await m.query(`SELECT
 (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,
 (SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,
 (SELECT coalesce(sum(provider_dispatches_used),0)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,
 (SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,
 (SELECT count(*)::int FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1 AND s.minimal_receipt IS NOT NULL) effect_receipts,
 (SELECT count(*)::int FROM nodia_ai_preferences WHERE owner_id=$2) preferences,
 (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM nodia_ai_preferences p WHERE owner_id=$2) preferences_sha256,
 (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) finance_sha256,
 (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN('ready','leased','unknown','waiting')) pending_jobs,
 (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
 (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots`,[chat,owner]);
 return {conversation,marker,after_user_seq:'48',run,jobs,attempts,tools,invariants,job_attempt_association:'SQL join while job present; absence after deletion is not a missing native proof',current_authority_verified:true};});
 console.log(JSON.stringify(out));
}finally{if(db.isInitialized)await db.destroy();}
'''

r=h.command(['/usr/local/bin/node','--input-type=module','-e',prefix+query],cwd=g.RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root',**env},timeout=25)
if r.returncode!=0:
 print(json.dumps({'status':'readonly_query_failed','child_exit':r.returncode,'private_stderr_bytes':len(r.stderr),'private_stderr_emitted':False,'SDK_requests':0,'SQL_writes':0}));sys.exit(1)
assert len(r.stdout)<32768
print(json.dumps({'schema':'nodia-ai-ai40-UI-stop-ledger-readonly-v1','status':'observed_read_only','source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'release_manifest_sha256':g.RELEASE_SHA,'ledger':json.loads(r.stdout),'SDK_requests':0,'SQL_writes':0,'raw_prompts_answers_or_credentials_emitted':False}))
