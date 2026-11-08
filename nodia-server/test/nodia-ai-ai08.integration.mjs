// Compiled HTTP/use cases, real PostgreSQL16, synthetic identities, no configured DB or providers.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  Global,
  Module,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import qs from 'qs';

process.env.DOTENV_CONFIG_PATH =
  process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
const load = async (file, name) =>
  (await import('../dist/' + file + '.js'))[name];
const migrations = await Promise.all(
  [
    ['1789257400000-InitialCoreSchema', 'InitialCoreSchema1789257400000'],
    ['1789257600000-AuthSessions', 'AuthSessions1789257600000'],
    [
      '1791085000000-CreatePersonalFinance',
      'CreatePersonalFinance1791085000000',
    ],
    [
      '1791146000000-CreateRentalReservations',
      'CreateRentalReservations1791146000000',
    ],
    [
      '1791540000000-OptionalRentalPropertyTimes',
      'OptionalRentalPropertyTimes1791540000000',
    ],
    [
      '1792100000000-RegisterNodiaAiNavigation',
      'RegisterNodiaAiNavigation1792100000000',
    ],
  ].map(([file, name]) => load('migrations/' + file, name)),
);
const moduleRefs = await Promise.all(
  [
    ['user/user.module', 'UserModule'],
    ['role/role.module', 'RoleModule'],
    ['module/module.module', 'ModuleModule'],
    ['module-group/module-group.module', 'ModuleGroupModule'],
    ['action/action.module', 'ActionModule'],
    ['finance-category/finance-category.module', 'FinanceCategoryModule'],
    [
      'finance-category-group/finance-category-group.module',
      'FinanceCategoryGroupModule',
    ],
    ['finance-movement/finance-movement.module', 'FinanceMovementModule'],
    ['finance-obligation/finance-obligation.module', 'FinanceObligationModule'],
    ['finance-overview/finance-overview.module', 'FinanceOverviewModule'],
    ['rental-common/rental.module', 'RentalModule'],
    // AI-08 verifies authority/domain boundaries. The growing chat composition
    // starts background workers and providers outside this historical fixture.
    ['nodia-ai/nodia-ai-authorization.module', 'NodiaAiAuthorizationModule'],
  ].map(([file, name]) => load(file, name)),
);
const RedisService = await load('common/redis/redis.service', 'RedisService');
const { lockAuthority } =
  await import('../dist/authorization/authority-transaction.js');
const ExecuteAuthorizedNodiaAiUseCase = await load(
  'nodia-ai/use-case/execute-authorized-nodia-ai.use-case',
  'ExecuteAuthorizedNodiaAiUseCase',
);
const CreateFinanceMovementUseCase = await load(
  'finance-movement/use-case/create-finance-movement.use-case',
  'CreateFinanceMovementUseCase',
);
const FinanceLedgerService = await load(
  'finance-obligation/finance-ledger.service',
  'FinanceLedgerService',
);
const container = `template_ai08_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const identities = new Map(
  ['1', '2', '3', '4'].map((userId) => [
    userId,
    { userId, sessionId: randomUUID() },
  ]),
);
const checks = [];
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
};
let db,
  app,
  started = false,
  url;
const runners = [];
async function request(
  path,
  { actor = '3', method = 'GET', body, status = 200 } = {},
) {
  const response = await fetch(url + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
    ...(body && method !== 'GET' && method !== 'HEAD'
      ? { body: JSON.stringify(body) }
      : {}),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  assert.equal(
    response.status,
    status,
    method + ' ' + path + ' ' + JSON.stringify(data),
  );
  return data;
}
async function rental(
  path,
  body,
  { actor = '3', method = 'POST', status = 201, key = randomUUID() } = {},
) {
  assert(['POST', 'PUT', 'PATCH', 'DELETE'].includes(method));
  const options = {
    method,
    headers: {
      'content-type': 'application/json',
      'x-fixture-actor': actor,
      'idempotency-key': key,
    },
    body: JSON.stringify(body),
  };
  const response = await fetch(url + path, options);
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}
async function waitForAuthorityWriter() {
  for (let i = 0; i < 80; i++) {
    const [row] = await db.query(
      "SELECT count(*)::int AS count FROM pg_locks WHERE relation='actions'::regclass AND mode='ShareRowExclusiveLock' AND NOT granted",
    );
    if (row.count > 0) return;
    await delay(15);
  }
  throw Error('Authority writer did not reach the lock barrier');
}
try {
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    container,
    '-p',
    '127.0.0.1::5432',
    '-e',
    'POSTGRES_USER=ai08',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    'POSTGRES_DB=ai08',
    'postgres:16-alpine',
  );
  started = true;
  for (let i = 0; i < 80; i++) {
    try {
      docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'ai08');
      break;
    } catch (error) {
      if (i === 79) throw error;
      await delay(250);
    }
  }
  const options = {
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'ai08',
    password,
    database: 'ai08',
    synchronize: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
    migrations,
  };
  db = await new DataSource(options).initialize();
  await db.runMigrations();
  const FinanceNavigationService = await load(
    'finance-navigation/finance-navigation.service',
    'FinanceNavigationService',
  );
  await db.transaction((manager) =>
    new FinanceNavigationService().register(manager),
  );
  for (const [id, identity] of identities) {
    await db.query('INSERT INTO users(id,email,name) VALUES ($1,$2,$3)', [
      id,
      `synthetic${id}@example.invalid`,
      'Synthetic ' + id,
    ]);
    await db.query(
      "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES ($1,$2,'synthetic',now()+interval '1 hour')",
      [identity.sessionId, id],
    );
  }
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT u.id,r.id FROM users u CROSS JOIN roles r WHERE u.id IN (3,4) AND r.key='super_admin'",
  );
  class FixtureAuthentication {
    canActivate(ctx) {
      const req = ctx.switchToHttp().getRequest();
      const identity = identities.get(req.headers['x-fixture-actor']);
      if (!identity) throw new UnauthorizedException();
      req.auth = {
        user: {
          id: identity.userId,
          name: 'Synthetic',
          email: `synthetic${identity.userId}@example.invalid`,
          image_url: null,
        },
        sessionId: identity.sessionId,
      };
      return true;
    }
  }
  class IsolatedInfra {}
  Global()(IsolatedInfra);
  Module({
    providers: [
      {
        provide: RedisService,
        useValue: {
          async del() {},
          async delByPattern() {},
          async get() {
            return null;
          },
          async set() {},
        },
      },
    ],
    exports: [RedisService],
  })(IsolatedInfra);
  class TestRoot {}
  Module({
    imports: [
      IsolatedInfra,
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      ...moduleRefs,
    ],
    providers: [{ provide: APP_GUARD, useClass: FixtureAuthentication }],
  })(TestRoot);
  app = await NestFactory.create(TestRoot, { logger: false });
  app.set('query parser', (value) => qs.parse(value));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  url = (await app.getUrl()) + '/api/v1';

  const cat = await request('/finance/categories', {
    actor: '1',
    method: 'POST',
    status: 201,
    body: { name: 'Owner category', key: 'owner' },
  });
  const cat2 = await request('/finance/categories', {
    actor: '2',
    method: 'POST',
    status: 201,
    body: { name: 'Other category', key: 'other' },
  });
  const foreign = await request('/finance/categories?owner_id=1', {
    method: 'POST',
    status: 201,
    body: { name: 'Admin created', key: 'admin_created' },
  });
  check('admin create preserves recipient ownership', foreign.user_id === '1');
  await request('/finance/categories?owner_id=1', { actor: '2', status: 403 });
  checks.push('ordinary recipient spoofing denied');
  await request('/finance/categories/' + cat.id, { status: 404 });
  checks.push('admin without recipient stays in own scope');
  check(
    'admin detail reads explicit recipient',
    (await request('/finance/categories/' + cat.id + '?owner_id=1')).user_id ===
      '1',
  );
  await request('/finance/categories/' + cat.id + '?owner_id=1', {
    method: 'PUT',
    body: { name: 'Admin edit' },
  });
  check(
    'edit never transfers historical owner',
    (
      await db.query(
        'SELECT user_id::text FROM finance_categories WHERE id=$1',
        [cat.id],
      )
    )[0].user_id === '1',
  );
  await request('/finance/categories/' + cat.id + '?owner_id=1', {
    method: 'PUT',
    body: { user_id: '3' },
    status: 400,
  });
  checks.push('owner cannot be changed through an update payload');
  const movement = await request('/finance/movements?owner_id=1', {
    method: 'POST',
    status: 201,
    body: {
      name: 'Meal',
      category_id: cat.id,
      amount: '1234',
      type: 'expense',
      status: 'paid',
    },
  });
  check('admin movement belongs to recipient', movement.user_id === '1');
  await request('/finance/movements?owner_id=1', {
    method: 'POST',
    status: 404,
    body: {
      name: 'Wrong category',
      category_id: cat2.id,
      amount: '1234',
      type: 'expense',
      status: 'paid',
    },
  });
  checks.push('cross-owner category association remains rejected');
  const overview = await request('/finance/overview?owner_id=1');
  check(
    'summary aggregates requested owner only',
    overview.totals.expense_amount === '1234',
  );
  check(
    'admin own summary does not inherit recipient',
    (await request('/finance/overview')).totals.expense_amount === '0',
  );
  await request('/finance/categories/' + cat.id + '?owner_id=1', {
    method: 'DELETE',
    status: 409,
  });
  checks.push('admin preserves catalog deletion safeguards');

  const house = await rental('/rental/properties', {
    name: 'Synthetic accommodation',
    max_guests: 4,
    owner_id: '1',
  });
  const houseId = house.resource_id;
  const property = await request('/rental/properties/' + houseId);
  check(
    'admin house create separates owner and audit actor',
    property.owner_id === '1' &&
      property.created_by === '3' &&
      property.membership.type === 'super_admin' &&
      property.membership.can_manage_configuration,
  );
  await request('/rental/properties/' + houseId, { actor: '2', status: 404 });
  checks.push('ordinary unrelated house still hidden');
  await rental(
    '/rental/properties',
    { name: 'Forbidden', max_guests: 4, owner_id: '1' },
    { actor: '2', status: 403 },
  );
  checks.push('ordinary cannot create house for another owner');
  check(
    'admin discovers foreign house',
    (await request('/rental/properties')).data.some((p) => p.id === houseId),
  );
  await rental(
    '/rental/properties/' + houseId,
    { name: 'Admin updated' },
    { method: 'PUT', status: 200 },
  );
  const updated = await request('/rental/properties/' + houseId);
  check(
    'admin update preserves owner and writes real actor',
    updated.owner_id === '1' && updated.updated_by === '3',
  );
  await rental(
    '/rental/properties/' + houseId,
    { owner_id: '3' },
    { method: 'PUT', status: 400 },
  );
  checks.push('house ownership is immutable');
  check(
    'rental journal attributes admin effect',
    (
      await db.query(
        'SELECT actor_id::text FROM rental_audit_events WHERE property_id=$1 ORDER BY id DESC LIMIT 1',
        [houseId],
      )
    )[0].actor_id === '3',
  );

  await request('/role/1', {
    method: 'PUT',
    body: { is_active: false },
    status: 403,
  });
  checks.push('reserved role cannot be disabled');
  const [superRole] = await db.query(
    "SELECT id::text FROM roles WHERE key='super_admin'",
  );
  await request('/role/' + superRole.id, {
    method: 'PATCH',
    body: { key: 'renamed' },
    status: 403,
  });
  checks.push('reserved role key cannot be changed');
  await request('/role/' + superRole.id, { method: 'DELETE', status: 403 });
  checks.push('reserved role cannot be deleted');
  const [nodiaModule] = await db.query(
    "SELECT id::text FROM modules WHERE key='nodia_ai'",
  );
  await request('/module/' + nodiaModule.id, {
    method: 'PUT',
    body: { key: 'renamed' },
    status: 403,
  });
  checks.push('module key immutable in REST update');
  await request('/module/' + nodiaModule.id, {
    method: 'PATCH',
    body: { key: 'renamed' },
    status: 403,
  });
  checks.push('module alias shares key protection');
  const before = await db.query('SELECT name FROM users WHERE id=3');
  await request('/user/3', {
    method: 'PUT',
    body: { name: 'Must roll back', modules: ['9223372036854775807'] },
    status: 400,
  });
  check(
    'failed associations roll back the preceding user update',
    (await db.query('SELECT name FROM users WHERE id=3'))[0].name ===
      before[0].name,
  );

  // Hold an actual domain effect after authority validation; role revocation must wait for its commit.
  const ledger = app.get(FinanceLedgerService),
    originalSave = ledger.saveMovement.bind(ledger);
  let reached, release;
  const reachedGate = new Promise((resolve) => (reached = resolve)),
    releaseGate = new Promise((resolve) => (release = resolve));
  ledger.saveMovement = async (...args) => {
    reached();
    await releaseGate;
    return originalSave(...args);
  };
  const effect = request('/finance/movements?owner_id=1', {
    method: 'POST',
    status: 201,
    body: {
      name: 'Before revoke',
      category_id: cat.id,
      amount: '7',
      type: 'expense',
      status: 'paid',
    },
  });
  await reachedGate;
  const revocation = request('/user/3', {
    actor: '1',
    method: 'PUT',
    body: { roles: [] },
  });
  await waitForAuthorityWriter();
  checks.push('role revocation blocks behind an admitted effect');
  release();
  await effect;
  await revocation;
  ledger.saveMovement = originalSave;
  await request('/finance/movements?owner_id=1', {
    method: 'POST',
    status: 403,
    body: {
      name: 'After revoke',
      category_id: cat.id,
      amount: '7',
      type: 'expense',
      status: 'paid',
    },
  });
  checks.push('revoked admin cannot perform the next foreign effect');
  await request('/rental/properties/' + houseId, { status: 404 });
  checks.push(
    'rental transversal access also disappears after role revocation',
  );
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES (3,$1)', [
    superRole.id,
  ]);

  // A writer that already owns authority must become visible before a waiting REPEATABLE READ snapshot.
  const writer = db.createQueryRunner();
  runners.push(writer);
  await writer.connect();
  await writer.startTransaction();
  await lockAuthority(writer.manager, true);
  await writer.manager.query('DELETE FROM user_roles WHERE user_id=3');
  const waitingOverview = request('/finance/overview?owner_id=1', {
    status: 403,
  });
  await delay(30);
  await writer.commitTransaction();
  await waitingOverview;
  checks.push('waiting repeatable-read query observes preceding revocation');
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES (3,$1)', [
    superRole.id,
  ]);

  // Worker-style NodiaAI execution and the finance port reuse one EntityManager/commit.
  await db.query(
    "INSERT INTO user_modules(user_id,module_id) SELECT 1,id FROM modules WHERE key='nodia_ai' OR link='/finances-personal'",
  );
  const executor = app.get(ExecuteAuthorizedNodiaAiUseCase),
    createMovement = app.get(CreateFinanceMovementUseCase);
  const req = { moduleRoutes: ['/finances-personal'] };
  const Overview = await load(
    'finance-overview/use-case/get-finance-overview.use-case',
    'GetFinanceOverviewUseCase',
  );
  const overviewPort = app.get(Overview);
  await assert.rejects(
    () =>
      executor.execute(identities.get('1'), req, (actor) =>
        overviewPort.execute(actor, {}),
      ),
    (error) => error.status === 403,
  );
  checks.push('snapshot port rejects an inherited weaker isolation');
  const snapshot = await executor.execute(
    identities.get('1'),
    req,
    (actor) => overviewPort.execute(actor, {}),
    'REPEATABLE READ',
  );
  const [expectedSnapshot] = await db.query(
    "SELECT COALESCE(sum(amount),0)::text AS amount FROM finance_movements WHERE user_id=1 AND type='expense' AND status='paid' AND is_active=true",
  );
  check(
    'snapshot port preserves repeatable-read isolation in its parent',
    snapshot.totals.expense_amount === expectedSnapshot.amount,
  );

  const result = await executor.execute(identities.get('1'), req, (actor) =>
    createMovement.execute(actor, {
      name: 'Port',
      category_id: cat.id,
      amount: '5',
      type: 'expense',
      status: 'paid',
    }),
  );
  check(
    'NodiaAI port commits under the same actor and transaction',
    result.user_id === '1',
  );
  const [beforeRollback] = await db.query(
    'SELECT count(*)::int AS count FROM finance_movements',
  );
  await assert.rejects(
    () =>
      executor.execute(identities.get('1'), req, async (actor) => {
        await createMovement.execute(actor, {
          name: 'Rollback port',
          category_id: cat.id,
          amount: '5',
          type: 'expense',
          status: 'paid',
        });
        throw Error('Synthetic outer failure');
      }),
    /Synthetic outer failure/,
  );
  check(
    'outer failure rolls back the domain port effect',
    (await db.query('SELECT count(*)::int AS count FROM finance_movements'))[0]
      .count === beforeRollback.count,
  );
  await db.query(
    "DELETE FROM user_modules WHERE user_id=1 AND module_id IN(SELECT id FROM modules WHERE link='/finances-personal')",
  );
  await assert.rejects(
    () => executor.execute(identities.get('1'), req, () => Promise.resolve()),
    (error) => error.getStatus?.() === 403,
  );
  checks.push('worker module revocation fails before invoking its port');

  // Two independent writers cannot remove both remaining active super administrators.
  const deactivate = async (id) => {
    const r = await fetch(url + '/user/' + id, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-fixture-actor': '1' },
      body: JSON.stringify({ is_active: false }),
    });
    return r.status;
  };
  const outcomes = await Promise.all([deactivate('3'), deactivate('4')]);
  check(
    'concurrent deactivations preserve one active super administrator',
    outcomes.filter((v) => v === 200).length === 1 &&
      outcomes.filter((v) => v === 403).length === 1,
  );
  const [remaining] = await db.query(
    "SELECT u.id::text FROM users u JOIN user_roles ur ON ur.user_id=u.id AND ur.is_active JOIN roles r ON r.id=ur.role_id AND r.key='super_admin' AND r.is_active WHERE u.is_active",
  );
  await request('/user/' + remaining.id, {
    actor: '1',
    method: 'PUT',
    body: { roles: [], name: 'Must remain' },
    status: 403,
  });
  checks.push('last-admin association removal rejects the entire update');
  await request('/user', {
    actor: '1',
    method: 'POST',
    body: {
      email: `synthetic${remaining.id}@example.invalid`,
      roles: [],
      is_active: false,
    },
    status: 403,
  });
  checks.push('create-upsert cannot bypass last-admin protection');
  await db.query(
    'UPDATE auth_sessions SET revoked_at=now() WHERE public_id=$1',
    [identities.get('1').sessionId],
  );
  await request('/finance/categories', { actor: '1', status: 401 });
  checks.push('revoked session rejected inside the shared finance boundary');
  await request('/rental/properties/' + houseId, { actor: '1', status: 401 });
  checks.push('revoked session rejected inside rental boundary');
  await request('/user/2', {
    actor: '1',
    method: 'PUT',
    body: { name: 'Denied' },
    status: 401,
  });
  checks.push('revoked session rejected inside administrative write boundary');
  console.log(
    JSON.stringify({
      task: 'AI-08',
      scope: 'compiled_http_and_domain_ports_disposable_postgresql16',
      checks: checks.length,
      passed: checks,
      configuredDatabaseTouched: false,
      providersCalled: false,
    }),
  );
} finally {
  for (const runner of runners) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await runner.release();
  }
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '-f', container);
}
