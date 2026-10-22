// Compiled automatic discovery/selection/worker SQL integration. Actual publication
// and registered capabilities, synthetic transport/proofs/records only. No account,
// configured database, R2, deployment or publication fixture overrides.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai3606');
const { db, options, identities } = fixture;
const checks = [], scenarios = [], acknowledged = new Set(), remoteProofs = new Map();
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); };
const newNames = ['nodia_finance_movements_prepare_create', 'nodia_proposals_get', 'nodia_operations_get',
  'nodia_attachments_describe', 'nodia_preferences_list', 'nodia_preferences_prepare', 'nodia_workflows_prepare'];
let compiled, app, active, totalDispatches = 0, httpRequests = 0, ackFailures = 0;
const load = async (...entries) => Promise.all(entries.map(([file, name]) => loadAi(file, name)));
try {
  const [Tools, Conversation, Processing, Runtime, Confirmation, Execution, Observation] = await load(
    ['nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'],
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'],
    ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    ['nodia-ai-observation/nodia-ai-observation.module', 'NodiaAiObservationModule']);
  const [Stage, Create, Admit, Routing, AdapterPort, ProofPort, Redis, Registry, Claim, Execute, NativePrepare,
    Filter, Policy, bodyParser, Reconcile, Cleanup] = await load(
    ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'],
    ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'],
    ['nodia-ai-conversation/use-case/update-nodia-ai-routing.use-case', 'UpdateNodiaAiRoutingUseCase'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['nodia-ai-runtime/types/reconciliation.types', 'NodiaAiRuntimeReconciliationPort'],
    ['common/redis/redis.service', 'RedisService'],
    ['nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase'],
    ['nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'],
    ['nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase'],
    ['nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'],
    ['common/filters/all-exceptions.filter', 'AllExceptionsFilter'],
    ['nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY'],
    ['nodia-ai-conversation/nodia-ai-conversation-body-parser', 'createNodiaAiConversationBodyParser'],
    ['nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase'],
    ['nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase']);
  const observe = selection => ({ available: true, observedAt: new Date(), source: 'synthetic_fixture_only',
    resourceKey: 'gemini-profile:' + (selection.mode === 'token_plan_web' ? 'a' : 'b').repeat(64),
    configurationGeneration: 'c'.repeat(64), sessionGeneration: 'd'.repeat(32),
    adapterContractVersion: 'nodia-ai-gemini-chat/1', supportsMcp: selection.mode === 'token_plan_agentic', reason: null });
  const fakeProofs = {
    async acknowledge(proof) {
      if (active?.failAcknowledgement && remoteProofs.get(proof.attemptId)?.selectionPhase === 'discovery') {
        ackFailures++; throw Error('Synthetic acknowledgement response unavailable');
      }
      acknowledged.add(proof.attemptId);
    },
    async reconcile(request) {
      const saved = remoteProofs.get(request.attemptId);
      assert.ok(saved);
      return { ...request, terminalProofId: randomUUID(), processClosed: true,
        outcome: saved.replyReturned ? 'completed' : 'abandoned_unknown', observedAt: new Date() };
    },
  };
  const synthetic = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe(selection) { return observe(selection); }, async verifyConfiguration() {},
    async execute(request, signal) {
      totalDispatches++;
      const [row] = await db.query('SELECT context_manifest FROM nodia_ai_runs WHERE id=$1', [active.run]);
      const selectionPhase = row.context_manifest.tool_selection.phase;
      const dispatch = { attempt_id: request.attemptId, mode: request.selection.mode, selection_phase: selectionPhase,
        tools: (request.tools ?? []).map(tool => tool.name).sort() };
      active.dispatches.push(dispatch);
      const proof = { engine: request.selection.mode === 'token_plan_web' ? 'web' : 'agentic',
        attemptId: request.attemptId, resourceKey: request.resourceKey, sessionGeneration: request.sessionGeneration,
        operationRef: request.attemptId, terminalProofId: randomUUID(), processClosed: true,
        outcome: 'completed', observedAt: new Date() };
      const remote = { selectionPhase, replyReturned: false }; remoteProofs.set(request.attemptId, remote);
      if (request.selection.mode === 'token_plan_web') {
        assert.equal(request.tools, undefined, 'Web remains conversational only');
        remote.replyReturned = true;
        return { kind: 'delegation_request', reason: 'Synthetic user request needs registered Nodia tools.', terminalProof: proof };
      }
      const call = (name, args, id = randomUUID()) => request.onToolCall({ callId: id, name, arguments: args }, signal);
      if (selectionPhase === 'discovery') {
        check(active.name + ': discovery exposes selection without business capability descriptors', dispatch.tools.includes('nodia_capabilities_select') && newNames.every(name => !dispatch.tools.includes(name)));
        const args = { catalog_version: compiled.get(Registry).catalogVersion,
          capability_ids: active.allHelpers ? newNames : ['nodia_finance_movements_prepare_create'] };
        const id = randomUUID(), selected = await call('nodia_capabilities_select', args, id);
        assert.equal(selected.status, 'selection_requested'); assert.equal(selected.business_effects, false);
        const replay = await call('nodia_capabilities_select', args, id);
        assert.deepEqual(replay, selected);
        active.selectionAttempt = request.attemptId;
        check(active.name + ': same selection callback returns one durable receipt without granting tools',
          (await db.query("SELECT count(*)::int n FROM nodia_ai_tool_calls WHERE run_id=$1 AND tool_name='nodia_capabilities_select'", [active.run]))[0].n === 1);
        await assert.rejects(call('nodia_finance_movements_prepare_create', { partial: {} }), /capability_denied|catalog_changed/u);
        check(active.name + ': a business callback remains denied in the original discovery generation');
        if (active.unknownDiscovery) throw Error('Synthetic lost discovery reply after selection');
      } else {
        assert.equal(selectionPhase, 'execution');
        check(active.name + ': execution starts only after exact discovery proof acknowledgement', acknowledged.has(active.selectionAttempt));
        assert.ok(!dispatch.tools.includes('nodia_capabilities_select'));
        const [grant] = await db.query('SELECT allowed_operations FROM nodia_ai_execution_grants WHERE run_id=$1', [active.run]);
        assert.deepEqual(grant.allowed_operations.filter(name => name !== 'chat:respond').sort(), dispatch.tools);
        if (active.allHelpers) {
          const prep = await call('nodia_finance_movements_prepare_create', { partial: {
            owner_id: active.actor, name: 'Synthetic C05 selected expense', amount: '23450',
            type: 'expense', status: 'paid', category_id: active.category } });
          assert.equal(prep.status, 'ready');
          const proposal = await call('nodia_proposals_get', { proposal_id: prep.proposal.proposal_id });
          assert.equal(proposal.hash, prep.proposal.hash);
          const operation = await call('nodia_operations_get', { execution_id: active.seedExecution });
          assert.equal(operation.state, 'completed');
          const metadata = await call('nodia_attachments_describe', { attachment_id: active.attachment });
          assert.equal(metadata.byte_count, 128);
          const list = await call('nodia_preferences_list', {}); assert.equal(list.items.length, 0);
          const memory = await call('nodia_preferences_prepare', { operation: 'create', partial: {
            scope_key: 'finance', scope: {}, key: 'expense_category_id', value: active.category } });
          assert.equal(memory.status, 'ready');
          active.workflow = await call('nodia_workflows_prepare', {
            catalog_version: 'nodia-ai-ai23-workflow/1', draft_ids: [memory.draft_id, prep.draft_id] });
          assert.equal(active.workflow.status, 'ready');
          check('all seven new published adapters execute through the selected production gateway',
            (await db.query("SELECT DISTINCT tool_name FROM nodia_ai_tool_calls WHERE run_id=$1 AND state='completed'", [active.run]))
              .filter(item => newNames.includes(item.tool_name)).length === 7);
        } else {
          const result = await call('nodia_finance_movements_prepare_create', { partial: {} });
          assert.equal(result.status, 'needs_clarification');
        }
      }
      remote.replyReturned = true;
      return { kind: 'answer', text: 'Synthetic bounded selection phase completed.', terminalProof: proof };
    },
  };
  const executeSynthetic = synthetic.execute.bind(synthetic);
  synthetic.execute = async (...args) => {
    try { return await executeSynthetic(...args); }
    catch (error) {
      active.callback_error = { name: error?.name ?? 'unknown',
        code: typeof error?.code === 'string' ? error.code : null,
        message: String(error?.message ?? 'Synthetic callback rejected').slice(0, 1024) };
      throw error;
    }
  };
  compiled = await Test.createTestingModule({
    imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }),
      Tools, Conversation, Processing, Runtime, Confirmation, Execution, Observation], providers: [Stage],
  }).overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] })
    .overrideProvider(AdapterPort).useValue(synthetic).overrideProvider(ProofPort).useValue(fakeProofs).compile();
  app = compiled.createNestApplication({ logger: false }); app.setGlobalPrefix('api/v1');
  app.use('/api/v1/nodia-ai', bodyParser(compiled.get(Policy).admission.http_json_bytes));
  app.useGlobalFilters(new Filter()); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest(), identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException(); request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId }; return true;
  } });
  await app.listen(0, '127.0.0.1'); const base = `${await app.getUrl()}/api/v1/nodia-ai`;
  const http = async (target, { method = 'GET', body, expected = 200, actor = '3' } = {}) => {
    httpRequests++; const response = await fetch(base + target, { method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = response.status === 204 ? null : await response.json();
    assert.equal(response.status, expected, JSON.stringify({ method, target, status: response.status, value })); return value;
  };
  const [provider] = await db.query(`INSERT INTO ai_providers(name,fields,use_token_plan_web,use_token_plan_agentic)
    VALUES('Synthetic C05 selected provider',$1::jsonb,true,true) RETURNING id::text`, [JSON.stringify({
    token_plan_web: { selected_model: 'synthetic-c05-web' }, token_plan_agentic: { selected_model: 'synthetic-c05-agentic' } })]);
  let [financeModule] = await db.query("SELECT id::text FROM modules WHERE link='/tools/finances-personal'");
  if (!financeModule) [financeModule] = await db.query("INSERT INTO modules(module_group_id,key,link) SELECT module_group_id,'personal_finance','/tools/finances-personal' FROM modules WHERE key='nodia_ai' RETURNING id::text");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [financeModule.id]);
  const [category] = await db.query("INSERT INTO finance_categories(user_id,name,key) VALUES(3,'Synthetic C05 category','ai3606_food') RETURNING id::text");
  const agentic = { connection_id: provider.id, mode: 'token_plan_agentic', model_id: 'synthetic-c05-agentic', effort_id: null };
  const web = { connection_id: provider.id, mode: 'token_plan_web', model_id: 'synthetic-c05-web', effort_id: null };
  const stage = compiled.get(Stage), cleanup = compiled.get(Cleanup);
  const row = async () => (await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [active.run]))[0];
  const step = async () => stage.execute(randomUUID(), new AbortController().signal);
  async function drain() { for (let i = 0; i < 8; i++) { const result = await cleanup.execute(); if (!result.processed) break; } }
  async function humanConfirm(proposal) {
    const challenge = await http(`/proposals/${proposal.proposal_id}/confirmation-challenge`, { method: 'POST', body: { proposal_revision: proposal.revision, expected_hash: proposal.hash } });
    const body = { client_request_id: randomUUID(), proposal_revision: proposal.revision, expected_hash: proposal.hash, confirmation_token: challenge.confirmation_token };
    const accepted = await http(`/proposals/${proposal.proposal_id}/confirm`, { method: 'POST', body, expected: 202 });
    const repeated = await http(`/proposals/${proposal.proposal_id}/confirm`, { method: 'POST', body, expected: 202 });
    assert.equal(accepted.execution.execution_id, repeated.execution.execution_id);
    let result = accepted.execution;
    for (let i = 0; i < 8 && result.state === 'queued'; i++) {
      const lease = await compiled.get(Claim).execute(randomUUID()); assert.equal(lease?.executionId, accepted.execution.execution_id);
      result = await compiled.get(Execute).execute(identities.get('3'), accepted.execution.execution_id, lease);
    }
    assert.equal(result.state, 'completed'); return accepted.execution.execution_id;
  }
  async function begin(name, { actor = '3', delegated = false, allHelpers = false, setup } = {}) {
    const chat = await compiled.get(Create).execute(identities.get(actor), { client_request_id: randomUUID(), selection: delegated ? web : agentic });
    active = { name, chat: chat.conversation_id, actor, allHelpers, category: category.id, dispatches: [] }; scenarios.push(active);
    if (delegated) await compiled.get(Routing).execute(identities.get(actor), active.chat, {
      enabled: true, expected_conversation_revision: chat.revision, expected_routing_revision: chat.routing.revision,
      target: { selection: agentic, configuration_generation: 'c'.repeat(64), session_generation: 'd'.repeat(32) } });
    if (setup) await setup();
    const [header] = await db.query('SELECT revision FROM nodia_ai_conversations WHERE id=$1', [active.chat]);
    const admitted = await compiled.get(Admit).execute(identities.get(actor), active.chat, {
      client_message_id: randomUUID(), expected_conversation_revision: header.revision, parts: [{ kind: 'text', text: 'Synthetic automatic selection integration.' }] });
    active.run = admitted.run.run_id;
  }
  async function toSelection() {
    for (let i = 0; i < 6; i++) {
      if ((await row()).context_manifest.tool_selection.phase === 'ack_pending') return;
      assert.equal(await step(), true);
      if ((await row()).phase === 'delegated_inference') await drain();
    }
    assert.fail('Discovery did not reach its terminal proof acknowledgement phase');
  }
  async function finish() {
    for (let i = 0; i < 8; i++) { if (['completed', 'failed', 'unknown'].includes((await row()).state)) break; if (!await step()) break; await drain(); }
    await drain(); return row();
  }
  const manifest = JSON.parse(fs.readFileSync(new URL('../dist/nodia-ai/knowledge/manifest.json', import.meta.url)));
  assert.equal(manifest.capability_contracts.length, 74, 'The first C05 cohort must preserve 67 reads and add exactly seven capabilities');
  check('production bundle publishes the seven new candidates without any synthetic publication override',
    newNames.every(name => manifest.capability_contracts.some(item => item.capability_id === name && item.publication === 'published')));
  await begin('web_delegated_discovery_ACK_execution_all_seven', { delegated: true, allHelpers: true, setup: async () => {
    const seed = await db.transaction(manager => compiled.get(NativePrepare).execute(manager, identities.get('3'), {
      conversationId: active.chat, toolName: 'nodia_finance_movements_prepare_create', partial: {
        owner_id: '3', name: 'Synthetic existing C05 expense', amount: '100', type: 'expense', status: 'paid', category_id: category.id } }));
    active.seedExecution = await humanConfirm(seed.proposal);
    active.attachment = randomUUID();
    const generation = randomUUID();
    await db.query(`INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,byte_count,media_type,content_hash,expires_at)
      VALUES($1,$2,$3,$4,'1','image','ready','synthetic-c05-metadata.png',$5,$6,128,128,'image/png',$7,clock_timestamp()+interval '89 days')`,
    [active.attachment, active.chat, randomUUID(), 'e'.repeat(64), `nodia-ai/${active.chat}/${active.attachment}/${generation}`, generation, 'f'.repeat(64)]);
  } });
  const success = await finish();
  check('Web and two Agentic generations finish through the real worker state machine', success.state === 'completed' && active.dispatches.length === 3);
  check('the continuing delegated execution charges exactly one delegation and three provider dispatches', success.delegations_used === 1 && success.provider_dispatches_used === 3);
  check('all delegated Agentic generations preserve the frozen target mode and model', active.dispatches[0].mode === 'token_plan_web' && active.dispatches.slice(1).every(item => item.mode === 'token_plan_agentic'));
  check('model preparation has no additional financial or accepted-memory effect before human HTTP confirmation',
    (await db.query('SELECT count(*)::int n FROM finance_movements'))[0].n === 1 && (await db.query('SELECT count(*)::int n FROM nodia_ai_preferences'))[0].n === 0);
  await humanConfirm(active.workflow.proposal);
  check('exact human workflow confirmation applies memory and expense once with SQL receipts',
    (await db.query('SELECT count(*)::int n FROM finance_movements'))[0].n === 2 && (await db.query('SELECT count(*)::int n FROM nodia_ai_preferences'))[0].n === 1);

  await begin('ACK_failure_does_not_activate_or_dispatch'); await toSelection(); active.failAcknowledgement = true;
  await step();
  let current = await row();
  const [pendingGrant] = await db.query('SELECT allowed_operations FROM nodia_ai_execution_grants WHERE run_id=$1', [active.run]);
  check('failed native ACK retains discovery grant and prevents a second inference', active.dispatches.length === 1 && current.context_manifest.tool_selection.phase === 'ack_pending' && pendingGrant.allowed_operations.includes('nodia_capabilities_select') && !pendingGrant.allowed_operations.includes('nodia_finance_movements_prepare_create') && ackFailures === 1);
  active.failAcknowledgement = false;
  await db.query("UPDATE nodia_ai_jobs SET available_at=clock_timestamp() WHERE (kind='turn' AND run_id=$1) OR (kind='reconcile' AND dedup_key=$2)", [active.run, 'ack:' + active.selectionAttempt]);
  await drain(); current = await finish();
  check('retrying only the ACK and undispatched selection stage resumes without replaying discovery', current.state === 'completed' && active.dispatches.length === 2);

  await begin('unknown_discovery_never_activates'); active.unknownDiscovery = true; current = await finish();
  check('lost discovery reply leaves selection unactivated and dispatch unknown without replay', current.state === 'unknown' && active.dispatches.length === 1 && current.context_manifest.tool_selection.phase === 'selection_requested');
  const [unknownGrant] = await db.query('SELECT allowed_operations FROM nodia_ai_execution_grants WHERE run_id=$1', [active.run]);
  check('uncertain selection never receives the selected business grant', !unknownGrant.allowed_operations.includes('nodia_finance_movements_prepare_create'));
  const [unknownJob] = await db.query("SELECT id FROM nodia_ai_jobs WHERE run_id=$1 AND kind='turn'", [active.run]);
  await compiled.get(Reconcile).execute(identities.get('3'), unknownJob.id); await drain();
  check('explicit synthetic native reconciliation closes uncertainty without another generation', (await row()).state === 'failed' && active.dispatches.length === 1);

  await begin('destination_revoked_after_selection', { actor: '1' }); await toSelection();
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [financeModule.id]); current = await finish();
  check('destination revocation before activation denies selected capabilities without another inference', current.state === 'failed' && active.dispatches.length === 1 && current.context_manifest.tool_selection.phase === 'ack_pending');
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [financeModule.id]);

  await begin('catalog_hash_changes_after_selection'); await toSelection();
  await db.query("UPDATE nodia_ai_runs SET context_manifest=jsonb_set(context_manifest,'{tool_selection,catalog_hash}',to_jsonb($2::text)) WHERE id=$1", [active.run, '0'.repeat(64)]); current = await finish();
  check('stale catalog identity denies activation without silently reselecting or dispatching', current.state === 'failed' && active.dispatches.length === 1);

  await begin('selected_execution_respects_remaining_dispatch_budget'); await toSelection();
  await db.query("UPDATE nodia_ai_runs SET budget_snapshot=jsonb_set(budget_snapshot,'{provider_dispatches}','1'::jsonb) WHERE id=$1", [active.run]); current = await finish();
  check('selected execution reserves its own provider dispatch and cannot bypass an exhausted budget', current.state === 'failed' && current.provider_dispatches_used === 1 && active.dispatches.length === 1);

  await begin('delegated_source_attempt_cannot_be_replaced', { delegated: true }); await toSelection();
  await db.query("UPDATE nodia_ai_job_attempts SET routing_phase='base' WHERE id=$1", [active.selectionAttempt]); current = await finish();
  check('tampering with the acknowledged delegated source cannot authorize a second delegated execution', current.state === 'failed' && active.dispatches.length === 2);
  await drain();
  const [quiet] = await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) slots`);
  check('all synthetic SQL scenarios finish without pending jobs attempts or runtime slots', Object.values(quiet).every(value => value === 0));
  const scenarioResults = await Promise.all(scenarios.map(async item => {
    const [result] = await db.query('SELECT state,error_code,provider_dispatches_used,delegations_used,tool_calls_used,context_manifest FROM nodia_ai_runs WHERE id=$1', [item.run]);
    return { name: item.name, run: item.run, dispatches: item.dispatches,
      final_state: result.state, error_code: result.error_code, provider_dispatches_used: result.provider_dispatches_used,
      delegations_used: result.delegations_used, tool_calls_used: result.tool_calls_used,
      final_selection_phase: result.context_manifest.tool_selection.phase };
  }));
  console.log(JSON.stringify({ stage: 'AI-36-C05', scope: 'automatic_selection_actual_compiled_SQL_synthetic_transport', status: 'passed',
    checks: checks.length, check_names: checks, scenarios: scenarioResults,
    synthetic_provider_dispatches: totalDispatches, actual_provider_generations: 0, synthetic_proof_ACKs: acknowledged.size,
    synthetic_failed_ACKs: ackFailures, http_requests: httpRequests, production_bundle_capabilities: manifest.capability_contracts.length,
    knowledge_release: manifest.release_id, synthetic_publication_override: false, configured_database_used: false,
    storage_operations: 0, native_profile_calls: 0, services_restarted: false,
    human_confirmation_layer: 'synthetic_operator_HTTP_exact_preview_not_physical_UI' }, null, 2));
} catch (error) {
  const runs = await db.query('SELECT id,state,phase,error_code,provider_dispatches_used,delegations_used,context_manifest->\'tool_selection\' tool_selection FROM nodia_ai_runs ORDER BY created_at,id');
  const jobs = await db.query('SELECT id,kind,state,stage_key,stage_seq,attempt_count FROM nodia_ai_jobs ORDER BY created_at,id');
  const attempts = await db.query('SELECT job_id,phase,error_code,stage_key,stage_seq,routing_phase FROM nodia_ai_job_attempts ORDER BY started_at,id');
  console.log(JSON.stringify({ stage: 'AI-36-C05', scope: 'automatic_selection_actual_compiled_SQL_synthetic_transport', status: 'failed',
    failure: { name: error?.name ?? 'unknown', code: typeof error?.code === 'string' ? error.code : null,
      message: String(error?.message ?? 'Synthetic SQL verification failed').slice(0, 1024) },
    checks: checks.length, check_names: checks, scenarios, runs, jobs, attempts,
    actual_provider_generations: 0, configured_database_used: false, storage_operations: 0, services_restarted: false }, null, 2));
  throw error;
} finally {
  if (app) await app.close(); else if (compiled) await compiled.close();
  await fixture.close();
}
