// Real NestJS/TypeORM/PostgreSQL and AWS SDK; synthetic S3 over localhost only.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const container = `nodia_invoice_upload_test_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const objects = new Map();
const storageCalls = [];
let rejectPut = false,
  rejectDelete = false,
  lastKey,
  deleteGate,
  onPut,
  releaseDelete;
const storage = createServer(async (req, res) => {
  const key = decodeURIComponent(
    new URL(req.url, 'http://localhost').pathname,
  ).replace(/^\/synthetic-bucket\//, '');
  storageCalls.push({ method: req.method, key });
  lastKey = key;
  if (req.method === 'PUT') {
    const bytes = [];
    for await (const chunk of req) bytes.push(chunk);
    objects.set(key, Buffer.concat(bytes));
    if (onPut) await onPut(key);
    if (rejectPut) {
      // Side effect happened, but the client receives a failed response.
      res.writeHead(503, { 'Content-Type': 'application/xml' });
      return res.end(
        '<Error><Code>ServiceUnavailable</Code><Message>synthetic PUT response lost</Message></Error>',
      );
    }
    res.writeHead(200, { ETag: '"synthetic"' });
    return res.end();
  }
  if (req.method === 'DELETE') {
    if (deleteGate) await deleteGate;
    if (rejectDelete) {
      res.writeHead(503, { 'Content-Type': 'application/xml' });
      return res.end(
        '<Error><Code>ServiceUnavailable</Code><Message>synthetic DELETE unavailable</Message></Error>',
      );
    }
    objects.delete(key);
    res.writeHead(204);
    return res.end();
  }
  res.writeHead(405);
  res.end();
});

let db,
  app,
  started = false,
  checks = 0;
const businessId = 'b7b80a11-827c-4712-9c17-9150d0325d7b';
try {
  await new Promise((resolve) => storage.listen(0, '127.0.0.1', resolve));
  // Set synthetic credentials before importing config through compiled modules.
  Object.assign(process.env, {
    R2_ENDPOINT: `http://127.0.0.1:${storage.address().port}`,
    R2_ACCOUNT_ID: 'synthetic',
    R2_ACCESS_KEY_ID: 'synthetic',
    R2_SECRET_ACCESS_KEY: 'synthetic',
    R2_BUCKET_NAME: 'synthetic-bucket',
  });
  const [
    controllerModule,
    createModule,
    recoveryModule,
    workerModule,
    serviceModule,
    storageModule,
    entityModule,
    journalModule,
    migrationModule,
  ] = await Promise.all([
    import('../dist/invoice/invoice.controller.js'),
    import('../dist/invoice/use-case/create-invoice.use-case.js'),
    import('../dist/invoice/use-case/recover-invoice-uploads.use-case.js'),
    import('../dist/invoice/invoice-upload-recovery.worker.js'),
    import('../dist/invoice/invoice.service.js'),
    import('../dist/common/storage/storage.service.js'),
    import('../dist/invoice/entities/invoice.entity.js'),
    import('../dist/invoice/entities/invoice-upload.entity.js'),
    import('../dist/migrations/1791630000000-CreateInvoiceUploads.js'),
  ]);
  const { InvoiceController } = controllerModule;
  const { CreateInvoiceUseCase } = createModule;
  const { RecoverInvoiceUploadsUseCase } = recoveryModule;
  const { InvoiceUploadRecoveryWorker } = workerModule;
  const { InvoiceService } = serviceModule;
  const { StorageService } = storageModule;
  const { Invoice } = entityModule;
  const { InvoiceUpload } = journalModule;
  const { CreateInvoiceUploads1791630000000: Migration } = migrationModule;

  docker(
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    'POSTGRES_DB=invoice_test',
    '--env',
    'POSTGRES_USER=invoice_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
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
        'invoice_test',
      );
      break;
    } catch (error) {
      if (attempt === 39) throw error;
      await delay(250);
    }
  }
  const options = {
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'invoice_test',
    password,
    database: 'invoice_test',
    synchronize: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
    migrations: [Migration],
  };
  db = await new DataSource(options).initialize();
  await db.query(`
    CREATE TABLE businesses(id uuid PRIMARY KEY);
    CREATE TABLE providers(id bigint PRIMARY KEY);
    CREATE TABLE invoices(
      id bigserial PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id),
      provider_id bigint REFERENCES providers(id), code varchar(255) NOT NULL,
      total_amount integer NOT NULL DEFAULT 0, path_storage varchar(255) NOT NULL DEFAULT '',
      data jsonb NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.query('INSERT INTO businesses(id) VALUES($1)', [businessId]);
  await db.runMigrations();
  const unused = Reflect.getMetadata('design:paramtypes', InvoiceController)
    .filter((token) => token !== CreateInvoiceUseCase)
    .map((provide) => ({
      provide,
      useValue: {
        execute() {
          throw new Error('Unexpected endpoint');
        },
      },
    }));
  class InvoiceUploadTestModule {}
  Module({
    imports: [
      TypeOrmModule.forRoot(options),
      TypeOrmModule.forFeature([Invoice, InvoiceUpload]),
    ],
    controllers: [InvoiceController],
    providers: [
      ...unused,
      InvoiceService,
      StorageService,
      CreateInvoiceUseCase,
      RecoverInvoiceUploadsUseCase,
      InvoiceUploadRecoveryWorker,
    ],
  })(InvoiceUploadTestModule);
  app = await NestFactory.create(InvoiceUploadTestModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const recovery = app.get(RecoverInvoiceUploadsUseCase);
  const caseCreate = app.get(CreateInvoiceUseCase);
  const send = (
    overrides = {},
    file = new Blob(['%PDF-1.4 synthetic'], { type: 'application/pdf' }),
    resource = 'invoices',
  ) => {
    const body = new FormData();
    for (const [key, value] of Object.entries({
      business_id: businessId,
      code: 'SYNTHETIC',
      total_amount: '0',
      ...overrides,
    }))
      body.append(key, value);
    if (file) body.append('file', file, 'synthetic.pdf');
    return fetch(`${base}/${resource}`, { method: 'POST', body });
  };
  const countInvoices = async () =>
    Number((await db.query('SELECT count(*) AS total FROM invoices'))[0].total);
  const expire = (key) =>
    db.query(
      "UPDATE invoice_uploads SET cleanup_after = now() - INTERVAL '1 second', retry_after = now() - INTERVAL '1 second' WHERE storage_key = $1",
      [key],
    );
  const seedIntent = async (key, expired = true) => {
    await db.query(
      `INSERT INTO invoice_uploads(storage_key, cleanup_after, retry_after)
      VALUES ($1, now() + INTERVAL '${expired ? '-1 second' : '10 minutes'}', now() + INTERVAL '${expired ? '-1 second' : '10 minutes'}')`,
      [key],
    );
    objects.set(key, Buffer.from('synthetic'));
  };

  for (const resource of ['invoices', 'invoice']) {
    const response = await send({}, undefined, resource);
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(objects.has(saved.path_storage), true);
    assert.equal(
      (
        await db.query('SELECT * FROM invoice_uploads WHERE storage_key = $1', [
          saved.path_storage,
        ])
      ).length,
      0,
    );
    checks++;
  }
  const beforeNoFile = storageCalls.length;
  assert.equal((await send({}, null)).status, 201);
  assert.equal(storageCalls.length, beforeNoFile);
  checks++;
  const beforeInvalid = storageCalls.length;
  assert.equal(
    (await send({}, new Blob(['not a PDF'], { type: 'application/pdf' })))
      .status,
    400,
  );
  assert.equal(storageCalls.length, beforeInvalid);
  checks++;

  const committedCount = await countInvoices();
  const committedObjects = objects.size;
  assert.equal((await send({ business_id: randomUUID() })).status, 400);
  assert.equal(await countInvoices(), committedCount);
  assert.equal(
    objects.size,
    committedObjects,
    JSON.stringify({
      lastKey,
      calls: storageCalls,
      journal: await db.query('SELECT * FROM invoice_uploads'),
    }),
  );
  assert.equal(
    (
      await db.query(
        'SELECT cleanup_started FROM invoice_uploads WHERE storage_key = $1',
        [lastKey],
      )
    )[0].cleanup_started,
    true,
  );
  checks++;

  rejectPut = true;
  assert.equal((await send()).status, 500);
  rejectPut = false;
  assert.equal(await countInvoices(), committedCount);
  assert.equal(objects.size, committedObjects);
  const uncertainKey = lastKey;
  // Simulate a remote PUT completing after the failed caller's first DELETE.
  objects.set(uncertainKey, Buffer.from('late PUT'));
  await expire(uncertainKey);
  assert.equal((await recovery.execute(uncertainKey)).cleaned, 1);
  assert.equal(objects.has(uncertainKey), false);
  checks++;

  rejectDelete = true;
  assert.equal((await send({ business_id: randomUUID() })).status, 400);
  assert.equal(await countInvoices(), committedCount);
  const deferredKey = lastKey;
  assert.equal(objects.has(deferredKey), true);
  assert.equal(
    (
      await db.query(
        'SELECT cleanup_started FROM invoice_uploads WHERE storage_key = $1',
        [deferredKey],
      )
    )[0].cleanup_started,
    true,
  );
  rejectDelete = false;
  await expire(deferredKey);
  // Fresh instance proves no process-local cleanup queue is needed.
  const restartedRecovery = new RecoverInvoiceUploadsUseCase(
    db,
    app.get(StorageService),
  );
  assert.equal((await restartedRecovery.execute(deferredKey)).cleaned, 1);
  assert.equal(objects.has(deferredKey), false);
  checks++;

  // Fail the second write after INSERT, proving both SQL writes roll back.
  await db.query(`CREATE FUNCTION reject_journal_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF EXISTS(SELECT 1 FROM invoices WHERE path_storage = OLD.storage_key) THEN
      RAISE EXCEPTION 'synthetic journal deletion failure'; END IF; RETURN OLD; END $$;
    CREATE TRIGGER reject_journal_delete BEFORE DELETE ON invoice_uploads FOR EACH ROW EXECUTE FUNCTION reject_journal_delete()`);
  assert.equal((await send()).status, 500);
  assert.equal(await countInvoices(), committedCount);
  assert.equal(objects.size, committedObjects);
  await db.query(
    'DROP TRIGGER reject_journal_delete ON invoice_uploads; DROP FUNCTION reject_journal_delete()',
  );
  checks++;

  // Crash between upload and confirmation: expire the durable intent.
  const crashedKey = `invoices/${businessId}/${randomUUID()}.pdf`;
  await seedIntent(crashedKey);
  assert.equal((await restartedRecovery.execute(crashedKey)).cleaned, 1);
  assert.equal(objects.has(crashedKey), false);
  checks++;
  // Pending uploads are not eligible for background cleanup.
  const activeKey = `invoices/${businessId}/${randomUUID()}.pdf`;
  await seedIntent(activeKey, false);
  await recovery.execute();
  assert.equal(objects.has(activeKey), true);
  checks++;

  // While confirmation owns the journal row, even forced cleanup skips it.
  const locked = db.createQueryRunner();
  await locked.connect();
  await locked.startTransaction();
  try {
    await locked.query(
      'SELECT storage_key FROM invoice_uploads WHERE storage_key = $1 FOR UPDATE',
      [activeKey],
    );
    assert.deepEqual(await restartedRecovery.execute(activeKey), {
      cleaned: 0,
      retained: 0,
      deferred: 0,
    });
    assert.equal(objects.has(activeKey), true);
  } finally {
    await locked.rollbackTransaction();
    await locked.release();
  }
  checks++;

  // If cleanup won before confirmation, no invoice may reference that object.
  onPut = async (key) => {
    await expire(key);
    await recovery.execute(key);
  };
  assert.equal((await send()).status, 409);
  onPut = null;
  assert.equal(await countInvoices(), committedCount);
  assert.equal(objects.has(lastKey), false);
  checks++;

  // Serializes cleanup/confirmation: two replicas must not delete in parallel.
  const concurrentKey = `invoices/${businessId}/${randomUUID()}.pdf`;
  await seedIntent(concurrentKey);
  deleteGate = new Promise((resolve) => {
    releaseDelete = resolve;
  });
  const cleanup = recovery.execute(concurrentKey);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      storageCalls.some(
        (call) => call.method === 'DELETE' && call.key === concurrentKey,
      )
    )
      break;
    await delay(10);
  }
  assert.deepEqual(await restartedRecovery.execute(concurrentKey), {
    cleaned: 0,
    retained: 0,
    deferred: 0,
  });
  releaseDelete();
  deleteGate = null;
  await cleanup;
  assert.equal(
    storageCalls.filter(
      (call) => call.method === 'DELETE' && call.key === concurrentKey,
    ).length,
    1,
  );
  checks++;

  // A leftover journal for an attached object cannot cause data loss.
  const attached = (
    await db.query(
      "SELECT path_storage FROM invoices WHERE path_storage <> '' LIMIT 1",
    )
  )[0].path_storage;
  await seedIntent(attached);
  assert.equal((await recovery.execute(attached)).retained, 1);
  assert.equal(objects.has(attached), true);
  checks++;

  // A failed registration prevents even attempting the PUT.
  await db.query(
    'ALTER TABLE invoice_uploads RENAME TO invoice_uploads_unavailable',
  );
  const beforeRegistrationFailure = storageCalls.length;
  assert.equal((await send()).status, 500);
  assert.equal(storageCalls.length, beforeRegistrationFailure);
  await db.query(
    'ALTER TABLE invoice_uploads_unavailable RENAME TO invoice_uploads',
  );
  checks++;

  // Lost COMMIT acknowledgement: real transaction commits, recovery returns its result.
  const appDb = app.get(DataSource);
  const originalTransaction = appDb.transaction.bind(appDb);
  appDb.transaction = async (...args) => {
    await originalTransaction(...args);
    throw new Error('synthetic lost COMMIT response');
  };
  const response = await send();
  appDb.transaction = originalTransaction;
  assert.equal(response.status, 201);
  assert.equal(objects.has((await response.json()).path_storage), true);
  assert.equal(await countInvoices(), committedCount + 1);
  checks++;

  // Migration reversal cannot silently discard a durable recovery intent.
  await assert.rejects(
    db.undoLastMigration(),
    /Recover pending invoice uploads/,
  );
  checks++;
  for (const { storage_key: key } of await db.query(
    'SELECT storage_key FROM invoice_uploads',
  )) {
    await expire(key);
    await recovery.execute(key);
  }
  assert.equal((await db.query('SELECT * FROM invoice_uploads')).length, 0);
  await db.undoLastMigration();
  assert.equal(
    (await db.query("SELECT to_regclass('invoice_uploads') AS name"))[0].name,
    null,
  );
  await db.runMigrations();
  assert.ok(caseCreate instanceof CreateInvoiceUseCase);
  checks++;
  console.log(
    JSON.stringify({
      checks,
      sql: 'disposable PostgreSQL 16',
      storage: 'AWS SDK against synthetic localhost S3',
      realR2: false,
    }),
  );
} finally {
  releaseDelete?.();
  deleteGate = null;
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  await new Promise((resolve) => storage.close(resolve));
  if (started) docker('stop', container);
}
