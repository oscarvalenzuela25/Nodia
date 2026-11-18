// Run from nodia-server after build. Uses compiled Nest, JWT and disposable PostgreSQL 16.
// LISTA_TEST_PORT selects an empty, explicitly marked market_lists_test database on loopback.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

process.env.DOTENV_CONFIG_PATH =
  process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';

const { BusinessShoppingListModule } =
  await import('../dist/business-shopping-list/business-shopping-list.module.js');
const { CreateBusinessShoppingLists1793730000000 } =
  await import('../dist/migrations/1793730000000-CreateBusinessShoppingLists.js');
const { withBusinessHttpLab } =
  await import('./fixtures/business-cash-http.fixture.mjs');

const business = randomUUID();
const otherBusiness = randomUUID();
const riceId = '9007199254740993';
const oliveId = '9007199254740994';
const foreignId = '9007199254740995';
const inactiveId = '9007199254740996';
const base = `/businesses/${business}/lists`;
const otherBase = `/businesses/${otherBusiness}/lists`;
const receipt = (key) => `${base}/requests/${key}`;
const detail = (list) => `${base}/${list.id}`;
const checkPath = (list, item) => `${detail(list)}/items/${item.id}/check`;
const checks = [];

function expectStatus(response, status, message) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  if (message) assert.equal(response.body.message, message);
  return response.body;
}

function create(name, items = []) {
  return { name, items, request_key: randomUUID() };
}

function checkCommand(item, checked) {
  return { checked, check_version: item.check_version };
}

function editCommand(list, fields = {}) {
  return {
    name: list.name,
    version: list.version,
    items: list.items.map(({ id, product_id, quantity }) => ({
      item_id: id,
      product_id,
      quantity,
    })),
    ...fields,
  };
}

async function seedCatalog(source) {
  await source.query(`CREATE TABLE products (
    id bigint PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses(id),
    name varchar(255) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    measurement_unit varchar(16) NOT NULL DEFAULT 'unit'
  )`);
  await source.query(
    `INSERT INTO products(id,business_id,name,is_active,measurement_unit)
     VALUES($1,$5,'Arroz',true,'kg'),($2,$5,'Aceitunas',true,'g'),
           ($3,$6,'Catálogo ajeno',true,'unit'),($4,$5,'Inactivo',false,'bundle')`,
    [riceId, oliveId, foreignId, inactiveId, business, otherBusiness],
  );
  await source.query(
    'INSERT INTO business_collaborators(business_id,user_id) VALUES($1,4)',
    [business],
  );
}

async function verifyCreateAndReceipt(send) {
  expectStatus(await send('GET', base, null), 401);
  expectStatus(await send('GET', base, '4'), 403);
  expectStatus(await send('POST', base, '4', create('Sin módulo')), 403);
  expectStatus(await send('GET', base, '2'), 404);
  expectStatus(await send('POST', base, '2', create('Negocio ajeno')), 404);
  assert.deepEqual(expectStatus(await send('GET', base, '3'), 200).items, []);

  const quantity = '999999999.999';
  const command = create('  Reposición %_,! Norte  ', [
    { product_id: riceId, quantity },
    { product_id: oliveId, quantity: '0.125' },
  ]);
  const responses = await Promise.all([
    send('POST', base, '1', command),
    send('POST', base, '1', command),
  ]);
  const original = expectStatus(responses[0], 201);
  assert.deepEqual(expectStatus(responses[1], 201), original);
  assert.equal(original.name, 'Reposición %_,! Norte');
  assert.equal(original.version, 1);
  assert.equal(original.is_active, true);
  assert.equal(original.item_count, 2);
  assert.deepEqual(
    original.items.map(({ id: _id, ...item }) => item),
    [
      {
        product_id: riceId,
        name: 'Arroz',
        quantity,
        position: 0,
        available: true,
        checked: false,
        check_version: 1,
      },
      {
        product_id: oliveId,
        name: 'Aceitunas',
        quantity: '0.125',
        position: 1,
        available: true,
        checked: false,
        check_version: 1,
      },
    ],
  );
  assert.notEqual(original.items[0].id, original.items[1].id);
  assert.deepEqual(
    expectStatus(await send('GET', detail(original), '3'), 200),
    original,
  );
  const recovered = await send('GET', receipt(command.request_key));
  assert.equal(recovered.headers.get('cache-control'), 'no-store');
  assert.deepEqual(expectStatus(recovered, 200), original);
  expectStatus(await send('GET', receipt(command.request_key), '3'), 404);
  expectStatus(await send('GET', receipt(randomUUID())), 404);
  expectStatus(
    await send('POST', base, '1', { ...command, name: 'Otra intención' }),
    409,
    'business:shopping_list_request_conflict',
  );
  assert.deepEqual(
    expectStatus(await send('GET', base), 200).items.map(({ id }) => id),
    [original.id],
  );
  checks.push(
    'compiled_http_jwt_module_business_scope_and_concurrent_idempotent_create',
  );
  return { original, command };
}

async function verifyValidationAndPaging(send, original) {
  for (const quantity of ['0', '0.0001', '1000000000', '1e1', 1]) {
    expectStatus(
      await send(
        'POST',
        base,
        '1',
        create('Cantidad inválida', [{ product_id: riceId, quantity }]),
      ),
      400,
    );
  }
  const duplicate = create('Duplicado', [
    { product_id: riceId, quantity: '1' },
    { product_id: riceId, quantity: '2' },
  ]);
  expectStatus(
    await send('POST', base, '1', duplicate),
    400,
    'business:shopping_list_duplicate_product',
  );
  for (const product_id of [foreignId, inactiveId, '9007199254740997']) {
    const invalid = create('Alta indivisible', [
      { product_id: riceId, quantity: '1' },
      { product_id, quantity: '2' },
    ]);
    expectStatus(
      await send('POST', base, '3', invalid),
      409,
      'business:shopping_list_product_unavailable',
    );
    expectStatus(await send('GET', receipt(invalid.request_key), '3'), 404);
  }
  assert.deepEqual(
    expectStatus(await send('GET', base), 200).items.map(({ id }) => id),
    [original.id],
  );
  expectStatus(await send('GET', `${base}?limit=101`), 400);
  expectStatus(await send('GET', `${base}?business_id=${otherBusiness}`), 400);

  const match = expectStatus(
    await send('POST', base, '1', create(original.name)),
    201,
  );
  assert.equal(match.item_count, 0);
  assert.deepEqual(match.items, []);
  const disabled = expectStatus(
    await send('PUT', `${detail(match)}/activity`, '1', {
      version: match.version,
      is_active: false,
    }),
    200,
  );
  assert.equal(disabled.is_active, false);
  assert.equal(disabled.version, match.version + 1);
  expectStatus(
    await send('POST', base, '1', create('Reposición abc Norte')),
    201,
  );
  const query = (page) =>
    `${base}?${new URLSearchParams({ search: 'Reposicion %_,!', page, limit: 1 })}`;
  const first = expectStatus(await send('GET', query(1)), 200);
  const second = expectStatus(await send('GET', query(2)), 200);
  assert.deepEqual(first.pagination, {
    page: 1,
    limit: 1,
    total: 2,
    total_pages: 2,
  });
  assert.deepEqual(second.pagination, {
    page: 2,
    limit: 1,
    total: 2,
    total_pages: 2,
  });
  assert.deepEqual(
    new Set([...first.items, ...second.items].map(({ id }) => id)),
    new Set([original.id, match.id]),
  );
  assert.deepEqual(await send('GET', query(1)).then(({ body }) => body), first);
  assert.equal(
    [...first.items, ...second.items].find(({ id }) => id === match.id)
      .is_active,
    false,
  );
  assert.equal(
    [...first.items, ...second.items].find(({ id }) => id === original.id)
      .item_count,
    2,
  );
  const enabled = expectStatus(
    await send('PUT', `${detail(match)}/activity`, '1', {
      version: disabled.version,
      is_active: true,
    }),
    200,
  );
  assert.equal(enabled.is_active, true);
  checks.push(
    'strict_exact_quantities_atomic_rejection_paging_literal_search_and_activity',
  );
}

async function verifyReceiptFailureRollback(source, send) {
  const command = create('Bloqueo sintético de recibo', [
    { product_id: riceId, quantity: '1' },
    { product_id: oliveId, quantity: '2' },
  ]);
  await source.query(`ALTER TABLE business_shopping_list_create_requests
    ADD CONSTRAINT fixture_refuses_receipt CHECK (result->>'name' <> 'Bloqueo sintético de recibo')`);
  try {
    expectStatus(await send('POST', base, '1', command), 500);
    expectStatus(await send('GET', receipt(command.request_key)), 404);
    assert.deepEqual(
      await source.query(
        'SELECT id FROM business_shopping_lists WHERE business_id=$1 AND name=$2',
        [business, command.name],
      ),
      [],
    );
  } finally {
    await source.query(`ALTER TABLE business_shopping_list_create_requests
      DROP CONSTRAINT fixture_refuses_receipt`);
  }
  const saved = expectStatus(await send('POST', base, '1', command), 201);
  assert.equal(saved.item_count, 2);
  assert.deepEqual(
    expectStatus(await send('GET', receipt(command.request_key)), 200),
    saved,
  );
  assert.deepEqual(
    await source.query(
      'SELECT id FROM business_shopping_lists WHERE business_id=$1 AND name=$2',
      [business, command.name],
    ),
    [{ id: saved.id }],
  );
  checks.push(
    'late_receipt_constraint_failure_rolls_back_effects_and_allows_same_intent',
  );
}

async function verifyChecklist(source, send, original) {
  await source.query(
    'INSERT INTO business_collaborators(business_id,user_id) VALUES($1,2)',
    [business],
  );
  assert.deepEqual(
    expectStatus(await send('GET', detail(original), '2'), 200),
    original,
  );
  const [rice, olive] = original.items;
  const changes = await Promise.all([
    send('PUT', checkPath(original, rice), '1', checkCommand(rice, true)),
    send('PUT', checkPath(original, olive), '2', checkCommand(olive, true)),
  ]);
  for (const [index, item] of original.items.entries()) {
    assert.deepEqual(expectStatus(changes[index], 200), {
      id: item.id,
      checked: true,
      check_version: 2,
    });
  }
  const bothChecked = expectStatus(
    await send('GET', detail(original), '2'),
    200,
  );
  assert.equal(bothChecked.version, original.version);
  assert.ok(bothChecked.items.every(({ checked }) => checked));
  const checkRace = await Promise.all(
    ['1', '2'].map((actor) =>
      send(
        'PUT',
        checkPath(original, rice),
        actor,
        checkCommand(bothChecked.items[0], false),
      ),
    ),
  );
  assert.deepEqual(checkRace.map(({ status }) => status).sort(), [200, 409]);
  expectStatus(
    checkRace.find(({ status }) => status === 409),
    409,
    'business:shopping_list_check_conflict',
  );

  const afterRace = expectStatus(await send('GET', detail(original)), 200);
  const editedItems = editCommand(afterRace).items.reverse();
  editedItems[0].quantity = '3.5';
  const [edit, check] = await Promise.all([
    send(
      'PUT',
      detail(original),
      '1',
      editCommand(afterRace, { name: 'Editada', items: editedItems }),
    ),
    send(
      'PUT',
      checkPath(original, rice),
      '2',
      checkCommand(afterRace.items[0], true),
    ),
  ]);
  expectStatus(edit, 200);
  expectStatus(check, 200);
  const combined = expectStatus(await send('GET', detail(original), '2'), 200);
  assert.equal(combined.version, afterRace.version + 1);
  assert.equal(combined.name, 'Editada');
  assert.deepEqual(
    combined.items.map(
      ({ id, position, quantity, checked, check_version }) => ({
        id,
        position,
        quantity,
        checked,
        check_version,
      }),
    ),
    [
      {
        id: olive.id,
        position: 0,
        quantity: '3.5',
        checked: true,
        check_version: 2,
      },
      {
        id: rice.id,
        position: 1,
        quantity: rice.quantity,
        checked: true,
        check_version: 4,
      },
    ],
  );
  expectStatus(
    await send('PUT', detail(original), '1', editCommand(afterRace)),
    409,
    'business:shopping_list_version_conflict',
  );
  assert.deepEqual(
    await source.query(
      `SELECT product_id::text, checked_by::text FROM business_shopping_list_items
     WHERE list_id=$1 ORDER BY product_id`,
      [original.id],
    ),
    [
      { product_id: riceId, checked_by: '2' },
      { product_id: oliveId, checked_by: '2' },
    ],
  );
  checks.push(
    'item_cas_concurrency_scope_and_content_edit_preserves_both_shared_marks',
  );
  return combined;
}

async function revokeDuringWrite(source, send, list) {
  const transaction = source.createQueryRunner();
  let request;
  try {
    await transaction.startTransaction();
    const [{ pid }] = await transaction.query('SELECT pg_backend_pid() AS pid');
    await transaction.query(
      'SELECT id FROM businesses WHERE id=$1 FOR UPDATE',
      [business],
    );
    await transaction.query(
      'UPDATE business_collaborators SET is_active=false WHERE business_id=$1 AND user_id=2',
      [business],
    );
    const item = list.items[0];
    request = send(
      'PUT',
      checkPath(list, item),
      '2',
      checkCommand(item, false),
    );
    for (let attempt = 0; ; attempt++) {
      const [{ blocked }] = await source.query(
        `SELECT EXISTS(SELECT 1 FROM pg_stat_activity activity
          WHERE activity.datname=current_database()
          AND $1::integer=ANY(pg_blocking_pids(activity.pid))) AS blocked`,
        [pid],
      );
      if (blocked) break;
      assert.ok(
        attempt < 65,
        'Checklist write did not wait for the business lock',
      );
      await delay(20);
    }
    await transaction.commitTransaction();
  } finally {
    if (transaction.isTransactionActive)
      await transaction.rollbackTransaction();
    await transaction.release();
  }
  expectStatus(await request, 404, 'business:resource_not_found');
}

async function verifyIdentityAndScope(source, send, list, original, command) {
  const [olive, rice] = list.items;
  const alien = expectStatus(
    await send(
      'POST',
      otherBase,
      '2',
      create('Otra lista', [{ product_id: foreignId, quantity: '1' }]),
    ),
    201,
  );
  expectStatus(await send('GET', `${otherBase}/${list.id}`, '3'), 404);
  expectStatus(
    await send(
      'PUT',
      checkPath(list, alien.items[0]),
      '3',
      checkCommand(alien.items[0], true),
    ),
    404,
  );
  const mixed = editCommand(list);
  mixed.items[0].item_id = alien.items[0].id;
  expectStatus(
    await send('PUT', detail(list), '3', mixed),
    409,
    'business:shopping_list_item_mismatch',
  );
  assert.deepEqual(expectStatus(await send('GET', detail(list)), 200), list);
  expectStatus(await send('GET', receipt(command.request_key), '2'), 404);

  const removed = expectStatus(
    await send(
      'PUT',
      detail(list),
      '1',
      editCommand(list, {
        items: [
          { item_id: olive.id, product_id: oliveId, quantity: olive.quantity },
        ],
      }),
    ),
    200,
  );
  const again = expectStatus(
    await send(
      'PUT',
      detail(list),
      '1',
      editCommand(removed, {
        items: [
          ...editCommand(removed).items,
          { product_id: riceId, quantity: '1' },
        ],
      }),
    ),
    200,
  );
  const replacement = again.items[1];
  assert.notEqual(replacement.id, rice.id);
  assert.equal(replacement.checked, false);
  assert.equal(replacement.check_version, 1);
  expectStatus(
    await send('PUT', checkPath(list, rice), '2', checkCommand(rice, false)),
    404,
  );

  await source.query('UPDATE products SET name=$2 WHERE id=$1', [
    oliveId,
    'Aceitunas nuevas',
  ]);
  const live = expectStatus(await send('GET', detail(list), '2'), 200);
  assert.equal(live.items[0].name, 'Aceitunas nuevas');
  await source.query('UPDATE products SET business_id=$2,name=$3 WHERE id=$1', [
    oliveId,
    otherBusiness,
    'Nombre privado del destino',
  ]);
  await source.query(
    'UPDATE products SET is_active=false,name=$2 WHERE id=$1',
    [riceId, 'Nombre inactivo'],
  );
  const archived = expectStatus(await send('GET', detail(list)), 200);
  assert.deepEqual(
    archived.items.map(({ name, available }) => ({ name, available })),
    [
      { name: 'Aceitunas', available: false },
      { name: 'Arroz', available: false },
    ],
  );
  const archivedCommand = editCommand(archived);
  archivedCommand.items[0].quantity = '4';
  const edited = expectStatus(
    await send('PUT', detail(list), '2', archivedCommand),
    200,
  );
  assert.equal(edited.items[0].quantity, '4');
  assert.equal(edited.items[0].checked, true);
  assert.equal(edited.items[0].id, olive.id);
  assert.equal(edited.items[1].id, replacement.id);
  assert.deepEqual(
    expectStatus(await send('GET', receipt(command.request_key)), 200),
    original,
  );
  assert.deepEqual(
    expectStatus(await send('POST', base, '1', command), 201),
    original,
  );
  const inactive = expectStatus(
    await send('PUT', `${detail(list)}/activity`, '1', {
      version: edited.version,
      is_active: false,
    }),
    200,
  );
  assert.deepEqual(inactive.items, edited.items);
  const mark = expectStatus(
    await send(
      'PUT',
      checkPath(list, inactive.items[1]),
      '2',
      checkCommand(inactive.items[1], true),
    ),
    200,
  );
  const stillInactive = expectStatus(await send('GET', detail(list), '2'), 200);
  assert.equal(stillInactive.is_active, false);
  assert.equal(stillInactive.version, inactive.version);
  assert.equal(stillInactive.items[1].checked, true);
  assert.equal(stillInactive.items[1].check_version, mark.check_version);

  await revokeDuringWrite(source, send, stillInactive);
  expectStatus(await send('GET', base, '2'), 404);
  expectStatus(await send('GET', detail(list), '2'), 404);
  expectStatus(
    await send(
      'PUT',
      checkPath(list, stillInactive.items[0]),
      '2',
      checkCommand(stillInactive.items[0], false),
    ),
    404,
  );
  assert.deepEqual(
    expectStatus(await send('GET', detail(list), '1'), 200),
    stillInactive,
  );
  checks.push(
    'scoped_id_mixing_retired_identity_snapshot_projection_and_revocation',
  );
}

await withBusinessHttpLab(
  {
    database: 'market_lists_test',
    port: process.env.LISTA_TEST_PORT,
    marker: 'nodia_market_lists_test_disposable',
    migrations: [CreateBusinessShoppingLists1793730000000],
    modules: [BusinessShoppingListModule],
    business,
    otherBusiness,
  },
  async ({ source, startHttp }) => {
    await seedCatalog(source);
    assert.equal((await source.runMigrations()).length, 1);
    assert.equal((await source.runMigrations()).length, 0);
    const send = await startHttp();
    const { original, command } = await verifyCreateAndReceipt(send);
    await verifyValidationAndPaging(send, original);
    await verifyReceiptFailureRollback(source, send);
    const combined = await verifyChecklist(source, send, original);
    await verifyIdentityAndScope(source, send, combined, original, command);
  },
);

console.log(
  JSON.stringify({
    task: 'market_shopping_lists',
    status: 'passed',
    checks,
    limits: [
      'Disposable PostgreSQL 16 with synthetic authority and catalog rows, compiled Nest HTTP with real JWT.',
    ],
  }),
);
