import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';

// Synthetic transport and persistence only; never load operational credentials.
process.env.DOTENV_CONFIG_PATH = new URL('./not-an-env-file', import.meta.url).pathname;
process.env.GEMINI_SERVICE_TOKEN = randomBytes(32).toString('hex');
const actor = '9007199254740993', other = '9007199254740992';
let allowed = true, calls = 0, failure = null, malformed = false, oversize = false;
let job;
const frame = { ready: true, frame_id: 'b'.repeat(32), image: '/9j/2Q==', width: 1280, height: 850 };
const upstream = createServer(async (req, res) => {
  assert.equal(req.headers['x-nodia-service-token'], process.env.GEMINI_SERVICE_TOKEN);
  assert.equal(req.headers['x-nodia-actor-id'], actor);
  calls++;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (failure) { res.writeHead(failure).end('private output must never be public'); return; }
  if (req.url === '/auth/logout') {
    assert.equal(req.method, 'POST');
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(malformed
      ? { status: 'invalid' } : { status: 'disconnected', private_marker: 'synthetic-secret' }));
    return;
  }
  if (req.url === '/auth/login/start') job = { id: 'a'.repeat(32), state: 'running' };
  if (req.url.endsWith('/cancel')) job.state = 'cancelled';
  if (req.url.endsWith('/input')) assert.deepEqual(JSON.parse(Buffer.concat(chunks)), {
    action: 'text', text: 'synthetic-text', frame_id: frame.frame_id,
  });
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(oversize ? 'x'.repeat(1_050_000)
    : JSON.stringify(req.url.endsWith('/frame') ? malformed ? { ...frame, image: 'not-a-jpeg', cookies: 'synthetic-secret' } : frame
      : { ...job, private_marker: 'synthetic-secret' }));
});
let app;
try {
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  process.env.GEMINI_MICROSERVICE_URL = `http://127.0.0.1:${upstream.address().port}`;
  const [{ GeminiService }, { AiProviderController }, { ManageGeminiLoginUseCase }, { AuthGuard }, { AuthService },
    { AuthTokenService }, { AuthenticateRequestUseCase }, { ActionPermissionGuard }, { CheckActionPermissionUseCase }] = await Promise.all([
    import('../dist/common/ai/gemini.service.js'), import('../dist/ai-provider/ai-provider.controller.js'),
    import('../dist/ai-provider/use-case/manage-gemini-login.use-case.js'), import('../dist/auth/auth.guard.js'),
    import('../dist/auth/auth.service.js'), import('../dist/auth/auth-token.service.js'),
    import('../dist/auth/use-case/authenticate-request.use-case.js'), import('../dist/authorization/action-permission.guard.js'),
    import('../dist/authorization/use-case/check-action-permission.use-case.js'),
  ]);
  const login = new ManageGeminiLoginUseCase(new GeminiService());
  class ProbeModule {}
  Module({ controllers: [AiProviderController], providers: [
    ...Reflect.getMetadata('design:paramtypes', AiProviderController).map((provide) => ({ provide,
      useValue: provide === ManageGeminiLoginUseCase ? login : {} })),
    AuthenticateRequestUseCase, CheckActionPermissionUseCase,
    { provide: DataSource, useValue: { async query() { return [{ allowed }]; } } },
    { provide: AuthService, useValue: { async findActiveSession() { return { public_id: 'synthetic-session' }; },
      async findUser(id) { return { id, name: 'Synthetic user', email: 'probe@example.test', roles: [], modules: [] }; } } },
    { provide: AuthTokenService, useValue: { async verify(token) { assert([actor, other].includes(token)); return { sub: token, sid: 'synthetic-session' }; } } },
    { provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_GUARD, useClass: ActionPermissionGuard },
  ] })(ProbeModule);
  app = await NestFactory.create(ProbeModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  for (const resource of ['ai-provider', 'ai-providers']) {
    const logout = (token) => fetch(`http://127.0.0.1:${app.getHttpServer().address().port}/${resource}/gemini-session/logout`, {
      method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const logoutCalls = calls;
    assert.equal((await logout()).status, 401);
    allowed = false;
    assert.equal((await logout(actor)).status, 403);
    allowed = true;
    assert.equal(calls, logoutCalls);
    for (const status of [409, 503]) {
      failure = status;
      const response = await logout(actor);
      assert.equal(response.status, status);
      assert(!(await response.text()).includes('private output'));
    }
    failure = null; malformed = true;
    assert.equal((await logout(actor)).status, 502);
    malformed = false;
    const cleared = await logout(actor);
    assert.equal(cleared.status, 201);
    assert.equal(cleared.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await cleared.json(), { status: 'disconnected' });
    const base = `${await app.getUrl()}/${resource}/gemini-login`;
    const request = (suffix, method = 'GET', body, user = actor) => fetch(base + suffix, {
      method, headers: { ...(user ? { Authorization: `Bearer ${user}` } : {}), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await request('/start', 'POST', undefined, null)).status, 401);
    allowed = false; const denied = calls;
    assert.equal((await request('/start', 'POST')).status, 403); assert.equal(calls, denied);
    allowed = true;
    const started = await request('/start', 'POST');
    assert.equal(started.status, 201); assert.equal(started.headers.get('cache-control'), 'no-store');
    const publicJob = await started.json();
    assert.deepEqual(publicJob, { id: 'a'.repeat(32), state: 'running' });
    const path = `/${publicJob.id}`;
    for (const [suffix, method, body] of [['', 'GET'], ['/frame', 'GET'], ['/cancel', 'POST'],
      ['/input', 'POST', { frame_id: frame.frame_id, action: 'key', key: 'Enter' }]]) {
      const previous = calls;
      assert.equal((await request(path + suffix, method, body, other)).status, 404); assert.equal(calls, previous);
    }
    const pixels = await request(path + '/frame');
    assert.equal(pixels.status, 200); assert.equal(pixels.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await pixels.json(), frame);
    const previous = calls;
    for (const body of [{ frame_id: frame.frame_id, action: 'key', key: 'Control+L' },
      { frame_id: frame.frame_id, action: 'click', x: '10', y: 0 },
      { frame_id: frame.frame_id, action: 'click', x: 1280, y: 0 },
      { frame_id: frame.frame_id, action: 'text', text: 'x'.repeat(2049) },
      { frame_id: frame.frame_id, action: 'text', text: 'x', key: 'Enter' },
      { frame_id: frame.frame_id, action: 'text', text: 'x', actor_id: other }]) {
      assert.equal((await request(path + '/input', 'POST', body)).status, 400);
    }
    assert.equal(calls, previous);
    assert.equal((await request(path + '/input', 'POST', { frame_id: frame.frame_id, action: 'text', text: 'synthetic-text' })).status, 201);
    for (const status of [404, 409, 503]) {
      failure = status;
      const response = await request(path + '/frame'); assert.equal(response.status, status);
      assert(!(await response.text()).includes('private output'));
    }
    failure = null; malformed = true;
    assert.equal((await request(path + '/frame')).status, 502);
    malformed = false; oversize = true;
    assert.equal((await request(path + '/frame')).status, 502); oversize = false;
    assert.equal((await request(path + '/cancel', 'POST')).status, 201);
  }
  console.log('Gemini Web viewer HTTP integration passed: both aliases, real guards, ownership, DTOs, bounded transport and safe responses.');
} finally {
  await app?.close();
  upstream.closeAllConnections();
  await new Promise((resolve) => upstream.close(resolve));
}
