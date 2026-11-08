import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory, Reflector } from '@nestjs/core';
import {
  installBusinessAccessFixture,
  businessAccessTestPrincipal,
} from './fixtures/business-access.fixture.mjs';
import { AddProductPosCatalog1793400000000 } from '../dist/migrations/1793400000000-AddProductPosCatalog.js';
import { CreateBusinessSales1793410000000 } from '../dist/migrations/1793410000000-CreateBusinessSales.js';
import { AddDirectSaleCheckout1793420000000 } from '../dist/migrations/1793420000000-AddDirectSaleCheckout.js';
import { verifyDirectSaleCheckout } from './business-sales-checkout.integration.mjs';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { ModuleAccessGuard } from '../dist/authorization/module-access.guard.js';
import { SaleService } from '../dist/sale/sale.service.js';
import { MutateSaleUseCase } from '../dist/sale/use-case/mutate-sale.use-case.js';
import { ReadSalesUseCase } from '../dist/sale/use-case/read-sales.use-case.js';
import { SaleController } from '../dist/sale/sale.controller.js';
import { SaleModule } from '../dist/sale/sale.module.js';
import { ProductModule } from '../dist/product/product.module.js';
import { ProductService } from '../dist/product/product.service.js';
import { ProductImageModule } from '../dist/product-image/product-image.module.js';
import { ProductImageService } from '../dist/product-image/product-image.service.js';
import { ManageProductImageUseCase } from '../dist/product-image/use-case/manage-product-image.use-case.js';
import { ProductImageRecoveryWorker } from '../dist/product-image/product-image-recovery.worker.js';
import { RedisService } from '../dist/common/redis/redis.service.js';
import { createCanvas } from '@napi-rs/canvas';
import { StorageService } from '../dist/common/storage/storage.service.js';
import { verifyNodiaAiPosPorts } from './nodia-ai-pos-ports.integration.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

// All fixtures and effects belong to this disposable container. No application .env/DataSource.
const container = `template_sales_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const postgresImage =
  process.env.NODIA_SALES_TEST_POSTGRES_IMAGE ?? 'postgres:16-alpine';
assert.ok(
  postgresImage === 'postgres:16-alpine' ||
    /^sha256:[a-f0-9]{64}$/.test(postgresImage),
);
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const business = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const principal = businessAccessTestPrincipal('1');
const actor = { userId: '1', sessionId: principal.sessionId };
const other = {
  userId: '2',
  sessionId: businessAccessTestPrincipal('2').sessionId,
};
const checks = [];
const realR2 = process.argv.includes('--real-r2');
const pendingCloudKeys = new Set();
const observedCloudKeys = new Set();
let realStorage;
const check = async (name, work) => {
  await work();
  checks.push(name);
};
let started = false,
  db,
  app,
  domainContext;
try {
  docker(
    'run',
    '--pull=never',
    '--detach',
    '--rm',
    '--name',
    container,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    'POSTGRES_DB=sales_test',
    '--env',
    'POSTGRES_USER=sales_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    postgresImage,
  );
  started = true;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'sales_test',
        '-d',
        'sales_test',
      );
      break;
    } catch (error) {
      if (attempt === 39) throw error;
      await delay(200);
    }
  }
  db = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'sales_test',
    password,
    database: 'sales_test',
    synchronize: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
  });
  await db.initialize();
  await installBusinessAccessFixture(db);
  await db.query(`ALTER TABLE module_groups ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    ALTER TABLE modules ADD COLUMN key text,ADD COLUMN link text,ADD COLUMN module_group_id bigint,ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    ALTER TABLE user_modules ADD COLUMN user_id bigint,ADD COLUMN module_id bigint,ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    INSERT INTO module_groups(id) VALUES(1);
    INSERT INTO modules(id,key,link,module_group_id) VALUES(1,'businesses','/business',1);
    INSERT INTO user_modules(id,user_id,module_id) VALUES(1,1,1),(2,2,1);
    INSERT INTO businesses(id,owner_id) VALUES('${business}',1),('${foreign}',2);
    CREATE TABLE products(id bigserial PRIMARY KEY,business_id uuid NOT NULL REFERENCES businesses(id),provider_id bigint,
      code varchar(255) NOT NULL,name varchar(255) NOT NULL,cost_price integer NOT NULL,cost_price_tax integer NOT NULL,
      profit_percentage integer NOT NULL,sale_price integer NOT NULL,stock integer NOT NULL DEFAULT 0,is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now(),UNIQUE(business_id,code));
    CREATE TABLE product_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id bigint NOT NULL REFERENCES products(id),code varchar(255) NOT NULL,
      name varchar(255) NOT NULL,cost_price integer NOT NULL,cost_price_tax integer NOT NULL,profit_percentage integer NOT NULL,
      sale_price integer NOT NULL,stock integer NOT NULL DEFAULT 0,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());`);
  const catalog = new AddProductPosCatalog1793400000000(),
    sales = new CreateBusinessSales1793410000000(),
    checkout = new AddDirectSaleCheckout1793420000000();
  const migration = async (instance, direction) =>
    db.transaction((tx) => instance[direction](tx.queryRunner));
  await check('additive migrations up/down/up', async () => {
    await migration(catalog, 'up');
    await migration(sales, 'up');
    await migration(checkout, 'up');
    await migration(checkout, 'down');
    await migration(sales, 'down');
    await migration(catalog, 'down');
    await migration(catalog, 'up');
    await migration(sales, 'up');
    await migration(checkout, 'up');
    const constraints =
      await db.query(`SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conname IN ('sale_mutation_requests_operation_check','sale_events_event_type_check') ORDER BY conname`);
    assert.equal(constraints.length, 2);
    assert.ok(constraints.every((row) => row.definition.includes('checkout')));
    assert.equal(
      (await db.query('SELECT sales_timezone FROM businesses LIMIT 1'))[0]
        .sales_timezone,
      'America/Santiago',
    );
  });
  await db.query(
    `INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,barcode,has_stock)
    VALUES($1,'invoice-a','A',800,952,30,1500,'001234',true),($1,'invoice-b','B',200,238,30,500,'005678',true),
    ($1,'unclassified','Unclassified',0,0,0,100,null,null),($1,'zero','Zero',0,0,0,0,null,true),
    ($2,'private','Private',0,0,0,100,'001234',true)`,
    [business, foreign],
  );
  const modules = new CheckModuleAccessUseCase(db),
    store = new SaleService();
  const mutate = new MutateSaleUseCase(db, store, modules),
    read = new ReadSalesUseCase(db, store, modules);
  await check(
    'compiled Nest modules and ESM ORM metadata compose',
    async () => {
      class TestDatabaseModule {}
      Global()(TestDatabaseModule);
      Module({
        providers: [
          { provide: DataSource, useValue: db },
          {
            provide: RedisService,
            useValue: { get: async () => null, set: async () => undefined },
          },
        ],
        exports: [DataSource, RedisService],
      })(TestDatabaseModule);
      class TestDomainModule {}
      Module({
        imports: [
          TestDatabaseModule,
          SaleModule,
          ProductModule,
          ProductImageModule,
        ],
      })(TestDomainModule);
      domainContext = await NestFactory.createApplicationContext(
        TestDomainModule,
        { logger: false, abortOnError: false },
      );
      assert.ok(domainContext.get(MutateSaleUseCase));
      assert.ok(domainContext.get(ReadSalesUseCase));
      assert.ok(domainContext.get(ManageProductImageUseCase));
      await domainContext.get(ProductImageRecoveryWorker).onModuleDestroy();
    },
  );
  const item = (id = '1', quantity = 1, price = '1500', version = 1) => ({
    product_id: id,
    quantity,
    expected_product_version: version,
    expected_unit_price: price,
  });
  const create = (items = [], extra = {}) =>
    mutate.execute(
      business,
      'create',
      { request_key: randomUUID(), items, ...extra },
      actor,
    );
  const transition = (sale, operation, extra = {}) =>
    mutate.execute(
      business,
      operation,
      {
        request_key: randomUUID(),
        sale_id: sale.id,
        expected_version: sale.version,
        ...extra,
      },
      actor,
    );
  let draft, completed;
  await check('empty draft and zero total rejection rollback', async () => {
    const empty = await create();
    assert.equal(empty.total_amount, '0');
    assert.equal(empty.payment_method, 'cash');
    const key = randomUUID();
    await assert.rejects(
      () => transition(empty, 'complete', { request_key: key }),
      /positive_total/,
    );
    assert.deepEqual(await read.receipt(business, key, actor), {
      status: 'unconfirmed',
    });
    assert.equal((await read.get(business, empty.id, actor)).version, 1);
    const zero = await create([item('4', 1, '0')]);
    assert.equal(zero.total_amount, '0');
    await assert.rejects(() => transition(zero, 'complete'), /positive_total/);
  });
  await check('authority and module revocation', async () => {
    await assert.rejects(
      () => read.list(business, {}, other),
      /resource_not_found/,
    );
    await db.query('UPDATE user_modules SET is_active=false WHERE user_id=1');
    await assert.rejects(() => create(), /module_access_required/);
    await db.query('UPDATE user_modules SET is_active=true WHERE user_id=1');
  });
  await check(
    'same intent replays original, changed command conflicts',
    async () => {
      const key = randomUUID(),
        command = {
          request_key: key,
          items: [item('1', 2), item('2', 1, '500')],
          payment_method: 'bank_transfer',
        };
      draft = await mutate.execute(business, 'create', command, actor);
      assert.equal(draft.total_amount, '3500');
      const replay = await mutate.execute(
        business.toUpperCase(),
        'create',
        command,
        actor,
      );
      assert.deepEqual(replay, draft);
      await assert.rejects(
        () =>
          mutate.execute(
            business,
            'create',
            { ...command, payment_method: 'cash' },
            actor,
          ),
        /request_conflict/,
      );
      assert.equal(
        (
          await db.query('SELECT count(*)::text AS n FROM sales WHERE id=$1', [
            draft.id,
          ])
        )[0].n,
        '1',
      );
    },
  );
  await check(
    'two concurrent completions have one effect and durable receipt',
    async () => {
      const command = {
        request_key: randomUUID(),
        sale_id: draft.id,
        expected_version: draft.version,
      };
      const results = await Promise.all([
        mutate.execute(business, 'complete', command, actor),
        mutate.execute(business, 'complete', command, actor),
      ]);
      assert.deepEqual(results[0], results[1]);
      completed = results[0];
      assert.equal(completed.version, 2);
      assert.equal(completed.payment_method, 'bank_transfer');
      assert.deepEqual(
        (await read.receipt(business, command.request_key, actor)).sale,
        completed,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::text AS n FROM sale_events WHERE sale_id=$1 AND event_type='complete'",
            [draft.id],
          )
        )[0].n,
        '1',
      );
    },
  );
  await check(
    'different identities cannot both complete one revision',
    async () => {
      const sale = await create([item()]);
      const results = await Promise.allSettled([
        transition(sale, 'complete'),
        transition(sale, 'complete'),
      ]);
      assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
      assert.match(
        results.find((x) => x.status === 'rejected').reason.message,
        /version_conflict/,
      );
    },
  );
  await check(
    'confirmed immutability, cancellation and receipt history',
    async () => {
      await assert.rejects(
        () => transition(completed, 'update', { payment_method: 'cash' }),
        /state_conflict/,
      );
      const cancelled = await transition(completed, 'cancel', {
        cancellation_reason: 'Synthetic correction',
      });
      assert.equal(cancelled.status, 'cancelled');
      assert.equal(cancelled.completed_at, completed.completed_at);
      assert.equal(cancelled.total_amount, completed.total_amount);
      assert.deepEqual(cancelled.items, completed.items);
      await assert.rejects(
        () => transition(cancelled, 'complete'),
        /state_conflict/,
      );
      await assert.rejects(
        () => transition(cancelled, 'discard'),
        /state_conflict/,
      );
    },
  );
  await check(
    'unknown availability and foreign items never become sale lines',
    async () => {
      await assert.rejects(() => create([item('3', 1, '100')]), /unavailable/);
      await assert.rejects(() => create([item('5', 1, '100')]), /unavailable/);
      assert.equal(
        (await db.query('SELECT has_stock FROM products WHERE id=3'))[0]
          .has_stock,
        null,
      );
    },
  );
  await check(
    'stale alternative cannot silently change draft, historical sale remains fixed',
    async () => {
      const sale = await create([item()]);
      await db.query(
        "UPDATE products SET is_offer_enabled=true,offer_price=2000,version=2,name='Current renamed' WHERE id=1",
      );
      await assert.rejects(
        () => transition(sale, 'complete'),
        /product_changed/,
      );
      const edited = await transition(sale, 'update', {
        items: [item('1', 2, '2000', 2)],
      });
      assert.equal(edited.items[0].price_source, 'offer');
      assert.equal(edited.items[0].regular_unit_price, '1500');
      assert.equal(edited.total_amount, '4000');
      const sold = await transition(edited, 'complete');
      await db.query(
        "UPDATE products SET offer_price=1000,is_offer_enabled=false,version=3,name='Later' WHERE id=1",
      );
      assert.deepEqual(await read.get(business, sold.id, actor), sold);
    },
  );
  await check(
    'payment updates preserve explicit selection and cash default canonicalization',
    async () => {
      const sale = await create([], { payment_method: 'credit_card' });
      const edited = await transition(sale, 'update', {
        payment_method_description: 'Synthetic note',
      });
      assert.equal(edited.payment_method, 'credit_card');
      const key = randomUUID();
      const first = await mutate.execute(
        business,
        'create',
        { request_key: key },
        actor,
      );
      assert.deepEqual(
        await mutate.execute(
          business,
          'create',
          { request_key: key, payment_method: 'cash' },
          actor,
        ),
        first,
      );
    },
  );
  await check(
    'discard is logical, audit append-only, rollback refuses data loss',
    async () => {
      const sale = await create();
      const discarded = await transition(sale, 'discard');
      assert.equal(discarded.status, 'discarded');
      assert.equal(
        (await read.list(business, { status: 'discarded' }, actor)).data.some(
          (x) => x.id === sale.id,
        ),
        true,
      );
      await assert.rejects(
        () =>
          db.query('UPDATE sale_events SET origin=origin WHERE sale_id=$1', [
            sale.id,
          ]),
        /append-only/,
      );
      await assert.rejects(
        () => migration(sales, 'down'),
        /rollback_would_lose/,
      );
    },
  );
  await check(
    'FK rejects a cross-business product even outside HTTP',
    async () => {
      const sale = await create([item('2', 1, '500')]);
      await assert.rejects(
        () =>
          db.query('UPDATE sale_items SET product_id=5 WHERE sale_id=$1', [
            sale.id,
          ]),
        (error) => error.code === '23503',
      );
    },
  );
  await check(
    'uncommitted receipt absence is uncertain and original identity recovers',
    async () => {
      const key = randomUUID();
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        const created = await mutate.execute(
          business,
          'create',
          { request_key: key, items: [] },
          actor,
          runner.manager,
        );
        assert.deepEqual(await read.receipt(business, key, actor), {
          status: 'unconfirmed',
        });
        await runner.commitTransaction();
        assert.equal(
          (await read.receipt(business, key, actor)).sale.id,
          created.id,
        );
        assert.deepEqual(
          await mutate.execute(business, 'create', { request_key: key }, actor),
          created,
        );
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    },
  );
  await check(
    'HTTP DTOs and module policy reject invented price and retroactive date',
    async () => {
      class TestAuthenticationGuard {
        canActivate(context) {
          context.switchToHttp().getRequest().auth = principal;
          return true;
        }
      }
      class TestModule {}
      Module({
        controllers: [SaleController],
        providers: [
          { provide: MutateSaleUseCase, useValue: mutate },
          { provide: ReadSalesUseCase, useValue: read },
          { provide: APP_GUARD, useClass: TestAuthenticationGuard },
          {
            provide: APP_GUARD,
            useValue: new ModuleAccessGuard(new Reflector(), modules),
          },
        ],
      })(TestModule);
      app = await NestFactory.create(TestModule, {
        logger: false,
        abortOnError: false,
      });
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.listen(0, '127.0.0.1');
      const base = await app.getUrl();
      for (const extra of [
        { total_amount: '1' },
        { completed_at: '2020-01-01T00:00:00Z' },
      ]) {
        const response = await fetch(`${base}/businesses/${business}/sales`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ request_key: randomUUID(), ...extra }),
        });
        assert.equal(response.status, 400);
      }
      const response = await fetch(`${base}/businesses/${business}/sales`);
      assert.equal(response.status, 200);
    },
  );
  await verifyDirectSaleCheckout({
    db,
    mutate,
    read,
    actor,
    other,
    check,
    httpBase: await app.getUrl(),
  });
  await check(
    'reports aggregate complete population, exact sums, historical labels and cancellation',
    async () => {
      // Historical synthetic fixtures exercise ranking without duplicating the transactional tests above.
      const ids = [];
      for (let index = 0; index < 35; index++) {
        const [p] = await db.query(
          `INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,has_stock)
        VALUES($1,$2,$3,0,0,0,$4,true) RETURNING id::text`,
          [business, `rank-${index}`, `Rank ${index}`, index + 1],
        );
        const saleId = randomUUID();
        ids.push(saleId);
        await db.query(
          `INSERT INTO sales(id,business_id,status,total_amount,created_by,updated_by,completed_by,completed_at)
        VALUES($1,$2,'completed',$3,1,1,1,'2027-10-01T03:00:00Z')`,
          [saleId, business, String(index + 1)],
        );
        await db.query(
          `INSERT INTO sale_items(id,business_id,sale_id,product_id,position,quantity,product_code_snapshot,product_name_snapshot,
        regular_unit_price,is_offer_enabled_snapshot,price_source,unit_price,line_total,product_version)
        VALUES($1,$2,$3,$4,0,1,$5,$6,$7,false,'regular',$7,$7,1)`,
          [
            randomUUID(),
            business,
            saleId,
            p.id,
            `rank-${index}`,
            `Historic ${index}`,
            String(index + 1),
          ],
        );
      }
      const period = {
        from: '2027-10-01T03:00:00Z',
        to_exclusive: '2027-11-01T03:00:00Z',
      };
      const before = await read.summary(business, period, actor);
      assert.equal(before.sales_count, '35');
      assert.equal(before.total_amount, '630');
      assert.equal(before.units_sold, '35');
      const top = await read.topProducts(
        business,
        { ...period, metric: 'amount', limit: 2 },
        actor,
      );
      assert.deepEqual(
        top.data.map((x) => x.total_amount),
        ['35', '34'],
      );
      assert.equal(top.data[0].name, 'Historic 34');
      const sale = await read.get(business, ids.at(-1), actor);
      await transition(sale, 'cancel', {
        cancellation_reason: 'Synthetic ranking correction',
      });
      const after = await read.summary(business, period, actor);
      assert.equal(after.total_amount, '595');
      assert.equal(after.sales_count, '34');
      const empty = await read.summary(
        business,
        { from: '2030-01-01T00:00:00Z', to_exclusive: '2030-02-01T00:00:00Z' },
        actor,
      );
      assert.equal(empty.total_amount, '0');
      assert.equal(empty.average_ticket, null);
    },
  );
  await check(
    'money above JS safe integer survives receipt and shared reports',
    async () => {
      await db.query(
        'UPDATE products SET sale_price=2000000001,version=2 WHERE id=2',
      );
      const sale = await create([item('2', 10000000, '2000000001', 2)]);
      const sold = await transition(sale, 'complete');
      assert.equal(sold.total_amount, '20000000010000000');
      assert.ok(
        BigInt((await read.summary(business, {}, actor)).total_amount) >=
          20000000010000000n,
      );
    },
  );
  await check(
    'receipts remain actor-private and revocation invalidates historical access',
    async () => {
      await db.query(
        'INSERT INTO business_collaborators(business_id,user_id) VALUES($1,2)',
        [business],
      );
      const key = randomUUID();
      await mutate.execute(business, 'create', { request_key: key }, actor);
      assert.deepEqual(await read.receipt(business, key, other), {
        status: 'unconfirmed',
      });
      await db.query(
        'UPDATE business_collaborators SET is_active=false WHERE business_id=$1 AND user_id=2',
        [business],
      );
      await assert.rejects(
        () => read.summary(business, {}, other),
        /resource_not_found/,
      );
    },
  );
  await check(
    'image durable attempt, lost PUT response, attach replacement, removal and late-object cleanup',
    async () => {
      const objects = new Map();
      let puts = 0,
        loseResponse = true;
      if (realR2) realStorage = new StorageService();
      const storage = {
        uploadFileOnce: async (key, bytes, mime) => {
          puts++;
          if (realStorage) {
            pendingCloudKeys.add(key);
            await realStorage.uploadFileOnce(key, bytes, mime);
            observedCloudKeys.add(key);
          }
          objects.set(key, Buffer.from(bytes));
          if (loseResponse && !realR2) {
            loseResponse = false;
            throw Error('synthetic_lost_response');
          }
          return key;
        },
        downloadFile: async (key, max, signal) => {
          if (realStorage) {
            try {
              const bytes = await realStorage.downloadFile(key, max, signal);
              observedCloudKeys.add(key);
              return bytes;
            } catch (error) {
              if (
                (error?.name === 'NoSuchKey' ||
                  error?.name === 'NotFound' ||
                  error?.$metadata?.httpStatusCode === 404) &&
                observedCloudKeys.has(key)
              )
                pendingCloudKeys.delete(key);
              throw error;
            }
          }
          if (!objects.has(key))
            throw Object.assign(Error('synthetic_absent'), {
              name: 'NoSuchKey',
              $metadata: { httpStatusCode: 404 },
            });
          const bytes = objects.get(key);
          if (bytes.length > max) throw Error('synthetic_download_limit');
          return Buffer.from(bytes);
        },
        deleteFile: async (key) => {
          if (realStorage) await realStorage.deleteFile(key);
          objects.delete(key);
        },
        getSignedFileUrl: async (key, ttl) =>
          realStorage
            ? realStorage.getSignedFileUrl(key, ttl)
            : 'https://synthetic.invalid/private-image',
      };
      const images = new ManageProductImageUseCase(
        new ProductImageService(db),
        storage,
        modules,
      );
      const [source] = await db.query(
        'SELECT version FROM products WHERE id=1',
      );
      const canvas = createCanvas(3, 2);
      canvas.getContext('2d').fillRect(0, 0, 3, 2);
      const file = {
        buffer: await canvas.encode('png'),
        mimetype: 'image/png',
      };
      const key = randomUUID(),
        request = {
          product_id: '1',
          expected_product_version: source.version,
          request_key: key,
        };
      const reserved = await images.reserve(actor, business, request);
      assert.equal(reserved.id, key);
      assert.deepEqual(
        await images.reserve(actor, business, request),
        reserved,
      );
      if (realR2) await images.upload(actor, business, key, file);
      else
        await assert.rejects(
          () => images.upload(actor, business, key, file),
          /image_upload_unknown/,
        );
      assert.equal((await images.status(actor, business, key)).status, 'ready');
      assert.equal(
        (await images.upload(actor, business, key, file)).status,
        'ready',
      );
      assert.equal(puts, 1);
      const attached = await images.complete(
        actor,
        business,
        key,
        source.version,
      );
      assert.equal(attached.is_current, true);
      assert.deepEqual(
        await images.complete(actor, business, key, source.version),
        attached,
      );
      assert.equal(
        new URL((await images.current(actor, business, '1')).url).protocol,
        'https:',
      );
      const second = await images.reserve(actor, business, {
        product_id: '1',
        expected_product_version: attached.product_version,
        request_key: randomUUID(),
      });
      await images.upload(actor, business, second.id, file);
      const replacement = await images.complete(
        actor,
        business,
        second.id,
        attached.product_version,
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::text AS n FROM product_images WHERE product_id=1 AND is_current',
          )
        )[0].n,
        '1',
      );
      const removed = await images.remove(
        actor,
        business,
        '1',
        replacement.product_version,
      );
      assert.equal(removed.removed, true);
      assert.deepEqual(
        await images.remove(actor, business, '1', replacement.product_version),
        removed,
      );
      assert.equal(await images.current(actor, business, '1'), null);
      await db.query(
        "UPDATE product_images SET retry_after=clock_timestamp()-interval '1 second' WHERE NOT is_current",
      );
      assert.equal((await images.cleanup()).cleaned, 2);
      assert.equal(objects.size, 0);
      if (!realR2) {
        const [tombstone] = await db.query(
          'SELECT storage_key FROM product_images WHERE id=$1',
          [key],
        );
        objects.set(tombstone.storage_key, Buffer.from('synthetic late PUT'));
        await db.query(
          "UPDATE product_images SET retry_after=clock_timestamp()-interval '1 second' WHERE id=$1",
          [key],
        );
        assert.equal((await images.cleanup()).cleaned, 1);
        assert.equal(objects.size, 0);
      } else assert.equal(pendingCloudKeys.size, 0);
      const [currentProduct] = await db.query(
        'SELECT version FROM products WHERE id=1',
      );
      await db.query('UPDATE user_modules SET is_active=false WHERE user_id=1');
      await assert.rejects(
        () =>
          images.reserve(actor, business, {
            product_id: '1',
            expected_product_version: currentProduct.version,
            request_key: randomUUID(),
          }),
        /module_access_required/,
      );
      await db.query('UPDATE user_modules SET is_active=true WHERE user_id=1');
      assert.equal(puts, 2);
    },
  );
  await verifyNodiaAiPosPorts({ db, business, actor, mutate, read, check });
  await check(
    'completion reads fresh lines after waiting for a concurrent draft update',
    async () => {
      const rows = await db.query(
        `INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,has_stock)
      VALUES($1,$2,'Before wait',0,0,0,100,true),($1,$3,'After wait',0,0,0,100,true) RETURNING id::text`,
        [business, randomUUID(), randomUUID()],
      );
      const sale = await create([item(rows[0].id, 1, '100')]);
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction();
      let completion;
      try {
        const [{ pid }] = await writer.query('SELECT pg_backend_pid() AS pid');
        await writer.query('SELECT id FROM sales WHERE id=$1 FOR UPDATE', [
          sale.id,
        ]);
        await writer.query(
          'UPDATE sale_items SET product_id=$2 WHERE sale_id=$1',
          [sale.id, rows[1].id],
        );
        await writer.query('UPDATE sales SET version=version+1 WHERE id=$1', [
          sale.id,
        ]);
        await writer.query('UPDATE products SET has_stock=false WHERE id=$1', [
          rows[1].id,
        ]);
        completion = transition(
          { ...sale, version: sale.version + 1 },
          'complete',
        ).then(
          (result) => ({ result }),
          (error) => ({ error }),
        );
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const [state] = await db.query(
            'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS waiting',
            [pid],
          );
          if (state.waiting) {
            waiting = true;
            break;
          }
          await delay(25);
        }
        assert.equal(
          waiting,
          true,
          'completion must wait for the aggregate lock',
        );
        await writer.commitTransaction();
        const outcome = await completion;
        assert.match(outcome.error?.message ?? '', /sale_product_unavailable/);
        assert.equal(
          (await read.get(business, sale.id, actor)).status,
          'draft',
        );
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
        if (completion) await completion;
      }
    },
  );
  await check(
    'catalog snapshots ignore availability/alternative but preserve cost-only changes',
    async () => {
      const products = domainContext.get(ProductService);
      const created = await products.createProduct(
        {
          business_id: business,
          code: `catalog-${randomUUID()}`,
          barcode: '000987654321',
          name: 'Synthetic catalog fixture',
          cost_price: 100,
          cost_price_tax: 119,
          profit_percentage: 30,
          sale_price: 500,
          has_stock: true,
        },
        undefined,
        actor,
      );
      let current = await products.updateProduct(
        created.id,
        { sale_price: 600, expected_version: created.version },
        undefined,
        actor,
      );
      current = await products.updateProduct(
        created.id,
        { has_stock: false, expected_version: current.version },
        undefined,
        actor,
      );
      current = await products.updateProduct(
        created.id,
        {
          offer_price: 900,
          is_offer_enabled: true,
          expected_version: current.version,
        },
        undefined,
        actor,
      );
      let observed = await products.findByBarcode(
        business,
        '000987654321',
        actor,
      );
      assert.equal(observed.code, created.code);
      assert.notEqual(observed.code, observed.barcode);
      assert.equal(observed.previous_price_snapshot.sale_price, 500);
      assert.equal(observed.effective_price, '900');
      current = await products.updateProduct(
        created.id,
        { cost_price: 110, has_stock: true, expected_version: current.version },
        undefined,
        actor,
      );
      observed = await products.findByBarcode(business, '000987654321', actor);
      assert.equal(observed.previous_price_snapshot.cost_price, 100);
      assert.equal(observed.previous_price_snapshot.sale_price, 600);
      assert.equal(observed.sale_price, 600);
      assert.equal(observed.offer_price, 900);
      await assert.rejects(
        () =>
          products.updateProduct(
            created.id,
            { barcode: '001234', expected_version: current.version },
            undefined,
            actor,
          ),
        /barcode_conflict/,
      );
      assert.equal(
        (await products.findByBarcode(business, '000987654321', actor)).version,
        current.version,
      );
      await db.query('UPDATE user_modules SET is_active=false WHERE user_id=1');
      await assert.rejects(
        () =>
          products.updateProduct(
            created.id,
            { has_stock: false, expected_version: current.version },
            undefined,
            actor,
          ),
        /module_access_required/,
      );
      await db.query('UPDATE user_modules SET is_active=true WHERE user_id=1');
      assert.equal(
        (await products.findByBarcode(business, '000987654321', actor))
          .has_stock,
        true,
      );
    },
  );
  process.stdout.write(
    JSON.stringify({
      task: 'business-pos-sales',
      checks: checks.length,
      passed: checks,
      storage: realR2
        ? 'real R2: two single-attempt PUTs, readback, attachment, private signing and verified deletion'
        : 'synthetic storage including lost response and late PUT',
      scope:
        'disposable PostgreSQL16, compiled Nest DI, HTTP and backend-owned AI fixtures; no application SQL or provider inference',
    }) + '\n',
  );
} finally {
  if (realStorage && pendingCloudKeys.size) {
    for (const key of pendingCloudKeys) {
      try {
        await realStorage.downloadFile(
          key,
          2 * 1024 * 1024,
          AbortSignal.timeout(15000),
        );
        observedCloudKeys.add(key);
        await realStorage.deleteFile(key);
        try {
          await realStorage.downloadFile(key, 1, AbortSignal.timeout(10000));
        } catch (error) {
          if (
            error?.name === 'NoSuchKey' ||
            error?.name === 'NotFound' ||
            error?.$metadata?.httpStatusCode === 404
          )
            pendingCloudKeys.delete(key);
        }
      } catch {
        /* Do not infer no remote effect from absence or a network error. Preserve recovery DB below. */
      }
    }
  }
  if (app) await app.close();
  if (domainContext) await domainContext.close();
  if (db?.isInitialized) await db.destroy();
  realStorage?.onModuleDestroy();
  if (started && pendingCloudKeys.size === 0)
    docker('rm', '--force', container);
  else if (started) {
    const dir = new URL('../../.tmp/pos-implementation-r01/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      new URL('r2-recovery.json', dir),
      JSON.stringify({
        container,
        pendingKeys: [...pendingCloudKeys],
        reason: 'remote outcome still needs observation; no PUT replay',
      }) + '\n',
    );
    process.stderr.write(
      JSON.stringify({
        recoveryRequired: true,
        container,
        pendingObjects: pendingCloudKeys.size,
      }) + '\n',
    );
  }
}
