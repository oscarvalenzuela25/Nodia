import hashlib,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
def load(path,pin,name):
 p=Path(path);assert not p.is_symlink()and hashlib.sha256(p.read_bytes()).hexdigest()==pin
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
g=load('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py','753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58','continuity_guard');g.validate_release()
h=load(g.HELPER,g.HELPER_SHA,'continuity_transport');h.ACTIVE=g.RELEASE;h.validate_candidate(g.LEGACY_MANIFEST_SHA)
api=h.service('nodia-api');assert api['pid']==3630848 and api['working_directory']==str(g.RELEASE)
env=h.selected_environment(api['pid'],{'DOTENV_CONFIG_PATH','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL'})
prefix=(h.CANDIDATE.parent/'public-canary-input.mjs').read_text().split('try {',1)[0]
query=r'''
const {createHash:historyHash}=await import('node:crypto');
const {NodiaAiAuthorizationService}=await import('/opt/nodia/releases/nodia-server-ai40-r07/dist/nodia-ai/nodia-ai-authorization.service.js');
const {AuthorizeNodiaAiUseCase}=await import('/opt/nodia/releases/nodia-server-ai40-r07/dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js');
const conversation='ec626b72-1f32-4486-9f3a-8263cffce267',owner='1',authorityRun='8e4c0db1-6b07-4524-a1cf-f33d09210766';
try{await db.initialize();const result=await db.transaction('REPEATABLE READ',async manager=>{
 await manager.query('SET TRANSACTION READ ONLY');
 const grants=await manager.query(`SELECT g.session_public_id::text FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2`,[authorityRun,conversation,owner]);
 if(grants.length!==1)throw Error('owned_authority_grant_missing');
 const actor=await new AuthorizeNodiaAiUseCase(new NodiaAiAuthorizationService(db)).execute({userId:owner,sessionId:grants[0].session_public_id},{},manager);
 if(!actor.isSuperAdmin)throw Error('current_authority_not_super_admin');
 const [chat]=await manager.query(`SELECT id,owner_id::text,revision,lifecycle,selected_connection_id::text,selected_mode,selected_model_id,selected_effort_id,routing_revision,routing_enabled,routing_target_selection,next_message_seq::text,active_job_id FROM nodia_ai_conversations WHERE id=$1 AND owner_id=$2`,[conversation,owner]);if(!chat)throw Error('owned_conversation_missing');
 const messages=await manager.query('SELECT * FROM nodia_ai_messages WHERE conversation_id=$1 ORDER BY seq,id',[conversation]);
 const parts=await manager.query('SELECT p.* FROM nodia_ai_message_parts p JOIN nodia_ai_messages m ON m.id=p.message_id AND m.conversation_id=p.conversation_id WHERE p.conversation_id=$1 ORDER BY m.seq,p.part_index,p.message_id',[conversation]);
 const [counts]=await manager.query(`SELECT
 (SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,
 (SELECT COALESCE(sum(provider_dispatches_used),0)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,
 (SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments,
 (SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,
 (SELECT count(*)::int FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1 AND s.minimal_receipt IS NOT NULL) effect_receipts`,[conversation]);
 const historical=await manager.query(`SELECT e.id execution_id,e.origin_proposal_id proposal_id,e.origin_proposal_revision proposal_revision,e.revision execution_revision,e.state execution_state,p.current_revision proposal_current_revision,pr.state proposal_revision_state,s.id execution_step_id,s.position,s.tool_name,s.state step_state,s.minimal_receipt->>'resource_key' resource_key,s.minimal_receipt->>'resource_id' resource_id,s.minimal_receipt->>'subject_user_id' subject_user_id FROM nodia_ai_executions e JOIN nodia_ai_execution_steps s ON s.execution_id=e.id JOIN nodia_ai_proposals p ON p.id=e.origin_proposal_id AND p.conversation_id=e.origin_conversation_id JOIN nodia_ai_proposal_revisions pr ON pr.proposal_id=p.id AND pr.revision=e.origin_proposal_revision WHERE e.origin_conversation_id=$1 AND e.actor_id=$2 AND e.chat_owner_id=$2 AND s.minimal_receipt->>'resource_key'='finance_movements' AND s.minimal_receipt->>'resource_id'='2' AND s.minimal_receipt->>'subject_user_id'=$2::text`,[conversation,owner]);if(historical.length!==1)throw Error('historical_effect_not_unique');
 const [preferences]=await manager.query(`SELECT count(*)::int total,encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]'),'UTF8')),'hex') metadata_sha256 FROM nodia_ai_preferences p WHERE owner_id=$1`,[owner]);
 const categories=await manager.query(`SELECT id::text,is_active FROM finance_categories WHERE user_id=$1 AND is_active=true ORDER BY id LIMIT 2`,[owner]);
 const [invariants]=await manager.query(`SELECT
 (SELECT count(*)::int FROM finance_movements) financial_movements,
 (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) financial_movements_sha256,
 (SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,
 (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(e) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM nodia_ai_executions e WHERE origin_conversation_id=$1) executions_sha256,
 (SELECT count(*)::int FROM nodia_ai_confirmation_challenges c JOIN nodia_ai_proposals p ON p.id=c.proposal_id WHERE p.conversation_id=$1) challenges,
 (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id)::text,'[]'),'UTF8')),'hex') FROM nodia_ai_confirmation_challenges c JOIN nodia_ai_proposals p ON p.id=c.proposal_id WHERE p.conversation_id=$1) challenges_sha256`,[conversation]);
 const ownRuns=await manager.query(`SELECT r.id,r.state,r.phase,r.error_code,r.provider_dispatches_used,r.tool_calls_used,r.mcp_rpc_messages_used,r.assistant_message_id,m.seq::text user_seq FROM nodia_ai_runs r JOIN nodia_ai_messages m ON m.id=r.user_message_id WHERE r.conversation_id=$1 AND r.actor_id=$2 AND m.author_id=$2 AND m.seq>36 ORDER BY m.seq LIMIT 2`,[conversation,owner]);if(ownRuns.length!==1)throw Error('own_run_not_unique');const run=ownRuns[0];
 const attempts=await manager.query(`SELECT a.id,a.job_id,a.fence::text job_fence,a.runtime_fence::text,a.stage_key,a.stage_seq,a.phase,a.external_operation_ref,a.error_code,a.started_at,a.ended_at FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 AND j.conversation_id=$2 ORDER BY a.started_at,a.id LIMIT 32`,[run.id,conversation]);
 const context=await manager.query("SELECT context_manifest->'accepted_preferences' accepted_preferences,context_manifest->'stage_contexts' stage_contexts FROM nodia_ai_runs WHERE id=$1",[run.id]);
 const tools=await manager.query(`SELECT id,tool_name,state,contract_hash,arguments_hash,encode(sha256(convert_to(public_result::text,'UTF8')),'hex') result_sha256,created_at,completed_at FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 16`,[run.id,conversation]);
const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{isDeepStrictEqual:eq}=await import('node:util');
const require=createRequire('/opt/nodia/releases/nodia-server-ai40-r07/package.json');
const {Ajv2020}=require('ajv/dist/2020.js'),addFormats=require('ajv-formats');
const schemaBytes=readFileSync('/opt/nodia/releases/nodia-server-ai40-r07/dist/nodia-ai-products/contracts/common-reads.json');
const schemaSHA=historyHash('sha256').update(schemaBytes).digest('hex');if(schemaSHA!=='429791402fb77b88fa6131ca2585d1e0c242d8ae1bd2a3ec5caede1f5582e80c')throw Error('read_schema_changed');
const schema=JSON.parse(schemaBytes),ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const expectedArgs={nodia_preferences_list:{scope_key:'finance',page_limit:2},nodia_proposals_get:{proposal_id:'22614c2b-7853-4ad0-b068-b327844accac'},nodia_operations_get:{execution_id:'21048f61-fe53-4885-923c-397a5674d976'}};
const defs={nodia_preferences_list:['PreferenceListInput','PreferencePage'],nodia_proposals_get:['ProposalGetInput','PublicProposal'],nodia_operations_get:['OperationGetInput','ExecutionStatus']};
const raw=await manager.query('SELECT id,tool_name,state,arguments,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 16',[run.id,conversation]);
const callbacks=raw.filter(t=>t.tool_name!=='nodia_capabilities_select');
const receiptChecks=callbacks.map(t=>{if(!defs[t.tool_name])throw Error('unexpected_callback');const [i,o]=defs[t.tool_name].map(d=>ajv.compile({$ref:schema.$id+'#/$defs/'+d}));return {tool_call_id:t.id,tool_name:t.tool_name,completed:t.state==='completed',arguments_exact:eq(t.arguments,expectedArgs[t.tool_name]),input_schema_valid:i(t.arguments),output_schema_valid:o(t.public_result),schema_error_keywords:[...new Set([...(i.errors??[]),...(o.errors??[])].map(e=>e.keyword))]};});
const one=n=>{const items=callbacks.filter(t=>t.tool_name===n);if(items.length!==1)throw Error('callback_not_unique');return items[0].public_result;};
const page=one('nodia_preferences_list'),proposal=one('nodia_proposals_get'),execution=one('nodia_operations_get');
const expectedPreferences=[{preference_id:'04f8a72d-2fab-4c48-b7e1-e15e95d70bec',key:'expense_category_id',value:'1',revision:1,available:true},{preference_id:'669286a3-bc13-4a01-bf9c-203ed4359931',key:'income_category_id',value:'1',revision:1,available:true}];
const projected=page.items.map(p=>({preference_id:p.preference_id,key:p.key,value:p.value,revision:p.revision,available:p.available})).sort((a,b)=>a.key.localeCompare(b.key));
const expectedAnswer={preferences:projected,preferences_next_cursor:page.next_cursor,proposal_revision:proposal.revision,proposal_state:proposal.state,proposal_execution_id:proposal.execution_id,execution_revision:execution.revision,execution_state:execution.state,execution_completed_steps:execution.steps.filter(s=>s.state==='completed').length};
const [answer]=await manager.query("SELECT COALESCE(string_agg(text,E'\\n' ORDER BY part_index),'') text FROM nodia_ai_message_parts WHERE conversation_id=$1 AND message_id=$2 AND kind='text'",[conversation,run.assistant_message_id]);
let parsedAnswer;try{parsedAnswer=JSON.parse(answer.text);}catch{parsedAnswer=null;}
const {preferenceFingerprint}=await import('/opt/nodia/releases/nodia-server-ai40-r07/dist/nodia-ai-preference/types/preference.types.js');
const contextPreferences=context[0].accepted_preferences;
const expectedFingerprints=page.items.map(p=>({preference_id:p.preference_id,revision:p.revision,sha256:preferenceFingerprint([{...p,id:p.preference_id}])}));
const preferenceIdentities=contextPreferences.map(p=>({id:p.preference_id,revision:p.revision})).sort((a,b)=>a.id.localeCompare(b.id));
const expectedIdentities=expectedPreferences.map(p=>({id:p.preference_id,revision:p.revision})).sort((a,b)=>a.id.localeCompare(b.id));
const checks={one_selection_and_three_callbacks:raw.length===4&&raw.filter(t=>t.tool_name==='nodia_capabilities_select').length===1&&callbacks.length===3,exact_three_inputs_and_schemas:receiptChecks.every(c=>c.completed&&c.arguments_exact&&c.input_schema_valid&&c.output_schema_valid),immutable_preferences_match_accepted_oracle:eq(projected,expectedPreferences)&&page.next_cursor===null,workflow_identity_state:proposal.proposal_id==='22614c2b-7853-4ad0-b068-b327844accac'&&proposal.revision===1&&proposal.state==='confirmed'&&proposal.execution_id==='21048f61-fe53-4885-923c-397a5674d976',execution_identity_state:execution.execution_id==='21048f61-fe53-4885-923c-397a5674d976'&&execution.revision===5&&execution.state==='completed'&&expectedAnswer.execution_completed_steps===2,assistant_plain_JSON_exactly_matches_immutable_receipts:eq(parsedAnswer,expectedAnswer),context_contains_exact_two_accepted_id_revisions:eq(preferenceIdentities,expectedIdentities),context_hashes_match_persisted_public_preferences:contextPreferences.length===expectedFingerprints.length&&contextPreferences.every(p=>expectedFingerprints.some(e=>eq(p,e))),context_hashes_well_formed_and_every_native_stage_identical:contextPreferences.every(p=>/^[a-f0-9]{64}$/.test(p.sha256))&&Object.values(context[0].stage_contexts).every(s=>eq(s.accepted_preferences,contextPreferences)),accepted_preferences_unchanged:preferences.total===2&&preferences.metadata_sha256==='b3cffd91df324d06e640ff3c9e169db2d2fb5a24692ff11dbbc2cc7297443237',finance_unchanged:invariants.financial_movements===2&&invariants.financial_movements_sha256==='5335e312c7b542552f924cf266fc007ff1a3691e522e6c682bb20e374b5b7871'};
const validation={status:Object.values(checks).every(Boolean)?'validated_read_only':'validation_failed',schema_sha256:schemaSHA,checks,receipt_checks:receiptChecks,assistant_sha256:historyHash('sha256').update(answer.text).digest('hex'),assistant_utf8_bytes:Buffer.byteLength(answer.text),raw_arguments_results_and_answer_emitted:false};

 return {validation,run,attempts,tools,context,chat,counts:{messages:messages.length,parts:parts.length,...counts},ordered_history_sha256:historyHash('sha256').update(JSON.stringify({messages,parts})).digest('hex'),historical:historical[0],accepted_preferences:preferences,eligible_finance_category_references:categories,invariants,current_super_admin_authority_verified:true,exact_historical_grant_session_verified:true};});
 console.log(JSON.stringify(result));
}finally{if(db.isInitialized)await db.destroy();}
'''
r=h.command(['/usr/local/bin/node','--input-type=module','-e',prefix+query],cwd=g.RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root',**env},timeout=30)
if r.returncode!=0:
 text=r.stderr.decode('utf8','replace')
 print(json.dumps({'status':'readonly_query_failed','child_returncode':r.returncode,'stderr_bytes':len(r.stderr),'historical_effect_not_unique':'historical_effect_not_unique'in text,'authority_denied':any(k in text for k in('UnauthorizedException','ForbiddenException','nodia_ai:capability_denied')),'SQL_error':any(k in text for k in('QueryFailedError','does not exist')),'text_bigint_operator_missing':'operator does not exist: text = bigint'in text,'ambiguous_id':'column reference \"id\" is ambiguous'in text,'private_details_emitted':False,'SQL_writes':0,'SDK_requests':0}));sys.exit(1)
assert len(r.stdout)<65536
print(json.dumps({'schema':'nodia-ai-ai40-common-authorized-oracle-readonly-v1','status':'observed_read_only','release_manifest_sha256':'1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476','snapshot':json.loads(r.stdout),'SQL_writes':0,'provider_requests':0,'SDK_observations':0,'message_text_or_attachment_IDs_emitted':False,'auth_tokens_or_sessions_emitted':False}))
