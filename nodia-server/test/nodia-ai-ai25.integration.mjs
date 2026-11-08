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

const fixture = await createNodiaAiIntegrationFixture('ai25');
const { db, options, identities } = fixture;
const checks = [], children = new Set(), exercised = new Set();
let now = new Date('2030-05-01T12:00:00.000Z');
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
  const nativeModules = await Promise.all(['rental-reservation', 'rental-payment', 'rental-calendar', 'rental-turnover'].map(async name => loadAi(`${name}/${name}.module`, name.split('-').map(part => part[0].toUpperCase()+part.slice(1)).join('')+'Module')));
  const Clock = await loadAi('rental-common/rental-clock', 'RentalClock');
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Overview, ...nativeModules,
  ] });
  builder.overrideProvider(Clock).useValue({now: () => new Date(now)});
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => {
    providerCalls++; throw Error('Forbidden AI25 provider');
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
  if (!destination) [destination] = await db.query("INSERT INTO modules(module_group_id,sort_order,link,key) SELECT module_group_id,(SELECT COALESCE(MAX(m.sort_order),-1)+1 FROM modules m WHERE m.module_group_id=modules.module_group_id),'/reservations','synthetic_ai25_reservations' FROM modules WHERE key='nodia_ai' RETURNING id");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [destination.id]);
  const toolName = (resource, operation) => `nodia_${resource}_prepare_${operation}`;
  async function proposal(resource, operation, partial, actor = '1', expectedStatus = 'ready') {
    const chat = randomUUID(), identity = identities.get(actor);
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI25 only',clock_timestamp()+interval '90 days')", [chat,identity.userId,randomUUID(),'a'.repeat(64)]);
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
    assert.equal(receipt.property_id,partial.property_id);
    if(operation!=='create') assert.equal(receipt.resource_id,partial.id??partial.property_id);
    assert.equal(result.steps[0].result_refs[0].id,receipt.resource_id);
    await execute.execute(identities.get(actor),admitted.execution_id,acquired);
    assert.equal((await status(admitted.execution_id,actor)).state,'completed');
    exercised.add(`${resource}/${operation}`);return {id:receipt.resource_id,execution:result,proposal:p,claim:acquired,step};
  }
  const rejection=async(resource,operation,partial,actor='1',expected=[400,404,409])=>assert.rejects(proposal(resource,operation,partial,actor),error=>expected.includes(error.getStatus?.()));
  const path=id=>`/rental/properties/${id}`;
  const home=(await request('/rental/properties',{method:'POST',status:201,body:{name:'Synthetic AI25 house',timezone:'UTC',max_guests:6,minimum_turnover_minutes:60}})).resource_id;
  const foreign=(await request('/rental/properties',{actor:'2',method:'POST',status:201,body:{name:'Synthetic AI25 other',timezone:'UTC',max_guests:3}})).resource_id;
  const policy=(await request(`${path(home)}/cancellation-policies`,{method:'POST',status:201,body:{name:'Synthetic frozen terms',rules:[{min_days_before:0,refund_percent:'0'},{min_days_before:7,refund_percent:'50'},{min_days_before:14,refund_percent:'100'}]}})).resource_id;
  const booking=(extra={})=>({property_id:home,guest_name:'Synthetic AI25 guest',guest_contact:'synthetic@example.invalid',guests_count:2,channel:'whatsapp',check_in_on:'2030-05-10',check_out_on:'2030-05-12',check_in_time:'15:00',check_out_time:'11:00',nightly_rate:'50000',deposit_amount:'20000',cancellation_policy_id:policy,...extra});
  const availability=(house=home,extra={})=>request(`${path(house)}/availability?`+new URLSearchParams({check_in_on:'2030-05-10',check_out_on:'2030-05-12',check_in_time:'15:00',check_out_time:'11:00',...extra}));
  const view=(id,house=home,actor='1')=>request(`${path(house)}/reservations/${id}`,{actor});
  const fund=(id,amount='20000',extra={},house=home)=>request(`${path(house)}/payments`,{method:'POST',status:201,body:{reservation_id:id,type:'payment',amount,occurred_on:'2030-05-01',...extra}});
  const prepareRes=(operation,input,actor='1',expected='ready')=>proposal('rental_reservations',operation,input,actor,expected);
  const runRes=(operation,input,actor='1')=>perform('rental_reservations',operation,input,actor);
  const rejectRes=(operation,input,actor='1',expected=[400,404,409])=>rejection('rental_reservations',operation,input,actor,expected);
  const beforeReads={operations:await count('rental_operations'),reservations:await count('rental_reservations'),payments:await count('rental_payments')};
  await availability();await availability();
  check('availability is an observation without hold reservation payment or native journal',await count('rental_operations')===beforeReads.operations&&await count('rental_reservations')===beforeReads.reservations&&await count('rental_payments')===beforeReads.payments);
  const incomplete=await prepareRes('create',{property_id:home,guest_name:'Missing required agreement'},'1','needs_clarification');
  check('missing required booking fields yield clarification instead of fabricating hours price or deposit',!incomplete.proposal_id&&incomplete.result.missing_fields.includes('check_in_time')&&incomplete.result.missing_fields.includes('deposit_amount'));
  const first=await runRes('create',booking());
  const firstView=await view(first.id);
  check('create commits only a draft and nullable preparation with exact agreement but no money or occupancy',firstView.status==='draft'&&firstView.total_amount==='100000'&&firstView.policy_snapshot===null&&firstView.received_amount==='0'&&!!firstView.turnover_id&&(await availability()).available&&await count('rental_payments')===0);
  const [createdTemplate]=await db.query('SELECT command_template FROM nodia_ai_proposal_steps WHERE proposal_id=$1',[first.proposal.proposal_id]);
  const {property_id: _home,...firstCommand}=booking();
  const replay=await request(`${path(home)}/reservations`,{method:'POST',status:201,key:createdTemplate.command_template.request_key,body:{...firstCommand,cleaning_fee:'0',commission_amount:'0',discount_amount:'0',external_reference:null,deposit_due_at:null,balance_due_at:null,notes:null,is_active:true}});
  check('native replay normalizes explicit defaults and does not duplicate reservation turnover or journal',replay.resource_id===first.id&&await count('rental_reservations')===1&&await count('rental_turnovers')===1);
  await runRes('update',{property_id:home,id:first.id,check_in_on:'2030-05-09'});
  const [reset]=await db.query('SELECT updated_by::text,ready_at,cleaning_status,same_day_approved_at FROM rental_turnovers WHERE incoming_reservation_id=$1',[first.id]);
  check('draft interval update recomputes agreement and resets preparation using actual actor identity',(await view(first.id)).total_amount==='150000'&&reset.updated_by==='1'&&reset.ready_at===null&&reset.cleaning_status==='pending'&&reset.same_day_approved_at===null);
  await runRes('update',{property_id:home,id:first.id,check_in_on:'2030-05-10',notes:null});
  await rejectRes('confirm',{property_id:home,id:first.id});
  check('a direct booking cannot confirm without a received positive agreed deposit',(await view(first.id)).status==='draft'&&await count('rental_payments')===0);
  await fund(first.id);
  const frozen=(await view(first.id)).policy_snapshot;
  await rejectRes('update',{property_id:home,id:first.id,nightly_rate:'60000'});
  await runRes('update',{property_id:home,id:first.id,guest_contact:'corrected@example.invalid',is_active:true});
  check('first monetary record freezes agreement while harmless guest metadata remains editable',(await view(first.id)).nightly_rate==='50000'&&(await view(first.id)).guest_contact==='corrected@example.invalid');
  const held=await prepareRes('confirm',{property_id:home,id:first.id});
  check('preparing confirmation neither occupies dates nor changes the native state',(await availability()).available&&(await view(first.id)).status==='draft');
  await request(`${path(home)}/cancellation-policies/${policy}`,{method:'PUT',body:{rules:[{min_days_before:0,refund_percent:'100'}]}});
  const nativeBefore=await count('rental_operations');
  const confirmedAdmission=await admit(held),confirmedClaim=await claim();
  await execute.execute(identities.get('1'),confirmedAdmission.execution_id,confirmedClaim);
  exercised.add('rental_reservations/confirm');
  check('confirmation preserves the paid policy snapshot despite current policy edits and records no extra payment',(await view(first.id)).status==='confirmed'&&JSON.stringify((await view(first.id)).policy_snapshot)===JSON.stringify(frozen)&&await count('rental_payments')===1&&await count('rental_operations')===nativeBefore+1);
  await runRes('update',{property_id:home,id:first.id,is_active:false});
  check('an archived confirmed booking still occupies its interval',(await availability()).conflicts.some(row=>row.id===first.id));
  const other=await runRes('create',booking({guest_name:'Overlapping draft'}));await fund(other.id);
  await rejectRes('confirm',{property_id:home,id:other.id});
  check('conflicting drafts and real payments are allowed but confirmation rejects occupancy',(await view(other.id)).status==='draft'&&(await view(other.id)).received_amount==='20000');

  const priorPreview=await request(`${path(home)}/reservations/${first.id}/cancellation-preview`,{method:'POST',body:{cancelled_at:'2030-05-01T11:00:00Z'}});
  const priorJournal=await count('rental_operations');
  const cancellation=await prepareRes('cancel',{property_id:home,id:first.id,cancelled_at:'2030-05-01T11:00:00Z'});
  check('cancellation preview proposes refund on frozen policy without cancellation journal or refund row',priorPreview.refund_amount==='10000'&&(await view(first.id)).status==='confirmed'&&await count('rental_operations')===priorJournal&&await count('rental_payments')===2);
  await request(`${path(home)}/cancellation-policies/${policy}`,{method:'PUT',body:{rules:[{min_days_before:0,refund_percent:'0'}]}});
  const cancelAdmission=await admit(cancellation),cancelClaim=await claim();
  await execute.execute(identities.get('1'),cancelAdmission.execution_id,cancelClaim);exercised.add('rental_reservations/cancel');
  const cancelled=await view(first.id);
  check('cancel commits approved frozen refund and monetary ledger hash without paying a refund or collecting remaining balance',cancelled.status==='cancelled'&&cancelled.refund_amount==='10000'&&cancelled.refund_due_amount==='10000'&&cancelled.balance_due_amount==='0'&&cancelled.cancellation_snapshot.received_amount==='20000'&&cancelled.cancellation_snapshot.retained_amount==='10000'&&/^[a-f0-9]{64}$/.test(cancelled.cancellation_snapshot.payment_ledger_sha256)&&await count('rental_payments')===2);
  const [cancelTemplate]=await db.query('SELECT command_template FROM nodia_ai_proposal_steps WHERE proposal_id=$1',[cancellation.proposal_id]);
  const beforeCancelReplay=await count('rental_operations');
  const cancelReplay=await request(`${path(home)}/reservations/${first.id}/cancel`,{method:'POST',key:cancelTemplate.command_template.request_key,body:{cancelled_at:'2030-05-01T13:00:00+02:00',expected_refund_amount:'10000'}});
  check('native cancellation replay canonicalizes equivalent instants and preserves its original response and journal',cancelReplay.resource_id===first.id&&cancelReplay.status==='cancelled'&&await count('rental_operations')===beforeCancelReplay&&JSON.stringify((await view(first.id)).cancellation_snapshot)===JSON.stringify(cancelled.cancellation_snapshot));
  check('cancelled occupancy is released while original history and receipt stay available',!(await availability()).conflicts.some(row=>row.id===first.id)&&(await status(cancelAdmission.execution_id)).steps[0].result_refs[0].id===first.id);
  await rejectRes('confirm',{property_id:home,id:first.id});
  await rejectRes('cancel',{property_id:home,id:first.id,cancelled_at:'2030-05-01T11:00:00Z'});
  await rejectRes('cancel',{property_id:home,id:other.id,cancelled_at:'2030-05-02T11:00:00Z'});
  check('cancelled bookings do not reopen and cancellation cannot invent a future effective notice');

  const staleMoney=await runRes('create',booking({check_in_on:'2030-06-10',check_out_on:'2030-06-12'}));await fund(staleMoney.id);
  const zeroRefund=await prepareRes('cancel',{property_id:home,id:staleMoney.id,cancelled_at:'2030-05-01T11:00:00Z'});
  const zeroBefore=await request(`${path(home)}/reservations/${staleMoney.id}/cancellation-preview`,{method:'POST',body:{cancelled_at:'2030-05-01T11:00:00Z'}});
  await fund(staleMoney.id,'1');
  const zeroAfter=await request(`${path(home)}/reservations/${staleMoney.id}/cancellation-preview`,{method:'POST',body:{cancelled_at:'2030-05-01T11:00:00Z'}});
  await admit(zeroRefund,'1',409);
  check('a changed payment ledger invalidates exact cancellation even when refund amount is unchanged at zero',zeroBefore.refund_amount==='0'&&zeroAfter.refund_amount==='0'&&zeroBefore.cancellation_snapshot.payment_ledger_sha256!==zeroAfter.cancellation_snapshot.payment_ledger_sha256&&(await view(staleMoney.id)).status==='draft');
  const staleNative=await prepareRes('update',{property_id:home,id:staleMoney.id,notes:'Must not overwrite stale agreement'});
  await db.query('UPDATE rental_reservations SET guest_name=$2 WHERE id=$1',[staleMoney.id,'Concurrent synthetic guest identity']);
  await admit(staleNative,'1',409);
  check('material same timestamp agreement changes invalidate confirmation without relying on updated_at');
  const cancelRollback=await admit(await prepareRes('cancel',{property_id:home,id:staleMoney.id,cancelled_at:'2030-05-01T11:00:00Z'})),cancelRollbackClaim=await claim();
  const beforeCancelRollback={operations:await count('rental_operations'),audits:await count('rental_audit_events'),payments:await count('rental_payments')};
  await db.query("CREATE FUNCTION synthetic_ai25_cancel_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai25_cancel_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai25_cancel_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai25_cancel_receipt_failure()");
  try{await assert.rejects(execute.execute(identities.get('1'),cancelRollback.execution_id,cancelRollbackClaim));}finally{await db.query('DROP TRIGGER synthetic_ai25_cancel_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai25_cancel_receipt_failure()');}
  await recovery.execute(cancelRollbackClaim,'nodia_ai:execution_conflict');
  const cancellationAfterRollback=await view(staleMoney.id);
  check('failed cancellation receipt restores native phase snapshots money journal and audit atomically',cancellationAfterRollback.status==='draft'&&cancellationAfterRollback.cancellation_snapshot===null&&cancellationAfterRollback.refund_amount===null&&cancellationAfterRollback.received_amount==='20001'&&await count('rental_operations')===beforeCancelRollback.operations&&await count('rental_audit_events')===beforeCancelRollback.audits&&await count('rental_payments')===beforeCancelRollback.payments);

  const platform=await runRes('create',booking({channel:'airbnb',external_reference:'SYNTHETIC-EXTERNAL',deposit_amount:'0',cancellation_policy_id:null,check_in_on:'2030-07-10',check_out_on:'2030-07-12'}));
  const missingPlatform=await prepareRes('confirm',{property_id:home,id:platform.id},'1','needs_clarification');
  assert.ok(missingPlatform.result.missing_fields.includes('platform_policy'));
  const external={reference:'Synthetic external terms',description:'Explicit test platform conditions'};
  await runRes('confirm',{property_id:home,id:platform.id,platform_policy:external});
  check('platform confirmation requires explicit external conditions and no fabricated settlement payment',(await view(platform.id)).status==='confirmed'&&(await view(platform.id)).policy_snapshot.kind==='platform'&&(await view(platform.id)).received_amount==='0');
  const missingResolution=await prepareRes('cancel',{property_id:home,id:platform.id,cancelled_at:'2030-05-01T11:00:00Z'},'1','needs_clarification');
  assert.ok(missingResolution.result.missing_fields.includes('refund_amount')&&missingResolution.result.missing_fields.includes('resolution_note'));
  await runRes('cancel',{property_id:home,id:platform.id,cancelled_at:'2030-05-01T11:00:00Z',refund_amount:'0',resolution_note:'No platform money received'});
  check('platform cancellation records an explicit external resolution and creates no refund payment',(await view(platform.id)).cancellation_snapshot.kind==='platform'&&(await view(platform.id)).refund_amount==='0');

  const transitionHome=(await request('/rental/properties',{method:'POST',status:201,body:{name:'Synthetic AI25 transitions',timezone:'UTC',max_guests:6,minimum_turnover_minutes:60}})).resource_id;
  const platformDraft=(extra={})=>booking({property_id:transitionHome,channel:'airbnb',external_reference:'SYNTHETIC-TRANSITION-'+randomUUID(),deposit_amount:'0',cancellation_policy_id:null,...extra});
  const previous=await runRes('create',platformDraft({check_in_on:'2030-10-10',check_out_on:'2030-10-12'}));
  await runRes('confirm',{property_id:transitionHome,id:previous.id,platform_policy:external});
  const incoming=await runRes('create',platformDraft({check_in_on:'2030-10-12',check_out_on:'2030-10-14'}));
  const incomingView=await view(incoming.id,transitionHome);
  await rejectRes('confirm',{property_id:transitionHome,id:incoming.id,platform_policy:external});
  await request(`${path(transitionHome)}/turnovers/${incomingView.turnover_id}`,{method:'PUT',body:{linen_ready:true,planned_ready_at:'2030-10-12T13:00:00Z'}});
  const transitionAvailability=await availability(transitionHome,{check_in_on:'2030-10-12',check_out_on:'2030-10-14',exclude_reservation_id:incoming.id});
  check('same day turnover availability distinguishes a valid plan from explicit approval',transitionAvailability.conflicts.length===0&&!transitionAvailability.available&&transitionAvailability.turnover_requirements.some(row=>row.turnover_id===incomingView.turnover_id&&row.plan_valid&&row.needs_approval));
  await runRes('confirm',{property_id:transitionHome,id:incoming.id,platform_policy:external,same_day_approvals:[incomingView.turnover_id]});
  const [approvedTransition]=await db.query('SELECT previous_reservation_id::text,same_day_approved_at,ready_at FROM rental_turnovers WHERE id=$1',[incomingView.turnover_id]);
  check('explicit exact confirmation approves affected same day turnover without fabricating completed cleaning',approvedTransition.previous_reservation_id===previous.id&&approvedTransition.same_day_approved_at!==null&&approvedTransition.ready_at===null);
  const firstRace=await runRes('create',platformDraft({check_in_on:'2030-11-10',check_out_on:'2030-11-12'}));
  const secondRace=await runRes('create',platformDraft({check_in_on:'2030-11-10',check_out_on:'2030-11-12'}));
  const losingAdmission=await admit(await prepareRes('confirm',{property_id:transitionHome,id:firstRace.id,platform_policy:external}));
  await request(`${path(transitionHome)}/reservations/${secondRace.id}/confirm`,{method:'POST',body:{platform_policy:external}});
  await worker.execute(randomUUID(),new AbortController().signal);
  check('new native occupancy after human admission prevents overlapping confirmation at execution',(await status(losingAdmission.execution_id)).state==='failed'&&(await view(firstRace.id,transitionHome)).status==='draft'&&(await view(secondRace.id,transitionHome)).status==='confirmed');
  const futureGuest=await runRes('create',platformDraft({check_in_on:'2030-12-12',check_out_on:'2030-12-14'}));
  await runRes('confirm',{property_id:transitionHome,id:futureGuest.id,platform_policy:external});
  const futureView=await view(futureGuest.id,transitionHome);
  await request(`${path(transitionHome)}/turnovers/${futureView.turnover_id}`,{method:'PUT',body:{linen_ready:true,planned_ready_at:'2030-12-12T13:00:00Z'}});
  const newPreceding=await runRes('create',platformDraft({check_in_on:'2030-12-10',check_out_on:'2030-12-12'}));
  await runRes('confirm',{property_id:transitionHome,id:newPreceding.id,platform_policy:external,same_day_approvals:[futureView.turnover_id]});
  const [refreshedFuture]=await db.query('SELECT previous_reservation_id::text,same_day_approved_at FROM rental_turnovers WHERE id=$1',[futureView.turnover_id]);
  check('an inserted preceding guest refreshes and explicitly approves the already confirmed future transition',refreshedFuture.previous_reservation_id===newPreceding.id&&refreshedFuture.same_day_approved_at!==null);

  await runRes('confirm',{property_id:home,id:other.id});
  now=new Date('2030-05-10T16:00:00Z');
  await rejectRes('start',{property_id:home,id:other.id});
  await db.query("UPDATE rental_turnovers SET linen_ready=true,cleaning_status='completed',ready_at=$2 WHERE incoming_reservation_id=$1",[other.id,'2030-05-10T14:00:00Z']);
  const stalePlan=await admit(await prepareRes('start',{property_id:home,id:other.id}));
  await db.query("UPDATE rental_turnovers SET cleaning_status='pending',ready_at=NULL WHERE incoming_reservation_id=$1",[other.id]);
  await worker.execute(randomUUID(),new AbortController().signal);
  check('a changed real preparation after confirmation prevents start dispatch',(await status(stalePlan.execution_id)).state==='failed'&&(await view(other.id)).status==='confirmed');
  await db.query("UPDATE rental_turnovers SET linen_ready=true,cleaning_status='completed',ready_at=$2 WHERE incoming_reservation_id=$1",[other.id,'2030-05-10T14:00:00Z']);
  await runRes('start',{property_id:home,id:other.id});
  await rejectRes('complete',{property_id:home,id:other.id});
  now=new Date('2030-05-12T11:00:00Z');
  await request(path(home),{method:'PUT',body:{is_active:false}});
  await runRes('complete',{property_id:home,id:other.id});
  check('start uses actual preparation and completion waits for checkout even in an archived house',(await view(other.id)).status==='completed'&&(await view(other.id)).received_amount==='20000');
  await rejectRes('create',booking());
  await rejectRes('confirm',{property_id:home,id:staleMoney.id});
  await runRes('cancel',{property_id:home,id:staleMoney.id,cancelled_at:'2030-05-01T11:00:00Z'});
  check('archived houses reject new agreements and confirmation while retaining cancellation and historical settlement');
  await request(path(home),{method:'PUT',body:{is_active:true}});now=new Date('2030-05-01T12:00:00Z');

  await request(`${path(home)}/collaborators`,{method:'POST',status:201,body:{user_id:'2'}});
  const member=await runRes('create',booking({guest_name:'Synthetic member author',check_in_on:'2030-08-10',check_out_on:'2030-08-12'}),'2');
  const memberView=await view(member.id,home,'2');
  check('a permitted collaborator creates under real authorship without impersonating owner',memberView.created_by==='2');
  await rejectRes('update',{property_id:foreign,id:member.id,notes:'Wrong association'},'2',[404]);
  const admin=await runRes('create',booking({property_id:foreign,cancellation_policy_id:null,guest_name:'Synthetic admin on foreign house',check_in_on:'2030-09-10',check_out_on:'2030-09-12'}),'3');
  check('super administrator preserves actual authorship on foreign owner resources',(await view(admin.id,foreign,'3')).created_by==='3');
  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1',[destination.id]);
  await rejectRes('update',{property_id:home,id:member.id,notes:'Missing destination'},'2',[403]);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)',[destination.id]);
  const revoked=await admit(await prepareRes('update',{property_id:home,id:member.id,notes:'Must not write'},'2'),'2');
  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1',[destination.id]);
  await worker.execute(randomUUID(),new AbortController().signal);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)',[destination.id]);
  check('destination module revocation before execution blocks the native writer',(await status(revoked.execution_id,'2')).state==='failed'&&(await view(member.id,home,'2')).notes===null);
  const revokedSession=await admit(await prepareRes('update',{property_id:home,id:member.id,notes:'Must not write revoked session'},'2'),'2');
  await db.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',[identities.get('2').sessionId]);
  await worker.execute(randomUUID(),new AbortController().signal);
  await db.query('UPDATE auth_sessions SET revoked_at=NULL WHERE public_id=$1',[identities.get('2').sessionId]);
  check('session revocation before execution cannot apply a confirmed update',(await status(revokedSession.execution_id,'2')).state==='failed'&&(await view(member.id,home,'2')).notes===null);

  const rollback=await admit(await prepareRes('create',booking({guest_name:'Synthetic AI25 rollback'}))),rollbackClaim=await claim();
  const beforeRollback={reservations:await count('rental_reservations'),turnovers:await count('rental_turnovers'),operations:await count('rental_operations'),audits:await count('rental_audit_events')};
  await db.query("CREATE FUNCTION synthetic_ai25_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai25_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai25_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai25_receipt_failure()");
  try{await assert.rejects(execute.execute(identities.get('1'),rollback.execution_id,rollbackClaim));}finally{await db.query('DROP TRIGGER synthetic_ai25_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai25_receipt_failure()');}
  await recovery.execute(rollbackClaim,'nodia_ai:execution_conflict');
  check('receipt failure rolls back draft turnover native operation and audit in the same transaction',await count('rental_reservations')===beforeRollback.reservations&&await count('rental_turnovers')===beforeRollback.turnovers&&await count('rental_operations')===beforeRollback.operations&&await count('rental_audit_events')===beforeRollback.audits);

  const waitFor=async(read,predicate,description,timeout=20000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await read();if(predicate(value))return value;await delay(30);}throw Error('Timed out: '+description);};
  const childWorker=async()=>{
    const child=fork(fileURLToPath(new URL('./nodia-ai-ai25-worker.fixture.mjs',import.meta.url)),[],{cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,silent:true,env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODIA_AI25_FIXTURE_DB:JSON.stringify(options)}});
    children.add(child);const messages=[];let output='',exited;
    child.on('message',message=>messages.push(message));child.on('exit',(code,signal)=>{exited={code,signal};children.delete(child);});child.on('error',error=>{exited={message:error.message};});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-32768);});
    const next=async type=>waitFor(async()=>{const message=messages.find(value=>value.type===type||value.type==='error');if(message?.type==='error')throw Error(JSON.stringify(message));if(exited)throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);return message;},Boolean,'child '+type);
    await next('ready');return {child,next};
  };
  const crashed=await admit(await prepareRes('update',{property_id:home,id:member.id,notes:'Synthetic resumed agreement'}));
  const crashing=await childWorker();crashing.child.send({type:'claim',workerId:randomUUID()});
  assert.equal((await crashing.next('claimed')).claim.executionId,crashed.execution_id);await kill(crashing.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1",[crashed.execution_id]);await recovery.execute();
  const crashResult=await status(crashed.execution_id);
  check('real child process death after claim leaves no booking effect and allows explicit resume',crashResult.state==='failed'&&crashResult.can_resume&&(await view(member.id)).notes===null);
  const resumeBody={client_request_id:randomUUID(),expected_execution_revision:crashResult.revision};
  await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});
  await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});
  const beforeResume=await count('rental_operations');await worker.execute(randomUUID(),new AbortController().signal);
  check('duplicate human resume commits one native agreement edit and receipt',(await status(crashed.execution_id)).state==='completed'&&(await view(member.id)).notes==='Synthetic resumed agreement'&&await count('rental_operations')===beforeResume+1);

  const lost=await admit(await prepareRes('cancel',{property_id:home,id:member.id,cancelled_at:'2030-05-01T11:00:00Z'})),lostClaim=await claim();
  const Store=await loadAi('nodia-ai-execution/nodia-ai-execution.service','NodiaAiExecutionService'),store=compiled.get(Store),transaction=store.transaction.bind(store);
  const beforeLost=await count('rental_operations');
  store.transaction=async work=>{await transaction(work);throw Error('synthetic_ai25_post_commit_response_lost');};
  try{await assert.rejects(execute.execute(identities.get('1'),lost.execution_id,lostClaim),error=>error.getStatus?.()===503);}finally{store.transaction=transaction;}
  await recovery.execute();const recovered=await execute.execute(identities.get('1'),lost.execution_id,lostClaim);
  check('lost cancellation COMMIT response recovers its exact receipt without duplicate journal or effects',recovered.state==='completed'&&await count('rental_operations')===beforeLost+1&&(await view(member.id)).status==='cancelled');

  check('all six commercial reservation operations execute through compiled native writers',exercised.size===6);
  check('local effects never invoke a provider or acquire inference slots',providerCalls===0&&await count('nodia_ai_runtime_slots')===0);
  check('execution attempts and leases finish without orphans',await count('nodia_ai_job_attempts','ended_at IS NULL')===0&&await count('nodia_ai_jobs',"state='leased'")===0);
  console.log(JSON.stringify({stage:'AI-25',scope:'compiled_http_confirmation_worker_disposable_postgresql_six_native_booking_lifecycle_mutations_no_provider',checks:checks.length,exercised_operations:[...exercised].sort(),passed:checks},null,2));
}catch(error){console.error(JSON.stringify({stage:'AI-25',completed_checks:checks.length,last_checks:checks.slice(-4)}));throw error;}
finally{for(const child of children)await kill(child);if(app)await app.close();await fixture.close();}
