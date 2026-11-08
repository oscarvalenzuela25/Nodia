// Real compiled preference/confirmation/effect contracts; disposable PostgreSQL only.
// No configured database, model, R2, Redis or remote product operation is used.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai33');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); };
let compiled, app, base, providerCalls = 0, allowRuntimeObservation = false, syntheticObservations = 0;
const resourceKey = 'gemini-profile:' + 'f'.repeat(64);
try {
  const [Confirmation, Execution, Conversation, Preferences, Overview, Prepare, Execute, Claim, Recover, Run, Get, Redis, Adapter, Processing, RuntimeModule, Stage, CreateConversation, AdmitMessage, Checkpoint] = await Promise.all([
    loadAi('nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'),
    loadAi('nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'),
    loadAi('nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'),
    loadAi('nodia-ai-preference/nodia-ai-preference.module', 'NodiaAiPreferenceModule'),
    loadAi('finance-overview/finance-overview.module', 'FinanceOverviewModule'),
    loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'),
    loadAi('nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase'),
    loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase'),
    loadAi('nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case', 'GetNodiaAiExecutionUseCase'),
    loadAi('common/redis/redis.service', 'RedisService'),
    loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'),
    loadAi('nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'),
    loadAi('nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'),
    loadAi('nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'),
    loadAi('nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'),
    loadAi('nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'),
    loadAi('nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case', 'CheckpointNodiaAiJobUseCase'),
  ]);
  const forbiddenGeneration = async () => { providerCalls++; throw Error('AI33 forbids model calls'); };
  compiled = await Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
    Confirmation, Execution, Conversation, Preferences, Overview, Processing, RuntimeModule,
  ], providers: [Stage] }).overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] })
    .overrideProvider(Adapter).useValue({ measureContext: measureSyntheticNodiaAiContext, execute: forbiddenGeneration, async verifyConfiguration() { assert.ok(allowRuntimeObservation); }, async observe() {
      assert.ok(allowRuntimeObservation); syntheticObservations++;
      return { available: true, observedAt: new Date(), source: 'synthetic_fixture_only', resourceKey,
        configurationGeneration: 'c'.repeat(64), sessionGeneration: 'd'.repeat(32), adapterContractVersion: 'nodia-ai-gemini-chat/1', supportsMcp: false, reason: null };
    } })
    .compile();
  const prepare = compiled.get(Prepare), effect = compiled.get(Execute), claim = compiled.get(Claim), recover = compiled.get(Recover), worker = compiled.get(Run), get = compiled.get(Get);
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
    request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId }; return true;
  } });
  await app.listen(0, '127.0.0.1'); base = `${await app.getUrl()}/api/v1`;
  const count = async (table, where = 'true', values = []) => (await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`, values))[0].n;
  const row = async id => (await db.query('SELECT * FROM nodia_ai_preferences WHERE id=$1', [id]))[0];
  const request = async (path, { actor = '1', method = 'GET', body, status = 200 } = {}) => {
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-fixture-actor': actor }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = response.status === 204 ? null : await response.json();
    assert.ok((Array.isArray(status) ? status : [status]).includes(response.status), `${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  };
  const chat = async (actor = '1') => {
    const id = randomUUID();
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '90 days')", [id, actor, randomUUID(), 'a'.repeat(64)]);
    return id;
  };
  const proposal = async (operation, partial, actor = '1', conversationId) => {
    const conversation = conversationId ?? await chat(actor);
    const command = operation === 'create' && partial.scope === undefined ? { ...partial, scope: {} } : partial;
    const result = await db.transaction(manager => prepare.execute(manager, identities.get(actor), { conversationId: conversation, toolName: `nodia_preferences_prepare_${operation}`, partial: command }));
    assert.equal(result.status, 'ready', JSON.stringify(result));
    return { ...result.proposal, conversation };
  };
  const admission = async (p, actor = '1', clientRequestId = randomUUID()) => {
    const challenge = await request(`/nodia-ai/proposals/${p.proposal_id}/confirmation-challenge`, { actor, method: 'POST', body: { proposal_revision: p.revision, expected_hash: p.hash } });
    const body = { client_request_id: clientRequestId, proposal_revision: p.revision, expected_hash: p.hash, confirmation_token: challenge.confirmation_token };
    const response = await request(`/nodia-ai/proposals/${p.proposal_id}/confirm`, { actor, method: 'POST', body, status: 202 });
    return { execution: response.execution, body };
  };
  const execute = async (admitted, actor = '1') => {
    const acquired = await claim.execute(randomUUID()); assert.equal(acquired.executionId, admitted.execution.execution_id);
    const result = await effect.execute(identities.get(actor), acquired.executionId, acquired); assert.equal(result.state, 'completed');
    const [step] = await db.query('SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1', [acquired.executionId]);
    return { result, step, claim: acquired, id: step.minimal_receipt.resource_id };
  };
  const perform = async (operation, partial, actor = '1', conversationId) => {
    const p = await proposal(operation, partial, actor, conversationId), admitted = await admission(p, actor);
    return { ...await execute(admitted, actor), proposal: p, admitted };
  };
  const rejectPreparation = (operation, partial, actor = '1') => assert.rejects(() => proposal(operation, partial, actor), error => [400,403,404,409].includes(error.getStatus?.()));
  const modules = new Map();
  for (const [key, route] of [['finance','/finances-personal'],['business','/business'],['rental','/reservations']]) {
    let [module] = await db.query('SELECT id::text FROM modules WHERE link=$1', [route]);
    if (!module) [module] = await db.query('INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,$2 FROM modules WHERE key=$3 RETURNING id::text', [route, `synthetic_ai33_${key}`, 'nodia_ai']);
    modules.set(key, module.id);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [module.id]);
  }
  const categories = [];
  for (const [user, suffix] of [['1','first'],['1','second'],['2','foreign']]) {
    const [category] = await db.query('INSERT INTO finance_categories(user_id,name,key) VALUES($1,$2,$3) RETURNING id::text', [user, `Synthetic ${suffix}`, `synthetic_ai33_${suffix}`]); categories.push(category.id);
  }
  const business = randomUUID(), foreignBusiness = randomUUID();
  for (const [id, owner] of [[business,'1'],[foreignBusiness,'2']]) await db.query("INSERT INTO businesses(id,owner_id,name) VALUES($1,$2,'Synthetic AI33 business')", [id, owner]);
  const [supplier] = await db.query("INSERT INTO providers(business_id,name,fields) VALUES($1,'Synthetic supplier',$2) RETURNING id::text", [business, { secret: 'synthetic_ai33_never_visible' }]);
  const [foreignSupplier] = await db.query("INSERT INTO providers(business_id,name) VALUES($1,'Foreign synthetic supplier') RETURNING id::text", [foreignBusiness]);
  const properties = [];
  for (const owner of ['1','2']) {
    const [property] = await db.query("INSERT INTO rental_properties(owner_id,name,timezone,max_guests,created_by,updated_by) VALUES($1,'Synthetic AI33 house','UTC',2,$1,$1) RETURNING id::text", [owner]); properties.push(property.id);
  }
  // Assertions below intentionally operate through preparation/confirmation/effect,
  // rather than directly inserting accepted preferences or mocking authorization.
  const initial = await request('/nodia-ai/preferences');
  check('own preference list starts empty', initial.items.length === 0);
  const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='nodia_ai_preferences'");
  check('preference table follows the12-column ERD', columns.length === 12);
  const originIndexes = await db.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='nodia_ai_preferences' AND (indexdef LIKE '%(source_conversation_id)%' OR indexdef LIKE '%(accepted_step_id)%')");
  check('both nullable consent origins have cleanup indexes', originIndexes.length === 2 && originIndexes.every(item => /WHERE .*IS NOT NULL/i.test(item.indexdef)));

  const firstChat = await chat();
  const firstPreparation = await request('/nodia-ai/preferences/prepare', { method: 'POST', status: [200,201], body: { conversation_id: firstChat, operation: 'create', scope_key: 'finance', scope: {}, key: 'expense_category_id', value: categories[0] } });
  assert.equal(firstPreparation.status, 'ready');
  const firstProposal = { ...firstPreparation.proposal, conversation: firstChat };
  check('a proposed memory has no effect before exact confirmation', await count('nodia_ai_preferences') === 0);
  await request(`/nodia-ai/proposals/${firstProposal.proposal_id}/confirmation-challenge`, { method: 'POST', status: [400,409], body: { proposal_revision: firstProposal.revision, expected_hash: '0'.repeat(64) } });
  check('a different preview hash cannot obtain a human challenge', await count('nodia_ai_executions') === 0);
  const accepted = await admission(firstProposal);
  const duplicate = await request(`/nodia-ai/proposals/${firstProposal.proposal_id}/confirm`, { method: 'POST', body: accepted.body, status: 202 });
  check('duplicate human confirmation reuses the same admitted execution', duplicate.execution.execution_id === accepted.execution.execution_id && await count('nodia_ai_preferences') === 0);
  const first = await execute(accepted);
  check('accepted preference binds owner value revision and human step', (await row(first.id)).owner_id === '1' && (await row(first.id)).value === categories[0] && (await row(first.id)).revision === 1 && (await row(first.id)).accepted_step_id === first.step.id);
  check('minimal preference receipt identifies the exact committed revision', first.step.minimal_receipt.resource_key === 'nodia_ai_preferences' && first.step.minimal_receipt.owner_id === '1' && first.step.minimal_receipt.revision === 1);
  await effect.execute(identities.get('1'), first.claim.executionId, first.claim);
  check('completed preference replay leaves one row and the same revision', await count('nodia_ai_preferences') === 1 && (await row(first.id)).revision === 1);

  await rejectPreparation('create', { scope_key: 'finance', key: 'expense_category_id', value: categories[1] });
  await rejectPreparation('update', { id: first.id, expected_revision: 0, value: categories[1] });
  check('duplicate keys and invalid revision cannot silently overwrite accepted memory', (await row(first.id)).value === categories[0]);

  const casA = await admission(await proposal('update', { id: first.id, expected_revision: 1, value: categories[1] }));
  const casB = await admission(await proposal('update', { id: first.id, expected_revision: 1, value: categories[0] }));
  await execute(casA);
  const staleClaim = await claim.execute(randomUUID()); assert.equal(staleClaim.executionId, casB.execution.execution_id);
  await assert.rejects(() => effect.execute(identities.get('1'), staleClaim.executionId, staleClaim), error => [400,403,404,409].includes(error.getStatus?.()));
  await recover.execute(staleClaim, 'nodia_ai:preconditions_changed');
  check('two approved updates cannot both pass the same CAS revision', (await row(first.id)).revision === 2 && (await row(first.id)).value === categories[1]);

  await rejectPreparation('create', { scope_key: 'finance', key: 'api_key', value: 'synthetic_ai33_never_store' });
  await rejectPreparation('create', { scope_key: 'finance', key: 'income_category_id', value: { token: 'synthetic_ai33_never_store' } });
  await rejectPreparation('create', { scope_key: 'finance', key: 'income_category_id', value: categories[0], owner_id: '2' });
  await rejectPreparation('create', { scope_key: 'global', key: 'role', value: 'super_admin' });
  const drafts = await db.query('SELECT partial_command FROM nodia_ai_drafts');
  check('closed keys scalar reference types and derived ownership reject secrets before persistence', !JSON.stringify(drafts).includes('synthetic_ai33_never_store'));

  await rejectPreparation('create', { scope_key: 'finance', key: 'income_category_id', value: categories[2] });
  await rejectPreparation('create', { scope_key: 'business', key: 'business_id', value: foreignBusiness });
  await rejectPreparation('create', { scope_key: 'rental', key: 'property_id', value: properties[1] });
  await rejectPreparation('create', { scope_key: 'business', key: 'supplier_id', scope: { business_id: business }, value: foreignSupplier.id });
  check('real product ownership and supplier business relation reject foreign references');
  const favoriteBusinesses = await request('/nodia-ai/preferences/options?scope_key=business&key=business_id');
  const supplierBusinesses = await request('/nodia-ai/preferences/options?scope_key=business&key=business_id&for_supplier_scope=true');
  const globalSuppliers = await request('/nodia-ai/preferences/options?scope_key=business&key=supplier_id&business_id=' + foreignBusiness);
  await request('/nodia-ai/preferences/options?scope_key=finance&key=expense_category_id&for_supplier_scope=true', { status: 400 });
  check('favorite business options preserve native membership while supplier scope discovery remains global', favoriteBusinesses.items.some(item => item.id === business) && !favoriteBusinesses.items.some(item => item.id === foreignBusiness) && supplierBusinesses.items.some(item => item.id === foreignBusiness) && globalSuppliers.items.some(item => item.id === foreignSupplier.id));

  const incomeProposal = await proposal('create', { scope_key: 'finance', key: 'income_category_id', value: categories[0] });
  const incomeAdmitted = await admission(incomeProposal);
  await worker.execute(randomUUID(), AbortSignal.timeout(20000));
  const incomeStatus = await get.execute(identities.get('1'), incomeAdmitted.execution.execution_id);
  const [incomeStep] = await db.query('SELECT minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1', [incomeAdmitted.execution.execution_id]);
  check('durable worker executes a confirmed preference without model dispatch', incomeStatus.state === 'completed' && incomeStep.minimal_receipt?.resource_key === 'nodia_ai_preferences');
  const income = { id: incomeStep.minimal_receipt.resource_id };
  const businessPreference = await perform('create', { scope_key: 'business', key: 'business_id', value: business });
  const supplierPreference = await perform('create', { scope_key: 'business', key: 'supplier_id', scope: { business_id: business }, value: supplier.id });
  const rental = await perform('create', { scope_key: 'rental', key: 'property_id', value: properties[0] });
  check('all five registered reference keys commit through the same confirmation contract', await count('nodia_ai_preferences', 'owner_id=1') === 5);
  const own = await request('/nodia-ai/preferences'), other = await request('/nodia-ai/preferences', { actor: '2' }), admin = await request('/nodia-ai/preferences', { actor: '3' });
  check('ordinary and omniscient actors list only their own personal preferences', own.items.length === 5 && other.items.length === 0 && admin.items.length === 0);
  check('public preference labels omit private provider fields', !JSON.stringify(own).includes('synthetic_ai33_never_visible'));
  await request('/nodia-ai/preferences?owner_id=2', { status: 400 });
  const page = await request('/nodia-ai/preferences?scope_key=finance&page_limit=1');
  assert.equal(page.items.length, 1); assert.equal(typeof page.next_cursor, 'string');
  const cursorPath = '/nodia-ai/preferences?scope_key=finance&page_limit=1&cursor=' + encodeURIComponent(page.next_cursor);
  const next = await request(cursorPath);
  await request(cursorPath, { actor: '2', status: 400 });
  check('bounded preference pagination preserves filter and actor authority', next.items.length === 1 && next.items[0].preference_id !== page.items[0].preference_id);
  await rejectPreparation('update', { id: first.id, expected_revision: 2, value: categories[0] }, '2');
  await rejectPreparation('delete', { id: first.id, expected_revision: 2 }, '3');
  const administrator = await perform('create', { scope_key: 'finance', key: 'expense_category_id', value: categories[2] }, '3');
  check('super_admin cross-product reference authority does not transfer memory ownership', (await row(administrator.id)).owner_id === '3' && (await row(first.id)).owner_id === '1');

  await db.query('INSERT INTO business_collaborators(business_id,user_id) VALUES($1,2)', [business]);
  const collaboratorMemory = await perform('create', { scope_key: 'business', key: 'business_id', value: business }, '2');
  await db.query('UPDATE business_collaborators SET is_active=false WHERE business_id=$1 AND user_id=2', [business]);
  const revokedBusiness = (await request('/nodia-ai/preferences', { actor: '2' })).items.find(item => item.preference_id === collaboratorMemory.id);
  const Reader = await loadAi('nodia-ai-preference/use-case/nodia-ai-preference-reader.use-case', 'NodiaAiPreferenceReaderUseCase');
  const revokedContext = await db.transaction(manager => compiled.get(Reader).loadForContext(manager, identities.get('2'), ['/business']));
  check('business membership revocation hides its accepted label and removes it from assembled context', revokedBusiness?.available === false && revokedBusiness.value_label === null && revokedContext.length === 0);
  await perform('delete', { id: collaboratorMemory.id, expected_revision: 1 }, '2');
  // Suppliers intentionally keep their native authenticated global visibility;
  // the scoped business relationship is integrity, not business membership.
  const globalSupplier = await perform('create', { scope_key: 'business', key: 'supplier_id', scope: { business_id: foreignBusiness }, value: foreignSupplier.id });
  check('supplier reference preserves native global visibility with its exact business scope', (await row(globalSupplier.id)).value === foreignSupplier.id);
  await perform('delete', { id: globalSupplier.id, expected_revision: 1 });

  const revoked = await admission(await proposal('update', { id: first.id, expected_revision: 2, value: categories[0] }));
  const revokedClaim = await claim.execute(randomUUID()); assert.equal(revokedClaim.executionId, revoked.execution.execution_id);
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [modules.get('finance')]);
  await assert.rejects(() => effect.execute(identities.get('1'), revokedClaim.executionId, revokedClaim), error => [403,404,409].includes(error.getStatus?.()));
  await recover.execute(revokedClaim, 'nodia_ai:capability_denied');
  const unavailable = await request('/nodia-ai/preferences');
  const revokedItem = unavailable.items.find(item => item.preference_id === first.id);
  check('revocation after confirmation fences the preference effect and hides reference labels', (await row(first.id)).revision === 2 && revokedItem?.available === false && revokedItem.value_label === null);
  await perform('delete', { id: income.id, expected_revision: 1 });
  check('owner can forget an unavailable preference without the revoked product module', !await row(income.id));
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [modules.get('finance')]);
  await db.query('UPDATE providers SET is_active=false WHERE id=$1', [supplier.id]);
  const inactive = (await request('/nodia-ai/preferences')).items.find(item => item.preference_id === supplierPreference.id);
  check('inactive reference remains forgettable but exposes no stale label', inactive?.available === false && inactive.value_label === null);
  await perform('delete', { id: supplierPreference.id, expected_revision: 1 });

  const rollback = await admission(await proposal('update', { id: first.id, expected_revision: 2, value: categories[0] }));
  const rollbackClaim = await claim.execute(randomUUID()); assert.equal(rollbackClaim.executionId, rollback.execution.execution_id);
  await db.query("CREATE FUNCTION synthetic_ai33_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='completed' THEN RAISE EXCEPTION 'synthetic_ai33_receipt_failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai33_receipt_failure BEFORE UPDATE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION synthetic_ai33_receipt_failure()");
  try { await assert.rejects(() => effect.execute(identities.get('1'), rollbackClaim.executionId, rollbackClaim)); }
  finally { await db.query('DROP TRIGGER synthetic_ai33_receipt_failure ON nodia_ai_execution_steps;DROP FUNCTION synthetic_ai33_receipt_failure()'); }
  await recover.execute(rollbackClaim, 'nodia_ai:execution_conflict');
  check('receipt failure atomically rolls back preference value revision and consent provenance', (await row(first.id)).revision === 2 && (await row(first.id)).value === categories[1]);

  const lostCommit = await admission(await proposal('update', { id: first.id, expected_revision: 2, value: categories[0] }));
  const lostClaim = await claim.execute(randomUUID()); assert.equal(lostClaim.executionId, lostCommit.execution.execution_id);
  const Store = await loadAi('nodia-ai-execution/nodia-ai-execution.service', 'NodiaAiExecutionService');
  const store = compiled.get(Store), transaction = store.transaction.bind(store);
  store.transaction = async work => { await transaction(work); throw Error('synthetic_ai33_committed_response_lost'); };
  try { await assert.rejects(() => effect.execute(identities.get('1'), lostClaim.executionId, lostClaim), error => error.getStatus?.() === 503); }
  finally { store.transaction = transaction; }
  await recover.execute();
  const recovered = await effect.execute(identities.get('1'), lostClaim.executionId, lostClaim);
  check('lost COMMIT response recovers the existing receipt without applying the memory update twice', recovered.state === 'completed' && (await row(first.id)).revision === 3 && (await row(first.id)).value === categories[0]);

  const expireClass = await loadAi('nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case', 'ExpireNodiaAiConversationsUseCase');
  const Conversations = await loadAi('nodia-ai-conversation/nodia-ai-conversation.service', 'NodiaAiConversationService');
  const expire = new expireClass(compiled.get(Conversations), compiled.get(Policy));
  const saved = await row(businessPreference.id);
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [businessPreference.proposal.conversation]);
  await expire.execute();
  const independent = await row(businessPreference.id);
  check('chat retention preserves accepted memory while both origin references become NULL', independent?.value === saved.value && independent.source_conversation_id === null && independent.accepted_step_id === null);
  const deleted = await perform('delete', { id: businessPreference.id, expected_revision: 1 });
  await effect.execute(identities.get('1'), deleted.claim.executionId, deleted.claim);
  check('explicit forget and its receipt replay never recreate or double-delete memory', !await row(businessPreference.id) && deleted.step.minimal_receipt.operation === 'delete');

  // Boundary fixture: the49 preexisting accepted rows are synthetic SQL seed,
  // not claimed as49 confirmations. Only the two racing additions use the real
  // proposal/challenge/confirmation/claim/effect transactions under test.
  const ScopeHash = await loadAi('nodia-ai-preference/types/preference.types', 'preferenceScopeHash');
  const capacityInputs = [];
  for (let index = 0; index < 51; index++) {
    const scopedBusiness = randomUUID();
    await db.query("INSERT INTO businesses(id,owner_id,name) VALUES($1,2,'Synthetic AI33 capacity scope')", [scopedBusiness]);
    const [scopedSupplier] = await db.query("INSERT INTO providers(business_id,name) VALUES($1,'Synthetic capacity supplier') RETURNING id::text", [scopedBusiness]);
    const scope = { business_id: scopedBusiness };
    if (index < 49) await db.query("INSERT INTO nodia_ai_preferences(id,owner_id,scope_key,scope_hash,scope,key,value,revision) VALUES($1,2,'business',$2,$3,'supplier_id',to_jsonb($4::text),1)", [randomUUID(), ScopeHash('business', scope), scope, scopedSupplier.id]);
    else capacityInputs.push({ scope_key: 'business', key: 'supplier_id', scope, value: scopedSupplier.id });
  }
  const capacityAdmitted = [];
  for (const input of capacityInputs) capacityAdmitted.push(await admission(await proposal('create', input, '2'), '2'));
  const competingClaims = await Promise.all([claim.execute(randomUUID()), claim.execute(randomUUID())]);
  assert.equal(competingClaims.filter(Boolean).length, 1, 'native worker must serialize one actor');
  const firstCapacityClaim = competingClaims.find(Boolean);
  await effect.execute(identities.get('2'), firstCapacityClaim.executionId, firstCapacityClaim);
  const secondCapacityClaim = await claim.execute(randomUUID());
  assert.ok(secondCapacityClaim);
  const capacityClaims = [firstCapacityClaim, secondCapacityClaim];
  assert.deepEqual(new Set(capacityClaims.map(item => item.executionId)), new Set(capacityAdmitted.map(item => item.execution.execution_id)));
  await assert.rejects(() => effect.execute(identities.get('2'), secondCapacityClaim.executionId, secondCapacityClaim), error => error.getStatus?.() === 409);
  await recover.execute(secondCapacityClaim, 'nodia_ai:preconditions_changed');
  check('concurrent worker claims serialize two confirmed additions admitted from49 and enforce the50-row cap', await count('nodia_ai_preferences', 'owner_id=2') === 50 && await count('nodia_ai_execution_steps', "execution_id=ANY($1::uuid[]) AND state='completed' AND minimal_receipt IS NOT NULL", [capacityClaims.map(item => item.executionId)]) === 1);

  check('preference effects never invoke a provider or acquire a profile slot', providerCalls === 0 && await count('nodia_ai_runtime_slots') === 0);
  check('all execution attempts close without leased work', await count('nodia_ai_job_attempts', 'ended_at IS NULL') === 0 && await count('nodia_ai_jobs', "state='leased'") === 0);
  check('unrelated accepted product references remain intact', Boolean(await row(rental.id)));

  allowRuntimeObservation = true;
  const [provider] = await db.query("INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI33 no generation','{}') RETURNING id::text");
  const selection = { connection_id: provider.id, mode: 'agentic', model_id: 'synthetic-ai33-no-provider', effort_id: null };
  const runtimeChat = await compiled.get(CreateConversation).execute(identities.get('1'), { client_request_id: randomUUID(), selection });
  const runtimeTurn = await compiled.get(AdmitMessage).execute(identities.get('1'), runtimeChat.conversation_id, {
    client_message_id: randomUUID(), expected_conversation_revision: runtimeChat.revision,
    parts: [{ kind: 'text', text: 'Synthetic preference dispatch boundary' }],
  });
  const stage = compiled.get(Stage), workerId = randomUUID();
  assert.equal(await stage.execute(workerId, AbortSignal.timeout(20000)), true);
  const checkpoint = compiled.get(Checkpoint), arm = checkpoint.armDispatch.bind(checkpoint);
  let preDispatchState, injected = false;
  checkpoint.armDispatch = async (claimed, chosen, runtime, validate) => {
    assert.equal(injected, false); injected = true;
    await db.query('UPDATE finance_categories SET is_active=false WHERE id=$1', [categories[0]]);
    try { return await arm(claimed, chosen, runtime, validate); }
    catch (error) {
      const [attempt] = await db.query('SELECT phase FROM nodia_ai_job_attempts WHERE id=$1', [claimed.attempt.id]);
      const [run] = await db.query('SELECT provider_dispatches_used FROM nodia_ai_runs WHERE id=$1', [claimed.run.id]);
      const [slot] = await db.query('SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1', [resourceKey]);
      preDispatchState = { phase: attempt.phase, providerDispatches: run.provider_dispatches_used, slot: slot.state };
      throw error;
    }
  };
  try { assert.equal(await stage.execute(workerId, AbortSignal.timeout(20000)), true); }
  finally { checkpoint.armDispatch = arm; await db.query('UPDATE finance_categories SET is_active=true WHERE id=$1', [categories[0]]); }
  const [fencedRun] = await db.query('SELECT state,error_code,provider_dispatches_used FROM nodia_ai_runs WHERE id=$1', [runtimeTurn.run.run_id]);
  const [released] = await db.query('SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1', [resourceKey]);
  check('reference change after assembly is rejected inside the real arming transaction before budget or attempt arming', injected && preDispatchState?.phase === 'claimed' && preDispatchState.providerDispatches === 0 && preDispatchState.slot === 'held');
  check('known pre-dispatch failure releases the claimed slot without quarantine or provider dispatch', fencedRun.state === 'failed' && fencedRun.error_code === 'nodia_ai:preferences_changed' && fencedRun.provider_dispatches_used === 0 && released.state === 'free' && providerCalls === 0);

  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const bounded = async promise => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('synthetic_ai33_gate_timeout')), 5000); })]); } finally { clearTimeout(timer); } };
  const cancelChat = await compiled.get(CreateConversation).execute(identities.get('1'), { client_request_id: randomUUID(), selection });
  const cancelTurn = await compiled.get(AdmitMessage).execute(identities.get('1'), cancelChat.conversation_id, {
    client_message_id: randomUUID(), expected_conversation_revision: cancelChat.revision,
    parts: [{ kind: 'text', text: 'Synthetic cancellation during arming SQL' }],
  });
  await stage.execute(workerId, AbortSignal.timeout(20000));
  const enteredArming = deferred(), releaseArming = deferred(), enteredFinish = deferred(), armSettled = deferred();
  const finish = checkpoint.finish.bind(checkpoint), cancellation = new AbortController();
  let cancellationOutcome, armingEntered = false;
  checkpoint.armDispatch = async (claimed, chosen, runtime, validate) => {
    try { return await arm(claimed, chosen, runtime, async manager => {
      await validate?.(manager); armingEntered = true; enteredArming.resolve(); await releaseArming.promise;
    }); } finally { armSettled.resolve(); }
  };
  checkpoint.finish = async (claimed, outcome) => {
    cancellationOutcome = outcome.status; enteredFinish.resolve(); return finish(claimed, outcome);
  };
  const cancellingStage = stage.execute(workerId, cancellation.signal);
  try {
    await bounded(enteredArming.promise);
    cancellation.abort(Error('synthetic_ai33_cancel_during_arming'));
    // Prove cancellation wins while the real arming transaction is still open.
    await bounded(enteredFinish.promise);
    assert.equal(cancellationOutcome, 'unknown');
    releaseArming.resolve();
    await bounded(Promise.all([cancellingStage, armSettled.promise]));
    await new Promise(setImmediate);
  } finally {
    releaseArming.resolve();
    await bounded(cancellingStage).catch(() => {});
    if (armingEntered) await bounded(armSettled.promise).catch(() => {});
    checkpoint.armDispatch = arm; checkpoint.finish = finish;
  }
  const [cancelledRun] = await db.query('SELECT state,provider_dispatches_used FROM nodia_ai_runs WHERE id=$1', [cancelTurn.run.run_id]);
  const [quarantined] = await db.query('SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1', [resourceKey]);
  check('cancellation while real arming SQL is pending preserves uncertainty and never dispatches a late provider request', cancelledRun.state === 'unknown' && cancelledRun.provider_dispatches_used === 1 && quarantined.state === 'unknown' && providerCalls === 0);
  console.log(JSON.stringify({ stage: 'AI-33', scope: 'compiled_preference_confirmation_effect_disposable_sql', checks: checks.length, passed: checks, provider_generations: providerCalls, synthetic_adapter_observations: syntheticObservations, configured_database_used: false, storage_operations: 0, synthetic_http_identity: true }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ stage: 'AI-33', completed_checks: checks.length, last_checks: checks.slice(-4) })); throw error;
} finally {
  if (app) await app.close(); else await compiled?.close();
  await fixture.close();
}
