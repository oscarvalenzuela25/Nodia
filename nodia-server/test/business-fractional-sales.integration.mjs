// Disposable PostgreSQL only: no configured database, provider, cloud or real sale.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';
import { verifyProductUnitComparisons } from './product-measurement-units.integration.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai9419');
const { db } = fixture;
const checks = [];
const check = async (name, work) => {
  await work();
  checks.push(name);
};
const business = randomUUID();
const actor = fixture.identities.get('1');
let legacySale, legacyProduct;
try {
  const names = (
    await db.query('SELECT name FROM migrations ORDER BY timestamp,id')
  ).map((row) => row.name);
  assert.deepEqual(names.slice(-2), [
    'AddProductMeasurementUnits1793430000000',
    'AddFractionalSaleQuantities1793440000000',
  ]);
  // Reconstruct the actual integer baseline in this owned disposable database.
  await db.undoLastMigration();
  await db.undoLastMigration();
  assert.equal(
    (await db.query('SELECT count(*)::int AS count FROM migrations'))[0].count,
    35,
  );
  await db.query('INSERT INTO businesses(id,name,owner_id) VALUES($1,$2,1)', [
    business, 'Synthetic fractional-sales laboratory',
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
    'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING',
    [businessModule.id],
  );
  [legacyProduct] = await db.query(
    `INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,has_stock)
    VALUES($1,'legacy-code','Legacy integer product',800,952,30,1000,true) RETURNING id::text`,
    [business],
  );
  legacySale = randomUUID();
  const legacyItem = randomUUID();
  await db.query(
    `INSERT INTO sales(id,business_id,status,total_amount,created_by,updated_by,completed_by,completed_at)
    VALUES($1,$2,'completed',2000,1,1,1,'2026-10-30T12:00:00Z')`,
    [legacySale, business],
  );
  await db.query(
    `INSERT INTO sale_items(id,business_id,sale_id,product_id,position,quantity,product_code_snapshot,product_name_snapshot,
    regular_unit_price,is_offer_enabled_snapshot,price_source,unit_price,line_total,product_version)
    VALUES($1,$2,$3,$4,0,2,'legacy-code','Legacy integer product',1000,false,'regular',1000,2000,1)`,
    [legacyItem, business, legacySale, legacyProduct.id],
  );
  const before = (
    await db.query(
      'SELECT to_jsonb(i) AS value FROM sale_items i WHERE id=$1',
      [legacyItem],
    )
  )[0].value;
  await check(
    'migration preserves integer sales and explicitly assigns historical unit snapshots',
    async () => {
      await db.runMigrations();
      const [row] = await db.query(
        `SELECT to_jsonb(i)-'measurement_unit_snapshot' AS value,measurement_unit_snapshot,
      quantity::text AS quantity FROM sale_items i WHERE id=$1`,
        [legacyItem],
      );
      assert.deepEqual(row.value, before);
      assert.equal(row.quantity, '2');
      assert.equal(row.measurement_unit_snapshot, 'unit');
      assert.equal(
        (
          await db.query('SELECT measurement_unit FROM products WHERE id=$1', [
            legacyProduct.id,
          ])
        )[0].measurement_unit,
        'unit',
      );
      assert.equal(
        (await db.query('SELECT count(*)::int AS count FROM migrations'))[0]
          .count,
        37,
      );
    },
  );
  const [
    Modules,
    Store,
    Mutate,
    Read,
    Registry,
    Compiler,
    Authorize,
    Authorization,
    RunReport,
    Compose,
    ValidatePolicy,
    RentalTransactions,
    RentalClock,
  ] = await Promise.all(
    [
      [
        'authorization/use-case/check-module-access.use-case',
        'CheckModuleAccessUseCase',
      ],
      ['sale/sale.service', 'SaleService'],
      ['sale/use-case/mutate-sale.use-case', 'MutateSaleUseCase'],
      ['sale/use-case/read-sales.use-case', 'ReadSalesUseCase'],
      [
        'nodia-ai-reports/use-case/nodia-ai-report-registry.use-case',
        'NodiaAiReportRegistryUseCase',
      ],
      [
        'nodia-ai-reports/use-case/compile-nodia-ai-report.use-case',
        'CompileNodiaAiReportUseCase',
      ],
      [
        'nodia-ai/use-case/authorize-nodia-ai.use-case',
        'AuthorizeNodiaAiUseCase',
      ],
      [
        'nodia-ai/nodia-ai-authorization.service',
        'NodiaAiAuthorizationService',
      ],
      [
        'nodia-ai-reports/use-case/run-nodia-ai-report.use-case',
        'RunNodiaAiReportUseCase',
      ],
      [
        'nodia-ai-reports/use-case/compose-nodia-ai-report.use-case',
        'ComposeNodiaAiReportUseCase',
      ],
      [
        'nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case',
        'ValidateNodiaAiRuntimePolicyUseCase',
      ],
      ['rental-common/rental-transaction.service', 'RentalTransactionService'],
      ['rental-common/rental-clock', 'RentalClock'],
    ].map(([path, name]) => loadAi(path, name)),
  );
  const store = new Store(),
    modules = new Modules(db);
  const mutate = new Mutate(db, store, modules),
    read = new Read(db, store, modules);
  const policy = new ValidatePolicy().execute(
    JSON.parse(
      await readFile(
        new URL(
          '../dist/nodia-ai-runtime/config/runtime-policy.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  );
  // Explicit fixture publication grant: this verifies report behavior, not real knowledge publication.
  const registry = new Registry(policy, ['businesses.point-of-sale-and-sales']);
  const compiler = new Compiler(),
    authorize = new Authorize(new Authorization(db));
  const runReport = new RunReport(
    db,
    registry,
    compiler,
    authorize,
    new RentalTransactions(db, new RentalClock()),
    policy,
  );
  const compose = new Compose(
    db,
    registry,
    compiler,
    runReport,
    authorize,
    policy,
  );
  const products = await db.query(
    `INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,has_stock,measurement_unit)
    VALUES($1,NULL,'Kilos',0,0,0,1500,true,'kg'),($1,NULL,'Half unit',0,0,0,1,true,'unit'),
      ($1,'grams','Grams',0,0,0,1500,true,'g'),($1,'bundle','Bundle',0,0,0,10000,true,'bundle')
    RETURNING id::text,name,measurement_unit`,
    [business],
  );
  const [kg, unit, grams, bundle] = products;
  await check(
    'optional codes allow several absent identifiers while provided codes remain unique',
    async () => {
      assert.equal(products.length, 4);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS count FROM products WHERE business_id=$1 AND code IS NULL',
            [business],
          )
        )[0].count,
        2,
      );
      await assert.rejects(
        () =>
          db.query(
            `INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price)
      VALUES($1,'grams','Duplicate code',0,0,0,1)`,
            [business],
          ),
        (error) => error.code === '23505',
      );
      const [omitted] = await db.query(
        `INSERT INTO products(business_id,name,cost_price,cost_price_tax,profit_percentage,sale_price)
      VALUES($1,'Default unit and absent code',0,0,0,1) RETURNING code,measurement_unit`,
        [business],
      );
      assert.deepEqual(omitted, { code: null, measurement_unit: 'unit' });
    },
  );
  const item = (product, quantity, price, version = 1) => ({
    product_id: product.id,
    quantity,
    expected_unit_price: price,
    expected_product_version: version,
  });
  const command = {
    request_key: randomUUID(),
    items: [
      item(kg, 2.345, '1500'),
      item(unit, 0.5, '1'),
      item(grams, 0.001, '1500'),
      item(bundle, 1.25, '10000'),
    ],
  };
  let sale;
  await check(
    'fractional manual checkout freezes units and rounds HALF_UP per line with idempotent concurrency',
    async () => {
      const [one, two] = await Promise.all([
        mutate.execute(business, 'checkout', command, actor),
        mutate.execute(business, 'checkout', command, actor),
      ]);
      assert.deepEqual(one, two);
      sale = one;
      assert.equal(one.total_amount, '16021');
      assert.deepEqual(
        one.items.map((value) => [
          value.quantity,
          value.measurement_unit_snapshot,
          value.line_total,
        ]),
        [
          [2.345, 'kg', '3518'],
          [0.5, 'unit', '1'],
          [0.001, 'g', '2'],
          [1.25, 'bundle', '12500'],
        ],
      );
      assert.equal(one.items[0].product_code_snapshot, null);
      const [counts] = await db.query(
        `SELECT (SELECT count(*)::text FROM sale_mutation_requests WHERE business_id=$1) AS receipts,
      (SELECT count(*)::text FROM sale_events WHERE business_id=$1) AS events`,
        [business],
      );
      assert.deepEqual(counts, { receipts: '1', events: '1' });
      assert.deepEqual(
        (await read.receipt(business, command.request_key, actor)).sale,
        one,
      );
    },
  );
  await check(
    'zero, excessive scale and quantity overflow reject without committed sale effects',
    async () => {
      const before = (
        await db.query(
          'SELECT count(*)::text AS count FROM sales WHERE business_id=$1',
          [business],
        )
      )[0].count;
      for (const quantity of [0, -1, 0.0009, 1.0001, 2147483647.001]) {
        const key = randomUUID();
        await assert.rejects(
          () =>
            mutate.execute(
              business,
              'checkout',
              { request_key: key, items: [item(kg, quantity, '1500')] },
              actor,
            ),
          /sale_invalid_command/,
        );
        assert.deepEqual(await read.receipt(business, key, actor), {
          status: 'unconfirmed',
        });
      }
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::text AS count FROM sales WHERE business_id=$1',
            [business],
          )
        )[0].count,
        before,
      );
    },
  );
  await check(
    'database constraints reject four decimals without silently rounding and reject incorrect pesos or unsupported units',
    async () => {
      const line = sale.items[0];
      await assert.rejects(
        () =>
          db.query(
            'UPDATE sale_items SET quantity=0.0009,line_total=1 WHERE id=$1',
            [line.id],
          ),
        (error) =>
          error.code === '23514' &&
          error.constraint === 'ck_sale_items_quantity_decimal',
      );
      await assert.rejects(
        () =>
          db.query(
            'UPDATE sale_items SET quantity=0,line_total=0 WHERE id=$1',
            [line.id],
          ),
        (error) => error.code === '23514',
      );
      await assert.rejects(
        () =>
          db.query('UPDATE sale_items SET line_total=3517 WHERE id=$1', [
            line.id,
          ]),
        (error) =>
          error.code === '23514' &&
          error.constraint === 'ck_sale_items_rounded_line_total',
      );
      for (const invalid of ['l', 'ml', 'm', 'mg'])
        await assert.rejects(
          () =>
            db.query(
              'UPDATE sale_items SET measurement_unit_snapshot=$2 WHERE id=$1',
              [line.id, invalid],
            ),
          (error) => error.code === '23514',
        );
      assert.deepEqual(await read.get(business, sale.id, actor), sale);
    },
  );
  await check(
    'catalog unit changes preserve old snapshots and reject stale version observations',
    async () => {
      await db.query(
        "UPDATE products SET measurement_unit='g',version=version+1 WHERE id=$1",
        [kg.id],
      );
      await assert.rejects(
        () =>
          mutate.execute(
            business,
            'checkout',
            { request_key: randomUUID(), items: [item(kg, 1, '1500')] },
            actor,
          ),
        /sale_product_changed/,
      );
      const next = await mutate.execute(
        business,
        'checkout',
        { request_key: randomUUID(), items: [item(kg, 0.5, '1500', 2)] },
        actor,
      );
      assert.equal(next.items[0].measurement_unit_snapshot, 'g');
      assert.equal(
        (await read.get(business, sale.id, actor)).items[0]
          .measurement_unit_snapshot,
        'kg',
      );
    },
  );
  await check(
    'native summary and ranking preserve complete quantities partitioned by frozen unit',
    async () => {
      const summary = await read.summary(business, {}, actor);
      assert.equal(summary.total_amount, '18771');
      assert.equal(summary.sales_count, '3');
      assert.deepEqual(summary.average_ticket, {
        numerator: '18771',
        denominator: '3',
      });
      assert.equal(summary.units_sold, '2.5');
      assert.deepEqual(
        Object.fromEntries(
          summary.quantity_by_unit.map((row) => [
            row.measurement_unit,
            row.quantity,
          ]),
        ),
        { unit: '2.5', kg: '2.345', g: '0.501', bundle: '1.25' },
      );
      const top = await read.topProducts(business, { limit: 100 }, actor);
      assert.equal(
        top.data.filter((row) => row.product_id === kg.id).length,
        2,
      );
      assert.deepEqual(
        new Set(
          top.data
            .filter((row) => row.product_id === kg.id)
            .map((row) => row.measurement_unit),
        ),
        new Set(['kg', 'g']),
      );
      assert.equal(
        top.data.find(
          (row) => row.product_id === kg.id && row.measurement_unit === 'kg',
        ).units_sold,
        '2.345',
      );
    },
  );
  await check(
    'Nodia report rows and fractional cursors are exact and cannot expose mixed quantity totals',
    async () => {
      const request = {
        catalog_version: registry.catalogVersion,
        combine: 'separate',
        page_limit: 100,
        sources: [
          {
            source_key: 'business_sale_items',
            alias: 'items',
            scope: { business_id: business },
            filters: {
              all: [
                { field_key: 'status', operator: 'eq', value: 'completed' },
              ],
            },
            group_by: [
              { dimension_key: 'measurement_unit', output_key: 'unit' },
            ],
            measures: [
              {
                measure_key: 'sold_units',
                aggregation: 'sum',
                output_key: 'quantity',
              },
              {
                measure_key: 'registered_line_amount',
                aggregation: 'sum',
                output_key: 'amount',
              },
            ],
            order_by: [{ output_key: 'quantity', direction: 'desc' }],
          },
        ],
      };
      const result = await compose.execute(actor, request);
      compose.validateResult(result, request);
      const source = result.source_results[0];
      assert.equal(source.totals.quantity, undefined);
      assert.equal(source.totals.amount, '18771');
      assert.equal(
        source.columns.find((column) => column.key === 'quantity').scale,
        3,
      );
      assert.deepEqual(
        Object.fromEntries(
          source.rows.map((row) => [
            row[0],
            row[1].includes('.')
              ? row[1].replace(/0+$/, '').replace(/\.$/, '')
              : row[1],
          ]),
        ),
        { unit: '2.5', kg: '2.345', g: '0.501', bundle: '1.25' },
      );
      const unsafe = structuredClone(request);
      delete unsafe.sources[0].group_by;
      delete unsafe.sources[0].order_by;
      await assert.rejects(
        () => runReport.execute(actor, unsafe),
        /unsupported_semantics/,
      );
      const first = await runReport.execute(actor, {
        ...request,
        page_limit: 1,
      });
      assert.ok(first.next_cursor);
      const second = await runReport.execute(actor, {
        ...request,
        page_limit: 1,
        cursor: first.next_cursor,
      });
      assert.notDeepEqual(second.rows, first.rows);
    },
  );
  await check(
    'migration rollback refuses to discard fractional quantities or post-change receipt contracts',
    async () => {
      const ledger = await db.query(
        'SELECT name FROM migrations ORDER BY timestamp,id',
      );
      await assert.rejects(
        () => db.undoLastMigration(),
        /sale_quantity_rollback_would_lose_data/,
      );
      assert.deepEqual(
        await db.query('SELECT name FROM migrations ORDER BY timestamp,id'),
        ledger,
      );
      assert.equal(
        (await read.get(business, sale.id, actor)).items[0].quantity,
        2.345,
      );
    },
  );
  await verifyProductUnitComparisons({
    db,
    businessId: business,
    actor,
    check,
  });
  await fixture.close();
  console.log(
    JSON.stringify({
      task: 'business-fractional-sales',
      status: 'passed',
      checks,
      configured_database_used: false,
      synthetic_publication_override: true,
      provider_requests: 0,
      cloud_requests: 0,
      cleanup_completed_before_report: true,
      migration_count: 37,
    }),
  );
} catch (error) {
  await fixture.close();
  throw error;
}
