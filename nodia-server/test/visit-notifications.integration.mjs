import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
  Global,
  Module,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  businessAccessTestPrincipal,
  businessAccessTestSession,
  installBusinessAccessFixture,
} from './fixtures/business-access.fixture.mjs';
import { ModuleAccessGuard } from '../dist/authorization/module-access.guard.js';
import { RedisService } from '../dist/common/redis/redis.service.js';
import { CreateVisitNotificationSettings1793850000000 } from '../dist/migrations/1793850000000-CreateVisitNotificationSettings.js';
import { VisitNotificationsModule } from '../dist/visit-notifications/visit-notifications.module.js';
import { sweepWebPushInstallations } from '../dist/visit-notifications/visit-notifications.service.js';

const container = `template_visit_notifications_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const publicKey = () =>
  createECDH('prime256v1').generateKeys().toString('base64url');
const vapidKey = publicKey();

let started = false;
let db;
let app;
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
    'POSTGRES_DB=visit_notifications_test',
    '--env',
    'POSTGRES_USER=visit_notifications_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'visit_notifications_test',
      );
      break;
    } catch (error) {
      if (attempt === 29) throw error;
      await delay(250);
    }
  }
  const options = {
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'visit_notifications_test',
    password,
    database: 'visit_notifications_test',
    synchronize: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
  };
  db = await new DataSource(options).initialize();
  await installBusinessAccessFixture(db);
  const shop = randomUUID();
  const foreignShop = randomUUID();
  const newSession = randomUUID();
  const otherDeviceSession = randomUUID();
  const racingSession = randomUUID();
  await db.query(`
    ALTER TABLE module_groups ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    ALTER TABLE modules ADD COLUMN is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN module_group_id bigint, ADD COLUMN key text, ADD COLUMN link text;
    ALTER TABLE user_modules ADD COLUMN is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN user_id bigint, ADD COLUMN module_id bigint;
    INSERT INTO module_groups(id) VALUES(1);
    INSERT INTO modules(id,module_group_id,key,link) VALUES(1,1,'businesses','/business');
    INSERT INTO user_modules(id,user_id,module_id) VALUES(1,1,1),(2,2,1);
  `);
  await db.query('INSERT INTO businesses(id,owner_id) VALUES($1,1),($2,2)', [
    shop,
    foreignShop,
  ]);
  await db.query(
    'INSERT INTO business_collaborators(business_id,user_id) VALUES($1,2)',
    [shop],
  );
  await db.query(
    `INSERT INTO auth_sessions(public_id,user_id,expires_at) VALUES
    ($1,1,clock_timestamp()+interval '1 day'),($2,1,clock_timestamp()+interval '1 day'),
    ($3,1,clock_timestamp()+interval '1 day')`,
    [newSession, otherDeviceSession, racingSession],
  );
  const migration = new CreateVisitNotificationSettings1793850000000();
  const runner = db.createQueryRunner();
  await runner.startTransaction();
  await migration.up(runner);
  await migration.down(runner);
  await migration.up(runner);
  await runner.commitTransaction();
  await runner.release();

  class SyntheticSessionGuard {
    canActivate(context) {
      const request = context.switchToHttp().getRequest();
      const userId = request.headers['x-visit-test-user'];
      if (!['1', '2', '3'].includes(userId)) throw new UnauthorizedException();
      const principal = businessAccessTestPrincipal(userId);
      const session = request.headers['x-visit-test-session'];
      if (
        userId === '1' &&
        [newSession, otherDeviceSession, racingSession].includes(session)
      )
        principal.sessionId = session;
      request.auth = principal;
      return true;
    }
  }
  class IsolatedDependencies {}
  Global()(IsolatedDependencies);
  Module({
    providers: [{ provide: RedisService, useValue: {} }],
    exports: [RedisService],
  })(IsolatedDependencies);
  class IntegrationModule {}
  Module({
    imports: [
      TypeOrmModule.forRoot(options),
      IsolatedDependencies,
      VisitNotificationsModule,
    ],
  })(IntegrationModule);
  app = await NestFactory.create(IntegrationModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalGuards(new SyntheticSessionGuard(), app.get(ModuleAccessGuard));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  async function request(path, method = 'GET', body, actor = '1', session) {
    const response = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: {
        ...(actor ? { 'x-visit-test-user': actor } : {}),
        ...(session ? { 'x-visit-test-session': session } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, value: await response.json() };
  }

  const preference = (id) =>
    `/businesses/${id}/notification-preferences/provider-visits`;
  assert.equal(
    (await request(preference(shop), 'GET', undefined, null)).status,
    401,
  );
  assert.deepEqual((await request(preference(shop))).value, { enabled: false });
  assert.deepEqual(
    (await request(preference(shop), 'PUT', { enabled: true })).value,
    { enabled: true },
  );
  assert.deepEqual(
    (await request(preference(shop), 'GET', undefined, '2')).value,
    { enabled: false },
  );
  assert.equal(
    (await request(preference(shop), 'PUT', { enabled: true }, '2')).status,
    200,
  );
  assert.equal(
    (await request(preference(shop), 'PUT', { enabled: false, user_id: '2' }))
      .status,
    400,
  );
  assert.equal(
    (await request(preference(shop), 'PUT', { enabled: 'false' })).status,
    400,
  );
  assert.equal((await request(preference(foreignShop))).status, 404);
  assert.equal(
    (await request(preference(shop), 'PUT', { enabled: true }, '3')).status,
    404,
  );
  await db.query(
    'UPDATE business_collaborators SET is_active=false WHERE business_id=$1 AND user_id=2',
    [shop],
  );
  assert.equal(
    (await request(preference(shop), 'GET', undefined, '2')).status,
    404,
  );
  assert.deepEqual(
    (await request(preference(shop), 'PUT', { enabled: false })).value,
    { enabled: false },
  );
  assert.equal(
    (
      await db.query(
        'SELECT enabled FROM provider_visit_notification_preferences WHERE business_id=$1 AND user_id=2',
        [shop],
      )
    )[0].enabled,
    true,
  );

  const configPath = '/notifications/web-push/config';
  delete process.env.WEB_PUSH_PUBLIC_KEY;
  delete process.env.WEB_PUSH_SUBSCRIPTION_KEY;
  delete process.env.WEB_PUSH_ENDPOINT_HOSTS;
  assert.deepEqual((await request(configPath)).value, {
    enabled: false,
    public_key: null,
    key_id: null,
  });
  process.env.WEB_PUSH_PUBLIC_KEY = vapidKey;
  process.env.WEB_PUSH_SUBSCRIPTION_KEY = randomBytes(32).toString('hex');
  process.env.WEB_PUSH_ENDPOINT_HOSTS = '*.push.test';
  assert.equal((await request(configPath, 'GET', undefined, null)).status, 401);
  const config = (await request(configPath)).value;
  assert.equal(config.public_key, vapidKey);
  assert.deepEqual(Object.keys(config).sort(), [
    'enabled',
    'key_id',
    'public_key',
  ]);
  const device = (id) => `/notifications/web-push/installations/${id}`;
  const primary = randomUUID();
  const secondary = randomUUID();
  const third = randomUUID();
  const subscription = (name, expirationTime = null) => ({
    endpoint: `https://test.push.test/${name}/${randomUUID()}`,
    expirationTime,
    keys: { p256dh: publicKey(), auth: randomBytes(16).toString('base64url') },
  });
  const payload = (sub, revision = 0) => ({
    key_id: config.key_id,
    subscription: sub,
    expected_revision: revision,
  });
  const primarySub = subscription('primary');
  assert.equal((await request(device(primary))).value.state, 'unregistered');
  assert.equal(
    (
      await request(
        device(primary),
        'PUT',
        payload({ ...primarySub, endpoint: 'http://test.push.test/invalid' }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        device(primary),
        'PUT',
        payload({ ...primarySub, expirationTime: Date.now() - 5000 }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(device(primary), 'PUT', {
        ...payload(primarySub),
        key_id: '0'.repeat(64),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(device(primary), 'PUT', {
        ...payload(primarySub),
        session_id: newSession,
      })
    ).status,
    400,
  );
  const registered = await Promise.all([
    request(device(primary), 'PUT', payload(primarySub)),
    request(device(primary), 'PUT', payload(primarySub)),
  ]);
  assert.equal(registered[0].status, 200);
  assert.deepEqual(registered[0], registered[1]);
  assert.deepEqual(Object.keys(registered[0].value).sort(), [
    'installation_id',
    'revision',
    'state',
    'updated_at',
  ]);
  assert.equal(registered[0].value.revision, 1);
  assert.equal(
    (await request(device(primary), 'GET', undefined, '2')).value.state,
    'unregistered',
  );
  assert.equal(
    (await request(device(randomUUID()), 'PUT', payload(primarySub), '2'))
      .status,
    409,
  );
  assert.equal(
    (
      await request(
        device(secondary),
        'PUT',
        payload(subscription('secondary')),
        '1',
        otherDeviceSession,
      )
    ).status,
    200,
  );
  const [stored] = await db.query(
    'SELECT * FROM web_push_installations WHERE user_id=1 AND installation_id=$1',
    [primary],
  );
  assert(stored.subscription_ciphertext.startsWith('scoped-v1:'));
  assert(!JSON.stringify(stored).includes(primarySub.endpoint));
  assert(!JSON.stringify(stored).includes(primarySub.keys.auth));

  // Normal browser-session expiry preserves enrollment. A new login may rebind that exact subscription only.
  await db.query(
    "UPDATE auth_sessions SET expires_at=clock_timestamp()-interval '1 day' WHERE public_id=$1",
    [businessAccessTestSession('1')],
  );
  assert.equal((await request(device(primary))).status, 401);
  assert.equal(
    (await request(device(primary), 'GET', undefined, '1', newSession)).value
      .state,
    'active',
  );
  assert.equal(
    (
      await request(
        device(primary),
        'PUT',
        payload(subscription('wrong'), 1),
        '1',
        newSession,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        device(primary),
        'PUT',
        payload(primarySub, 0),
        '1',
        newSession,
      )
    ).status,
    409,
  );
  const rebound = await request(
    device(primary),
    'PUT',
    payload(primarySub, 1),
    '1',
    newSession,
  );
  assert.equal(rebound.status, 200);
  assert.equal(rebound.value.revision, 2);
  await db.query(
    'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',
    [businessAccessTestSession('1')],
  );
  assert.equal(
    (await request(device(primary), 'GET', undefined, '1', newSession)).value
      .state,
    'active',
  );
  // Revoked sessions atomically clear enrolled transport and leave other installations active.
  await db.query(
    'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',
    [newSession],
  );
  const revoked = await request(
    device(primary),
    'GET',
    undefined,
    '1',
    otherDeviceSession,
  );
  assert.equal(revoked.value.state, 'revoked');
  assert.equal(revoked.value.revision, 3);
  assert.equal(
    (
      await request(
        device(secondary),
        'GET',
        undefined,
        '1',
        otherDeviceSession,
      )
    ).value.state,
    'active',
  );
  const [cleared] = await db.query(
    'SELECT * FROM web_push_installations WHERE user_id=1 AND installation_id=$1',
    [primary],
  );
  assert.equal(cleared.subscription_ciphertext, null);
  assert.equal(cleared.endpoint_fingerprint, null);
  assert.equal(
    (
      await request(
        device(primary),
        'PUT',
        payload(primarySub, 2),
        '1',
        otherDeviceSession,
      )
    ).status,
    409,
  );

  // Account-only management retains access after losing the business module.
  await db.query('UPDATE user_modules SET is_active=false WHERE user_id=1');
  assert.equal(
    (await request(preference(shop), 'GET', undefined, '1', otherDeviceSession))
      .status,
    403,
  );
  const revokePath = `${device(secondary)}?expected_revision=1`;
  const deletion = await request(
    revokePath,
    'DELETE',
    undefined,
    '1',
    otherDeviceSession,
  );
  assert.equal(deletion.value.state, 'revoked');
  assert.deepEqual(
    await request(revokePath, 'DELETE', undefined, '1', otherDeviceSession),
    deletion,
  );
  assert.equal(
    (
      await request(
        device(third),
        'PUT',
        payload(subscription('third')),
        '1',
        otherDeviceSession,
      )
    ).status,
    200,
  );
  await db.query(
    "UPDATE web_push_installations SET expires_at=clock_timestamp()-interval '1 minute' WHERE installation_id=$1",
    [third],
  );
  await db.transaction(sweepWebPushInstallations);
  const expired = await request(
    device(third),
    'GET',
    undefined,
    '1',
    otherDeviceSession,
  );
  assert.equal(expired.value.state, 'expired');
  assert.equal(expired.value.revision, 2);
  const [expiredRow] = await db.query(
    'SELECT subscription_ciphertext,endpoint_fingerprint FROM web_push_installations WHERE installation_id=$1',
    [third],
  );
  assert.deepEqual(expiredRow, {
    subscription_ciphertext: null,
    endpoint_fingerprint: null,
  });
  await db.query(
    "UPDATE web_push_installations SET updated_at=clock_timestamp()-interval '40 days' WHERE installation_id=$1",
    [primary],
  );
  await db.query(
    "UPDATE auth_sessions SET revoked_at=clock_timestamp()-interval '40 days' WHERE public_id=$1",
    [newSession],
  );
  await db.transaction(sweepWebPushInstallations);
  assert.equal(
    (await request(device(primary), 'GET', undefined, '1', otherDeviceSession))
      .value.state,
    'unregistered',
  );

  const racingDevice = randomUUID();
  const [racingRegistration] = await Promise.all([
    request(
      device(racingDevice),
      'PUT',
      payload(subscription('racing')),
      '1',
      racingSession,
    ),
    db.query(
      'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',
      [racingSession],
    ),
  ]);
  assert([200, 401].includes(racingRegistration.status));
  const [afterRace] = await db.query(
    'SELECT state, subscription_ciphertext FROM web_push_installations WHERE installation_id=$1',
    [racingDevice],
  );
  if (afterRace)
    assert.deepEqual(afterRace, {
      state: 'revoked',
      subscription_ciphertext: null,
    });

  console.log(
    'PASS: PostgreSQL 16 migration, real NestJS routes and ModuleAccessGuard, personal preferences, revision fencing, cross-user endpoint isolation, encrypted storage, session rebind/revocation, expiry and retention.',
  );
} finally {
  try {
    if (app) await app.close();
  } finally {
    try {
      if (db?.isInitialized) await db.destroy();
    } finally {
      if (started) docker('rm', '--force', container);
    }
  }
}
