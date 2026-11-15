// A private Unix socket and dedicated disposable role/database are mandatory. No app .env or provider.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DataSource } from 'typeorm';

export async function verifyProductAliases(db, { Migration, applyFilters, normalizeAlias, productSnapshot }) {
  assert.equal(db.options.type, 'postgres');
  assert.equal(db.options.database, 'product_alias_test');
  assert.equal(db.options.username, 'product_alias_test');
  // Standalone execution requires a Unix socket; the CI installation fixture owns its loopback container.
  assert.ok(isAbsolute(db.options.host) || db.options.host === '127.0.0.1');
  assert.deepEqual((await db.query('SELECT current_database() AS database,current_user AS username'))[0],
    { database: 'product_alias_test', username: 'product_alias_test' });
  const schema = 'product_alias_' + randomUUID().replaceAll('-', '');
  assert.match(schema, /^product_alias_[a-f0-9]{32}$/);
  const checks = [];
  await db.query(`CREATE SCHEMA ${schema}`);
  try {
    await db.transaction(async manager => {
      await manager.query(`SET LOCAL search_path TO ${schema}`);
      await manager.query(`CREATE TABLE products (
        id bigint PRIMARY KEY,business_id uuid NOT NULL,name varchar(255) NOT NULL,
        code varchar(255),barcode varchar(255),version integer NOT NULL DEFAULT 1,
        cost_price integer NOT NULL DEFAULT 0,cost_price_tax integer NOT NULL DEFAULT 0,
        sale_price integer NOT NULL DEFAULT 0,stock integer NOT NULL DEFAULT 0,
        measurement_unit text NOT NULL DEFAULT 'unit',offer_price integer,
        is_offer_enabled boolean NOT NULL DEFAULT false,has_stock boolean,
        UNIQUE(business_id,code)
      )`);
      await manager.query('CREATE UNIQUE INDEX fixture_unique_barcode ON products(business_id,barcode) WHERE barcode IS NOT NULL');
      await manager.query(`CREATE TABLE product_logs (
        id uuid PRIMARY KEY,product_id bigint NOT NULL REFERENCES products(id),
        name varchar(255) NOT NULL,product_version integer,changed_fields jsonb NOT NULL DEFAULT '[]'
      )`);
      const business = '11111111-1111-4111-8111-111111111111';
      const other = '22222222-2222-4222-8222-222222222222';
      const exactId = '9007199254740993';
      await manager.query(`INSERT INTO products(id,business_id,name,code,barcode) VALUES
        ($1,$2,'INV/001','C001',NULL),(2,$2,'Invoice line 002',NULL,'001'),
        (3,$2,'Legacy no identifiers',' \u00a0\ufeff ',' \t\u202f '),(4,$3,'Other business','C001',NULL),
        (5,$2,'Real zero identifier','0','000000')`, [exactId, business, other]);
      await manager.query('INSERT INTO product_logs(id,product_id,name,product_version) VALUES($1,$2,$3,1)',
        [randomUUID(), exactId, 'Original invoice name']);
      const baseline = async () => ({
        products: await manager.query("SELECT id::text,to_jsonb(p)-'alias' AS value FROM products p ORDER BY p.id"),
        logs: await manager.query("SELECT id::text,to_jsonb(l)-'alias' AS value FROM product_logs l ORDER BY l.id"),
      });
      const before = await baseline();
      const migration = new Migration();
      await migration.up(manager.queryRunner);
      assert.deepEqual(await baseline(), before);
      assert.equal((await manager.query('SELECT count(*)::int AS count FROM products WHERE alias IS NOT NULL'))[0].count, 0);
      assert.equal((await manager.query('SELECT count(*)::int AS count FROM product_logs WHERE alias IS NOT NULL'))[0].count, 0);
      checks.push('additive_migration_preserves_legacy_fields_bigint_ids_and_unknown_aliases');

      await manager.query('UPDATE products SET alias=$1 WHERE id=$2', [normalizeAlias('  Friendly Coffee  '), exactId]);
      await manager.query('UPDATE products SET alias=$1 WHERE id=2', [normalizeAlias('literal_%\\ alias')]);
      await manager.query('UPDATE products SET alias=$1 WHERE id=4', ['Friendly Coffee']);
      const query = (filters, page = 1, limit = 20) => {
        const qb = manager.createQueryBuilder().select('product.id::text', 'id').from('products', 'product')
          .where('product.business_id = :business', { business }).orderBy('product.id', 'ASC');
        applyFilters(qb, filters);
        return qb.offset((page - 1) * limit).limit(limit);
      };
      const ids = async filters => (await query(filters).getRawMany()).map(row => row.id);
      assert.deepEqual(await ids({ search: 'friendly' }), [exactId]);
      assert.deepEqual(await ids({ search: 'INV/001' }), [exactId]);
      assert.deepEqual(await ids({ search: ' _%\\ ' }), ['2']);
      assert.deepEqual(await ids({ search: 'nothing like this' }), []);
      checks.push('real_query_searches_alias_or_original_name_with_literal_wildcards_and_business_scope');

      assert.deepEqual(await ids({ code_presence: 'present' }), ['5', exactId]);
      assert.deepEqual(await ids({ code_presence: 'missing' }), ['2', '3']);
      assert.deepEqual(await ids({ barcode_presence: 'present' }), ['2', '5']);
      assert.deepEqual(await ids({ barcode_presence: 'missing' }), ['3', exactId]);
      assert.deepEqual(await ids({ code_presence: 'missing', barcode_presence: 'present' }), ['2']);
      assert.deepEqual((await query({}, 2, 2).getRawMany()).map(row => row.id), ['5', exactId]);
      assert.equal((await query({ code_presence: 'missing' }, 1, 1).getRawMany()).length, 1);
      checks.push('presence_filters_before_pagination_distinguish_null_blank_tabs_real_zero_and_leading_zero');

      await manager.query('SAVEPOINT invalid_alias');
      await assert.rejects(() => manager.query('UPDATE products SET alias=$1 WHERE id=$2', ['x'.repeat(256), exactId]), error => error.code === '22001');
      await manager.query('ROLLBACK TO SAVEPOINT invalid_alias');
      await manager.query('SAVEPOINT duplicate_code');
      await assert.rejects(() => manager.query('INSERT INTO products(id,business_id,name,code) VALUES(6,$1,$2,$3)',
        [business, 'Duplicate code', 'C001']), error => error.code === '23505');
      await manager.query('ROLLBACK TO SAVEPOINT duplicate_code');
      await assert.rejects(() => manager.query('INSERT INTO products(id,business_id,name,barcode) VALUES(6,$1,$2,$3)',
        [business, 'Duplicate barcode', '001']), error => error.code === '23505');
      await manager.query('ROLLBACK TO SAVEPOINT duplicate_code');
      checks.push('database_alias_length_and_existing_identifier_uniqueness_are_preserved');

      const [current] = await manager.query('SELECT * FROM products WHERE id=$1', [exactId]);
      const snapshot = productSnapshot(current, 'update', '99', ['alias']);
      await manager.query('INSERT INTO product_logs(id,product_id,name,alias,product_version,changed_fields) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
        [randomUUID(), snapshot.product_id, snapshot.name, snapshot.alias, snapshot.product_version, JSON.stringify(snapshot.changed_fields)]);
      assert.equal((await manager.query('SELECT alias FROM product_logs WHERE name=$1', ['Original invoice name']))[0].alias, null);
      assert.equal((await manager.query('SELECT alias FROM product_logs WHERE name=$1', ['INV/001']))[0].alias, 'Friendly Coffee');
      await manager.query('UPDATE products SET alias=$1 WHERE id=$2', [normalizeAlias(' \t\u00a0 '), exactId]);
      assert.equal((await manager.query('SELECT alias FROM products WHERE id=$1', [exactId]))[0].alias, null);
      assert.equal((await manager.query('SELECT alias FROM product_logs WHERE name=$1', ['INV/001']))[0].alias, 'Friendly Coffee');
      await assert.rejects(() => migration.down(manager.queryRunner), /product_alias_rollback_requires_backup_restore/);
      checks.push('new_snapshot_preserves_reviewed_alias_legacy_stays_unknown_and_rollback_never_discards_data');
    });
    return { schema: 'product-alias-sql/1', status: 'passed', checks,
      operational_db_used: false, provider_calls: 0, authentication_guards_exercised: false };
  } finally {
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.env.PRODUCT_ALIAS_TEST_RELEASE_ROOT;
  if (process.env.PRODUCT_ALIAS_TEST_ISOLATED !== '1' || !root || !isAbsolute(root)
    || !process.env.PGHOST || !isAbsolute(process.env.PGHOST)
    || process.env.PGUSER !== 'product_alias_test' || process.env.PGDATABASE !== 'product_alias_test')
    throw new Error('Dedicated disposable PostgreSQL, Unix socket and explicit compiled release are required');
  const load = name => import(pathToFileURL(resolve(root, 'dist', name)));
  const { AddProductAlias1793660000000: Migration } = await load('migrations/1793660000000-AddProductAlias.js');
  const { applyProductLookupFilters: applyFilters } = await load('product/product-lookup-filters.js');
  const { normalizeProductAlias: normalizeAlias } = await load('product/product-alias.js');
  const { productSnapshot } = await load('product/product-catalog.js');
  const db = new DataSource({ type: 'postgres', host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432),
    username: 'product_alias_test', database: 'product_alias_test', connectTimeoutMS: 5000, logging: false });
  try {
    await db.initialize();
    process.stdout.write(JSON.stringify(await verifyProductAliases(db, { Migration, applyFilters, normalizeAlias, productSnapshot })) + '\n');
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
