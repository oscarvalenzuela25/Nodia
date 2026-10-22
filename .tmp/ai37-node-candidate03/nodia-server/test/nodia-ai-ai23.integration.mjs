// AI-23: compiled domain ports, human HTTP, disposable PostgreSQL and process death.
// Synthetic records only. Internal preparation does not assert MCP publication or Gemini use.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai23');
const { db, options, identities } = fixture;
const checks = [], children = new Set();
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
const version = 'nodia-ai-ai23-workflow/1';
let app, compiled, base, providerCalls = 0;
const kill = async child => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGKILL'); await ended;
};
try {
  const originalLedger = await db.query('SELECT name FROM migrations ORDER BY timestamp,id');
  const WorkflowMigration = await loadAi('migrations/1792700000000-AddNodiaAiWorkflowBindings', 'AddNodiaAiWorkflowBindings1792700000000');
  assert(originalLedger.some(row => row.name === 'AddNodiaAiWorkflowBindings1792700000000'));
  await db.transaction(manager => new WorkflowMigration().down(manager.queryRunner));
  const rolledBackColumns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='nodia_ai_execution_steps' AND column_name='bound_command') OR (table_name='nodia_ai_proposals' AND column_name='prior_execution_id'))");
  assert.equal(rolledBackColumns.length, 0);
  await db.transaction(manager => new WorkflowMigration().up(manager.queryRunner));
  const restoredColumns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='nodia_ai_execution_steps' AND column_name='bound_command') OR (table_name='nodia_ai_proposals' AND column_name='prior_execution_id'))");
  check('AI23 migration down and up restore exactly both new nullable columns on an empty workflow journal', restoredColumns.length === 2 && (await db.query('SELECT count(*)::int n FROM migrations'))[0].n === originalLedger.length);
  const [Confirmation, Execution, Conversation, Overview, Prepare, Workflow, Remaining, Execute, Claim, Recover, Run, Store, Redis, Adapter] = await Promise.all([
    loadAi('nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'),
    loadAi('nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'),
    loadAi('nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'),
    loadAi('finance-overview/finance-overview.module', 'FinanceOverviewModule'),
    loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'),
    loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-workflow.use-case', 'PrepareNodiaAiWorkflowUseCase'),
    loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-remaining-workflow.use-case', 'PrepareNodiaAiRemainingWorkflowUseCase'),
    loadAi('nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'),
    loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-execution/nodia-ai-execution.service', 'NodiaAiExecutionService'),
    loadAi('common/redis/redis.service', 'RedisService'),
    loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'),
  ]);
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Overview,
  ] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => { providerCalls++; throw Error('Forbidden AI23 provider'); }])));
  compiled = await builder.compile();
  const prepare = compiled.get(Prepare), workflow = compiled.get(Workflow), remaining = compiled.get(Remaining);
  const execute = compiled.get(Execute), claimer = compiled.get(Claim), recovery = compiled.get(Recover), worker = compiled.get(Run), store = compiled.get(Store);
  const Policy = await loadAi('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY');
  const parser = await loadAi('nodia-ai-conversation/nodia-ai-conversation-body-parser', 'createNodiaAiConversationBodyParser');
  const Filter = await loadAi('common/filters/all-exceptions.filter', 'AllExceptionsFilter');
  app = compiled.createNestApplication({ logger: false }); app.setGlobalPrefix('api/v1');
  app.use('/api/v1/nodia-ai', parser(compiled.get(Policy).admission.http_json_bytes));
  app.useGlobalFilters(new Filter()); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest(), identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException(); request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId }; return true;
  } });
  await app.listen(0, '127.0.0.1'); base = `${await app.getUrl()}/api/v1`;
  async function http(path, { actor = '1', method = 'GET', body } = {}) {
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-fixture-actor': actor }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, value: response.status === 204 ? null : await response.json() };
  }
  async function request(path, input = {}) {
    const result = await http(path, input); assert.equal(result.status, input.status ?? 200, `${input.method ?? 'GET'} ${path}: ${result.status} ${JSON.stringify(result.value)}`); return result.value;
  }
  for (const [route, key] of [['/tools/business', 'synthetic_ai23_business'], ['/tools/finances-personal', 'synthetic_ai23_finance']]) {
    let [module] = await db.query('SELECT id FROM modules WHERE link=$1', [route]);
    if (!module) [module] = await db.query('INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,$2 FROM modules WHERE key=\'nodia_ai\' RETURNING id', [route, key]);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [module.id]);
  }
  const business = randomUUID(); await db.query("INSERT INTO businesses(id,owner_id,name) VALUES($1,1,'Synthetic AI23 business')", [business]);
  async function chat(actor = '1') {
    const id = randomUUID(); await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI23 only',clock_timestamp()+interval '90 days')", [id, identities.get(actor).userId, randomUUID(), 'a'.repeat(64)]); return id;
  }
  const draft = (conversationId, toolName, partial, actor = '1') => db.transaction(manager => prepare.execute(manager, identities.get(actor), { conversationId, toolName, partial }));
  const join = (conversationId, input, actor = '1') => db.transaction(manager => workflow.execute(manager, identities.get(actor), conversationId, input));
  const status = id => request(`/nodia-ai/operations/${id}`);
  const count = async (table, where = 'true', values = []) => (await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`, values))[0].n;
  const rows = id => db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1 ORDER BY position', [id]);
  const challenge = p => request(`/nodia-ai/proposals/${p.proposal_id}/confirmation-challenge`, { method: 'POST', body: { proposal_revision: p.revision, expected_hash: p.hash } });
  const confirmation = (p, token) => ({ client_request_id: randomUUID(), proposal_revision: p.revision, expected_hash: p.hash, confirmation_token: token });
  async function admit(p) { const c = await challenge(p); return (await request(`/nodia-ai/proposals/${p.proposal_id}/confirm`, { method: 'POST', status: 202, body: confirmation(p, c.confirmation_token) })).execution; }
  async function one(id) { const claim = await claimer.execute(randomUUID()); assert.equal(claim.executionId, id); return { claim, value: await execute.execute(identities.get('1'), id, claim) }; }
  async function finish(id, maximum = 8) { let value = await status(id); for (let i = 0; value.state === 'queued' && i < maximum; i++) value = (await one(id)).value; return value; }
  async function pair(label, conversationId = null) {
    const conversation = conversationId ?? await chat();
    const supplier = await draft(conversation, 'nodia_providers_prepare_create', { business_id: business, name: `Synthetic AI23 ${label}` });
    const contact = await draft(conversation, 'nodia_provider_contacts_prepare_create', { business_id: business, name: `Synthetic AI23 contact ${label}` });
    assert.equal(supplier.status, 'ready'); assert.equal(contact.status, 'needs_clarification');
    const input = { catalog_version: version, draft_ids: [supplier.draft_id, contact.draft_id], bindings: [{ draft_id: contact.draft_id, target_field_key: 'provider_id', from_draft_id: supplier.draft_id, output_key: 'id' }] };
    return { conversation, supplier, contact, input, proposal: async () => (await join(conversation, input)).proposal };
  }
  const rejection = work => assert.rejects(work, error => [400, 403, 404, 409, 410].includes(error.getStatus?.()));

  const baseline = await pair('baseline'), individualChallenge = await challenge(baseline.supplier.proposal), combined = await baseline.proposal();
  assert.equal(combined.catalog_version, version); assert.equal(combined.steps.length, 2);
  assert.deepEqual(combined.steps[1].depends_on, [combined.steps[0].step_id]);
  assert.deepEqual(combined.steps[1].output_bindings, [{ target_field_key: 'provider_id', from_step_id: combined.steps[0].step_id, output_key: 'id' }]);
  const future = combined.steps[1].changes.find(change => change.field_key === 'provider_id');
  check('future supplier preview has a registered preceding ID binding without a fabricated ID', future.origin === 'future_step' && future.after === null && future.after_present === false);
  const old = await request(`/nodia-ai/proposals/${baseline.supplier.proposal.proposal_id}`);
  check('workflow supersedes its individual proposal atomically', old.state === 'superseded');
  await request(`/nodia-ai/proposals/${old.proposal_id}/confirm`, { method: 'POST', status: 409, body: confirmation(old, individualChallenge.confirmation_token) });
  await rejection(join(baseline.conversation, baseline.input));
  check('claimed drafts and an old human challenge cannot admit the individual intention again');
  const exec = await admit(combined); assert.equal(exec.steps[0].state, 'ready'); assert.equal(exec.steps[1].state, 'blocked');
  const first = await one(exec.execution_id), firstRows = await rows(exec.execution_id), supplierId = firstRows[0].minimal_receipt.resource_id;
  check('first local commit preserves supplier receipt and leaves only the contact queued', first.value.state === 'queued' && firstRows[0].state === 'completed' && firstRows[1].state === 'ready' && await count('personal_info_provider', 'provider_id=$1', [supplierId]) === 0);
  const completed = await one(exec.execution_id), completedRows = await rows(exec.execution_id);
  const bound = completedRows[1].bound_command;
  assert.deepEqual(Object.keys(bound).sort(), ['command_template', 'preconditions', 'scope']);
  check('typed first-bind commits actual supplier identity before its native contact effect', completed.value.state === 'completed' && bound.command_template.provider_id === supplierId && await count('personal_info_provider', 'provider_id=$1', [supplierId]) === 1);
  await assert.rejects(db.query("UPDATE nodia_ai_execution_steps SET bound_command=jsonb_set(bound_command,'{scope,provider_id}','\"999\"') WHERE id=$1", [completedRows[1].id]));
  check('PostgreSQL rejects rewriting a committed first-bind payload');
  await assert.rejects(db.query("UPDATE nodia_ai_execution_steps SET bound_command_hash=repeat('f',64) WHERE id=$1", [completedRows[1].id]));
  check('PostgreSQL rejects rewriting the hash of an existing first-bind witness');
  await assert.rejects(db.transaction(manager => new WorkflowMigration().down(manager.queryRunner)), /workflow_binding_rollback_requires_empty_payloads/u);
  check('schema rollback refuses to discard live first-bind payloads');

  const editedPair = await pair('human review'), originalReview = await editedPair.proposal();
  const edited = await request(`/nodia-ai/proposals/${originalReview.proposal_id}`, { method: 'PATCH', body: { expected_proposal_revision: originalReview.revision, expected_hash: originalReview.hash, edits: [{ step_id: originalReview.steps[0].step_id, field_key: 'name', value: 'Synthetic AI23 reviewed supplier' }] } });
  check('human material review remaps all dependency step identities under a new exact hash', edited.hash !== originalReview.hash && edited.revision === 2 && edited.steps[0].step_id !== originalReview.steps[0].step_id && edited.steps[1].output_bindings[0].from_step_id === edited.steps[0].step_id);
  assert.equal((await finish((await admit(edited)).execution_id)).state, 'completed');
  check('reviewed dependent workflow executes the updated source and one contact');

  for (let size = 2; size <= 8; size++) {
    const conversation = await chat(), drafts = [];
    for (let index = 0; index < size; index++) drafts.push(await draft(conversation, 'nodia_providers_prepare_create', { business_id: business, name: `Synthetic AI23 independent ${size}/${index}` }));
    const p = (await join(conversation, { catalog_version: version, draft_ids: drafts.map(item => item.draft_id) })).proposal;
    const admitted = await admit(p), final = await finish(admitted.execution_id);
    check(`stable sequential execution of ${size} independent native operations`, final.state === 'completed' && final.steps.length === size && final.steps.every(step => step.state === 'completed'));
  }
  const invalid = await pair('invalid'), foreign = await pair('cross chat'), binding = invalid.input.bindings[0];
  for (const [name, input] of [
    ['duplicate drafts', { ...invalid.input, draft_ids: [invalid.supplier.draft_id, invalid.supplier.draft_id] }],
    ['self reference', { ...invalid.input, bindings: [{ ...binding, from_draft_id: invalid.contact.draft_id }] }],
    ['future reference', { ...invalid.input, draft_ids: [...invalid.input.draft_ids].reverse() }],
    ['cross chat reference', { ...invalid.input, bindings: [{ ...binding, from_draft_id: foreign.supplier.draft_id }] }],
    ['cross chat draft', { ...invalid.input, draft_ids: [foreign.supplier.draft_id, invalid.contact.draft_id] }],
    ['unregistered output', { ...invalid.input, bindings: [{ ...binding, output_key: 'sql.result.id' }] }],
    ['unregistered target', { ...invalid.input, bindings: [{ ...binding, target_field_key: 'business_id' }] }],
    ['duplicate binding target', { ...invalid.input, bindings: [binding, binding] }],
    ['unregistered coordinator catalog', { ...invalid.input, catalog_version: 'synthetic-unregistered' }],
  ]) { await rejection(join(invalid.conversation, input)); check(`rejects ${name} before claiming any draft`); }
  assert.deepEqual((await db.query('SELECT state FROM nodia_ai_drafts WHERE id=ANY($1::uuid[]) ORDER BY state', [invalid.input.draft_ids])).map(row => row.state), ['incomplete', 'ready']);
  check('invalid dependency attempts leave both original drafts unchanged');

  const raced = await pair('admission race'), racedChallenge = await challenge(raced.supplier.proposal);
  const race = await Promise.allSettled([join(raced.conversation, raced.input), http(`/nodia-ai/proposals/${raced.supplier.proposal.proposal_id}/confirm`, { method: 'POST', body: confirmation(raced.supplier.proposal, racedChallenge.confirmation_token) })]);
  const workflowWon = race[0].status === 'fulfilled', admittedIndividual = race[1].status === 'fulfilled' && race[1].value.status === 202;
  assert.notEqual(workflowWon, admittedIndividual);
  if (workflowWon) assert.equal(race[1].value.status, 409);
  else assert.equal(race[0].reason.getStatus(), 409);
  const raceExecution = workflowWon ? await admit(race[0].value.proposal) : race[1].value.value.execution;
  assert.equal((await finish(raceExecution.execution_id)).state, 'completed');
  check('concurrent individual confirmation and workflow claim have one winner and one supplier', await count('providers', 'name=$1', ['synthetic ai23 admission race']) === 1);

  async function failedPair(label) {
    const values = await pair(label), proposal = await values.proposal(), admitted = await admit(proposal);
    await one(admitted.execution_id);
    const claim = await claimer.execute(randomUUID()); assert.equal(claim.executionId, admitted.execution_id);
    await db.query("CREATE FUNCTION synthetic_ai23_contact_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_ai23_contact_failure' USING ERRCODE='P0001'; END $$; CREATE TRIGGER synthetic_ai23_contact_failure BEFORE INSERT ON personal_info_provider FOR EACH ROW EXECUTE FUNCTION synthetic_ai23_contact_failure()");
    try { await assert.rejects(execute.execute(identities.get('1'), admitted.execution_id, claim)); }
    finally { await db.query('DROP TRIGGER synthetic_ai23_contact_failure ON personal_info_provider; DROP FUNCTION synthetic_ai23_contact_failure()'); }
    await recovery.execute(claim, 'nodia_ai:execution_conflict');
    return { ...values, proposal, admitted, claim, status: await status(admitted.execution_id), rows: await rows(admitted.execution_id) };
  }
  const failure = await failedPair('rollback resume'), committedId = failure.rows[0].minimal_receipt.resource_id, firstKey = failure.rows[1].bound_command.command_template.command.request_key;
  check('SQL contact insert failure keeps the supplier committed and exposes resumable partial state', failure.status.state === 'partially_completed' && failure.status.can_resume && failure.rows[0].state === 'completed' && await count('personal_info_provider', 'provider_id=$1', [committedId]) === 0);
  const resumeBody = { client_request_id: randomUUID(), expected_execution_revision: failure.status.revision };
  await request(`/nodia-ai/operations/${failure.admitted.execution_id}/resume`, { method: 'POST', status: 202, body: resumeBody });
  await request(`/nodia-ai/operations/${failure.admitted.execution_id}/resume`, { method: 'POST', status: 202, body: resumeBody });
  assert.equal((await finish(failure.admitted.execution_id)).state, 'completed');
  const resumedRows = await rows(failure.admitted.execution_id);
  check('duplicate resume keeps native request key supplier ID and immutable first-bind while committing one contact', resumedRows[0].minimal_receipt.resource_id === committedId && resumedRows[1].bound_command.command_template.command.request_key === firstKey && resumedRows[1].bound_command_hash === failure.rows[1].bound_command_hash && await count('personal_info_provider', 'provider_id=$1', [committedId]) === 1 && await count('providers', 'name=$1', ['synthetic ai23 rollback resume']) === 1);

  const corrected = await failedPair('material correction'), correctedProposalResult = await db.transaction(manager => remaining.execute(manager, identities.get('1'), { execution_id: corrected.admitted.execution_id, expected_execution_revision: corrected.status.revision, edits: [{ step_id: corrected.rows[1].source_step_id, field_key: 'name', value: 'Synthetic corrected contact' }] }));
  const correctedProposal = correctedProposalResult.proposal;
  assert.equal(correctedProposalResult.status, 'ready');
  const [continuation] = await db.query('SELECT prior_execution_id FROM nodia_ai_proposals WHERE id=$1', [correctedProposal.proposal_id]);
  check('material pending correction creates a new proposal and exact hash linked to previous execution', correctedProposal.proposal_id !== corrected.proposal.proposal_id && correctedProposal.hash !== corrected.proposal.hash && continuation.prior_execution_id === corrected.admitted.execution_id);
  const oldCorrectedStatus = await status(corrected.admitted.execution_id);
  await request(`/nodia-ai/operations/${corrected.admitted.execution_id}/resume`, { method: 'POST', status: 409, body: { client_request_id: randomUUID(), expected_execution_revision: oldCorrectedStatus.revision } });
  const correctedExecution = await admit(correctedProposal); assert.equal((await finish(correctedExecution.execution_id)).state, 'completed');
  const [lineage] = await db.query('SELECT prior_execution_id FROM nodia_ai_executions WHERE id=$1', [correctedExecution.execution_id]);
  await assert.rejects(db.query('UPDATE nodia_ai_proposals SET prior_execution_id=NULL WHERE id=$1', [correctedProposal.proposal_id]));
  await assert.rejects(db.query('UPDATE nodia_ai_executions SET prior_execution_id=NULL WHERE id=$1', [correctedExecution.execution_id]));
  check('continuation execution retains the same immutable prior execution lineage as its confirmed proposal', lineage.prior_execution_id === corrected.admitted.execution_id);
  check('new human confirmation executes only corrected pending contact and leaves old supplier unchanged', await count('providers', 'name=$1', ['synthetic ai23 material correction']) === 1 && await count('personal_info_provider', 'provider_id=$1 AND name=$2', [corrected.rows[0].minimal_receipt.resource_id, 'Synthetic corrected contact']) === 1);

  const cancelled = await pair('cancel after commit'), cancelExecution = await admit(await cancelled.proposal());
  await one(cancelExecution.execution_id); const beforeCancel = await status(cancelExecution.execution_id);
  const cancelResult = await request(`/nodia-ai/operations/${cancelExecution.execution_id}/cancel`, { method: 'POST', body: { client_request_id: randomUUID(), expected_execution_revision: beforeCancel.revision } });
  const cancelledRows = await rows(cancelExecution.execution_id);
  check('cancellation between commits keeps supplier receipt and prevents all remaining effects', cancelResult.execution.state === 'partially_completed' && !cancelResult.execution.can_resume && cancelledRows[0].state === 'completed' && cancelledRows[1].state === 'cancelled' && await count('personal_info_provider', 'provider_id=$1', [cancelledRows[0].minimal_receipt.resource_id]) === 0);

  const changed = await pair('parent change'), changedExecution = await admit(await changed.proposal());
  await one(changedExecution.execution_id); const changedRows = await rows(changedExecution.execution_id);
  await db.query('UPDATE providers SET name=$2 WHERE id=$1', [changedRows[0].minimal_receipt.resource_id, 'synthetic changed after source commit']);
  await worker.execute(randomUUID(), new AbortController().signal);
  const changedStatus = await status(changedExecution.execution_id);
  check('material supplier change before first-bind rejects pending contact without guessing or replay', changedStatus.state === 'partially_completed' && !changedStatus.can_resume && await count('personal_info_provider', 'provider_id=$1', [changedRows[0].minimal_receipt.resource_id]) === 0);
  const cancelChanged = await request(`/nodia-ai/operations/${changedExecution.execution_id}/cancel`, { method: 'POST', body: { client_request_id: randomUUID(), expected_execution_revision: changedStatus.revision } });
  const cancelledChangedRows = await rows(changedExecution.execution_id);
  check('non-resumable material failure can cancel its pending suffix while preserving the committed supplier receipt', cancelChanged.status === 'accepted' && cancelChanged.execution.state === 'partially_completed' && !cancelChanged.execution.can_resume && cancelledChangedRows[1].state === 'cancelled' && cancelledChangedRows[0].state === 'completed' && JSON.stringify(cancelledChangedRows[0].minimal_receipt) === JSON.stringify(changedRows[0].minimal_receipt) && await count('personal_info_provider', 'provider_id=$1', [changedRows[0].minimal_receipt.resource_id]) === 0);

  const changedCorrection = await pair('parent change correction'), changedCorrectionExecution = await admit(await changedCorrection.proposal());
  await one(changedCorrectionExecution.execution_id); const changedCorrectionRows = await rows(changedCorrectionExecution.execution_id), changedCorrectionProviderId = changedCorrectionRows[0].minimal_receipt.resource_id;
  await db.query('UPDATE providers SET name=$2 WHERE id=$1', [changedCorrectionProviderId, 'synthetic current supplier snapshot']);
  await worker.execute(randomUUID(), new AbortController().signal);
  const changedCorrectionStatus = await status(changedCorrectionExecution.execution_id), providersBeforeCorrection = await count('providers', 'TRUE', []);
  assert.equal(changedCorrectionStatus.can_resume, false);
  const refreshedRemaining = await db.transaction(manager => remaining.execute(manager, identities.get('1'), { execution_id: changedCorrectionExecution.execution_id, expected_execution_revision: changedCorrectionStatus.revision, edits: [{ step_id: changedCorrectionRows[1].source_step_id, field_key: 'name', value: 'Synthetic contact approved after supplier change' }] }));
  assert.equal(refreshedRemaining.status, 'ready');
  const refreshedExecution = await admit(refreshedRemaining.proposal);
  const refreshedStatus = await finish(refreshedExecution.execution_id);
  const [refreshedSource] = await db.query('SELECT command_template,preconditions FROM nodia_ai_proposal_steps WHERE proposal_id=$1 ORDER BY position', [refreshedRemaining.proposal.proposal_id]);
  check('new material confirmation after supplier change refreshes its snapshot and creates only the remaining contact against the verified supplier ID', refreshedStatus.state === 'completed' && refreshedStatus.steps.length === 1 && refreshedSource.command_template.provider_id === changedCorrectionProviderId && refreshedSource.preconditions.provider.name === 'synthetic current supplier snapshot' && await count('providers', 'TRUE', []) === providersBeforeCorrection && await count('personal_info_provider', 'provider_id=$1 AND name=$2', [changedCorrectionProviderId, 'Synthetic contact approved after supplier change']) === 1);

  const mixedChat = await chat(), financial = await draft(mixedChat, 'nodia_finance_categories_prepare_create', { owner_id: '1', name: 'Synthetic AI23 mixed category', key: 'synthetic_ai23_mixed_category' }), commercial = await draft(mixedChat, 'nodia_providers_prepare_create', { business_id: business, name: 'Synthetic AI23 mixed supplier' });
  const mixed = (await join(mixedChat, { catalog_version: version, draft_ids: [financial.draft_id, commercial.draft_id] })).proposal;
  const mixedStatus = await finish((await admit(mixed)).execution_id);
  check('one coordinator release preserves native financial and business contract hashes and receipts', mixedStatus.state === 'completed' && mixedStatus.steps[0].result_refs[0].resource_key === 'finance_categories' && mixedStatus.steps[1].result_refs[0].resource_key === 'providers');

  const waitFor = async (read, predicate, description, timeout = 20000) => {
    const end = Date.now() + timeout; while (Date.now() < end) { const value = await read(); if (predicate(value)) return value; await delay(30); } throw Error('Timed out: ' + description);
  };
  async function childWorker() {
    const child = fork(fileURLToPath(new URL('./nodia-ai-ai23-worker.fixture.mjs', import.meta.url)), [], { cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, silent: true, env: { ...process.env, DOTENV_CONFIG_PATH: process.platform === 'win32' ? 'NUL' : '/dev/null', NODIA_AI23_FIXTURE_DB: JSON.stringify(options) } });
    children.add(child); const messages = []; let output = '', exited;
    child.on('message', message => messages.push(message)); child.on('exit', (code, signal) => { exited = { code, signal }; children.delete(child); }); child.on('error', error => { exited = { message: error.message }; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-32768); });
    const next = type => waitFor(async () => { const index = messages.findIndex(value => value.type === type || value.type === 'error'); if (index >= 0) { const [message] = messages.splice(index, 1); if (message.type === 'error') throw Error(JSON.stringify(message)); return message; } if (exited) throw Error(`Child exited ${JSON.stringify(exited)} ${output}`); return null; }, Boolean, 'child ' + type);
    await next('ready'); return { child, next };
  }
  const crashedPair = await pair('process crash'), crashedExecution = await admit(await crashedPair.proposal()), firstProcess = await childWorker();
  firstProcess.child.send({ type: 'claim', workerId: randomUUID() }); assert.equal((await firstProcess.next('claimed')).claim.executionId, crashedExecution.execution_id);
  firstProcess.child.send({ type: 'execute', pauseAfterTransaction: 2 }); await firstProcess.next('transaction_committed'); await kill(firstProcess.child);
  const afterFirstDeath = await rows(crashedExecution.execution_id);
  check('real worker death after first commit keeps supplier and queues only second step', afterFirstDeath[0].state === 'completed' && afterFirstDeath[1].state === 'ready');
  const bindingProcess = await childWorker(); bindingProcess.child.send({ type: 'claim', workerId: randomUUID() }); await bindingProcess.next('claimed');
  bindingProcess.child.send({ type: 'execute', pauseAfterTransaction: 1 }); await bindingProcess.next('transaction_committed');
  const beforeBindingDeath = await rows(crashedExecution.execution_id); assert.ok(beforeBindingDeath[1].bound_command); assert.equal(beforeBindingDeath[1].minimal_receipt, null);
  await kill(bindingProcess.child); await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1", [crashedExecution.execution_id]); await recovery.execute();
  const afterBindingDeath = await status(crashedExecution.execution_id);
  check('death after durable first-bind and before native contact effect permits exact explicit recovery', afterBindingDeath.state === 'partially_completed' && afterBindingDeath.can_resume && await count('personal_info_provider', 'provider_id=$1', [afterFirstDeath[0].minimal_receipt.resource_id]) === 0);
  await request(`/nodia-ai/operations/${crashedExecution.execution_id}/resume`, { method: 'POST', status: 202, body: { client_request_id: randomUUID(), expected_execution_revision: afterBindingDeath.revision } });
  assert.equal((await finish(crashedExecution.execution_id)).state, 'completed');
  const afterProcessResume = await rows(crashedExecution.execution_id);
  check('process recovery reuses first-bind payload hash and native intent key without another supplier', afterProcessResume[1].bound_command_hash === beforeBindingDeath[1].bound_command_hash && await count('providers', 'name=$1', ['synthetic ai23 process crash']) === 1 && await count('personal_info_provider', 'provider_id=$1', [afterFirstDeath[0].minimal_receipt.resource_id]) === 1);

  const lostPair = await pair('lost commit'), lostExecution = await admit(await lostPair.proposal()); await one(lostExecution.execution_id);
  const lostClaim = await claimer.execute(randomUUID()), transaction = store.transaction.bind(store); let commits = 0;
  store.transaction = async callback => { const result = await transaction(callback); if (++commits === 2) throw Error('synthetic_ai23_post_commit_response_lost'); return result; };
  try { await assert.rejects(execute.execute(identities.get('1'), lostExecution.execution_id, lostClaim), error => error.getStatus?.() === 503); } finally { store.transaction = transaction; }
  await recovery.execute(); const lostStatus = await status(lostExecution.execution_id), lostRows = await rows(lostExecution.execution_id);
  check('lost second-effect commit acknowledgement recovers both receipts without replay', lostStatus.state === 'completed' && await count('personal_info_provider', 'provider_id=$1', [lostRows[0].minimal_receipt.resource_id]) === 1 && await count('providers', 'name=$1', ['synthetic ai23 lost commit']) === 1);
  const Expire = await loadAi('nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case', 'ExpireNodiaAiConversationsUseCase');
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [corrected.conversation]);
  await compiled.get(Expire).execute();
  check('chat expiry purges completed original and continuation journals while keeping their native supplier and corrected contact', await count('nodia_ai_conversations', 'id=$1', [corrected.conversation]) === 0 && await count('nodia_ai_executions', 'id=ANY($1::uuid[])', [[corrected.admitted.execution_id, correctedExecution.execution_id]]) === 0 && await count('personal_info_provider', 'provider_id=$1', [corrected.rows[0].minimal_receipt.resource_id]) === 1);
  const expiringPair = await pair('expire durable bind'), expiringExecution = await admit(await expiringPair.proposal());
  await one(expiringExecution.execution_id);
  const expiringProcess = await childWorker(); expiringProcess.child.send({ type: 'claim', workerId: randomUUID() }); await expiringProcess.next('claimed');
  expiringProcess.child.send({ type: 'execute', pauseAfterTransaction: 1 }); await expiringProcess.next('transaction_committed');
  const expiringRows = await rows(expiringExecution.execution_id); assert.ok(expiringRows[1].bound_command); assert.equal(expiringRows[1].minimal_receipt, null);
  await kill(expiringProcess.child);
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [expiringPair.conversation]);
  await compiled.get(Expire).execute();
  const expiredRows = await rows(expiringExecution.execution_id);
  check('expiry clears content-bearing first-bind payloads even for a running step before its native effect', await count('nodia_ai_conversations', 'id=$1', [expiringPair.conversation]) === 0 && expiredRows.length === 2 && expiredRows.every(row => row.source_step_id === null && row.bound_command === null) && await count('personal_info_provider', 'provider_id=$1', [expiringRows[0].minimal_receipt.resource_id]) === 0);
  await recovery.execute();
  check('expired first-bound execution is reconciled and erased without replaying supplier or contact', await count('nodia_ai_executions', 'id=$1', [expiringExecution.execution_id]) === 0 && await count('providers', 'name=$1', ['synthetic ai23 expire durable bind']) === 1 && await count('personal_info_provider', 'provider_id=$1', [expiringRows[0].minimal_receipt.resource_id]) === 0);
  check('all workflow verification avoided provider inference', providerCalls === 0);
  console.log(JSON.stringify({ stage: 'AI-23', status: 'passed', checks: checks.length, results: checks, provider_calls: providerCalls, disposable_postgresql: true, human_confirmation_http_contract: true, synthetic_authenticated_fixture: true, actual_provider: false, mcp_publication: false }, null, 2));
} finally {
  for (const child of children) await kill(child);
  if (app) await app.close(); else if (compiled) await compiled.close();
  await fixture.close();
}
