import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderContactModule } from '../dist/provider-contact/provider-contact.module.js';
import { CreateProviderContacts1791220000000 } from '../dist/migrations/1791220000000-CreateProviderContacts.js';

// No .env or application DataSource: all persistence belongs to this disposable container.
const container = `template_provider_contacts_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let db,
  app,
  started = false;
try {
  docker(
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    'POSTGRES_DB=contacts_test',
    '--env',
    'POSTGRES_USER=contacts_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  const options = {
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'contacts_test',
    password,
    database: 'contacts_test',
    synchronize: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
  };
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'contacts_test', '-d', 'contacts_test');
      break;
    } catch (error) {
      if (attempt === 29) throw error;
      await delay(250);
    }
  }
  db = new DataSource(options);
  await db.initialize();
  await db.query(
    `CREATE TABLE providers(id bigserial PRIMARY KEY, business_id uuid NOT NULL, name varchar(255) NOT NULL, tax int NOT NULL DEFAULT 19, fields jsonb NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
  );
  await db.query(
    `INSERT INTO providers(business_id,name) VALUES ('11111111-1111-4111-8111-111111111111','Distribuidora Los Andes'), ('11111111-1111-4111-8111-111111111111','Envases del Sur')`,
  );
  const migration = new CreateProviderContacts1791220000000();
  const runner = db.createQueryRunner();
  await migration.up(runner);
  await migration.down(runner);
  await migration.up(runner);
  await runner.release();
  class SyntheticGuard {
    canActivate(context) {
      if (
        context.switchToHttp().getRequest().headers['x-contact-test-actor'] !==
        '1'
      )
        throw new UnauthorizedException();
      return true;
    }
  }
  class IntegrationModule {}
  Module({
    imports: [TypeOrmModule.forRoot(options), ProviderContactModule],
    providers: [{ provide: APP_GUARD, useClass: SyntheticGuard }],
  })(IntegrationModule);
  app = await NestFactory.create(IntegrationModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const call = async (path, method = 'GET', body, authenticated = true) => {
    const response = await fetch(`${base}/api/v1/providers/${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(authenticated ? { 'x-contact-test-actor': '1' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const values = {
    name: 'María Pérez',
    phone: [{ number: '+56987654321' }, { number: '+56223456789' }],
    email: 'maria@example.test',
    schedule: {
      monday: [
        { from: '09:00', to: '12:00', description: 'Visita del vendedor' },
      ],
      thursday: [{ from: '14:00', to: '17:00' }],
    },
    description: 'Pedidos y coordinación de despacho.',
    is_active: true,
  };
  assert.equal((await call('1/contacts', 'GET', undefined, false)).status, 401);
  assert.equal((await call('999/contacts')).status, 404);
  assert.equal((await call('1/contacts?limit=101')).status, 400);
  const command = { ...values, request_key: randomUUID() };
  const created = await Promise.all([
    call('1/contacts', 'POST', command),
    call('1/contacts', 'POST', command),
  ]);
  assert.deepEqual(
    created.map((r) => r.status),
    [201, 201],
  );
  assert.equal(created[0].body.id, created[1].body.id);
  assert.equal(
    (
      await db.query('SELECT count(*)::int count FROM personal_info_provider')
    )[0].count,
    1,
  );
  assert.equal('creation_hash' in created[0].body, false);
  assert.equal(
    (await call('1/contacts', 'POST', { ...command, name: 'Changed' })).status,
    409,
  );
  const id = created[0].body.id;
  assert.equal(
    (await call(`2/contacts/${id}`, 'PUT', { ...values, version: 1 })).status,
    404,
  );
  assert.equal(
    (
      await call('1/contacts', 'POST', {
        ...command,
        request_key: randomUUID(),
        schedule: { monday: [{ from: '12:00', to: '09:00' }] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('1/contacts', 'POST', {
        ...command,
        request_key: randomUUID(),
        phone: [{ number: '+56987654321', extra: true }],
      })
    ).status,
    400,
  );
  const race = await Promise.all([
    call(`1/contacts/${id}`, 'PUT', {
      ...values,
      name: 'Edición A',
      version: 1,
    }),
    call(`1/contacts/${id}`, 'PUT', {
      ...values,
      name: 'Edición B',
      version: 1,
    }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  const winner = race.find((r) => r.status === 200).body;
  const replay = await call(`1/contacts/${id}`, 'PUT', {
    ...values,
    name: winner.name,
    version: 1,
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.version, 2);
  const inactive = await call(`1/contacts/${id}/status`, 'PATCH', {
    is_active: false,
    version: 2,
  });
  assert.equal(inactive.status, 200);
  assert.deepEqual(inactive.body.schedule, values.schedule);
  assert.equal(inactive.body.is_active, false);
  const clear = await call(`1/contacts/${id}`, 'PUT', {
    ...values,
    phone: [],
    schedule: {},
    email: null,
    description: null,
    version: 3,
  });
  assert.equal(clear.status, 200);
  assert.deepEqual(clear.body.phone, []);
  assert.deepEqual(clear.body.schedule, {});
  await call('1/contacts', 'POST', {
    ...values,
    name: 'Literal % _ !',
    request_key: randomUUID(),
  });
  const literal = await call('1/contacts?search=%25');
  assert.equal(literal.body.meta.total_items, 1);
  assert.equal((await call('2/contacts')).body.meta.total_items, 0);
  await assert.rejects(
    db.query(`DELETE FROM providers WHERE id = 1`),
    (error) => error.code === '23503',
  );
  await call('1/contacts', 'POST', {
    ...command,
    name: 'María Pérez',
    request_key: randomUUID(),
  });
  console.log(
    'PASS: PostgreSQL migration up/down/up, compiled Nest DI/DTO/HTTP, provider association, pagination/search, concurrent creation, lost-response replay, edit races, deactivation and FK restriction.',
  );
  if (process.env.CONTACTS_BROWSER_QA === '1') {
    const { runProviderContactsHarness } =
      await import('../../nodia-client/scripts/provider-contacts-qa-server.mjs');
    await runProviderContactsHarness({ base, db });
  }
} finally {
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('stop', container);
}
