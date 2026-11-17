// Run after build. CASH03_TEST_PORT selects an empty, explicitly marked loopback database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CreateBusinessCashCategories1793690000000 } from '../dist/migrations/1793690000000-CreateBusinessCashCategories.js';
import { CreateBusinessCashMovements1793700000000 } from '../dist/migrations/1793700000000-CreateBusinessCashMovements.js';
import { withBusinessCashHttpLab } from './fixtures/business-cash-http.fixture.mjs';

const business = 'aa000000-0000-4000-8000-000000000001';
const otherBusiness = randomUUID();
const movements = '/business-cash-movements';
const categories = '/business-cash-categories';
const notFound = 'business:resource_not_found';
const inactive = 'business:cash_category_inactive';
const maxAmount = '9999999999999';

function receipt(key) {
  return '/businesses/' + business + '/cash-mutation-requests/' + key;
}

function list(businessId, query = [], pagination = []) {
  return (
    movements +
    '?' +
    new URLSearchParams([
      ['q[business_id_eq]', businessId],
      ...query.map(([field, value]) => ['q[' + field + ']', value]),
      ...pagination,
    ])
  );
}

function monthly(businessId) {
  return (
    movements +
    '/monthly-summary?' +
    new URLSearchParams({ business_id: businessId })
  );
}

function expectStatus(response, status, message) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  if (message) assert.equal(response.body.message, message);
  return response.body;
}

function command(category, fields) {
  return {
    business_id: category.business_id,
    request_key: randomUUID(),
    category_id: category.id,
    type: 'income',
    amount: '10',
    occurred_on: '2024-02-29',
    description: 'Ingreso de prueba',
    ...fields,
  };
}

async function addCategory(send, name, actor = '1', businessId = business) {
  return expectStatus(
    await send('POST', categories, actor, {
      request_key: randomUUID(),
      business_id: businessId,
      name,
      description: 'Categoría sintética',
    }),
    201,
  ).result.category;
}

function readAudit(source, id) {
  return source.query(
    `SELECT version, business_id, actor_id::text, operation, "before", "after"
     FROM business_cash_movement_audit WHERE movement_id=$1 ORDER BY version`,
    [id],
  );
}

async function migrationAndAuthority(source, startHttp) {
  assert.equal((await source.runMigrations()).length, 2);
  const send = await startHttp();
  const categoryIntent = {
    business_id: business,
    request_key: randomUUID(),
    name: 'Categoría vigente',
    description: 'Categoría sintética',
  };
  const categoryReceipt = expectStatus(
    await send('POST', categories, '1', categoryIntent),
    201,
  );
  const category = categoryReceipt.result.category;
  const [fingerprint] = await source.query(
    'SELECT request_hash, contract_version FROM business_cash_mutation_requests WHERE request_key=$1',
    [categoryIntent.request_key],
  );
  // The CASH-02 contract encodes the sorted public command without normalized_name.
  assert.deepEqual(fingerprint, {
    request_hash:
      'dac85bea350bcfac0528f1541b8caf5214cbd4fc9fa810c1659b41e1ea962cc5',
    contract_version: 1,
  });
  const alien = await addCategory(send, 'Categoría ajena', '2', otherBusiness);
  await source.undoLastMigration();
  assert.deepEqual(
    await source.query(
      `SELECT to_regclass('business_cash_movements') AS movement,
         to_regclass('business_cash_movement_audit') AS audit,
         (SELECT count(*)::int FROM business_cash_categories) AS categories,
         (SELECT count(*)::int FROM business_cash_mutation_requests) AS receipts`,
    ),
    [{ movement: null, audit: null, categories: 2, receipts: 2 }],
  );
  assert.equal((await source.runMigrations()).length, 1);
  assert.deepEqual(
    expectStatus(await send('POST', categories, '1', categoryIntent), 201),
    categoryReceipt,
  );

  expectStatus(await send('GET', list(business), null), 401);
  expectStatus(await send('GET', list(business), '4'), 403);
  expectStatus(await send('GET', list(business), '2'), 404, notFound);
  expectStatus(await send('GET', monthly(business), '2'), 404, notFound);
  expectStatus(await send('GET', monthly(business), '3'), 200);
  expectStatus(
    await send('POST', movements, '2', command(category)),
    404,
    notFound,
  );
  expectStatus(
    await send(
      'POST',
      movements,
      '3',
      command(category, { category_id: alien.id }),
    ),
    404,
    notFound,
  );
  await assert.rejects(
    () =>
      source.query(
        `INSERT INTO business_cash_movements
         (id,business_id,category_id,type,amount,occurred_on,description,created_by,updated_by)
       VALUES ($1,$2,$3,'income',1,'2024-02-29','Test',3,3)`,
        [randomUUID(), business, alien.id],
      ),
    (error) =>
      error.code === '23503' &&
      error.constraint === 'fk_business_cash_movements_category',
  );
  for (const fields of [
    { amount: 10 },
    { amount: '010' },
    { amount: '1e1' },
    { category_id: '9223372036854775808' },
    { occurred_on: '2025-02-29' },
    { occurred_on: '2024-02-29T00:00:00Z' },
    { description: null },
    { is_active: 'false' },
    { source: 'invoice' },
  ]) {
    expectStatus(
      await send('POST', movements, '1', command(category, fields)),
      400,
    );
  }
  return { send, category, alien };
}

async function concurrencyAndAudit(source, send, category) {
  const intent = command(category, { description: '  Ingreso confirmado  ' });
  const concurrent = await Promise.all([
    send('POST', movements, '1', intent),
    send('POST', movements, '1', intent),
  ]);
  const success = concurrent.find(({ status }) => status === 201);
  assert.ok(success, JSON.stringify(concurrent));
  const created = success.body;
  assert.ok(concurrent.every(({ status }) => [201, 202].includes(status)));
  const movement = created.result.movement;
  assert.deepEqual(created, {
    request_key: intent.request_key,
    operation: 'movement_create',
    status: 'committed',
    result: { movement },
  });
  assert.deepEqual(movement, {
    id: movement.id,
    business_id: business,
    category_id: category.id,
    category: { id: category.id, name: category.name, is_active: true },
    type: 'income',
    amount: '10',
    occurred_on: '2024-02-29',
    description: 'Ingreso confirmado',
    is_active: true,
    version: 1,
    source: 'manual',
    invoice: null,
  });
  const [effects] = await source.query(
    "SELECT count(*)::int AS count FROM business_cash_movements WHERE description='Ingreso confirmado'",
  );
  assert.equal(effects.count, 1);
  const detail = movements + '/' + movement.id;
  assert.deepEqual(expectStatus(await send('GET', detail), 200), movement);
  expectStatus(await send('GET', detail, '2'), 404, notFound);
  expectStatus(
    await send('GET', movements + '/' + randomUUID(), '2'),
    404,
    notFound,
  );
  const changes = ['21', '34'].map((amount) => ({
    request_key: randomUUID(),
    expected_version: 1,
    amount,
  }));
  const edits = await Promise.all(
    changes.map((body) => send('PUT', detail, '1', body)),
  );
  assert.deepEqual(edits.map(({ status }) => status).sort(), [200, 409]);
  const winning = edits.findIndex(({ status }) => status === 200);
  const changed = edits[winning].body;
  const current = changed.result.movement;
  assert.equal(current.version, 2);
  assert.equal(current.amount, changes[winning].amount);
  expectStatus(edits[1 - winning], 409, 'business:cash_version_conflict');
  assert.deepEqual(
    expectStatus(await send('PUT', detail, '1', changes[winning]), 200),
    changed,
  );
  assert.deepEqual(
    expectStatus(
      await send('POST', movements, '1', {
        ...intent,
        description: movement.description,
        is_active: true,
      }),
      201,
    ),
    created,
  );
  expectStatus(
    await send('POST', movements, '1', { ...intent, amount: '11' }),
    409,
    'business:cash_request_key_conflict',
  );
  const originalReceipt = await send('GET', receipt(intent.request_key));
  assert.equal(originalReceipt.headers.get('cache-control'), 'no-store');
  assert.deepEqual(expectStatus(originalReceipt, 200), created);
  assert.equal(
    expectStatus(await send('GET', receipt(intent.request_key), '3'), 200)
      .status,
    'unconfirmed',
  );
  const noOp = {
    request_key: randomUUID(),
    expected_version: 2,
    amount: current.amount,
  };
  assert.deepEqual(
    expectStatus(await send('PUT', detail, '1', noOp), 200).result.movement,
    current,
  );
  for (const fields of [
    {},
    { type: 'expense' },
    { amount: null },
    { business_id: business },
  ]) {
    expectStatus(
      await send('PUT', detail, '1', { ...noOp, amount: undefined, ...fields }),
      400,
    );
  }
  const audit = await readAudit(source, movement.id);
  assert.deepEqual(
    audit.map(({ version, business_id, actor_id, operation }) => ({
      version,
      business_id,
      actor_id,
      operation,
    })),
    [
      {
        version: 1,
        business_id: business,
        actor_id: '1',
        operation: 'movement_create',
      },
      {
        version: 2,
        business_id: business,
        actor_id: '1',
        operation: 'movement_update',
      },
    ],
  );
  assert.equal(audit[0].before, null);
  assert.equal(audit[0].after.amount, '10');
  assert.equal(audit[1].before.amount, '10');
  assert.equal(audit[1].after.amount, current.amount);
  assert.equal(audit[1].after.occurred_on, '2024-02-29');
  return current;
}

async function categoryActivityAndRecovery(source, send, movement) {
  const detail = movements + '/' + movement.id;
  const second = await addCategory(send, 'Categoría para nueva asignación');
  expectStatus(
    await send('PUT', categories + '/' + movement.category_id, '1', {
      request_key: randomUUID(),
      expected_version: 1,
      is_active: false,
    }),
    200,
  );
  expectStatus(
    await send(
      'POST',
      movements,
      '1',
      command(movement.category, { business_id: business }),
    ),
    409,
    inactive,
  );
  const historical = expectStatus(await send('GET', detail), 200);
  assert.equal(historical.category.is_active, false);
  assert.equal(historical.is_active, true);
  const retained = expectStatus(
    await send('PUT', detail, '1', {
      request_key: randomUUID(),
      expected_version: 2,
      category_id: movement.category_id,
      is_active: false,
    }),
    200,
  ).result.movement;
  assert.equal(retained.category_id, movement.category_id);
  assert.equal(retained.is_active, false);
  const restored = expectStatus(
    await send('PUT', detail, '1', {
      request_key: randomUUID(),
      expected_version: 3,
      is_active: true,
    }),
    200,
  ).result.movement;
  assert.equal(restored.category.is_active, false);
  assert.equal(restored.is_active, true);

  const key = '7c184ac0-5a2f-4b36-a059-8c72ecf406de';
  await source.query(`CREATE FUNCTION cash03_fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
     BEGIN IF NEW.request_key='7c184ac0-5a2f-4b36-a059-8c72ecf406de' AND NEW.status='committed'
       THEN RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='synthetic commit failure';
     END IF; RETURN NEW; END; $$`);
  await source.query(`CREATE TRIGGER cash03_fail_receipt BEFORE UPDATE ON business_cash_mutation_requests
    FOR EACH ROW EXECUTE FUNCTION cash03_fail_receipt()`);
  const recoverable = {
    request_key: key,
    expected_version: 4,
    category_id: second.id,
    amount: '73',
  };
  expectStatus(await send('PUT', detail, '1', recoverable), 503);
  assert.deepEqual(expectStatus(await send('GET', detail), 200), restored);
  assert.equal((await readAudit(source, movement.id)).length, 4);
  const [expired] = await source.query(
    'SELECT attempt_id FROM business_cash_mutation_requests WHERE request_key=$1',
    [key],
  );
  await source.query(
    "UPDATE business_cash_mutation_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_key=$1",
    [key],
  );
  assert.deepEqual(expectStatus(await send('GET', receipt(key)), 200), {
    request_key: key,
    status: 'retryable',
    operation: 'movement_update',
  });
  await source.query(
    'DROP TRIGGER cash03_fail_receipt ON business_cash_mutation_requests',
  );
  const completed = expectStatus(
    await send('PUT', detail, '1', recoverable),
    200,
  );
  assert.equal(completed.result.movement.amount, '73');
  assert.equal(completed.result.movement.category_id, second.id);
  assert.equal(completed.result.movement.version, 5);
  const [retry] = await source.query(
    'SELECT attempt_id FROM business_cash_mutation_requests WHERE request_key=$1',
    [key],
  );
  assert.notEqual(retry.attempt_id, expired.attempt_id);
  assert.deepEqual(
    expectStatus(await send('GET', receipt(key)), 200),
    completed,
  );
  assert.equal((await readAudit(source, movement.id)).length, 5);
  expectStatus(
    await send('PUT', detail, '1', {
      request_key: randomUUID(),
      expected_version: 5,
      category_id: movement.category_id,
    }),
    409,
    inactive,
  );

  await source.query(
    'INSERT INTO business_collaborators(business_id,user_id) VALUES($1,2)',
    [business],
  );
  expectStatus(await send('GET', detail, '2'), 200);
  assert.equal(
    expectStatus(await send('GET', receipt(key), '2'), 200).status,
    'unconfirmed',
  );
  await source.query(
    'UPDATE business_collaborators SET is_active=false WHERE business_id=$1 AND user_id=2',
    [business],
  );
  expectStatus(await send('GET', detail, '2'), 404, notFound);
  await source.query('UPDATE user_modules SET is_active=false WHERE user_id=1');
  expectStatus(await send('GET', receipt(key)), 403);
  await source.query('UPDATE user_modules SET is_active=true WHERE user_id=1');
  return second;
}

async function filtersAndExactMonth(source, send, category, alien) {
  const { from, to, time_zone } = expectStatus(
    await send('GET', monthly(business)),
    200,
  ).period;
  const civilMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  assert.equal(time_zone, 'America/Santiago');
  assert.equal(from, civilMonth + '-01');
  const monthEnd = new Date(from + 'T00:00:00Z');
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  assert.equal(to, monthEnd.toISOString().slice(0, 10));
  const previous = new Date(new Date(from + 'T00:00:00Z').getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
  const literalCategory = await addCategory(send, 'Referencia %_,!');
  const examples = [
    {
      category: literalCategory,
      amount: '20',
      description: 'Coincide por categoría',
      occurred_on: from,
    },
    {
      category,
      amount: '30',
      description: 'Coincide por descripción %_,!',
      occurred_on: to,
    },
    {
      category,
      amount: '300',
      description: 'Coincidencia falsa XX,! ',
      occurred_on: to,
    },
    {
      category,
      amount: '1000',
      description: 'Inactivo en este mes',
      occurred_on: to,
      is_active: false,
    },
    {
      category,
      amount: '2000',
      description: 'Fuera del mes',
      occurred_on: previous,
    },
    {
      category: alien,
      amount: '4000',
      description: 'Otro negocio %_,!',
      occurred_on: to,
      actor: '2',
    },
  ];
  for (const { category: assigned, actor = '1', ...fields } of examples) {
    expectStatus(
      await send(
        'POST',
        movements,
        actor,
        command(assigned, { type: 'expense', ...fields }),
      ),
      201,
    );
  }
  const search = [
    ['search', '%_,!'],
    ['occurred_on_gteq', from],
    ['occurred_on_lteq', to],
    ['s', 'amount desc'],
  ];
  const literalSummary = {
    currency: 'CLP',
    income: { count: 0, total_amount: '0' },
    expense: { count: 2, total_amount: '50' },
  };
  for (const [page, amounts] of [
    [1, ['30']],
    [2, ['20']],
    [100000, []],
  ]) {
    const result = expectStatus(
      await send(
        'GET',
        list(business, search, [
          ['page', page],
          ['limit', '1'],
        ]),
      ),
      200,
    );
    assert.deepEqual(
      result.data.map(({ amount }) => amount),
      amounts,
    );
    assert.deepEqual(result.meta, {
      page,
      limit: 1,
      total_items: 2,
      total_pages: 2,
    });
    assert.deepEqual(result.summary, literalSummary);
  }
  assert.equal(
    expectStatus(
      await send('GET', list(business, [['category_id_eq', alien.id]])),
      200,
    ).meta.total_items,
    0,
  );
  for (const query of [
    [
      ['occurred_on_gteq', '2024-03-01'],
      ['occurred_on_lteq', '2024-02-29'],
    ],
    [
      ['search', 'x'],
      ['search', 'y'],
    ],
    [['is_active_eq', '1']],
    [['s', 'description asc']],
  ]) {
    expectStatus(await send('GET', list(business, query)), 400);
  }
  const count = 901;
  const exact = BigInt(maxAmount) * BigInt(count);
  assert.ok(exact > BigInt(Number.MAX_SAFE_INTEGER));
  await source.query(
    `INSERT INTO business_cash_movements
       (id,business_id,category_id,type,amount,occurred_on,description,created_by,updated_by)
     SELECT gen_random_uuid(),$1,$2,'income',$3,$4,'Importe sintético',1,1
     FROM generate_series(1,$5)`,
    [business, category.id, maxAmount, from, count],
  );
  const summary = {
    currency: 'CLP',
    income: { count, total_amount: exact.toString() },
    expense: { count: 3, total_amount: '350' },
  };
  assert.deepEqual(expectStatus(await send('GET', monthly(business)), 200), {
    period: { from, to, time_zone },
    summary,
  });
  const result = expectStatus(
    await send(
      'GET',
      list(
        business,
        [
          ['occurred_on_gteq', from],
          ['occurred_on_lteq', to],
          ['is_active_eq', 'true'],
        ],
        [['page', '100000']],
      ),
    ),
    200,
  );
  assert.deepEqual(result.data, []);
  assert.equal(result.meta.total_items, count + 3);
  assert.deepEqual(result.summary, summary);
  const inactivePage = expectStatus(
    await send('GET', list(business, [['is_active_eq', 'false']])),
    200,
  );
  assert.deepEqual(
    inactivePage.data.map(({ amount }) => amount),
    ['1000'],
  );
}

async function run({ source, startHttp }) {
  const { send, category, alien } = await migrationAndAuthority(
    source,
    startHttp,
  );
  const movement = await concurrencyAndAudit(source, send, category);
  const currentCategory = await categoryActivityAndRecovery(
    source,
    send,
    movement,
  );
  await filtersAndExactMonth(source, send, currentCategory, alien);
  const audit = await readAudit(source, movement.id);
  await assert.rejects(
    () => source.undoLastMigration(),
    /business:cash_movements_rollback_would_lose_data/,
  );
  assert.deepEqual(await readAudit(source, movement.id), audit);
  expectStatus(await send('GET', movements + '/' + movement.id), 200);
  console.log(
    JSON.stringify({
      task: 'business_cash_movements',
      status: 'passed',
      checks: [
        'additive_migration_and_both_rollback_outcomes',
        'real_jwt_business_module_and_composite_fk',
        'strict_dtos_idempotent_create_and_concurrent_cas',
        'immutable_receipt_history_and_noop_audit',
        'inactive_category_while_effective_activity_independent',
        'transactional_audit_rollback_and_fenced_receipt_retry',
        'literal_search_pagination_filtered_totals_and_santiago_month',
        'exact_decimal_totals_above_safe_json_integer',
      ],
      limits: [
        'Isolated PostgreSQL 16 and compiled HTTP app with synthetic users.',
        'Manual movements only.',
      ],
    }),
  );
}

await withBusinessCashHttpLab(
  {
    database: 'cash03_test',
    port: process.env.CASH03_TEST_PORT,
    marker: 'nodia-disposable:cash-03',
    migrations: [
      CreateBusinessCashCategories1793690000000,
      CreateBusinessCashMovements1793700000000,
    ],
    business,
    otherBusiness,
  },
  run,
);
