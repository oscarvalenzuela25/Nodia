// Compiled delivery orchestration and real PostgreSQL with a synthetic push service.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import {
  businessAccessTestSession,
  installBusinessAccessFixture,
} from './fixtures/business-access.fixture.mjs';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { CreateProviderContacts1791220000000 } from '../dist/migrations/1791220000000-CreateProviderContacts.js';
import { AddProviderVisitAlarmTime1793840000000 } from '../dist/migrations/1793840000000-AddProviderVisitAlarmTime.js';
import { CreateVisitNotificationSettings1793850000000 } from '../dist/migrations/1793850000000-CreateVisitNotificationSettings.js';
import { PlanProviderVisits1793860000000 } from '../dist/migrations/1793860000000-PlanProviderVisits.js';
import { CreateProviderVisitDeliveries1793870000000 } from '../dist/migrations/1793870000000-CreateProviderVisitDeliveries.js';
import { DeliverProviderVisitsUseCase } from '../dist/visit-notifications/delivery/deliver-provider-visits.use-case.js';
import { WebPushDeliveryStore } from '../dist/visit-notifications/delivery/web-push-delivery.store.js';

const container = `nodia_visit_delivery_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const keyId = 'a'.repeat(64);
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const plus = (instant, seconds) => new Date(instant.getTime() + seconds * 1000);
const shop = randomUUID();
const foreignShop = randomUUID();
const calls = [];
const accepted = { kind: 'accepted', status: 201 };
const rejected = (status, retryAfterMs = null) => ({
  kind: 'rejected',
  status,
  retryAfterMs,
});
const responses = new Map();
let transmitKey = keyId;
const transport = {
  configuredKeyId: () => transmitKey,
  async send(request) {
    calls.push(request);
    return (await responses.get(request.installationId)?.(request)) ?? accepted;
  },
};
let source;
let started = false;

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
    'POSTGRES_USER=delivery_test',
    '--env',
    'POSTGRES_DB=delivery_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'delivery_test',
      );
      break;
    } catch (error) {
      if (attempt === 39) throw error;
      await delay(250);
    }
  }
  source = await new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'delivery_test',
    password,
    database: 'delivery_test',
    synchronize: false,
  }).initialize();
  await installBusinessAccessFixture(source);
  await source.query(`
    ALTER TABLE module_groups ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    ALTER TABLE modules ADD COLUMN is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN module_group_id bigint, ADD COLUMN key text, ADD COLUMN link text;
    ALTER TABLE user_modules ADD COLUMN is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN user_id bigint, ADD COLUMN module_id bigint;
    INSERT INTO module_groups(id) VALUES(1);
    INSERT INTO modules(id,module_group_id,key,link) VALUES(1,1,'businesses','/business');
    INSERT INTO users(id,is_active) VALUES(4,true),(5,true),(6,false),(7,true),(8,true),(9,true),(10,true);
    INSERT INTO user_modules(id,user_id,module_id) VALUES(1,1,1),(2,2,1),(4,4,1),
      (6,6,1),(7,7,1),(8,8,1),(9,9,1),(10,10,1);
    CREATE TABLE providers(id bigserial PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id),
      is_active boolean NOT NULL DEFAULT true);
  `);
  for (const user of ['4', '5', '6', '7', '8', '9']) {
    await source.query(
      `INSERT INTO auth_sessions(public_id,user_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')`,
      [businessAccessTestSession(user), user],
    );
  }
  const runner = source.createQueryRunner();
  const deliveryMigration = new CreateProviderVisitDeliveries1793870000000();
  await runner.startTransaction();
  try {
    for (const migration of [
      new CreateProviderContacts1791220000000(),
      new AddProviderVisitAlarmTime1793840000000(),
      new CreateVisitNotificationSettings1793850000000(),
      new PlanProviderVisits1793860000000(),
      deliveryMigration,
    ]) {
      await migration.up(runner);
    }
    await deliveryMigration.down(runner);
    await deliveryMigration.up(runner);
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }

  const moduleAccess = new CheckModuleAccessUseCase(source);
  const store = new WebPushDeliveryStore(source, moduleAccess);
  const deliver = new DeliverProviderVisitsUseCase(store, transport);
  const otherWorker = new DeliverProviderVisitsUseCase(
    new WebPushDeliveryStore(source, moduleAccess),
    transport,
  );
  const [{ utc_now: now }] = await source.query(
    'SELECT clock_timestamp() AS utc_now',
  );

  async function preference(business, user, enabled = true) {
    await source.query(
      `INSERT INTO provider_visit_notification_preferences(user_id,business_id,enabled)
      VALUES($1,$2,$3) ON CONFLICT (user_id,business_id) DO UPDATE SET enabled=EXCLUDED.enabled`,
      [user, business, enabled],
    );
  }
  async function install(user, key = keyId) {
    const id = randomUUID();
    await source.query(
      `INSERT INTO web_push_installations(user_id,installation_id,session_id,state,revision,
      key_id,endpoint_fingerprint,subscription_fingerprint,subscription_ciphertext)
      VALUES($1,$2,$3,'active',1,$4,$5,$6,'encrypted fixture')`,
      [
        user,
        id,
        businessAccessTestSession(user),
        key,
        randomBytes(32).toString('hex'),
        randomBytes(32).toString('hex'),
      ],
    );
    return id;
  }
  async function visit(business, due, until) {
    const [{ id: provider }] = await source.query(
      'INSERT INTO providers(business_id) VALUES($1) RETURNING id',
      [business],
    );
    const [{ id: contact }] = await source.query(
      `INSERT INTO personal_info_provider(provider_id,name,creation_key,creation_hash,schedule)
      VALUES($1,'Contacto sintético',$2,repeat('a',64),
        jsonb_build_object(lower(trim(to_char($3::timestamptz AT TIME ZONE 'America/Santiago','Day'))),
          '[{"from":null,"to":null}]'::jsonb)) RETURNING id`,
      [provider, randomUUID(), due],
    );
    await source.query(
      `INSERT INTO provider_visit_occurrences(business_id,provider_id,contact_id,visit_date,start_at,send_at,
      expires_at,alarm_basis,status,source_revision)
      SELECT $1, $2, $3, ($4::timestamptz AT TIME ZONE 'America/Santiago')::date, NULL,
        $4, $5, 'default_hour', 'planned', queue.source_revision
      FROM provider_visit_planning_queue queue WHERE queue.provider_id=$2`,
      [business, provider, contact, due, until],
    );
    return provider;
  }
  async function journal(provider, installation) {
    const [row] = await source.query(
      `SELECT * FROM provider_visit_deliveries
      WHERE provider_id=$1 AND installation_id=$2`,
      [provider, installation],
    );
    return row;
  }
  async function device(installation) {
    const [row] = await source.query(
      `SELECT state, revision, subscription_ciphertext FROM web_push_installations
      WHERE installation_id=$1`,
      [installation],
    );
    return row;
  }

  await source.query(
    'INSERT INTO businesses(id,owner_id) VALUES($1,1),($2,4)',
    [shop, foreignShop],
  );
  await source.query(
    `INSERT INTO business_collaborators(business_id,user_id,is_active)
    VALUES($1,2,true),($1,5,true),($1,6,true),($1,7,true),($1,8,true),($1,9,true),($1,10,true),($1,4,false)`,
    [shop],
  );
  for (const user of ['1', '2', '3', '4', '5', '6', '8', '9', '10'])
    await preference(shop, user);
  const owner = await install('1');
  const ownerSecond = await install('1');
  const collaborator = await install('2');
  for (const user of ['3', '4', '5', '6', '7', '8']) await install(user);
  await install('9', 'b'.repeat(64));
  await source.query(
    `UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE user_id=8`,
  );
  // Natural login expiry preserves this consent. Explicit revocation above does not.
  await source.query(
    `UPDATE auth_sessions SET expires_at=clock_timestamp()-interval '1 minute' WHERE user_id=2`,
  );
  const first = await visit(shop, plus(now, -1), plus(now, 160));
  const future = await visit(shop, plus(now, 375), plus(now, 390));
  await visit(shop, plus(now, -60), plus(now, -1));
  responses.set(ownerSecond, () => rejected(429, 45_000));
  responses.set(collaborator, () => rejected(410));
  await Promise.all([deliver.execute(now), otherWorker.execute(now)]);
  assert.deepEqual(
    calls.map((call) => call.installationId).sort(),
    [owner, ownerSecond, collaborator].sort(),
  );
  assert(
    calls.every(
      (call) =>
        call.businessId === shop &&
        call.expiresAt.getTime() === plus(now, 160).getTime(),
    ),
  );
  assert.equal((await journal(first, owner)).state, 'accepted');
  const limited = await journal(first, ownerSecond);
  assert.equal(limited.state, 'retry');
  assert(limited.next_attempt_at >= plus(now, 45));
  assert.equal((await device(collaborator)).state, 'expired');
  assert.equal((await device(collaborator)).subscription_ciphertext, null);
  assert.equal(await journal(future, owner), undefined);
  await deliver.execute(plus(now, 20));
  assert.equal(calls.length, 3);
  responses.delete(ownerSecond);
  await deliver.execute(limited.next_attempt_at);
  const secondCalls = calls.filter(
    (call) => call.installationId === ownerSecond,
  );
  assert.equal(secondCalls.length, 2);
  assert.equal(secondCalls[0].notificationId, secondCalls[1].notificationId);
  assert.equal((await journal(first, ownerSecond)).state, 'accepted');

  await source.query(
    `UPDATE providers SET visit_alarm_time='08:45' WHERE id=$1`,
    [first],
  );
  await source.query(
    `UPDATE provider_visit_occurrences visit SET source_revision=queue.source_revision
       FROM provider_visit_planning_queue queue
      WHERE visit.provider_id=$1 AND queue.provider_id=visit.provider_id`,
    [first],
  );
  const afterAcceptance = calls.length;
  await deliver.execute(plus(limited.next_attempt_at, 1));
  assert.equal(calls.length, afterAcceptance);

  // Subsequent cases use a different business and a single eligible installation.
  const isolated = randomUUID();
  await source.query('INSERT INTO businesses(id,owner_id) VALUES($1,4)', [
    isolated,
  ]);
  await preference(isolated, '4');
  const [{ installation_id: isolatedDevice }] = await source.query(
    'SELECT installation_id FROM web_push_installations WHERE user_id=4',
  );
  const later = plus(now, 180);
  const ambiguous = await visit(isolated, plus(later, -1), plus(later, 100));
  responses.set(isolatedDevice, () => rejected(504));
  await deliver.execute(later);
  assert.equal((await journal(ambiguous, isolatedDevice)).state, 'unknown');
  const sentAtAmbiguity = calls.length;
  await deliver.execute(plus(later, 20));
  assert.equal(calls.length, sentAtAmbiguity);

  const cantRetry = await visit(isolated, plus(later, 20), plus(later, 25));
  responses.set(isolatedDevice, () => rejected(429, 60_000));
  await deliver.execute(plus(later, 21));
  assert.equal((await journal(cantRetry, isolatedDevice)).state, 'expired');

  const retried = await visit(isolated, plus(later, 24), plus(later, 170));
  responses.set(isolatedDevice, () => rejected(503, 10_000));
  const beforeRetries = calls.length;
  let next = plus(later, 24);
  for (let index = 0; index < 3; index++) {
    await deliver.execute(next);
    const row = await journal(retried, isolatedDevice);
    assert.equal(row.attempt_count, index + 1);
    assert.equal(row.state, index === 2 ? 'failed' : 'retry');
    next = row.next_attempt_at;
  }
  const retryCalls = calls.slice(beforeRetries);
  assert.equal(retryCalls.length, 3);
  assert.equal(new Set(retryCalls.map((call) => call.notificationId)).size, 1);

  const guardTime = plus(later, 125);
  const losesConsent = await visit(
    isolated,
    plus(guardTime, -1),
    plus(guardTime, 120),
  );
  await store.prepare({ now: guardTime, keyId });
  const consentClaim = await store.claim(guardTime);
  assert.equal(
    consentClaim?.id,
    (await journal(losesConsent, isolatedDevice)).id,
  );
  await preference(isolated, '4', false);
  assert.equal(await store.arm(consentClaim, keyId, guardTime), null);
  assert.equal(
    (await journal(losesConsent, isolatedDevice)).state,
    'cancelled',
  );
  await preference(isolated, '4');

  const moved = await visit(
    isolated,
    plus(guardTime, -1),
    plus(guardTime, 120),
  );
  await store.prepare({ now: guardTime, keyId });
  const staleClaim = await store.claim(guardTime);
  assert.equal(staleClaim?.id, (await journal(moved, isolatedDevice)).id);
  await source.query(
    `UPDATE providers SET visit_alarm_time='09:30' WHERE id=$1`,
    [moved],
  );
  assert.equal(await store.arm(staleClaim, keyId, guardTime), null);

  // A crash after arming has an uncertain remote result and must not be replayed.
  const crash = await visit(
    isolated,
    plus(guardTime, -1),
    plus(guardTime, 120),
  );
  await store.prepare({ now: guardTime, keyId });
  const crashClaim = await store.claim(guardTime);
  assert.equal(crashClaim?.id, (await journal(crash, isolatedDevice)).id);
  assert(await store.arm(crashClaim, keyId, guardTime));
  const beforeRecovery = calls.length;
  transmitKey = null;
  await deliver.execute(plus(guardTime, 35));
  assert.equal((await journal(crash, isolatedDevice)).state, 'unknown');
  transmitKey = keyId;
  await deliver.execute(plus(guardTime, 45));
  assert.equal(calls.length, beforeRecovery);

  // A rejection for a previous subscription version cannot expire its replacement.
  const rotationTime = plus(now, 430);
  await visit(isolated, rotationTime, plus(rotationTime, 90));
  responses.set(isolatedDevice, async () => {
    await source.query(
      'UPDATE web_push_installations SET revision=revision+1 WHERE installation_id=$1',
      [isolatedDevice],
    );
    return rejected(410);
  });
  await deliver.execute(rotationTime);
  assert.equal((await device(isolatedDevice)).state, 'active');
  assert.equal((await device(isolatedDevice)).revision, 2);

  // A lease that was never armed is recoverable, with its attempt budget intact.
  const recovered = await visit(isolated, rotationTime, plus(rotationTime, 90));
  await store.prepare({ now: rotationTime, keyId });
  const abandoned = await store.claim(rotationTime);
  assert.equal(abandoned?.id, (await journal(recovered, isolatedDevice)).id);
  responses.delete(isolatedDevice);
  await otherWorker.execute(plus(rotationTime, 35));
  const restored = await journal(recovered, isolatedDevice);
  assert.equal(restored.state, 'accepted');
  assert.equal(restored.attempt_count, 1);
  assert.equal(await store.arm(abandoned, keyId, plus(rotationTime, 35)), null);

  const accessTime = plus(rotationTime, 100);
  const losesModule = await visit(isolated, accessTime, plus(accessTime, 150));
  responses.set(isolatedDevice, () => rejected(429, 40_000));
  await deliver.execute(accessTime);
  const waiting = await journal(losesModule, isolatedDevice);
  assert.equal(waiting.state, 'retry');
  const beforeRevocation = calls.length;
  await source.query('UPDATE user_modules SET is_active=false WHERE user_id=4');
  await deliver.execute(waiting.next_attempt_at);
  assert.equal((await journal(losesModule, isolatedDevice)).state, 'cancelled');
  await source.query('UPDATE user_modules SET is_active=true WHERE user_id=4');
  await deliver.execute(plus(waiting.next_attempt_at, 10));
  assert.equal(calls.length, beforeRevocation);

  await assert.rejects(
    source.transaction((manager) =>
      deliveryMigration.down(manager.queryRunner),
    ),
    /Preserve the Web Push delivery journal/,
  );
  assert.equal((await journal(first, owner)).state, 'accepted');
  console.log(
    'PASS: current explicit recipients and devices, concurrent deduplication, retry windows, expiry, revocation, source revision and uncertain recovery. Synthetic push responses only.',
  );
} finally {
  if (source?.isInitialized) await source.destroy();
  if (started) docker('stop', container);
}
