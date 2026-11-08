// Synthetic disposable PostgreSQL only. Importing this verifier never connects to a database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

/** The caller owns an isolated database, its synthetic actor and final cleanup. */
export async function verifyManualSaleLinePrices({ db, actor, check }) {
  const business = randomUUID();
  const [Modules, Store, Mutate, Read, Compiler, policy] = await Promise.all([
    loadAi(
      'authorization/use-case/check-module-access.use-case',
      'CheckModuleAccessUseCase',
    ),
    loadAi('sale/sale.service', 'SaleService'),
    loadAi('sale/use-case/mutate-sale.use-case', 'MutateSaleUseCase'),
    loadAi('sale/use-case/read-sales.use-case', 'ReadSalesUseCase'),
    loadAi(
      'nodia-ai-reports/use-case/compile-nodia-ai-report.use-case',
      'CompileNodiaAiReportUseCase',
    ),
    import('../dist/nodia-ai-reports/config/report-sources.js'),
  ]);
  const store = new Store(),
    modules = new Modules(db);
  const mutate = new Mutate(db, store, modules),
    read = new Read(db, store, modules);
  const names = () =>
    db.query('SELECT name FROM migrations ORDER BY timestamp,id');
  const ledger = await names();
  assert.equal(ledger.at(-1).name, 'AddManualSaleLinePrices1793450000000');
  // Prove both a safe down and an up from the actual pre-R24 constraints, without rewriting history.
  await db.undoLastMigration();
  await db.query('INSERT INTO businesses(id,name,owner_id) VALUES($1,$2,$3)', [
    business,
    'Synthetic manual-price laboratory',
    actor.userId,
  ]);
  const [group] = await db.query(
    "SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'",
  );
  let [businessModule] = await db.query(
    "SELECT id::text FROM modules WHERE link='/business'",
  );
  if (!businessModule)
    [businessModule] = await db.query(
      "INSERT INTO modules(key,link,module_group_id,sort_order) SELECT 'businesses','/business',$1,COALESCE(max(sort_order),-1)+1 FROM modules WHERE module_group_id=$1 RETURNING id::text",
      [group.id],
    );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [actor.userId, businessModule.id],
  );
  const products = await db.query(
    `INSERT INTO products(business_id,name,cost_price,cost_price_tax,profit_percentage,sale_price,offer_price,is_offer_enabled,has_stock,measurement_unit)
    VALUES($1,'Manual kilos',800,952,30,1500,1200,true,true,'kg'),
      ($1,'Regular units',800,952,30,1500,NULL,false,true,'unit') RETURNING id::text`,
    [business],
  );
  const [kg, unit] = products;
  const item = (product = kg, overrides = {}) => ({
    product_id: product.id,
    quantity: 2,
    expected_product_version: 1,
    expected_unit_price: product.id === kg.id ? '1200' : '1500',
    ...overrides,
  });
  const legacyCommand = { request_key: randomUUID(), items: [item(unit)] };
  const legacy = await mutate.execute(
    business,
    'checkout',
    legacyCommand,
    actor,
  );
  const snapshot = async () =>
    (
      await db.query(
        `SELECT
    (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM sale_items i WHERE business_id=$1) AS items,
    (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM sales s WHERE business_id=$1) AS sales,
    (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM sale_mutation_requests r WHERE business_id=$1) AS receipts,
    (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM sale_events e WHERE business_id=$1) AS events,
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM products p WHERE business_id=$1) AS products`,
        [business],
      )
    )[0];
  const baseline = await snapshot();
  await check(
    'migration changes only the price CHECKs and preserves legacy rows, receipts and replay hashes',
    async () => {
      await db.runMigrations();
      assert.deepEqual(await names(), ledger);
      assert.deepEqual(await snapshot(), baseline);
      assert.deepEqual(
        await mutate.execute(
          business,
          'checkout',
          {
            ...legacyCommand,
            items: [item(unit, { unit_price_override: null })],
          },
          actor,
        ),
        legacy,
      );
      assert.deepEqual(await snapshot(), baseline);
    },
  );
  await check(
    'rollback refuses manual history after a draft has removed every current manual item',
    async () => {
      const draft = await mutate.execute(
        business,
        'create',
        {
          request_key: randomUUID(),
          items: [item(kg, { unit_price_override: '900' })],
        },
        actor,
      );
      await mutate.execute(
        business,
        'update',
        {
          request_key: randomUUID(),
          sale_id: draft.id,
          expected_version: draft.version,
          items: [],
        },
        actor,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM sale_items WHERE price_source='manual'",
          )
        )[0].count,
        0,
      );
      const before = await snapshot();
      await assert.rejects(
        () => db.undoLastMigration(),
        /sale_manual_price_rollback_would_lose_data/,
      );
      assert.deepEqual(await names(), ledger);
      assert.deepEqual(await snapshot(), before);
    },
  );
  const catalog = (await snapshot()).products;
  const command = {
    request_key: randomUUID(),
    items: [item(kg, { quantity: 2.345, unit_price_override: '900' })],
  };
  let completed;
  await check(
    'concurrent identical manual checkouts commit one rounded sale, immutable audit and exact receipt',
    async () => {
      const [one, two] = await Promise.all([
        mutate.execute(business, 'checkout', command, actor),
        mutate.execute(business, 'checkout', command, actor),
      ]);
      assert.deepEqual(one, two);
      completed = one;
      assert.equal(one.total_amount, '2111');
      assert.deepEqual(
        one.items.map(
          ({
            price_source,
            unit_price,
            line_total,
            regular_unit_price,
            offer_price_snapshot,
            is_offer_enabled_snapshot,
            measurement_unit_snapshot,
          }) => ({
            price_source,
            unit_price,
            line_total,
            regular_unit_price,
            offer_price_snapshot,
            is_offer_enabled_snapshot,
            measurement_unit_snapshot,
          }),
        ),
        [
          {
            price_source: 'manual',
            unit_price: '900',
            line_total: '2111',
            regular_unit_price: '1500',
            offer_price_snapshot: '1200',
            is_offer_enabled_snapshot: true,
            measurement_unit_snapshot: 'kg',
          },
        ],
      );
      const [event] = await db.query(
        'SELECT actor_id::text,origin,changes FROM sale_events WHERE sale_id=$1',
        [one.id],
      );
      assert.equal(event.actor_id, actor.userId);
      assert.equal(event.origin, 'http');
      assert.deepEqual(event.changes.manual_prices, [
        {
          product_id: kg.id,
          unit_price: '900',
          regular_unit_price: '1500',
          offer_price_snapshot: '1200',
          is_offer_enabled_snapshot: true,
          product_version: 1,
        },
      ]);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS count FROM sale_mutation_requests WHERE business_id=$1 AND request_key=$2',
            [business, command.request_key],
          )
        )[0].count,
        1,
      );
      assert.deepEqual(
        (await read.receipt(business, command.request_key, actor)).sale,
        one,
      );
      assert.deepEqual((await snapshot()).products, catalog);
    },
  );
  await check(
    'a different manual price with the same request identity conflicts without another sale',
    async () => {
      const before = await snapshot();
      await assert.rejects(
        () =>
          mutate.execute(
            business,
            'checkout',
            {
              ...command,
              items: [
                item(kg, { quantity: 2.345, unit_price_override: '901' }),
              ],
            },
            actor,
          ),
        /sale_request_conflict/,
      );
      assert.deepEqual(await snapshot(), before);
    },
  );
  await check(
    'zero manual lines remain valid alongside a positive line but an all-zero checkout rolls back',
    async () => {
      const mixed = await mutate.execute(
        business,
        'checkout',
        {
          request_key: randomUUID(),
          items: [item(kg, { unit_price_override: '0' }), item(unit)],
        },
        actor,
      );
      assert.equal(mixed.total_amount, '3000');
      assert.equal(mixed.items[0].unit_price, '0');
      assert.equal(mixed.items[0].price_source, 'manual');
      const before = await snapshot(),
        key = randomUUID();
      await assert.rejects(
        () =>
          mutate.execute(
            business,
            'checkout',
            {
              request_key: key,
              items: [item(kg, { unit_price_override: '0' })],
            },
            actor,
          ),
        /sale_positive_total_required/,
      );
      assert.deepEqual(await read.receipt(business, key, actor), {
        status: 'unconfirmed',
      });
      assert.deepEqual(await snapshot(), before);
    },
  );
  await check(
    'manual draft partial updates and confirmation retain the original catalog observation and final manual price',
    async () => {
      const draft = await mutate.execute(
        business,
        'create',
        {
          request_key: randomUUID(),
          items: [item(kg, { unit_price_override: '900' })],
        },
        actor,
      );
      const updated = await mutate.execute(
        business,
        'update',
        {
          request_key: randomUUID(),
          sale_id: draft.id,
          expected_version: draft.version,
          payment_method: 'debit_card',
        },
        actor,
      );
      assert.deepEqual(updated.items, draft.items);
      const key = randomUUID(),
        confirm = {
          request_key: key,
          sale_id: draft.id,
          expected_version: updated.version,
        };
      const confirmed = await mutate.execute(
        business,
        'complete',
        confirm,
        actor,
      );
      assert.equal(confirmed.total_amount, '1800');
      assert.equal(confirmed.items[0].unit_price, '900');
      assert.equal(confirmed.items[0].price_source, 'manual');
      assert.deepEqual(
        await mutate.execute(business, 'complete', confirm, actor),
        confirmed,
      );
    },
  );
  await check(
    'invalid prices and stale observations cannot leave a sale, receipt or audit side effect',
    async () => {
      const before = await snapshot();
      for (const unit_price_override of [
        '',
        '01',
        '1.001',
        '-1',
        '9223372036854775808',
        1,
        false,
        {},
      ]) {
        const key = randomUUID();
        await assert.rejects(
          () =>
            mutate.execute(
              business,
              'checkout',
              { request_key: key, items: [item(kg, { unit_price_override })] },
              actor,
            ),
          /sale_invalid_command/,
        );
        assert.deepEqual(await read.receipt(business, key, actor), {
          status: 'unconfirmed',
        });
      }
      for (const overrides of [
        { expected_product_version: 2 },
        { expected_unit_price: '900' },
      ])
        await assert.rejects(
          () =>
            mutate.execute(
              business,
              'checkout',
              {
                request_key: randomUUID(),
                items: [item(kg, { unit_price_override: '900', ...overrides })],
              },
              actor,
            ),
          /sale_product_changed/,
        );
      assert.deepEqual(await snapshot(), before);
    },
  );
  await check(
    'SQL rejects inconsistent regular/offer claims, missing enabled offers and unknown manual sources',
    async () => {
      const id = completed.items[0].id;
      for (const sql of [
        "UPDATE sale_items SET price_source='regular' WHERE id=$1",
        "UPDATE sale_items SET price_source='offer' WHERE id=$1",
        "UPDATE sale_items SET price_source='unknown' WHERE id=$1",
        'UPDATE sale_items SET offer_price_snapshot=NULL WHERE id=$1',
        'UPDATE sale_items SET unit_price=-1,line_total=-2 WHERE id=$1',
      ])
        await assert.rejects(
          () => db.query(sql, [id]),
          (error) => error.code === '23514',
        );
      assert.equal(
        (await read.get(business, completed.id, actor)).items[0].unit_price,
        '900',
      );
    },
  );
  await check(
    'reads and reports retain manual price provenance and aggregate the final recorded amounts',
    async () => {
      const list = await read.list(
        business,
        { search: 'Manual kilos', status: 'completed' },
        actor,
      );
      assert.ok(
        list.data.some(
          (entry) =>
            entry.id === completed.id &&
            entry.items[0].price_source === 'manual',
        ),
      );
      const source = policy.NODIA_AI_REPORT_SOURCES.find(
        (entry) => entry.sourceKey === 'business_sale_items',
      );
      const compiled = new Compiler().execute({
        source,
        request: {
          source_key: source.sourceKey,
          alias: 'manual',
          scope: { business_id: business },
          filters: {
            all: [
              { field_key: 'price_source', operator: 'eq', value: 'manual' },
            ],
          },
          measures: [
            {
              measure_key: 'registered_line_amount',
              aggregation: 'sum',
              output_key: 'amount',
            },
          ],
        },
        catalogVersion: policy.NODIA_AI_REPORT_SOURCES_VERSION,
        scopeSql: 'r.business_id=$1',
        scopeParameters: [business],
        scopeFingerprint: business,
        limits: {
          maxGroups: 100,
          maxFilters: 20,
          maxCollectionItems: 128,
          defaultGroups: 25,
        },
      });
      const [result] = await db.query(compiled.sql, compiled.parameters);
      assert.equal(result.totals.m0, '3911');
      const summary = await read.summary(business, {}, actor);
      assert.equal(summary.total_amount, '9911');
      assert.deepEqual((await snapshot()).products, catalog);
    },
  );
  await check(
    'changed catalog versions block manual draft confirmation without refreshing its chosen sale price',
    async () => {
      const draft = await mutate.execute(
        business,
        'create',
        {
          request_key: randomUUID(),
          items: [item(kg, { unit_price_override: '900' })],
        },
        actor,
      );
      await db.query(
        'UPDATE products SET offer_price=1100,version=version+1 WHERE id=$1',
        [kg.id],
      );
      const before = await snapshot(),
        key = randomUUID();
      await assert.rejects(
        () =>
          mutate.execute(
            business,
            'complete',
            {
              request_key: key,
              sale_id: draft.id,
              expected_version: draft.version,
            },
            actor,
          ),
        /sale_product_changed/,
      );
      assert.deepEqual(await snapshot(), before);
      assert.equal(
        (await read.get(business, draft.id, actor)).items[0].unit_price,
        '900',
      );
      assert.deepEqual(
        await mutate.execute(business, 'checkout', command, actor),
        completed,
      );
    },
  );
  await check(
    'manual rollback remains blocked and preserves its ledger and domain data',
    async () => {
      const before = await snapshot();
      await assert.rejects(
        () => db.undoLastMigration(),
        /sale_manual_price_rollback_would_lose_data/,
      );
      assert.deepEqual(await names(), ledger);
      assert.deepEqual(await snapshot(), before);
    },
  );
  return {
    migration: 'AddManualSaleLinePrices1793450000000',
    migration_count: ledger.length,
    business,
  };
}

// Standalone opt-in uses only the existing disposable Docker fixture, never the configured app database.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.ok(
    process.argv.includes('--disposable'),
    'Pass --disposable to create and destroy a synthetic PostgreSQL fixture',
  );
  const fixture = await createNodiaAiIntegrationFixture('ai9424');
  const checks = [];
  let result;
  try {
    result = await verifyManualSaleLinePrices({
      db: fixture.db,
      actor: fixture.identities.get('1'),
      check: async (name, work) => {
        await work();
        checks.push(name);
      },
    });
  } finally {
    await fixture.close();
  }
  console.log(
    JSON.stringify({ ok: true, ...result, checks, cleanup: 'completed' }),
  );
}
