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

const fixture = await createNodiaAiIntegrationFixture('ai26');
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
  const nativeModules = await Promise.all(['rental-reservation', 'rental-payment', 'rental-calendar', 'rental-turnover', 'rental-expense', 'rental-block'].map(async name => loadAi(`${name}/${name}.module`, name.split('-').map(part => part[0].toUpperCase()+part.slice(1)).join('')+'Module')));
  const Clock = await loadAi('rental-common/rental-clock', 'RentalClock');
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Overview, ...nativeModules,
  ] });
  builder.overrideProvider(Clock).useValue({now: () => new Date(now)});
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => {
    providerCalls++; throw Error('Forbidden AI26 provider');
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
  let [destination] = await db.query("SELECT id FROM modules WHERE link='/reservations'");
  if (!destination) [destination] = await db.query("INSERT INTO modules(module_group_id,sort_order,link,key) SELECT module_group_id,(SELECT COALESCE(MAX(m.sort_order),-1)+1 FROM modules m WHERE m.module_group_id=modules.module_group_id),'/reservations','synthetic_ai26_reservations' FROM modules WHERE key='nodia_ai' RETURNING id");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [destination.id]);
  const toolName = (resource, operation) => `nodia_${resource}_prepare_${operation}`;
  async function proposal(resource, operation, partial, actor = '1', expectedStatus = 'ready') {
    const chat = randomUUID(), identity = identities.get(actor);
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI26 only',clock_timestamp()+interval '90 days')", [chat,identity.userId,randomUUID(),'a'.repeat(64)]);
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
  const home=(await request('/rental/properties',{method:'POST',status:201,body:{name:'Synthetic AI26 house',timezone:'UTC',max_guests:6,minimum_turnover_minutes:60}})).resource_id;
  const foreign=(await request('/rental/properties',{actor:'2',method:'POST',status:201,body:{name:'Synthetic AI26 other',timezone:'UTC',max_guests:3}})).resource_id;
  const policy=(await request(`${path(home)}/cancellation-policies`,{method:'POST',status:201,body:{name:'Synthetic frozen terms',rules:[{min_days_before:0,refund_percent:'0'},{min_days_before:7,refund_percent:'50'},{min_days_before:14,refund_percent:'100'}]}})).resource_id;
  const booking=(extra={})=>({property_id:home,guest_name:'Synthetic AI26 guest',guest_contact:'synthetic@example.invalid',guests_count:2,channel:'whatsapp',check_in_on:'2030-05-10',check_out_on:'2030-05-12',check_in_time:'15:00',check_out_time:'11:00',nightly_rate:'50000',deposit_amount:'20000',cancellation_policy_id:policy,...extra});
  const availability=(house=home,extra={})=>request(`${path(house)}/availability?`+new URLSearchParams({check_in_on:'2030-05-10',check_out_on:'2030-05-12',check_in_time:'15:00',check_out_time:'11:00',...extra}));
  const view=(id,house=home,actor='1')=>request(`${path(house)}/reservations/${id}`,{actor});
  const fund=(id,amount='20000',extra={},house=home)=>request(`${path(house)}/payments`,{method:'POST',status:201,body:{reservation_id:id,type:'payment',amount,occurred_on:'2030-05-01',...extra}});
  const nativeBooking=async(extra={},house=home)=>{
    const {property_id:_property,...command}=booking(extra);
    return (await request(`${path(house)}/reservations`,{actor:house===foreign?'2':'1',method:'POST',status:201,body:command})).resource_id;
  };
  const pay=(id,amount='20000',extra={},house=home)=>({property_id:house,reservation_id:id,type:'payment',amount,occurred_on:'2030-05-01',...extra});
  const expense=(extra={},house=home)=>({property_id:house,name:'Synthetic maintenance',amount:'5000',incurred_on:'2030-05-01',status:'pending',...extra});
  const run=(resource,operation,args,actor='1')=>perform('rental_'+resource,operation,args,actor);
  const propose=(resource,operation,args,actor='1',expected='ready')=>proposal('rental_'+resource,operation,args,actor,expected);
  const reject=(resource,operation,args,actor='1',expected=[400,404,409])=>rejection('rental_'+resource,operation,args,actor,expected);
  const moneyView=(id,house=home,actor='1')=>request(`${path(house)}/payments/${id}`,{actor});
  const expenseView=(id,house=home,actor='1')=>request(`${path(house)}/expenses/${id}`,{actor});
  const turnView=(id,house=home,actor='1')=>request(`${path(house)}/turnovers/${id}`,{actor});
  const block=(extra={},house=home)=>({property_id:house,starts_at:'2030-09-01T12:00:00Z',ends_at:'2030-09-02T12:00:00Z',reason:'Synthetic maintenance',...extra});

  const missingPay=await propose('payments','create',{property_id:home},'1','needs_clarification');
  const missingExpense=await propose('expenses','create',{property_id:home},'1','needs_clarification');
  const missingBlock=await propose('blocks','create',{property_id:home},'1','needs_clarification');
  check('real required monetary block and expense fields are clarified without fabricating amounts states or dates',!missingPay.proposal_id&&!missingExpense.proposal_id&&!missingBlock.proposal_id&&await count('rental_payments')===0&&await count('rental_expenses')===0&&await count('rental_blocks')===0);
  const stay=await nativeBooking();
  const payment=await run('payments','create',pay(stay));
  const firstPaid=await view(stay);
  check('payment creation commits exact house cash and captures policy without creating a Finance movement',firstPaid.received_amount==='20000'&&firstPaid.policy_snapshot.kind==='direct'&&await count('finance_movements')===0);
  await run('payments','void',{property_id:home,id:payment.id,reason:'Synthetic correction'});
  check('voiding draft payment retains monetary history and frozen policy while removing cash contribution',(await moneyView(payment.id)).status==='voided'&&(await view(stay)).received_amount==='0'&&(await view(stay)).policy_snapshot.policy_id===policy&&await count('rental_payments')===1);
  const funded=await run('payments','create',pay(stay));
  await request(`${path(home)}/reservations/${stay}/confirm`,{method:'POST',body:{}});
  await reject('payments','void',{property_id:home,id:funded.id,reason:'Would remove required deposit'});
  check('payment void cannot underfund the agreed deposit after direct confirmation',(await moneyView(funded.id)).status==='confirmed');
  const stalePay=await propose('payments','create',pay(stay,'1'));
  await fund(stay,'1');
  await admit(stalePay,'1',409);
  check('a real native payment after preview invalidates exact payment preconditions without timestamp assumptions',(await view(stay)).received_amount==='20001');
  await reject('payments','create',pay(stay,'100000'));
  await reject('payments','create',pay(stay,'1',{occurred_on:'2030-05-02'}));
  await reject('payments','create',pay(stay,'0'));
  await reject('payments','create',pay(stay,'1',{},foreign),'2',[404]);
  check('money contracts reject overpayment future dates zero and foreign associations');
  await request(`${path(home)}/reservations/${stay}/cancel`,{method:'POST',body:{cancelled_at:'2030-05-01T11:00:00Z',expected_refund_amount:'10000'}});
  const refund1=await run('payments','create',pay(stay,'6000',{type:'refund'}));
  const refund2=await run('payments','create',pay(stay,'2000',{type:'refund'}));
  check('partial refunds reduce approved liability without changing original receipts or retained amount',(await view(stay)).refunded_amount==='8000'&&(await view(stay)).refund_due_amount==='2000'&&(await view(stay)).retained_amount==='10001');
  await run('payments','void',{property_id:home,id:refund2.id,reason:'Synthetic refund entered twice'});
  check('voided refund remains in history and restores remaining refund liability',(await moneyView(refund2.id)).status==='voided'&&(await view(stay)).refunded_amount==='6000'&&(await view(stay)).refund_due_amount==='4000');
  await run('payments','create',pay(stay,'4000',{type:'refund'}));
  await reject('payments','create',pay(stay,'1',{type:'refund'}));
  await reject('payments','void',{property_id:home,id:funded.id,reason:'Cannot rewrite cancelled monetary basis'});
  check('cumulative refunds cannot exceed approved cancellation and cancelled payments cannot be voided',(await view(stay)).refund_due_amount==='0'&&(await moneyView(refund1.id)).status==='confirmed');

  const pending=await run('expenses','create',expense({name:'  Synthetic maintenance  ',notes:'  '}));
  check('expense creates pending exact amount with normalized nullable notes and no automatic payment',(await expenseView(pending.id)).status==='pending'&&(await expenseView(pending.id)).paid_on===null&&(await expenseView(pending.id)).notes===null);
  await run('expenses','update',{property_id:home,id:pending.id,amount:'7000',category:null,reservation_id:stay});
  await run('expenses','pay',{property_id:home,id:pending.id,paid_on:'2030-05-01'});
  check('expense edit and pay use native association and explicit payment date',(await expenseView(pending.id)).amount==='7000'&&(await expenseView(pending.id)).status==='paid'&&(await expenseView(pending.id)).paid_on==='2030-05-01');
  await reject('expenses','update',{property_id:home,id:pending.id,amount:'8000'});
  await run('expenses','update',{property_id:home,id:pending.id,notes:'Post-payment description correction'});
  await run('expenses','void',{property_id:home,id:pending.id,reason:'Synthetic correction'});
  check('paid amount remains immutable while metadata corrections and void retain history',(await expenseView(pending.id)).amount==='7000'&&(await expenseView(pending.id)).status==='voided'&&(await expenseView(pending.id)).paid_on===null);
  await reject('expenses','pay',{property_id:home,id:pending.id,paid_on:'2030-05-01'});
  const foreignStay=await nativeBooking({cancellation_policy_id:null},foreign);
  await reject('expenses','create',expense({reservation_id:foreignStay}));
  await reject('expenses','create',expense({status:'paid',paid_on:'2030-05-02'}));
  await reject('expenses','create',expense({amount:'0'}));
  check('voided expense cannot pay again and associations zero or future money dates fail closed');
  const huge=await run('expenses','create',expense({amount:'9007199254740993',status:'paid',paid_on:'2030-05-01'}));
  check('paid expense creation preserves amounts above JavaScript safe integer exactly',(await expenseView(huge.id)).amount==='9007199254740993');

  const blocked=await run('blocks','create',block());
  const noteSafe=await propose('blocks','update',{property_id:home,id:blocked.id,reason:'Exact maintenance label'});
  await request(`${path(home)}/blocks/${blocked.id}`,{method:'PUT',body:{notes:'Concurrent unrelated block note'}});
  const noteSafeAdmission=await admit(noteSafe),noteSafeClaim=await claim();await execute.execute(identities.get('1'),noteSafeAdmission.execution_id,noteSafeClaim);
  check('a confirmed block reason change preserves unrelated concurrent notes without spurious reconfirmation',(await request(`${path(home)}/blocks/${blocked.id}`)).notes==='Concurrent unrelated block note');
  const observed=await availability(home,{check_in_on:'2030-09-01',check_out_on:'2030-09-03'});
  await reject('blocks','create',block({starts_at:'2030-09-01T13:00:00Z'}));
  check('active whole-house block is visible to real availability and rejects overlapping blocks',observed.conflicts.some(r=>r.resource_type==='block'&&r.id===blocked.id));
  await run('blocks','update',{property_id:home,id:blocked.id,is_active:false,notes:null});
  check('deactivating a block releases dates while preserving its record',!(await availability(home,{check_in_on:'2030-09-01',check_out_on:'2030-09-03'})).conflicts.some(r=>r.id===blocked.id));
  const race=await admit(await propose('blocks','create',block({starts_at:'2030-09-10T12:00:00Z',ends_at:'2030-09-12T12:00:00Z'})));
  const occupying=await nativeBooking({channel:'airbnb',external_reference:'SYNTHETIC-RACE',deposit_amount:'0',cancellation_policy_id:null,check_in_on:'2030-09-10',check_out_on:'2030-09-12'});
  await request(`${path(home)}/reservations/${occupying}/confirm`,{method:'POST',body:{platform_policy:{reference:'Synthetic external',description:'Synthetic explicit external terms'}}});
  await worker.execute(randomUUID(),new AbortController().signal);
  check('native confirmed occupancy between admission and execution defeats a stale block without overlapping calendar',(await status(race.execution_id)).state==='failed'&&await count('rental_blocks',"is_active AND starts_at=$1",['2030-09-10T12:00:00Z'])===0);
  const raceInput=block({starts_at:'2030-09-20T12:00:00Z',ends_at:'2030-09-22T12:00:00Z'});
  const raceA=await admit(await propose('blocks','create',raceInput)),raceB=await admit(await propose('blocks','create',raceInput));
  await Promise.all([worker.execute(randomUUID(),new AbortController().signal),worker.execute(randomUUID(),new AbortController().signal)]);
  // Per-actor admission can leave the second claim queued while the first owns its slot.
  await worker.execute(randomUUID(),new AbortController().signal);
  const racing=[(await status(raceA.execution_id)).state,(await status(raceB.execution_id)).state].sort();
  check('concurrent admitted overlapping block writers serialize on the house and commit exactly one',JSON.stringify(racing)===JSON.stringify(['completed','failed'])&&await count('rental_blocks',"is_active AND starts_at=$1",[raceInput.starts_at])===1);

  const transitionHome=(await request('/rental/properties',{method:'POST',status:201,body:{name:'Synthetic AI26 transitions',timezone:'UTC',max_guests:6,minimum_turnover_minutes:60}})).resource_id;
  const platformDraft=(extra={})=>({channel:'airbnb',external_reference:'SYNTHETIC-'+randomUUID(),deposit_amount:'0',cancellation_policy_id:null,...extra});
  const external={reference:'Synthetic external',description:'Synthetic explicit conditions'};
  const previous=await nativeBooking(platformDraft({check_in_on:'2030-05-01',check_out_on:'2030-05-03'}),transitionHome);
  await request(`${path(transitionHome)}/reservations/${previous}/confirm`,{method:'POST',body:{platform_policy:external}});
  const incoming=await nativeBooking(platformDraft({check_in_on:'2030-05-03',check_out_on:'2030-05-05'}),transitionHome);
  const incomingView=await view(incoming,transitionHome),turnoverId=incomingView.turnover_id;
  await run('turnovers','update',{property_id:transitionHome,id:turnoverId,linen_ready:null,notes:'  '} );
  check('preparation accepts unknown linen separately from false and normalizes blank notes',(await turnView(turnoverId,transitionHome)).linen_ready===null&&(await turnView(turnoverId,transitionHome)).notes===null);
  await run('turnovers','update',{property_id:transitionHome,id:turnoverId,linen_ready:false});
  await reject('turnovers','approve_same_day',{property_id:transitionHome,id:turnoverId});
  await reject('turnovers','update',{property_id:transitionHome,id:turnoverId,linen_ready:true,cleaning_status:'completed',ready_at:'2030-05-03T12:00:00Z'});
  check('false linen blocks approval and future actual readiness is rejected without changing cleaning facts',(await turnView(turnoverId,transitionHome)).linen_ready===false&&(await turnView(turnoverId,transitionHome)).ready_at===null);
  await run('turnovers','update',{property_id:transitionHome,id:turnoverId,linen_ready:true,planned_ready_at:'2030-05-03T13:00:00Z'});
  const beforeApproval=await propose('turnovers','approve_same_day',{property_id:transitionHome,id:turnoverId});
  await request(`${path(transitionHome)}/turnovers/${turnoverId}`,{method:'PUT',body:{notes:'Unrelated approval note'}});
  now=new Date('2030-05-01T13:00:00Z');
  const approvalAdmission=await admit(beforeApproval),approvalClaim=await claim();
  await execute.execute(identities.get('1'),approvalAdmission.execution_id,approvalClaim);exercised.add('rental_turnovers/approve_same_day');
  check('future same-day plan approval remains stable across clock time and does not fabricate cleaning or readiness',(await turnView(turnoverId,transitionHome)).same_day_approved_at!==null&&(await turnView(turnoverId,transitionHome)).cleaning_status==='pending'&&(await turnView(turnoverId,transitionHome)).ready_at===null);
  await request(`${path(transitionHome)}/reservations/${incoming}/confirm`,{method:'POST',body:{platform_policy:external}});
  await reject('blocks','create',block({starts_at:'2030-05-03T12:00:00Z',ends_at:'2030-05-03T14:00:00Z'},transitionHome));
  check('a block cannot silently invalidate an explicitly approved same-day transition',(await turnView(turnoverId,transitionHome)).same_day_approved_at!==null);
  await run('turnovers','update',{property_id:transitionHome,id:turnoverId,planned_ready_at:'2030-05-03T13:30:00Z'});
  check('changing a material plan clears previous approval',(await turnView(turnoverId,transitionHome)).same_day_approved_at===null);
  await request(`${path(transitionHome)}/turnovers/${turnoverId}`,{method:'PUT',body:{cleaning_status:'in_progress'}});
  const clearing=await propose('blocks','create',block({starts_at:'2030-05-03T12:00:00Z',ends_at:'2030-05-03T14:00:00Z'},transitionHome));
  check('block preview discloses the exact preparation records its native writer will reset',clearing.steps[0].changes.some(c=>c.field_key==='affected_turnover_ids'&&c.after.items.includes(turnoverId)));
  const failedClearing=await admit(clearing),failedClearingClaim=await claim();
  const beforeBlockRollback={blocks:await count('rental_blocks'),operations:await count('rental_operations'),audits:await count('rental_audit_events')};
  await db.query("CREATE FUNCTION synthetic_ai26_block_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai26_block_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai26_block_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai26_block_receipt_failure()");
  try{await assert.rejects(execute.execute(identities.get('1'),failedClearing.execution_id,failedClearingClaim));}finally{await db.query('DROP TRIGGER synthetic_ai26_block_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai26_block_receipt_failure()');}
  await recovery.execute(failedClearingClaim,'nodia_ai:execution_conflict');
  check('failed block receipt restores native preparation invalidation block journal and audit atomically',(await turnView(turnoverId,transitionHome)).cleaning_status==='in_progress'&&await count('rental_blocks')===beforeBlockRollback.blocks&&await count('rental_operations')===beforeBlockRollback.operations&&await count('rental_audit_events')===beforeBlockRollback.audits);
  const clearingAdmission=await admit(await propose('blocks','create',block({starts_at:'2030-05-03T12:00:00Z',ends_at:'2030-05-03T14:00:00Z'},transitionHome))),clearingClaim=await claim();await execute.execute(identities.get('1'),clearingAdmission.execution_id,clearingClaim);
  check('block effect resets native actual preparation without inventing approval',(await turnView(turnoverId,transitionHome)).ready_at===null&&(await turnView(turnoverId,transitionHome)).cleaning_status==='pending');
  now=new Date('2030-05-03T16:00:00Z');
  await run('turnovers','update',{property_id:transitionHome,id:turnoverId,linen_ready:true,cleaning_status:'completed',ready_at:'2030-05-03T15:30:00Z'});
  check('late but real readiness is recordable and remains distinct from punctual planned readiness',(await turnView(turnoverId,transitionHome)).ready_at==='2030-05-03T15:30:00.000Z');
  const stalePrep=await propose('turnovers','update',{property_id:transitionHome,id:turnoverId,notes:'Must not overwrite concurrent preparation'});
  await request(`${path(transitionHome)}/turnovers/${turnoverId}`,{method:'PUT',body:{notes:'Concurrent correction'}});
  await admit(stalePrep,'1',409);
  check('same-timestamp material preparation edits invalidate an earlier preview');
  await reject('turnovers','update',{property_id:home,id:turnoverId,notes:'Foreign house'});
  await reject('turnovers','approve_same_day',{property_id:transitionHome,id:turnoverId,same_day_approved_at:'2030-05-01T12:00:00Z'});
  check('turnover associations and server-owned approval fields cannot be forged');

  await request(path(home),{method:'PUT',body:{is_active:false}});
  const archivedStay=await nativeBooking(platformDraft({check_in_on:'2030-12-01',check_out_on:'2030-12-03'}),foreign);
  await reject('blocks','create',block());
  await run('blocks','update',{property_id:home,id:blocked.id,reason:'Historical correction',is_active:false});
  const archivedExpense=await run('expenses','create',expense({name:'Real archived house settlement'}));
  await run('expenses','pay',{property_id:home,id:archivedExpense.id,paid_on:'2030-05-03'});
  await run('payments','create',pay(occupying,'1000',{occurred_on:'2030-05-03'}));
  check('archived house blocks new calendar use but keeps real expense and existing reservation settlement',(await expenseView(archivedExpense.id)).status==='paid'&&(await view(occupying)).received_amount==='1000');
  await request(path(home),{method:'PUT',body:{is_active:true}});
  const adminExpense=await run('expenses','create',expense({name:'Actual SA author on foreign house',reservation_id:archivedStay},foreign),'3');
  check('super administrator writes under actual actor identity and does not impersonate foreign owner',(await expenseView(adminExpense.id,foreign,'3')).created_by==='3');
  const [originalTemplate]=await db.query('SELECT command_template FROM nodia_ai_proposal_steps WHERE proposal_id=$1',[pending.proposal.proposal_id]);
  const recoveredIntent=await request(`${path(home)}/operations/${originalTemplate.command_template.request_key}`);
  await request(`${path(home)}/operations/${originalTemplate.command_template.request_key}`,{actor:'3',status:404});
  const adminRead=await status(pending.execution.execution_id,'3');
  check('native journal recovery belongs only to original actor while SA can observe foreign execution receipt',recoveredIntent.body.resource_id===pending.id&&adminRead.steps[0].result_refs[0].id===pending.id&&!adminRead.can_resume);
  await request(`/nodia-ai/proposals/${pending.proposal.proposal_id}/confirmation-challenge`,{actor:'3',method:'POST',status:[403,404],body:{proposal_revision:pending.proposal.revision,expected_hash:pending.proposal.hash}});
  await request(`/nodia-ai/operations/${pending.execution.execution_id}/resume`,{actor:'3',method:'POST',status:[403,404],body:{client_request_id:randomUUID(),expected_execution_revision:adminRead.revision}});
  check('SA observation does not grant confirming or resuming another actors proposal execution');

  await request(`${path(home)}/collaborators`,{method:'POST',status:201,body:{user_id:'2'}});
  const memberExpense=await run('expenses','create',expense({name:'Member actual author'}),'2');
  check('a module-authorized collaborator retains actual native authorship',(await expenseView(memberExpense.id,home,'2')).created_by==='2');
  const revoked=await admit(await propose('expenses','update',{property_id:home,id:memberExpense.id,notes:'Must not write'},'2'),'2');
  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1',[destination.id]);await worker.execute(randomUUID(),new AbortController().signal);await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)',[destination.id]);
  check('destination module revocation before execution prevents expense writer',(await status(revoked.execution_id,'2')).state==='failed'&&(await expenseView(memberExpense.id,home,'2')).notes===null);
  const revokedSession=await admit(await propose('expenses','update',{property_id:home,id:memberExpense.id,notes:'Must not write revoked session'},'2'),'2');
  await db.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',[identities.get('2').sessionId]);await worker.execute(randomUUID(),new AbortController().signal);await db.query('UPDATE auth_sessions SET revoked_at=NULL WHERE public_id=$1',[identities.get('2').sessionId]);
  check('session revocation before execution cannot apply confirmed expense update',(await status(revokedSession.execution_id,'2')).state==='failed'&&(await expenseView(memberExpense.id,home,'2')).notes===null);

  const rollback=await admit(await propose('payments','create',pay(occupying,'1',{occurred_on:'2030-05-03'}))),rollbackClaim=await claim();
  const beforeRollback={payments:await count('rental_payments'),operations:await count('rental_operations'),audits:await count('rental_audit_events')};
  await db.query("CREATE FUNCTION synthetic_ai26_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai26_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai26_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai26_receipt_failure()");
  try{await assert.rejects(execute.execute(identities.get('1'),rollback.execution_id,rollbackClaim));}finally{await db.query('DROP TRIGGER synthetic_ai26_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai26_receipt_failure()');}
  await recovery.execute(rollbackClaim,'nodia_ai:execution_conflict');
  check('payment receipt failure rolls back native monetary effect policy journal and audit atomically',await count('rental_payments')===beforeRollback.payments&&await count('rental_operations')===beforeRollback.operations&&await count('rental_audit_events')===beforeRollback.audits);

  const waitFor=async(read,predicate,description,timeout=20000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await read();if(predicate(value))return value;await delay(30);}throw Error('Timed out: '+description);};
  const childWorker=async()=>{
    const child=fork(fileURLToPath(new URL('./nodia-ai-ai26-worker.fixture.mjs',import.meta.url)),[],{cwd:fileURLToPath(new URL('..',import.meta.url)),windowsHide:true,silent:true,env:{...process.env,DOTENV_CONFIG_PATH:process.platform==='win32'?'NUL':'/dev/null',NODIA_AI26_FIXTURE_DB:JSON.stringify(options)}});
    children.add(child);const messages=[];let output='',exited;
    child.on('message',message=>messages.push(message));child.on('exit',(code,signal)=>{exited={code,signal};children.delete(child);});child.on('error',error=>{exited={message:error.message};});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-32768);});
    const next=async type=>waitFor(async()=>{const message=messages.find(value=>value.type===type||value.type==='error');if(message?.type==='error')throw Error(JSON.stringify(message));if(exited)throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);return message;},Boolean,'child '+type);
    await next('ready');return {child,next};
  };
  const crashed=await admit(await propose('expenses','update',{property_id:home,id:memberExpense.id,notes:'Synthetic recovered expense'}));
  const crashing=await childWorker();crashing.child.send({type:'claim',workerId:randomUUID()});assert.equal((await crashing.next('claimed')).claim.executionId,crashed.execution_id);await kill(crashing.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1",[crashed.execution_id]);await recovery.execute();const crashResult=await status(crashed.execution_id);
  check('real child death after claim leaves no native effect and permits explicit recovery',crashResult.state==='failed'&&crashResult.can_resume&&(await expenseView(memberExpense.id)).notes===null);
  const resumeBody={client_request_id:randomUUID(),expected_execution_revision:crashResult.revision};
  await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});await request(`/nodia-ai/operations/${crashed.execution_id}/resume`,{method:'POST',status:202,body:resumeBody});
  const beforeResume=await count('rental_operations');await worker.execute(randomUUID(),new AbortController().signal);
  check('duplicate human resume commits a single expense edit receipt and native journal',(await status(crashed.execution_id)).state==='completed'&&(await expenseView(memberExpense.id)).notes==='Synthetic recovered expense'&&await count('rental_operations')===beforeResume+1);
  const lost=await admit(await propose('expenses','pay',{property_id:home,id:memberExpense.id,paid_on:'2030-05-03'})),lostClaim=await claim();
  const Store=await loadAi('nodia-ai-execution/nodia-ai-execution.service','NodiaAiExecutionService'),store=compiled.get(Store),transaction=store.transaction.bind(store),beforeLost=await count('rental_operations');
  store.transaction=async work=>{await transaction(work);throw Error('synthetic_ai26_post_commit_response_lost');};
  try{await assert.rejects(execute.execute(identities.get('1'),lost.execution_id,lostClaim),error=>error.getStatus?.()===503);}finally{store.transaction=transaction;}
  await recovery.execute();const recovered=await execute.execute(identities.get('1'),lost.execution_id,lostClaim);
  check('lost pay COMMIT response recovers exact receipt without duplicating expense cash or journal',recovered.state==='completed'&&await count('rental_operations')===beforeLost+1&&(await expenseView(memberExpense.id)).status==='paid');
  check('all ten monetary calendar and preparation operations execute via compiled native writers',exercised.size===10);
  check('local effects never invoke provider or acquire inference slots',providerCalls===0&&await count('nodia_ai_runtime_slots')===0);
  check('execution attempts and leases finish without orphaned jobs',await count('nodia_ai_job_attempts','ended_at IS NULL')===0&&await count('nodia_ai_jobs',"state='leased'")===0);
  console.log(JSON.stringify({stage:'AI-26',scope:'compiled_http_confirmation_worker_disposable_postgresql_ten_money_block_turnover_operations_no_provider',checks:checks.length,exercised_operations:[...exercised].sort(),passed:checks},null,2));
}catch(error){console.error(JSON.stringify({stage:'AI-26',completed_checks:checks.length,last_checks:checks.slice(-4)}));throw error;}
finally{for(const child of children)await kill(child);if(app)await app.close();await fixture.close();}
