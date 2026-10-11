import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import { DataSource } from 'typeorm';
import { NestFactory } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';
import {
  Module,
  ValidationPipe,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import qs from 'qs';
import { CreatePersonalFinance1791085000000 } from '../dist/migrations/1791085000000-CreatePersonalFinance.js';
import { FinanceCategoryModule } from '../dist/finance-category/finance-category.module.js';
import { FinanceCategoryGroupModule } from '../dist/finance-category-group/finance-category-group.module.js';
import { FinanceMovementModule } from '../dist/finance-movement/finance-movement.module.js';
import { FinanceLedgerService } from '../dist/finance-obligation/finance-ledger.service.js';
import { FinanceObligationModule } from '../dist/finance-obligation/finance-obligation.module.js';
import { FinanceOverviewModule } from '../dist/finance-overview/finance-overview.module.js';
import { SeedFinanceNavigationUseCase } from '../dist/finance-navigation/use-case/seed-finance-navigation.use-case.js';
import { FinanceNavigationService } from '../dist/finance-navigation/finance-navigation.service.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';

// Deliberately owns a fresh Docker instance: never reads the developer's .env or DB.
const container = `template_finance_integration_${process.pid}`;
const password = randomBytes(24).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let db;
let app;
let started = false;
const fixtures = {};
const checks = [];

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
    'POSTGRES_DB=finance_test',
    '--env',
    'POSTGRES_USER=finance_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  const port = Number(docker('port', container, '5432/tcp').split(':').at(-1));
  const options = {
    type: 'postgres',
    host: '127.0.0.1',
    port,
    username: 'finance_test',
    password,
    database: 'finance_test',
    synchronize: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
    migrations: [CreatePersonalFinance1791085000000],
  };
  for (let attempt = 0; attempt < 80; attempt++) {
    db = new DataSource(options);
    try {
      await db.initialize();
      break;
    } catch (error) {
      if (attempt === 79) throw error;
      await delay(250);
    }
  }
  await db.query(`CREATE TABLE users (id BIGSERIAL PRIMARY KEY,name VARCHAR(255),email TEXT NOT NULL UNIQUE,
    image_url TEXT,google_sub VARCHAR(255),is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),updated_at TIMESTAMP DEFAULT now());
    INSERT INTO users(name,email) VALUES ('Synthetic A','a@example.invalid'),('Synthetic B','b@example.invalid');
    CREATE TABLE legacy_probe(id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO legacy_probe VALUES(1,'preserved');
    CREATE TABLE module_groups(id BIGSERIAL PRIMARY KEY,key VARCHAR(255) UNIQUE NOT NULL,icon VARCHAR(255),is_active BOOLEAN DEFAULT true,created_at TIMESTAMP DEFAULT now(),updated_at TIMESTAMP DEFAULT now());
    CREATE TABLE modules(id BIGSERIAL PRIMARY KEY,module_group_id BIGINT REFERENCES module_groups(id),key VARCHAR(255) UNIQUE NOT NULL,link VARCHAR(255) NOT NULL,icon VARCHAR(255),is_active BOOLEAN DEFAULT true,created_at TIMESTAMP DEFAULT now(),updated_at TIMESTAMP DEFAULT now());
    CREATE TABLE translations(id BIGSERIAL PRIMARY KEY,source_entity VARCHAR(255),source_id VARCHAR(255),source_key VARCHAR(255),locale VARCHAR(10),value TEXT,is_active BOOLEAN DEFAULT true,created_at TIMESTAMP DEFAULT now(),updated_at TIMESTAMP DEFAULT now(),UNIQUE(source_entity,source_id,source_key,locale));
    CREATE TABLE user_modules(id BIGSERIAL PRIMARY KEY,user_id BIGINT,module_id BIGINT);`);
  await db.runMigrations();
  await db.undoLastMigration();
  assert.deepEqual(await db.query('SELECT * FROM legacy_probe'), [
    { id: 1, value: 'preserved' },
  ]);
  await db.runMigrations();
  checks.push(
    'Incremental migration up/down/up; existing synthetic data preserved.',
  );
  const schemaDifference = await db.driver.createSchemaBuilder().log();
  const financeChanges = schemaDifference.upQueries.filter((entry) =>
    /(?:ALTER TABLE|DROP TABLE|CREATE TABLE|(?:CREATE|DROP) (?:UNIQUE )?INDEX).*finance_/i.test(
      entry.query,
    ),
  );
  assert.deepEqual(
    financeChanges.map((entry) => entry.query),
    [],
    'Finance entity metadata differs from its migration',
  );
  checks.push(
    'Finance entity metadata matches the migrated database without automatic synchronization.',
  );

  const seed = new SeedFinanceNavigationUseCase(
    db,
    new FinanceNavigationService(),
  );
  const seedOne = await seed.execute();
  assert.deepEqual(await seed.execute(), seedOne);
  assert.equal(
    (await db.query('SELECT count(*)::int AS count FROM user_modules'))[0]
      .count,
    0,
  );
  assert.equal(
    (await db.query('SELECT count(*)::int AS count FROM translations'))[0]
      .count,
    4,
  );
  checks.push(
    'Navigation seed repeatable, four translations, no module assignments.',
  );

  class FinanceTestModule {}
  Module({
    imports: [
      TypeOrmModule.forRoot(options),
      FinanceCategoryModule,
      FinanceCategoryGroupModule,
      FinanceObligationModule,
      FinanceMovementModule,
      FinanceOverviewModule,
    ],
    providers: [
      {
        provide: APP_GUARD,
        useValue: {
          canActivate(context) {
            const request = context.switchToHttp().getRequest();
            const id = request.headers['x-synthetic-user'];
            if (id !== '1' && id !== '2') throw new UnauthorizedException();
            request.auth = {
              user: {
                id,
                name: `Synthetic ${id}`,
                email: `${id}@example.invalid`,
                image_url: null,
              },
              sessionId: 'synthetic',
            };
            return true;
          },
        },
      },
    ],
  })(FinanceTestModule);
  app = await NestFactory.create(FinanceTestModule, { logger: false });
  Logger.overrideLogger(false);
  app.useGlobalFilters(new AllExceptionsFilter());
  app
    .getHttpAdapter()
    .getInstance()
    .set('query parser', (text) => qs.parse(text));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1/finance`;
  async function http(method, path, body, expected = 200, user = '1') {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(user === null ? {} : { 'x-synthetic-user': user }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? null : await response.json();
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${JSON.stringify(data)}`,
    );
    return data;
  }
  const cat = await http(
    'POST',
    '/categories',
    { name: 'Synthetic category', key: 'shared' },
    201,
  );
  const foreign = await http(
    'POST',
    '/categories',
    { name: 'Other owner', key: 'shared' },
    201,
    '2',
  );
  const zeroCat = await http(
    'POST',
    '/categories',
    { name: 'Zero category', key: 'zero' },
    201,
  );
  const group = await http(
    'POST',
    '/category-groups',
    { name: 'Synthetic group', key: 'group', category_ids: [cat.id] },
    201,
  );
  const secondGroup = await http(
    'POST',
    '/category-groups',
    { name: 'Overlapping group', key: 'group2', category_ids: [cat.id] },
    201,
  );
  await http('PUT', `/category-groups/${group.id}`, { category_ids: [] });
  await http('PUT', `/category-groups/${group.id}`, { category_ids: [cat.id] });
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS count FROM finance_category_group_memberships WHERE category_group_id=$1',
        [group.id],
      )
    )[0].count,
    1,
  );
  await http('POST', '/categories', { name: 'Duplicate', key: 'shared' }, 409);
  for (const body of [
    { name: 'Invalid', key: 'invalid', user_id: '2' },
    { name: 'Invalid', key: 'invalid', is_active: 'false' },
    { name: null, key: 'invalid' },
  ]) {
    await http('POST', '/categories', body, 400);
  }
  await http('GET', '/categories', undefined, 401, null);
  await http('GET', `/categories/${cat.id}`, undefined, 404, '2');
  await http('PUT', `/categories/${cat.id}`, { is_active: false }, 404, '2');
  await http(
    'POST',
    '/category-groups',
    { name: 'Foreign membership', key: 'bad', category_ids: [foreign.id] },
    404,
  );
  await http('GET', '/categories?all=true', undefined, 400);
  await http('GET', '/categories?limit=101', undefined, 400);
  await http('GET', '/categories?q[user_id_eq]=2', undefined, 400);
  await http('GET', '/movements?q[s]=name%20desc%3BSELECT%201', undefined, 400);
  await http('GET', '/movements?q[name_cont][nested]=bad', undefined, 400);
  await http('GET', '/movements?category_ids[0]=0', undefined, 400);
  await http(
    'GET',
    '/movements?category_ids[0]=1&category_ids[1]=1',
    undefined,
    400,
  );
  await http('GET', '/movements?active=false', undefined, 400);
  checks.push(
    'Compiled Nest DI/ESM, DTO whitelist, strict booleans, bounds and hostile filters over real HTTP.',
  );

  const loan = await http(
    'POST',
    '/obligations',
    {
      name: 'Synthetic loan',
      key: 'loan',
      type: 'loan',
      amount: '100000',
      category_id: cat.id,
    },
    201,
  );
  assert.equal(loan.amount, '100000');
  assert.equal(loan.remaining_amount, '100000');
  assert.equal(loan.initial_movement.type, 'expense');
  const repayBody = {
    name: 'Synthetic repayment',
    category_id: cat.id,
    obligation_id: loan.id,
    type: 'income',
    status: 'received',
    amount: '20000',
  };
  const repayment = await http('POST', '/movements', repayBody, 201);
  await http(
    'POST',
    '/movements',
    { ...repayBody, name: 'Second repayment' },
    201,
  );
  let currentLoan = await http('GET', `/obligations/${loan.id}`);
  assert.equal(currentLoan.amount, '100000');
  assert.equal(currentLoan.remaining_amount, '60000');
  await http('PUT', `/movements/${repayment.id}`, { is_active: false });
  assert.equal(
    (await http('GET', `/obligations/${loan.id}`)).remaining_amount,
    '60000',
  );
  await http(
    'PUT',
    `/movements/${loan.initial_movement.id}`,
    { amount: '99999' },
    409,
  );
  await http(
    'PUT',
    `/movements/${loan.initial_movement.id}`,
    { status: 'cancelled' },
    409,
  );
  await http('PUT', `/obligations/${loan.id}`, { amount: '39999' }, 409);
  await http('PUT', `/obligations/${loan.id}`, { amount: '120000' });
  currentLoan = await http('GET', `/obligations/${loan.id}`);
  assert.equal(currentLoan.amount, '120000');
  assert.equal(currentLoan.initial_movement.amount, '120000');
  assert.equal(currentLoan.remaining_amount, '80000');
  await http('POST', '/movements', { ...repayBody, amount: '80001' }, 409);
  await http(
    'POST',
    '/movements',
    { ...repayBody, type: 'expense', status: 'paid' },
    400,
  );
  await http('GET', `/movements/${repayment.id}`, undefined, 404, '2');
  await http(
    'PUT',
    `/movements/${repayment.id}`,
    { name: 'Attempt' },
    404,
    '2',
  );
  await http('GET', `/obligations/${loan.id}`, undefined, 404, '2');
  await http('PUT', `/obligations/${loan.id}`, { amount: '100000' }, 404, '2');
  await http('GET', `/category-groups/${group.id}`, undefined, 404, '2');
  await http(
    'PUT',
    `/category-groups/${group.id}`,
    { category_ids: [] },
    404,
    '2',
  );
  for (const amount of [
    0,
    1.5,
    '1.5',
    '1e3',
    '0',
    '9223372036854775808',
    '-1',
    null,
  ]) {
    await http(
      'POST',
      '/movements',
      { ...repayBody, obligation_id: null, amount },
      400,
    );
  }
  const queryGroups = qs.stringify({
    active: 'all',
    category_group_ids: [group.id, secondGroup.id],
  });
  const grouped = await http('GET', `/movements?${queryGroups}`);
  assert.equal(grouped.meta.total_items, 3);
  const overview = await http('GET', '/overview');
  assert.equal(overview.totals.income_amount, '20000');
  assert.equal(overview.totals.expense_amount, '120000');
  assert.equal(overview.obligations.loan_remaining_amount, '80000');
  const catsOverview = await http('GET', '/overview/categories');
  assert.equal(
    catsOverview.data.find((c) => c.id === zeroCat.id).income_amount,
    '0',
  );
  const groupOverview = await http('GET', '/overview/category-groups');
  assert.equal(
    groupOverview.data.find((g) => g.id === group.id).expense_amount,
    '120000',
  );
  assert.equal(
    groupOverview.data.find((g) => g.id === secondGroup.id).expense_amount,
    '120000',
  );
  const timeOverview = await http(
    'GET',
    `/overview?${qs.stringify({ q: { created_at_gteq: '2099-01-01T00:00:00Z' } })}`,
  );
  assert.equal(timeOverview.totals.income_amount, '0');
  assert.equal(timeOverview.obligations.loan_remaining_amount, '80000');
  await http('PUT', `/movements/${repayment.id}`, { status: 'cancelled' });
  assert.equal(
    (await http('GET', `/obligations/${loan.id}`)).remaining_amount,
    '100000',
  );
  await http('PUT', `/movements/${repayment.id}`, { status: 'received' }, 409);
  checks.push(
    '100000 - 20000 - 20000 = 60000; archive retains paid balance; partial payments, principal and cancellation rules.',
  );

  const raceLoan = await http(
    'POST',
    '/obligations',
    {
      name: 'Concurrent loan',
      key: 'race',
      type: 'loan',
      amount: '100',
      category_id: cat.id,
    },
    201,
  );
  const results = await Promise.all(
    Array.from({ length: 2 }, () =>
      fetch(`${base}/movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-synthetic-user': '1',
        },
        body: JSON.stringify({
          ...repayBody,
          obligation_id: raceLoan.id,
          amount: '60',
        }),
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await http('GET', `/obligations/${raceLoan.id}`)).remaining_amount,
    '40',
  );
  checks.push(
    'Concurrent payments: only one 60/100 succeeds, remaining 40, real PostgreSQL row locks.',
  );

  const pendingLoan = await http(
    'POST',
    '/obligations',
    {
      name: 'Pending race',
      key: 'pending-race',
      type: 'loan',
      amount: '100',
      category_id: cat.id,
    },
    201,
  );
  const pendingPayments = await Promise.all(
    Array.from({ length: 2 }, () =>
      http(
        'POST',
        '/movements',
        {
          ...repayBody,
          obligation_id: pendingLoan.id,
          amount: '70',
          status: 'pending',
        },
        201,
      ),
    ),
  );
  const confirmations = await Promise.all(
    pendingPayments.map((payment) =>
      fetch(`${base}/movements/${payment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-synthetic-user': '1',
        },
        body: JSON.stringify({ status: 'received' }),
      }),
    ),
  );
  assert.deepEqual(confirmations.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await http('GET', `/obligations/${pendingLoan.id}`)).remaining_amount,
    '30',
  );
  const cancelRace = await http(
    'POST',
    '/obligations',
    {
      name: 'Cancel race',
      key: 'cancel-race',
      type: 'loan',
      amount: '100',
      category_id: cat.id,
    },
    201,
  );
  const cancellationRace = await Promise.all([
    fetch(`${base}/movements/${cancelRace.initial_movement.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-synthetic-user': '1' },
      body: JSON.stringify({ status: 'cancelled' }),
    }),
    fetch(`${base}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-synthetic-user': '1' },
      body: JSON.stringify({
        ...repayBody,
        obligation_id: cancelRace.id,
        amount: '60',
      }),
    }),
  ]);
  assert.equal(cancellationRace.filter((r) => r.ok).length, 1);
  assert.equal(cancellationRace.filter((r) => r.status === 409).length, 1);
  const afterCancellationRace = await http(
    'GET',
    `/obligations/${cancelRace.id}`,
  );
  assert.ok(
    afterCancellationRace.remaining_amount === null ||
      afterCancellationRace.remaining_amount === '40',
  );
  checks.push(
    'Concurrent pending confirmations and origin cancellation/payment preserve a valid settlement.',
  );

  // Synthetic failures between the two writes verify actual rollback, rather than a mock callback.
  await db.query(`CREATE FUNCTION fail_finance_initial() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.name='Rollback creation' THEN RAISE EXCEPTION 'synthetic insertion failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_fail_initial BEFORE INSERT ON finance_movements FOR EACH ROW EXECUTE FUNCTION fail_finance_initial()`);
  await http(
    'POST',
    '/obligations',
    {
      name: 'Rollback creation',
      key: 'rollback',
      type: 'loan',
      amount: '100',
      category_id: cat.id,
    },
    500,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM finance_obligations WHERE key='rollback'",
      )
    )[0].count,
    0,
  );
  await db.query(
    'DROP TRIGGER test_fail_initial ON finance_movements; DROP FUNCTION fail_finance_initial()',
  );
  await db.query(`CREATE FUNCTION fail_finance_amount() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.amount=123456 THEN RAISE EXCEPTION 'synthetic update failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_fail_amount BEFORE UPDATE ON finance_movements FOR EACH ROW EXECUTE FUNCTION fail_finance_amount()`);
  await http('PUT', `/obligations/${loan.id}`, { amount: '123456' }, 500);
  currentLoan = await http('GET', `/obligations/${loan.id}`);
  assert.equal(currentLoan.amount, '120000');
  assert.equal(currentLoan.initial_movement.amount, '120000');
  await db.query(
    'DROP TRIGGER test_fail_amount ON finance_movements; DROP FUNCTION fail_finance_amount()',
  );
  checks.push(
    'Real rollback of obligation+initial movement and both principal updates after injected DB failures.',
  );

  await assert.rejects(
    db.query(
      `INSERT INTO finance_movements(user_id,category_id,name,amount,type,status) VALUES(1,$1,'Invalid FK',1,'income','received')`,
      [foreign.id],
    ),
    { code: '23503' },
  );
  await assert.rejects(
    db.query(
      `INSERT INTO finance_movements(user_id,category_id,name,amount,type,status) VALUES(1,$1,'Invalid status',1,'income','paid')`,
      [cat.id],
    ),
    { code: '23514' },
  );
  await assert.rejects(
    db.query(
      `INSERT INTO finance_movements(user_id,category_id,name,amount,type,status) VALUES(1,$1,'Invalid amount',0,'income','received')`,
      [cat.id],
    ),
    { code: '23514' },
  );
  await assert.rejects(
    db.query(
      `INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Duplicate','shared')`,
    ),
    { code: '23505' },
  );
  checks.push(
    'Real PostgreSQL composite FK, CHECK and UNIQUE reject invalid ownership/status/amount/key.',
  );
  await assert.rejects(
    db.query(
      `INSERT INTO finance_movements(user_id,category_id,obligation_id,name,amount,type,status) VALUES(2,$1,$2,'Foreign obligation',1,'income','received')`,
      [foreign.id, loan.id],
    ),
    { code: '23503' },
  );
  await assert.rejects(
    db.query(
      `INSERT INTO finance_category_group_memberships(user_id,category_group_id,category_id) VALUES(1,$1,$2)`,
      [group.id, foreign.id],
    ),
    { code: '23503' },
  );
  await http(
    'POST',
    '/obligations',
    {
      name: 'Foreign category',
      key: 'foreign',
      type: 'loan',
      amount: '1',
      category_id: foreign.id,
    },
    404,
  );
  await http(
    'POST',
    '/movements',
    { ...repayBody, category_id: foreign.id },
    404,
    '2',
  );

  await http('PUT', `/categories/${cat.id}`, { is_active: false });
  await http('PUT', `/movements/${repayment.id}`, { name: 'Historical edit' });
  await http('POST', '/movements', { ...repayBody, obligation_id: null }, 409);
  await http('PUT', `/categories/${cat.id}`, { is_active: true });
  const cancelledOrigin = await http(
    'POST',
    '/obligations',
    {
      name: 'Cancelled origin',
      key: 'cancel',
      type: 'debt',
      amount: '1',
      category_id: cat.id,
    },
    201,
  );
  await http('PUT', `/movements/${cancelledOrigin.initial_movement.id}`, {
    status: 'cancelled',
  });
  assert.equal(
    (await http('GET', `/obligations/${cancelledOrigin.id}`)).remaining_amount,
    null,
  );
  await http(
    'POST',
    '/movements',
    {
      ...repayBody,
      type: 'expense',
      status: 'paid',
      obligation_id: cancelledOrigin.id,
      amount: '1',
    },
    409,
  );
  // Large values prove exact JSON/string aggregates beyond JS safe integer range.
  await http(
    'POST',
    '/movements',
    {
      name: 'Large exact amount',
      category_id: cat.id,
      type: 'income',
      status: 'received',
      amount: '9007199254740993',
    },
    201,
  );
  const exactSum = await http(
    'GET',
    `/overview?${qs.stringify({ q: { name_cont: 'Large exact amount' } })}`,
  );
  assert.equal(exactSum.totals.income_amount, '9007199254740993');
  checks.push(
    'Historical inactive associations, cancelled-origin null balance, exact sums beyond JS safe integer.',
  );
  for (let index = 0; index < 2; index++) {
    await http(
      'POST',
      '/movements',
      {
        name: 'Synthetic bigint sum',
        category_id: cat.id,
        type: 'income',
        status: 'received',
        amount: '9223372036854775807',
      },
      201,
    );
  }
  const bigintSum = await http(
    'GET',
    `/overview?${qs.stringify({ q: { name_cont: 'Synthetic bigint sum' } })}`,
  );
  assert.equal(bigintSum.totals.income_amount, '18446744073709551614');
  checks.push(
    'Exact SUM exceeds both JS safe integer and PostgreSQL per-row bigint range.',
  );

  const volumeCat = await http(
    'POST',
    '/categories',
    { name: 'Volume category', key: 'volume' },
    201,
  );
  await db.query(
    `INSERT INTO finance_movements(user_id,category_id,name,amount,type,status)
    SELECT 1,$1,'Synthetic volume ' || n,1,'income','received' FROM generate_series(1,2000) AS n`,
    [volumeCat.id],
  );
  const volumeQuery = { category_ids: [volumeCat.id] };
  const volumePage = await http(
    'GET',
    `/movements?${qs.stringify(volumeQuery)}`,
  );
  assert.equal(volumePage.data.length, 10);
  assert.equal(volumePage.meta.total_items, 2000);
  const secondPage = await http(
    'GET',
    `/movements?${qs.stringify({ ...volumeQuery, page: 2 })}`,
  );
  assert.ok(
    secondPage.data.every(
      (row) => !volumePage.data.some((first) => first.id === row.id),
    ),
  );
  const volumeTotals = await http(
    'GET',
    `/overview?${qs.stringify(volumeQuery)}`,
  );
  assert.equal(volumeTotals.totals.income_amount, '2000');
  assert.equal(volumeTotals.totals.movement_count, 2000);
  await db.query('ANALYZE finance_movements');
  const plans = await db.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT id FROM finance_movements WHERE user_id=1 AND category_id=$1 AND is_active=true ORDER BY created_at DESC,id DESC LIMIT 10`,
    [volumeCat.id],
  );
  assert.equal(plans[0]['QUERY PLAN'][0].Plan['Actual Rows'], 10);
  const noForeignCategory = await http(
    'GET',
    `/movements?${qs.stringify({ category_ids: [foreign.id] })}`,
  );
  assert.equal(noForeignCategory.meta.total_items, 0);
  checks.push(
    '2000-row dataset: total across pages, stable order, exact aggregate and EXPLAIN ANALYZE recorded.',
  );

  // Simulate a client ignoring the committed response; recover via a fresh read, never a blind POST retry.
  const ignoredResponse = await fetch(`${base}/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-synthetic-user': '1' },
    body: JSON.stringify({
      name: 'Synthetic ignored response',
      category_id: cat.id,
      amount: '1',
      type: 'income',
      status: 'pending',
    }),
  });
  assert.equal(ignoredResponse.status, 201);
  await ignoredResponse.body.cancel();
  assert.equal(
    (
      await http(
        'GET',
        `/movements?${qs.stringify({ q: { name_cont: 'Synthetic ignored response' } })}`,
      )
    ).meta.total_items,
    1,
  );
  checks.push(
    'Committed write recovered by refetch after ignored response; no persistent retry deduplication claimed.',
  );

  fixtures.categories = await http('GET', '/categories');
  fixtures.category = await http('GET', `/categories/${cat.id}`);
  fixtures.category_groups = await http('GET', '/category-groups');
  fixtures.category_group = await http('GET', `/category-groups/${group.id}`);
  fixtures.movements = await http('GET', '/movements');
  fixtures.movement = await http('GET', `/movements/${repayment.id}`);
  fixtures.obligations = await http('GET', '/obligations');
  fixtures.obligation = await http('GET', `/obligations/${loan.id}`);
  fixtures.created_obligation = loan;
  fixtures.created_movement = repayment;
  fixtures.errors = {
    invalid_filter: await http(
      'GET',
      '/movements?q[user_id_eq]=2',
      undefined,
      400,
    ),
    missing_or_other_owner: await http(
      'GET',
      `/obligations/${loan.id}`,
      undefined,
      404,
      '2',
    ),
    principal_conflict: await http(
      'PUT',
      `/obligations/${loan.id}`,
      { amount: '1' },
      409,
    ),
  };
  fixtures.overview = await http('GET', '/overview');
  fixtures.overview_categories = await http('GET', '/overview/categories');
  fixtures.overview_category_groups = await http(
    'GET',
    '/overview/category-groups',
  );
  const foreignOverview = await http('GET', '/overview', undefined, 200, '2');
  assert.equal(foreignOverview.totals.income_amount, '0');
  assert.equal(foreignOverview.obligations.loan_remaining_amount, '0');
  const swagger = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Personal Finance isolated contract')
      .setVersion('1')
      .build(),
  );
  assert.equal(Object.keys(swagger.paths).length, 11);

  // DELETE contract: all records below are disposable in this fresh database.
  for (const resource of [
    'categories',
    'category-groups',
    'movements',
    'obligations',
  ]) {
    assert.ok(swagger.paths[`/api/v1/finance/${resource}/{id}`].delete);
    await http('DELETE', `/${resource}/1`, undefined, 401, null);
    await http('DELETE', `/${resource}/not-bigint`, undefined, 400);
    await http('DELETE', `/${resource}/9007199254740993`, undefined, 404);
  }
  const dc = await http(
    'POST',
    '/categories',
    { name: 'Delete free', key: 'delete_free' },
    201,
  );
  const linkedCat = await http(
    'POST',
    '/categories',
    { name: 'Delete linked', key: 'delete_linked' },
    201,
  );
  const dg = await http(
    'POST',
    '/category-groups',
    {
      name: 'Delete group',
      key: 'delete_group',
      category_ids: [dc.id, linkedCat.id],
    },
    201,
  );
  await http('DELETE', `/categories/${dc.id}`, undefined, 404, '2');
  await http('DELETE', `/category-groups/${dg.id}`, undefined, 404, '2');
  await http('DELETE', `/categories/${dc.id}`, undefined, 204);
  assert.equal(
    (await http('GET', `/category-groups/${dg.id}`)).category_count,
    1,
  );
  const dm = await http(
    'POST',
    '/movements',
    {
      name: 'Delete movement',
      amount: '100',
      type: 'income',
      status: 'received',
      category_id: linkedCat.id,
    },
    201,
  );
  await http('PUT', `/movements/${dm.id}`, { is_active: false });
  assert.equal(
    (await http('DELETE', `/categories/${linkedCat.id}`, undefined, 409))
      .message,
    'finance:category_has_movements',
  );
  await http('DELETE', `/movements/${dm.id}`, undefined, 404, '2');
  const beforeDelete = (await http('GET', '/overview?active=all')).totals
    .income_amount;
  await http('DELETE', `/movements/${dm.id}`, undefined, 204);
  assert.equal(
    BigInt((await http('GET', '/overview?active=all')).totals.income_amount),
    BigInt(beforeDelete) - 100n,
  );
  await http('DELETE', `/category-groups/${dg.id}`, undefined, 204);
  await http('GET', `/categories/${linkedCat.id}`);
  await http('DELETE', `/categories/${linkedCat.id}`, undefined, 204);

  for (const type of ['loan', 'debt']) {
    const oc = await http(
      'POST',
      '/categories',
      { name: 'Obligation delete ' + type, key: 'obligation_delete_' + type },
      201,
    );
    const o = await http(
      'POST',
      '/obligations',
      {
        name: 'Delete ' + type,
        key: 'delete_' + type,
        type,
        amount: '1000',
        category_id: oc.id,
      },
      201,
    );
    await http('DELETE', `/obligations/${o.id}`, undefined, 404, '2');
    assert.equal(
      (
        await http(
          'DELETE',
          `/movements/${o.initial_movement.id}`,
          undefined,
          409,
        )
      ).message,
      'finance:delete_initial_on_obligation',
    );
    const p = await http(
      'POST',
      '/movements',
      {
        name: 'Repayment',
        type: type === 'loan' ? 'income' : 'expense',
        status: 'pending',
        amount: '250',
        obligation_id: o.id,
        category_id: oc.id,
      },
      201,
    );
    for (const status of [
      'pending',
      type === 'loan' ? 'received' : 'paid',
      'cancelled',
    ]) {
      await http('PUT', `/movements/${p.id}`, { status, is_active: false });
      assert.equal(
        (await http('DELETE', `/obligations/${o.id}`, undefined, 409)).message,
        'finance:obligation_has_payments',
      );
    }
    await http('DELETE', `/movements/${p.id}`, undefined, 204);
    const confirmed = await http(
      'POST',
      '/movements',
      {
        name: 'Confirmed deletion',
        type: type === 'loan' ? 'income' : 'expense',
        status: type === 'loan' ? 'received' : 'paid',
        amount: '250',
        obligation_id: o.id,
        category_id: oc.id,
      },
      201,
    );
    assert.equal(
      (await http('GET', `/obligations/${o.id}`)).remaining_amount,
      '750',
    );
    await http('DELETE', `/movements/${confirmed.id}`, undefined, 204);
    assert.equal(
      (await http('GET', `/obligations/${o.id}`)).remaining_amount,
      '1000',
    );
    await http('DELETE', `/obligations/${o.id}`, undefined, 204);
    await http('GET', `/movements/${o.initial_movement.id}`, undefined, 404);
    await http('DELETE', `/obligations/${o.id}`, undefined, 404);
    await http('DELETE', `/categories/${oc.id}`, undefined, 204);
  }
  const rbCat = await http(
    'POST',
    '/categories',
    { name: 'Loan rollback category', key: 'loan_delete_rollback' },
    201,
  );
  const rbOb = await http(
    'POST',
    '/obligations',
    {
      name: 'Loan rollback',
      key: 'loan_delete_rollback',
      type: 'loan',
      amount: '1000',
      category_id: rbCat.id,
    },
    201,
  );
  await db.query(`CREATE FUNCTION reject_obligation_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic final delete failure'; END $$;
    CREATE TRIGGER reject_obligation_delete BEFORE DELETE ON finance_obligations FOR EACH ROW EXECUTE FUNCTION reject_obligation_delete()`);
  await http('DELETE', `/obligations/${rbOb.id}`, undefined, 500);
  assert.equal(
    (await http('GET', `/movements/${rbOb.initial_movement.id}`)).amount,
    '1000',
  );
  assert.equal(
    (await http('GET', `/obligations/${rbOb.id}`)).remaining_amount,
    '1000',
  );
  await db.query(
    'DROP TRIGGER reject_obligation_delete ON finance_obligations; DROP FUNCTION reject_obligation_delete()',
  );
  await http('DELETE', `/obligations/${rbOb.id}`, undefined, 204);
  await http('DELETE', `/categories/${rbCat.id}`, undefined, 204);
  checks.push(
    'Deleting confirmed loan/debt repayments increases outstanding from750 to1000; failure on final obligation DELETE restores initial movement and obligation.',
  );

  // Force both lock acquisition orders using the real persistence method;
  // the gate pauses only after PostgreSQL has acquired the parent row lock.
  const ledgerForRace = app.get(FinanceLedgerService);
  for (const firstMethod of ['DELETE', 'POST']) {
    const raceCat = await http(
      'POST',
      '/categories',
      { name: 'Delete race ' + firstMethod, key: 'delete_race_' + firstMethod },
      201,
    );
    const raceOb = await http(
      'POST',
      '/obligations',
      {
        name: 'Delete race ' + firstMethod,
        key: 'delete_race_' + firstMethod,
        type: 'loan',
        amount: '1000',
        category_id: raceCat.id,
      },
      201,
    );
    const original = ledgerForRace.obligation.bind(ledgerForRace);
    let entered, release;
    const locked = new Promise((resolve) => (entered = resolve));
    const gate = new Promise((resolve) => (release = resolve));
    let gated = false;
    ledgerForRace.obligation = async (...args) => {
      const row = await original(...args);
      if (args[2] === raceOb.id && !gated) {
        gated = true;
        entered();
        await gate;
      }
      return row;
    };
    const requestDelete = () =>
      fetch(`${base}/obligations/${raceOb.id}`, {
        method: 'DELETE',
        headers: { 'x-synthetic-user': '1' },
      });
    const requestPayment = () =>
      fetch(`${base}/movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-synthetic-user': '1',
        },
        body: JSON.stringify({
          name: 'Race repayment',
          type: 'income',
          status: 'received',
          amount: '250',
          category_id: raceCat.id,
          obligation_id: raceOb.id,
        }),
      });
    try {
      const first =
        firstMethod === 'DELETE' ? requestDelete() : requestPayment();
      await locked;
      const second =
        firstMethod === 'DELETE' ? requestPayment() : requestDelete();
      release();
      const results = await Promise.all([first, second]);
      assert.deepEqual(
        results.map((r) => r.status),
        firstMethod === 'DELETE' ? [204, 404] : [201, 409],
      );
      if (firstMethod === 'POST') {
        assert.equal(
          (await http('GET', `/obligations/${raceOb.id}`)).remaining_amount,
          '750',
        );
        const payment = await results[0].json();
        await http('DELETE', `/movements/${payment.id}`, undefined, 204);
        await http('DELETE', `/obligations/${raceOb.id}`, undefined, 204);
      }
    } finally {
      release();
      ledgerForRace.obligation = original;
    }
    await http('DELETE', `/categories/${raceCat.id}`, undefined, 204);
  }
  checks.push(
    'Real PostgreSQL deletion/repayment race, both forced lock orders: deletion first gives 204/404; repayment first gives 201/409, preserving 750 remaining.',
  );
  // Rollback after deleting a membership but before deleting its category.
  const rollbackCat = await http(
    'POST',
    '/categories',
    { name: 'Rollback category', key: 'rollback_delete' },
    201,
  );
  const rollbackGroup = await http(
    'POST',
    '/category-groups',
    {
      name: 'Rollback group',
      key: 'rollback_delete',
      category_ids: [rollbackCat.id],
    },
    201,
  );
  await db.query(`CREATE FUNCTION reject_finance_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic delete failure'; END $$;
    CREATE TRIGGER reject_finance_delete BEFORE DELETE ON finance_categories FOR EACH ROW EXECUTE FUNCTION reject_finance_delete()`);
  await http('DELETE', `/categories/${rollbackCat.id}`, undefined, 500);
  assert.equal(
    (await http('GET', `/category-groups/${rollbackGroup.id}`)).category_count,
    1,
  );
  await db.query(
    'DROP TRIGGER reject_finance_delete ON finance_categories; DROP FUNCTION reject_finance_delete()',
  );
  await http('DELETE', `/category-groups/${rollbackGroup.id}`, undefined, 204);
  await http('DELETE', `/categories/${rollbackCat.id}`, undefined, 204);
  checks.push(
    'DELETE HTTP/DI/DTO/owner bigint: categories with any movement protected; memberships cleaned without losing categories; ordinary movement and loan/debt initial deletion adjust history; all repayment states prevent obligation deletion; injected delete failure rolls back membership cleanup.',
  );

  const dump = docker(
    'exec',
    container,
    'pg_dump',
    '--username=finance_test',
    '--dbname=finance_test',
    '--no-owner',
    '--no-acl',
  );
  await db.query('CREATE DATABASE finance_restored');
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '--username=finance_test',
      '--dbname=finance_restored',
      '--set=ON_ERROR_STOP=1',
    ],
    { input: dump, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const restored = new DataSource({ ...options, database: 'finance_restored' });
  try {
    await restored.initialize();
    assert.deepEqual(
      await restored.query(
        'SELECT amount::text FROM finance_obligations WHERE id=$1',
        [loan.id],
      ),
      [{ amount: '120000' }],
    );
    assert.deepEqual(await restored.query('SELECT * FROM legacy_probe'), [
      { id: 1, value: 'preserved' },
    ]);
    assert.equal(
      (
        await restored.query(
          'SELECT count(*)::int AS count FROM finance_movements WHERE category_id=$1',
          [volumeCat.id],
        )
      )[0].count,
      2000,
    );
  } finally {
    if (restored.isInitialized) await restored.destroy();
  }
  checks.push(
    'Synthetic pg_dump backup restored in a second isolated database, finance and previous data verified.',
  );
  // Keep versioned examples stable during ordinary checks; regenerate explicitly after contract changes.
  if (process.env.FINANCE_UPDATE_FIXTURES === '1') {
    await mkdir(new URL('./fixtures/', import.meta.url), { recursive: true });
    await writeFile(
      new URL('./fixtures/finance-api.json', import.meta.url),
      JSON.stringify({ synthetic: true, responses: fixtures }, null, 2) + '\n',
    );
    await writeFile(
      new URL('./fixtures/finance-openapi.json', import.meta.url),
      JSON.stringify(swagger, null, 2) + '\n',
    );
    await writeFile(
      new URL('./fixtures/finance-query-plan.json', import.meta.url),
      JSON.stringify(
        { synthetic_rows: 2000, plan: plans[0]['QUERY PLAN'] },
        null,
        2,
      ) + '\n',
    );
  }
  console.log(
    JSON.stringify(
      {
        postgres: '16',
        synchronize: false,
        checks,
        routes: Object.keys(swagger.paths).length,
        fixtures: 'test/fixtures/finance-api.json',
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('stop', container);
}
