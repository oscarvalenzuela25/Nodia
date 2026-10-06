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

// Real HTTP pipeline, guards and invoice use cases; session/token/persistence
// boundaries are synthetic. No .env, configured DB, Redis or AI calls.
const actor = { id: '42', email: 'business-user@example.test', name: 'Business user', modules: ['business'], roles: [] };
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
  .filter((token) => token !== AnalyzeInvoiceUseCase && token !== VerifyIaProvidersUseCase)
  .map((provide) => ({ provide, useValue: { execute() { throw new Error('Unexpected invoice operation'); } } }));

class InvoiceAccessTestModule {}
Module({
  controllers: [InvoiceController, PermissionControlController],
  providers: [
    ...unusedInvoiceProviders,
    { provide: AnalyzeInvoiceUseCase, useValue: new AnalyzeInvoiceUseCase({}, {}, {}, undefined) },
    { provide: VerifyIaProvidersUseCase, useValue: new VerifyIaProvidersUseCase({}, { async findAllProviders() { return { data: [] }; } }) },
    AuthenticateRequestUseCase,
    CheckActionPermissionUseCase,
    { provide: DataSource, useValue: deniedDataSource },
    { provide: AuthService, useValue: {
      async findActiveSession(id) { return id === 'active-session' ? { public_id: id, image_url: null } : null; },
      async findUser() { return actor; },
    } },
    { provide: AuthTokenService, useValue: {
      async verify(token, type) {
        assert.equal(type, 'access');
        if (!['business-only', 'revoked'].includes(token)) throw new UnauthorizedException();
        return { sub: actor.id, sid: token === 'business-only' ? 'active-session' : 'revoked-session' };
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
  assert.equal((await fetch(`${base}/api/v1/permission-control`, { headers })).status, 403);
  assert.equal(actionChecks, 1);
  console.log('Invoice access HTTP checks passed: business user without actions, aliases, authentication, validation and remaining action guard.');
} finally {
  await app.close();
}
