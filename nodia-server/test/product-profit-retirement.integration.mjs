// Dedicated disposable PostgreSQL only. No application .env, credentials, provider or operational DB.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DataSource } from 'typeorm';

export async function verifyProductProfitRetirement(db, Migration) {
  assert.equal(db.options.type, 'postgres');
  assert.equal(db.options.database, 'product_retirement_test');
  assert.equal(db.options.username, 'product_retirement_test');
  assert.ok(isAbsolute(db.options.host));
  const [identity] = await db.query('SELECT current_database() AS database,current_user AS username');
  assert.deepEqual(identity, { database: 'product_retirement_test', username: 'product_retirement_test' });
  const schema = 'product_retirement_' + randomUUID().replaceAll('-', '');
  assert.match(schema, /^product_retirement_[a-f0-9]{32}$/);
  const checks = [];
  await db.query(`CREATE SCHEMA ${schema}`);
  try {
    await db.transaction(async manager => {
      await manager.query(`SET LOCAL search_path TO ${schema}`);
      await manager.query(`CREATE TABLE products (
        id bigint PRIMARY KEY,business_id uuid NOT NULL,code text,barcode text,
        measurement_unit text NOT NULL,has_stock boolean,version integer NOT NULL,
        cost_price integer NOT NULL,cost_price_tax integer NOT NULL,
        profit_percentage integer NOT NULL,sale_price integer NOT NULL,offer_price integer,
        UNIQUE(business_id,code)
      )`);
      await manager.query('CREATE UNIQUE INDEX uq_fixture_barcode ON products(business_id,barcode) WHERE barcode IS NOT NULL');
      await manager.query(`CREATE TABLE product_logs (
        id uuid PRIMARY KEY,product_id bigint NOT NULL REFERENCES products(id),product_version integer,
        cost_price integer NOT NULL,cost_price_tax integer NOT NULL,
        profit_percentage integer NOT NULL,sale_price integer NOT NULL,offer_price integer,
        changed_fields jsonb NOT NULL
      )`);
      await manager.query('CREATE TABLE sale_items (id bigint PRIMARY KEY,product_id bigint REFERENCES products(id),unit_price integer NOT NULL,snapshot jsonb NOT NULL)');
      const business = '00000000-0000-4000-8000-000000000001';
      await manager.query(`INSERT INTO products VALUES
        (9007199254740993,$1,'00001','0000123','kg',false,17,-2147483648,0,0,2147483647,0),
        (2,$1,'00002',NULL,'unit',true,3,2147483647,19,99,3,NULL)`, [business]);
      await manager.query(`INSERT INTO product_logs VALUES
        ('00000000-0000-4000-8000-000000000002',9007199254740993,16,123,456,30,789,1,'["profit_percentage","sale_price"]')`);
      await manager.query(`INSERT INTO sale_items VALUES
        (1,9007199254740993,7,'{"unit_price":"7","quantity":"1.5"}')`);
      const snapshot = async () => ({
        products: await manager.query("SELECT p.id::text AS exact_id,to_jsonb(p)-'profit_percentage' AS value FROM products p ORDER BY p.id"),
        logs: await manager.query("SELECT p.product_id::text AS exact_product_id,to_jsonb(p)-'profit_percentage' AS value FROM product_logs p ORDER BY p.id"),
        sales: await manager.query('SELECT s.product_id::text AS exact_product_id,to_jsonb(s) AS value FROM sale_items s ORDER BY s.id'),
      });
      const before = await snapshot();
      assert.equal(before.products.find(row => row.exact_id === '9007199254740993').exact_id, '9007199254740993');
      const migration = new Migration();
      await manager.query('CREATE VIEW fixture_dependency AS SELECT profit_percentage FROM product_logs');
      await manager.query('SAVEPOINT before_failed_drop');
      await assert.rejects(() => migration.up(manager.queryRunner), error => error.code === '2BP01');
      await manager.query('ROLLBACK TO SAVEPOINT before_failed_drop');
      const restored = await manager.query("SELECT table_name FROM information_schema.columns WHERE table_schema=$1 AND table_name IN ('product_logs','products') AND column_name='profit_percentage' ORDER BY table_name", [schema]);
      assert.deepEqual(restored.map(row => row.table_name), ['product_logs', 'products']);
      assert.deepEqual(await snapshot(), before);
      checks.push('dependent_object_rejected_without_cascade_and_transaction_restores_both_columns');
      await manager.query('DROP VIEW fixture_dependency');
      await migration.up(manager.queryRunner);
      assert.equal((await manager.query("SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND column_name='profit_percentage'", [schema])).length, 0);
      assert.deepEqual(await snapshot(), before);
      checks.push('only_two_columns_removed_money_bigint_ids_versions_and_sales_snapshots_preserved');
      await manager.query('SAVEPOINT before_duplicate');
      await assert.rejects(() => manager.query(`INSERT INTO products VALUES (3,$1,'00001',NULL,'unit',true,1,1,2,99,NULL)`, [business]), error => error.code === '23505');
      await manager.query('ROLLBACK TO SAVEPOINT before_duplicate');
      await assert.rejects(() => manager.query(`INSERT INTO products VALUES (3,$1,'distinct','0000123','unit',true,1,1,2,99,NULL)`, [business]), error => error.code === '23505');
      await manager.query('ROLLBACK TO SAVEPOINT before_duplicate');
      await assert.rejects(() => manager.query(`INSERT INTO product_logs VALUES ('00000000-0000-4000-8000-000000000003',999,1,1,2,3,NULL,'[]')`), error => error.code === '23503');
      await manager.query('ROLLBACK TO SAVEPOINT before_duplicate');
      assert.deepEqual(await snapshot(), before);
      checks.push('business_code_barcode_uniqueness_and_log_foreign_key_preserved');
      await assert.rejects(() => migration.down(manager.queryRunner), /product_profit_percentage_rollback_requires_backup_restore/);
      assert.deepEqual(await snapshot(), before);
      checks.push('rollback_requires_original_backup_without_fabricated_percentage');
    });
    return { schema: 'product-profit-retirement-sql/1', status: 'passed', checks,
      operational_db_used: false, provider_calls: 0, authentication_guards_exercised: false };
  } finally {
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
  }
}

if ((process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  || (process.argv[1] === '-' && import.meta.url.endsWith('/[eval1]'))) {
  if (process.env.PRODUCT_RETIREMENT_TEST_ISOLATED !== '1'
    || !process.env.PGHOST || !isAbsolute(process.env.PGHOST)
    || process.env.PGUSER !== 'product_retirement_test' || process.env.PGDATABASE !== 'product_retirement_test'
    || !process.env.PRODUCT_RETIREMENT_TEST_RELEASE_ROOT || !isAbsolute(process.env.PRODUCT_RETIREMENT_TEST_RELEASE_ROOT))
    throw new Error('Dedicated disposable PostgreSQL and isolated compiled release are required');
  const root = process.env.PRODUCT_RETIREMENT_TEST_RELEASE_ROOT;
  const { RemoveProductProfitPercentage1793620000000: Migration } = await import(pathToFileURL(resolve(root, 'dist/migrations/1793620000000-RemoveProductProfitPercentage.js')));
  const db = new DataSource({ type: 'postgres', host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432),
    username: 'product_retirement_test', database: 'product_retirement_test', connectTimeoutMS: 5000, logging: false });
  try {
    await db.initialize();
    process.stdout.write(JSON.stringify(await verifyProductProfitRetirement(db, Migration)) + '\n');
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
