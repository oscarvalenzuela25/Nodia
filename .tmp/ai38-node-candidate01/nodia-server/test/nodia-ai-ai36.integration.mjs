// AI-36: compiled Nest/HTTP/SQL contracts spanning the three Nodia products.
// Disposable PostgreSQL only. Authentication transport and Redis are synthetic;
// authorization, previews, confirmation, native effects and receipts are real.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai36');
const { db, options, identities } = fixture;
const checks = [], started = Date.now();
let app, compiled, providerCalls = 0, httpRequests = 0;
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
try {
  const imports = [
    ['nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'],
    ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['finance-overview/finance-overview.module', 'FinanceOverviewModule'],
    ['nodia-ai-reports/nodia-ai-reports.module', 'NodiaAiReportsModule'],
  ];
  const modules = await Promise.all(imports.map(([file, name]) => loadAi(file, name)));
  const [Prepare, Workflow, Execute, Claim, Recover, Worker, Store, Redis, Adapter, Compose, Describe, Expire] = await Promise.all([
    ['nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'],
    ['nodia-ai-proposal/use-case/prepare-nodia-ai-workflow.use-case', 'PrepareNodiaAiWorkflowUseCase'],
    ['nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase'],
    ['nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'],
    ['nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'],
    ['nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase'],
    ['nodia-ai-execution/nodia-ai-execution.service', 'NodiaAiExecutionService'],
    ['common/redis/redis.service', 'RedisService'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['nodia-ai-reports/use-case/compose-nodia-ai-report.use-case', 'ComposeNodiaAiReportUseCase'],
    ['nodia-ai-reports/use-case/describe-nodia-ai-reports.use-case', 'DescribeNodiaAiReportsUseCase'],
    ['nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case', 'ExpireNodiaAiConversationsUseCase'],
  ].map(([file, name]) => loadAi(file, name)));
  const builder = Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), ...modules] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => { providerCalls++; throw Error('AI36 forbids provider access'); }])));
  compiled = await builder.compile();
  const prepare = compiled.get(Prepare), workflow = compiled.get(Workflow), execute = compiled.get(Execute), claim = compiled.get(Claim), recovery = compiled.get(Recover), worker = compiled.get(Worker), store = compiled.get(Store);
  const compose = compiled.get(Compose), describe = compiled.get(Describe);
  const Policy = await loadAi('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY');
  const parser = await loadAi('nodia-ai-conversation/nodia-ai-conversation-body-parser', 'createNodiaAiConversationBodyParser');
  const Filter = await loadAi('common/filters/all-exceptions.filter', 'AllExceptionsFilter');
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/nodia-ai', parser(compiled.get(Policy).admission.http_json_bytes));
  app.useGlobalFilters(new Filter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest(), identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException();
    request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId };
    return true;
  } });
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1/nodia-ai`;
  async function http(path, { method = 'GET', actor = '1', body, expected = 200 } = {}) {
    httpRequests++;
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-fixture-actor': actor }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = response.status === 204 ? null : await response.json();
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  const count = async (table, where = 'true', args = []) => (await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`, args))[0].n;
  const ledger = await db.query('SELECT name FROM migrations ORDER BY timestamp,id');
  check('clean PostgreSQL16 installation applies all 29 migrations and the measured text search index', ledger.length === 29 && ledger.at(-1).name === 'AddNodiaAiTextSearchIndex1793100000000' && (await db.query("SELECT to_regclass('public.ix_nodia_ai_message_parts_text_search')::text AS name"))[0].name !== null);
  const moduleIds = new Map();
  for (const [key, route] of [['personal_finance', '/tools/finances-personal'], ['businesses', '/tools/business'], ['rental_reservations', '/tools/reservations']]) {
    let [module] = await db.query('SELECT id::text FROM modules WHERE link=$1', [route]);
    if (!module) [module] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,$2 FROM modules WHERE key='nodia_ai' RETURNING id::text", [route, key]);
    moduleIds.set(route, module.id);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [module.id]);
  }
  const [category] = await db.query("INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic AI36 food','ai36_food') RETURNING id::text");
  const [business] = await db.query("INSERT INTO businesses(owner_id,name) VALUES(1,'Synthetic AI36 business') RETURNING id::text");
  const [house] = await db.query("INSERT INTO rental_properties(owner_id,name,timezone,max_guests,minimum_turnover_minutes,created_by,updated_by) VALUES(1,'Synthetic AI36 house','UTC',4,0,1,1) RETURNING id::text");
  const identity = identities.get('1');
  const draft = (chat, toolName, partial) => db.transaction(manager => prepare.execute(manager, identity, { conversationId: chat, toolName, partial }));
  async function chat() {
    const id = randomUUID();
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,1,$2,$3,'Synthetic AI36 integrated',clock_timestamp()+interval '90 days')", [id, randomUUID(), 'a'.repeat(64)]);
    return id;
  }
  const steps = id => db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1 ORDER BY position', [id]);
  const status = id => http(`/operations/${id}`);
  const challenge = p => http(`/proposals/${p.proposal_id}/confirmation-challenge`, { method: 'POST', body: { proposal_revision: p.revision, expected_hash: p.hash } });
  const confirmation = (p, token) => ({ client_request_id: randomUUID(), proposal_revision: p.revision, expected_hash: p.hash, confirmation_token: token });
  async function admit(p) {
    const c = await challenge(p), body = confirmation(p, c.confirmation_token);
    const first = await http(`/proposals/${p.proposal_id}/confirm`, { method: 'POST', expected: 202, body });
    const duplicate = await http(`/proposals/${p.proposal_id}/confirm`, { method: 'POST', expected: 202, body });
    assert.equal(first.execution.execution_id, duplicate.execution.execution_id);
    return first.execution;
  }
  async function next(executionId) {
    const acquired = await claim.execute(randomUUID());
    assert.equal(acquired?.executionId, executionId);
    return { acquired, result: await execute.execute(identity, executionId, acquired) };
  }
  async function finish(executionId) {
    let result = await status(executionId);
    for (let i = 0; result.state === 'queued' && i < 8; i++) result = (await next(executionId)).result;
    assert.equal(result.state, 'completed');
    return result;
  }
  async function mixed(label, amount = '20000') {
    const conversation = await chat();
    const inputs = [
      ['nodia_finance_movements_prepare_create', { name: `Synthetic AI36 ${label}`, amount, category_id: category.id, type: 'expense', status: 'paid' }],
      ['nodia_providers_prepare_create', { business_id: business.id, name: `Synthetic AI36 supplier ${label}` }],
      ['nodia_rental_expenses_prepare_create', { property_id: house.id, name: `Synthetic AI36 ${label}`, amount: '5000', incurred_on: '2026-01-01', status: 'paid', paid_on: '2026-01-01' }],
    ];
    const drafts = [];
    for (const [name, partial] of inputs) {
      const result = await draft(conversation, name, partial);
      assert.equal(result.status, 'ready', JSON.stringify(result));
      drafts.push(result);
    }
    const proposal = (await db.transaction(manager => workflow.execute(manager, identity, conversation, { catalog_version: 'nodia-ai-ai23-workflow/1', draft_ids: drafts.map(item => item.draft_id) }))).proposal;
    return { conversation, drafts, proposal };
  }
  const missingChat = await chat(), missing = await draft(missingChat, 'nodia_finance_movements_prepare_create', { name: 'Synthetic ambiguous purchase', amount: '20000' });
  check('missing native financial fields produce clarification without any domain effect', missing.status === 'needs_clarification' && !missing.proposal && await count('finance_movements') === 0);

  const baseline = await mixed('baseline');
  check('one cross-product preview gathers three native contracts without creating any business record', baseline.proposal.steps.length === 3 && await count('finance_movements') === 0 && await count('providers') === 0 && await count('rental_expenses') === 0);
  await http(`/proposals/${baseline.proposal.proposal_id}/confirmation-challenge`, { method: 'POST', body: { proposal_revision: baseline.proposal.revision, expected_hash: 'f'.repeat(64) }, expected: 409 });
  await http(`/proposals/${baseline.proposal.proposal_id}/confirmation-challenge`, { actor: '2', method: 'POST', body: { proposal_revision: baseline.proposal.revision, expected_hash: baseline.proposal.hash }, expected: [403, 404] });
  await http(`/proposals/${baseline.proposal.proposal_id}/confirmation-challenge`, { actor: '3', method: 'POST', body: { proposal_revision: baseline.proposal.revision, expected_hash: baseline.proposal.hash }, expected: [403, 404] });
  check('wrong preview hash and both unrelated and omniscient actors cannot confirm the owner intention');
  const obsolete = await challenge(baseline.proposal);
  const revised = await http(`/proposals/${baseline.proposal.proposal_id}`, { method: 'PATCH', body: { expected_proposal_revision: baseline.proposal.revision, expected_hash: baseline.proposal.hash, edits: [{ step_id: baseline.proposal.steps[0].step_id, field_key: 'amount', value: '21000' }] } });
  await http(`/proposals/${baseline.proposal.proposal_id}`, { method: 'PATCH', expected: 409, body: { expected_proposal_revision: baseline.proposal.revision, expected_hash: baseline.proposal.hash, edits: [{ step_id: baseline.proposal.steps[0].step_id, field_key: 'amount', value: '99999' }] } });
  const afterStaleEdit = await http(`/proposals/${baseline.proposal.proposal_id}`);
  check('a stale editor receives CAS conflict without silently replacing the accepted cross-product preview', afterStaleEdit.hash === revised.hash && afterStaleEdit.revision === revised.revision && await count('finance_movements') === 0);
  await http(`/proposals/${baseline.proposal.proposal_id}/confirm`, { method: 'POST', expected: 409, body: confirmation(baseline.proposal, obsolete.confirmation_token) });
  check('editing the financial amount invalidates the old exact human challenge across the full workflow', revised.hash !== baseline.proposal.hash && revised.revision === 2);
  const accepted = await admit(revised);
  check('duplicate confirmation admits exactly one durable execution and no inline domain effects', await count('nodia_ai_executions', 'origin_proposal_id=$1', [revised.proposal_id]) === 1 && await count('finance_movements') === 0);
  const first = await next(accepted.execution_id), firstRows = await steps(accepted.execution_id);
  check('first native transaction commits only the revised finance amount and its receipt', first.result.state === 'queued' && firstRows[0].minimal_receipt.resource_key === 'finance_movements' && await count('finance_movements', 'amount=21000') === 1 && await count('providers') === 0 && await count('rental_expenses') === 0);
  const completed = await finish(accepted.execution_id), completedRows = await steps(accepted.execution_id);
  check('remaining sequential native effects commit one supplier and one rental expense with separate receipts', completed.steps.every(step => step.state === 'completed') && completedRows.map(row => row.minimal_receipt.resource_key).join(',') === 'finance_movements,providers,rental_expenses' && await count('providers') === 1 && await count('rental_expenses') === 1);
  const receiptHash = JSON.stringify(completedRows.map(row => row.minimal_receipt));
  await execute.execute(identity, accepted.execution_id, first.acquired);
  await recovery.execute();
  check('stale original lease and recovery cannot repeat any completed effect or rewrite receipts', JSON.stringify((await steps(accepted.execution_id)).map(row => row.minimal_receipt)) === receiptHash && await count('finance_movements') === 1 && await count('providers') === 1 && await count('rental_expenses') === 1);

  const revoked = await mixed('revocation', '3000'), revokedExecution = await admit(revoked.proposal);
  await next(revokedExecution.execution_id);
  const preserved = (await steps(revokedExecution.execution_id))[0].minimal_receipt;
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [moduleIds.get('/tools/business')]);
  await worker.execute(randomUUID(), new AbortController().signal);
  const deniedRows = await steps(revokedExecution.execution_id);
  check('module revocation between products stops the suffix and preserves the already committed expense', deniedRows[0].state === 'completed' && JSON.stringify(deniedRows[0].minimal_receipt) === JSON.stringify(preserved) && deniedRows[1].state === 'failed' && deniedRows[2].minimal_receipt === null && await count('providers') === 1 && await count('rental_expenses') === 1);
  await http(`/proposals/${revoked.proposal.proposal_id}`, { expected: [403, 404] });
  await http(`/operations/${revokedExecution.execution_id}/resume`, { method: 'POST', expected: [403, 404], body: { client_request_id: randomUUID(), expected_execution_revision: 1 } });
  check('revoked module blocks preview and recovery over HTTP rather than exposing retained commands');
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [moduleIds.get('/tools/business')]);
  const restored = await status(revokedExecution.execution_id);
  check('restoring module assignment exposes the exact partial execution without automatic dispatch', restored.state === 'partially_completed' && await count('providers') === 1 && await count('rental_expenses') === 1);
  assert.equal(restored.can_resume, true);
  const resumeBody = { client_request_id: randomUUID(), expected_execution_revision: restored.revision };
  const resumed = await http(`/operations/${revokedExecution.execution_id}/resume`, { method: 'POST', expected: 202, body: resumeBody });
  const resumedAgain = await http(`/operations/${revokedExecution.execution_id}/resume`, { method: 'POST', expected: 202, body: resumeBody });
  assert.equal(resumed.execution.execution_id, resumedAgain.execution.execution_id);
  await finish(revokedExecution.execution_id);
  check('explicit idempotent recovery completes only the pending products and preserves the first financial receipt', JSON.stringify((await steps(revokedExecution.execution_id))[0].minimal_receipt) === JSON.stringify(preserved) && await count('finance_movements') === 2 && await count('providers') === 2 && await count('rental_expenses') === 2);

  const cancellation = await mixed('cancelled suffix', '1000'), cancelledExecution = await admit(cancellation.proposal);
  await next(cancelledExecution.execution_id);
  const beforeCancel = await status(cancelledExecution.execution_id);
  await http(`/operations/${cancelledExecution.execution_id}/cancel`, { method: 'POST', body: { client_request_id: randomUUID(), expected_execution_revision: beforeCancel.revision } });
  const cancelledRows = await steps(cancelledExecution.execution_id);
  check('human cancellation after the first effect keeps finance and cancels both other products without compensation', cancelledRows[0].state === 'completed' && cancelledRows.slice(1).every(row => row.state === 'cancelled' && row.minimal_receipt === null) && await count('finance_movements') === 3 && await count('providers') === 2 && await count('rental_expenses') === 2);

  const lost = await mixed('lost commit', '2000'), lostExecution = await admit(lost.proposal);
  const lostClaim = await claim.execute(randomUUID()), transaction = store.transaction.bind(store);
  let commitCount = 0;
  store.transaction = async work => { const result = await transaction(work); if (++commitCount === 2) throw Error('Synthetic AI36 committed acknowledgement lost'); return result; };
  try { await assert.rejects(execute.execute(identity, lostExecution.execution_id, lostClaim), error => error.getStatus?.() === 503); }
  finally { store.transaction = transaction; }
  await recovery.execute();
  const lostStatus = await status(lostExecution.execution_id), lostRows = await steps(lostExecution.execution_id);
  check('lost COMMIT response leaves a native atomic receipt and a recoverable exact suffix without another financial expense', lostRows[0].minimal_receipt !== null && await count('finance_movements') === 4 && ['queued', 'partially_completed'].includes(lostStatus.state));
  if (lostStatus.state === 'partially_completed') {
    assert.equal(lostStatus.can_resume, true);
    await http(`/operations/${lostExecution.execution_id}/resume`, { method: 'POST', expected: 202, body: { client_request_id: randomUUID(), expected_execution_revision: lostStatus.revision } });
  }
  await finish(lostExecution.execution_id);
  check('lost acknowledgement reconciliation finishes one effect per product without repeating finance', await count('finance_movements') === 4 && await count('providers') === 3 && await count('rental_expenses') === 3);

  const reportVersion = (await describe.execute(identity)).catalog_version;
  const year = new Date().getUTCFullYear();
  const sources = [
    { source_key: 'finance_movements', alias: 'personal', scope: {}, period: { kind: 'instant', dimension_key: 'created_at', from: `${year}-01-01T00:00:00Z`, to_exclusive: `${year + 1}-01-01T00:00:00Z`, timezone: 'UTC' }, measures: [{ measure_key: 'confirmed_expense_amount', aggregation: 'sum', output_key: 'amount' }, { measure_key: 'records', aggregation: 'count', output_key: 'count' }], filters: { all: [{ field_key: 'status', operator: 'eq', value: 'paid' }] } },
    { source_key: 'rental_expenses', alias: 'lodging', scope: { property_id: house.id }, period: { kind: 'civil_date', dimension_key: 'incurred_on', from: '2026-01-01', to_exclusive: '2026-02-01', timezone: 'UTC' }, measures: [{ measure_key: 'amount', aggregation: 'sum', output_key: 'amount' }, { measure_key: 'records', aggregation: 'count', output_key: 'count' }] },
  ];
  const report = await compose.execute(identity, { catalog_version: reportVersion, combine: 'separate', sources });
  const personal = report.source_results.find(row => row.source_alias === 'personal'), lodging = report.source_results.find(row => row.source_alias === 'lodging');
  check('cross-product report reads the actual committed effects including cancelled suffix finance and excludes unexecuted rental effects', personal.totals.amount === '27000' && personal.totals.count === '4' && lodging.totals.amount === '15000' && lodging.totals.count === '3');
  check('cross-product report preserves independent temporal bases and provenance without inventing a joint total or currency', report.snapshot_consistency === 'independent_source_snapshots' && report.provenance.length === 2 && personal.basis_key === 'created_at' && lodging.basis_key === 'incurred_on' && !Object.hasOwn(report, 'totals'));
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [moduleIds.get('/tools/reservations')]);
  const deniedReport = await compose.execute(identity, { catalog_version: reportVersion, combine: 'separate', sources });
  check('report module revocation never exposes the property source while preserving explicitly partial compatible sources', deniedReport.status === 'partial' && deniedReport.source_results.length === 1 && deniedReport.source_results[0].source_alias === 'personal' && deniedReport.source_errors.some(row => row.source_alias === 'lodging'));
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [moduleIds.get('/tools/reservations')]);

  // A synthetic next-release registration exercises the compiled admission rule.
  // This is not a hot reload, a deployed release or new MCP publication.
  const [Availability, Admission] = await Promise.all([
    loadAi('nodia-ai-confirmation/use-case/nodia-ai-confirmation-availability.use-case', 'NodiaAiConfirmationAvailabilityUseCase'),
    loadAi('nodia-ai-confirmation/types/execution-admission.types', 'NODIA_AI_EXECUTION_ADMISSION'),
  ]);
  const incompatible = await mixed('pending upgrade');
  const pendingSteps = await db.query('SELECT * FROM nodia_ai_proposal_steps WHERE proposal_id=$1 AND proposal_revision=$2 ORDER BY position', [incompatible.proposal.proposal_id, incompatible.proposal.revision]);
  assert.equal(compiled.get(Availability).describe(pendingSteps, incompatible.proposal.catalog_version).can_confirm, true);
  const nextRegistrations = compiled.get(Admission).map(registration => registration.toolName === 'nodia_finance_movements_prepare_create' ? { ...registration, contractHash: 'f'.repeat(64), catalogVersion: registration.catalogVersion + '/synthetic-next' } : registration);
  const nextAvailability = new Availability(nextRegistrations);
  assert.equal(nextAvailability.describe(pendingSteps, incompatible.proposal.catalog_version).can_confirm, false);
  assert.throws(() => nextAvailability.require(pendingSteps, incompatible.proposal.catalog_version), error => error.getStatus?.() === 503 && error.message === 'nodia_ai:execution_unavailable');
  check('synthetic incompatible next-release registration rejects a ready persisted preview through the real compiled admission rule', await count('finance_movements') === 4 && await count('providers') === 3 && await count('rental_expenses') === 3);
  await execute.execute(identity, accepted.execution_id, first.acquired);
  check('evaluating incompatible admission metadata does not rewrite historical receipts or replay completed native effects', JSON.stringify((await steps(accepted.execution_id)).map(row => row.minimal_receipt)) === receiptHash && await count('finance_movements') === 4 && await count('providers') === 3 && await count('rental_expenses') === 3);

  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [baseline.conversation]);
  await compiled.get(Expire).execute();
  check('chat retention removes completed multi-product commands and journals while preserving every native business record', await count('nodia_ai_conversations', 'id=$1', [baseline.conversation]) === 0 && await count('nodia_ai_executions', 'id=$1', [accepted.execution_id]) === 0 && await count('finance_movements') === 4 && await count('providers') === 3 && await count('rental_expenses') === 3);
  check('integration completes without provider inference storage access or native service restart', providerCalls === 0);
  console.log(JSON.stringify({ stage: 'AI-36', scope: 'compiled_cross_product_http_sql', status: 'passed', checks: checks.length, results: checks, elapsed_ms: Date.now() - started, migrations: ledger.length, http_requests: httpRequests, provider_calls: providerCalls, configured_database_used: false, actual_provider: false, storage_operations: 0, synthetic_authenticated_transport: true, synthetic_next_release_admission_metadata: true, hot_reload_verified: false, native_authorization_and_domain_effects: true, mcp_publication: false }, null, 2));
} finally {
  if (app) await app.close(); else if (compiled) await compiled.close();
  await fixture.close();
}


