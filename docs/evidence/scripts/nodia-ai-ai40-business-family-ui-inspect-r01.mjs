// Operator only: exact owned chat, current production authority, published business schema,
// aggregate-only SQL and metadata. No provider/R2/profile/API call or domain mutation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const digest = value => createHash('sha256').update(value).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
let db, phase = 'input';
let report = { schema:'nodia-ai-ai40-business-family-inspection-v1', status:'not_started',
  sql_read_only:true, configured_sql_writes:0, provider_requests:0, profile_accessed:false,
  private_content_emitted:false, credentials_or_storage_keys_emitted:false };
try {
  let bytes=0; const chunks=[];
  for await (const chunk of process.stdin) { bytes+=chunk.length; assert.ok(bytes<=4096); chunks.push(chunk); }
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const fields=['schema_version','conversation_id','expected_owner_id','authority_run_id','run_id','after_user_seq'];
  assert.ok(input && !Array.isArray(input) && Object.keys(input).sort().join(',')===fields.sort().join(','));
  assert.equal(input.schema_version,1); assert.ok(uuid(input.conversation_id) && uuid(input.authority_run_id));
  assert.ok(typeof input.expected_owner_id==='string' && /^[1-9]\d{0,18}$/u.test(input.expected_owner_id) && BigInt(input.expected_owner_id)<=9223372036854775807n);
  assert.ok(input.run_id===null || uuid(input.run_id));
  assert.ok(typeof input.after_user_seq==='string' && /^[0-9]{1,20}$/u.test(input.after_user_seq));
  report={...report, source_sha256:digest(await readFile(new URL(import.meta.url))), conversation_id:input.conversation_id, run_id:input.run_id};
  phase='configuration';
  const server=resolve(process.cwd()), require=createRequire(join(server,'package.json'));
  assert.ok(process.env.DOTENV_CONFIG_PATH);
  const env={...require('dotenv').parse(await readFile(process.env.DOTENV_CONFIG_PATH)),...process.env};
  const manifest=JSON.parse(await readFile(join(server,'dist/nodia-ai/knowledge/manifest.json'),'utf8'));
  const business=manifest.capability_contracts.filter(cap=>cap.capability_id==='nodia_businesses_list');
  const rental=manifest.capability_contracts.filter(cap=>cap.capability_id==='nodia_rental_properties_list');
  assert.equal(business.length,1); assert.equal(rental.length,1);
  assert.equal(business[0].publication,'published'); assert.equal(business[0].kind,'read');
  assert.deepEqual(business[0].required_module_routes,['/tools/business']);
  assert.equal(rental[0].required_module_routes.length,1);
  const rentalRoute=rental[0].required_module_routes[0]; assert.equal(rentalRoute,'/tools/reservations');
  const schemaBytes=await readFile(join(server,'dist/nodia-ai-products/contracts/business.schema.json'));
  assert.equal(digest(schemaBytes),business[0].input_schema.sha256);
  const schema=JSON.parse(schemaBytes);
  const {Ajv2020}=require('ajv/dist/2020.js'), addFormats=require('ajv-formats');
  const ajv=new Ajv2020({strict:true,allErrors:true}); addFormats(ajv);
  const validate=ajv.compile({...schema,$ref:'#/$defs/BusinessesListInput'});
  const expectedArguments={page:1,limit:1,activity:'all',all_businesses:true};
  assert.equal(validate(expectedArguments),true);
  report.publication={knowledge_release:manifest.release_id, capability_id:business[0].capability_id,
    kind:business[0].kind, required_module_routes:business[0].required_module_routes,
    input_schema_sha256:digest(schemaBytes), input_definition:business[0].input_schema.definition,
    validated_expected_arguments:expectedArguments, rental_route_from_published_contract:rentalRoute};
  const {DataSource}=require('typeorm');
  db=new DataSource({type:'postgres',host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),database:env.POSTGRES_DB,
    username:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,ssl:env.POSTGRES_SSL==='true'?{rejectUnauthorized:false}:undefined,
    synchronize:false,migrationsRun:false,logging:false,
    extra:{connectionTimeoutMillis:5000,statement_timeout:5000,options:'-c default_transaction_read_only=on'}});
  const {NodiaAiAuthorizationService}=await import(pathToFileURL(join(server,'dist/nodia-ai/nodia-ai-authorization.service.js')).href);
  const {AuthorizeNodiaAiUseCase}=await import(pathToFileURL(join(server,'dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js')).href);
  phase='read_only_authority_and_snapshot'; await db.initialize();
  const snapshot=await db.transaction('REPEATABLE READ',async m=>{
    await m.query('SET TRANSACTION READ ONLY');
    const [mode]=await m.query('SHOW transaction_read_only');assert.equal(mode.transaction_read_only,'on');
    const [chat]=await m.query('SELECT id,owner_id::text,revision,active_job_id,lifecycle,next_message_seq::text FROM nodia_ai_conversations WHERE id=$1',[input.conversation_id]);
    assert.ok(chat && chat.owner_id===input.expected_owner_id);
    const identities=await m.query('SELECT g.session_public_id::text FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2',[input.authority_run_id,input.conversation_id,input.expected_owner_id]);
    assert.equal(identities.length,1); assert.ok(uuid(identities[0].session_public_id));
    const identity={userId:input.expected_owner_id,sessionId:identities[0].session_public_id};
    const authorizer=new AuthorizeNodiaAiUseCase(new NodiaAiAuthorizationService(db));
    const actor=await authorizer.execute(identity,{},m); assert.equal(actor.isSuperAdmin,true);
    const routes=['/tools/business','/tools/finances-personal',rentalRoute];
    const modules=await m.query('SELECT m.id::text,m.key,m.link,m.is_active,g.is_active AS group_active,EXISTS(SELECT 1 FROM user_modules um WHERE um.user_id=$1 AND um.module_id=m.id AND um.is_active) AS explicitly_assigned FROM modules m JOIN module_groups g ON g.id=m.module_group_id WHERE m.link=ANY($2::text[]) ORDER BY m.link,m.id LIMIT 16',[input.expected_owner_id,routes]);
    const module_state=routes.map(route=>({route,rows:modules.filter(row=>row.link===route),authorized_by_current_backend:actor.modules.some(module=>module.route===route)}));
    const [tables]=await m.query("SELECT to_regclass('public.businesses') IS NOT NULL AS businesses,to_regclass('public.rental_properties') IS NOT NULL AS rental_properties");
    let business_total=null,rental_total=null;
    if (actor.modules.some(module=>module.route==='/tools/business') && tables.businesses) {
      await authorizer.execute(identity,{moduleRoutes:['/tools/business']},m);
      [ {total:business_total} ]=await m.query('SELECT count(*)::int AS total FROM businesses');
    }
    if (actor.modules.some(module=>module.route===rentalRoute) && tables.rental_properties) {
      await authorizer.execute(identity,{moduleRoutes:[rentalRoute]},m);
      [ {total:rental_total} ]=await m.query('SELECT count(*)::int AS total FROM rental_properties');
    }
    const blockers=module_state.filter(module=>!module.authorized_by_current_backend).map(module=>({route:module.route,reason:module.rows.length?'module_inactive_ambiguous_or_not_authorized':'module_missing'}));
    if (!tables.businesses) blockers.push({route:'/tools/business',reason:'business_storage_missing'});
    if (!tables.rental_properties) blockers.push({route:rentalRoute,reason:'rental_storage_missing'});
    if (input.run_id===null) {
      const runs=await m.query("SELECT r.id FROM nodia_ai_runs r JOIN nodia_ai_messages msg ON msg.id=r.user_message_id WHERE r.conversation_id=$1 AND msg.conversation_id=$1 AND msg.author_id=$2 AND msg.role='user' AND msg.seq>$3::bigint ORDER BY msg.seq LIMIT 2",[input.conversation_id,input.expected_owner_id,input.after_user_seq]);
      assert.ok(runs.length<=1,'More than one later own run; supply exact ID');
      if (runs.length) input.run_id=runs[0].id;
    }
    let run=null,attempts=[],tools=[],business_receipts=[],assistant_answer=null;
    if (input.run_id) {
      [run]=await m.query('SELECT id,state,phase,error_code,provider_dispatches_used,tool_calls_used,mcp_rpc_messages_used,compactions_used,user_message_id,assistant_message_id,created_at,completed_at FROM nodia_ai_runs WHERE id=$1 AND conversation_id=$2',[input.run_id,input.conversation_id]);assert.ok(run);
      attempts=await m.query('SELECT a.id,a.job_id,a.stage_key,a.stage_seq,a.phase,a.external_operation_ref,a.runtime_fence,a.error_code,a.started_at,a.ended_at FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 AND j.conversation_id=$2 ORDER BY a.started_at,a.id LIMIT 32',[run.id,input.conversation_id]);
      tools=await m.query('SELECT id,tool_name,state,contract_hash,arguments_hash,created_at,completed_at FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 16',[run.id,input.conversation_id]);
      business_receipts=await m.query("SELECT id,state,arguments=$3::jsonb AS exact_expected_arguments,public_result->'meta' AS meta,CASE WHEN jsonb_typeof(public_result->'data')='array' THEN jsonb_array_length(public_result->'data') ELSE NULL END AS page_rows,CASE WHEN public_result IS NULL THEN NULL ELSE encode(sha256(convert_to(public_result::text,'UTF8')),'hex') END AS result_sha256 FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 AND tool_name='nodia_businesses_list' ORDER BY created_at,id LIMIT 8",[run.id,input.conversation_id,expectedArguments]);
      const [answer]=await m.query("SELECT encode(sha256(convert_to(COALESCE(string_agg(text,E'\\n' ORDER BY part_index),''),'UTF8')),'hex') AS sha256,COALESCE(sum(octet_length(text)),0)::int AS utf8_bytes FROM nodia_ai_message_parts WHERE message_id=$1 AND conversation_id=$2 AND kind='text'",[run.assistant_message_id,input.conversation_id]);
      assistant_answer=run.assistant_message_id?answer:null;
    }
    const [counts]=await m.query('SELECT (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,(SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,(SELECT COALESCE(sum(provider_dispatches_used),0)::int FROM nodia_ai_runs WHERE conversation_id=$1) dispatches,(SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments,(SELECT count(*)::int FROM nodia_ai_executions WHERE origin_conversation_id=$1) executions,(SELECT count(*)::int FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1 AND s.minimal_receipt IS NOT NULL) effect_receipts',[input.conversation_id]);
    const [pending]=await m.query("SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting')) pending_jobs,(SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots");
    return {chat,current_actor:{id:actor.actorId,active_session_revalidated:true,is_super_admin:actor.isSuperAdmin,session_identifier_emitted:false},module_state,storage_exists:tables,oracle:{business_total,rental_total,scope:'all rows only after current super_admin and active target module authorization; no row names or business payloads'},blockers,counts,pending,run,attempts,tools,business_receipts,assistant_answer};
  });
  report={...report,...snapshot,run_id:input.run_id,status:'observed_read_only'};
} catch(error) {
  report.status='inspection_failed'; report.safe_failure_phase=phase;
  report.safe_failure_category=error?.code==='ERR_ASSERTION'?'scope_or_contract_mismatch':'dependency_or_input_error';
  process.exitCode=1;
} finally { if (db?.isInitialized) await db.destroy().catch(()=>{}); }
process.stdout.write(JSON.stringify(report)+'\n');
