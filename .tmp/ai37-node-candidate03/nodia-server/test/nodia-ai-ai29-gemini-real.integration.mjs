// Explicit opt-in: disposable SQL/HTTP confirmation with the existing private Gemini session.
// No credentials, challenges, frames, account identifiers or provider payloads are printed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

assert.equal(process.env.NODIA_AI29_REAL_GEMINI, '1', 'Explicit real-session opt-in required');
const upstream = new URL(process.env.GEMINI_MICROSERVICE_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(upstream.hostname));
assert.match(process.env.GEMINI_SERVICE_TOKEN ?? '', /^[0-9a-f]{64}$/i);
const realToken = process.env.GEMINI_SERVICE_TOKEN;
const fixture = await createNodiaAiIntegrationFixture('ai29');
const { db, options, identities } = fixture, identity = identities.get('3');
const checks = [], reports = [], calls = { start: 0, status: 0, cancel: 0, discovery: 0 };
const requestedModes = (process.env.NODIA_AI29_REAL_MODES ?? 'token_plan_web,token_plan_agentic').split(',');
assert.ok(requestedModes.length > 0 && requestedModes.length <= 2 && new Set(requestedModes).size === requestedModes.length && requestedModes.every(mode => ['token_plan_web', 'token_plan_agentic'].includes(mode)));
const reconciliationOnly = process.env.NODIA_AI29_REAL_RECONCILE_ONLY === 'yes';
assert.ok(process.env.NODIA_AI29_REAL_RECONCILE_ONLY === undefined || reconciliationOnly);
if (reconciliationOnly) assert.ok(requestedModes.length === 1 && requestedModes[0] === 'token_plan_web' && process.env.NODIA_AI29_REAL_RESTART === 'yes');
const tracked = new Map(); let nativeBridge;
let proxy, app, compiled, dropNextStart = false, dropped = 0;
let nativeRestarts = 0;
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
try {
  proxy = createServer(async (request, response) => {
    try {
      assert.ok(!/logout|analyze|chat|generate/i.test(request.url));
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const headers = Object.fromEntries(['x-nodia-actor-id', 'x-nodia-provider-id', 'x-nodia-login-expires-at', 'content-type']
        .filter(key => request.headers[key] !== undefined).map(key => [key, request.headers[key]]));
      headers['X-Nodia-Service-Token'] = realToken;
      const isStart = request.method === 'POST' && /\/requests\/[0-9a-f-]+$/.test(request.url);
      if (isStart) calls.start++;
      else if (request.url.endsWith('/cancel')) calls.cancel++;
      else if (/\/login\//.test(request.url)) calls.status++;
      else calls.discovery++;
      const remote = await fetch(new URL(request.url, upstream), { method: request.method, headers,
        ...(request.method === 'POST' && chunks.length ? { body: Buffer.concat(chunks) } : {}), signal: AbortSignal.timeout(30_000) });
      const bytes = new Uint8Array(await remote.arrayBuffer());
      if (isStart && dropNextStart && remote.ok) {
        dropNextStart = false; dropped++;
        response.writeHead(503, { 'content-type': 'application/json' }); response.end('{}'); return;
      }
      response.writeHead(remote.status, { 'content-type': remote.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' });
      response.end(bytes);
    } catch { response.writeHead(502); response.end(); }
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  process.env.GEMINI_MICROSERVICE_URL = `http://127.0.0.1:${proxy.address().port}`;
  const names = [
    ['nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'],
    ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['finance-overview/finance-overview.module', 'FinanceOverviewModule'],
    ['nodia-ai-secure-flow/nodia-ai-secure-flow.module', 'NodiaAiSecureFlowModule'],
    ['ai-provider/ai-provider.module', 'AiProviderModule'],
  ];
  const imports = await Promise.all(names.map(([file, name]) => loadAi(file, name)));
  const Redis = await loadAi('common/redis/redis.service', 'RedisService');
  const Adapter = await loadAi('nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort');
  compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), ...imports] })
    .overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [], delByPattern: async () => {} })
    .overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(key => [key, async () => { throw Error('Inference forbidden in secure-flow acceptance'); }])))
    .compile();
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  const Filter = await loadAi('common/filters/all-exceptions.filter', 'AllExceptionsFilter');
  app.useGlobalFilters(new Filter());
  app.useGlobalGuards({ canActivate(context) { context.switchToHttp().getRequest().auth = { user: { id: identity.userId }, sessionId: identity.sessionId }; return true; } });
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1`;
  const Prepare = await loadAi('nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase');
  const Run = await loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase');
  const Bridge = await loadAi('ai-provider/use-case/manage-ai-provider-secure-session.use-case', 'ManageAiProviderSecureSessionUseCase');
  const bridge = compiled.get(Bridge); nativeBridge = bridge;
  const [catalog] = await db.query("INSERT INTO ai_provider_catalog(key,name,can_use_token_plan_web,can_use_token_plan_agentic) VALUES('gemini','Real-session verification only',true,true) ON CONFLICT(key) DO UPDATE SET is_active=true,can_use_token_plan_web=true,can_use_token_plan_agentic=true RETURNING id::text");
  const [provider] = await db.query("INSERT INTO ai_providers(catalog_id,name,use_token_plan_web,use_token_plan_agentic,default_mode) VALUES($1,'AI29 disposable real-session target',true,true,'token_plan_web') RETURNING id::text", [catalog.id]);
  const [group] = await db.query("SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'");
  await db.query("INSERT INTO modules(key,link,module_group_id) SELECT 'ai29_verification_providers','/settings/ai-providers',$1 WHERE NOT EXISTS(SELECT 1 FROM modules WHERE link='/settings/ai-providers')", [group.id]);
  async function http(path, body, expected = 200) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `HTTP status ${response.status} for ${path} (payload intentionally omitted)`);
    if (path.includes('/secure-flow')) assert.equal(response.headers.get('cache-control'), 'no-store');
    return result;
  }
  async function pause(kind, mode) {
    const chat = randomUUID();
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'AI29 real-session disposable verification',clock_timestamp()+interval '90 days')", [chat, identity.userId, randomUUID(), 'a'.repeat(64)]);
    const prepared = await db.transaction(manager => compiled.get(Prepare).execute(manager, identity, { conversationId: chat,
      toolName: kind === 'connection_login' ? 'nodia_secure_flows_prepare_connection_login' : 'nodia_ai_providers_prepare_sync_models', partial: { provider_id: provider.id, mode } }));
    assert.equal(prepared.status, 'ready');
    const p = prepared.proposal;
    const challenge = await http(`/nodia-ai/proposals/${p.proposal_id}/confirmation-challenge`, { proposal_revision: p.revision, expected_hash: p.hash });
    const admitted = await http(`/nodia-ai/proposals/${p.proposal_id}/confirm`, { client_request_id: randomUUID(), proposal_revision: p.revision, expected_hash: p.hash, confirmation_token: challenge.confirmation_token }, 202);
    assert.equal(await compiled.get(Run).execute(randomUUID(), new AbortController().signal), true);
    const id = admitted.execution.execution_id, detail = await http(`/nodia-ai/operations/${id}/secure-flow`);
    if (kind === 'connection_login') {
      const [step] = await db.query('SELECT native_request_key FROM nodia_ai_execution_steps WHERE execution_id=$1', [id]);
      tracked.set(step.native_request_key, { provider_id: provider.id, provider_key: 'gemini', mode, request_id: step.native_request_key });
    }
    check(`${kind}/${mode}: exact HTTP confirmation and SQL worker pause`, detail.flow.status === 'waiting');
    return { id, ...detail };
  }
  async function action(flow, name, expected = 200) {
    const result = await http(`/nodia-ai/operations/${flow.id}/secure-flow/${flow.flow.reference}/${name}`, { expected_execution_revision: flow.flow.revision, client_request_id: randomUUID() }, expected);
    if (result.flow) flow.flow = result.flow;
    return result;
  }
  async function restartAndObserve(interrupted, startsBefore) {
    assert.equal(process.platform, 'linux');
    // Exact existing private-lab unit. Caller first proves this request was admitted.
    await promisify(execFile)('/usr/bin/systemctl', ['restart', 'nodia-gemini-lab'], {
      timeout: 120_000, maxBuffer: 8192, env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin' },
    });
    nativeRestarts++;
    const readyDeadline = Date.now() + 45_000;
    let ready = false;
    while (Date.now() < readyDeadline) {
      try {
        const health = await fetch(new URL('/health', upstream), {
          headers: { 'X-Nodia-Service-Token': realToken }, signal: AbortSignal.timeout(2000),
        });
        if (health.ok) { ready = true; break; }
      } catch { /* Readiness only; no login is resent. */ }
      await delay(250);
    }
    check('real restarted native HTTP service becomes ready without redispatch', ready);
    const observed = await action(interrupted, 'status');
    check('real Docker restart reconciles the exact prior request using host-certified kernel closure', ['completed', 'cancelled'].includes(observed.flow.status));
    check('native container restart never redispatches the interrupted login', calls.start === startsBefore + 1);
  }
  for (const mode of requestedModes) {
    // The never-admitted request is fenced; no login or logout is necessary for this check.
    const requestId = randomUUID(), target = { provider_id: provider.id, provider_key: 'gemini', mode, request_id: requestId };
    tracked.set(requestId, target);
    const cancelled = await bridge.cancelRequest(target, identity.userId);
    check(`${mode}: cancel-before-start obtains native terminal fence`, cancelled.state === 'cancelled');
    const delayed = await bridge.start(provider.id, mode, identity, requestId, new Date(Date.now() + 290_000).toISOString());
    check(`${mode}: delayed start cannot bypass native cancellation`, delayed.state === 'cancelled');

    const pending = await pause('connection_login', mode);
    await action(pending, 'start');
    if (pending.flow.status === 'pending') await action(pending, 'cancel');
    check(`${mode}: real native cancellation is reconciled in SQL`, ['cancelled', 'completed'].includes(pending.flow.status));

    // Proxy loses only the initial response; the actual Gemini adapter still accepts the request.
    const lost = await pause('connection_login', mode), startsBefore = calls.start;
    dropNextStart = true;
    await action(lost, 'start', 503);
    Object.assign(lost, await http(`/nodia-ai/operations/${lost.id}/secure-flow`));
    check(`${mode}: lost initial native response stays uncertain`, lost.flow.status === 'unknown');
    if (reconciliationOnly) {
      // An anonymous browser can prove closure, never authentication or model discovery.
      await restartAndObserve(lost, startsBefore);
      reports.push({ mode, authentication_observed: false, discovered_model_count: null, native_reconciliation_verified: true });
      continue;
    }
    let succeeded = false;
    for (let attempt = 0; attempt < 220; attempt++) {
      const result = await action(lost, 'status', [200, 409]);
      if (!result.flow) { Object.assign(lost, await http(`/nodia-ai/operations/${lost.id}/secure-flow`)); await delay(1000); continue; }
      if (result.flow.status === 'completed') { succeeded = true; break; }
      if (['failed', 'cancelled', 'expired'].includes(result.flow.status)) break;
      // Never print authorization URL/code/frame. A real human challenge requires the secure UI.
      if (result.interaction?.data?.state === 'waiting_code') break;
      await delay(1000);
    }
    if (!succeeded && lost.flow.status === 'pending') await action(lost, 'cancel');
    check(`${mode}: recovery observes the same request without redispatch`, calls.start === startsBefore + 1);
    check(`${mode}: existing real account completes authentication`, succeeded);
    const [step] = await db.query('SELECT minimal_receipt,recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1', [lost.id]);
    check(`${mode}: observed success produces only minimal SQL receipt`, step.minimal_receipt?.resource_key === 'secure_flows' && Object.keys(step.minimal_receipt).length === 4);

    const sync = await pause('sync_models', mode);
    await action(sync, 'sync');
    const [current] = await db.query('SELECT fields FROM ai_providers WHERE id=$1', [provider.id]);
    const models = current.fields?.[mode]?.available_models;
    check(`${mode}: real discovery commits metadata and receipt atomically`, sync.flow.status === 'completed' && Array.isArray(models) && models.length > 0);
    check(`${mode}: discovery does not invent a selected model`, !current.fields?.[mode]?.selected_model);
    reports.push({ mode, authentication_observed: succeeded, discovered_model_count: models.length });
    if (mode === 'token_plan_web' && process.env.NODIA_AI29_REAL_RESTART === 'yes') {
      const interrupted = await pause('connection_login', mode), before = calls.start;
      dropNextStart = true;
      await action(interrupted, 'start', 503);
      Object.assign(interrupted, await http(`/nodia-ai/operations/${interrupted.id}/secure-flow`));
      await restartAndObserve(interrupted, before);
    }
  }
  const [stored] = await db.query("SELECT string_agg(row_to_json(s)::text,'') AS content FROM nodia_ai_execution_steps s");
  check('durable SQL records exclude credential and challenge fields', !/authorization_url|verificationUrl|userCode|secret_ciphertext|refresh_token|data:image/.test(stored.content));
  check('response-loss injection exercised every requested real engine', dropped === requestedModes.length + (reconciliationOnly ? 0 : nativeRestarts));
  console.log(JSON.stringify({ stage: 'AI-29-R01', scope: reconciliationOnly ? 'disposable_postgresql_real_private_web_cancellation_and_restart_only' : 'disposable_postgresql_real_private_gemini_login_and_model_discovery', authentication_acceptance_requested: !reconciliationOnly, observed_at_utc: new Date().toISOString(), checks: checks.length, passed: checks, reports, native_http: calls, dropped_initial_responses: dropped,
    native_container_restarts: nativeRestarts, provider_transport_mocked: false, inference_requested: false, existing_account_logout: false, configured_database_written: false, credentials_or_challenges_recorded: false }, null, 2));
} finally {
  let cleanupFailures = 0;
  if (nativeBridge) for (const target of tracked.values()) {
    try {
      const result = await nativeBridge.cancelRequest(target, identity.userId);
      if (['completed', 'cancelled', 'failed', 'expired'].includes(result.state)) await nativeBridge.acknowledgeRequest(target, identity.userId);
      else cleanupFailures++;
    } catch { cleanupFailures++; }
  }
  if (app) await app.close(); else if (compiled) await compiled.close();
  if (proxy) await new Promise(resolve => proxy.close(resolve));
  await fixture.close();
  if (cleanupFailures) { console.error(JSON.stringify({ stage: 'AI-29-R01', native_cleanup_failures: cleanupFailures, payloads_omitted: true })); process.exitCode = 1; }
}
