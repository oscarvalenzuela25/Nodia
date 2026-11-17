// Run after build. CASH04_TEST_PORT selects an empty, marked loopback PG16 database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { StorageModule } from '../dist/common/storage/storage.module.js';
import { StorageService } from '../dist/common/storage/storage.service.js';
import { InvoiceCashUploadService } from '../dist/invoice/invoice-cash-upload.js';
import { InvoiceController } from '../dist/invoice/invoice.controller.js';
import { InvoicePersistenceModule } from '../dist/invoice/invoice-persistence.module.js';
import { CreateInvoiceUseCase } from '../dist/invoice/use-case/create-invoice.use-case.js';
import { GetAllInvoicesUseCase } from '../dist/invoice/use-case/get-all-invoices.use-case.js';
import { GetInvoiceByIdUseCase } from '../dist/invoice/use-case/get-invoice-by-id.use-case.js';
import { SaveCashInvoiceUseCase } from '../dist/invoice/use-case/save-cash-invoice.use-case.js';
import { UpdateInvoiceUseCase } from '../dist/invoice/use-case/update-invoice.use-case.js';
import { CreateInvoiceUploads1791630000000 } from '../dist/migrations/1791630000000-CreateInvoiceUploads.js';
import { CreateBusinessCashCategories1793690000000 } from '../dist/migrations/1793690000000-CreateBusinessCashCategories.js';
import { CreateBusinessCashMovements1793700000000 } from '../dist/migrations/1793700000000-CreateBusinessCashMovements.js';
import { LinkBusinessCashInvoiceExpenses1793710000000 } from '../dist/migrations/1793710000000-LinkBusinessCashInvoiceExpenses.js';
import { LinkInvoiceUploadsToCashAttempts1793720000000 } from '../dist/migrations/1793720000000-LinkInvoiceUploadsToCashAttempts.js';
import { ProductModule } from '../dist/product/product.module.js';
import { withBusinessCashHttpLab } from './fixtures/business-cash-http.fixture.mjs';

const business = randomUUID();
const otherBusiness = randomUUID();
const movements = '/business-cash-movements';
const ocr = '/invoices/ocr-confirmations';
const notFound = 'business:resource_not_found';
const reviewRequired = 'business:cash_invoice_review_required';
const transferNotAllowed = 'business:cash_invoice_transfer_not_allowed';
const testFile = '%PDF-1.7\nsynthetic cash integration\n%%EOF';
const month = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'America/Santiago',
})
  .format(new Date())
  .slice(0, 7);
const issueDate = month + '-01';
const updatedIssueDate = month + '-02';

function response(result, status, message) {
  assert.equal(result.status, status, JSON.stringify(result.body));
  if (message) assert.equal(result.body.message, message);
  return result.body;
}

function receipt(key) {
  return '/businesses/' + business + '/cash-mutation-requests/' + key;
}

function search(value) {
  return (
    movements +
    '?' +
    new URLSearchParams({
      'q[business_id_eq]': business,
      ...(value === undefined ? {} : { 'q[search]': value }),
    })
  );
}

function multipart(command, bytes = testFile, mimetype = 'application/pdf') {
  const body = new FormData();
  body.append(
    'command',
    typeof command === 'string' ? command : JSON.stringify(command),
  );
  body.append(
    'file',
    new Blob([bytes], { type: mimetype }),
    'ignored-filename.pdf',
  );
  return body;
}

function providerBody(overrides = {}) {
  return {
    business_id: business,
    request_key: randomUUID(),
    code: 'FOLIO-%_!',
    total_amount: 2500,
    data: { issue_date: issueDate, preserved: true },
    ...overrides,
  };
}

async function setup(source) {
  await source.query(`
    ALTER TABLE businesses ADD COLUMN sales_timezone varchar(64) NOT NULL DEFAULT 'America/Santiago';
    CREATE TABLE providers(
      id bigserial PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id),
      name varchar(255) NOT NULL, tax int NOT NULL DEFAULT 19, fields jsonb NOT NULL DEFAULT '{}',
      use_ocr boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE invoices(
      id bigserial PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id),
      provider_id bigint REFERENCES providers(id), code varchar(255),
      total_amount integer NOT NULL DEFAULT 0, path_storage varchar(255) NOT NULL DEFAULT '',
      data jsonb NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE products(
      id bigserial PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id),
      provider_id bigint REFERENCES providers(id), code varchar(255), barcode varchar(255),
      name varchar(255) NOT NULL, alias varchar(255), measurement_unit varchar(16) NOT NULL DEFAULT 'unit',
      cost_price integer NOT NULL, cost_price_tax integer NOT NULL, sale_price integer NOT NULL,
      offer_price integer, is_offer_enabled boolean NOT NULL DEFAULT false, has_stock boolean,
      version integer NOT NULL DEFAULT 1, stock integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT uq_business_product_code UNIQUE(business_id, code)
    );
    CREATE TABLE product_logs(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id bigint NOT NULL REFERENCES products(id),
      code varchar(255), barcode varchar(255), name varchar(255) NOT NULL, alias varchar(255),
      measurement_unit varchar(16) NOT NULL DEFAULT 'unit', cost_price integer NOT NULL,
      cost_price_tax integer NOT NULL, sale_price integer NOT NULL, offer_price integer,
      is_offer_enabled boolean, has_stock boolean, product_version integer, stock integer NOT NULL DEFAULT 0,
      event_type varchar(40) NOT NULL DEFAULT 'legacy', source varchar(40) NOT NULL DEFAULT 'legacy',
      actor_id bigint, changed_fields jsonb NOT NULL DEFAULT '[]', image_id uuid,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  const [legacy] = await source.query(
    "INSERT INTO invoices(business_id,code) VALUES($1,'pre-migration') RETURNING id",
    [business],
  );
  assert.equal((await source.runMigrations()).length, 5);
  const [migrated] = await source.query(
    'SELECT version,code FROM invoices WHERE id=$1',
    [legacy.id],
  );
  assert.deepEqual(migrated, { version: 1, code: 'pre-migration' });
  assert.deepEqual(
    await source.query('SELECT id FROM business_cash_movements'),
    [],
  );
  return legacy.id;
}

function storageRecorder() {
  const fetched = [];
  const objects = new Map();
  const storage = {
    beforePut: undefined,
    async uploadFileOnce(key, bytes, mimetype) {
      fetched.push({ key, mimetype });
      objects.set(key, Buffer.from(bytes));
      await storage.beforePut?.(key);
    },
    async uploadFile(key, bytes, mimetype) {
      return storage.uploadFileOnce(key, bytes, mimetype);
    },
    async deleteFile(key) {
      objects.delete(key);
    },
  };
  return { fetched, objects, storage };
}

function httpOptions(storage) {
  const active = [
    GetAllInvoicesUseCase,
    GetInvoiceByIdUseCase,
    CreateInvoiceUseCase,
    UpdateInvoiceUseCase,
    SaveCashInvoiceUseCase,
  ];
  const unused = Reflect.getMetadata('design:paramtypes', InvoiceController)
    .filter((token) => !active.includes(token))
    .map((provide) => ({
      provide,
      useValue: {
        execute() {
          throw new Error('Unexpected fixture endpoint');
        },
      },
    }));
  return {
    imports: [InvoicePersistenceModule, ProductModule, StorageModule],
    controllers: [InvoiceController],
    providers: [
      GetAllInvoicesUseCase,
      GetInvoiceByIdUseCase,
      SaveCashInvoiceUseCase,
      InvoiceCashUploadService,
      ...unused,
    ],
    overrides: [[StorageService, storage]],
  };
}

async function category(send, name, businessId = business, actor = '1') {
  return response(
    await send('POST', '/business-cash-categories', actor, {
      business_id: businessId,
      request_key: randomUUID(),
      name,
      description: name,
    }),
    201,
  ).result.category;
}

async function manualInvoices(
  source,
  send,
  legacyId,
  cash,
  replacement,
  alien,
) {
  response(await send('GET', '/invoices/' + legacyId, '2'), 404);
  response(await send('GET', '/invoices/' + legacyId, '4'), 403);
  const former = response(
    await send('PUT', '/invoice/' + legacyId, '1', { code: 'Legacy metadata' }),
    200,
  );
  assert.equal(former.version, undefined);
  assert.equal(
    response(await send('GET', '/invoices/' + legacyId), 200).version,
    2,
  );
  response(
    await send('POST', '/invoices', '1', {
      business_id: business,
      cash_category_id: cash.id,
    }),
    400,
  );
  response(
    await send('PUT', '/invoices/' + legacyId, '1', {
      request_key: randomUUID(),
    }),
    400,
  );

  const alienIntent = providerBody({ cash_category_id: alien.id });
  response(await send('POST', '/invoices', '1', alienIntent), 404, notFound);
  assert.equal(
    response(await send('GET', receipt(alienIntent.request_key)), 200).status,
    'rejected',
  );
  assert.equal(
    response(
      await send(
        'POST',
        '/invoices',
        '1',
        providerBody({
          cash_category_id: cash.id,
          total_amount: 0,
        }),
      ),
      400,
    ).message,
    'business:cash_invoice_invalid_amount',
  );
  const { request_key: requestKey, ...fields } = providerBody({
    cash_category_id: cash.id,
  });
  const intent = { ...fields, request_key: requestKey };
  const created = response(await send('POST', '/invoices', '1', intent), 201);
  assert.equal(created.operation, 'invoice_create');
  assert.equal(created.status, 'committed');
  const { invoice_id: invoiceId, cash_movement_id: movementId } =
    created.result;
  assert.ok(movementId);
  assert.deepEqual(
    response(await send('POST', '/invoice', '1', intent), 201),
    created,
  );
  response(
    await send('POST', '/invoices', '1', { ...intent, total_amount: 2501 }),
    409,
    'business:cash_request_key_conflict',
  );
  assert.equal(
    response(await send('GET', receipt(requestKey), '3'), 200).status,
    'unconfirmed',
  );
  const ownReceipt = await send('GET', receipt(requestKey));
  assert.equal(ownReceipt.headers.get('cache-control'), 'no-store');
  assert.deepEqual(response(ownReceipt, 200), created);
  const path = '/invoices/' + invoiceId;
  const expensePath = movements + '/' + movementId;
  const shown = response(await send('GET', path), 200);
  assert.equal(shown.version, 1);
  assert.deepEqual(shown.cash_expense, {
    movement_id: movementId,
    category: { id: cash.id, name: cash.name, is_active: true },
  });
  assert.ok(
    response(await send('GET', '/invoices?includes=false'), 200).data.some(
      ({ id, cash_expense }) =>
        id === invoiceId && cash_expense?.movement_id === movementId,
    ),
  );
  const expense = response(await send('GET', expensePath), 200);
  assert.equal(expense.source, 'invoice');
  assert.equal(expense.amount, '2500');
  assert.equal(expense.occurred_on, issueDate);
  assert.equal(expense.description, null);
  assert.deepEqual(expense.invoice, { id: invoiceId, code: fields.code });
  assert.equal(
    response(await send('GET', search('%_!')), 200).data[0].id,
    movementId,
  );
  assert.equal(
    response(await send('GET', search(invoiceId)), 200).summary.expense
      .total_amount,
    '2500',
  );
  response(
    await send('PUT', expensePath, '1', {
      request_key: randomUUID(),
      expected_version: 1,
      amount: '6000',
    }),
    400,
    'business:cash_invalid_command',
  );
  response(
    await send('PUT', expensePath, '1', {
      request_key: randomUUID(),
      expected_version: 1,
      is_active: false,
    }),
    200,
  );
  assert.equal(response(await send('GET', path), 200).version, 1);
  response(
    await send('PUT', path, '1', {
      is_active: false,
      code: 'FOLIO renombrado',
    }),
    200,
  );
  response(
    await send('PUT', path, '1', { total_amount: 2000 }),
    409,
    reviewRequired,
  );
  response(
    await send('PUT', path, '1', { data: { missing_issue_date: true } }),
    409,
    reviewRequired,
  );
  assert.equal(
    response(await send('GET', search('FOLIO renombrado')), 200).data[0].id,
    movementId,
  );
  const linked = response(await send('GET', path), 200);
  assert.equal(linked.version, 2);
  assert.deepEqual(linked.data, fields.data);
  assert.equal(linked.total_amount, 2500);
  response(
    await send('PUT', '/business-cash-categories/' + cash.id, '1', {
      request_key: randomUUID(),
      expected_version: cash.version,
      is_active: false,
    }),
    200,
  );
  const edit = {
    request_key: randomUUID(),
    expected_version: 2,
    total_amount: 3200,
    data: { issue_date: updatedIssueDate },
  };
  const edited = response(await send('PUT', path, '1', edit), 200);
  assert.deepEqual(edited.result, {
    invoice_id: invoiceId,
    invoice_version: 3,
    cash_movement_id: movementId,
  });
  assert.deepEqual(response(await send('PUT', path, '1', edit), 200), edited);
  response(
    await send('PUT', path, '1', { ...edit, request_key: randomUUID() }),
    409,
    'business:cash_version_conflict',
  );
  const synchronized = response(await send('GET', expensePath), 200);
  assert.equal(synchronized.amount, '3200');
  assert.equal(synchronized.occurred_on, updatedIssueDate);
  assert.equal(synchronized.is_active, false);
  assert.equal(synchronized.category.is_active, false);
  const withdrawal = response(
    await send('PUT', path, '1', {
      request_key: randomUUID(),
      expected_version: 3,
      total_amount: 0,
      cash_category_id: null,
    }),
    200,
  );
  assert.equal(withdrawal.result.cash_movement_id, null);
  assert.equal(response(await send('GET', path), 200).cash_expense, null);
  response(await send('GET', expensePath), 404, notFound);
  assert.equal(
    response(await send('GET', search()), 200).summary.expense.total_amount,
    '0',
  );
  response(
    await send('PUT', path, '3', { business_id: otherBusiness }),
    409,
    transferNotAllowed,
  );
  response(
    await send('PUT', path, '3', {
      request_key: randomUUID(),
      expected_version: 4,
      business_id: otherBusiness,
    }),
    409,
    transferNotAllowed,
  );
  const restore = {
    request_key: randomUUID(),
    expected_version: 4,
    total_amount: 4100,
    cash_category_id: cash.id,
  };
  response(
    await send('PUT', path, '1', restore),
    409,
    'business:cash_category_inactive',
  );
  const restored = response(
    await send('PUT', path, '1', {
      ...restore,
      request_key: randomUUID(),
      cash_category_id: replacement.id,
    }),
    200,
  );
  assert.deepEqual(restored.result, {
    invoice_id: invoiceId,
    invoice_version: 5,
    cash_movement_id: movementId,
  });
  const current = response(await send('GET', expensePath), 200);
  assert.equal(current.is_active, true);
  assert.equal(current.category.id, replacement.id);
  const [movementRow] = await source.query(
    'SELECT count(*)::int AS count FROM business_cash_movements WHERE invoice_id=$1',
    [invoiceId],
  );
  assert.equal(movementRow.count, 1);
  const events = await source.query(
    'SELECT operation FROM business_cash_movement_audit WHERE movement_id=$1 ORDER BY version',
    [movementId],
  );
  assert.deepEqual(
    events.map(({ operation }) => operation),
    [
      'invoice_create',
      'movement_update',
      'invoice_update',
      'invoice_withdraw',
      'invoice_restore',
    ],
  );
  const monthly = response(
    await send('GET', movements + '/monthly-summary?business_id=' + business),
    200,
  );
  assert.equal(monthly.summary.expense.total_amount, '4100');
  const edits = [4200, 4300].map((total_amount) => ({
    request_key: randomUUID(),
    expected_version: 5,
    total_amount,
  }));
  const competing = await Promise.all(
    edits.map((body) => send('PUT', path, '1', body)),
  );
  assert.deepEqual(competing.map(({ status }) => status).sort(), [200, 409]);
  const winner = competing.findIndex(({ status }) => status === 200);
  assert.equal(response(competing[winner], 200).result.invoice_version, 6);
  assert.equal(
    response(await send('GET', expensePath), 200).amount,
    String(edits[winner].total_amount),
  );
  const [last] = await source.query(
    'SELECT count(*)::int AS count FROM business_cash_movements WHERE invoice_id=$1',
    [invoiceId],
  );
  assert.equal(last.count, 1);
}

async function manualUpload(source, send, recorder) {
  const requestKey = randomUUID();
  const prepare = () => {
    const body = new FormData();
    body.append('business_id', business);
    body.append('request_key', requestKey);
    body.append('cash_category_id', 'null');
    body.append('total_amount', '0');
    body.append(
      'file',
      new Blob([testFile], { type: 'application/pdf' }),
      'ignored.pdf',
    );
    return body;
  };
  const beforePuts = recorder.fetched.length;
  const created = response(
    await send('POST', '/invoices', '1', prepare()),
    201,
  );
  assert.equal(created.result.cash_movement_id, null);
  assert.deepEqual(
    response(await send('POST', '/invoice', '1', prepare()), 201),
    created,
  );
  assert.equal(recorder.fetched.length, beforePuts + 1);
  const [saved] = await source.query(
    'SELECT path_storage,total_amount FROM invoices WHERE id=$1',
    [created.result.invoice_id],
  );
  assert.equal(saved.total_amount, 0);
  assert.equal(saved.path_storage, recorder.fetched.at(-1).key);
  assert.deepEqual(
    await source.query(
      'SELECT storage_key FROM invoice_uploads WHERE storage_key=$1',
      [saved.path_storage],
    ),
    [],
  );
}

function productInput(kind, label, target = {}) {
  const line = {
    invoice_code: 'SUP-' + label,
    name: 'Reviewed ' + label,
    alias: 'Alias ' + label,
    alias_reviewed: true,
    cost_price: 300,
    quantity: 1.25,
  };
  const product = {
    code: 'CAT-' + label,
    name: line.name,
    alias: line.alias,
    cost_price: 300,
    cost_price_tax: 357,
    sale_price: 685,
    is_active: true,
  };
  return {
    kind,
    line,
    ...(kind === 'manual_match'
      ? { changes: { sale_price: 684 } }
      : { product }),
    ...target,
  };
}

async function ocrRows(source, send, recorder, cash) {
  const providers = await source.query(
    "INSERT INTO providers(business_id,name) VALUES ($1,'Original'),($1,'Reviewed') RETURNING id",
    [business],
  );
  const products = await source.query(
    `
    INSERT INTO products(business_id,provider_id,code,name,alias,cost_price,cost_price_tax,sale_price,stock,has_stock,is_active)
    VALUES($1,$2,'target-automatic','Auto','History',100,119,160,7,true,true),
          ($1,$2,'target-manual','Manual','Human',102,121,170,8,NULL,false)
    RETURNING id
  `,
    [business, providers[0].id],
  );
  const command = {
    request_key: randomUUID(),
    business_id: business,
    invoice: {
      provider_id: providers[1].id,
      code: 'OCR-1',
      total_amount: 8000,
      issue_date: issueDate,
      cash_category_id: cash.id,
    },
    items: [
      productInput('manual_match', 'manual', {
        product_id: products[1].id,
        expected_version: 1,
      }),
      productInput('create', 'new'),
      productInput('update', 'auto', {
        product_id: products[0].id,
        expected_version: 1,
      }),
    ],
  };
  response(await send('POST', ocr, '2', multipart(command)), 404, notFound);
  const beforePuts = recorder.fetched.length;
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  recorder.storage.beforePut = async (key) => {
    entered.resolve(key);
    await release.promise;
  };
  const first = send('POST', ocr, '1', multipart(command));
  try {
    const storageKey = await Promise.race([
      entered.promise,
      first.then((result) => {
        throw new Error(
          'Expected staged PUT, received ' +
            result.status +
            ' ' +
            JSON.stringify(result.body),
        );
      }),
    ]);
    const [pending] = await source.query(
      'SELECT cash_attempt_id, uploaded_at, cleanup_started FROM invoice_uploads WHERE storage_key=$1',
      [storageKey],
    );
    assert.ok(pending.cash_attempt_id);
    assert.equal(pending.uploaded_at, null);
    assert.equal(pending.cleanup_started, false);
    const concurrent = response(
      await send('POST', '/invoice/ocr-confirmations', '1', multipart(command)),
      202,
    );
    assert.deepEqual(concurrent, {
      request_key: command.request_key,
      operation: 'invoice_ocr_confirm',
      status: 'processing',
    });
    assert.equal(
      response(await send('GET', receipt(command.request_key)), 200).status,
      'processing',
    );
  } finally {
    recorder.storage.beforePut = undefined;
    release.resolve();
  }
  const committed = response(await first, 201);
  assert.equal(recorder.fetched.length, beforePuts + 1);
  assert.equal(committed.operation, 'invoice_ocr_confirm');
  const {
    invoice_id: invoiceId,
    cash_movement_id: movementId,
    products: saved,
  } = committed.result;
  assert.deepEqual(
    saved.map(({ version }) => version),
    [2, 1, 2],
  );
  assert.deepEqual(
    [saved[0].id, saved[2].id],
    [products[1].id, products[0].id],
  );
  assert.deepEqual(
    response(
      await send('POST', '/invoice/ocr-confirmations', '1', multipart(command)),
      201,
    ),
    committed,
  );
  response(
    await send(
      'POST',
      ocr,
      '1',
      multipart(command, testFile + 'different bytes'),
    ),
    409,
    'business:cash_request_key_conflict',
  );
  assert.equal(recorder.fetched.length, beforePuts + 1);
  assert.equal(
    response(await send('GET', movements + '/' + movementId), 200).amount,
    '8000',
  );
  const invoice = response(await send('GET', '/invoices/' + invoiceId), 200);
  assert.equal(invoice.data.items_count, 3);
  assert.equal(invoice.data.extracted_items[0].quantity, 1.25);
  assert.equal(
    invoice.data.extracted_items[0].matched_product_id,
    products[1].id,
  );
  assert.deepEqual(invoice.data.extracted_items[0].selected_update_fields, [
    'sale_price',
  ]);
  assert.equal(invoice.data.extracted_items[2].code, 'SUP-auto');
  assert.equal(invoice.path_storage, recorder.fetched.at(-1).key);
  assert.deepEqual(
    await source.query(
      'SELECT storage_key FROM invoice_uploads WHERE storage_key=$1',
      [invoice.path_storage],
    ),
    [],
  );
  const [manual] = await source.query(
    'SELECT provider_id, name, alias, has_stock, stock, is_active, sale_price FROM products WHERE id=$1',
    [saved[0].id],
  );
  assert.deepEqual(manual, {
    provider_id: providers[0].id,
    name: 'Manual',
    alias: 'Human',
    has_stock: null,
    stock: 8,
    is_active: false,
    sale_price: 680,
  });
  const [created] = await source.query(
    'SELECT provider_id, has_stock, stock, sale_price FROM products WHERE id=$1',
    [saved[1].id],
  );
  assert.deepEqual(created, {
    provider_id: providers[1].id,
    has_stock: true,
    stock: 0,
    sale_price: 690,
  });
  const [updated] = await source.query(
    'SELECT provider_id, has_stock, stock, sale_price FROM products WHERE id=$1',
    [saved[2].id],
  );
  assert.deepEqual(updated, {
    provider_id: providers[1].id,
    has_stock: true,
    stock: 7,
    sale_price: 690,
  });
  const logs = await source.query(
    'SELECT product_id, source, product_version, actor_id FROM product_logs WHERE product_id=ANY($1::bigint[])',
    [saved.map(({ id }) => id)],
  );
  assert.deepEqual(
    new Set(
      logs.map(
        ({ product_id, source, product_version, actor_id }) =>
          `${product_id}:${source}:${product_version}:${actor_id}`,
      ),
    ),
    new Set([
      `${saved[0].id}:update:2:1`,
      `${saved[1].id}:create:1:1`,
      `${saved[2].id}:update:2:1`,
    ]),
  );
  return command;
}

async function invalidMultipart(send, recorder, command) {
  const beforePuts = recorder.fetched.length;
  const extra = multipart(command);
  extra.append('unexpected', 'field');
  response(await send('POST', ocr, '1', extra), 400);
  const duplicate = multipart(command);
  duplicate.append('command', JSON.stringify(command));
  response(await send('POST', ocr, '1', duplicate), 400);
  const duplicateFile = multipart(command);
  duplicateFile.append(
    'file',
    new Blob([testFile], { type: 'application/pdf' }),
    'duplicate.pdf',
  );
  response(await send('POST', ocr, '1', duplicateFile), 400);
  response(
    await send('POST', ocr, '1', multipart(command, testFile, 'image/png')),
    400,
  );
  response(
    await send('POST', ocr, '1', multipart(' '.repeat(1024 * 1024 + 1))),
    413,
  );
  const oversizedFile = Buffer.alloc(10 * 1024 * 1024 + 1);
  oversizedFile.write(testFile);
  response(
    await send('POST', ocr, '1', multipart(command, oversizedFile)),
    413,
  );
  assert.equal(recorder.fetched.length, beforePuts);
}

async function counts(source) {
  return (
    await source.query(`SELECT
     (SELECT count(*)::int FROM invoices) AS invoices,
     (SELECT count(*)::int FROM products) AS products,
     (SELECT count(*)::int FROM product_logs) AS logs,
     (SELECT count(*)::int FROM business_cash_movements) AS movements,
     (SELECT count(*)::int FROM business_cash_movement_audit) AS audit`)
  )[0];
}

async function recovery(source, send, recorder, prior) {
  const command = {
    ...prior,
    request_key: randomUUID(),
    items: [productInput('create', 'rollback')],
  };
  const baseline = await counts(source);
  await source.query(`
    CREATE FUNCTION fail_cash04_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.request_key='${command.request_key}'::uuid AND NEW.status='committed' THEN
        RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='synthetic terminal receipt failure';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER fail_cash04_receipt BEFORE UPDATE ON business_cash_mutation_requests
    FOR EACH ROW EXECUTE FUNCTION fail_cash04_receipt();
  `);
  response(
    await send('POST', ocr, '1', multipart(command)),
    503,
    'business:cash_mutation_unavailable',
  );
  const previousKey = recorder.fetched.at(-1).key;
  assert.deepEqual(await counts(source), baseline);
  const [staged] = await source.query(
    'SELECT storage_key,uploaded_at FROM invoice_uploads WHERE storage_key=$1',
    [previousKey],
  );
  assert.ok(staged.uploaded_at);
  assert.equal(
    response(await send('GET', receipt(command.request_key)), 200).status,
    'processing',
  );
  await source.query(
    'DROP TRIGGER fail_cash04_receipt ON business_cash_mutation_requests',
  );
  await source.query(
    "UPDATE business_cash_mutation_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_key=$1",
    [command.request_key],
  );
  assert.equal(
    response(await send('GET', receipt(command.request_key)), 200).status,
    'retryable',
  );
  const recovered = response(
    await send('POST', ocr, '1', multipart(command)),
    201,
  );
  assert.notEqual(recorder.fetched.at(-1).key, previousKey);
  assert.deepEqual(
    response(await send('GET', receipt(command.request_key)), 200),
    recovered,
  );
  assert.deepEqual(
    await counts(source),
    Object.fromEntries(
      Object.entries(baseline).map(([key, value]) => [key, value + 1]),
    ),
  );

  const failedPut = {
    ...prior,
    request_key: randomUUID(),
    items: [productInput('create', 'failed-put')],
  };
  const beforeFailure = await counts(source);
  recorder.storage.beforePut = () => {
    throw new Error('synthetic failed PUT acknowledgement');
  };
  try {
    response(
      await send('POST', ocr, '1', multipart(failedPut)),
      503,
      'business:cash_mutation_unavailable',
    );
  } finally {
    recorder.storage.beforePut = undefined;
  }
  assert.deepEqual(await counts(source), beforeFailure);
  const failedKey = recorder.fetched.at(-1).key;
  assert.equal(
    response(await send('GET', receipt(failedPut.request_key)), 200).status,
    'retryable',
  );
  const retried = response(
    await send('POST', ocr, '1', multipart(failedPut)),
    201,
  );
  assert.notEqual(recorder.fetched.at(-1).key, failedKey);
  assert.ok(
    recorder.objects.has(failedKey),
    'A possibly stored object stays quarantined for the worker',
  );
  assert.equal(retried.result.products.length, 1);
  assert.equal(retried.status, 'committed');
}

await withBusinessCashHttpLab(
  {
    database: 'cash04_test',
    port: process.env.CASH04_TEST_PORT,
    marker: 'nodia-disposable:cash-04',
    migrations: [
      CreateInvoiceUploads1791630000000,
      CreateBusinessCashCategories1793690000000,
      CreateBusinessCashMovements1793700000000,
      LinkBusinessCashInvoiceExpenses1793710000000,
      LinkInvoiceUploadsToCashAttempts1793720000000,
    ],
    business,
    otherBusiness,
  },
  async ({ source, startHttp }) => {
    const legacyId = await setup(source);
    const recorder = storageRecorder();
    const send = await startHttp(httpOptions(recorder.storage));
    const cash = await category(send, 'Original');
    const replacement = await category(send, 'Replacement');
    const alien = await category(send, 'Other business', otherBusiness, '2');
    await manualInvoices(source, send, legacyId, cash, replacement, alien);
    await manualUpload(source, send, recorder);
    const command = await ocrRows(source, send, recorder, replacement);
    await invalidMultipart(send, recorder, command);
    await recovery(source, send, recorder, command);
    console.log(
      JSON.stringify({
        task: 'business_cash_invoice',
        status: 'passed',
        checks: [
          'migrations_preserve_legacy_invoice_revision_without_backfill',
          'real_scoped_http_legacy_compatibility_and_identified_invoice_receipts',
          'single_link_sync_activity_withdraw_restore_history_version_and_totals',
          'atomic_ocr_create_update_and_manual_match_with_logs',
          'same_key_concurrent_202_no_duplicate_effect_or_upload',
          'multipart_validation_before_external_storage',
          'receipt_failure_rolls_back_products_invoice_cash_and_logs',
          'expired_or_failed_upload_reclaim_uses_new_attempt',
        ],
        limits: [
          'Compiled HTTP and isolated PostgreSQL 16.',
          'Synthetic storage, no OCR provider or external I/O.',
        ],
      }),
    );
  },
);
