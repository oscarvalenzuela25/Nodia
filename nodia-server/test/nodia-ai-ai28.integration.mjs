// Compiled native contracts, human confirmation HTTP, real PostgreSQL and worker processes.
// Synthetic disposable records only. Preparation is an internal port, never a published MCP assertion.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai28');
const { db, options, identities } = fixture;
const checks = [], children = new Set(), exercised = new Set();
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
let app, compiled, base, prepare, execute, claimer, recovery, worker, providerCalls = 0;
const kill = async child => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGKILL');
  await ended;
};
try {
  const [Confirmation, Execution, Conversation, Overview, Prepare, Execute, Claim, Recover, Run, Redis, Adapter] = await Promise.all([
    loadAi('nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'),
    loadAi('nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'),
    loadAi('nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'),
    loadAi('finance-overview/finance-overview.module', 'FinanceOverviewModule'),
    loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'),
    loadAi('nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'),
    loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase'),
    loadAi('common/redis/redis.service', 'RedisService'),
    loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'),
  ]);
  const nativeModules = [await loadAi('ai-provider/ai-provider.module', 'AiProviderModule')];
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Overview, ...nativeModules,
  ] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [], delByPattern: async () => {} });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => {
    providerCalls++; throw Error('Forbidden AI28 provider');
  }])));
  compiled = await builder.compile();
  prepare = compiled.get(Prepare); execute = compiled.get(Execute);
  claimer = compiled.get(Claim); recovery = compiled.get(Recover); worker = compiled.get(Run);
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
    const value = response.status === 204 ? null : response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
    assert.ok((Array.isArray(status) ? status : [status]).includes(response.status), `${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  // Destination catalogs are synthetic. A configured Core catalog is not touched.
  await db.query("SELECT setval(pg_get_serial_sequence('users','id'),(SELECT max(id) FROM users))");
  const [group] = await db.query("SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'");
  let [destination] = await db.query("SELECT id::text FROM modules WHERE link='/settings/ai-providers'");
  if (!destination) [destination] = await db.query("INSERT INTO modules(key,link,module_group_id) VALUES('synthetic_ai28_providers','/settings/ai-providers',$1) RETURNING id::text",[group.id]);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',[destination.id]);
  let [manage] = await db.query("SELECT id::text FROM actions WHERE key='ai:manage'");
  if (!manage) [manage] = await db.query("INSERT INTO actions(key) VALUES('ai:manage') RETURNING id::text");
  const [role] = await db.query("INSERT INTO roles(key) VALUES('synthetic_ai28_manager') RETURNING id::text");
  await db.query('INSERT INTO role_actions(role_id,action_id) VALUES($1,$2)',[role.id,manage.id]);
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES(1,$1),(2,$1)',[role.id]);
  const [geminiCatalog] = await db.query("INSERT INTO ai_provider_catalog(key,name,can_use_api_key,can_use_token_plan_web,can_use_token_plan_agentic) VALUES('gemini','Synthetic Gemini',true,true,true) ON CONFLICT(key) DO UPDATE SET is_active=true,can_use_api_key=true,can_use_token_plan_web=true,can_use_token_plan_agentic=true RETURNING id::text");
  const toolName = (resource, operation) => `nodia_ai_providers_prepare_${resource==='ai_provider_catalog'?'catalog_':''}${operation}`;
  async function proposal(resource, operation, partial, actor='1', expectedStatus='ready') {
    const chat=randomUUID(),identity=identities.get(actor);
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI28 only',clock_timestamp()+interval '90 days')",[chat,identity.userId,randomUUID(),'a'.repeat(64)]);
    const result=await db.transaction(manager=>prepare.execute(manager,identity,{conversationId:chat,toolName:toolName(resource,operation),partial}));
    assert.equal(result.status,expectedStatus,JSON.stringify(result));return {chat,result,...result.proposal};
  }
  async function admit(p,actor='1',expectedStatus=202) {
    const challenge=await request(`/nodia-ai/proposals/${p.proposal_id}/confirmation-challenge`,{actor,method:'POST',body:{proposal_revision:p.revision,expected_hash:p.hash}});
    const value=await request(`/nodia-ai/proposals/${p.proposal_id}/confirm`,{actor,method:'POST',status:expectedStatus,body:{client_request_id:randomUUID(),proposal_revision:p.revision,expected_hash:p.hash,confirmation_token:challenge.confirmation_token}});return value.execution;
  }
  const claim=()=>claimer.execute(randomUUID());
  const status=(id,actor='1')=>request(`/nodia-ai/operations/${id}`,{actor});
  const count=async(table,where='true',values=[])=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,values))[0].n;
  const row=async(table,id)=>(await db.query(`SELECT * FROM ${table} WHERE id=$1`,[id]))[0];
  const drive=async id=>{for(let n=0;n<12;n++){if(!['queued','running'].includes((await row('nodia_ai_executions',id)).state))return;await worker.execute(randomUUID(),new AbortController().signal);}throw Error('Synthetic execution did not finish: '+id);};
  const translations=label=>[{key:'name',es:label+' ES',en:label+' EN'}];
  async function perform(resource,operation,partial,actor='1') {
    const p=await proposal(resource,operation,partial,actor),admitted=await admit(p,actor),acquired=await claim();
    assert.equal(acquired.executionId,admitted.execution_id);
    const result=await execute.execute(identities.get(actor),admitted.execution_id,acquired);
    assert.equal(result.state,'completed');assert.equal(result.steps.length,1);
    const [step]=await db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1',[admitted.execution_id]);
    const receipt=step.minimal_receipt;assert.equal(receipt.resource_key,resource);assert.equal(receipt.operation,operation);
    assert.equal(receipt.schema_version,1);assert.equal(Object.hasOwn(receipt,'property_id'),false);
    if(operation!=='create')assert.equal(receipt.resource_id,partial.id);
    assert.equal(result.steps[0].result_refs[0].id,receipt.resource_id);
    await execute.execute(identities.get(actor),admitted.execution_id,acquired);
    assert.equal((await status(admitted.execution_id,actor)).state,'completed');
    exercised.add(`${resource}/${operation}`);return {id:receipt.resource_id,execution:result,proposal:p,claim:acquired,step};
  }
  const rejection=async(resource,operation,partial,actor='1',expected=[400,403,404,409])=>assert.rejects(proposal(resource,operation,partial,actor),error=>expected.includes(error.getStatus?.()));

  const catalog = await perform('ai_provider_catalog','create',{key:'  SYNTHETIC_AI28  ',name:'Synthetic catalog',can_use_api_key:true});
  await perform('ai_provider_catalog','update',{id:catalog.id,name:'Renamed synthetic catalog',is_active:false,can_use_api_key:false});
  check('catalog create normalizes key and update preserves key while changing independent activity/channel flags',(await row('ai_provider_catalog',catalog.id)).key==='synthetic_ai28'&&(await row('ai_provider_catalog',catalog.id)).is_active===false);
  const nativePartialCatalog=await request('/ai-providers/catalog/'+geminiCatalog.id,{method:'PUT',body:{name:'Native partial catalog'}});
  check('native ES2023 partial DTO response preserves every omitted catalog flag and activity',nativePartialCatalog.can_use_api_key===true&&nativePartialCatalog.can_use_token_plan_web===true&&nativePartialCatalog.can_use_token_plan_agentic===true&&nativePartialCatalog.is_active===true);
  const connection = await perform('ai_providers','create',{catalog_id:geminiCatalog.id,name:'Synthetic AI28 connection',use_token_plan_web:true,default_mode:'token_plan_web',translates:translations('Connection')});
  check('connection creation has no assigned models and only its first-connection default',Object.keys((await row('ai_providers',connection.id)).fields).join(',')==='available_models'&&(await row('ai_providers',connection.id)).is_default===true);
  check('connection translations commit with native record',await count('translations','source_entity=$1 AND source_id=$2',['ai_providers',connection.id])===2);
  await perform('ai_providers','update',{id:connection.id,name:'Updated connection',auto_rotate_api_keys:false});
  check('four exact preparer/executor identities exercise native create/update and replay receipts',exercised.size===4);
  const storedSecret='synthetic-only-never-model-visible';
  const originalFields={legacy_secret:storedSecret,token_plan_web:{selected_model:'synthetic-model-one',ocr_model:'synthetic-ocr',ocr_focus_model:'synthetic-focus',thinking_levels:{'synthetic-model-one':'medium',other:'low'},available_models:[{id:'synthetic-model-one',supportedReasoningEfforts:['medium','high']},{id:'synthetic-model-two',supportedReasoningEfforts:['high']}],hidden:{secret:storedSecret}},api_key:{selected_model:'synthetic-api-model'}};
  await db.query('UPDATE ai_providers SET fields=$2 WHERE id=$1',[connection.id,originalFields]);
  const modelProposal = await proposal('ai_providers','update',{id:connection.id,'token_plan_web.selected_model':'synthetic-model-two','token_plan_web.thinking_level':'high'});
  const [payload] = await db.query('SELECT * FROM nodia_ai_proposal_steps WHERE proposal_id=$1',[modelProposal.proposal_id]);
  check('preview and stored payload exclude arbitrary historical credentials',!JSON.stringify(modelProposal).includes(storedSecret)&&!JSON.stringify(payload).includes(storedSecret));
  const admittedModel=await admit(modelProposal),modelClaim=await claim();
  await execute.execute(identities.get('1'),admittedModel.execution_id,modelClaim);
  const updatedFields=(await row('ai_providers',connection.id)).fields;
  check('exact dynamic model and per-model effort update preserve OCR other modes and hidden historical data',updatedFields.token_plan_web.selected_model==='synthetic-model-two'&&updatedFields.token_plan_web.thinking_levels['synthetic-model-two']==='high'&&updatedFields.token_plan_web.ocr_model==='synthetic-ocr'&&updatedFields.api_key.selected_model==='synthetic-api-model'&&updatedFields.legacy_secret===storedSecret&&updatedFields.token_plan_web.hidden.secret===storedSecret);
  await rejection('ai_providers','update',{id:connection.id,'token_plan_web.selected_model':'unknown-unconfigured-model'});
  await rejection('ai_providers','update',{id:connection.id,fields:{secret:'rejected'}});
  await rejection('ai_providers','update',{id:connection.id,secret:'rejected'});
  await rejection('ai_provider_catalog','update',{id:catalog.id,key:'identity-change'});
  await rejection('ai_providers','update',{id:connection.id,catalog_id:catalog.id});
  check('closed AI contracts reject arbitrary fields credentials catalog reassignment and unknown models',true);
  const getConnection = () => row('ai_providers',connection.id);
  const Service=await loadAi('ai-provider/ai-provider.service','AiProviderService'),service=compiled.get(Service);
  await db.query('UPDATE ai_providers SET fields=$2 WHERE id=$1',[connection.id,{selected_model:'legacy-flat',ocr_model:'legacy-ocr',thinking_level:'legacy-effort',enable_extended_thinking:false,available_models:[{id:'legacy-flat'},{id:'new-flat'}],historical_secret:storedSecret}]);
  await perform('ai_providers','update',{id:connection.id,'token_plan_web.selected_model':'new-flat'});
  const legacy=(await getConnection()).fields;
  check('legacy flat settings survive first scoped update without copying hidden data to another mode',legacy.token_plan_web.selected_model==='new-flat'&&legacy.token_plan_web.ocr_model==='legacy-ocr'&&legacy.token_plan_web.thinking_level==='legacy-effort'&&legacy.token_plan_web.enable_extended_thinking===false&&legacy.historical_secret===storedSecret&&!Object.hasOwn(legacy.token_plan_web,'historical_secret'));
  await service.mergeDiscoveredModels(connection.id,'token_plan_web',[{id:'new-observed',name:'new-observed',displayName:'new-observed',description:'',contextWindow:null,capabilities:[],isRecommended:false}]);
  const afterDiscovery=(await getConnection()).fields;
  check('post-network discovery merges only observed catalog and preserves confirmed configuration',afterDiscovery.token_plan_web.selected_model==='new-flat'&&afterDiscovery.token_plan_web.ocr_model==='legacy-ocr'&&afterDiscovery.historical_secret===storedSecret&&afterDiscovery.token_plan_web.available_models[0].id==='new-observed');
  await perform('ai_providers','update',{id:connection.id,'token_plan_web.selected_model':'new-flat'});
  check('historical configured model remains editable without silently selecting the first discovered model',(await getConnection()).fields.token_plan_web.selected_model==='new-flat');
  const stale=await proposal('ai_providers','update',{id:connection.id,name:'Must reject stale'});
  await request('/ai-providers/'+connection.id,{method:'PUT',body:{name:'Changed through native REST'}});
  await assert.rejects(admit(stale),()=>true);
  check('native REST change invalidates an earlier exact proposal',(await getConnection()).name==='Changed through native REST');
  const concurrent=await Promise.all([1,2].map(n=>request('/ai-providers',{method:'POST',status:201,body:{catalog_id:geminiCatalog.id,name:'Concurrent default '+n,is_default:true}})));
  check('concurrent native defaults serialize to one global default with both records intact',await count('ai_providers','is_default=true')===1&&concurrent.length===2);
  const duplicateCatalogs=await Promise.all([1,2].map(()=>request('/ai-providers/catalog',{method:'POST',status:[201,409],body:{key:'synthetic_ai28_concurrent',name:'Concurrent key'}})));
  check('concurrent native catalog creation produces one normalized key and one explicit conflict',await count('ai_provider_catalog',"key='synthetic_ai28_concurrent'")===1&&duplicateCatalogs.filter(value=>value.id).length===1);

  // Catalog changes do not mutate existing connection flags or claim runtime availability.
  await perform('ai_provider_catalog','update',{id:geminiCatalog.id,can_use_token_plan_web:false});
  check('catalog capability is independent of enabled connection and runtime availability',(await getConnection()).use_token_plan_web===true);
  await rejection('ai_providers','create',{catalog_id:geminiCatalog.id,use_token_plan_web:true});
  await perform('ai_provider_catalog','update',{id:geminiCatalog.id,can_use_token_plan_web:true});
  // A cached/chosen identity cannot authorize a later effect after ai:manage revocation.
  const revoked=await admit(await proposal('ai_providers','update',{id:connection.id,name:'Revoked manager'},'2'),'2'),revokedClaim=await claim();
  await db.query('UPDATE role_actions SET is_active=false WHERE role_id=$1 AND action_id=$2',[role.id,manage.id]);
  await assert.rejects(execute.execute(identities.get('2'),revoked.execution_id,revokedClaim),error=>[403,409].includes(error.getStatus?.()));
  await recovery.execute(revokedClaim,'nodia_ai:capability_denied');
  check('live ai:manage revocation prevents a previously confirmed provider effect',(await getConnection()).name==='Changed through native REST');
  await db.query('UPDATE role_actions SET is_active=true WHERE role_id=$1 AND action_id=$2',[role.id,manage.id]);
  const Config=await loadAi('ai-provider/use-case/save-ai-provider-configuration.use-case','SaveAiProviderConfigurationUseCase'),native=compiled.get(Config);
  await assert.rejects(db.transaction(manager=>native.execute(connection.id,{name:'No frontier'},{...identities.get('1'),transaction:manager})),error=>error.getStatus?.()===403);
  check('inherited active SQL manager without actual authority locks is rejected before writing',(await getConnection()).name==='Changed through native REST');
  const queryRunner=db.createQueryRunner();await queryRunner.connect();await queryRunner.startTransaction();
  const lockAuthority=await loadAi('authorization/authority-transaction','lockAuthority');
  await lockAuthority(queryRunner.manager);await queryRunner.commitTransaction();await queryRunner.startTransaction();
  try{await assert.rejects(native.execute(connection.id,{name:'Reused stale frontier'},{...identities.get('1'),transaction:queryRunner.manager}),error=>error.getStatus?.()===403);}finally{await queryRunner.rollbackTransaction();await queryRunner.release();}
  check('reused QueryRunner cannot retain a previous authority frontier',(await getConnection()).name==='Changed through native REST');
  const receiptFailure=async work=>{
    await db.query("CREATE FUNCTION synthetic_ai28_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai28_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai28_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai28_receipt_failure()");
    try{await assert.rejects(work);}finally{await db.query('DROP TRIGGER synthetic_ai28_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai28_receipt_failure()');}
  };
  const beforeDefaults=await db.query('SELECT id::text FROM ai_providers WHERE is_default=true ORDER BY id'),beforeFields=(await getConnection()).fields,beforeName=(await getConnection()).name;
  const failed=await admit(await proposal('ai_providers','update',{id:connection.id,name:'Must rollback',is_default:true,translates:translations('Must rollback')})),failedClaim=await claim();
  await receiptFailure(()=>execute.execute(identities.get('1'),failed.execution_id,failedClaim));await recovery.execute(failedClaim,'nodia_ai:execution_conflict');
  check('receipt failure rolls back provider name defaults and translations atomically',(await getConnection()).name===beforeName&&JSON.stringify(await db.query('SELECT id::text FROM ai_providers WHERE is_default=true ORDER BY id'))===JSON.stringify(beforeDefaults)&&(await db.query("SELECT value FROM translations WHERE source_entity='ai_providers' AND source_id=$1",[connection.id])).every(row=>!row.value.includes('Must rollback')));
  check('rollback preserves original hidden configuration bytes',JSON.stringify((await getConnection()).fields)===JSON.stringify(beforeFields));
  const waitFor=async(read,predicate,description,timeout=20000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await read();if(predicate(value))return value;await delay(30);}throw Error('Timed out: '+description);};
  const childWorker=async()=>{
    const child=fork(fileURLToPath(new URL('./nodia-ai-ai28-worker.fixture.mjs',import.meta.url)),[],{cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,silent:true,env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODIA_AI28_FIXTURE_DB:JSON.stringify(options)}});
    children.add(child);const messages=[];let output='',exited;
    child.on('message',message=>messages.push(message));child.on('exit',(code,signal)=>{exited={code,signal};children.delete(child);});child.on('error',error=>{exited={message:error.message};});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-32768);});
    const next=async type=>waitFor(async()=>{const message=messages.find(value=>value.type===type||value.type==='error');if(message?.type==='error')throw Error(JSON.stringify(message));if(exited)throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);return message;},Boolean,'child '+type);
    await next('ready');return {child,next};
  };
  const crashed=await admit(await proposal('ai_provider_catalog','create',{key:'synthetic_ai28_crash_resume',name:'Crash resume'}));
  const crashing=await childWorker();crashing.child.send({type:'claim',workerId:randomUUID()});assert.equal((await crashing.next('claimed')).claim.executionId,crashed.execution_id);await kill(crashing.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1",[crashed.execution_id]);await recovery.execute();const crashResult=await status(crashed.execution_id);
  check('real child death after claim leaves no administrative mutation and permits explicit recovery',crashResult.state==='failed'&&crashResult.can_resume&&await count('ai_provider_catalog',"key='synthetic_ai28_crash_resume'")===0);
  const resumeBody={client_request_id:randomUUID(),expected_execution_revision:crashResult.revision};
  await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});
  await drive(crashed.execution_id);
  check('duplicate human resume commits one provider catalog row and its exact receipt',(await status(crashed.execution_id)).state==='completed'&&await count('ai_provider_catalog',"key='synthetic_ai28_crash_resume'")===1);
  const lost=await admit(await proposal('ai_provider_catalog','create',{key:'synthetic_ai28_lost_commit',name:'Lost commit'})),lostClaim=await claim();
  const Store=await loadAi('nodia-ai-execution/nodia-ai-execution.service','NodiaAiExecutionService'),store=compiled.get(Store),transaction=store.transaction.bind(store);
  store.transaction=async work=>{await transaction(work);throw Error('synthetic_ai28_post_commit_response_lost');};
  try{await assert.rejects(execute.execute(identities.get('1'),lost.execution_id,lostClaim),error=>error.getStatus?.()===503);}finally{store.transaction=transaction;}
  await recovery.execute();const recovered=await execute.execute(identities.get('1'),lost.execution_id,lostClaim);
  check('lost provider COMMIT response recovers historical receipt without replaying native creation',recovered.state==='completed'&&await count('ai_provider_catalog',"key='synthetic_ai28_lost_commit'")===1);
  check('administrative effects never invoke providers or inference slots',providerCalls===0&&await count('nodia_ai_runtime_slots')===0);
  check('execution attempts and leases finish without orphaned jobs',await count('nodia_ai_job_attempts','ended_at IS NULL')===0&&await count('nodia_ai_jobs',"state='leased'")===0);
  console.log(JSON.stringify({stage:'AI-28',scope:'compiled_http_confirmation_worker_disposable_postgresql_four_provider_operations_no_provider',checks:checks.length,exercised_operations:[...exercised].sort(),passed:checks},null,2));
}catch(error){console.error(JSON.stringify({stage:'AI-28',completed_checks:checks.length,last_checks:checks.slice(-4)}));throw error;}
finally{for(const child of children)await kill(child);if(app)await app.close();await fixture.close();}
