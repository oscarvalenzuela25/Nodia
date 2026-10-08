import 'reflect-metadata';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';

// Compiled HTTP + real guards/use case. All storage, tokens and Codex messages
// are synthetic; no database, account login, inference or .env is used.
process.env.DOTENV_CONFIG_PATH = new URL(
  './no-env-file',
  import.meta.url,
).pathname;
export async function codexHttpContracts() {
  const [
    { AiProviderController },
    { ManageCodexSessionUseCase },
    { CodexRuntimeService },
    { AuthGuard },
    { AuthService },
    { AuthTokenService },
    { AuthenticateRequestUseCase },
    { ActionPermissionGuard },
    { CheckActionPermissionUseCase },
    { AllExceptionsFilter },
    { codexError },
  ] = await Promise.all([
    import('../dist/ai-provider/ai-provider.controller.js'),
    import('../dist/ai-provider/use-case/manage-codex-session.use-case.js'),
    import('../dist/common/ai/codex/codex-runtime.service.js'),
    import('../dist/auth/auth.guard.js'),
    import('../dist/auth/auth.service.js'),
    import('../dist/auth/auth-token.service.js'),
    import('../dist/auth/use-case/authenticate-request.use-case.js'),
    import('../dist/authorization/action-permission.guard.js'),
    import('../dist/authorization/use-case/check-action-permission.use-case.js'),
    import('../dist/common/filters/all-exceptions.filter.js'),
    import('../dist/common/ai/codex/codex-contract.js'),
  ]);
  const owner = '9007199254740993',
    other = '9007199254740994';
  let allowed = true,
    requests = 0;
  const runtime = new CodexRuntimeService();
  const rpc = Object.assign(new EventEmitter(), {
    alive: true,
    async request(method) {
      requests++;
      if (method === 'account/login/start')
        return {
          type: 'chatgptDeviceCode',
          loginId: 'private-synthetic-id',
          verificationUrl: 'https://auth.openai.com/codex/device',
          userCode: 'TEST-ONLY',
        };
      if (method === 'account/read') return { account: null };
      return {};
    },
  });
  const profile = {
    rpc,
    busy: false,
    cwd: '/synthetic-unused',
    lastUsed: Date.now(),
    lastInferenceAt: null,
  };
  runtime.get = async () => profile;
  const manager = new ManageCodexSessionUseCase(
    {
      async findProviderById(id) {
        return {
          id,
          catalog: { key: 'openai', is_active: true },
          is_active: true,
        };
      },
    },
    runtime,
  );
  const tokens = Reflect.getMetadata('design:paramtypes', AiProviderController);
  class ProbeModule {}
  Module({
    controllers: [AiProviderController],
    providers: [
      ...tokens.map((provide) => ({
        provide,
        useValue:
          provide === ManageCodexSessionUseCase
            ? manager
            : {
                execute() {
                  throw new Error('Unexpected operation');
                },
              },
      })),
      AuthenticateRequestUseCase,
      CheckActionPermissionUseCase,
      {
        provide: DataSource,
        useValue: {
          async query(_sql, args) {
            assert.equal(args[1], 'ai:manage');
            return [{ allowed }];
          },
        },
      },
      {
        provide: AuthService,
        useValue: {
          async findActiveSession() {
            return { public_id: 'synthetic-session' };
          },
          async findUser(id) {
            return {
              id,
              name: 'Synthetic',
              email: 'fixture@example.test',
              roles: [],
              modules: [],
            };
          },
        },
      },
      {
        provide: AuthTokenService,
        useValue: {
          async verify(token) {
            assert(['owner', 'other'].includes(token));
            return {
              sub: token === 'owner' ? owner : other,
              sid: 'synthetic-session',
            };
          },
        },
      },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: ActionPermissionGuard },
    ],
  })(ProbeModule);
  const app = await NestFactory.create(ProbeModule, { logger: false });
  try {
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const call = (path, method = 'GET', body, actor = 'owner') =>
      fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${actor}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    for (const resource of ['ai-provider', 'ai-providers']) {
      const path = `/${resource}/42/session`;
      assert.equal((await fetch(base + path)).status, 401);
      allowed = false;
      const before = requests;
      assert.equal(
        (await call(path + '/login', 'POST', { mode: 'token_plan_agentic' }))
          .status,
        403,
      );
      assert.equal(requests, before);
      allowed = true;
      assert.deepEqual(await (await call(path + '/login/current')).json(), {
        job: null,
      });
      for (const body of [
        { mode: 'api_key' },
        { mode: 'token_plan_web' },
        { mode: 'token_plan_agentic', actor_id: other },
      ])
        assert.equal((await call(path + '/login', 'POST', body)).status, 400);
      const start = await call(path + '/login', 'POST', {
        mode: 'token_plan_agentic',
      });
      assert.equal(start.status, 201);
      assert.equal(start.headers.get('cache-control'), 'no-store');
      const job = await start.json();
      assert.equal(job.userCode, 'TEST-ONLY');
      assert(!JSON.stringify(job).includes('private-synthetic-id'));
      assert.equal((await call(path + '/login', 'POST', {})).status, 409);
      assert.equal(
        (await call(path + `/login/${job.id}`, 'GET', undefined, 'other'))
          .status,
        404,
      );
      assert.deepEqual(
        await (
          await call(path + '/login/current', 'GET', undefined, 'other')
        ).json(),
        { job: null },
      );
      const cancelled = await (
        await call(path + `/login/${job.id}/cancel`, 'POST')
      ).json();
      assert.equal(cancelled.state, 'cancelled');
      assert.equal(cancelled.userCode, null);
      const observed = await (
        await call(path + '?mode=token_plan_agentic')
      ).json();
      assert.equal(observed.authenticated, false);
      assert.equal(observed.quotas, null);
      assert.deepEqual(
        await (
          await call(path + '/logout', 'POST', { mode: 'token_plan_agentic' })
        ).json(),
        { disconnected: true },
      );
    }
    runtime.get = async () => {
      throw codexError('codex_runtime_unavailable');
    };
    const failed = await call('/ai-providers/42/session/login', 'POST', {});
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).code, 'codex_runtime_unavailable');
    console.log(
      'Codex HTTP contracts passed: compiled routes, 401/403, strict DTO, private BIGINT actor/jobs, no-store, cancellation and safe errors.',
    );
  } finally {
    manager.onModuleDestroy();
    await runtime.onModuleDestroy();
    await app.close();
  }
}
if (process.argv[1] === new URL(import.meta.url).pathname)
  await codexHttpContracts();
