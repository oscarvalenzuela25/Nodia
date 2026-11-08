// Compiled HTTP and disposable PostgreSQL only. All chat/receipt data and adapter wiring are synthetic.
// No provider, configured database, credentials, business handler or MCP execution is permitted.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai16');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
let app, restoreBusiness, restoreAiSettings;
let providerObservations = 0, providerExecutions = 0, businessHandlerCalls = 0, aiSettingsHandlerCalls = 0;
try {
  const Observation = await loadAi('nodia-ai-observation/nodia-ai-observation.module', 'NodiaAiObservationModule');
  const Registry = await loadAi('nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase');
  const Adapter = await loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort');
  const Redis = await loadAi('common/redis/redis.service', 'RedisService');
  const Policy = await loadAi('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY');
  const BusinessRead = await loadAi('nodia-ai-products/business/use-case/read-nodia-ai-business.use-case', 'ReadNodiaAiBusinessUseCase');
  const AiSettingsRead = await loadAi('nodia-ai-products/ai-settings/use-case/read-ai-settings.use-case', 'ReadNodiaAiAiSettingsUseCase');
  const { canonicalKnowledge, knowledgeHash } = await import('../dist/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js');
  const { compileNodiaAiToolSchema } = await import('../dist/nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js');
  const commonSource = readFileSync(new URL('../dist/nodia-ai-tools/config/common-schema.json', import.meta.url), 'utf8');
  const eventSchema = compileNodiaAiToolSchema({ sourceJson: commonSource, definition: 'EventPage', sha256: knowledgeHash(commonSource) });
  const observationSchema = compileNodiaAiToolSchema({ sourceJson: commonSource, definition: 'ToolObservation', sha256: knowledgeHash(commonSource) });
  const originalBusiness = BusinessRead.prototype.execute;
  const originalAiSettings = AiSettingsRead.prototype.execute;
  BusinessRead.prototype.execute = async () => { businessHandlerCalls++; throw Error('Observation must not execute a business handler'); };
  AiSettingsRead.prototype.execute = async () => { aiSettingsHandlerCalls++; throw Error('Observation must not execute an AI Settings handler'); };
  restoreBusiness = () => { BusinessRead.prototype.execute = originalBusiness; };
  restoreAiSettings = () => { AiSettingsRead.prototype.execute = originalAiSettings; };
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), Observation,
  ] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  builder.overrideProvider(Adapter).useValue({
    async observe() { providerObservations++; throw Error('Observation must not probe providers'); },
    async execute() { providerExecutions++; throw Error('Observation must not infer'); },
    async verifyConfiguration() { throw Error('Observation must not verify provider configuration'); },
  });
  const compiled = await builder.compile();
  const registry = compiled.get(Registry), policy = compiled.get(Policy);
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException();
    request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId };
    return true;
  } });
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1/nodia-ai`;
  async function request(path, { actor = '1', method = 'GET', body, status = 200 } = {}) {
    const response = await fetch(base + path, { method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.equal(response.status, status, JSON.stringify(value));
    if (method === 'GET' && status === 200) assert.equal(response.headers.get('cache-control'), 'no-store');
    return value;
  }
  const destinations = new Map();
  for (const [key, route] of [['businesses', '/business'], ['ai_providers', '/ai-providers']]) {
    let [module] = await db.query('SELECT id FROM modules WHERE link=$1', [route]);
    if (!module) [module] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,$2 FROM modules WHERE key='nodia_ai' RETURNING id", [route, `ai16_${key}`]);
    destinations.set(route, module.id);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [module.id]);
  }
  const [role] = await db.query("INSERT INTO roles(key) VALUES('synthetic_ai16_reader') RETURNING id");
  await db.query("INSERT INTO actions(key) VALUES('ai:manage') ON CONFLICT(key) DO NOTHING");
  await db.query("INSERT INTO role_actions(role_id,action_id) SELECT $1,id FROM actions WHERE key='ai:manage'", [role.id]);
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES(1,$1)', [role.id]);
  const [connection] = await db.query("INSERT INTO ai_providers(catalog_id,name,fields,use_agentic) SELECT id,'Synthetic AI16 only','{}',true FROM ai_provider_catalog WHERE key='gemini' RETURNING id");
  const chat = await request('/conversations', { method: 'POST', status: 201, body: { client_request_id: randomUUID() } });
  const selection = { connection_id: connection.id, mode: 'agentic', model_id: 'synthetic-ai16-no-inference', effort_id: null };
  const budget = { schema_version: 1, tool_calls: policy.budget.tool_calls_per_run, mcp_rpc_messages: policy.budget.mcp_rpc_messages_per_run,
    provider_dispatches: policy.budget.provider_dispatches_per_run, compactions: policy.budget.compactions_per_run, delegations: policy.budget.delegations_per_run };
  let messageSeq = 0;
  async function seedRun() {
    const id = randomUUID(), userMessage = randomUUID(), assistantMessage = randomUUID();
    const userSeq = String(++messageSeq), assistantSeq = String(++messageSeq);
    for (const [messageId, seq, messageRole, author] of [[userMessage, userSeq, 'user', '1'], [assistantMessage, assistantSeq, 'assistant', null]]) {
      await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash)
        VALUES($1,$2,$3,$4,$5,$6,'sealed','{"schema_version":1,"module_routes":[]}',clock_timestamp(),$7)`,
      [messageId, chat.conversation_id, seq, messageRole, author, author ? randomUUID() : null, author ? 'd'.repeat(64) : null]);
      await db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','Synthetic AI16 fixture content')", [messageId, chat.conversation_id]);
    }
    await db.query(`INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,assistant_message_id,connection_id,selection_snapshot,catalog_version,policy_version,policy_hash,input_through_seq,state,phase,deadline_at,completed_at,retention_epoch,context_manifest,routing_snapshot,budget_snapshot)
      VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,'completed','completed',clock_timestamp()+interval '10 minutes',clock_timestamp(),1,'{}',$11,$12)`,
    [id, chat.conversation_id, userMessage, assistantMessage, connection.id, selection, registry.catalogVersion, policy.policyVersion, policy.policyHash, userSeq, chat.routing, budget]);
    await db.query('UPDATE nodia_ai_conversations SET next_message_seq=$2 WHERE id=$1', [chat.conversation_id, assistantSeq]);
    return { id, userMessage, assistantMessage };
  }
  const run = await seedRun();
  const [business] = await db.query("INSERT INTO businesses(name,owner_id) VALUES('Synthetic AI16 shared business',2) RETURNING id,name,owner_id::text,is_active,has_description,created_at,updated_at");
  await db.query("INSERT INTO business_collaborators(business_id,user_id,action_ids) VALUES($1,1,'{}')", [business.id]);
  const businessOutput = { data: [{ ...business, translates: [], created_at: business.created_at.toISOString(), updated_at: business.updated_at.toISOString() }], meta: { page: 1, limit: 25, total_items: 1, total_pages: 1 } };
  const emptyMetadata = { data: [], meta: { page: 1, limit: 25, total_items: 0, total_pages: 0 } };
  async function seedReceipt(name, args, result, route) {
    const tool = registry.get(name); assert.ok(tool, `Missing actual registered ${name}`);
    registry.validateInput(tool, args); registry.validateOutput(tool, result);
    const id = randomUUID();
    await db.query(`INSERT INTO nodia_ai_tool_calls(id,conversation_id,run_id,adapter_call_id,tool_name,contract_hash,arguments_hash,arguments,public_result,scope_manifest,state,completed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed',clock_timestamp())`,
    [id, chat.conversation_id, run.id, randomUUID(), name, tool.contractHash, knowledgeHash(canonicalKnowledge(args)), args, result,
      { schema_version: 1, module_routes: [route], authority_hash: 'e'.repeat(64) }]);
    return { id, tool_name: name, contract_hash: tool.contractHash };
  }
  const businessRef = await seedReceipt('nodia_businesses_list', {}, businessOutput, '/business');
  const settingsRef = await seedReceipt('nodia_ai_providers_list', {}, emptyMetadata, '/ai-providers');
  let eventSeq = 9007199254740992n;
  async function seedEvent(kind, payload, routes = []) {
    const id = randomUUID(), seq = String(++eventSeq);
    await db.query(`INSERT INTO nodia_ai_events(id,conversation_id,run_id,seq,event_key,public_payload,scope_manifest)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [id, chat.conversation_id, run.id, seq, `synthetic:${id}`, { kind, payload }, { schema_version: 1, module_routes: routes }]);
    await db.query('UPDATE nodia_ai_conversations SET next_event_seq=$2 WHERE id=$1', [chat.conversation_id, seq]);
    return { id, seq };
  }
  const accepted = await seedEvent('run_accepted', { message_id: run.userMessage, run_revision: 1 });
  await seedEvent('tool_completed', { result_ref: { tool_call_id: businessRef.id, tool_name: businessRef.tool_name, contract_hash: businessRef.contract_hash }, state: 'completed', error: null }, ['/business']);
  await seedEvent('tool_completed', { result_ref: { tool_call_id: settingsRef.id, tool_name: settingsRef.tool_name, contract_hash: settingsRef.contract_hash }, state: 'completed', error: null }, ['/ai-providers']);
  await seedEvent('message_sealed', { message_id: run.assistantMessage, status: 'sealed' });
  const terminal = await seedEvent('run_changed', { revision: 1, state: 'completed', error: null });
  async function readCounters() {
    return (await db.query(`SELECT (SELECT count(*)::text FROM nodia_ai_messages) messages,(SELECT count(*)::text FROM nodia_ai_runs) runs,
      (SELECT count(*)::text FROM nodia_ai_jobs) jobs,(SELECT count(*)::text FROM nodia_ai_job_attempts) attempts,
      (SELECT count(*)::text FROM nodia_ai_tool_calls) calls,(SELECT count(*)::text FROM nodia_ai_events) events,
      (SELECT COALESCE(sum(tool_calls_used+provider_dispatches_used+mcp_rpc_messages_used),0)::text FROM nodia_ai_runs) budget`))[0];
  }
  const before = await readCounters();
  const resultPath = `/tool-calls/${businessRef.id}/result`, observationPath = `/tool-calls/${businessRef.id}/observation`, eventsPath = `/runs/${run.id}/events`;
  const exact = await request(resultPath);
  assert.deepEqual(exact, businessOutput);
  check('terminal receipt returns the exact domain schema, without metadata wrapper', !('result_ref' in exact));
  const observation = await request(observationPath);
  check('metadata uses the closed ToolObservation runtime schema', observationSchema.validate(observation));
  check('metadata carries the original receipt date and native source', observation.source.module_key === 'businesses' && observation.result_ref.contract_hash === businessRef.contract_hash && Number.isFinite(Date.parse(observation.observed_at)));
  check('verified business navigation targets the real native record', observation.navigation.some(item => item.kind === 'business_detail' && item.id === business.id && item.module_route === '/business'));
  check('metadata does not expose arguments, full output or provider secrets', !('arguments' in observation) && !('result' in observation) && !JSON.stringify(observation).includes('fields'));
  check('known list counts retain their exact native values', observation.summary.total === 1 && observation.summary.returned === 1);
  const summary = await request(`/runs/${run.id}`);
  check('completed run can be observed without jobs, grants, lease or worker', summary.state === 'completed' && summary.run_id === run.id && before.jobs === '0');
  const first = await request(eventsPath + '?page_limit=1');
  check('event page is validated and preserves bigint sequence above JS precision', eventSchema.validate(first) && first.items[0].seq === accepted.seq && first.has_more === true);
  const otherDevice = await request(eventsPath + '?page_limit=1');
  check('independent devices see the same immutable event without a global delivery flag', otherDevice.items[0].event_id === first.items[0].event_id && otherDevice.next_cursor === first.next_cursor);
  let page = first;
  const ids = page.items.map(item => item.event_id);
  while (page.has_more) { page = await request(eventsPath + '?page_limit=1&cursor=' + encodeURIComponent(page.next_cursor)); ids.push(...page.items.map(item => item.event_id)); }
  check('paging traverses all actual transitions with unique event IDs', ids.length === 5 && new Set(ids).size === 5 && page.items[0].seq === terminal.seq);
  const tail = await request(eventsPath + '?cursor=' + encodeURIComponent(page.next_cursor));
  check('empty polling retains the observer checkpoint and does not replay the final event', tail.items.length === 0 && tail.next_cursor === page.next_cursor && tail.has_more === false);
  await request(eventsPath + '?all=true', { status: 400 });
  await request(eventsPath + '?page_limit=101', { status: 400 });
  await request(eventsPath + '?cursor=not-valid-json', { status: 400 });
  check('event query rejects unknown fields, excess limits and invalid cursors', true);
  const future = JSON.parse(Buffer.from(tail.next_cursor, 'base64url').toString('utf8')); future.position[0] = String(eventSeq + 1n);
  await request(eventsPath + '?cursor=' + Buffer.from(JSON.stringify(future)).toString('base64url'), { status: 400 });
  check('a forged future sequence is rejected rather than skipping unseen results', true);
  await request(resultPath, { actor: 'missing', status: 401 });
  await request(observationPath, { actor: '2', status: 404 });
  await request(eventsPath, { actor: '2', status: 404 });
  check('anonymous and ordinary foreign access cannot observe a private chat', true);
  await request(observationPath, { actor: '3' });
  const [audit] = await db.query("SELECT count(*)::integer AS count FROM nodia_ai_audit_events WHERE actor_id=3 AND conversation_id=$1 AND event_key='conversation.inspected'", [chat.conversation_id]);
  check('super_admin can inspect without destination assignment and the inspection is audited', audit.count > 0);

  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [destinations.get('/business')]);
  await request(resultPath, { status: 403 });
  const moduleReset = await request(eventsPath + '?cursor=' + encodeURIComponent(tail.next_cursor));
  check('destination revocation denies stored results and explicitly resets cursor visibility', moduleReset.cursor_state === 'reset_required' && moduleReset.items.length === 0);
  const restricted = await request(eventsPath);
  check('revoked destination tool references are omitted, not exposed as stale allowed data', !restricted.items.some(item => item.kind === 'tool_completed' && item.payload.result_ref.tool_call_id === businessRef.id));
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [destinations.get('/business')]);
  await request(observationPath);
  check('restoring the actual module restores authorized observation without executing the tool', true);

  await db.query("DELETE FROM role_actions WHERE role_id=$1 AND action_id=(SELECT id FROM actions WHERE key='ai:manage')", [role.id]);
  await request(`/tool-calls/${settingsRef.id}/result`, { status: 403 });
  const actionRestricted = await request(eventsPath);
  check('existing ai:manage action is rechecked for cached results and event refs', !actionRestricted.items.some(item => item.kind === 'tool_completed' && item.payload.result_ref.tool_call_id === settingsRef.id));
  await db.query("INSERT INTO role_actions(role_id,action_id) SELECT $1,id FROM actions WHERE key='ai:manage'", [role.id]);

  await db.query('UPDATE business_collaborators SET is_active=false WHERE business_id=$1 AND user_id=1', [business.id]);
  await request(observationPath, { status: 403 });
  const collaboratorReset = await request(eventsPath + '?cursor=' + encodeURIComponent(tail.next_cursor));
  check('native collaborator revocation invalidates old results and the observer visibility', collaboratorReset.cursor_state === 'reset_required');
  await db.query('UPDATE business_collaborators SET is_active=true WHERE business_id=$1 AND user_id=1', [business.id]);
  await request(observationPath);
  check('current native membership is reauthorized before recovering the same receipt', true);
  const fresh = { userId: '1', sessionId: randomUUID() };
  await db.query("INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,1,'synthetic-ai16-fresh',clock_timestamp()+interval '1 hour')", [fresh.sessionId]);
  identities.set('fresh', fresh);
  await request(observationPath, { actor: 'fresh' });
  await request(eventsPath + '?cursor=' + encodeURIComponent(tail.next_cursor), { actor: 'fresh', status: 400 });
  check('new valid session reads completed results but cannot reuse the old session cursor', true);
  await db.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1', [identities.get('1').sessionId]);
  await request(resultPath, { status: 401 });
  await request(observationPath, { actor: 'fresh' });
  check('logout of the dispatch-era session blocks it without losing the new session result', true);
  check('all observation GETs preserve rows, admissions, tool results and durable budgets', JSON.stringify(await readCounters()) === JSON.stringify(before));

  const emptyRun = await seedRun();
  const empty = await request(`/runs/${emptyRun.id}/events`, { actor: 'fresh' });
  check('a historical or empty run gets an explicit empty durable feed and a checkpoint', empty.items.length === 0 && empty.cursor_state === 'current' && typeof empty.next_cursor === 'string');
  await request(`/runs/${emptyRun.id}/events?cursor=${encodeURIComponent(tail.next_cursor)}`, { actor: 'fresh', status: 400 });
  check('cursor is tied to the requested run as well as actor and session', true);
  await db.query('UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval \'1 second\' WHERE id=$1', [chat.conversation_id]);
  await request(observationPath, { actor: 'fresh', status: 410 });
  await request(eventsPath, { actor: 'fresh', status: 410 });
  await request(resultPath, { actor: '3', status: 404 });
  check('expired own content is denied before sweeping and expired foreign inspection stays hidden', true);
  await db.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [chat.conversation_id]);
  await request(resultPath, { actor: 'fresh', status: 404 });
  const [remaining] = await db.query('SELECT (SELECT count(*)::integer FROM nodia_ai_events) events,(SELECT count(*)::integer FROM nodia_ai_tool_calls) calls,(SELECT count(*)::integer FROM nodia_ai_runs) runs');
  check('chat purge removes event/result/run content through existing M1 cascade', remaining.events === 0 && remaining.calls === 0 && remaining.runs === 0);
  check('no observation executes provider, MCP or native business/AI settings handlers', providerObservations === 0 && providerExecutions === 0 && businessHandlerCalls === 0 && aiSettingsHandlerCalls === 0);
  console.log(JSON.stringify({ stage: 'AI-16', scope: 'compiled_http_disposable_postgresql_synthetic_receipts_no_provider', checks: checks.length, passed: checks,
    provider_observations: providerObservations, provider_executions: providerExecutions, business_handler_calls: businessHandlerCalls, ai_settings_handler_calls: aiSettingsHandlerCalls }, null, 2));
} finally {
  restoreBusiness?.(); restoreAiSettings?.();
  if (app) await app.close();
  await fixture.close();
}
