import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import qs from 'qs';
import { DataSource } from 'typeorm';
import { AuthGuard } from '../../dist/auth/auth.guard.js';
import { AuthService } from '../../dist/auth/auth.service.js';
import { AuthTokenService } from '../../dist/auth/auth-token.service.js';
import { AuthenticateRequestUseCase } from '../../dist/auth/use-case/authenticate-request.use-case.js';
import { ModuleAccessGuard } from '../../dist/authorization/module-access.guard.js';
import { CheckModuleAccessUseCase } from '../../dist/authorization/use-case/check-module-access.use-case.js';
import { BusinessCashModule } from '../../dist/business-cash/business-cash.module.js';
import { AllExceptionsFilter } from '../../dist/common/filters/all-exceptions.filter.js';
import { RedisModule } from '../../dist/common/redis/redis.module.js';
import { RedisService } from '../../dist/common/redis/redis.service.js';
import { RentalValidationPipe } from '../../dist/rental-common/rental-validation.pipe.js';
import {
  businessAccessTestSession,
  installBusinessAccessFixture,
} from './business-access.fixture.mjs';

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  }).trim();

export async function withBusinessCashHttpLab(configuration, run) {
  return withBusinessHttpLab(
    { ...configuration, modules: [BusinessCashModule] },
    run,
  );
}

export async function withBusinessHttpLab(
  { database, port, marker, migrations, business, otherBusiness, modules },
  run,
) {
  const container =
    'template_nodia_' + database + '_' + randomUUID().replaceAll('-', '');
  let source;
  let app;
  let started = false;

  async function openLabDatabase(localPort) {
    let port;
    if (localPort !== undefined) {
      assert.match(localPort, /^[0-9]{1,5}$/);
      port = Number(localPort);
      assert.ok(
        port >= 1024 && port <= 65535,
        'Expected an explicit local test port',
      );
    } else {
      docker(
        'run',
        '--detach',
        '--rm',
        '--name',
        container,
        '--publish',
        '127.0.0.1::5432',
        '--env',
        'POSTGRES_DB=' + database,
        '--env',
        'POSTGRES_USER=' + database,
        '--env',
        'POSTGRES_PASSWORD=' + container,
        'postgres:16-alpine',
      );
      started = true;
      const mapping = docker('port', container, '5432/tcp');
      assert.match(mapping, /^127\.0\.0\.1:\d+$/);
      port = Number(mapping.split(':')[1]);
      for (let attempt = 0; ; attempt++) {
        try {
          docker(
            'exec',
            container,
            'pg_isready',
            '-h',
            '127.0.0.1',
            '-U',
            database,
          );
          break;
        } catch (error) {
          if (attempt >= 60) throw error;
          await delay(250);
        }
      }
    }
    const settings = {
      type: 'postgres',
      host: '127.0.0.1',
      port,
      username: database,
      database,
      password: started ? container : 'synthetic-local-only',
      entities: [
        fileURLToPath(
          new URL('../../dist/**/*.entity.js', import.meta.url),
        ).replaceAll('\\', '/'),
      ],
      synchronize: false,
      installExtensions: false,
    };
    source = await new DataSource({
      ...settings,
      migrations,
    }).initialize();
    const [identity] = await source.query(
      "SELECT current_user AS actor, current_database() AS db, current_setting('server_version_num')::int AS version, shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname=current_database()",
    );
    assert.equal(identity.actor, database);
    assert.equal(identity.db, database);
    assert.equal(Math.floor(identity.version / 10000), 16);
    if (!started)
      assert.equal(identity.marker, marker, 'Refusing an unmarked database');
    const [existing] = await source.query(
      "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'",
    );
    assert.equal(
      existing.count,
      0,
      'The lab database must have an empty public schema',
    );
    return settings;
  }

  async function seedAuthority() {
    await installBusinessAccessFixture(source);
    await source.query(
      'ALTER TABLE users ADD COLUMN name varchar, ADD COLUMN email text, ADD COLUMN image_url text, ADD COLUMN created_at timestamp DEFAULT now(), ADD COLUMN updated_at timestamp DEFAULT now()',
    );
    await source.query(
      'ALTER TABLE auth_sessions ADD COLUMN id bigserial, ADD COLUMN image_url text, ADD COLUMN created_at timestamptz DEFAULT now()',
    );
    await source.query(
      'ALTER TABLE modules ADD COLUMN module_group_id bigint, ADD COLUMN key text, ADD COLUMN link text, ADD COLUMN is_active boolean NOT NULL DEFAULT true',
    );
    await source.query(
      'ALTER TABLE module_groups ADD COLUMN is_active boolean NOT NULL DEFAULT true',
    );
    await source.query(
      'ALTER TABLE user_modules ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY, ADD COLUMN user_id bigint, ADD COLUMN module_id bigint, ADD COLUMN is_active boolean NOT NULL DEFAULT true',
    );
    await source.query('INSERT INTO users(id) VALUES(4)');
    await source.query(
      "UPDATE users SET name='Synthetic actor', email=id::text || '@example.invalid'",
    );
    await source.query(
      "INSERT INTO auth_sessions(public_id,user_id,expires_at) VALUES($1,4,clock_timestamp()+interval '1 day')",
      [businessAccessTestSession('4')],
    );
    await source.query(
      "INSERT INTO module_groups(id) VALUES(1); INSERT INTO modules(id,module_group_id,key,link) VALUES(1,1,'commerce-fixture','/business'); INSERT INTO user_modules(user_id,module_id) VALUES(1,1),(2,1)",
    );
    await source.query(
      'INSERT INTO businesses(id,owner_id) VALUES($1,1),($2,2)',
      [business, otherBusiness],
    );
  }

  async function startHttp(
    settings,
    { imports = [], controllers = [], providers = [], overrides = [] } = {},
  ) {
    const builder = Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(settings),
        RedisModule,
        ...modules,
        ...imports,
      ],
      controllers,
      providers,
    })
      .overrideProvider(RedisService)
      .useValue({});
    for (const [provider, value] of overrides)
      builder.overrideProvider(provider).useValue(value);
    const moduleRef = await builder.compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.set('query parser', (value) =>
      qs.parse(value, { allowDots: true, comma: true }),
    );
    app.useGlobalPipes(
      new RentalValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    const tokens = new AuthTokenService(new JwtService(), {
      secret: randomBytes(48).toString('hex'),
      issuer: database + ':isolated',
      accessAudience: database + ':access',
      refreshAudience: database + ':refresh',
      accessSeconds: 900,
    });
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(
        reflector,
        new AuthenticateRequestUseCase(new AuthService(source), tokens),
      ),
      new ModuleAccessGuard(reflector, app.get(CheckModuleAccessUseCase)),
    );
    await app.listen(0, '127.0.0.1');

    const authorization = new Map();
    for (const id of ['1', '2', '3', '4']) {
      const { response } = await tokens.issue(
        {
          id,
          name: 'Synthetic actor',
          email: id + '@example.invalid',
          image_url: null,
        },
        businessAccessTestSession(id),
        new Date(Date.now() + 3600000),
      );
      authorization.set(id, 'Bearer ' + response.token);
    }
    const base = (await app.getUrl()) + '/api/v1';
    return async function send(method, path, actor = '1', body) {
      const headers =
        actor === null ? {} : { Authorization: authorization.get(actor) };
      const response = await fetch(base + path, {
        method,
        headers:
          body === undefined
            ? headers
            : body instanceof FormData
              ? headers
              : { ...headers, 'Content-Type': 'application/json' },
        ...(body === undefined
          ? {}
          : { body: body instanceof FormData ? body : JSON.stringify(body) }),
        signal: AbortSignal.timeout(8000),
      });
      return {
        status: response.status,
        body: await response.json(),
        headers: response.headers,
      };
    };
  }

  try {
    const settings = await openLabDatabase(port);
    await seedAuthority();
    await run({ source, startHttp: (options) => startHttp(settings, options) });
  } finally {
    if (app) await app.close();
    if (source?.isInitialized) await source.destroy();
    if (started) docker('stop', container);
  }
}
