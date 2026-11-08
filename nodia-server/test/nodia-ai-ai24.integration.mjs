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

const fixture = await createNodiaAiIntegrationFixture('ai24');
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
  const nativeModules = await Promise.all(['rental-reservation', 'rental-payment', 'rental-calendar'].map(async name => loadAi(`${name}/${name}.module`, name.split('-').map(part => part[0].toUpperCase()+part.slice(1)).join('')+'Module')));
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Overview, ...nativeModules,
  ] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => {
    providerCalls++; throw Error('Forbidden AI24 provider');
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
    assert.equal(response.status, status, `${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  let [destination] = await db.query("SELECT id FROM modules WHERE link='/reservations'");
  if (!destination) [destination] = await db.query("INSERT INTO modules(module_group_id,sort_order,link,key) SELECT module_group_id,(SELECT COALESCE(MAX(m.sort_order),-1)+1 FROM modules m WHERE m.module_group_id=modules.module_group_id),'/reservations','synthetic_ai24_reservations' FROM modules WHERE key='nodia_ai' RETURNING id");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [destination.id]);
  const toolName = (resource, operation) => `nodia_${resource}_prepare_${operation}`;
  async function proposal(resource, operation, partial, actor = '1', expectedStatus = 'ready') {
    const chat = randomUUID(), identity = identities.get(actor);
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI24 only',clock_timestamp()+interval '90 days')", [chat,identity.userId,randomUUID(),'a'.repeat(64)]);
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
  async function perform(resource,operation,partial,actor='1') {
    const p=await proposal(resource,operation,partial,actor), admitted=await admit(p,actor), acquired=await claim();
    assert.equal(acquired.executionId,admitted.execution_id);
    const result=await execute.execute(identities.get(actor),admitted.execution_id,acquired);
    assert.equal(result.state,'completed');assert.equal(result.steps.length,1);
    const [step]=await db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1',[admitted.execution_id]);
    const receipt=step.minimal_receipt;assert.equal(receipt.resource_key,resource);assert.equal(receipt.operation,operation);
    assert.equal(receipt.property_id,partial.property_id??receipt.resource_id);
    if(operation!=='create') assert.equal(receipt.resource_id,partial.id??partial.property_id);
    assert.equal(result.steps[0].result_refs[0].id,receipt.resource_id);
    await execute.execute(identities.get(actor),admitted.execution_id,acquired);
    assert.equal((await status(admitted.execution_id,actor)).state,'completed');
    exercised.add(`${resource}/${operation}`);return {id:receipt.resource_id,execution:result,proposal:p,claim:acquired,step};
  }
  const rejection=async(resource,operation,partial,actor='1',expected=[400,404,409])=>assert.rejects(proposal(resource,operation,partial,actor),error=>expected.includes(error.getStatus?.()));
  const property = await perform('rental_properties','create',{name:'Synthetic AI24 house',max_guests:8,default_nightly_rate:'9007199254740993',default_deposit_percent:'0'});
  const home = property.id, path = id => `/rental/properties/${id}`;
  let homeView = await request(path(home));
  check('property creation preserves exact bigint money zero percent null optional fields and actor ownership', homeView.owner_id==='1'&&homeView.created_by==='1'&&homeView.default_nightly_rate==='9007199254740993'&&homeView.default_deposit_percent==='0.00'&&homeView.check_in_time===null&&homeView.location===null);
  await perform('rental_properties','update',{property_id:home,name:'Synthetic updated AI24 house',notes:null,default_nightly_rate:null});
  homeView=await request(path(home));
  check('property update preserves omitted capacity and explicit null without changing its owner', homeView.name==='Synthetic updated AI24 house'&&homeView.max_guests===8&&homeView.default_nightly_rate===null&&homeView.owner_id==='1');

  const collaborator=await perform('rental_collaborators','create',{property_id:home,user_id:'2',position:'Synthetic custodian'});
  await perform('rental_collaborators','update',{property_id:home,id:collaborator.id,position:null,is_active:false});
  let [collaboratorRow]=await db.query('SELECT * FROM rental_collaborators WHERE id=$1',[collaborator.id]);
  check('collaborator create and update preserve identity and support explicit null and revocation',collaboratorRow.user_id==='2'&&collaboratorRow.property_id===home&&collaboratorRow.position===null&&!collaboratorRow.is_active);
  await perform('rental_collaborators','update',{property_id:home,id:collaborator.id,is_active:true});
  await rejection('rental_properties','update',{property_id:home,name:'Forbidden collaborator'},'2',[403]);
  await rejection('rental_cancellation_policies','create',{property_id:home,name:'Forbidden collaborator',rules:[{min_days_before:0,refund_percent:'0'}]},'2',[403]);
  check('active collaborators cannot edit configuration or create policies even with destination access');
  const foreign=await perform('rental_properties','create',{name:'Synthetic foreign AI24 house',max_guests:2},'2');
  await rejection('rental_properties','update',{property_id:foreign.id,name:'Forbidden foreign house'},'1',[404]);
  check('an inaccessible house yields uniform not found for ordinary actors');
  await perform('rental_properties','update',{property_id:foreign.id,name:'Synthetic super administrator edit'},'3');
  const foreignView=await request(path(foreign.id),{actor:'3'});
  check('super administrator edits a foreign house with real authorship and no implicit ownership transfer',foreignView.owner_id==='2'&&foreignView.created_by==='2'&&foreignView.updated_by==='3');
  const onBehalf=await perform('rental_properties','create',{name:'Synthetic explicit foreign owner',max_guests:3,owner_id:'2'},'3');
  const onBehalfView=await request(path(onBehalf.id),{actor:'3'});
  check('only explicit super administrator owner selection can create for another user',onBehalfView.owner_id==='2'&&onBehalfView.created_by==='3'&&onBehalfView.updated_by==='3');
  await rejection('rental_properties','create',{name:'Forbidden foreign owner',max_guests:2,owner_id:'2'},'1',[403]);
  await rejection('rental_properties','update',{property_id:home,owner_id:'2'},'1',[400]);
  await rejection('rental_collaborators','create',{property_id:home,user_id:'1'},'1',[409]);
  await rejection('rental_collaborators','create',{property_id:home,user_id:'2'},'1',[409]);
  check('owner mutation and duplicate or owner collaborator creation remain forbidden');

  const rules=[{min_days_before:14,refund_percent:'100'},{min_days_before:0,refund_percent:'0'},{min_days_before:7,refund_percent:'50'}];
  const policy=await perform('rental_cancellation_policies','create',{property_id:home,name:'Synthetic direct terms',rules});
  const policyPath=id=>`${path(home)}/cancellation-policies/${id}`;
  let policyView=await request(policyPath(policy.id));
  check('policy create stores all rules atomically with canonical order and decimal percentages',JSON.stringify(policyView.rules.map(row=>[row.min_days_before,row.refund_percent]))===JSON.stringify([[0,'0.00'],[7,'50.00'],[14,'100.00']]));
  const [policyTemplate]=await db.query('SELECT command_template FROM nodia_ai_proposal_steps WHERE proposal_id=$1',[policy.proposal.proposal_id]);
  const replayPolicy=await request(`${path(home)}/cancellation-policies`,{method:'POST',status:201,key:policyTemplate.command_template.request_key,body:{name:'Synthetic direct terms',rules:[{min_days_before:0,refund_percent:'0.00'},{min_days_before:7,refund_percent:'50.00'},{min_days_before:14,refund_percent:'100.00'}]}});
  check('native idempotency replays canonical rule order and decimal equivalents without duplicate header or rules',replayPolicy.resource_id===policy.id&&await count('rental_cancellation_policies','id=$1',[policy.id])===1&&await count('rental_cancellation_rules','policy_id=$1',[policy.id])===3);
  const zeroRuleId=policyView.rules[0].id;
  await perform('rental_cancellation_policies','update',{property_id:home,id:policy.id,name:'Synthetic revised terms',rules:[{min_days_before:7,refund_percent:'75'},{min_days_before:0,refund_percent:'10'}]});
  policyView=await request(policyPath(policy.id));
  check('complete rule replacement reuses a retained threshold removes superseded rules and normalizes values',policyView.rules.length===2&&policyView.rules[0].id===zeroRuleId&&policyView.rules[0].refund_percent==='10.00'&&policyView.rules[1].refund_percent==='75.00');
  const policyBeforeName=structuredClone(policyView.rules);
  await perform('rental_cancellation_policies','update',{property_id:home,id:policy.id,name:'Synthetic name-only terms'});
  check('omitted rules keep existing IDs and values byte for byte',JSON.stringify((await request(policyPath(policy.id))).rules)===JSON.stringify(policyBeforeName));
  await perform('rental_properties','update',{property_id:home,default_cancellation_policy_id:policy.id});
  await rejection('rental_cancellation_policies','update',{property_id:home,id:policy.id,is_active:false},'1',[409]);
  await rejection('rental_properties','update',{property_id:foreign.id,default_cancellation_policy_id:policy.id},'2',[404]);
  check('default policies must be active and belong to their exact house');
  for(const invalid of [[],[{min_days_before:1,refund_percent:'10'}],[{min_days_before:0,refund_percent:'0'},{min_days_before:0,refund_percent:'50'}],[{min_days_before:0,refund_percent:'100.01'}]]) await rejection('rental_cancellation_policies','create',{property_id:home,name:'Invalid terms',rules:invalid});
  check('policy preparation rejects empty incomplete duplicate and invalid percentage rule sets');
  const incomplete=await proposal('rental_properties','create',{name:'Missing minimum fields'},'1','needs_clarification');
  assert.ok(incomplete.result.missing_fields.includes('max_guests'));
  check('missing required fields produce a clarification without a runnable proposal',!incomplete.proposal_id);

  const exact=await proposal('rental_properties','update',{property_id:home,name:'Synthetic exact human review'});
  const exactChallenge=await request(`/nodia-ai/proposals/${exact.proposal_id}/confirmation-challenge`,{method:'POST',body:{proposal_revision:exact.revision,expected_hash:exact.hash}});
  await request(`/nodia-ai/proposals/${exact.proposal_id}/confirm`,{method:'POST',status:409,body:{client_request_id:randomUUID(),proposal_revision:exact.revision,expected_hash:'f'.repeat(64),confirmation_token:exactChallenge.confirmation_token}});
  check('a human challenge cannot confirm a different proposal hash');
  const revised=await request(`/nodia-ai/proposals/${exact.proposal_id}`,{method:'PATCH',body:{expected_proposal_revision:exact.revision,expected_hash:exact.hash,edits:[{step_id:exact.steps[0].step_id,field_key:'name',value:'Synthetic edited review'}]}});
  const [firstCommand,secondCommand]=await db.query('SELECT command_template FROM nodia_ai_proposal_steps WHERE proposal_id=$1 ORDER BY proposal_revision',[exact.proposal_id]);
  assert.equal(firstCommand.command_template.request_key,secondCommand.command_template.request_key);
  const revisedExecution=await admit(revised),revisedClaim=await claim();
  await execute.execute(identities.get('1'),revisedExecution.execution_id,revisedClaim);
  check('material human review keeps the native request key and requires the exact new revision',revised.hash!==exact.hash&&(await request(path(home))).name==='Synthetic edited review');

  const beforeStale=await proposal('rental_properties','update',{property_id:home,name:'Must not overwrite'});
  const [oldTimestamp]=await db.query('SELECT updated_at::text FROM rental_properties WHERE id=$1',[home]);
  await db.query('UPDATE rental_properties SET location=$2 WHERE id=$1',[home,'Synthetic concurrent location']);
  await admit(beforeStale,'1',409);
  const [unchangedTimestamp]=await db.query('SELECT updated_at::text FROM rental_properties WHERE id=$1',[home]);
  check('a same timestamp material property change invalidates confirmation',oldTimestamp.updated_at===unchangedTimestamp.updated_at);
  const staleAfter=await admit(await proposal('rental_cancellation_policies','update',{property_id:home,id:policy.id,name:'Must not overwrite rules'}));
  await db.query('UPDATE rental_cancellation_rules SET refund_percent=20 WHERE policy_id=$1 AND min_days_before=0',[policy.id]);
  await worker.execute(randomUUID(),new AbortController().signal);
  const staleResult=await status(staleAfter.execution_id);
  check('a same timestamp material rule change after admission blocks native dispatch',staleResult.state==='failed'&&!staleResult.can_resume&&(await request(policyPath(policy.id))).name==='Synthetic name-only terms');

  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1',[destination.id]);
  await rejection('rental_properties','update',{property_id:foreign.id,name:'Missing destination module'},'2',[403]);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)',[destination.id]);
  check('ordinary users require the destination module even when they own the house');
  const revoked=await admit(await proposal('rental_properties','update',{property_id:foreign.id,name:'Must not dispatch revoked access'},'2'),'2');
  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1',[destination.id]);
  await worker.execute(randomUUID(),new AbortController().signal);
  await request(`/nodia-ai/operations/${revoked.execution_id}`,{actor:'2',status:403});
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)',[destination.id]);
  const revokedResult=await status(revoked.execution_id,'2');
  check('destination module revocation after confirmation is rechecked before the writer',revokedResult.state==='failed'&&(await request(path(foreign.id),{actor:'2'})).name==='Synthetic super administrator edit');
  const revokedSession=await admit(await proposal('rental_properties','update',{property_id:foreign.id,name:'Must not dispatch revoked session'},'2'),'2');
  await db.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',[identities.get('2').sessionId]);
  await worker.execute(randomUUID(),new AbortController().signal);
  await db.query('UPDATE auth_sessions SET revoked_at=NULL WHERE public_id=$1',[identities.get('2').sessionId]);
  check('session revocation after confirmation cannot write as the former user',(await status(revokedSession.execution_id,'2')).state==='failed'&&(await request(path(foreign.id),{actor:'2'})).name==='Synthetic super administrator edit');

  const reservation=await request(`${path(home)}/reservations`,{method:'POST',status:201,body:{guest_name:'Synthetic guest',guest_contact:'guest@example.invalid',guests_count:4,channel:'whatsapp',check_in_on:'2027-07-10',check_out_on:'2027-07-12',check_in_time:'15:00',check_out_time:'11:00',nightly_rate:'10000',deposit_amount:'5000',cancellation_policy_id:policy.id}});
  await request(`${path(home)}/payments`,{method:'POST',status:201,body:{reservation_id:reservation.resource_id,type:'payment',amount:'5000',occurred_on:new Date(Date.now()-86400000).toISOString().slice(0,10)}});
  const confirmed=await request(`${path(home)}/reservations/${reservation.resource_id}/confirm`,{method:'POST',body:{}});
  assert.equal(confirmed.status,'confirmed');
  const historicalBefore=(await db.query('SELECT policy_snapshot FROM rental_reservations WHERE id=$1',[reservation.resource_id]))[0].policy_snapshot;
  await perform('rental_cancellation_policies','update',{property_id:home,id:policy.id,rules:[{min_days_before:0,refund_percent:'0'}]});
  check('updating live policy rules never changes a monetary reservation snapshot',JSON.stringify((await db.query('SELECT policy_snapshot FROM rental_reservations WHERE id=$1',[reservation.resource_id]))[0].policy_snapshot)===JSON.stringify(historicalBefore));
  await rejection('rental_properties','update',{property_id:home,timezone:'Europe/Madrid'},'1',[409]);
  await rejection('rental_properties','update',{property_id:home,max_guests:3},'1',[409]);
  check('configuration preparation preserves timezone history and the capacity of current confirmed agreements');
  await perform('rental_properties','update',{property_id:home,is_active:false});
  await rejection('rental_collaborators','create',{property_id:home,user_id:'3'},'1',[409]);
  await rejection('rental_cancellation_policies','create',{property_id:home,name:'Must not create archived',rules:[{min_days_before:0,refund_percent:'0'}]},'1',[409]);
  const archivedReservation=await request(`${path(home)}/reservations/${reservation.resource_id}`);
  const calendar=await request(`${path(home)}/calendar?from_on=2027-07-01&to_on=2027-07-31`);
  check('archiving a house preserves historical occupancy money policy snapshots and native read access',archivedReservation.status==='confirmed'&&archivedReservation.received_amount==='5000'&&calendar.reservations.some(row=>row.id===reservation.resource_id)&&await count('rental_payments','reservation_id=$1',[reservation.resource_id])===1);
  await request(path(home),{method:'DELETE',status:404});
  check('rental history exposes no physical delete endpoint',await count('rental_properties','id=$1',[home])===1&&await count('rental_reservations','id=$1',[reservation.resource_id])===1);
  await perform('rental_collaborators','update',{property_id:home,id:collaborator.id,is_active:false});
  await rejection('rental_collaborators','update',{property_id:home,id:collaborator.id,is_active:true},'1',[409]);
  await perform('rental_properties','update',{property_id:home,is_active:true});
  await perform('rental_collaborators','update',{property_id:home,id:collaborator.id,is_active:true});
  check('archived houses permit collaborator removal and require house reactivation before restoring access',(await db.query('SELECT is_active FROM rental_collaborators WHERE id=$1',[collaborator.id]))[0].is_active);

  const rollback=await admit(await proposal('rental_cancellation_policies','create',{property_id:home,name:'Synthetic rollback policy',rules:[{min_days_before:0,refund_percent:'0'}]})),rollbackClaim=await claim();
  const beforeRollback={operations:await count('rental_operations'),audits:await count('rental_audit_events'),rules:await count('rental_cancellation_rules')};
  await db.query("CREATE FUNCTION synthetic_ai24_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai24_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai24_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai24_receipt_failure()");
  try{await assert.rejects(execute.execute(identities.get('1'),rollback.execution_id,rollbackClaim));}finally{await db.query('DROP TRIGGER synthetic_ai24_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai24_receipt_failure()');}
  await recovery.execute(rollbackClaim,'nodia_ai:execution_conflict');
  check('a receipt failure rolls back policy header rules native journal and audit in the same SQL transaction',await count('rental_cancellation_policies','name=$1',['Synthetic rollback policy'])===0&&await count('rental_operations')===beforeRollback.operations&&await count('rental_audit_events')===beforeRollback.audits&&await count('rental_cancellation_rules')===beforeRollback.rules);
  const originalPolicy=await request(policyPath(policy.id));
  const rulesRollback=await admit(await proposal('rental_cancellation_policies','update',{property_id:home,id:policy.id,name:'Must roll back partial rules',rules:[{min_days_before:0,refund_percent:'25'},{min_days_before:14,refund_percent:'100'}]})),rulesRollbackClaim=await claim();
  const beforeRulesRollback={operations:await count('rental_operations'),audits:await count('rental_audit_events')};
  await db.query("CREATE FUNCTION synthetic_ai24_rules_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.min_days_before=14 THEN RAISE EXCEPTION 'synthetic_ai24_rules_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai24_rules_failure BEFORE INSERT ON rental_cancellation_rules FOR EACH ROW EXECUTE FUNCTION synthetic_ai24_rules_failure()");
  try{await assert.rejects(execute.execute(identities.get('1'),rulesRollback.execution_id,rulesRollbackClaim));}finally{await db.query('DROP TRIGGER synthetic_ai24_rules_failure ON rental_cancellation_rules;DROP FUNCTION synthetic_ai24_rules_failure()');}
  await recovery.execute(rulesRollbackClaim,'nodia_ai:execution_conflict');
  check('a later rule insert failure restores the previous policy header and every threshold without a journal or receipt',JSON.stringify(await request(policyPath(policy.id)))===JSON.stringify(originalPolicy)&&await count('rental_operations')===beforeRulesRollback.operations&&await count('rental_audit_events')===beforeRulesRollback.audits);

  const waitFor=async(read,predicate,description,timeout=20000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await read();if(predicate(value))return value;await delay(30);}throw Error('Timed out: '+description);};
  const childWorker=async()=>{
    const child=fork(fileURLToPath(new URL('./nodia-ai-ai24-worker.fixture.mjs',import.meta.url)),[],{cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,silent:true,env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODIA_AI24_FIXTURE_DB:JSON.stringify(options)}});
    children.add(child);const messages=[];let output='',exited;
    child.on('message',message=>messages.push(message));child.on('exit',(code,signal)=>{exited={code,signal};children.delete(child);});child.on('error',error=>{exited={message:error.message};});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-32768);});
    const next=async type=>waitFor(async()=>{const message=messages.find(value=>value.type===type||value.type==='error');if(message?.type==='error')throw Error(JSON.stringify(message));if(exited)throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);return message;},Boolean,'child '+type);
    await next('ready');return {child,next};
  };
  const crashed=await admit(await proposal('rental_properties','update',{property_id:home,name:'Synthetic resumed house'}));
  const crashing=await childWorker();crashing.child.send({type:'claim',workerId:randomUUID()});
  assert.equal((await crashing.next('claimed')).claim.executionId,crashed.execution_id);await kill(crashing.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1",[crashed.execution_id]);await recovery.execute();
  const crashResult=await status(crashed.execution_id);
  check('real worker death after claim leaves no rental effect and permits explicit resume',crashResult.state==='failed'&&crashResult.can_resume&&(await request(path(home))).name==='Synthetic edited review');
  const resumeBody={client_request_id:randomUUID(),expected_execution_revision:crashResult.revision};
  await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});
  await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});
  await worker.execute(randomUUID(),new AbortController().signal);
  check('duplicate human resume produces one native property update journal and receipt',(await status(crashed.execution_id)).state==='completed'&&(await request(path(home))).name==='Synthetic resumed house');

  const lost=await admit(await proposal('rental_cancellation_policies','update',{property_id:home,id:policy.id,name:'Synthetic COMMIT acknowledged by witness'})),lostClaim=await claim();
  const Store=await loadAi('nodia-ai-execution/nodia-ai-execution.service','NodiaAiExecutionService'),store=compiled.get(Store),transaction=store.transaction.bind(store);
  const beforeLost=await count('rental_operations');
  store.transaction=async work=>{await transaction(work);throw Error('synthetic_ai24_post_commit_response_lost');};
  try{await assert.rejects(execute.execute(identities.get('1'),lost.execution_id,lostClaim),error=>error.getStatus?.()===503);}finally{store.transaction=transaction;}
  await recovery.execute();const recovered=await execute.execute(identities.get('1'),lost.execution_id,lostClaim);
  check('lost COMMIT response reconciles an immutable rental receipt without replaying the native journal',recovered.state==='completed'&&await count('rental_operations')===beforeLost+1&&(await request(policyPath(policy.id))).name==='Synthetic COMMIT acknowledged by witness');

  const workflow=compiled.get(await loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-workflow.use-case','PrepareNodiaAiWorkflowUseCase'));
  const workflowChat=randomUUID();await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,3,$2,$3,'Synthetic AI24 sequence',clock_timestamp()+interval '90 days')",[workflowChat,randomUUID(),'a'.repeat(64)]);
  const workflowDrafts=[];
  for(const [toolName,partial] of [['nodia_rental_properties_prepare_update',{property_id:home,location:'Synthetic mixed sequence'}],['nodia_rental_cancellation_policies_prepare_update',{property_id:foreign.id,id:(await perform('rental_cancellation_policies','create',{property_id:foreign.id,name:'Synthetic independent other terms',rules:[{min_days_before:0,refund_percent:'0'}]},'3')).id,name:'Synthetic mixed terms'}]]) {
    workflowDrafts.push(await db.transaction(manager=>prepare.execute(manager,identities.get('3'),{conversationId:workflowChat,toolName,partial})));
  }
  const workflowProposal=await db.transaction(manager=>workflow.execute(manager,identities.get('3'),workflowChat,{catalog_version:'nodia-ai-ai23-workflow/1',draft_ids:workflowDrafts.map(row=>row.draft_id)}));
  const workflowExecution=await admit(workflowProposal.proposal,'3');
  await worker.execute(randomUUID(),new AbortController().signal);await worker.execute(randomUUID(),new AbortController().signal);
  check('known-input operations across houses execute sequentially with independent native receipts',(await status(workflowExecution.execution_id,'3')).state==='completed'&&(await request(path(home))).location==='Synthetic mixed sequence');

  check('all six rental configuration operations execute against compiled native writers',exercised.size===6);
  check('local rental effects never invoke a provider or acquire inference runtime slots',providerCalls===0&&await count('nodia_ai_runtime_slots')===0);
  check('rental execution attempts and job leases finish without orphans',await count('nodia_ai_job_attempts','ended_at IS NULL')===0&&await count('nodia_ai_jobs',"state='leased'")===0);
  console.log(JSON.stringify({stage:'AI-24',scope:'compiled_http_confirmation_worker_disposable_postgresql_six_native_rental_configuration_mutations_no_provider',checks:checks.length,exercised_operations:[...exercised].sort(),passed:checks},null,2));
}catch(error){console.error(JSON.stringify({stage:'AI-24',completed_checks:checks.length,last_checks:checks.slice(-4)}));throw error;}
finally{for(const child of children)await kill(child);if(app)await app.close();await fixture.close();}
