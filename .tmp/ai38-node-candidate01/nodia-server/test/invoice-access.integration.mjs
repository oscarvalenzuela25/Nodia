import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Controller, Get, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AuthGuard } from '../dist/auth/auth.guard.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { AuthTokenService } from '../dist/auth/auth-token.service.js';
import { AuthenticateRequestUseCase } from '../dist/auth/use-case/authenticate-request.use-case.js';
import { ActionPermissionGuard, RequireAction } from '../dist/authorization/action-permission.guard.js';
import { CheckActionPermissionUseCase } from '../dist/authorization/use-case/check-action-permission.use-case.js';
import { InvoiceController } from '../dist/invoice/invoice.controller.js';
import { AnalyzeInvoiceUseCase } from '../dist/invoice/use-case/analyze-invoice.use-case.js';
import { VerifyIaProvidersUseCase } from '../dist/invoice/use-case/verify-ia-providers.use-case.js';
import { AnalysisObservationsUseCase } from '../dist/invoice/use-case/analysis-observations.use-case.js';
import { AnalysisObservationInterceptor } from '../dist/invoice/analysis-observation.interceptor.js';

// Real HTTP pipeline, guards and invoice use cases; session/token/persistence
// boundaries are synthetic. No .env, configured DB, Redis or AI calls.
const actor = { id: '42', email: 'business-user@example.test', name: 'Business user', modules: ['business'], roles: [] };
let inferenceCalls = 0;
let releaseInference;
let waitForInference = null;
const analysis = new AnalyzeInvoiceUseCase({}, {}, {}, {
  async findProviderById(id) { return { id, is_active: true, catalog: { key: 'openai', can_use_api_key: true }, use_api_key: true }; },
}, {
  async execute(id, model, file, fields, tax, effort, signal, progress) {
    inferenceCalls++;
    progress?.resolve({ providerId: id, provider: 'openai', mode: 'api_key', model });
    progress?.emit('provider_request_started');
    if (waitForInference) await waitForInference;
    signal?.throwIfAborted();
    progress?.emit('response_received');
    return { code: 'SYNTHETIC', total_amount: 0, issue_date: null, items: [] };
  },
});
let actionChecks = 0;
const deniedDataSource = {
  async query() {
    actionChecks++;
    return [{ allowed: false }];
  },
};
class PermissionControlController {
  check() { return { ok: true }; }
}
Controller('permission-control')(PermissionControlController);
const controlDescriptor = Object.getOwnPropertyDescriptor(PermissionControlController.prototype, 'check');
Get()(PermissionControlController.prototype, 'check', controlDescriptor);
RequireAction('ai:manage')(PermissionControlController.prototype, 'check', controlDescriptor);

const unusedInvoiceProviders = Reflect.getMetadata('design:paramtypes', InvoiceController)
  .filter((token) => token !== AnalyzeInvoiceUseCase && token !== VerifyIaProvidersUseCase && token !== AnalysisObservationsUseCase)
  .map((provide) => ({ provide, useValue: { execute() { throw new Error('Unexpected invoice operation'); } } }));

class InvoiceAccessTestModule {}
Module({
  controllers: [InvoiceController, PermissionControlController],
  providers: [
    ...unusedInvoiceProviders,
    AnalysisObservationsUseCase,
    AnalysisObservationInterceptor,
    { provide: AnalyzeInvoiceUseCase, useValue: analysis },
    { provide: VerifyIaProvidersUseCase, useValue: new VerifyIaProvidersUseCase({}, { async findAllProviders() { return { data: [] }; } }) },
    AuthenticateRequestUseCase,
    CheckActionPermissionUseCase,
    { provide: DataSource, useValue: deniedDataSource },
    { provide: AuthService, useValue: {
      async findActiveSession(id) { return id === 'active-session' ? { public_id: id, image_url: null } : null; },
      async findUser(id) { return { ...actor, id }; },
    } },
    { provide: AuthTokenService, useValue: {
      async verify(token, type) {
        assert.equal(type, 'access');
        if (!['business-only', 'other-user', 'revoked'].includes(token)) throw new UnauthorizedException();
        return { sub: token === 'other-user' ? 'other' : actor.id, sid: token === 'revoked' ? 'revoked-session' : 'active-session' };
      },
    } },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ActionPermissionGuard },
  ],
})(InvoiceAccessTestModule);

const app = await NestFactory.create(InvoiceAccessTestModule, { logger: false });
try {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const headers = { Authorization: 'Bearer business-only' };
  for (const resource of ['invoice', 'invoices']) {
    for (const alias of ['verify-ia-providers', 'verify-ia-provider']) {
      const path = `${base}/api/v1/${resource}/${alias}`;
      assert.equal((await fetch(path)).status, 401);
      assert.equal((await fetch(path, { headers: { Authorization: 'Bearer revoked' } })).status, 401);
      const response = await fetch(path, { headers });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), []);
    }
    const path = `${base}/api/v1/${resource}/analyze`;
    assert.equal((await fetch(path, { method: 'POST' })).status, 401);
    const response = await fetch(path, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: '9601aa95-dd70-4af3-a5cf-50dd553a4ae9' }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, 'No invoice file uploaded');
    const invalid = await fetch(path, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: 'invalid' }),
    });
    assert.equal(invalid.status, 400);
    assert.ok((await invalid.json()).message.includes('business_id must be a UUID'));
  }
  assert.equal(actionChecks, 0);
  const context = { business_id: '9601aa95-dd70-4af3-a5cf-50dd553a4ae9', ai_provider_id: '42', mode: 'api_key', model: 'synthetic' };
  const reserve = async (resource = 'invoices') => {
    const response = await fetch(`${base}/api/v1/${resource}/analysis-observations`, { method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(context) });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return (await response.json()).id;
  };
  const snapshot = async id => {
    const response = await fetch(`${base}/api/v1/invoices/analysis-observations/${id}`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  };
  const send = (id, overrides = {}, file = new Blob(['%PDF-1.4'], { type: 'application/pdf' })) => {
    const body = new FormData();
    for (const [key, value] of Object.entries({ ...context, ...overrides })) body.append(key, value);
    body.append('file', file, 'synthetic.pdf');
    return fetch(`${base}/api/v1/invoices/analyze`, { method: 'POST', headers: { ...headers, 'X-Nodia-Analysis-Id': id }, body });
  };
  for (const resource of ['invoice', 'invoices']) {
    const id = await reserve(resource);
    assert.equal((await fetch(`${base}/api/v1/${resource}/analysis-observations/${id}`, { headers: { Authorization: 'Bearer other-user' } })).status, 404);
    const invalid = await send(id, { business_id: 'invalid' });
    assert.equal(invalid.status, 400);
    assert.equal((await snapshot(id)).state, 'failed');
    assert.equal((await send(id)).status, 409);
  }
  const mismatch = await reserve();
  assert.equal((await send(mismatch, { ai_provider_id: '99' })).status, 409);
  assert.equal(inferenceCalls, 0);
  const oversized = await reserve();
  assert.equal((await send(oversized, {}, new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'application/pdf' }))).status, 413);
  assert.equal((await snapshot(oversized)).state, 'failed');
  const id = await reserve();
  waitForInference = new Promise(resolve => { releaseInference = resolve; });
  const principal = send(id);
  for (let attempt = 0; attempt < 50; attempt++) {
    if (inferenceCalls) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(inferenceCalls, 1);
  const running = await snapshot(id);
  assert.equal(running.state, 'running');
  assert.ok(running.events.some(event => event.stage === 'provider_request_started'));
  assert.equal((await send(id)).status, 409);
  // Observer failure and another actor cannot cancel/replay the principal request.
  assert.equal((await fetch(`${base}/api/v1/invoices/analysis-observations/${id}?after=invalid`, { headers })).status, 400);
  releaseInference();
  const result = await principal;
  assert.equal(result.status, 201);
  assert.equal((await result.json()).code, 'SYNTHETIC');
  const completed = await snapshot(id);
  assert.equal(completed.state, 'succeeded');
  assert.equal(completed.events.at(-1).stage, 'extraction_validated');
  assert.equal(inferenceCalls, 1);
  assert.deepEqual((await fetch(`${base}/api/v1/invoices/analysis-observations/${id}?after=${completed.lastSequence}`, { headers }).then(response => response.json())).events, []);
  assert.equal((await fetch(`${base}/api/v1/permission-control`, { headers })).status, 403);
  assert.equal(actionChecks, 1);
  console.log('Invoice access HTTP checks passed: business user without actions, aliases, authentication, validation and remaining action guard.');
} finally {
  await app.close();
}
