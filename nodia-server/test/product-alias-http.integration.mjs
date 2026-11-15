// Real product routes/query parsing/DTO pipeline; no DB, account or provider is used.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import qs from 'qs';

if (!process.argv.includes('--isolated')) {
  const env = Object.fromEntries(['PATH', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  env.DOTENV_CONFIG_PATH = join(tmpdir(), 'nodia-no-app-env-' + randomUUID());
  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--isolated'], { env, stdio: 'inherit', timeout: 60000 });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Dynamic app imports occur only after the child has an explicit environment without app secrets.
const { ProductController } = await import('../dist/product/product.controller.js');
const { GetAllProductsUseCase } = await import('../dist/product/use-case/get-all-products.use-case.js');
const { CreateProductUseCase } = await import('../dist/product/use-case/create-product.use-case.js');
const { UpdateProductUseCase } = await import('../dist/product/use-case/update-product.use-case.js');
const { UpdateBulkProductsUseCase } = await import('../dist/product/use-case/update-bulk-products.use-case.js');
const { RentalValidationPipe } = await import('../dist/rental-common/rental-validation.pipe.js');
const calls = [];
const providers = Reflect.getMetadata('design:paramtypes', ProductController).map(provide => ({
  provide, useValue: { execute(...args) {
    calls.push(provide);
    if (provide === GetAllProductsUseCase) return { q: args[0].q };
    if (provide === CreateProductUseCase) return args[0];
    if (provide === UpdateProductUseCase) return args[1];
    if (provide === UpdateBulkProductsUseCase) return args[0];
    throw new Error('Unexpected synthetic product operation');
  } },
}));
class ProductAliasHttpFixture {}
Module({ controllers: [ProductController], providers })(ProductAliasHttpFixture);
const app = await NestFactory.create(ProductAliasHttpFixture, { logger: false });
const checks = [];
try {
  app.setGlobalPrefix('api/v1');
  app.set('query parser', value => qs.parse(value, { allowDots: true, comma: true }));
  app.use((req, _response, next) => {
    req.auth = { user: { id: '12' }, sessionId: '11111111-1111-4111-8111-111111111111' };
    next();
  });
  app.useGlobalPipes(new RentalValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const get = (route, entries) => fetch(`${base}/api/v1/${route}?${new URLSearchParams(entries)}`);
  for (const route of ['product', 'products']) {
    const response = await get(route, [['q[search]', ' Café, 100%_\\ '], ['q[code_presence]', 'missing'], ['q[barcode_presence]', 'present']]);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).q, { search: ' Café, 100%_\\ ', code_presence: 'missing', barcode_presence: 'present' });
  }
  checks.push('both_real_product_routes_preserve_encoded_search_and_independent_nested_presence_filters');
  const reads = calls.length;
  for (const entries of [
    [['q[search]', 'one'], ['q[search]', 'two']],
    [['q[search]', 'x'.repeat(256)]],
    [['q[code_presence]', 'true']], [['q[barcode_presence]', 'all']],
    [['q[code_presence]', 'missing'], ['q[code_presence]', 'present']],
    [['q[unregistered_field]', 'value']],
  ]) assert.equal((await get('products', entries)).status, 400);
  assert.equal(calls.length, reads);
  checks.push('malformed_arrays_unknown_fields_invalid_presence_and_search_limits_fail_before_execution');
  const request = (path, method, value) => {
    const options = { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
    return method === 'POST' ? fetch(`${base}/api/v1/${path}`, { ...options, method: 'POST' })
      : fetch(`${base}/api/v1/${path}`, { ...options, method: 'PUT' });
  };
  const create = { business_id: '11111111-1111-4111-8111-111111111111', name: 'INV/001',
    cost_price: 1, cost_price_tax: 1, sale_price: 2, has_stock: true };
  const missing = await request('products', 'POST', create);
  assert.equal(missing.status, 201);
  assert.equal((await missing.json()).alias, undefined);
  const blank = await request('products', 'POST', { ...create, alias: ' \t\u00a0 ' });
  assert.equal(blank.status, 201);
  assert.equal((await blank.json()).alias, null);
  const trimmed = await request('products/3', 'PUT', { alias: '  Café humano  ', expected_version: 2 });
  assert.equal(trimmed.status, 200);
  assert.deepEqual(await trimmed.json(), { alias: 'Café humano', expected_version: 2 });
  const bulk = await request('products/bulk', 'PUT', { items: [{ id: '3', alias: ' ', expected_version: 2 }] });
  assert.equal(bulk.status, 200);
  assert.equal((await bulk.json()).items[0].alias, null);
  checks.push('native_create_update_and_bulk_dtos_preserve_omission_and_normalize_reviewed_aliases');
  const validUnicode = await request('products/3', 'PUT', { alias: '🫘'.repeat(255), expected_version: 2 });
  assert.equal(validUnicode.status, 200);
  const writes = calls.length;
  for (const alias of [false, 0, [], {}, '🫘'.repeat(256)])
    assert.equal((await request('products/3', 'PUT', { alias, expected_version: 2 })).status, 400);
  assert.equal(calls.length, writes);
  checks.push('alias_unicode_boundary_and_invalid_types_are_enforced_by_the_real_http_pipeline');
  console.log(JSON.stringify({ schema: 'product-alias-http/1', status: 'passed', checks,
    database_calls: 0, provider_calls: 0, authentication_guards_exercised: false,
    note: 'Transport/DTO integration only; service authorization, CAS and persistence have separate evidence.' }));
} finally {
  await app.close();
}
