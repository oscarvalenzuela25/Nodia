// Real PostgreSQL + compiled owner/transport, strictly synthetic provider and credentials.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { DataSource } from 'typeorm';

process.env.DOTENV_CONFIG_PATH =
  process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const dist = process.env.TEACHER_SERVER_DIST ? pathToFileURL(resolve(process.env.TEACHER_SERVER_DIST) + sep) : new URL('../dist/', import.meta.url);
const compiled = path => new URL(path, dist);
const { TeacherGenerationRuntimeService } =
  await import(compiled('ai-generation/teacher-generation-runtime.service.js').href);
const { ApiTextGenerationService } =
  await import(compiled('ai-generation/api-text-generation.service.js').href);
const { GenerationWorkerSourceRegistry } =
  await import(compiled('ai-generation/worker-source-registry.js').href);
const { ApiNodiaAiCredentialsService } =
  await import(compiled('nodia-ai-adapter/api-nodia-ai-credentials.service.js').href);
const { NodiaAiConnectionsService } =
  await import(compiled('nodia-ai-conversation/nodia-ai-connections.service.js').href);
const { CheckModuleAccessUseCase } =
  await import(compiled('authorization/use-case/check-module-access.use-case.js').href);
const { ValidateNodiaAiRuntimePolicyUseCase } =
  await import(compiled('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js').href);
const { TeacherService } = await import(compiled('teacher/teacher.service.js').href);
const { ExecuteTeacherCommandUseCase } =
  await import(compiled('teacher/use-case/execute-teacher-command.use-case.js').href);
const { PublishTeacherUseCase } =
  await import(compiled('teacher/use-case/publish-teacher.use-case.js').href);
const { encryptSecret, generateFingerprint } =
  await import(compiled('ai-provider/helpers/ai-key-crypto.helper.js').href);
const container = `template_teacher_purpose_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let source,
  started = false;
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
const originalFetch = globalThis.fetch;
try {
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    container,
    '-e',
    'POSTGRES_USER=teacher',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    'POSTGRES_DB=teacher',
    '-p',
    '127.0.0.1::5432',
    'postgres:16-alpine',
  );
  started = true;
  for (let i = 0; i < 100; i++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'teacher',
      );
      break;
    } catch {
      if (i === 99) throw Error('disposable postgres unavailable');
      await delay(200);
    }
  }
  source = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'teacher',
    password,
    database: 'teacher',
    migrations: [
      fileURLToPath(compiled('migrations/*.js')),
    ],
    synchronize: false,
  });
  await source.initialize();
  await source.runMigrations({ transaction: 'all' });
  const actor = { userId: '9007199254740993', sessionId: randomUUID() };
  await source.query(
    "INSERT INTO users(id,email,name) VALUES($1,'teacher-runtime@example.invalid','Synthetic runtime actor')",
    [actor.userId],
  );
  await source.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [actor.sessionId, actor.userId, 'a'.repeat(64)],
  );
  const [{ id: group }] = await source.query(
    "INSERT INTO module_groups(key,sort_order) VALUES('synthetic_teacher',99) RETURNING id::text",
  );
  const [{ id: moduleId }] = await source.query(
    "INSERT INTO modules(module_group_id,key,link,sort_order) VALUES($1,'nodia_teacher','/nodia-teacher',0) RETURNING id::text",
    [group],
  );
  await source.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true)',
    [actor.userId, moduleId],
  );
  const [{ id: connectionId }] = await source.query(
    "INSERT INTO ai_providers(catalog_id,name,use_api_key,fields) SELECT id,'Synthetic teacher transport',true,$1::jsonb FROM ai_provider_catalog WHERE key='openai' RETURNING id::text",
    [
      JSON.stringify({
        api_key: {
          selected_model: 'fixture-model-discovered',
          available_models: [{ id: 'fixture-model-discovered' }],
        },
      }),
    ],
  );
  const secret = 'synthetic-never-a-real-key';
  await source.query(
    "INSERT INTO ai_api_keys(provider_id,label,secret_ciphertext,secret_fingerprint,display_hint,is_selected) VALUES($1,'Synthetic', $2,$3,'****',true)",
    [connectionId, encryptSecret(secret), generateFingerprint(secret)],
  );
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
    JSON.parse(
      await readFile(
        new URL('../src/nodia-ai-runtime/config/runtime-policy.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const access = new CheckModuleAccessUseCase(source),
    credentials = new ApiNodiaAiCredentialsService(source),
    registry = new GenerationWorkerSourceRegistry();
  const runtime = new TeacherGenerationRuntimeService(
    source,
    access,
    credentials,
    new NodiaAiConnectionsService(source),
    registry,
    new ApiTextGenerationService(credentials, policy),
    policy,
  );
  runtime.onModuleInit();
  const publisher = new PublishTeacherUseCase();
  runtime.setPublisher(publisher.publish.bind(publisher));
  const selection = {
    connection_id: connectionId,
    mode: 'api_key',
    model_id: 'fixture-model-discovered',
    effort_id: null,
  };
  const { TeacherEnrichmentUseCase } = await import(compiled('teacher/use-case/teacher-enrichment.use-case.js'));
  const { saveProposal } = await import(compiled('teacher/use-case/teacher-plan-persistence.js'));
  const { publishAssessment, startStoredAttempt } = await import(compiled('teacher/use-case/teacher-attempt-persistence.js'));
  const { defaultPolicy, hash } = await import(compiled('teacher/policies/teacher-validation.js'));
  const { teacherApiQualificationScope, TEACHER_GENERATION_POLICY_HASH } = await import(compiled('ai-generation/teacher-qualification-policy.js'));
  const store = new TeacherService(source,access);
  const commands = new ExecuteTeacherCommandUseCase(store,runtime);
  const enrichment = new TeacherEnrichmentUseCase(store,runtime);
  const create = async () => (await commands.execute(actor,null,randomUUID(),'create',{
    topic:'Synthetic qualification laboratory',objective:'Bind a helper to real visible text',
    explanation_language:'en',organization:'topics',day_count:null,selection,
  })).session_id;
  let posts=0;
  globalThis.fetch=async (_url,init)=>{
    posts++;
    const body=JSON.parse(init.body);
    const serialized=JSON.stringify(body);
    // The synthetic transport reads only the actual admitted INPUT_DATA_JSON.
    const prompt=body.input?.[0]?.content?.[0]?.text??body.input;
    assert.equal(typeof prompt,'string');
    const input=JSON.parse(prompt.slice(prompt.indexOf('INPUT_DATA_JSON\n')+'INPUT_DATA_JSON\n'.length));
    const text=input.qualification_probe.purpose==='contextual_reply'
      ?{schema_version:1,text:input.selection}
      :{schema_version:1,text:input.qualification_probe.nonce,brief:{topic:'Transport',objective:'Verify reply'},questions:[],organization_options:['topics']};
    assert.ok(serialized.includes(selection.model_id));
    return new Response(JSON.stringify({status:'completed',output:[{
      type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(text)}],
    }]}));
  };
  const setupId=await create();
  const setup=await runtime.qualifyText(actor,setupId,selection,AbortSignal.timeout(15000));
  check(setup.qualified_current_policy===true&&posts===1,'new setup canary qualifies current transport manifest');
  await assert.rejects(source.transaction(m=>runtime.verifySelection(m,actor,selection,'contextual_reply')),/adapter_unqualified/);
  check(posts===1,'setup success never grants contextual purpose');
  const [savedBase]=await source.query('SELECT * FROM ai_generation_qualifications');
  const config=await credentials.configuration(selection);
  const legacyScope=hash({contract:'teacher-text/1',selection,configuration:config.configurationGeneration,session:config.sessionGeneration});
  await source.query('UPDATE ai_generation_qualifications SET scope_hash=$1 WHERE scope_hash=$2',[legacyScope,savedBase.scope_hash]);
  await assert.rejects(source.transaction(m=>runtime.verifySelection(m,actor,selection,'learning_packet')),/adapter_unqualified/);
  check(posts===1,'old transport-only scope is rejected without dispatch');
  await source.query('UPDATE ai_generation_qualifications SET scope_hash=$1 WHERE scope_hash=$2',[teacherApiQualificationScope(selection,config),legacyScope]);

  const id=await create(),section=randomUUID(),objective=randomUUID(),unit=randomUUID();
  const outline={schema_version:1,title:'Atomic writes',topic:'Transactions',objective:'Explain atomic writes',explanation_language:'en',organization:'topics',day_count:null,
    assessment_policy:defaultPolicy(1),sections:[{id:section,title:'Atomicity',required:true,prerequisite_section_ids:[],objectives:[{id:objective,description:'Explain atomicity'}],units:[{id:unit,title:'Atomic writes',objective_ids:[objective],day_start:null,day_end:null}]}]};
  const proposal=await store.scope(actor,id,({manager,session,actor:identity})=>saveProposal(manager,session,identity.actorId,outline,
    {schema_version:1,strategy:'balanced',context_notes:'',examples_context:'',prerequisite_knowledge:[],preferred_formats:['single_choice']},null),true);
  const revision=async()=>(await source.query('SELECT revision FROM teacher_sessions WHERE id=$1',[id]))[0].revision;
  await commands.execute(actor,id,randomUUID(),'accept',{expected_session_revision:await revision(),proposal_revision_id:proposal.id,proposal_hash:proposal.content_hash},{proposalId:proposal.id});
  const material=await commands.execute(actor,id,randomUUID(),'material',{expected_session_revision:await revision(),plan_revision_id:proposal.id,variant:'current'},{unitId:unit});
  const contentId=randomUUID(),blocks=[{id:'atomicity',kind:'explanation',title:'Atomicity',body_markdown:'Atomic writes commit all changes together.'}];
  await source.query("INSERT INTO teacher_content_versions(id,session_id,plan_revision_id,unit_id,version_no,generation_job_id,context_hash,public_blocks,content_hash,publication_state) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'current')",
    [contentId,id,proposal.id,unit,material.job_id,hash({synthetic:true}),JSON.stringify(blocks),hash(blocks)]);
  await source.query("UPDATE teacher_generation_jobs SET state='failed_known',blocks_duplicate=false WHERE id=$1",[material.job_id]);
  const thread=async()=>(await enrichment.execute(actor,id,randomUUID(),{expected_revision:(await enrichment.dashboard(actor,id)).revision,
    operation:'thread_create',payload:{content_version_id:contentId,block_id:'atomicity',selection:'commit all changes'}})).resource_id;
  const firstThread=await thread();
  // Actor2 is a real synthetic authenticated account with the module; it still cannot use Actor1's anchor.
  const other={userId:'9007199254740994',sessionId:randomUUID()};
  await source.query("INSERT INTO users(id,email,name) VALUES($1,'other-purpose@example.invalid','Other synthetic actor')",[other.userId]);
  await source.query("INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[other.sessionId,other.userId,'b'.repeat(64)]);
  await source.query('INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true)',[other.userId,moduleId]);
  await assert.rejects(runtime.qualifyContextualReply(other,id,selection,firstThread,AbortSignal.timeout(15000)),/qualification_session_required/);
  await source.query("UPDATE teacher_sessions SET state='paused' WHERE id=$1",[id]);
  await assert.rejects(runtime.qualifyContextualReply(actor,id,selection,firstThread,AbortSignal.timeout(15000)),/qualification_session_required/);
  await source.query("UPDATE teacher_sessions SET state='active' WHERE id=$1",[id]);
  check(posts===1,'foreign actor and paused session reject before dispatch');
  const helper=await runtime.qualifyContextualReply(actor,id,selection,firstThread,AbortSignal.timeout(15000));
  check(helper.qualified_current_policy===true&&helper.pedagogical_quality_verified===false&&posts===2,'anchored protocol qualifies only its separate current purpose');
  await source.transaction(m=>runtime.verifySelection(m,actor,selection,'contextual_reply'));
  const [op]=await source.query('SELECT * FROM ai_generation_operations WHERE id=$1',[helper.operation_id]);
  check(op.phase==='closed'&&op.started_exchanges===1&&op.reserved_exchanges===1&&op.acknowledged_at&&op.terminal_proof.local_transport_closed,'helper uses normal durable reservation/closure/ACK');
  await assert.rejects(runtime.qualifyContextualReply(actor,id,selection,firstThread,AbortSignal.timeout(15000)),/qualification_session_required/);
  check(posts===2,'used canary thread cannot be automatically retried');

  const lostThread=await thread();
  const complete=runtime.completeContextualQualification;
  runtime.completeContextualQualification=async()=>{throw Error('synthetic_lost_receipt');};
  await assert.rejects(runtime.qualifyContextualReply(actor,id,selection,lostThread,AbortSignal.timeout(15000)),/synthetic_lost_receipt/);
  runtime.completeContextualQualification=complete;
  const [lostJob]=await source.query("SELECT id FROM teacher_generation_jobs WHERE input_snapshot->>'thread_id'=$1",[lostThread]);
  const recovered=await runtime.completeContextualQualification(actor,id,lostJob.id,AbortSignal.timeout(15000));
  const repeated=await runtime.completeContextualQualification(actor,id,lostJob.id,AbortSignal.timeout(15000));
  check(recovered.evidence_hash===repeated.evidence_hash&&posts===3,'lost receipt and repeated completion reuse original operation without POST');
  const oldPolicy='c'.repeat(64);
  await source.query("UPDATE teacher_generation_jobs SET input_snapshot=jsonb_set(input_snapshot,'{qualification_probe,teacher_policy_hash}',to_jsonb($2::text)),template_hash=$2 WHERE id=$1",[lostJob.id,oldPolicy]);
  await source.query('DELETE FROM teacher_purpose_qualifications');
  await source.query('UPDATE ai_generation_qualifications SET scope_hash=$1',[legacyScope]);
  const historic=await runtime.completeContextualQualification(actor,id,lostJob.id,AbortSignal.timeout(15000));
  check(historic.qualified_current_policy===false&&posts===3&&(await source.query('SELECT * FROM teacher_purpose_qualifications')).length===0,'historical helper reconciles without current transport and never promotes policy');
  await source.query('UPDATE ai_generation_qualifications SET scope_hash=$1',[savedBase.scope_hash]);
  // The first immutable canary still qualifies current policy. No additional dispatch is needed.
  await runtime.completeContextualQualification(actor,id,helper.job_id,AbortSignal.timeout(15000));
  const finalThread=await thread();
  await store.scope(actor,id,async({manager,session})=>{
    const assessmentId=await publishAssessment(manager,session,material.job_id,{schema_version:1,scope:'section_final',plan_revision_id:proposal.id,section_id:section,unit_id:null,
      items:[{local_ref:'one',objective_id:objective,kind:'single_choice',prompt:'Choose atomicity.',options:[{id:'all',label:'All changes'},{id:'some',label:'Some changes'}],private_key:{kind:'single_choice',option_id:'all'},explanation:'All or nothing.'}]},
    [{ordinal:1,objective_id:objective,kind:'single_choice',max_points:2}],defaultPolicy(1),null);
    await startStoredAttempt(manager,session,assessmentId,'direct');
  },true);
  await assert.rejects(runtime.qualifyContextualReply(actor,id,selection,finalThread,AbortSignal.timeout(15000)),/helper_unavailable_during_final/);
  check(posts===3,'active final prevents anchored canary dispatch');
  await source.query("UPDATE teacher_sessions SET state='archived' WHERE id=$1",[id]);
  await assert.rejects(runtime.completeContextualQualification(actor,id,helper.job_id,AbortSignal.timeout(15000)),/qualification_session_required/);
  check(posts===3,'archived mutation/completion remains blocked');
  const {TeacherPurposeQualification1793650000000}=await import(compiled('migrations/1793650000000-TeacherPurposeQualification.js'));
  const runner=source.createQueryRunner(); await runner.connect();
  try{await assert.rejects(new TeacherPurposeQualification1793650000000().down(runner),/rollback_has_data/);}finally{await runner.release();}
  check((await source.query('SELECT * FROM teacher_purpose_qualifications'))[0].policy_hash===TEACHER_GENERATION_POLICY_HASH,'additive migration refuses populated rollback');
  const tables=(await source.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).map(row=>row.tablename);
  assert.ok(tables.every(table=>/^[a-z_][a-z0-9_]*$/.test(table)));
  const fingerprint=async db=>{
    const contents=[];
    for(const table of tables)contents.push([table,await db.query(`SELECT to_jsonb(t) AS data FROM "${table}" t ORDER BY to_jsonb(t)::text`)]);
    return createHash('sha256').update(JSON.stringify(contents)).digest('hex');
  };
  const before=await fingerprint(source);
  docker('exec',container,'pg_dump','-U','teacher','-d','teacher','--format=custom','--file=/tmp/purpose.dump');
  docker('exec',container,'createdb','-U','teacher','teacher_restore');
  docker('exec',container,'pg_restore','-U','teacher','-d','teacher_restore','--exit-on-error','/tmp/purpose.dump');
  const restored=new DataSource({...source.options,database:'teacher_restore',migrations:[]});
  try{await restored.initialize();check(await fingerprint(restored)===before,'restore preserves populated purpose proof, immutable events and original receipts exactly');}
  finally{if(restored.isInitialized)await restored.destroy();}
  console.log(JSON.stringify({task:'teacher_purpose_qualification',checks,synthetic_posts:posts,
    real_provider_qualified:false,configured_database_touched:false,restore_populated_purpose_proof:true}));
} finally {
  globalThis.fetch=originalFetch;
  if(source?.isInitialized)await source.destroy();
  if(started)docker('rm','-f',container);
}
