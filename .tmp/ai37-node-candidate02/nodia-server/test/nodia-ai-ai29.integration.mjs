import { createServer } from 'node:http';
// Compiled native contracts, human confirmation HTTP, real PostgreSQL and worker processes.
// Synthetic disposable records only. Preparation is an internal port, never a published MCP assertion.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { ConflictException, NotFoundException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai29');
const { db, options, identities } = fixture;
const checks = [], children = new Set(), exercised = new Set();
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
let app, compiled, base, prepare, recovery, worker, providerCalls = 0, nativeTransport;
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const nativeJobs = new Map(); let nativeStarts=0, busy=false, loseStart=false, nativeCompleted=false;
const startNative = (providerId,actorId,kind,requestId) => { nativeStarts++; if(busy)throw new ConflictException('runtime_busy'); const id=requestId ? (kind==='codex'?requestId:requestId.replaceAll('-','')) : kind==='codex'?randomUUID():randomBytes(16).toString('hex'); const job=kind==='codex'?{id,state:'waiting_authorization',verificationUrl:'https://auth.openai.com/codex/device',userCode:'SYNTHETIC-123',reason:null}:kind==='agentic'?{id,state:'waiting_code',authorization_url:'https://accounts.google.com/o/oauth2/v2/auth?synthetic-human-only=true',reason:null}:{id,state:'running'};nativeJobs.set(id,{providerId,actorId,kind,job});if(loseStart)throw Error('synthetic native response lost');return job; };
const nativeJob=(id,actorId)=>{const value=nativeJobs.get(id);if(!value||value.actorId!==actorId)throw new NotFoundException('Synthetic native ownership/TTL');return {...value.job,state:nativeCompleted?'succeeded':value.job.state};};
const cancelNative=(id,actor)=>{const job=nativeJob(id,actor);return ['succeeded','failed','cancelled'].includes(job.state)?job:{...job,state:'cancelled'};};
const kill = async child => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGKILL');
  await ended;
};
try {
  const [Confirmation, Execution, Conversation, Overview, Prepare, Recover, Run, Redis, Adapter] = await Promise.all([
    loadAi('nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'),
    loadAi('nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'),
    loadAi('nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'),
    loadAi('finance-overview/finance-overview.module', 'FinanceOverviewModule'),
    loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'),
    loadAi('nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'),
    loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase'),
    loadAi('common/redis/redis.service', 'RedisService'),
    loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'),
  ]);
  const nativeModules = [await loadAi('ai-provider/ai-provider.module', 'AiProviderModule')];
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Overview, ...nativeModules, await loadAi('nodia-ai-secure-flow/nodia-ai-secure-flow.module', 'NodiaAiSecureFlowModule'),
  ] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [], delByPattern: async () => {} });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => {
    providerCalls++; throw Error('Forbidden AI29 provider');
  }])));
  const Web = await loadAi('ai-provider/use-case/manage-gemini-login.use-case','ManageGeminiLoginUseCase');
  const Agentic = await loadAi('ai-provider/use-case/manage-gemini-agentic-login.use-case','ManageGeminiAgenticLoginUseCase');
  const Codex = await loadAi('ai-provider/use-case/manage-codex-session.use-case','ManageCodexSessionUseCase');
  const Sync = await loadAi('ai-provider/use-case/sync-ai-provider-models.use-case','SyncAiProviderModelsUseCase');
  const Gemini = await loadAi('common/ai/gemini.service','GeminiService');
  builder.overrideProvider(Gemini).useValue({acknowledgeLoginRequest:async()=>{},durableLoginRequest:async(engine,action,id,provider,actor)=>{const nativeId=id.replaceAll('-',''); if(action==='start')return startNative(provider,actor,engine==='web'?'web':'agentic',id);if(action==='cancel'&&!nativeJobs.has(nativeId))nativeJobs.set(nativeId,{providerId:provider,actorId:actor,kind:engine==='web'?'web':'agentic',job:{id:nativeId,state:'cancelled'}});return action==='cancel'?cancelNative(nativeId,actor):nativeJob(nativeId,actor);},getInteractiveLoginStatus:async(id,actor)=>nativeJob(id,actor),cancelInteractiveLogin:async(id,actor)=>cancelNative(id,actor),getInteractiveLoginFrame:async(id,actor)=>{nativeJob(id,actor);return {ready:false,frame_id:null,image:null,width:1280,height:850};},sendInteractiveLoginInput:async(id,actor)=>nativeJob(id,actor)});
  builder.overrideProvider(Web).useValue({start:async actor=>startNative(null,actor,'web'),status:async(id,actor)=>nativeJob(id,actor),
    cancel:async(id,actor)=>cancelNative(id,actor),frame:async(id,actor)=>{nativeJob(id,actor);return {ready:false,frame_id:null,image:null,width:1280,height:850};},
    input:async(id,actor)=>nativeJob(id,actor),disconnect:async()=>({status:'disconnected'})});
  builder.overrideProvider(Agentic).useValue({start:async actor=>startNative(null,actor,'agentic'),status:async(id,actor)=>nativeJob(id,actor),
    cancel:async(id,actor)=>cancelNative(id,actor),submit:async(id,actor)=>nativeJob(id,actor)});
  builder.overrideProvider(Codex).useValue({acknowledgeRequest:async()=>({acknowledged:true}),start:async(provider,actor,id)=>startNative(provider,actor,'codex',id),statusRequest:async(provider,id,actor)=>nativeJob(id,actor),cancelRequest:async(provider,id,actor)=>cancelNative(id,actor),status:async(provider,id,actor)=>nativeJob(id,actor),
    cancel:async(provider,id,actor)=>cancelNative(id,actor),logout:async()=>({disconnected:true})});
  builder.overrideProvider(Sync).useValue({execute:async(providerId,options)=>{assert.equal(options.persist,false);return {providerId,models:[{id:'synthetic-live-model',name:'Synthetic',displayName:'Synthetic',description:'',contextWindow:null,capabilities:[],isRecommended:false}]};}});
  compiled = await builder.compile();
  prepare = compiled.get(Prepare);
  recovery = compiled.get(Recover); worker = compiled.get(Run);
  const Policy = await loadAi('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY');
  const parser = await loadAi('nodia-ai-conversation/nodia-ai-conversation-body-parser', 'createNodiaAiConversationBodyParser');
  const Filter = await loadAi('common/filters/all-exceptions.filter', 'AllExceptionsFilter');
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/nodia-ai', parser(compiled.get(Policy).admission.http_json_bytes));
  app.useGlobalFilters(new Filter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException();
    request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId };
    return true;
  } });
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1`;
  async function request(path, { actor = '1', method = 'GET', body, status = 200, key = randomUUID() } = {}) {
    const response = await fetch(base + path, { method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor, 'idempotency-key': key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if(path.includes('/secure-flow'))assert.equal(response.headers.get('cache-control'),'no-store');
    const value = response.status === 204 ? null : response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
    assert.ok((Array.isArray(status) ? status : [status]).includes(response.status), `${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }

  await db.query("SELECT setval(pg_get_serial_sequence('users','id'),(SELECT max(id) FROM users))");
  const [group] = await db.query("SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'");
  let [destination] = await db.query("SELECT id::text FROM modules WHERE link='/settings/ai-providers'");
  if (!destination) [destination] = await db.query("INSERT INTO modules(key,link,module_group_id) VALUES('synthetic_ai29_providers','/settings/ai-providers',$1) RETURNING id::text",[group.id]);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',[destination.id]);
  let [manage] = await db.query("SELECT id::text FROM actions WHERE key='ai:manage'");
  if (!manage) [manage] = await db.query("INSERT INTO actions(key) VALUES('ai:manage') RETURNING id::text");
  const [role] = await db.query("INSERT INTO roles(key) VALUES('synthetic_ai29_manager') RETURNING id::text");
  await db.query('INSERT INTO role_actions(role_id,action_id) VALUES($1,$2)',[role.id,manage.id]);
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES(1,$1),(2,$1)',[role.id]);
  const [geminiCatalog] = await db.query("INSERT INTO ai_provider_catalog(key,name,can_use_api_key,can_use_token_plan_web,can_use_token_plan_agentic) VALUES('gemini','Synthetic Gemini',true,true,true) ON CONFLICT(key) DO UPDATE SET is_active=true,can_use_api_key=true,can_use_token_plan_web=true,can_use_token_plan_agentic=true RETURNING id::text");
  const [openaiCatalog] = await db.query("INSERT INTO ai_provider_catalog(key,name,can_use_api_key,can_use_token_plan_web,can_use_token_plan_agentic) VALUES('openai','Synthetic OpenAI',true,false,true) ON CONFLICT(key) DO UPDATE SET is_active=true,can_use_api_key=true,can_use_token_plan_web=false,can_use_token_plan_agentic=true RETURNING id::text");
  const [connection] = await db.query("INSERT INTO ai_providers(catalog_id,name,use_api_key,use_token_plan_web,use_token_plan_agentic,default_mode) VALUES($1,'Synthetic AI29 connection',true,true,true,'token_plan_web') RETURNING id::text",[geminiCatalog.id]);
  const [openai] = await db.query("INSERT INTO ai_providers(catalog_id,name,use_api_key,use_token_plan_web,use_token_plan_agentic,default_mode) VALUES($1,'Synthetic AI29 Codex',true,false,true,'token_plan_agentic') RETURNING id::text",[openaiCatalog.id]);
  const tools={api_key_create:'nodia_secure_flows_prepare_api_key_create',api_key_update:'nodia_secure_flows_prepare_api_key_update',api_key_delete:'nodia_api_keys_prepare_delete',connection_login:'nodia_secure_flows_prepare_connection_login',nodia_logout:'nodia_secure_flows_prepare_nodia_logout',codex_logout:'nodia_ai_providers_prepare_codex_logout',gemini_web_logout:'nodia_ai_providers_prepare_gemini_web_logout',sync_models:'nodia_ai_providers_prepare_sync_models'};
  async function proposal(kind, partial={}, actor='1') {
    const chat=randomUUID(),identity=identities.get(actor);
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI29 only',clock_timestamp()+interval '90 days')",[chat,identity.userId,randomUUID(),'a'.repeat(64)]);
    const result=await db.transaction(manager=>prepare.execute(manager,identity,{conversationId:chat,toolName:tools[kind],partial}));
    assert.equal(result.status,'ready',JSON.stringify(result));return {chat,result,...result.proposal};
  }
  async function admit(p,actor='1') {
    const challenge=await request(`/nodia-ai/proposals/${p.proposal_id}/confirmation-challenge`,{actor,method:'POST',body:{proposal_revision:p.revision,expected_hash:p.hash}});
    const value=await request(`/nodia-ai/proposals/${p.proposal_id}/confirm`,{actor,method:'POST',status:202,body:{client_request_id:randomUUID(),proposal_revision:p.revision,expected_hash:p.hash,confirmation_token:challenge.confirmation_token}});return value.execution;
  }
  const count=async(table,where='true',values=[])=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,values))[0].n;
  const row=async(table,id)=>(await db.query(`SELECT * FROM ${table} WHERE id=$1`,[id]))[0];
  const operation=(id,actor='1')=>request(`/nodia-ai/operations/${id}`,{actor});
  const detail=(id,actor='1')=>request(`/nodia-ai/operations/${id}/secure-flow`,{actor});
  async function pause(kind,partial={},actor='1') {
    const p=await proposal(kind,partial,actor),admitted=await admit(p,actor);
    assert.equal(await worker.execute(randomUUID(),new AbortController().signal),true);
    const state=await operation(admitted.execution_id,actor);assert.equal(state.state,'waiting_for_user',JSON.stringify(state));
    const info=await detail(admitted.execution_id,actor);assert.equal(info.flow.kind,kind);
    exercised.add(kind);return {id:admitted.execution_id,p,actor,...info};
  }
  async function action(f,name,payload,options={}) {
    const body=options.body??{expected_execution_revision:f.flow.revision,client_request_id:randomUUID(),...(payload===undefined?{}:{payload})};
    const response=await request(`/nodia-ai/operations/${f.id}/secure-flow/${f.flow.reference}/${name}`,{actor:options.actor??f.actor??'1',method:'POST',body,status:options.status??200});
    if(response?.flow)f.flow=response.flow;return response;
  }
  const nativeKey=async label=>(await request('/ai-api-keys',{method:'POST',status:201,body:{provider_id:connection.id,label,secret:'synthetic-native-key-'+randomUUID()}}));
  const secure=await pause('api_key_create',{provider_id:connection.id,label:'Human synthetic key'});
  const [stepBefore]=await db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1',[secure.id]);
  const [jobBefore]=await db.query('SELECT * FROM nodia_ai_jobs WHERE execution_id=$1',[secure.id]);
  check('worker establishes waiting_for_user without provider calls or native session dispatch',nativeStarts===0&&stepBefore.state==='waiting_for_user'&&jobBefore.state==='waiting');
  check('human pause closes attempt and releases SQL worker lease and inference slots',jobBefore.lease_owner===null&&jobBefore.lease_until===null&&await count('nodia_ai_job_attempts','ended_at IS NULL')===0&&await count('nodia_ai_runtime_slots')===0);
  check('human flow exposes only opaque reference and exact frozen metadata',secure.flow.provider_id===connection.id&&secure.flow.key_id===null&&secure.flow.status==='waiting'&&!JSON.stringify(secure).includes('secret_ciphertext'));
  await request(`/nodia-ai/operations/${secure.id}/secure-flow`,{actor:'2',status:404});
  check('another module-enabled manager cannot inspect another owners secure interaction',true);
  const secondSession={...identities.get('1'),sessionId:randomUUID()};identities.set('same-user-other-session',secondSession);
  await db.query("INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,1,'synthetic',clock_timestamp()+interval '1 hour')",[secondSession.sessionId]);
  await request(`/nodia-ai/operations/${secure.id}/secure-flow`,{actor:'same-user-other-session',status:404});
  check('same user in a different authenticated session cannot control this flow',true);
  const secret='synthetic-human-only-'+randomUUID(),keyBody={expected_execution_revision:secure.flow.revision,client_request_id:randomUUID(),payload:{secret}};
  await action(secure,'key',undefined,{body:keyBody});
  let [created]=await db.query('SELECT * FROM ai_api_keys WHERE provider_id=$1',[connection.id]);
  const [receipt]=await db.query('SELECT minimal_receipt,recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1',[secure.id]);
  check('human key submission commits encrypted native key and opaque receipt atomically',created.secret_ciphertext.startsWith('v2:')&&!created.secret_ciphertext.includes(secret)&&receipt.minimal_receipt.id===secure.flow.reference&&receipt.minimal_receipt.operation==='api_key_create');
  const modelSurfaces=await db.query('SELECT row_to_json(p)::text data FROM nodia_ai_proposal_steps p UNION ALL SELECT row_to_json(s)::text FROM nodia_ai_execution_steps s UNION ALL SELECT row_to_json(e)::text FROM nodia_ai_events e');
  check('proposal steps execution receipts events and recovery witnesses never persist the entered secret',modelSurfaces.every(v=>!v.data.includes(secret)));
  await action(secure,'key',undefined,{body:keyBody});
  check('same human request after committed result recovers without creating another key',await count('ai_api_keys','provider_id=$1',[connection.id])===1);
  const updated=await pause('api_key_update',{provider_id:connection.id,key_id:created.id,label:'Human renamed key'});
  await action(updated,'key',{secret:'synthetic-replacement-'+randomUUID()});
  check('key replacement retains native key identity and updates the frozen label',(await row('ai_api_keys',created.id)).label==='Human renamed key'&&await count('ai_api_keys','provider_id=$1',[connection.id])===1);
  const beforeMetadata=(await row('ai_api_keys',created.id)).secret_ciphertext;
  const metadataOnly=await pause('api_key_update',{provider_id:connection.id,key_id:created.id,label:'Metadata only edit'});await action(metadataOnly,'key',{});
  check('metadata-only key edit preserves ciphertext and applies only confirmed public fields',(await row('ai_api_keys',created.id)).label==='Metadata only edit'&&(await row('ai_api_keys',created.id)).secret_ciphertext===beforeMetadata);
  const extra=await nativeKey('Native second');
  await Promise.all([request('/ai-api-keys/'+created.id,{method:'PUT',body:{is_selected:true}}),request('/ai-api-keys/'+extra.id,{method:'PUT',body:{is_selected:true}})]);
  check('native REST concurrent selection still serializes to one selected active key',await count('ai_api_keys','provider_id=$1 AND is_selected=true AND is_active=true',[connection.id])===1);
  const deleted=await pause('api_key_delete',{provider_id:connection.id,key_id:extra.id});await action(deleted,'delete');
  check('human key deletion and sole-active selection commit with the same opaque receipt',await count('ai_api_keys','id=$1',[extra.id])===0&&(await row('ai_api_keys',created.id)).is_selected===true);
  const cancelled=await pause('api_key_create',{provider_id:connection.id,label:'Never create cancelled'});await action(cancelled,'cancel');
  check('cancel before human dispatch closes job and retains no domain key',(await operation(cancelled.id)).state==='cancelled'&&await count('ai_api_keys',"label='Never create cancelled'")===0);
  const stale=await pause('api_key_update',{provider_id:connection.id,key_id:created.id,label:'Must reject stale'});
  await request('/ai-api-keys/'+created.id,{method:'PUT',body:{label:'Changed through native REST'}});
  await action(stale,'key',{secret:'synthetic-never-commit'},{status:409});
  check('native key metadata change invalidates the exact confirmed proposal',(await row('ai_api_keys',created.id)).label==='Changed through native REST');
  await action(stale,'cancel');
  check('human can cancel a stale proposal without requiring unchanged domain fields',(await operation(stale.id)).state==='cancelled');
  // Force the receipt writer to fail after encryption/native insertion: the domain row must roll back.
  const rollback=await pause('api_key_create',{provider_id:connection.id,label:'Must rollback key'});
  await db.query("CREATE FUNCTION synthetic_ai29_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai29_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai29_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai29_receipt_failure()");
  try{await action(rollback,'key',{secret:'synthetic-rollback-key'},{status:500});}finally{await db.query('DROP TRIGGER synthetic_ai29_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai29_receipt_failure()');}
  check('failed receipt rolls back native encrypted key and keeps human flow reviewable',await count('ai_api_keys',"label='Must rollback key'")===0&&(await detail(rollback.id)).flow.status==='waiting');
  await action(rollback,'key',{secret:'synthetic-rollback-key'});
  check('explicit retry after proven SQL rollback creates exactly one native key',await count('ai_api_keys',"label='Must rollback key'")===1);

  const Store=await loadAi('nodia-ai-execution/nodia-ai-execution.service','NodiaAiExecutionService'),store=compiled.get(Store),transaction=store.transaction.bind(store);
  const lost=await pause('api_key_create',{provider_id:connection.id,label:'Lost commit key'}),lostBody={expected_execution_revision:lost.flow.revision,client_request_id:randomUUID(),payload:{secret:'synthetic-lost-commit-secret'}};
  let loseCommit=true;
  store.transaction=async work=>{const result=await transaction(work);if(loseCommit&&result?.flow?.status==='completed'){loseCommit=false;throw Error('synthetic_ai29_commit_response_lost');}return result;};
  try{await action(lost,'key',undefined,{body:lostBody,status:500});}finally{store.transaction=transaction;}
  await action(lost,'key',undefined,{body:lostBody});
  check('lost key COMMIT acknowledgement recovers completed receipt without a second encrypted key',await count('ai_api_keys',"label='Lost commit key'")===1&&(await operation(lost.id)).state==='completed');
  const revoked=await pause('api_key_create',{provider_id:connection.id,label:'Revoked manager key'},'2');
  await db.query('UPDATE role_actions SET is_active=false WHERE role_id=$1 AND action_id=$2',[role.id,manage.id]);
  await action(revoked,'key',{secret:'synthetic-revoked'},{status:403});
  check('revoking ai:manage after confirmation prevents the human credential effect',await count('ai_api_keys',"label='Revoked manager key'")===0);
  await db.query('UPDATE role_actions SET is_active=true WHERE role_id=$1 AND action_id=$2',[role.id,manage.id]);
  await action(revoked,'cancel');
  const expired=await pause('api_key_create',{provider_id:connection.id,label:'Expired flow key'});
  await db.query("UPDATE nodia_ai_execution_steps SET recovery_descriptor=jsonb_set(recovery_descriptor,'{expires_at}',to_jsonb((clock_timestamp()-interval '1 second')::text)) WHERE execution_id=$1",[expired.id]);
  await action(expired,'key',{secret:'synthetic-expired'},{status:410});
  check('expired human interaction refuses dispatch and persists no credential',await count('ai_api_keys',"label='Expired flow key'")===0);
  const Sweep=await loadAi('nodia-ai-secure-flow/use-case/recover-nodia-ai-secure-flows.use-case','RecoverNodiaAiSecureFlowsUseCase'),sweep=compiled.get(Sweep);
  await sweep.execute();
  check('expiry sweep closes a never dispatched human flow and releases queue capacity',(await row('nodia_ai_executions',expired.id)).state==='failed');
  const login=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_web'});
  const started=await action(login,'start');
  check('login starts only from the authenticated human channel after worker pause',nativeStarts===1&&started.interaction.kind==='gemini_web'&&started.flow.status==='pending');
  const [privateLogin]=await db.query('SELECT recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1',[login.id]);
  check('private native login reference is absent from public operation and flow projections',!!privateLogin.recovery_descriptor.native_reference.job_id&&!JSON.stringify(await operation(login.id)).includes(privateLogin.recovery_descriptor.native_reference.job_id)&&!JSON.stringify(started.flow).includes(privateLogin.recovery_descriptor.native_reference.job_id));
  const frame=await action(login,'frame');check('viewer frame remains exclusively in the dedicated no-store human channel',frame.frame.ready===false);
  await action(login,'input',{frame_id:'a'.repeat(32),action:'text',text:'synthetic-password-never-model'});
  check('viewer input is never persisted in descriptors events or transcripts',!(await db.query('SELECT row_to_json(s)::text data FROM nodia_ai_execution_steps s')).some(v=>v.data.includes('synthetic-password-never-model')));
  nativeCompleted=true;await action(login,'status');nativeCompleted=false;
  check('only observed native login success completes the human pause',(await operation(login.id)).state==='completed');
  const agentic=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_agentic'});await action(agentic,'start');
  await action(agentic,'code',{code:'synthetic-native-auth-code'});
  check('Agentic authorization code travels only through the human/native bridge',!(await db.query('SELECT row_to_json(s)::text data FROM nodia_ai_execution_steps s')).some(v=>v.data.includes('synthetic-native-auth-code')));
  await action(agentic,'cancel');check('native cancellation closes only its owning human flow',(await operation(agentic.id)).state==='cancelled');
  const codex=await pause('connection_login',{provider_id:openai.id,mode:'token_plan_agentic'});const codexStarted=await action(codex,'start');
  check('Codex login remains independent and targets the exact configured connection',codexStarted.interaction.kind==='codex');
  check('device codes and authorization URLs are returned only in human interaction and excluded from durable records',codexStarted.interaction.data.userCode==='SYNTHETIC-123'&&!(await db.query('SELECT row_to_json(s)::text data FROM nodia_ai_execution_steps s')).some(v=>v.data.includes('SYNTHETIC-123')||v.data.includes('synthetic-human-only=true')));await action(codex,'cancel');
  const busyLogin=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_web'});busy=true;
  await action(busyLogin,'start',undefined,{status:409});busy=false;Object.assign(busyLogin,await detail(busyLogin.id));
  check('occupied native profile preserves its armed request as uncertain without changing mode',busyLogin.flow.status==='unknown');
  const busyStarts=nativeStarts;await action(busyLogin,'start',undefined,{status:409});await action(busyLogin,'cancel');
  const freshLogin=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_web'});await action(freshLogin,'start');await action(freshLogin,'cancel');
  check('fenced busy request is never restarted; a separately confirmed fresh login uses no inference slot',nativeStarts===busyStarts+1&&await count('nodia_ai_runtime_slots')===0);

  const disabledLogin=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_web'});await action(disabledLogin,'start');
  await db.query('UPDATE ai_providers SET is_active=false,use_token_plan_web=false WHERE id=$1',[connection.id]);
  await action(disabledLogin,'status');await action(disabledLogin,'cancel');
  check('observing and cancelling a known login remains possible after disabling its connection and channel',(await operation(disabledLogin.id)).state==='cancelled');
  const disabledLogout=await pause('gemini_web_logout',{provider_id:connection.id});await action(disabledLogout,'logout');
  check('an authorized human can explicitly log out an already disabled connection',(await operation(disabledLogout.id)).state==='completed');
  await assert.rejects(proposal('connection_login',{provider_id:connection.id,mode:'token_plan_web'}));
  check('disabling the channel still prevents preparing a new native login',true);
  await db.query('UPDATE ai_providers SET is_active=true,use_token_plan_web=true WHERE id=$1',[connection.id]);
  const webLogout=await pause('gemini_web_logout',{provider_id:connection.id});await action(webLogout,'logout');
  const codexLogout=await pause('codex_logout',{provider_id:openai.id});await action(codexLogout,'logout');
  check('Web and Codex logout use their separate real native bridge operations',(await operation(webLogout.id)).state==='completed'&&(await operation(codexLogout.id)).state==='completed');
  const sync=await pause('sync_models',{provider_id:connection.id,mode:'token_plan_web'});await action(sync,'sync');
  check('remote discovery merges observed models only in the final receipt transaction',(await row('ai_providers',connection.id)).fields.token_plan_web.available_models[0].id==='synthetic-live-model'&&(await operation(sync.id)).state==='completed');
  const verifyRejected=await proposal('api_key_create',{provider_id:connection.id,label:'Secret rejected'});
  const chatBefore=await row('nodia_ai_conversations',verifyRejected.chat);
  await assert.rejects(proposal('api_key_create',{provider_id:connection.id,label:'Wrong input',secret:'never-model-secret'}));
  check('preparers reject secrets rather than accepting model authored credentials',chatBefore.active_job_id===null);
  const waitFor=async(read,predicate,description,timeout=20000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await read();if(predicate(value))return value;await delay(30);}throw Error('Timed out: '+description);};
  const childWorker=async(extraEnvironment={})=>{
    const child=fork(fileURLToPath(new URL('./nodia-ai-ai29-worker.fixture.mjs',import.meta.url)),[],{cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,silent:true,env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODIA_AI29_FIXTURE_DB:JSON.stringify(options),...extraEnvironment}});
    children.add(child);const messages=[];let output='',exited;
    child.on('message',message=>messages.push(message));child.on('exit',(code,signal)=>{exited={code,signal};children.delete(child);});child.on('error',error=>{exited={message:error.message};});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-32768);});
    const next=async type=>waitFor(async()=>{const message=messages.find(value=>value.type===type||value.type==='error');if(message?.type==='error')throw Error(JSON.stringify(message));if(exited)throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);return message;},Boolean,'child '+type);
    await next('ready');return {child,next};
  };

  const nativeTransportToken=randomBytes(32).toString('hex'),nativeTransportJob=randomBytes(16).toString('hex'),nativeTransportRequests=[];
  nativeTransport=createServer((req,res)=>{
    nativeTransportRequests.push({method:req.method,url:req.url,actor:req.headers['x-nodia-actor-id'],authenticated:req.headers['x-nodia-service-token']===nativeTransportToken});
    const allowed=req.headers['x-nodia-actor-id']==='1'&&req.headers['x-nodia-service-token']===nativeTransportToken;
    const validPath=req.url===`/auth/login/${nativeTransportJob}`||req.url===`/auth/login/${nativeTransportJob}/cancel`;
    res.writeHead(allowed&&validPath?200:404,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify(allowed&&validPath?{id:nativeTransportJob,state:req.method==='POST'?'cancelled':'running'}:{}));
  });
  await new Promise(resolve=>nativeTransport.listen(0,'127.0.0.1',resolve));
  const nativeProcess=await childWorker({GEMINI_MICROSERVICE_URL:`http://127.0.0.1:${nativeTransport.address().port}`,GEMINI_SERVICE_TOKEN:nativeTransportToken});
  const durableWebRef={provider_id:connection.id,provider_key:'gemini',mode:'token_plan_web',job_id:nativeTransportJob};
  nativeProcess.child.send({type:'secure-observe',reference:durableWebRef,identity:identities.get('1')});
  assert.equal((await nativeProcess.next('secure-observed')).state,'pending');
  check('a separate Node process observes a durable Web login through the actual authenticated private HTTP transport',nativeTransportRequests[0].method==='GET'&&nativeTransportRequests[0].authenticated&&nativeTransportRequests[0].actor==='1');
  nativeProcess.child.send({type:'secure-cleanup',reference:durableWebRef,actorId:'1'});
  assert.equal((await nativeProcess.next('secure-cleaned')).state,'cancelled');
  check('a worker without an in-memory Web login owner cancels exactly the native owned job over private HTTP',nativeTransportRequests[1].url===`/auth/login/${nativeTransportJob}/cancel`&&nativeTransportRequests[1].method==='POST'&&nativeTransportRequests[1].authenticated);
  await kill(nativeProcess.child);await new Promise(resolve=>nativeTransport.close(resolve));nativeTransport=undefined;
  const crashed=await admit(await proposal('api_key_create',{provider_id:connection.id,label:'Crash resumed key'}));
  const crashing=await childWorker();crashing.child.send({type:'claim',workerId:randomUUID()});assert.equal((await crashing.next('claimed')).claim.executionId,crashed.execution_id);await kill(crashing.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1",[crashed.execution_id]);await recovery.execute();const crashResult=await operation(crashed.execution_id);
  check('real child death before human pause produces no credential or native login',crashResult.state==='failed'&&crashResult.can_resume&&await count('ai_api_keys',"label='Crash resumed key'")===0);
  const resumeBody={client_request_id:randomUUID(),expected_execution_revision:crashResult.revision};
  await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});
  await worker.execute(randomUUID(),new AbortController().signal);const recoveredFlow={id:crashed.execution_id,...await detail(crashed.execution_id)};await action(recoveredFlow,'key',{secret:'synthetic-crash-recovery'});
  check('explicit duplicate resume reuses the execution and commits exactly one encrypted key',await count('ai_api_keys',"label='Crash resumed key'")===1&&(await operation(crashed.execution_id)).state==='completed');

  const revokedLogin=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_web'},'2');await action(revokedLogin,'start');
  await db.query('UPDATE role_actions SET is_active=false WHERE role_id=$1 AND action_id=$2',[role.id,manage.id]);
  await sweep.execute();
  check('authority revocation during native login cancels only the owned job and reconciles the paused execution',(await row('nodia_ai_executions',revokedLogin.id)).state==='failed');
  await db.query('UPDATE role_actions SET is_active=true WHERE role_id=$1 AND action_id=$2',[role.id,manage.id]);
  const lateLogin=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_agentic'});await action(lateLogin,'start');
  await db.query("UPDATE nodia_ai_execution_steps SET recovery_descriptor=jsonb_set(recovery_descriptor,'{expires_at}',to_jsonb((clock_timestamp()-interval '1 second')::text)) WHERE execution_id=$1",[lateLogin.id]);
  nativeCompleted=true;await sweep.execute();nativeCompleted=false;
  check('expiry reconciliation records a natively completed login without resending its start',(await row('nodia_ai_executions',lateLogin.id)).state==='completed');

  const Expire=await loadAi('nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case','ExpireNodiaAiConversationsUseCase'),expire=compiled.get(Expire);
  const retentionLogin=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_web'});await action(retentionLogin,'start');
  const privateMessage=randomUUID();
  await db.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',1,$3,'sealed','{}',clock_timestamp(),$4)",[privateMessage,retentionLogin.p.chat,randomUUID(),'b'.repeat(64)]);
  await db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','synthetic-expiring-private-text')",[privateMessage,retentionLogin.p.chat]);
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[retentionLogin.p.chat]);
  await expire.execute();
  check('chat retention purges messages and keeps only unresolved native interaction identity',await count('nodia_ai_conversations','id=$1',[retentionLogin.p.chat])===0&&await count('nodia_ai_message_parts','message_id=$1',[privateMessage])===0&&await count('nodia_ai_executions','id=$1',[retentionLogin.id])===1);
  const beforeCleanupStarts=nativeStarts;await sweep.execute();
  check('detached native cleanup cancels the exact owned login after chat purge without replay',await count('nodia_ai_executions','id=$1',[retentionLogin.id])===0&&nativeStarts===beforeCleanupStarts);

  const retentionLate=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_agentic'});await action(retentionLate,'start');
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[retentionLate.p.chat]);await expire.execute();
  nativeCompleted=true;await sweep.execute();nativeCompleted=false;
  check('late native success after chat purge reconciles and removes the detached witness without recreating chat',await count('nodia_ai_executions','id=$1',[retentionLate.id])===0&&await count('nodia_ai_conversations','id=$1',[retentionLate.p.chat])===0);
  const ownLogout=await pause('nodia_logout',{},'2');await action(ownLogout,'logout');
  check('Nodia logout revokes only the confirmed current session atomically with its receipt',(await db.query('SELECT revoked_at FROM auth_sessions WHERE public_id=$1',[identities.get('2').sessionId]))[0].revoked_at!==null&&(await db.query('SELECT revoked_at FROM auth_sessions WHERE public_id=$1',[identities.get('1').sessionId]))[0].revoked_at===null);

  const codexRestart=await pause('connection_login',{provider_id:openai.id,mode:'token_plan_agentic'},'3');await action(codexRestart,'start');
  const [codexPrivate]=await db.query('SELECT recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1',[codexRestart.id]);
  nativeJobs.delete(codexPrivate.recovery_descriptor.native_reference.job_id);
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[codexRestart.p.chat]);await expire.execute();
  const startsBeforeCodexSweep=nativeStarts;await sweep.execute();
  check('missing/corrupted native proof preserves unknown instead of inventing cancellation',(await row('nodia_ai_executions',codexRestart.id)).state==='unknown'&&nativeStarts===startsBeforeCodexSweep&&(await db.query('SELECT minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1',[codexRestart.id]))[0].minimal_receipt===null);
  const unknown=await pause('connection_login',{provider_id:connection.id,mode:'token_plan_agentic'});loseStart=true;
  await action(unknown,'start',undefined,{status:409});loseStart=false;Object.assign(unknown,await detail(unknown.id));const startsAfterLoss=nativeStarts;
  await action(unknown,'start',undefined,{status:409});
  check('lost native start response remains unknown and never silently replays login',unknown.flow.status==='unknown'&&nativeStarts===startsAfterLoss);
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[unknown.p.chat]);await expire.execute();
  const [retainedUnknown]=await db.query("SELECT j.* FROM nodia_ai_jobs j WHERE j.recovery_descriptor->>'execution_id'=$1",[unknown.id]);
  check('lost start without a native reference retains a minimal unknown witness after chat deletion',await count('nodia_ai_conversations','id=$1',[unknown.p.chat])===0&&retainedUnknown?.state==='unknown'&&retainedUnknown.conversation_id===null&&retainedUnknown.execution_id===null);
  // Two uncertain jobs remain; maintenance budgets one native cleanup per pass.
  const startsBeforeUnknownSweep=nativeStarts;await sweep.execute();await sweep.execute();
  check('retention reconciles a lost start by durable request identity without restarting login',nativeStarts===startsBeforeUnknownSweep&&await count('nodia_ai_executions','id=$1',[unknown.id])===0);
  check('all eight secure operation contracts were exercised through real confirmation HTTP and PostgreSQL',exercised.size===8);
  check('secure pause does not invoke model inference or acquire nested inference runtime slots',providerCalls===0&&await count('nodia_ai_runtime_slots')===0);
  check('completed human effects leave no worker lease or unfinished claim attempt',await count('nodia_ai_jobs',"state='leased'")===0&&await count('nodia_ai_job_attempts','ended_at IS NULL')===0);
  console.log(JSON.stringify({stage:'AI-29',scope:'compiled_http_confirmation_worker_disposable_postgresql_eight_secure_operations_mocked_native_login_no_credentials',checks:checks.length,exercised_operations:[...exercised].sort(),native_start_calls:nativeStarts,native_private_http_fixture_requests:nativeTransportRequests.length,known_limitations:['Native transport simulated; real durable supervisors and provider accounts verified separately'],passed:checks},null,2));
}catch(error){console.error(JSON.stringify({stage:'AI-29',completed_checks:checks.length,last_checks:checks.slice(-4)}));throw error;}
finally{for(const child of children)await kill(child);if(nativeTransport)await new Promise(resolve=>nativeTransport.close(resolve));if(app)await app.close();await fixture.close();}
