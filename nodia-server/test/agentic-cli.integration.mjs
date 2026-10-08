import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';

// Persistence/auth boundaries are synthetic. --live-cli replaces ONLY the
// upstream HTTP fixture with our real adapter and the explicitly selected CLI.
// Never load .env, connect to the configured DB, write invoices or use Web/API.
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL('./not-an-env-file', import.meta.url));
process.env.GEMINI_SERVICE_TOKEN = randomBytes(32).toString('hex');
for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']) process.env[key] = 'synthetic-unused';
const live = process.argv.includes('--live-cli');
let child, upstream, app;
const usage = { 'fixture-window': { usage_percentage: 0, remaining: null, total: null } };
let model = 'fixture-live-model', upstreamCalls = [], upstreamFailure = null;
const actor = '9007199254740993'; // PostgreSQL users.id, preserved without Number coercion.
let permissionAllowed = true, loginJob = null, loginOwner = null;
const invoiceResult = { code: 'POC-0710', total_amount: 7500, data: { issue_date: '2026-10-07', items: [
  { code: 'NDA-728', name: 'CUADERNO AZUL', quantity: 3, unit_price: 2500, total_price: 7500 },
] } };
const agenticStatus = () => ({ engine: 'agentic', available: true, has_active_session: true,
  models: [{ id: model, name: 'Synthetic live model' }], quota: usage,
  quota_source: 'agentic_cli', quota_observed_at: Date.now() / 1000 });
try {
  if (live) {
    assert(process.env.ANTIGRAVITY_CLI_PATH && process.env.ANTIGRAVITY_CLI_SHA512 && process.env.ANTIGRAVITY_CLI_HOME);
    const python = fileURLToPath(new URL('../../nodia-gemini-microservice/.venv/Scripts/python.exe', import.meta.url));
    const probe = fileURLToPath(new URL('../../nodia-gemini-microservice/scripts/agentic_http_probe.py', import.meta.url));
    child = spawn(process.env.PROBE_PYTHON || python, ['-u', probe], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stderr.resume(); // Never print provider/process diagnostics or block its pipe.
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('HTTP probe did not announce its port')), 20000);
      child.on('error', reject);
      child.once('exit', () => { clearTimeout(timer); reject(new Error('HTTP probe exited')); });
      child.stdout.on('data', (chunk) => { const match = String(chunk).match(/PROBE_PORT=(\d+)/); if (match) { clearTimeout(timer); resolve(Number(match[1])); } });
    });
    process.env.GEMINI_MICROSERVICE_URL = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch(`${process.env.GEMINI_MICROSERVICE_URL}/health`, { signal: AbortSignal.timeout(1000) })).ok; }
      catch { /* startup is bounded and non-generative */ }
      if (ready) break;
      await delay(250);
    }
    assert(ready, 'live adapter startup failed');
  } else {
    upstream = createServer(async (req, res) => {
      if (req.url !== '/health' && req.headers['x-nodia-service-token'] !== process.env.GEMINI_SERVICE_TOKEN) { res.writeHead(401).end(); return; }
      upstreamCalls.push(req.url);
      const body = [];
      for await (const chunk of req) { body.push(chunk); }
      if (req.url.startsWith('/agentic/auth/login/')) {
        const owner = req.headers['x-nodia-actor-id'];
        assert.equal(owner, actor, 'actor is derived from the authenticated session');
        const parts = req.url.split('/');
        if (parts[4] === 'start') {
          loginOwner = owner;
          loginJob = { id: 'cd'.repeat(16), state: 'running', authorization_url: null, reason: null };
        } else if (parts[4] !== 'current' && (!loginJob || parts[4] !== loginJob.id || owner !== loginOwner)) {
          res.writeHead(404).end(); return;
        } else if (parts[5] === 'code') {
          assert.deepEqual(JSON.parse(Buffer.concat(body).toString()), { code: '4/synthetic-code' });
          loginJob.state = 'verifying';
        } else if (parts[5] === 'cancel') loginJob.state = 'cancelled';
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(
          parts[4] === 'current' && !['running', 'waiting_code', 'verifying'].includes(loginJob?.state) ? null : loginJob));
        return;
      }
      if (req.url === '/agentic/analyze-invoice' && upstreamFailure) {
        res.writeHead(upstreamFailure.status, { 'Content-Type': 'application/json',
          'X-Request-ID': 'ab'.repeat(16), 'X-Nodia-Error-Code': upstreamFailure.code })
          .end(JSON.stringify({ detail: 'private provider output' }));
        return;
      }
      const status = agenticStatus();
      const payload = req.url === '/engines/status' ? { default_engine: 'web', agentic: status, web: { authenticated: false } }
        : req.url === '/agentic/models' ? { ...status, authenticated: true }
        : req.url === '/agentic/analyze-invoice' ? invoiceResult : status;
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
    });
    upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
    process.env.GEMINI_MICROSERVICE_URL = `http://127.0.0.1:${upstream.address().port}`;
  }
  const [{ GeminiService }, { AiProviderController }, { InvoiceController }, { GetAiProvidersHealthUseCase },
    { GetSelectableModelsUseCase }, { SyncAiProviderModelsUseCase }, { GetGeminiEnginesUseCase },
    { AnalyzeInvoiceUseCase }, { VerifyIaProvidersUseCase }, { AuthGuard }, { AuthService },
    { AuthTokenService }, { AuthenticateRequestUseCase }, { ActionPermissionGuard }, { CheckActionPermissionUseCase },
    { ManageGeminiAgenticLoginUseCase }] = await Promise.all([
    import('../dist/common/ai/gemini.service.js'), import('../dist/ai-provider/ai-provider.controller.js'), import('../dist/invoice/invoice.controller.js'),
    import('../dist/ai-provider/use-case/get-ai-providers-health.use-case.js'), import('../dist/ai-provider/use-case/get-selectable-models.use-case.js'),
    import('../dist/ai-provider/use-case/sync-ai-provider-models.use-case.js'), import('../dist/ai-provider/use-case/get-gemini-engines.use-case.js'),
    import('../dist/invoice/use-case/analyze-invoice.use-case.js'), import('../dist/invoice/use-case/verify-ia-providers.use-case.js'),
    import('../dist/auth/auth.guard.js'), import('../dist/auth/auth.service.js'), import('../dist/auth/auth-token.service.js'),
    import('../dist/auth/use-case/authenticate-request.use-case.js'), import('../dist/authorization/action-permission.guard.js'),
    import('../dist/authorization/use-case/check-action-permission.use-case.js'),
    import('../dist/ai-provider/use-case/manage-gemini-agentic-login.use-case.js'),
  ]);
  const gemini = new GeminiService();
  if (live) {
    const discovered = await gemini.getModelsAndQuota('agentic');
    if (!discovered.authenticated) {
      const stateResponse = await fetch(`${process.env.GEMINI_MICROSERVICE_URL}/agentic/status`, { headers: { 'X-Nodia-Service-Token': process.env.GEMINI_SERVICE_TOKEN } });
      const state = await stateResponse.json();
      assert.fail(`live CLI session is not authenticated: available=${state.available}, reason=${state.reason}`);
    }
    assert(discovered.models.some((m) => m.id === process.env.PROBE_MODEL), 'choose an exact discovered PROBE_MODEL');
    model = process.env.PROBE_MODEL;
  }
  const provider = { id: '42', key: 'gemini', name: 'Synthetic Agentic connection', is_active: true,
    is_default: true, use_api_key: false, use_token_plan_web: false, use_token_plan_agentic: true,
    default_mode: 'token_plan_agentic', catalog: { key: 'gemini', can_use_token_plan_agentic: true },
    fields: { token_plan_agentic: { selected_model: model, thinking_levels: { [model]: 'low' } },
      token_plan_web: { selected_model: 'synthetic-web-preserved' }, api_key: { selected_model: 'synthetic-api-preserved' } } };
  let updates = 0;
  const repository = { async findAllProviders() { return { data: [structuredClone(provider)] }; },
    async findProviderById(id) { assert.equal(id, '42'); return structuredClone(provider); },
    async updateProviderFields(id, fields) { assert.equal(id, '42'); updates++; provider.fields = fields; } };
  const implementations = [
    [GetAiProvidersHealthUseCase, new GetAiProvidersHealthUseCase(repository, gemini)],
    [GetSelectableModelsUseCase, new GetSelectableModelsUseCase(repository, gemini)],
    [SyncAiProviderModelsUseCase, new SyncAiProviderModelsUseCase(repository, gemini)],
    [GetGeminiEnginesUseCase, new GetGeminiEnginesUseCase(gemini)],
    [AnalyzeInvoiceUseCase, new AnalyzeInvoiceUseCase(gemini, {}, {}, repository)],
    [VerifyIaProvidersUseCase, new VerifyIaProvidersUseCase(gemini, repository)],
    [ManageGeminiAgenticLoginUseCase, new ManageGeminiAgenticLoginUseCase(gemini)],
  ];
  const active = new Map(implementations);
  const providers = [...new Set([AiProviderController, InvoiceController].flatMap((controller) => Reflect.getMetadata('design:paramtypes', controller)))];
  class ProbeModule {}
  Module({ controllers: [AiProviderController, InvoiceController], providers: [
    ...providers.map((provide) => ({ provide, useValue: active.get(provide) || { execute() { throw new Error('Unexpected mutation'); } } })),
    AuthenticateRequestUseCase, CheckActionPermissionUseCase,
    { provide: DataSource, useValue: { async query() { return [{ allowed: permissionAllowed }]; } } },
    { provide: AuthService, useValue: { async findActiveSession() { return { public_id: 'synthetic-session' }; },
      async findUser() { return { id: actor, name: 'Synthetic user', email: 'probe@example.test', roles: [], modules: [] }; } } },
    { provide: AuthTokenService, useValue: { async verify(token) { assert.equal(token, 'synthetic-session'); return { sub: actor, sid: token }; } } },
    { provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_GUARD, useClass: ActionPermissionGuard },
  ] })(ProbeModule);
  app = await NestFactory.create(ProbeModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  const { AllExceptionsFilter } = await import('../dist/common/filters/all-exceptions.filter.js');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1`, headers = { Authorization: 'Bearer synthetic-session' };
  const get = async (path) => { const response = await fetch(base + path, { headers }); assert.equal(response.status, 200, path); return response.json(); };
  if (!live) for (const resource of ['ai-provider', 'ai-providers']) {
    const loginBase = `${base}/${resource}/gemini-agentic-login`;
    const post = (suffix, body) => fetch(loginBase + suffix, { method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    assert.equal((await fetch(loginBase + '/start', { method: 'POST' })).status, 401);
    permissionAllowed = false;
    const beforeDenied = upstreamCalls.length;
    assert.equal((await post('/start')).status, 403);
    assert.equal(upstreamCalls.length, beforeDenied);
    permissionAllowed = true;
    assert.deepEqual(await get(`/${resource}/gemini-agentic-login/current`), { job: null });
    const started = await post('/start');
    assert.equal(started.status, 201); assert.equal(started.headers.get('cache-control'), 'no-store');
    const job = await started.json();
    assert.equal((await get(`/${resource}/gemini-agentic-login/${job.id}`)).state, 'running');
    assert.equal((await get(`/${resource}/gemini-agentic-login/current`)).job.id, job.id);
    const beforeInvalid = upstreamCalls.length;
    for (const body of [{ code: 'bad' }, { code: '4/synthetic-code', actor_id: 'untrusted' }]) {
      assert.equal((await post(`/${job.id}/code`, body)).status, 400);
    }
    assert.equal((await post('/invalid/code', { code: '4/synthetic-code' })).status, 400);
    assert.equal(upstreamCalls.length, beforeInvalid);
    const submitted = await post(`/${job.id}/code`, { code: '4/synthetic-code' });
    assert.equal(submitted.status, 201); assert.equal((await submitted.json()).state, 'verifying');
    assert.equal((await (await post(`/${job.id}/cancel`)).json()).state, 'cancelled');
    assert.deepEqual(await get(`/${resource}/gemini-agentic-login/current`), { job: null });
    assert.equal((await fetch(loginBase + '/' + 'ef'.repeat(16), { headers })).status, 404);
  }
  for (const resource of ['ai-provider', 'ai-providers']) {
    assert.equal((await fetch(`${base}/${resource}/health`)).status, 401);
    for (const alias of ['health', 'health-check', 'verify-all']) {
      const previousCalls = upstreamCalls.length;
      const health = await get(`/${resource}/${alias}`);
      assert.equal(health.providers[0].status, 'healthy');
      assert.equal(health.engines.agentic.available, true);
      assert.equal(health.engines.agentic.authenticated, true);
      assert.deepEqual(health.alerts, []);
      if (!live) assert.equal(upstreamCalls.slice(previousCalls).filter((path) => path === '/engines/status').length, 1);
    }
    for (const alias of ['gemini-engines', 'gemini/engines']) {
      const result = await get(`/${resource}/${alias}`); assert.equal(result.agentic.authenticated, true); assert.equal(result.web.authenticated, false);
      assert.equal(result.agentic.quota_source, 'agentic_cli');
      if (!live) assert.equal(result.agentic.quota['fixture-window'].usage_percentage, 0);
      assert(!JSON.stringify(result).includes(process.env.GEMINI_SERVICE_TOKEN));
    }
    for (const alias of ['models', 'selectable-models']) assert((await get(`/${resource}/${alias}?mode=token_plan_agentic&provider_id=42`))[0].models.some((m) => m.id === model));
  }
  const before = structuredClone(provider.fields);
  for (const persist of [false, true]) {
    const response = await fetch(`${base}/ai-providers/42/sync-models?mode=token_plan_agentic&persist=${persist}`, { method: 'POST', headers });
    assert.equal(response.status, 201); assert((await response.json()).models.some((m) => m.id === model));
    assert.equal(updates, persist ? 1 : 0);
  }
  assert.deepEqual(provider.fields.token_plan_web, before.token_plan_web); assert.deepEqual(provider.fields.api_key, before.api_key);
  for (const resource of ['invoice', 'invoices']) for (const alias of ['verify-ia-provider', 'verify-ia-providers']) {
    const verified = await get(`/${resource}/${alias}`); assert.equal(verified[0].can_use_model, true); assert.equal(verified[0].active_mode, 'token_plan_agentic');
  }
  const files = live ? [process.env.PROBE_PNG, process.env.PROBE_PDF] : [null];
  if (live) assert(files.every(Boolean), 'explicit synthetic PNG/PDF paths required');
  for (const path of files) {
    const mime = path?.endsWith('.png') ? 'image/png' : 'application/pdf';
    const form = new FormData(); form.append('file', new Blob([path ? await readFile(path) : Buffer.from('%PDF-1.4')], { type: mime }), mime === 'image/png' ? 'invoice.png' : 'invoice.pdf');
    for (const [key, value] of Object.entries({ business_id: '9601aa95-dd70-4af3-a5cf-50dd553a4ae9', ai_provider_id: '42', mode: 'token_plan_agentic', model, thinking_level: 'low' })) form.append(key, value);
    const response = await fetch(`${base}/invoices/analyze`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(360000) });
    const result = await response.json();
    assert.equal(response.status, 201, `analysis status ${response.status}, code=${result.code ?? 'none'}, message=${result.message ?? 'none'}`);
    assert.equal(result.code, 'POC-0710'); assert.equal(result.total_amount, 7500); assert.equal(result.data.items[0].quantity, 3);
    assert.equal(result.data.items[0].unit_price, 2500); assert.equal(result.data.items[0].total_price, 7500);
    assert(!JSON.stringify(result).includes(process.env.GEMINI_SERVICE_TOKEN));
  }
  if (!live) {
    assert(upstreamCalls.includes('/agentic/analyze-invoice') && !upstreamCalls.includes('/analyze-invoice'));
    for (const [status, code, expected] of [[504, 'analysis_timeout', 'analysis_timeout'],
      [504, 'agentic_timeout', 'agentic_timeout'],
      [504, 'provider_timeout', 'provider_timeout'], [502, 'provider_response_error', 'provider_response_error'],
      [504, 'private cause', undefined], [503, 'analysis_timeout', undefined]]) {
      upstreamFailure = { status, code };
      const form = new FormData();
      form.append('file', new Blob([Buffer.from('%PDF-1.4')], { type: 'application/pdf' }), 'synthetic.pdf');
      for (const [key, value] of Object.entries({ business_id: '9601aa95-dd70-4af3-a5cf-50dd553a4ae9',
        ai_provider_id: '42', mode: 'token_plan_agentic', model })) form.append(key, value);
      const beforeCalls = upstreamCalls.length;
      const response = await fetch(`${base}/invoices/analyze`, { method: 'POST', headers, body: form });
      const result = await response.json();
      assert.equal(response.status, status); assert.equal(result.error, 'GEMINI_UPSTREAM_ERROR');
      assert.equal(result.upstreamRequestId, 'ab'.repeat(16)); assert.equal(result.upstreamErrorCode, expected);
      assert.equal(upstreamCalls.length, beforeCalls + 1, 'uncertain analysis must not be retried');
      assert(!JSON.stringify(result).includes('private'));
    }
  }
  console.log(`Agentic HTTP integration passed (${live ? 'real CLI, synthetic documents' : 'isolated fixtures'}): aliases, auth, health, status, models, scoped sync, verify and analysis; Web offline; no production writes.`);
} finally {
  if (app) await app.close();
  if (upstream) await new Promise((resolve) => upstream.close(resolve));
  if (child && child.exitCode === null) {
    try { await fetch(`${process.env.GEMINI_MICROSERVICE_URL}/_probe/shutdown`, { method: 'POST',
      headers: { 'X-Nodia-Service-Token': process.env.GEMINI_SERVICE_TOKEN }, signal: AbortSignal.timeout(2000) }); }
    catch { /* failed startup requires process termination */ }
    const ended = once(child, 'exit');
    const graceful = await Promise.race([ended.then(() => true), delay(15000).then(() => false)]);
    if (!graceful) { child.kill(); await ended; }
  }
}
