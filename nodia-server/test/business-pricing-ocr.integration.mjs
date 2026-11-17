// Disposable PostgreSQL only. No application dotenv, provider, operational DB or signed history.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { UpdateProviderDto } from '../dist/provider/dto/update-provider.dto.js';
import { ProviderOcrAndOptionalInvoiceCode1793680000000 } from '../dist/migrations/1793680000000-ProviderOcrAndOptionalInvoiceCode.js';
import { CreateProviderContacts1791220000000 } from '../dist/migrations/1791220000000-CreateProviderContacts.js';
import { CreateBusinessCashCategories1793690000000 } from '../dist/migrations/1793690000000-CreateBusinessCashCategories.js';
import { CreateBusinessCashMovements1793700000000 } from '../dist/migrations/1793700000000-CreateBusinessCashMovements.js';
import { LinkBusinessCashInvoiceExpenses1793710000000 } from '../dist/migrations/1793710000000-LinkBusinessCashInvoiceExpenses.js';
import { ProductService } from '../dist/product/product.service.js';
import { Product } from '../dist/product/entities/product.entity.js';
import { ProductLog } from '../dist/product/entities/product-log.entity.js';
import { ProviderService } from '../dist/provider/provider.service.js';
import { Provider } from '../dist/provider/entities/provider.entity.js';
import { InvoiceService } from '../dist/invoice/invoice.service.js';
import { Invoice } from '../dist/invoice/entities/invoice.entity.js';
import { ImportProvidersUseCase } from '../dist/provider/use-case/import-providers.use-case.js';
import { ExportProvidersCsvUseCase } from '../dist/provider/use-case/export-providers-csv.use-case.js';
import { installBusinessAccessFixture, businessAccessTestSession } from './fixtures/business-access.fixture.mjs';

const container = `nodia_business_adjustments_${process.pid}_${randomBytes(4).toString('hex')}`;
const database = 'business_adjustments_test';
const portOverride = process.env.BUSINESS_PRICING_OCR_TEST_PORT;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const checks = [];
let db, started = false;
try {
  let port;
  if (portOverride !== undefined) {
    assert.match(portOverride, /^[1-9][0-9]{0,4}$/);
    port = Number(portOverride);
    assert.ok(port >= 1024 && port <= 65535, 'Expected an explicit loopback test port');
  } else {
    docker('run', '--detach', '--rm', '--name', container, '--publish', '127.0.0.1::5432',
      '--env', `POSTGRES_DB=${database}`, '--env', `POSTGRES_USER=${database}`,
      '--env', `POSTGRES_PASSWORD=${container}`, 'postgres:16-alpine');
    started = true;
    for (let i = 0; i < 40; i++) {
      try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', database); break; }
      catch { if (i === 39) throw new Error('disposable_postgres_unavailable'); await delay(250); }
    }
    const mapping = docker('port', container, '5432/tcp');
    assert.match(mapping, /^127\.0\.0\.1:\d+$/);
    port = Number(mapping.split(':')[1]);
  }
  db = new DataSource({ type: 'postgres', host: '127.0.0.1', port,
    username: database, password: started ? container : database, database, synchronize: false, installExtensions: false,
    entities: [fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url))] });
  await db.initialize();
  const [identity] = await db.query(`SELECT current_database() AS db,current_user AS username,
    current_setting('server_version_num')::int/10000 AS major,
    shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()`);
  assert.equal(identity.db, database);
  assert.equal(identity.username, database);
  assert.equal(identity.major, 16);
  if (!started)
    assert.equal(identity.marker, 'nodia-disposable:business-price-ocr', 'Refusing an unmarked database');
  assert.deepEqual(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'"), []);
  await installBusinessAccessFixture(db);
  await db.query("ALTER TABLE businesses ADD COLUMN sales_timezone varchar(64) NOT NULL DEFAULT 'America/Santiago'");
  await db.query(`CREATE TABLE providers(id bigserial PRIMARY KEY,business_id uuid NOT NULL REFERENCES businesses(id),name varchar(255) NOT NULL,tax int NOT NULL DEFAULT 19,fields jsonb NOT NULL DEFAULT '{}',is_active boolean NOT NULL DEFAULT true,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE invoices(id bigserial PRIMARY KEY,business_id uuid NOT NULL REFERENCES businesses(id),provider_id bigint REFERENCES providers(id),code varchar(255) NOT NULL,total_amount integer NOT NULL DEFAULT 0,path_storage varchar(255) NOT NULL DEFAULT '',data jsonb NOT NULL DEFAULT '{}',is_active boolean NOT NULL DEFAULT true,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE products(id bigserial PRIMARY KEY,business_id uuid NOT NULL REFERENCES businesses(id),provider_id bigint REFERENCES providers(id),code varchar(255),barcode varchar(255),name varchar(255) NOT NULL,alias varchar(255),measurement_unit varchar(16) NOT NULL DEFAULT 'unit',cost_price integer NOT NULL,cost_price_tax integer NOT NULL,sale_price integer NOT NULL,offer_price integer,is_offer_enabled boolean NOT NULL DEFAULT false,has_stock boolean,version integer NOT NULL DEFAULT 1,stock integer NOT NULL DEFAULT 0,is_active boolean NOT NULL DEFAULT true,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE product_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id bigint NOT NULL REFERENCES products(id),code varchar(255),barcode varchar(255),name varchar(255) NOT NULL,alias varchar(255),measurement_unit varchar(16) NOT NULL DEFAULT 'unit',cost_price integer NOT NULL,cost_price_tax integer NOT NULL,sale_price integer NOT NULL,offer_price integer,is_offer_enabled boolean,has_stock boolean,product_version integer,stock integer NOT NULL DEFAULT 0,event_type varchar(40) NOT NULL DEFAULT 'legacy',source varchar(40) NOT NULL DEFAULT 'legacy',actor_id bigint,changed_fields jsonb NOT NULL DEFAULT '[]',image_id uuid,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())`);
  const business = randomUUID();
  await db.query('INSERT INTO businesses(id) VALUES($1)', [business]);
  await db.query(`INSERT INTO providers(business_id,name,fields) VALUES($1,'Historical supplier','{"code":"Original"}');
    `, [business]);
  await db.query('INSERT INTO invoices(business_id,provider_id,code,data) VALUES($1,1,$2,$3)', [business, '0001445', { historical: true }]);
  const before = { providers: await db.query('SELECT to_jsonb(p) AS value FROM providers p'), invoices: await db.query('SELECT to_jsonb(i) AS value FROM invoices i') };
  const q = db.createQueryRunner();
  try { await new ProviderOcrAndOptionalInvoiceCode1793680000000().up(q); await new CreateProviderContacts1791220000000().up(q); } finally { await q.release(); }
  assert.deepEqual(await db.query("SELECT to_jsonb(p)-'use_ocr' AS value FROM providers p"), before.providers);
  assert.deepEqual(await db.query('SELECT to_jsonb(i) AS value FROM invoices i'), before.invoices);
  assert.equal((await db.query('SELECT use_ocr FROM providers WHERE id=1'))[0].use_ocr, false);
  const columns = await db.query("SELECT table_name,column_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND ((table_name='providers' AND column_name='use_ocr') OR (table_name='invoices' AND column_name='code')) ORDER BY table_name");
  assert.equal(columns[0].is_nullable, 'YES'); assert.equal(columns[1].is_nullable, 'NO'); assert.equal(columns[1].column_default, 'false');
  checks.push('real_migration_preserves_legacy_provider_and_invoice_bytes_default_false_nullable_folio');
  const actor = { userId: '3', sessionId: businessAccessTestSession('3') };
  const suppliers = new ProviderService(db.getRepository(Provider));
  const normal = await suppliers.create({ business_id: business, name: 'Manual supplier' }, undefined, actor);
  const ocr = await suppliers.create({ business_id: business, name: 'OCR supplier', use_ocr: true, tax: 7, fields: { code: 'Exact invoice column' } }, undefined, actor);
  assert.equal(normal.use_ocr, false); assert.equal(ocr.use_ocr, true);
  await db.transaction(manager => suppliers.update(ocr.id, plainToInstance(UpdateProviderDto, { use_ocr: false }), manager, actor));
  const preserved = await db.getRepository(Provider).findOneByOrFail({ id: ocr.id });
  assert.equal(preserved.tax, 7); assert.deepEqual(preserved.fields, { code: 'Exact invoice column' });
  await db.transaction(manager => suppliers.update(ocr.id, { use_ocr: true }, manager, actor));
  checks.push('ocr_only_patch_preserves_custom_tax_and_hidden_invoice_mapping');

  const filtered = await suppliers.findAll({ q: { business_id_eq: business, use_ocr_eq: true }, page: 1, limit: 1, includes: false }, actor);
  assert.deepEqual(filtered.data.map(p => p.id), [ocr.id]); assert.equal(filtered.meta.total_items, 1);
  const ordinary = await suppliers.findAll({ q: { business_id_eq: business }, all: true, includes: false }, actor);
  assert.equal(ordinary.data.length, 3);
  checks.push('opt_in_false_default_exact_boolean_filter_applies_before_pagination_no_filter_keeps_all');
  const imports = new ImportProvidersUseCase(db);
  await imports.execute({ items: [{ id: ocr.id, business_id: business, name: 'OCR supplier' }] }, actor);
  assert.equal((await db.getRepository(Provider).findOneByOrFail({ id: ocr.id })).use_ocr, true);
  const csv = await new ExportProvidersCsvUseCase(suppliers).execute({ business_id: business, ids: [ocr.id], lang: 'en' }, undefined, actor);
  assert.match(csv.split('\n')[0], /Use OCR \(use_ocr\)$/); assert.match(csv.split('\n')[1], /,2,true$/);
  await imports.execute({ items: [{ id: ocr.id, business_id: business, name: 'OCR supplier', use_ocr: false }] }, actor);
  assert.equal((await db.getRepository(Provider).findOneByOrFail({ id: ocr.id })).use_ocr, false);
  checks.push('csv_opt_in_roundtrips_and_legacy_omission_preserves_existing_preference');
  const cash = db.createQueryRunner();
  try {
    await new CreateBusinessCashCategories1793690000000().up(cash);
    await new CreateBusinessCashMovements1793700000000().up(cash);
    await new LinkBusinessCashInvoiceExpenses1793710000000().up(cash);
  } finally {
    await cash.release();
  }
  const invoices = new InvoiceService(db.getRepository(Invoice));
  const absent = await invoices.createInvoice({ business_id: business, provider_id: normal.id }, undefined, actor);
  assert.equal(absent.code, null);
  await invoices.updateInvoice(absent.id, { code: '  0001445  ' }, undefined, actor);
  await invoices.updateInvoice(absent.id, { total_amount: 42 }, undefined, actor);
  assert.equal((await invoices.findOneInvoice(absent.id, undefined, actor)).code, '0001445');
  await invoices.updateInvoice(absent.id, { code: '  ' }, undefined, actor);
  assert.equal((await invoices.findOneInvoice(absent.id, undefined, actor)).code, null);
  checks.push('native_invoice_create_update_read_preserves_omission_and_clears_only_explicit_folio');
  // Real authority/business checks and persistence; module lookup is outside this price-policy gate.
  const products = new ProductService(db.getRepository(Product), db.getRepository(ProductLog), { execute: async () => undefined });
  const base = { business_id: business, provider_id: normal.id, name: 'Synthetic product', cost_price: 1111, cost_price_tax: 1322, sale_price: 1444, offer_price: 1333, has_stock: true };
  const created = await products.createProduct(base, undefined, actor);
  assert.equal(created.sale_price, 1440); assert.equal(created.cost_price, 1111); assert.equal(created.cost_price_tax, 1322); assert.equal(created.offer_price, 1333);
  const oldLog = (await db.query('SELECT id::text,to_jsonb(l) AS value FROM product_logs l WHERE product_id=$1', [created.id]))[0];
  const bulk = await products.createBulkProducts({ items: [{ ...base, sale_price: 1445 }, { ...base, sale_price: 1444 }] }, undefined, actor);
  assert.deepEqual(bulk.map(p => p.sale_price), [1450, 1440]);
  await products.updateProduct(created.id, { sale_price: 1445 }, undefined, actor);
  await products.updateBulkProducts({ items: [{ id: bulk[0].id, sale_price: 1454 }, { id: bulk[1].id, name: 'Unrelated edit' }] }, undefined, actor);
  assert.equal((await db.getRepository(Product).findOneByOrFail({ id: created.id })).sale_price, 1450);
  assert.equal((await db.getRepository(Product).findOneByOrFail({ id: bulk[0].id })).sale_price, 1450);
  assert.equal((await db.getRepository(Product).findOneByOrFail({ id: bulk[1].id })).sale_price, 1440);
  assert.deepEqual((await db.query('SELECT to_jsonb(l) AS value FROM product_logs l WHERE id=$1', [oldLog.id]))[0].value, oldLog.value);
  assert.equal((await db.query('SELECT sale_price FROM product_logs WHERE product_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [created.id]))[0].sale_price, 1450);
  const count = (await db.query('SELECT count(*)::int AS count FROM products'))[0].count;
  await assert.rejects(() => products.createProduct({ ...base, sale_price: 2147483645 }, undefined, actor), /product:invalid_price/);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM products'))[0].count, count);
  checks.push('real_native_create_update_bulk_round_sales_only_new_snapshots_match_and_overflow_rolls_back');
  await assert.rejects(() => new ProviderOcrAndOptionalInvoiceCode1793680000000().down(), /rollback_requires_backup_restore/);
  checks.push('destructive_rollback_is_explicitly_refused_without_backup_restore');
  console.log(JSON.stringify({ task: 'business_pricing_ocr', status: 'passed', checks, count: checks.length, limits: ['Synthetic PostgreSQL schema and actor; no operational DB or provider.', 'Does not prove external OCR, browser acceptance or full historical schema migration.', 'Product module lookup is stubbed; authority and business access run against the fixture.'] }));
} finally {
  if (db?.isInitialized) await db.destroy();
  if (started) docker('stop', container);
}
