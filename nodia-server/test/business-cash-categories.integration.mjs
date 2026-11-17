// Run after build. Owns a disposable PostgreSQL 16 container by default.
// CASH02_TEST_PORT opts into a fresh, explicitly marked loopback lab database.
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
import { AuthGuard } from '../dist/auth/auth.guard.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { AuthTokenService } from '../dist/auth/auth-token.service.js';
import { AuthenticateRequestUseCase } from '../dist/auth/use-case/authenticate-request.use-case.js';
import { ModuleAccessGuard } from '../dist/authorization/module-access.guard.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { BusinessCashModule } from '../dist/business-cash/business-cash.module.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import { RedisModule } from '../dist/common/redis/redis.module.js';
import { RedisService } from '../dist/common/redis/redis.service.js';
import { CreateBusinessCashCategories1793690000000 } from '../dist/migrations/1793690000000-CreateBusinessCashCategories.js';
import { RentalValidationPipe } from '../dist/rental-common/rental-validation.pipe.js';
import {
  businessAccessTestSession,
  installBusinessAccessFixture,
} from './fixtures/business-access.fixture.mjs';

const marker = 'nodia-disposable:cash-02';
const localPort = process.env.CASH02_TEST_PORT;
const container = 'nodia_cash02_' + randomUUID().replaceAll('-', '');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  }).trim();
const database = 'cash02_test';
const business = randomUUID();
const otherBusiness = randomUUID();
const categoryPath = '/business-cash-categories';
const receiptPath = (key, businessId = business) =>
  '/businesses/' + businessId + '/cash-mutation-requests/' + key;
const checks = [];
let source;
let app;
let started = false;

async function openLabDatabase() {
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
        new URL('../dist/**/*.entity.js', import.meta.url),
      ).replaceAll('\\', '/'),
    ],
    synchronize: false,
    installExtensions: false,
  };
  source = await new DataSource({
    ...settings,
    migrations: [CreateBusinessCashCategories1793690000000],
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

async function startHttp(settings) {
  const moduleRef = await Test.createTestingModule({
    imports: [TypeOrmModule.forRoot(settings), RedisModule, BusinessCashModule],
  })
    .overrideProvider(RedisService)
    .useValue({})
    .compile();
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
    issuer: 'nodia-cash02-isolated',
    accessAudience: 'cash02:access',
    refreshAudience: 'cash02:refresh',
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
          : { ...headers, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8000),
    });
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    };
  };
}

const create = (name, businessId = business) => ({
  business_id: businessId,
  request_key: randomUUID(),
  name,
  description: 'Descripción sintética',
});
const listing = (businessId, fields = []) =>
  categoryPath +
  '?' +
  new URLSearchParams([['q[business_id_eq]', businessId], ...fields]);
function expectStatus(result, status, message) {
  assert.equal(result.status, status, JSON.stringify(result.body));
  if (message !== undefined) assert.equal(result.body.message, message);
  return result.body;
}

async function waitUntil(predicate, description) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await predicate()) return;
    await delay(20);
  }
  throw new Error(description);
}

async function holdLock(sql, parameters, work) {
  const lock = source.createQueryRunner();
  try {
    await lock.startTransaction();
    await lock.query(sql, parameters);
    return await work(lock);
  } finally {
    if (lock.isTransactionActive) await lock.rollbackTransaction();
    await lock.release();
  }
}

try {
  const settings = await openLabDatabase();
  await seedAuthority();
  const businessesBefore = await source.query(
    'SELECT id::text,owner_id::text FROM businesses ORDER BY id',
  );
  assert.equal((await source.runMigrations()).length, 1);
  await source.undoLastMigration();
  const [removed] = await source.query(
    "SELECT to_regclass('business_cash_categories') AS category, to_regclass('business_cash_mutation_requests') AS receipt",
  );
  assert.deepEqual(removed, { category: null, receipt: null });
  assert.equal((await source.runMigrations()).length, 1);
  assert.deepEqual(
    await source.query(
      'SELECT id::text,owner_id::text FROM businesses ORDER BY id',
    ),
    businessesBefore,
  );
  checks.push(
    'additive_migration_empty_rollback_and_legacy_business_rows_preserved',
  );

  const send = await startHttp(settings);
  expectStatus(await send('GET', listing(business), null), 401);
  expectStatus(await send('GET', listing(business), '4'), 403);
  expectStatus(
    await send('GET', listing(business), '2'),
    404,
    'business:resource_not_found',
  );
  expectStatus(
    await send('POST', categoryPath, '2', create('Sin acceso')),
    404,
    'business:resource_not_found',
  );
  assert.deepEqual(
    expectStatus(await send('GET', listing(business), '3'), 200).data,
    [],
  );
  checks.push('real_http_jwt_active_module_and_current_business_scope');

  const contenders = [create('  Café %_, caja  '), create('CAFE\u0301%_,CAJA')];
  const attempts = await Promise.all(
    contenders.map((command) => send('POST', categoryPath, '1', command)),
  );
  assert.deepEqual(attempts.map(({ status }) => status).sort(), [201, 409]);
  const winner = attempts.findIndex(({ status }) => status === 201);
  const loser = 1 - winner;
  const saved = expectStatus(attempts[winner], 201);
  const category = saved.result.category;
  assert.equal(saved.status, 'committed');
  assert.equal(saved.operation, 'category_create');
  assert.equal(saved.request_key, contenders[winner].request_key);
  assert.equal(typeof category.id, 'string');
  assert.equal(category.version, 1);
  assert.equal(category.is_active, true);
  assert.deepEqual(Object.keys(category).sort(), [
    'business_id',
    'description',
    'id',
    'is_active',
    'name',
    'version',
  ]);
  expectStatus(attempts[loser], 409, 'business:cash_category_name_exists');
  assert.deepEqual(
    expectStatus(
      await send('POST', categoryPath, '1', contenders[winner]),
      201,
    ),
    saved,
  );
  const receipt = await send('GET', receiptPath(saved.request_key));
  assert.equal(receipt.headers.get('cache-control'), 'no-store');
  assert.deepEqual(expectStatus(receipt, 200), saved);
  const rejected = expectStatus(
    await send('GET', receiptPath(contenders[loser].request_key)),
    200,
  );
  assert.deepEqual(rejected, {
    request_key: contenders[loser].request_key,
    operation: 'category_create',
    status: 'rejected',
    error: { status_code: 409, message: 'business:cash_category_name_exists' },
  });
  expectStatus(
    await send('POST', categoryPath, '1', {
      ...contenders[loser],
      name: 'Otra categoría',
    }),
    409,
    'business:cash_request_key_conflict',
  );
  assert.deepEqual(
    expectStatus(await send('GET', receiptPath(saved.request_key), '3'), 200),
    {
      request_key: saved.request_key,
      status: 'unconfirmed',
    },
  );
  const [unique] = await source.query(
    'SELECT count(*)::int AS count FROM business_cash_categories WHERE business_id=$1',
    [business],
  );
  assert.equal(unique.count, 1);
  checks.push(
    'simultaneous_canonical_duplicate_with_stable_committed_and_rejected_receipts',
  );

  const sameIntent = create('Otra categoría');
  const replayRace = await Promise.all([
    send('POST', categoryPath, '1', sameIntent),
    send('POST', categoryPath, '1', sameIntent),
  ]);
  assert.ok(replayRace.some((result) => result.status === 201));
  assert.ok(
    replayRace.every(
      (result) => result.status === 201 || result.status === 202,
    ),
  );
  const sameReceipt = expectStatus(
    await send('GET', receiptPath(sameIntent.request_key)),
    200,
  );
  assert.equal(sameReceipt.status, 'committed');
  for (const result of replayRace.filter((result) => result.status === 201))
    assert.deepEqual(result.body, sameReceipt);
  const [oneEffect] = await source.query(
    "SELECT count(*)::int AS count FROM business_cash_categories WHERE business_id=$1 AND name='Otra categoría'",
    [business],
  );
  assert.equal(oneEffect.count, 1);
  const sharedDetail = categoryPath + '/' + sameReceipt.result.category.id;
  const edits = await Promise.all(
    ['Primer cambio', 'Segundo cambio'].map((description) =>
      send('PUT', sharedDetail, '1', {
        request_key: randomUUID(),
        expected_version: 1,
        description,
      }),
    ),
  );
  assert.deepEqual(edits.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(expectStatus(await send('GET', sharedDetail), 200).version, 2);
  checks.push(
    'concurrent_same_request_key_has_one_effect_and_response_recovery',
  );

  const detail = categoryPath + '/' + category.id;
  const change = {
    request_key: randomUUID(),
    expected_version: 1,
    is_active: false,
  };
  const edited = expectStatus(await send('PUT', detail, '1', change), 200);
  assert.equal(edited.result.category.version, 2);
  assert.equal(edited.result.category.is_active, false);
  assert.deepEqual(
    expectStatus(await send('PUT', detail, '1', change), 200),
    edited,
  );
  expectStatus(
    await send('PUT', detail, '1', {
      ...change,
      request_key: randomUUID(),
      is_active: true,
    }),
    409,
    'business:cash_version_conflict',
  );
  const before = await source.query(
    'SELECT updated_at FROM business_cash_categories WHERE id=$1',
    [category.id],
  );
  const noOp = expectStatus(
    await send('PUT', detail, '1', {
      ...change,
      request_key: randomUUID(),
      expected_version: 2,
    }),
    200,
  );
  assert.deepEqual(noOp.result.category, edited.result.category);
  assert.deepEqual(
    await source.query(
      'SELECT updated_at FROM business_cash_categories WHERE id=$1',
      [category.id],
    ),
    before,
  );
  expectStatus(
    await send('POST', categoryPath, '1', create('CAFÉ%_,CAJA')),
    409,
    'business:cash_category_name_exists',
  );
  expectStatus(
    await send('POST', categoryPath, '2', create('CAFÉ%_,CAJA', otherBusiness)),
    201,
  );
  expectStatus(
    await send('GET', detail, '2'),
    404,
    'business:resource_not_found',
  );
  assert.deepEqual(
    expectStatus(await send('GET', detail), 200),
    edited.result.category,
  );
  assert.deepEqual(
    expectStatus(await send('GET', receiptPath(saved.request_key)), 200),
    saved,
  );
  checks.push(
    'inactive_duplicate_and_cross_business_independence_version_noop_historical_snapshot',
  );

  expectStatus(
    await send('POST', categoryPath, '1', create('Café letras, caja')),
    201,
  );
  const matches = expectStatus(
    await send(
      'GET',
      listing(business, [
        ['q[name_cont]', '%_,'],
        ['q[is_active_eq]', 'false'],
        ['limit', '1'],
      ]),
    ),
    200,
  );
  assert.deepEqual(
    matches.data.map(({ id }) => id),
    [category.id],
  );
  assert.deepEqual(matches.meta, {
    page: 1,
    limit: 1,
    total_items: 1,
    total_pages: 1,
  });
  const page = expectStatus(
    await send(
      'GET',
      listing(business, [
        ['q[s]', 'name desc'],
        ['page', '2'],
        ['limit', '1'],
      ]),
    ),
    200,
  );
  assert.equal(page.meta.total_items, 3);
  assert.equal(page.data.length, 1);
  const empty = expectStatus(
    await send(
      'GET',
      listing(business, [
        ['page', '100000'],
        ['limit', '1'],
      ]),
    ),
    200,
  );
  assert.deepEqual(empty, {
    data: [],
    meta: { page: 100000, limit: 1, total_items: 3, total_pages: 3 },
  });
  for (const fields of [
    [['all', 'true']],
    [['q[s]', 'created_at asc']],
    [['q[s]', '']],
    [['q[is_active_eq]', '1']],
    [
      ['q[name_cont]', 'x'],
      ['q[name_cont]', 'y'],
    ],
    [['limit', '101']],
  ])
    expectStatus(await send('GET', listing(business, fields)), 400);
  for (const body of [
    { ...create('Entrada'), is_active: 'false' },
    { ...create('Entrada'), normalized_name: 'arbitrary' },
    { ...create('Entrada'), description: null },
  ])
    expectStatus(await send('POST', categoryPath, '1', body), 400);
  expectStatus(
    await send('PUT', detail, '1', {
      request_key: randomUUID(),
      expected_version: 2,
    }),
    400,
  );
  checks.push(
    'strict_nested_ransack_literal_wildcard_and_comma_pagination_and_body_validation',
  );

  const pending = create('En proceso');
  let inFlight;
  await holdLock(
    'LOCK TABLE business_cash_categories IN ACCESS EXCLUSIVE MODE',
    [],
    async () => {
      inFlight = send('POST', categoryPath, '1', pending);
      await waitUntil(async () => {
        const [row] = await source.query(
          'SELECT status FROM business_cash_mutation_requests WHERE request_key=$1',
          [pending.request_key],
        );
        return row?.status === 'processing';
      }, 'The in-flight reservation did not become observable');
      const processing = expectStatus(
        await send('GET', receiptPath(pending.request_key)),
        200,
      );
      assert.deepEqual(processing, {
        request_key: pending.request_key,
        operation: 'category_create',
        status: 'processing',
      });
      assert.deepEqual(
        expectStatus(await send('POST', categoryPath, '1', pending), 202),
        processing,
      );
    },
  );
  expectStatus(await inFlight, 201);
  checks.push(
    'sql_lock_exposes_a_committed_processing_reservation_and_http_202',
  );

  const recovery = {
    ...create('Recuperable'),
    request_key: '7c184ac0-5a2f-4b36-a059-8c72ecf406df',
  };
  await source.query(
    "CREATE FUNCTION cash02_test_abort_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_key='7c184ac0-5a2f-4b36-a059-8c72ecf406df' AND NEW.status='committed' THEN RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='synthetic receipt failure'; END IF; RETURN NEW; END; $$",
  );
  await source.query(
    'CREATE TRIGGER cash02_test_abort_confirmation BEFORE UPDATE ON business_cash_mutation_requests FOR EACH ROW EXECUTE FUNCTION cash02_test_abort_confirmation()',
  );
  expectStatus(await send('POST', categoryPath, '1', recovery), 503);
  const [rolledBack] = await source.query(
    "SELECT count(*)::int AS count FROM business_cash_categories WHERE name='Recuperable'",
  );
  assert.equal(rolledBack.count, 0);
  const [attempt] = await source.query(
    'SELECT attempt_id FROM business_cash_mutation_requests WHERE request_key=$1',
    [recovery.request_key],
  );
  await source.query(
    "UPDATE business_cash_mutation_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_key=$1",
    [recovery.request_key],
  );
  assert.deepEqual(
    expectStatus(await send('GET', receiptPath(recovery.request_key)), 200),
    {
      request_key: recovery.request_key,
      operation: 'category_create',
      status: 'retryable',
    },
  );
  await source.query(
    'DROP TRIGGER cash02_test_abort_confirmation ON business_cash_mutation_requests',
  );
  expectStatus(await send('POST', categoryPath, '1', recovery), 201);
  const [retry] = await source.query(
    'SELECT attempt_id,status FROM business_cash_mutation_requests WHERE request_key=$1',
    [recovery.request_key],
  );
  assert.notEqual(retry.attempt_id, attempt.attempt_id);
  assert.equal(retry.status, 'committed');
  checks.push(
    'receipt_failure_rolls_back_category_and_expired_intent_recovers_same_key',
  );

  await source.query(
    'INSERT INTO business_collaborators(business_id,user_id) VALUES($1,2)',
    [business],
  );
  expectStatus(await send('GET', detail, '2'), 200);
  const revoked = create('Revocación en carrera');
  let blocked;
  await holdLock(
    'SELECT id FROM businesses WHERE id=$1 FOR UPDATE',
    [business],
    async (lock) => {
      await lock.query(
        'UPDATE business_collaborators SET is_active=false WHERE business_id=$1 AND user_id=2',
        [business],
      );
      blocked = send('POST', categoryPath, '2', revoked);
      await waitUntil(async () => {
        const [waiting] = await source.query(
          "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id::text FROM businesses%FOR SHARE') AS blocked",
        );
        return waiting.blocked;
      }, 'The category operation did not reach the business authority lock');
      await lock.commitTransaction();
    },
  );
  expectStatus(await blocked, 404, 'business:resource_not_found');
  expectStatus(
    await send('GET', receiptPath(pending.request_key), '2'),
    404,
    'business:resource_not_found',
  );
  await source.query('UPDATE user_modules SET is_active=false WHERE user_id=1');
  expectStatus(await send('GET', receiptPath(pending.request_key)), 403);
  await source.query(
    'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE user_id=3',
  );
  expectStatus(await send('GET', listing(business), '3'), 401);
  checks.push(
    'collaborator_revocation_is_rechecked_after_lock_and_receipts_require_current_authority',
  );

  await assert.rejects(
    () => source.undoLastMigration(),
    /business:cash_categories_rollback_would_lose_data/,
  );
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS count FROM business_cash_categories',
      )
    )[0].count,
    6,
  );
  checks.push('populated_rollback_is_refused_and_data_remains');
  console.log(
    JSON.stringify({
      task: 'business_cash_categories',
      status: 'passed',
      checks,
      count: checks.length,
      limits: [
        'PostgreSQL 16 and compiled HTTP app with synthetic users, no operational DB or provider.',
        'Categories and receipts only.',
      ],
    }),
  );
} finally {
  if (app) await app.close();
  if (source?.isInitialized) await source.destroy();
  if (started) docker('stop', container);
}
