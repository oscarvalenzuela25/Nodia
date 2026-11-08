import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Controller, Get, Module, Post, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AuthGuard, Public } from '../dist/auth/auth.guard.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { AuthTokenService } from '../dist/auth/auth-token.service.js';
import { AuthenticateRequestUseCase } from '../dist/auth/use-case/authenticate-request.use-case.js';
import { ModuleAccessGuard } from '../dist/authorization/module-access.guard.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';

// Real Nest HTTP routing, AuthGuard, module policy and authorization use case.
// Only token/session/database boundaries are synthetic; no Redis, DB or AI calls.
const actors = new Map([
  ['1', { modules: ['/business'] }],
  ['2', { modules: [] }],
  ['3', { modules: [], superAdmin: true }],
  ['4', { modules: ['/users'] }],
  ['5', { modules: ['/roles'] }],
  ['6', { modules: ['/ai-providers'] }],
  ['7', { modules: ['/nodia-teacher'] }],
  ['8', { modules: ['/nodia-ai'] }],
]);
let failDatabase = false;
let handlerCalls = 0;
let databaseCalls = 0;
const dataSource = {
  async query(_sql, [id, routes, match]) {
    databaseCalls++;
    if (failDatabase) throw new Error('Synthetic unavailable persistence');
    const actor = actors.get(id);
    return [{ actor_active: Boolean(actor), allowed: Boolean(actor && (actor.superAdmin
      || (match === 'any' ? routes.some(route => actor.modules.includes(route))
        : routes.every(route => actor.modules.includes(route))))) }];
  },
};

function testController(paths, handlers) {
  class TestController {}
  Controller(paths)(TestController);
  for (const [name, method, path, isPublic = false] of handlers) {
    Object.defineProperty(TestController.prototype, name, { value() {
      handlerCalls++;
      return { ok: true };
    } });
    const descriptor = Object.getOwnPropertyDescriptor(TestController.prototype, name);
    method(path)(TestController.prototype, name, descriptor);
    if (isPublic) Public()(TestController.prototype, name, descriptor);
  }
  return TestController;
}

class HttpModuleAccessTestModule {}
Module({
  controllers: [
    testController(['invoice', 'invoices'], [['list', Get, ''], ['analyze', Post, 'analyze']]),
    testController(['role', 'roles'], [['list', Get, ''], ['detail', Get, ':id'], ['create', Post, '']]),
    testController(['ai-provider', 'ai-providers'], [['list', Get, ''], ['create', Post, '']]),
    testController('auth', [['me', Get, 'me']]),
    testController('authorization', [['context', Get, 'context']]),
    testController('teacher', [['connections',Get,'connections'],['sessions',Get,'sessions']]),
    testController('new-unclassified-resource', [['list', Get, '']]),
    testController('public-probe', [['health', Get, '', true]]),
  ],
  providers: [
    { provide: DataSource, useValue: dataSource },
    { provide: AuthService, useValue: {
      async findActiveSession(sid) { return sid === 'active' ? { public_id: sid, image_url: null } : null; },
      async findUser(id) { return actors.has(id) ? { id, name: 'Synthetic actor', email: `${id}@example.test` } : null; },
    } },
    { provide: AuthTokenService, useValue: {
      async verify(token) {
        if (token === 'revoked') return { sub: '1', sid: 'revoked' };
        if (!actors.has(token)) throw new UnauthorizedException();
        return { sub: token, sid: 'active' };
      },
    } },
    AuthenticateRequestUseCase,
    CheckModuleAccessUseCase,
    AuthGuard,
    ModuleAccessGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: ModuleAccessGuard },
  ],
})(HttpModuleAccessTestModule);

const app = await NestFactory.create(HttpModuleAccessTestModule, { logger: false });
let checks = 0;
try {
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1`;
  async function status(path, expected, token, method = 'GET') {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    assert.equal(response.status, expected, `${method} ${path} actor=${token ?? 'anonymous'}`);
    checks++;
  }
  const beforeAnonymous = handlerCalls;
  await status('/invoices', 401);
  await status('/invoices', 401, 'revoked');
  await status('/invoices', 403, '2');
  assert.equal(handlerCalls, beforeAnonymous, 'Rejected requests never reach the domain handler');
  for (const alias of ['invoice', 'invoices']) {
    await status(`/${alias}`, 200, '1');
    await status(`/${alias}/analyze`, 201, '1', 'POST');
    await status(`/${alias}`, 200, '3');
  }
  await status('/ai-providers', 200, '6');
  await status('/ai-providers', 201, '6', 'POST');
  await status('/ai-providers', 403, '1');
  await status('/ai-providers', 201, '3', 'POST');
  await status('/roles', 200, '4');
  await status('/roles/7', 403, '4');
  await status('/roles', 403, '4', 'POST');
  await status('/roles/7', 200, '5');
  await status('/teacher/connections',200,'7');
  await status('/teacher/sessions',200,'7');
  await status('/teacher/connections',403,'8');
  await status('/teacher/sessions',403,'1');
  await status('/teacher/sessions',401);
  await status('/teacher/sessions',200,'3');
  const beforeSessionRoutes = databaseCalls;
  await status('/auth/me', 200, '2');
  await status('/authorization/context', 200, '2');
  await status('/public-probe', 200);
  assert.equal(databaseCalls, beforeSessionRoutes, 'Session bootstrap and public routes need no product module');
  await status('/new-unclassified-resource', 403, '1');
  const beforeFailure = handlerCalls;
  failDatabase = true;
  await status('/invoices', 500, '1');
  assert.equal(handlerCalls, beforeFailure, 'Persistence failure does not grant access');
  console.log(`HTTP module access: ${checks} checks passed (synthetic persistence/session boundaries).`);
} finally {
  await app.close();
}
