// Actual compiled worker and MCP gateway exercise six common helper adapters.
// Native preview, preference CAS and sequential effects use disposable PostgreSQL.
// Provider transport, records and publication are synthetic; attachment metadata
// fixtures have no stored bytes. No configured DB, account, R2 or service restart.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { createAi15PublicationFixture } from './nodia-ai-ai15.fixture.mjs';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';

const started = Date.now(), checks = [];
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
// ai3604 is only an isolated fixture namespace; the implementation stage is AI-36-C04.
const fixture = await createNodiaAiIntegrationFixture('ai3604');
const { db, options, identities } = fixture;
let ports, compiled, app, publication, dispatches = 0, httpRequests = 0;
const names = ['nodia_proposals_get', 'nodia_operations_get', 'nodia_workflows_prepare', 'nodia_attachments_describe', 'nodia_preferences_list', 'nodia_preferences_prepare'];
const load = async (...entries) => Promise.all(entries.map(([file, name]) => loadAi(file, name)));
try {
  const [Tools, Conversation, Processing, Runtime, Confirmation, Execution, Observation] = await load(
    ['nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'],
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'],
    ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    ['nodia-ai-observation/nodia-ai-observation.module','NodiaAiObservationModule'],
  );
  const [Stage, Create, Admit, Adapter, Redis, Registry, Claim, Execute, Filter, Policy, bodyParser] = await load(
    ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'],
    ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['common/redis/redis.service', 'RedisService'],
    ['nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase'],
    ['nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'],
    ['nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase'],
    ['common/filters/all-exceptions.filter', 'AllExceptionsFilter'],
    ['nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY'],
    ['nodia-ai-conversation/nodia-ai-conversation-body-parser', 'createNodiaAiConversationBodyParser'],
  );
  const builder = (imports, providers = []) => Test.createTestingModule({
    imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), ...imports], providers,
  }).overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  // Explicit synthetic publication of the six real candidate adapters only.
  const CommonModule = await loadAi('nodia-ai-common-reads/nodia-ai-common-reads.module', 'NodiaAiCommonReadsModule');
  const PreparationModule = await loadAi('nodia-ai-common-preparation/nodia-ai-common-preparation.module', 'NodiaAiCommonPreparationModule');
  const ReadBuilder = await loadAi('nodia-ai-common-reads/use-case/build-nodia-ai-common-read-tools.use-case', 'BuildNodiaAiCommonReadToolsUseCase');
  const PrepareBuilder = await loadAi('nodia-ai-common-preparation/use-case/build-nodia-ai-common-preparation-tools.use-case', 'BuildNodiaAiCommonPreparationToolsUseCase');
  ports = await builder([CommonModule.forPublication(names.filter(name=>!['nodia_workflows_prepare','nodia_preferences_prepare'].includes(name))), PreparationModule.forPublication(['nodia_workflows_prepare','nodia_preferences_prepare'])]).compile();
  const Compose = await loadAi('nodia-ai-tools/use-case/compose-nodia-ai-published-families.use-case','ComposeNodiaAiPublishedFamiliesUseCase');
  const families = new Compose().execute([], [...ports.get(ReadBuilder).execute(), ...ports.get(PrepareBuilder).execute()]);
  const candidates = families.flatMap(family => family.capabilities);
  check('all six helpers have distinct strict candidate MCP contracts without production publication', candidates.length === 6 && new Set(candidates.map(tool => tool.toolName)).size === 6);
  publication = await createAi15PublicationFixture(families);
  let scenario = async () => {}, callbackError;
  const external = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe() { return { available: true, observedAt: new Date(), source: 'synthetic_fixture_only', resourceKey: 'gemini-profile:' + 'a'.repeat(64), configurationGeneration: 'b'.repeat(64), sessionGeneration: 'c'.repeat(32), adapterContractVersion: 'nodia-ai-gemini-chat/1', supportsMcp: true, reason: null }; },
    async verifyConfiguration() {},
    async execute(request, signal) {
      dispatches++;
      try { await scenario(request, signal); } catch (error) { callbackError = error; throw error; }
      return { kind: 'answer', text: 'Synthetic MCP common helper verification.', terminalProof: { engine: 'agentic', attemptId: request.attemptId, resourceKey: request.resourceKey, sessionGeneration: request.sessionGeneration, operationRef: request.attemptId, terminalProofId: randomUUID(), processClosed: true, outcome: 'completed', observedAt: new Date() } };
    },
  };
  const composition = publication.override(builder([Tools, Conversation, Processing, Runtime, Confirmation, Execution, Observation], [Stage]));
  composition.overrideProvider(Adapter).useValue(external);
  compiled = await composition.compile();
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/nodia-ai', bodyParser(compiled.get(Policy).admission.http_json_bytes));
  app.useGlobalFilters(new Filter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest(), identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException();
    request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId }; return true;
  } });
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1/nodia-ai`;
  async function http(path, { method = 'GET', actor = '1', body, expected = 200 } = {}) {
    httpRequests++;
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-fixture-actor': actor }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = response.status === 204 ? null : await response.json();
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${method} ${path}: ${response.status} ${JSON.stringify(value)}`); return value;
  }
  const moduleIds = new Map();
  for (const [key, route] of [['personal_finance', '/tools/finances-personal'], ['businesses', '/tools/business']]) {
    let [module] = await db.query('SELECT id::text FROM modules WHERE link=$1', [route]);
    if (!module) [module] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,$2 FROM modules WHERE key='nodia_ai' RETURNING id::text", [route, key]);
    moduleIds.set(route, module.id);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [module.id]);
  }
  const [provider] = await db.query("INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI36 MCP adapter','{}') RETURNING id::text");
  const [category] = await db.query("INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic food','ai36_mcp_food') RETURNING id::text");
  const [business] = await db.query("INSERT INTO businesses(owner_id,name) VALUES(1,'Synthetic MCP business') RETURNING id::text");
  const selection = { connection_id: provider.id, mode: 'token_plan_agentic', model_id: 'synthetic-ai36-mcp-model', effort_id: null };
  const identity = identities.get('1'), stage = compiled.get(Stage), registry = compiled.get(Registry), signal = new AbortController().signal;
  let activeRun, activeChat;
  const count = async (table, where = 'true', args = []) => (await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`, args))[0].n;
  const call = (request, name, args, callId = randomUUID()) => request.onToolCall({ callId, name, arguments: args }, signal);
  async function runScenario(callback, { actor = '1', conversation = null, setup = null } = {}) {
    callbackError = undefined;
    scenario = callback;
    const actorIdentity = identities.get(actor);
    const chat = conversation ? (await http('/conversations/' + conversation, {actor})).conversation : await compiled.get(Create).execute(actorIdentity, { client_request_id: randomUUID(), selection });
    activeChat = chat.conversation_id;
    if (setup) await setup(activeChat, actorIdentity);
    const [header] = await db.query('SELECT revision FROM nodia_ai_conversations WHERE id=$1',[activeChat]);
    const accepted = await compiled.get(Admit).execute(actorIdentity, activeChat, { client_message_id: randomUUID(), expected_conversation_revision: header.revision, parts: [{ kind: 'text', text: 'Synthetic native MCP common helpers only.' }] });
    activeRun = accepted.run.run_id;
    await stage.execute(randomUUID(), signal); await stage.execute(randomUUID(), signal);
    if (callbackError) throw callbackError;
    const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [activeRun]);
    assert.equal(run.state, 'completed', JSON.stringify({ state: run.state, error: run.error_code }));
    return { chat: activeChat, run: activeRun };
  }
  async function humanConfirm(proposal, actor = '1') {
    const challenge = await http(`/proposals/${proposal.proposal_id}/confirmation-challenge`, { actor, method: 'POST', body: { proposal_revision: proposal.revision, expected_hash: proposal.hash } });
    const body = { client_request_id: randomUUID(), proposal_revision: proposal.revision, expected_hash: proposal.hash, confirmation_token: challenge.confirmation_token };
    const accepted = await http(`/proposals/${proposal.proposal_id}/confirm`, { actor, method: 'POST', body, expected: 202 });
    const repeated = await http(`/proposals/${proposal.proposal_id}/confirm`, { actor, method: 'POST', body, expected: 202 });
    assert.equal(accepted.execution.execution_id, repeated.execution.execution_id);
    let result = accepted.execution;
    for(let step = 0; step < 8 && result.state === 'queued'; step++) {
      const lease = await compiled.get(Claim).execute(randomUUID());
      assert.equal(lease?.executionId, accepted.execution.execution_id);
      result = await compiled.get(Execute).execute(identities.get(actor), accepted.execution.execution_id, lease);
    }
    assert.equal(result.state, 'completed');
    return accepted.execution.execution_id;
  }

  const NativePrepare = await loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase');
  const NativeWorkflow = await loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-workflow.use-case', 'PrepareNodiaAiWorkflowUseCase');
  const workflowVersion = 'nodia-ai-ai23-workflow/1';
  const nativeDraft = (conversationId, toolName, partial, actor = '1') => db.transaction(manager => compiled.get(NativePrepare).execute(manager, identities.get(actor), {conversationId,toolName,partial}));
  async function insertAttachment(chat, {state='ready', kind='image', epoch='1', reviewed=false, expires=false}={}) {
    const id = randomUUID(), generation = randomUUID();
    await db.query(`INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,byte_count,media_type,content_hash,expires_at,interpretation_text,interpretation_origin,interpretation_revision,interpretation_reviewed)
    VALUES($1,$2,$3,$4,$5,$6,$7,'synthetic-private-filename.png',$8,$9,128,$10,$11,$12,clock_timestamp()+($13::text)::interval,$14,$15,$16,$17)`,[id,chat,randomUUID(),'d'.repeat(64),epoch,kind,state,`nodia-ai/${chat}/${id}/${generation}`,generation,state==='ready'?'128':null,state==='ready'?'image/png':null,state==='ready'?'e'.repeat(64):null,expires?'-1 day':'89 days',reviewed?'Synthetic private interpretation must never be returned':null,reviewed?'user_reviewed':null,reviewed?1:0,reviewed]);
    return id;
  }
  const safeWire = value => !/(storage_key|generation|content_hash|interpretation|synthetic-private-filename|command_template|confirmation_token|authorization|refresh_token)/u.test(JSON.stringify(value));
  let memory, memoryChat, preferenceId, preferenceOperation, workflow, workflowChat, workflowExecution, attachment, memoryListReceipt;
  const first = await runScenario(async request => {
    check('real admission and worker expose all six explicitly synthetic-published helpers', names.every(name => request.tools.some(tool => tool.name===name)));
    const incompleteArgs = {operation:'create',partial:{}}, id=randomUUID();
    const incomplete = await call(request,'nodia_preferences_prepare',incompleteArgs,id);
    check('memory preparation asks for native missing fields and has no accepted preference effect', incomplete.status==='needs_clarification' && incomplete.draft_revision===1 && incomplete.missing_fields.includes('scope_key') && await count('nodia_ai_preferences')===0);
    const again = await call(request,'nodia_preferences_prepare',incompleteArgs,id);
    check('same MCP memory callback replays one exact durable draft', isDeepStrictEqual(again,incomplete) && await count('nodia_ai_drafts','conversation_id=$1',[activeChat])===1);
    await assert.rejects(call(request,'nodia_preferences_prepare',{operation:'delete',partial:{}},id),/request_conflict/u);
    const completion={operation:'create',partial:{scope_key:'finance',scope:{},key:'expense_category_id',value:category.id},draft_id:incomplete.draft_id,expected_draft_revision:2};
    await assert.rejects(call(request,'nodia_preferences_prepare',completion),/revision_conflict/u);
    check('stale draft CAS leaves native incomplete memory revision unchanged', (await db.query('SELECT revision FROM nodia_ai_drafts WHERE id=$1',[incomplete.draft_id]))[0].revision===1);
    memory=await call(request,'nodia_preferences_prepare',{...completion,expected_draft_revision:1});
    check('correct CAS creates exact preference preview without accepting it', memory.status==='ready' && memory.draft_revision===2 && memory.proposal.steps[0].kind==='preference_change' && await count('nodia_ai_preferences')===0);
    const projected=await call(request,'nodia_proposals_get',{proposal_id:memory.proposal.proposal_id});
    check('proposal helper returns the exact current native preview in its originating chat', projected.hash===memory.proposal.hash && isDeepStrictEqual(projected,memory.proposal) && safeWire(projected));
    const list=await call(request,'nodia_preferences_list',{});
    check('preference list excludes unaccepted memory proposals', list.items.length===0 && list.next_cursor===null);
    await assert.rejects(call(request,'nodia_preferences_confirm',{proposal_id:memory.proposal.proposal_id}),/capability_denied/u);
    await assert.rejects(call(request,'nodia_preferences_prepare',{operation:'create',partial:{owner_id:'2'}}),/invalid_tool_input/u);
    check('model has no confirmation operation or actor ownership override', await count('nodia_ai_preferences')===0 && await count('nodia_ai_executions')===0);
  });
  memoryChat=first.chat;
  const [preparedReceipt]=await db.query("SELECT id,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 AND tool_name='nodia_preferences_prepare' AND public_result->>'status'='ready'",[first.run]);
  const recoveredPreparation=await http('/tool-calls/'+preparedReceipt.id+'/result');
  check('terminal human receipt retrieval recovers exact memory preparation without replay or acceptance',isDeepStrictEqual(recoveredPreparation,preparedReceipt.public_result) && await count('nodia_ai_preferences')===0);
  preferenceOperation=await humanConfirm(memory.proposal);
  const [acceptedMemory]=await db.query('SELECT * FROM nodia_ai_preferences'); preferenceId=acceptedMemory.id;
  check('separate exact human confirmation creates only the actor owned memory with an atomic receipt', acceptedMemory.owner_id==='1' && acceptedMemory.value===category.id && acceptedMemory.revision===1 && await count('nodia_ai_execution_steps','execution_id=$1 AND minimal_receipt IS NOT NULL',[preferenceOperation])===1);
  await runScenario(async request => {
    const list=await call(request,'nodia_preferences_list',{scope_key:'finance',page_limit:1});
    [memoryListReceipt]=await db.query("SELECT id FROM nodia_ai_tool_calls WHERE run_id=$1 AND tool_name='nodia_preferences_list' AND state='completed'",[activeRun]);
    check('accepted preference list matches native own memory reference and revision', list.items.length===1 && list.items[0].preference_id===preferenceId && list.items[0].revision===1 && safeWire(list));
    const op=await call(request,'nodia_operations_get',{execution_id:preferenceOperation});
    check('operation helper returns native completed state and minimal safe receipt', op.execution_id===preferenceOperation && op.state==='completed' && op.steps[0].state==='completed' && safeWire(op));
    const proposal=await call(request,'nodia_proposals_get',{proposal_id:memory.proposal.proposal_id});
    check('confirmed proposal helper links only its real originating execution', proposal.state==='confirmed' && proposal.execution_id===preferenceOperation);
    attachment=await insertAttachment(activeChat,{reviewed:true});
    const info=await call(request,'nodia_attachments_describe',{attachment_id:attachment});
    check('attachment helper gives bounded metadata without filename storage identity interpretation or bytes', info.attachment_id===attachment && info.state==='ready' && info.byte_count===128 && info.page_count===null && info.duration_seconds===null && safeWire(info));
    const uploading=await insertAttachment(activeChat,{state:'uploading'});
    const pending=await call(request,'nodia_attachments_describe',{attachment_id:uploading});
    check('uploading metadata preserves unknown size and type without fabricated zeroes',pending.state==='uploading' && pending.byte_count===null && pending.media_type===null && safeWire(pending));
    const wrongEpoch=await insertAttachment(activeChat,{epoch:'2'});
    await assert.rejects(call(request,'nodia_attachments_describe',{attachment_id:wrongEpoch}),/attachment_not_found|attachment_expired|capability_denied/u);
    check('mismatched retention epoch attachments cannot leak metadata');
    await assert.rejects(call(request,'nodia_attachments_describe',{attachment_id:attachment,conversation_id:first.chat}),/invalid_tool_input/u);
    await assert.rejects(call(request,'nodia_preferences_list',{owner_id:'2'}),/invalid_tool_input/u);
    check('common read schemas reject caller nominated chat and preference owner');
  },{conversation:memoryChat});
  const readReceipts=await db.query("SELECT DISTINCT ON(tool_name) id,tool_name,public_result FROM nodia_ai_tool_calls WHERE conversation_id=$1 AND tool_name=ANY($2::text[]) AND state='completed' ORDER BY tool_name,created_at DESC",[memoryChat,['nodia_proposals_get','nodia_operations_get','nodia_attachments_describe','nodia_preferences_list']]);
  assert.equal(readReceipts.length,4);
  for(const receipt of readReceipts){
    const result=await http('/tool-calls/'+receipt.id+'/result');
    assert.ok(isDeepStrictEqual(result,receipt.public_result));
  }
  await http('/tool-calls/'+readReceipts[0].id+'/result',{actor:'2',expected:[403,404]});
  check('four native read helper receipts recover after worker completion only for authorized chat reader');
  await runScenario(async request=>{
    const id=randomUUID(),args={scope_key:'finance'};
    const before=await call(request,'nodia_preferences_list',args,id);
    assert.equal(before.items[0].available,true);
    await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1',[moduleIds.get('/tools/finances-personal')]);
    await assert.rejects(call(request,'nodia_preferences_list',args,id),/preference_not_found|capability_denied/u);
    check('revoking a frozen destination grant denies prior preference callback replay without accepting changes',await count('nodia_ai_preferences')===1);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)',[moduleIds.get('/tools/finances-personal')]);
  },{conversation:memoryChat});
  await runScenario(async request=>{
    const current=await call(request,'nodia_preferences_list',{scope_key:'finance'});
    check('a new grant without the destination module reports own reference unavailable without its label',current.items.length===1 && current.items[0].available===false && current.items[0].value_label===null);
    await assert.rejects(call(request,'nodia_preferences_prepare',{operation:'update',partial:{id:preferenceId,expected_revision:1,value:category.id}}),/capability_denied/u);
    check('memory write preparation revalidates its native destination module before producing another proposal');
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)',[moduleIds.get('/tools/finances-personal')]);
  },{conversation:memoryChat,setup:async()=>{
    await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1',[moduleIds.get('/tools/finances-personal')]);
  }});
  await runScenario(async request=>{
    for(const [name,args] of [['nodia_proposals_get',{proposal_id:memory.proposal.proposal_id}],['nodia_operations_get',{execution_id:preferenceOperation}],['nodia_attachments_describe',{attachment_id:attachment}]]) await assert.rejects(call(request,name,args),/proposal_not_found|operation_not_found|attachment_not_found|capability_denied/u);
    check('same owner cannot use another chat run to read proposal operation or attachment references');
  });
  await runScenario(async request=>{
    const list=await call(request,'nodia_preferences_list',{});
    check('super_admin own MCP preference list does not expose another owner memory', list.items.length===0);
    await assert.rejects(call(request,'nodia_preferences_prepare',{operation:'update',partial:{id:preferenceId,expected_revision:1,value:category.id}}),/preconditions_changed|capability_denied|not_found/u);
    check('super_admin cannot edit another actor accepted preference through the common helper', (await db.query('SELECT revision FROM nodia_ai_preferences WHERE id=$1',[preferenceId]))[0].revision===1);
  },{actor:'3'});
  let supplier,contact,workflowInput;
  const pair=await runScenario(async request=>{
    await assert.rejects(db.transaction(manager=>compiled.get(NativeWorkflow).execute(manager,identity,activeChat,workflowInput)),/conversation_busy/u);
    check('native human workflow entry still rejects unrelated preparation while a job is active');
    const id=randomUUID();
    workflow=await call(request,'nodia_workflows_prepare',workflowInput,id);
    check('workflow MCP invokes the native coordinator under its exact armed job and typed dependency', workflow.status==='ready' && workflow.draft_id===null && workflow.proposal.steps.length===2 && workflow.proposal.steps[1].output_bindings[0].output_key==='id' && await count('providers')===0);
    const replay=await call(request,'nodia_workflows_prepare',workflowInput,id);
    check('workflow callback replay returns one exact combined preview without superseding again', isDeepStrictEqual(replay,workflow) && await count('nodia_ai_proposals','conversation_id=$1',[activeChat])===2);
    const projection=await call(request,'nodia_proposals_get',{proposal_id:workflow.proposal.proposal_id});
    check('combined native proposal preserves registered future output binding without fabricated provider ID', projection.steps[1].changes.some(item=>item.field_key==='provider_id' && item.origin==='future_step' && item.after===null));
    const [prior]=await db.query('SELECT state FROM nodia_ai_proposal_revisions WHERE proposal_id=$1',[supplier.proposal.proposal_id]);
    check('workflow atomically supersedes individual ready proposal and reserves its drafts', prior.state==='superseded');
  },{setup:async chat=>{
    supplier=await nativeDraft(chat,'nodia_providers_prepare_create',{business_id:business.id,name:'Synthetic C04 workflow supplier'});
    contact=await nativeDraft(chat,'nodia_provider_contacts_prepare_create',{business_id:business.id,name:'Synthetic C04 contact'});
    assert.equal(supplier.status,'ready'); assert.equal(contact.status,'needs_clarification');
    workflowInput={catalog_version:workflowVersion,draft_ids:[supplier.draft_id,contact.draft_id],bindings:[{draft_id:contact.draft_id,target_field_key:'provider_id',from_draft_id:supplier.draft_id,output_key:'id'}]};
  }});
  workflowChat=pair.chat;
  const [workflowReceipt]=await db.query("SELECT id,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 AND tool_name='nodia_workflows_prepare' AND state='completed'",[pair.run]);
  const recoveredWorkflow=await http('/tool-calls/'+workflowReceipt.id+'/result');
  check('terminal human workflow receipt retrieval preserves exact combined preview without another coordination',isDeepStrictEqual(recoveredWorkflow,workflowReceipt.public_result) && await count('providers')===0);
  workflowExecution=await humanConfirm(workflow.proposal);
  const effects=await db.query('SELECT state,minimal_receipt,bound_command FROM nodia_ai_execution_steps WHERE execution_id=$1 ORDER BY position',[workflowExecution]);
  check('exact human workflow confirmation performs supplier then bound contact without duplicate effects', effects.length===2 && effects.every(step=>step.state==='completed') && effects[1].bound_command.command_template.provider_id===effects[0].minimal_receipt.resource_id && await count('providers')===1 && await count('personal_info_provider')===1);
  await runScenario(async request=>{
    const op=await call(request,'nodia_operations_get',{execution_id:workflowExecution});
    check('operation helper presents sequential workflow receipts and completed state', op.state==='completed' && op.steps.length===2 && safeWire(op));
    const original=registry.validateOutput.bind(registry);
    const before=await Promise.all(['nodia_ai_drafts','nodia_ai_proposals','nodia_ai_tool_calls'].map(table=>count(table,'conversation_id=$1',[activeChat])));
    registry.validateOutput=(tool,value)=>original(tool,tool.toolName==='nodia_preferences_prepare'?{...value,uncontracted:true}:value);
    try { await assert.rejects(call(request,'nodia_preferences_prepare',{operation:'create',partial:{scope_key:'finance',scope:{},key:'income_category_id',value:category.id}}),/invalid_tool_output/u); }
    finally {registry.validateOutput=original;}
    const after=await Promise.all(['nodia_ai_drafts','nodia_ai_proposals','nodia_ai_tool_calls'].map(table=>count(table,'conversation_id=$1',[activeChat])));
    check('invalid helper output rolls back draft proposal and gateway receipt atomically', isDeepStrictEqual(before,after) && await count('nodia_ai_preferences')===1);
    const id=randomUUID(),args={execution_id:workflowExecution};
    await call(request,'nodia_operations_get',args,id);
    await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1',[moduleIds.get('/tools/business')]);
    await assert.rejects(call(request,'nodia_operations_get',args,id),/capability_denied|capability_unavailable/u);
    check('revoked destination module denies completed operation replay with no new business effects', await count('providers')===1 && await count('personal_info_provider')===1);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)',[moduleIds.get('/tools/business')]);
  },{conversation:workflowChat});
  await runScenario(async request=>{
    await assert.rejects(call(request,'nodia_preferences_prepare',{operation:'update',partial:{id:preferenceId,expected_revision:2,value:category.id}}),/preconditions_changed|revision_conflict/u);
    check('accepted memory update requires the current native CAS revision', (await db.query('SELECT revision FROM nodia_ai_preferences WHERE id=$1',[preferenceId]))[0].revision===1);
    const updateArgs={operation:'update',partial:{id:preferenceId,expected_revision:1,value:category.id}}, updateId=randomUUID();
    const concurrent=await Promise.all([call(request,'nodia_preferences_prepare',updateArgs,updateId),call(request,'nodia_preferences_prepare',updateArgs,updateId)]);
    check('concurrent identical helper callbacks resolve to one durable exact preference proposal',isDeepStrictEqual(concurrent[0],concurrent[1]) && await count('nodia_ai_proposals','conversation_id=$1',[activeChat])===1);
    const prepared=concurrent[0];
    assert.equal(prepared.status,'ready'); memory=prepared;
  });
  await humanConfirm(memory.proposal);
  check('human-confirmed preference update advances one native revision', (await db.query('SELECT revision FROM nodia_ai_preferences WHERE id=$1',[preferenceId]))[0].revision===2);
  await http('/tool-calls/'+memoryListReceipt.id+'/result',{expected:404});
  check('human receipt retrieval reauthorizes the accepted memory snapshot and denies its obsolete revision');
  let deletion;
  await runScenario(async request=>{
    deletion=await call(request,'nodia_preferences_prepare',{operation:'delete',partial:{id:preferenceId,expected_revision:2}});
    check('memory deletion is a separate reviewable exact proposal until human confirmation',deletion.status==='ready' && await count('nodia_ai_preferences')===1);
  });
  await humanConfirm(deletion.proposal);
  check('human-confirmed memory deletion removes only the actor preference and keeps business records',await count('nodia_ai_preferences')===0 && await count('providers')===1 && await count('personal_info_provider')===1);
  console.log(JSON.stringify({ stage: 'AI-36-C04', scope: 'compiled_worker_mcp_common_helpers_disposable_sql', status: 'passed', checks: checks.length, results: checks, elapsed_ms: Date.now() - started, migrations: await count('migrations'), synthetic_provider_dispatches: dispatches, actual_provider_generations: 0, http_requests: httpRequests, configured_database_used: false, storage_operations: 0, synthetic_publication: true, production_publication: false }, null, 2));
} finally {
  if (app) await app.close(); else if (compiled) await compiled.close();
  if (ports) await ports.close();
  publication?.close();
  await fixture.close();
}
