import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CheckoutSaleDto, CreateSaleDto } from '../dto/sale-command.dto.js';
import type { ProductSaleRow, SaleItemInput } from '../types/sale.types.js';
import {
  assertSaleTransition,
  normalizeSaleCommand,
  normalizeSaleQuery,
  saleCommandHash,
  saleMoney,
  saleItemInputsFromSnapshots,
  snapshotSaleItems,
} from './sale-policy.js';

const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const product = (change: Partial<ProductSaleRow> = {}): ProductSaleRow => ({
  id: '1',
  business_id: id,
  code: 'invoice-1',
  measurement_unit: 'unit',
  barcode: '001234',
  name: 'Synthetic',
  sale_price: '1500',
  offer_price: '1200',
  is_offer_enabled: false,
  cost_price: '800',
  cost_price_tax: '952',
  version: 2,
  is_active: true,
  has_stock: true,
  ...change,
});
const input = (change: Partial<SaleItemInput> = {}): SaleItemInput => ({
  product_id: '1',
  quantity: 2,
  expected_product_version: 2,
  expected_unit_price: '1500',
  ...change,
});

describe('sale command and monetary policy', () => {
  it('checkout requires items and canonicalizes the same explicit payment intent', () => {
    const omitted = normalizeSaleCommand(
      'checkout',
      plainToInstance(CheckoutSaleDto, {
        request_key: key,
        items: [input()],
      }),
    );
    const explicit = normalizeSaleCommand('checkout', {
      request_key: key,
      items: [input()],
      payment_method: 'cash',
      payment_method_description: null,
    });
    expect(omitted).toEqual(explicit);
    expect(saleCommandHash('checkout', omitted)).toBe(
      saleCommandHash('checkout', explicit),
    );
    expect(saleCommandHash('checkout', explicit)).not.toBe(
      saleCommandHash('create', explicit),
    );
  });
  it.each([
    undefined,
    null,
    [],
    Array.from({ length: 201 }, (_, i) => input({ product_id: String(i + 1) })),
  ])('checkout rejects missing, empty or oversized items', (items) => {
    expect(() =>
      normalizeSaleCommand('checkout', { request_key: key, items }),
    ).toThrow('business:sale_invalid_command');
  });
  it('checkout cannot target a draft or override status, totals, actor or completion time', () => {
    for (const extra of [
      { sale_id: id },
      { expected_version: 1 },
      { status: 'draft' },
      { total_amount: '1' },
      { actor_id: '2' },
      { completed_at: '2020-01-01T00:00:00Z' },
    ])
      expect(() =>
        normalizeSaleCommand('checkout', {
          request_key: key,
          items: [input()],
          ...extra,
        }),
      ).toThrow();
  });
  it('checkout HTTP DTO requires a bounded, nested item collection while legacy create remains optional', async () => {
    for (const items of [
      undefined,
      null,
      [],
      Array.from({ length: 201 }, () => input()),
    ]) {
      expect(
        await validate(
          plainToInstance(CheckoutSaleDto, { request_key: key, items }),
        ),
      ).not.toEqual([]);
    }
    expect(
      await validate(
        plainToInstance(CheckoutSaleDto, {
          request_key: key,
          items: [input()],
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(CheckoutSaleDto, {
          request_key: key,
          items: [input({ quantity: 0 })],
        }),
      ),
    ).not.toEqual([]);
    expect(
      await validate(plainToInstance(CreateSaleDto, { request_key: key })),
    ).toEqual([]);
  });
  it('canonicalizes omitted cash identically to explicit cash, including DTO undefined fields', () => {
    const omitted = normalizeSaleCommand(
      'create',
      plainToInstance(CreateSaleDto, { request_key: key }),
    );
    const explicit = normalizeSaleCommand('create', {
      request_key: key,
      payment_method: 'cash',
      items: [],
      payment_method_description: null,
    });
    expect(omitted).toEqual(explicit);
    expect(saleCommandHash('create', omitted)).toBe(
      saleCommandHash('create', explicit),
    );
    expect(omitted.payment_method).toBe('cash');
  });
  it('does not default payment or replace items on a partial update', () => {
    expect(
      normalizeSaleCommand('update', {
        request_key: key,
        sale_id: id,
        expected_version: 1,
      }),
    ).toEqual({ request_key: key, sale_id: id, expected_version: 1 });
  });
  it.each([null, '', false, {}, '01', '1.5', '-1', '9223372036854775808'])(
    'rejects absent or noncanonical money %j',
    (value) => {
      expect(() => saleMoney(value)).toThrow();
    },
  );
  it('preserves zero and integers above the JS safe boundary', () => {
    expect(saleMoney('0')).toBe(0n);
    expect(saleMoney('9007199254740993')).toBe(9007199254740993n);
  });
  it.each([
    { quantity: 0 },
    { quantity: 1.0001 },
    { expected_product_version: 0 },
    { product_id: '01' },
  ])('rejects invalid item input %j', (patch) => {
    expect(() =>
      normalizeSaleCommand('create', {
        request_key: key,
        items: [input(patch)],
      }),
    ).toThrow();
  });
  it('rejects duplicate products, price/actor overrides and unknown methods', () => {
    expect(() =>
      normalizeSaleCommand('create', {
        request_key: key,
        items: [input(), input()],
      }),
    ).toThrow();
    for (const value of [
      { request_key: key, total_amount: '1' },
      { request_key: key, actor_id: '2' },
      { request_key: key, payment_method: 'paid' },
    ])
      expect(() => normalizeSaleCommand('create', value)).toThrow();
  });
  it('retains zero as an observation instead of turning absence into zero', () => {
    expect(
      normalizeSaleCommand('create', {
        request_key: key,
        items: [input({ expected_unit_price: '0' })],
      }).items?.[0].expected_unit_price,
    ).toBe('0');
    expect(() =>
      normalizeSaleCommand('create', {
        request_key: key,
        items: [{ product_id: '1', quantity: 1, expected_product_version: 2 }],
      }),
    ).toThrow();
  });
  it('canonicalizes an absent/null override without changing the pre-R24 command hash', () => {
    const command = (override: object = {}) =>
      normalizeSaleCommand('checkout', {
        request_key: key,
        items: [{ ...input(), ...override }],
      });
    const legacy = command();
    expect(saleCommandHash('checkout', legacy)).toBe(
      'e569e683ce42f0f08a844829d3ab223228d37c401c3593aef18316ac44a0460e',
    );
    expect(command({ unit_price_override: null })).toEqual(legacy);
    expect(command({ unit_price_override: undefined })).toEqual(legacy);
    for (const unit_price_override of ['0', '1500', '9007199254740993']) {
      const manual = command({ unit_price_override });
      expect(manual.items?.[0].unit_price_override).toBe(unit_price_override);
      expect(saleCommandHash('checkout', manual)).not.toBe(
        saleCommandHash('checkout', legacy),
      );
    }
    expect(
      saleCommandHash('checkout', command({ unit_price_override: '1500' })),
    ).not.toBe(
      saleCommandHash('checkout', command({ unit_price_override: '1499' })),
    );
  });
  it('rejects malformed overrides at the HTTP and internal command boundaries', async () => {
    for (const unit_price_override of [
      '',
      '01',
      '-1',
      '1.001',
      '1e3',
      '9223372036854775808',
      1,
      false,
      {},
      [],
    ]) {
      const command = {
        request_key: key,
        items: [{ ...input(), unit_price_override }],
      };
      expect(() => normalizeSaleCommand('checkout', command)).toThrow(
        'business:sale_invalid_command',
      );
      if (unit_price_override !== '9223372036854775808')
        expect(
          await validate(plainToInstance(CheckoutSaleDto, command)),
        ).not.toEqual([]);
    }
    for (const unit_price_override of [null, undefined, '0', '1250']) {
      const dto = plainToInstance(CheckoutSaleDto, {
        request_key: key,
        items: [{ ...input(), unit_price_override }],
      });
      expect(await validate(dto)).toEqual([]);
      expect(() => normalizeSaleCommand('checkout', dto)).not.toThrow();
    }
    for (const extra of [
      { price_source: 'manual' },
      { unit_price: '1' },
      { line_total: '1' },
      { change_product_price: true },
    ])
      expect(() =>
        normalizeSaleCommand('checkout', {
          request_key: key,
          items: [{ ...input(), ...extra }],
        }),
      ).toThrow();
  });
  it.each(['complete', 'cancel', 'discard'] as const)(
    'does not accept items as a %s override',
    (operation) => {
      expect(() =>
        normalizeSaleCommand(operation, {
          request_key: key,
          sale_id: id,
          expected_version: 1,
          items: [input()],
          cancellation_reason: 'reason',
        }),
      ).toThrow();
    },
  );
  it('requires a meaningful cancellation reason and separates hash by operation', () => {
    expect(() =>
      normalizeSaleCommand('cancel', {
        request_key: key,
        sale_id: id,
        expected_version: 1,
        cancellation_reason: ' ',
      }),
    ).toThrow();
    const command = normalizeSaleCommand('update', {
      request_key: key,
      sale_id: id,
      expected_version: 1,
    });
    expect(saleCommandHash('update', command)).not.toBe(
      saleCommandHash('discard', command),
    );
  });
});

describe('sale snapshots and transitions', () => {
  it('freezes an explicit manual price separately from an enabled offer and preserves the catalog', () => {
    const source = product({ is_offer_enabled: true, measurement_unit: 'kg' });
    const before = structuredClone(source);
    const [line] = snapshotSaleItems(
      [
        input({
          quantity: 2.345,
          expected_unit_price: '1200',
          unit_price_override: '900',
        }),
      ],
      [source],
    );
    expect(line).toMatchObject({
      price_source: 'manual',
      unit_price: '900',
      line_total: '2111',
      regular_unit_price: '1500',
      offer_price_snapshot: '1200',
      is_offer_enabled_snapshot: true,
      product_version: 2,
      measurement_unit_snapshot: 'kg',
    });
    expect(source).toEqual(before);
    expect(
      snapshotSaleItems(
        [input({ unit_price_override: '1500' })],
        [product()],
      )[0].price_source,
    ).toBe('manual');
    expect(
      snapshotSaleItems([input({ unit_price_override: '0' })], [product()])[0],
    ).toMatchObject({
      price_source: 'manual',
      unit_price: '0',
      line_total: '0',
    });
    expect(
      snapshotSaleItems(
        [input({ quantity: 0.001, unit_price_override: '1500' })],
        [product()],
      )[0].line_total,
    ).toBe('2');
  });
  it('does not let manual prices bypass observed catalog prices, product versions or availability', () => {
    const manual = input({ unit_price_override: '900' });
    for (const change of [{ version: 3 }, { sale_price: '1600' }])
      expect(() => snapshotSaleItems([manual], [product(change)])).toThrow(
        'business:sale_product_changed',
      );
    for (const change of [
      { has_stock: false },
      { has_stock: null },
      { is_active: false },
    ])
      expect(() => snapshotSaleItems([manual], [product(change)])).toThrow(
        'business:sale_product_unavailable',
      );
    expect(() =>
      snapshotSaleItems(
        [input({ expected_unit_price: '900', unit_price_override: '900' })],
        [product()],
      ),
    ).toThrow('business:sale_product_changed');
    expect(() =>
      snapshotSaleItems(
        [manual],
        [product({ is_offer_enabled: true, offer_price: null })],
      ),
    ).toThrow('business:sale_product_price_missing');
    expect(() =>
      snapshotSaleItems(
        [input({ unit_price_override: '9223372036854775807' })],
        [product()],
      ),
    ).toThrow('business:sale_amount_overflow');
  });
  it('reconstructs draft confirmation observations without losing a manual price or replacing the catalog expectation', () => {
    const source = product({ is_offer_enabled: true });
    const [line] = snapshotSaleItems(
      [input({ expected_unit_price: '1200', unit_price_override: '900' })],
      [source],
    );
    const [observation] = saleItemInputsFromSnapshots([line]);
    expect(observation).toEqual(
      input({ expected_unit_price: '1200', unit_price_override: '900' }),
    );
    expect(snapshotSaleItems([observation], [source])[0]).toMatchObject({
      price_source: 'manual',
      unit_price: '900',
      line_total: '1800',
    });
    expect(() =>
      snapshotSaleItems([observation], [product({ ...source, version: 3 })]),
    ).toThrow('business:sale_product_changed');
    expect(() =>
      snapshotSaleItems(
        [observation],
        [product({ ...source, offer_price: '1100' })],
      ),
    ).toThrow('business:sale_product_changed');
    expect(
      saleItemInputsFromSnapshots(snapshotSaleItems([input()], [product()]))[0],
    ).toEqual(input());
    expect(
      saleItemInputsFromSnapshots(
        snapshotSaleItems([input({ expected_unit_price: '1200' })], [source]),
      )[0],
    ).toEqual(input({ expected_unit_price: '1200' }));
  });
  it('freezes the measurement and optional code, and rounds each fractional line to pesos', () => {
    const [line] = snapshotSaleItems(
      [input({ quantity: 2.345 })],
      [product({ code: null, measurement_unit: 'kg' })],
    );
    expect(line.quantity).toBe(2.345);
    expect(line.line_total).toBe('3518');
    expect(line.measurement_unit_snapshot).toBe('kg');
    expect(line.product_code_snapshot).toBeNull();
  });
  it('accepts three-decimal unit quantities through DTO and command policy', async () => {
    const value = plainToInstance(CheckoutSaleDto, {
      request_key: key,
      items: [input({ quantity: 0.001 })],
    });
    expect(await validate(value)).toEqual([]);
    expect(normalizeSaleCommand('checkout', value).items?.[0].quantity).toBe(
      0.001,
    );
    const invalid = plainToInstance(CheckoutSaleDto, {
      request_key: key,
      items: [input({ quantity: 0.0009 })],
    });
    expect(await validate(invalid)).not.toEqual([]);
  });
  it.each(['1000', '1500', '2000'])(
    'uses active alternative %s without comparing against normal',
    (offer) => {
      const [line] = snapshotSaleItems(
        [input({ expected_unit_price: offer })],
        [product({ is_offer_enabled: true, offer_price: offer })],
      );
      expect(line.unit_price).toBe(offer);
      expect(line.price_source).toBe('offer');
      expect(line.regular_unit_price).toBe('1500');
      expect(line.line_total).toBe((BigInt(offer) * 2n).toString());
      expect(line.product_code_snapshot).toBe('invoice-1');
      expect(line.product_barcode_snapshot).toBe('001234');
    },
  );
  it('uses normal when alternative disabled without modifying either configured value', () => {
    const source = product({ offer_price: '2000' });
    const [line] = snapshotSaleItems([input()], [source]);
    expect(line.unit_price).toBe('1500');
    expect(line.offer_price_snapshot).toBe('2000');
    expect(source.offer_price).toBe('2000');
  });
  it('does not substitute the normal price if enabled alternative is missing', () => {
    expect(() =>
      snapshotSaleItems(
        [input()],
        [product({ is_offer_enabled: true, offer_price: null })],
      ),
    ).toThrow('business:sale_product_price_missing');
  });
  it.each([{ has_stock: false }, { has_stock: null }, { is_active: false }])(
    'rejects unavailable or inactive product %j',
    (patch) => {
      expect(() => snapshotSaleItems([input()], [product(patch)])).toThrow(
        'business:sale_product_unavailable',
      );
    },
  );
  it('rejects foreign/missing products and stale price/version observations', () => {
    expect(() => snapshotSaleItems([input()], [])).toThrow();
    expect(() =>
      snapshotSaleItems([input()], [product({ version: 3 })]),
    ).toThrow('business:sale_product_changed');
    expect(() =>
      snapshotSaleItems([input()], [product({ sale_price: '1600' })]),
    ).toThrow('business:sale_product_changed');
  });
  it('keeps exact totals beyond Number precision and rejects SQL bigint overflow', () => {
    const [line] = snapshotSaleItems(
      [input({ quantity: 10000000, expected_unit_price: '2000000001' })],
      [product({ sale_price: '2000000001' })],
    );
    expect(line.line_total).toBe('20000000010000000');
    expect(() =>
      snapshotSaleItems(
        [input({ quantity: 2, expected_unit_price: '9223372036854775807' })],
        [product({ sale_price: '9223372036854775807' })],
      ),
    ).toThrow('business:sale_amount_overflow');
  });
  it('permits zero snapshots while completed total policy is enforced by the use case', () => {
    expect(
      snapshotSaleItems(
        [input({ expected_unit_price: '0' })],
        [product({ sale_price: '0' })],
      )[0].unit_price,
    ).toBe('0');
  });
  it('allows only the agreed lifecycle', () => {
    expect(assertSaleTransition('draft', 'checkout')).toBe('completed');
    expect(assertSaleTransition('draft', 'complete')).toBe('completed');
    expect(assertSaleTransition('completed', 'cancel')).toBe('cancelled');
    expect(assertSaleTransition('draft', 'discard')).toBe('discarded');
    for (const status of ['completed', 'cancelled', 'discarded'] as const)
      for (const operation of ['update', 'checkout'] as const)
        expect(() => assertSaleTransition(status, operation)).toThrow();
    expect(() => assertSaleTransition('cancelled', 'complete')).toThrow();
    expect(() => assertSaleTransition('completed', 'discard')).toThrow();
  });
});

describe('sale read boundary', () => {
  it('accepts explicit instants and bounds pagination', () => {
    expect(
      normalizeSaleQuery({
        from: '2026-10-01T03:00:00Z',
        to_exclusive: '2026-11-01T03:00:00Z',
      }).limit,
    ).toBe(20);
    expect(() => normalizeSaleQuery({ limit: 101 })).toThrow();
  });
  it.each([
    { from: '2026-10-01T00:00:00Z' },
    { from: '2026-02-31T00:00:00Z', to_exclusive: '2026-03-05T00:00:00Z' },
    { from: '2026-10-01T24:00:00Z', to_exclusive: '2026-10-05T00:00:00Z' },
    { from: '2026-10-05T00:00:00Z', to_exclusive: '2026-10-01T00:00:00Z' },
  ])('rejects invalid or incomplete periods %j', (query) =>
    expect(() => normalizeSaleQuery(query)).toThrow(),
  );
});
