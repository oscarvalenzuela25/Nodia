// Compiled native contracts, human confirmation HTTP, real PostgreSQL and worker processes.
// Synthetic disposable records only. Preparation is an internal port, never a published MCP assertion.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { RequestMethod, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai21');
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
    loadAi('nodia-ai-execution/use-case/execute-nodia-ai-financial-execution.use-case', 'ExecuteNodiaAiFinancialExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'),
    loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase'),
    loadAi('common/redis/redis.service', 'RedisService'),
    loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'),
  ]);
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Overview,
  ] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => {
    providerCalls++; throw Error('Forbidden AI21 provider');
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
  async function request(path, { actor = '1', method = 'GET', body, status = 200 } = {}) {
    const response = await fetch(base + path, { method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = response.status === 204 ? null : await response.json();
    assert.equal(response.status, status, `${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  let [destination] = await db.query("SELECT id FROM modules WHERE link='/tools/finances-personal'");
  if (!destination) [destination] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/finances-personal','synthetic_ai21_finance' FROM modules WHERE key='nodia_ai' RETURNING id");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [destination.id]);
  const toolName = (resource, operation) => `nodia_finance_${resource}_prepare_${operation}`;
  async function proposal(resource, operation, partial, actor = '1', expectedStatus = 'ready') {
    const chat = randomUUID(), identity = identities.get(actor);
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI21 only',clock_timestamp()+interval '90 days')",
      [chat, identity.userId, randomUUID(), 'a'.repeat(64)]);
    const result = await db.transaction(manager => prepare.execute(manager, identity, { conversationId: chat, toolName: toolName(resource, operation), partial }));
    assert.equal(result.status, expectedStatus, JSON.stringify(result));
    return { chat, result, ...result.proposal };
  }
  async function admit(p, actor = '1', expectedStatus = 202) {
    const challenge = await request(`/nodia-ai/proposals/${p.proposal_id}/confirmation-challenge`, { actor, method: 'POST',
      body: { proposal_revision: p.revision, expected_hash: p.hash } });
    const value = await request(`/nodia-ai/proposals/${p.proposal_id}/confirm`, { actor, method: 'POST', status: expectedStatus,
      body: { client_request_id: randomUUID(), proposal_revision: p.revision, expected_hash: p.hash, confirmation_token: challenge.confirmation_token } });
    return value.execution;
  }
  const claim = () => claimer.execute(randomUUID());
  const status = (id, actor = '1') => request(`/nodia-ai/operations/${id}`, { actor });
  async function perform(resource, operation, partial, actor = '1') {
    const p = await proposal(resource, operation, partial, actor);
    const admitted = await admit(p, actor), acquired = await claim();
    assert.equal(acquired.executionId, admitted.execution_id);
    const result = await execute.execute(identities.get(actor), admitted.execution_id, acquired);
    assert.equal(result.state, 'completed');
    assert.equal(result.steps.length, 1);
    const [step] = await db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1', [admitted.execution_id]);
    const receipt = step.minimal_receipt;
    assert.equal(receipt.resource_key, `finance_${resource}`);
    assert.equal(receipt.subject_user_id, partial.owner_id ?? identities.get(actor).userId);
    if (resource !== 'movements' || operation !== 'create') assert.equal(receipt.operation, operation);
    if (operation !== 'create') assert.equal(receipt.resource_id, partial.id);
    assert.equal(result.steps[0].result_refs[0].id, receipt.resource_id);
    await execute.execute(identities.get(actor), admitted.execution_id, acquired);
    assert.equal((await status(admitted.execution_id, actor)).state, 'completed');
    exercised.add(`${resource}/${operation}`);
    return { id: receipt.resource_id, execution: result, proposal: p, claim: acquired, step };
  }
  const rejection = async (resource, operation, partial, actor = '1', expected = [400, 404, 409]) => {
    await assert.rejects(proposal(resource, operation, partial, actor), error => expected.includes(error.getStatus?.()));
  };
  const count = async (table, where = 'true', values = []) => (await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`, values))[0].n;
  const category = await perform('categories', 'create', { name: 'Synthetic food', key: 'synthetic_ai21_food' });
  check('category create commits one native row and historical receipt despite completed replay', await count('finance_categories', 'id=$1', [category.id]) === 1);
  await perform('categories', 'update', { id: category.id, name: 'Synthetic renamed food', is_active: false });
  check('category update archives using the native partial contract', (await request(`/finance/categories/${category.id}`)).is_active === false);
  await perform('categories', 'update', { id: category.id, is_active: true });
  const group = await perform('category_groups', 'create', { name: 'Synthetic group', key: 'synthetic_ai21_group', category_ids: [category.id] });
  check('group create commits its membership with the receipt', (await request(`/finance/category-groups/${group.id}`)).categories[0].id === category.id);
  await perform('category_groups', 'update', { id: group.id, name: 'Synthetic group renamed' });
  check('omitted group selection preserves memberships', (await request(`/finance/category-groups/${group.id}`)).categories.length === 1);
  await perform('category_groups', 'update', { id: group.id, category_ids: [] });
  check('explicit empty group selection clears memberships atomically', (await request(`/finance/category-groups/${group.id}`)).categories.length === 0);
  await perform('category_groups', 'update', { id: group.id, category_ids: [category.id] });

  const ordinary = await perform('movements', 'create', { name: 'Synthetic ordinary', amount: '20000', type: 'expense', status: 'pending', category_id: category.id });
  await perform('movements', 'update', { id: ordinary.id, status: 'paid', amount: '21000' });
  check('movement update confirms pending expense and returns the native amount', (await request(`/finance/movements/${ordinary.id}`)).amount === '21000');
  await rejection('movements', 'update', { id: ordinary.id, status: 'pending' });
  check('confirmed movement cannot silently reopen to pending');
  await perform('categories', 'update', { id: category.id, is_active: false });
  await perform('movements', 'update', { id: ordinary.id, name: 'Synthetic archived relation retained' });
  check('editing a historical movement preserves an unchanged archived category', (await request(`/finance/movements/${ordinary.id}`)).category_id === category.id);
  await rejection('movements', 'create', { name: 'Blocked archived relation', amount: '1', type: 'expense', status: 'paid', category_id: category.id });
  check('new movements cannot use archived categories');
  await perform('categories', 'update', { id: category.id, is_active: true });

  const debt = await perform('obligations', 'create', { name: 'Synthetic debt', key: 'synthetic_ai21_debt', type: 'debt', amount: '10000', category_id: category.id });
  let debtView = await request(`/finance/obligations/${debt.id}`);
  check('obligation create atomically creates its initial movement with matching amount and direction', debtView.initial_movement.type === 'income' && debtView.initial_movement.status === 'received' && debtView.initial_movement.amount === '10000');
  const pending = await perform('movements', 'create', { name: 'Synthetic partial repayment', amount: '4000', type: 'expense', status: 'pending', category_id: category.id, obligation_id: debt.id });
  check('pending repayment does not reserve or reduce the historical obligation balance', (await request(`/finance/obligations/${debt.id}`)).paid_amount === '0');
  await perform('movements', 'update', { id: pending.id, status: 'paid' });
  debtView = await request(`/finance/obligations/${debt.id}`);
  check('partial payment confirmation updates exact paid and remaining values', debtView.paid_amount === '4000' && debtView.remaining_amount === '6000');
  await rejection('movements', 'create', { name: 'Synthetic overpayment', amount: '6001', type: 'expense', status: 'paid', category_id: category.id, obligation_id: debt.id });
  await rejection('obligations', 'update', { id: debt.id, amount: '3999' });
  check('native payment and principal rules reject overpayment and principal below confirmed repayments');
  await perform('obligations', 'update', { id: debt.id, amount: '12000', description: null });
  debtView = await request(`/finance/obligations/${debt.id}`);
  check('principal edit atomically updates its initial movement and calculated remaining balance', debtView.amount === '12000' && debtView.initial_movement.amount === '12000' && debtView.remaining_amount === '8000' && debtView.description === null);
  await rejection('movements', 'delete', { id: debtView.initial_movement.id });
  await rejection('obligations', 'delete', { id: debt.id });
  await rejection('categories', 'delete', { id: category.id });
  check('native deletion protections cover initial movements obligations with payments and categories with any movements');
  await perform('movements', 'update', { id: pending.id, is_active: false });
  check('archiving a confirmed payment does not change its amortization contribution', (await request(`/finance/obligations/${debt.id}`)).paid_amount === '4000');
  await perform('movements', 'delete', { id: pending.id });
  check('deleting a payment preserves its historical deletion receipt and recalculates obligation balance', (await request(`/finance/obligations/${debt.id}`)).paid_amount === '0');
  await request(`/finance/movements/${pending.id}`, { status: 404 });
  await perform('movements', 'update', { id: debtView.initial_movement.id, status: 'cancelled' });
  check('cancelled origin exposes unknown remaining amount rather than a fabricated zero', (await request(`/finance/obligations/${debt.id}`)).remaining_amount === null);
  await rejection('movements', 'create', { name: 'Synthetic cancelled origin', amount: '1', type: 'expense', status: 'paid', category_id: category.id, obligation_id: debt.id });
  check('cancelled origin prevents new obligation repayments');
  await perform('obligations', 'delete', { id: debt.id });
  check('deleting obligation without payments removes the obligation and initial movement in the same effect', await count('finance_obligations', 'id=$1', [debt.id]) === 0 && await count('finance_movements', 'id=$1', [debtView.initial_movement.id]) === 0);

  const loan = await perform('obligations', 'create', { name: 'Synthetic loan', key: 'synthetic_ai21_loan', type: 'loan', amount: '100', category_id: category.id });
  const loanView = await request(`/finance/obligations/${loan.id}`);
  check('loan initial movement uses the opposite direction from debt', loanView.initial_movement.type === 'expense' && loanView.initial_movement.status === 'paid');
  const cancelledPayment = await perform('movements', 'create', { name: 'Synthetic cancelled payment', amount: '1', type: 'income', status: 'cancelled', is_active: false, category_id: category.id, obligation_id: loan.id });
  await rejection('obligations', 'delete', { id: loan.id });
  check('even archived cancelled payments prevent implicit obligation cascade deletion');
  await perform('movements', 'delete', { id: cancelledPayment.id });
  await perform('obligations', 'delete', { id: loan.id });

  await perform('movements', 'delete', { id: ordinary.id });
  await perform('categories', 'delete', { id: category.id });
  check('deleting an unused category removes group pivots while preserving its group', (await request(`/finance/category-groups/${group.id}`)).categories.length === 0);
  const otherCategory = await perform('categories', 'create', { name: 'Synthetic preserved', key: 'synthetic_ai21_preserved' });
  await perform('category_groups', 'update', { id: group.id, category_ids: [otherCategory.id] });
  await perform('category_groups', 'delete', { id: group.id });
  check('group deletion preserves categories and only removes memberships', (await request(`/finance/categories/${otherCategory.id}`)).id === otherCategory.id);
  assert.equal(exercised.size, 12);
  check('all twelve registered financial create update and delete operations commit a verified receipt', exercised.size === 12);

  const foreignCategory = await perform('categories', 'create', { name: 'Synthetic owner two', key: 'synthetic_ai21_owner2', owner_id: '2' }, '3');
  const foreignMovement = await perform('movements', 'create', { name: 'Synthetic delegated owner', amount: '7', category_id: foreignCategory.id, type: 'expense', status: 'paid', owner_id: '2' }, '3');
  await request(`/finance/movements/${foreignMovement.id}`, { status: 404 });
  check('super admin explicit owner creates native data for that owner without impersonating their chat', (await request(`/finance/movements/${foreignMovement.id}`, { actor: '2' })).user_id === '2');
  for (const [resource, fields] of [
    ['categories', { name: 'Forbidden owner', key: 'forbidden_owner' }],
    ['category_groups', { name: 'Forbidden owner', key: 'forbidden_owner', category_ids: [] }],
    ['movements', { name: 'Forbidden owner', amount: '1', type: 'expense', status: 'paid', category_id: foreignCategory.id }],
    ['obligations', { name: 'Forbidden owner', key: 'forbidden_owner', type: 'debt', amount: '1', category_id: foreignCategory.id }],
  ]) {
    await rejection(resource, 'create', { ...fields, owner_id: '2' }, '1', [403]);
  }
  await rejection('movements', 'update', { id: foreignMovement.id, name: 'Must not write' }, '1', [404]);
  await rejection('movements', 'create', { name: 'Wrong owner category', amount: '1', type: 'expense', status: 'paid', category_id: foreignCategory.id }, '1', [404]);
  check('ordinary actor cannot target another owner or smuggle a foreign category association');
  const incomplete = await proposal('category_groups', 'create', { name: 'Synthetic missing selection', key: 'synthetic_missing_selection' }, '1', 'needs_clarification');
  check('required group selection is clarified instead of silently defaulting to an empty list', incomplete.result.missing_fields.includes('category_ids'));
  await rejection('categories', 'create', { name: 'Synthetic invalid key', key: 'synthetic_invalid_key', user_id: '2' });
  await rejection('movements', 'update', { id: foreignMovement.id, obligation_id: null });
  await rejection('movements', 'create', { name: 'Synthetic malformed money', amount: '1e3', category_id: otherCategory.id, type: 'expense', status: 'paid' });
  check('strict native commands reject unknown ownership fields immutable movement links and malformed money');
  const maxMovement = await perform('movements', 'create', { name: 'Synthetic exact bigint', amount: '9223372036854775807', category_id: otherCategory.id, type: 'expense', status: 'paid' });
  check('largest supported monetary bigint remains an exact decimal string in native data and receipt routing',
    (await request(`/finance/movements/${maxMovement.id}`)).amount === '9223372036854775807');
  await perform('movements', 'delete', { id: maxMovement.id });

  // Snapshots are material proofs, never a timestamp-only optimistic lock.
  const changedProposal = await proposal('categories', 'update', { id: otherCategory.id, name: 'Synthetic intended rename' });
  await db.query('UPDATE finance_categories SET name=$2 WHERE id=$1', [otherCategory.id, 'Synthetic externally renamed']);
  await admit(changedProposal, '1', 409);
  check('same timestamp target edits invalidate the original category proposal before confirmation');
  const postAdmission = await admit(await proposal('categories', 'update', { id: otherCategory.id, name: 'Synthetic intended dispatch' }));
  await db.query('UPDATE finance_categories SET key=$2 WHERE id=$1', [otherCategory.id, 'synthetic_ai21_external_key']);
  await worker.execute(randomUUID(), new AbortController().signal);
  const changedStatus = await status(postAdmission.execution_id);
  check('material changes after admission fail without effect and cannot resume the old snapshot', changedStatus.state === 'failed' && changedStatus.can_resume === false &&
    (await request(`/finance/categories/${otherCategory.id}`)).name === 'Synthetic externally renamed');

  const pivotGroup = await perform('category_groups', 'create', { name: 'Synthetic pivot scope', key: 'synthetic_ai21_pivot', category_ids: [otherCategory.id] });
  const pivotProposal = await proposal('category_groups', 'delete', { id: pivotGroup.id });
  await db.query('UPDATE finance_category_group_memberships SET is_active=false WHERE category_group_id=$1 AND category_id=$2', [pivotGroup.id, otherCategory.id]);
  await admit(pivotProposal, '1', 409);
  check('changed group membership invalidates a frozen deletion preview without relying on group timestamp');

  const snapshotDebt = await perform('obligations', 'create', { name: 'Synthetic material ledger', key: 'synthetic_ai21_material', type: 'debt', amount: '10', category_id: otherCategory.id });
  const snapshotDebtView = await request(`/finance/obligations/${snapshotDebt.id}`);
  const initialProposal = await proposal('obligations', 'update', { id: snapshotDebt.id, amount: '11' });
  await db.query('UPDATE finance_movements SET name=$2 WHERE id=$1', [snapshotDebtView.initial_movement.id, 'Synthetic externally edited initial']);
  await admit(initialProposal, '1', 409);
  check('obligation proposal detects a materially changed initial movement even with an unchanged timestamp');
  const paymentSnapshot = await admit(await proposal('obligations', 'update', { id: snapshotDebt.id, description: 'Must not silently apply' }));
  await request('/finance/movements', { method: 'POST', status: 201, body: { name: 'Synthetic new pending association', amount: '1', type: 'expense', status: 'pending', category_id: otherCategory.id, obligation_id: snapshotDebt.id } });
  await worker.execute(randomUUID(), new AbortController().signal);
  const paymentSnapshotState = await status(paymentSnapshot.execution_id);
  check('a new pending payment changes the frozen obligation association snapshot before dispatch', paymentSnapshotState.state === 'failed' &&
    !paymentSnapshotState.can_resume && (await request(`/finance/obligations/${snapshotDebt.id}`)).description === null);

  const concurrentDebt = await perform('obligations', 'create', { name: 'Synthetic concurrent debt', key: 'synthetic_ai21_concurrent', type: 'debt', amount: '10', category_id: otherCategory.id });
  const paymentCommand = { name: 'Synthetic racing payment', amount: '7', type: 'expense', status: 'paid', category_id: otherCategory.id, obligation_id: concurrentDebt.id };
  const a = await admit(await proposal('movements', 'create', paymentCommand));
  const b = await admit(await proposal('movements', 'create', paymentCommand));
  await Promise.all([worker.execute(randomUUID(), new AbortController().signal), worker.execute(randomUUID(), new AbortController().signal)]);
  // Per-owner admission capacity may serialize both claims. Drain the second ready intent explicitly.
  await worker.execute(randomUUID(), new AbortController().signal);
  const paymentStates = await Promise.all([status(a.execution_id), status(b.execution_id)]);
  const concurrentView = await request(`/finance/obligations/${concurrentDebt.id}`);
  check('two confirmed payment intents cannot exceed remaining balance under concurrent SQL workers', paymentStates.filter(value => value.state === 'completed').length === 1 &&
    paymentStates.filter(value => value.state === 'failed').length === 1 && concurrentView.paid_amount === '7' && concurrentView.remaining_amount === '3');

  const nativeRaceDebt = await perform('obligations', 'create', { name: 'Synthetic native race', key: 'synthetic_ai21_native_race', type: 'debt', amount: '10', category_id: otherCategory.id });
  const nativeRaceCommand = { ...paymentCommand, obligation_id: nativeRaceDebt.id };
  const nativeRace = await admit(await proposal('movements', 'create', nativeRaceCommand)), nativeRaceClaim = await claim();
  const nativeRaceOutcomes = await Promise.allSettled([
    execute.execute(identities.get('1'), nativeRace.execution_id, nativeRaceClaim),
    fetch(base + '/finance/movements', { method: 'POST', headers: { 'content-type': 'application/json', 'x-fixture-actor': '1' }, body: JSON.stringify(nativeRaceCommand) }),
  ]);
  const nativeOutcome = nativeRaceOutcomes[1];
  assert.equal(nativeOutcome.status, 'fulfilled');
  assert.ok([201, 409].includes(nativeOutcome.value.status));
  if (nativeRaceOutcomes[0].status === 'rejected') await recovery.execute(nativeRaceClaim, 'nodia_ai:preconditions_changed');
  const nativeRaceView = await request(`/finance/obligations/${nativeRaceDebt.id}`);
  check('native HTTP payment and confirmed worker use the same SQL obligation lock and cannot overpay concurrently', nativeRaceView.paid_amount === '7' && nativeRaceView.remaining_amount === '3');

  const rollbackProposal = await admit(await proposal('category_groups', 'create', { name: 'Synthetic rollback group', key: 'synthetic_ai21_rollback', category_ids: [otherCategory.id] }));
  const rollbackClaim = await claim();
  await db.query("CREATE FUNCTION synthetic_ai21_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai21_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai21_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai21_receipt_failure()");
  try { await assert.rejects(execute.execute(identities.get('1'), rollbackProposal.execution_id, rollbackClaim)); }
  finally { await db.query('DROP TRIGGER synthetic_ai21_receipt_failure ON nodia_ai_execution_steps; DROP FUNCTION synthetic_ai21_receipt_failure()'); }
  await recovery.execute(rollbackClaim, 'nodia_ai:execution_conflict');
  const [rollbackStep] = await db.query('SELECT minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1', [rollbackProposal.execution_id]);
  check('receipt failure rolls back native group and its membership together rather than leaving an unacknowledged effect',
    await count('finance_category_groups', 'key=$1', ['synthetic_ai21_rollback']) === 0 && rollbackStep.minimal_receipt === null);

  const allReads = [
    '/finance/categories', `/finance/categories/${otherCategory.id}`,
    '/finance/category-groups', `/finance/category-groups/${pivotGroup.id}`,
    '/finance/movements', `/finance/movements/${concurrentView.initial_movement.id}`,
    '/finance/obligations', `/finance/obligations/${concurrentDebt.id}`,
    '/finance/overview', '/finance/overview/categories', '/finance/overview/category-groups',
  ];
  for (const path of allReads) await request(path);
  const routes = [];
  for (const [file, name] of [
    ['finance-category/finance-category.controller', 'FinanceCategoryController'],
    ['finance-category-group/finance-category-group.controller', 'FinanceCategoryGroupController'],
    ['finance-movement/finance-movement.controller', 'FinanceMovementController'],
    ['finance-obligation/finance-obligation.controller', 'FinanceObligationController'],
    ['finance-overview/finance-overview.controller', 'FinanceOverviewController'],
  ]) {
    const Controller = await loadAi(file, name);
    for (const key of Object.getOwnPropertyNames(Controller.prototype)) {
      const fn = Controller.prototype[key], method = Reflect.getMetadata('method', fn);
      if (method !== undefined) routes.push({ method: RequestMethod[method], path: `${Reflect.getMetadata('path', Controller)}/${Reflect.getMetadata('path', fn)}` });
    }
  }
  check('compiled native inventory contains eleven reads plus twelve mutations and all read routes remain accessible', routes.length === 23 && routes.filter(route => route.method === 'GET').length === 11 && allReads.length === 11);

  const waitFor = async (read, predicate, description, timeout = 20000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = await read(); if (predicate(value)) return value; await delay(30); }
    throw Error('Timed out: ' + description);
  };
  const childWorker = async () => {
    const child = fork(fileURLToPath(new URL('./nodia-ai-ai21-worker.fixture.mjs', import.meta.url)), [], {
      cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, silent: true,
      env: { ...process.env, DOTENV_CONFIG_PATH: process.platform === 'win32' ? 'NUL' : '/dev/null', NODIA_AI21_FIXTURE_DB: JSON.stringify(options) },
    });
    children.add(child);
    const messages = []; let output = '', exited;
    child.on('message', message => messages.push(message));
    child.on('exit', (code, signal) => { exited = { code, signal }; children.delete(child); });
    child.on('error', error => { exited = { message: error.message }; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-16384); });
    const next = async type => waitFor(async () => {
      const message = messages.find(value => value.type === type || value.type === 'error');
      if (message?.type === 'error') throw Error(JSON.stringify(message));
      if (exited) throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);
      return message;
    }, Boolean, 'child ' + type);
    await next('ready'); return { child, next };
  };
  const origin = async id => (await db.query(`SELECT e.id,e.origin_proposal_id,e.proposal_hash,s.id step_id,s.source_step_id,s.template_hash,s.native_request_key,s.bound_command_hash
    FROM nodia_ai_executions e JOIN nodia_ai_execution_steps s ON s.execution_id=e.id WHERE e.id=$1`, [id]))[0];
  const toCancel = await perform('categories', 'create', { name: 'Synthetic cancellation', key: 'synthetic_ai21_cancel' });
  const cancelDelete = await admit(await proposal('categories', 'delete', { id: toCancel.id }));
  const cancelClaim = await claim();
  const cancelResult = await request(`/nodia-ai/operations/${cancelDelete.execution_id}/cancel`, { method: 'POST',
    body: { client_request_id: randomUUID(), expected_execution_revision: cancelDelete.revision + 1 } });
  await assert.rejects(execute.execute(identities.get('1'), cancelDelete.execution_id, cancelClaim));
  check('cancelled claimed DELETE fences a stale worker and preserves the native record', cancelResult.execution.state === 'cancelled' && await count('finance_categories', 'id=$1', [toCancel.id]) === 1);

  const crashedUpdate = await admit(await proposal('categories', 'update', { id: toCancel.id, name: 'Synthetic resumed update' }));
  const before = await origin(crashedUpdate.execution_id), crashing = await childWorker();
  crashing.child.send({ type: 'claim', workerId: randomUUID() });
  const crashClaim = (await crashing.next('claimed')).claim;
  assert.equal(crashClaim.executionId, crashedUpdate.execution_id);
  await kill(crashing.child);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1", [crashedUpdate.execution_id]);
  await recovery.execute();
  const failed = await status(crashedUpdate.execution_id);
  check('real process death before UPDATE proves rollback without altering native data', failed.state === 'failed' && failed.can_resume &&
    (await request(`/finance/categories/${toCancel.id}`)).name === 'Synthetic cancellation');
  const resumeBody = { client_request_id: randomUUID(), expected_execution_revision: failed.revision };
  await request(`/nodia-ai/operations/${failed.execution_id}/resume`, { method: 'POST', status: 202, body: resumeBody });
  await request(`/nodia-ai/operations/${failed.execution_id}/resume`, { method: 'POST', status: 202, body: resumeBody });
  assert.deepEqual(await origin(failed.execution_id), before);
  await worker.execute(randomUUID(), new AbortController().signal);
  check('explicit UPDATE resume preserves source identity native key and exact payload while committing once', (await status(failed.execution_id)).state === 'completed' &&
    (await request(`/finance/categories/${toCancel.id}`)).name === 'Synthetic resumed update');

  const lostDelete = await admit(await proposal('categories', 'delete', { id: toCancel.id }));
  const lostClaim = await claim();
  const Store = await loadAi('nodia-ai-execution/nodia-ai-execution.service', 'NodiaAiExecutionService');
  const store = compiled.get(Store), transaction = store.transaction.bind(store);
  store.transaction = async work => { await transaction(work); throw Error('synthetic_ai21_post_commit_response_lost'); };
  try { await assert.rejects(execute.execute(identities.get('1'), lostDelete.execution_id, lostClaim), error => error.getStatus?.() === 503); }
  finally { store.transaction = transaction; }
  await recovery.execute();
  const observedDelete = await execute.execute(identities.get('1'), lostDelete.execution_id, lostClaim);
  check('lost DELETE COMMIT acknowledgement recovers its immutable receipt without requiring the deleted row', observedDelete.state === 'completed' &&
    observedDelete.steps[0].result_refs[0].id === toCancel.id && await count('finance_categories', 'id=$1', [toCancel.id]) === 0);

  // The actual standalone production entrypoint dispatches a new operation without model access.
  const standalone = await admit(await proposal('category_groups', 'create', { name: 'Synthetic standalone group', key: 'synthetic_ai21_standalone', category_ids: [] }));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/nodia-ai-worker.js', import.meta.url))], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DOTENV_CONFIG_PATH: process.platform === 'win32' ? 'NUL' : '/dev/null', NODE_ENV: 'test', RATE_LIMIT_STORAGE: 'memory',
      POSTGRES_HOST: options.host, POSTGRES_PORT: String(options.port), POSTGRES_DB: options.database,
      POSTGRES_USER: options.username, POSTGRES_PASSWORD: options.password, GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:1',
      GEMINI_SERVICE_TOKEN: '', REDIS_HOST: '127.0.0.1', REDIS_PORT: '1' },
  });
  children.add(child); let output = '', childExit;
  const stopped = new Promise(resolve => child.once('exit', (code, signal) => { childExit = { code, signal }; children.delete(child); resolve(); }));
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-32768); });
  try {
    const finished = await waitFor(async () => {
      if (childExit) throw Error(`Standalone worker exited ${JSON.stringify(childExit)} ${output}`);
      return status(standalone.execution_id);
    }, value => value.state === 'completed', 'standalone worker new financial port', 45000);
    check('standalone compiled worker claims a new financial operation and commits its native group plus receipt',
      (await request(`/finance/category-groups/${finished.steps[0].result_refs[0].id}`)).key === 'synthetic_ai21_standalone');
    child.kill('SIGTERM'); let drainTimer;
    try { await Promise.race([stopped, new Promise((_, reject) => { drainTimer = setTimeout(() => reject(Error('Standalone worker drain timeout')), 15000); })]); }
    finally { clearTimeout(drainTimer); }
    check('worker drains and committed non-movement receipt survives process shutdown', (childExit.code === 0 || childExit.signal === 'SIGTERM') &&
      (await status(standalone.execution_id)).state === 'completed');
  } finally { await kill(child); }
  check('all financial work avoids provider calls and runtime slots', providerCalls === 0 && await count('nodia_ai_runtime_slots') === 0);
  check('all execution attempts terminate without orphan leases', await count('nodia_ai_job_attempts', 'ended_at IS NULL') === 0 && await count('nodia_ai_jobs', "state='leased'") === 0);
  console.log(JSON.stringify({ stage: 'AI-21', scope: 'compiled_http_confirmation_worker_disposable_postgresql_all_twelve_native_financial_mutations_no_provider',
    checks: checks.length, exercised_operations: [...exercised].sort(), native_handlers: routes,
    passed: checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ stage: 'AI-21', completed_checks: checks.length, last_checks: checks.slice(-4) }));
  throw error;
} finally {
  for (const child of children) await kill(child);
  if (app) await app.close();
  await fixture.close();
}
