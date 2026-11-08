import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { compareInvoiceOcrPrices, loadInvoiceOcrComparison } from './compare-invoice-prices.js';
const item = { name: 'fixture', code: ' SKU ', cost_price: 0, cost_price_tax: null };
describe('compareInvoiceOcrPrices', () => {
  it('does not match null or blank supplier codes to a line without a code', () => {
    const [missing, unique] = compareInvoiceOcrPrices([{ ...item, code: null }, item], [
      { id: '1', code: null, cost_price: 100, cost_price_tax: 119 },
      { id: '2', code: '', cost_price: 100, cost_price_tax: 119 },
      { id: '3', code: 'SKU', cost_price: 100, cost_price_tax: 119 },
    ]);
    expect(missing).toMatchObject({ match: 'missing_code', product_id: null });
    expect(unique).toMatchObject({ match: 'unique', product_id: '3' });
  });
  it('retains observed prices but never calculates changes between different or unknown units', () => {
    for (const measurement_unit of ['kg', 'g', 'bundle', null] as const) {
      const [result] = compareInvoiceOcrPrices([{ ...item, cost_price: 50, cost_price_tax: 60 }],
        [{ id: '1', code: 'SKU', cost_price: 100, cost_price_tax: 119, measurement_unit }]);
      expect(result).toMatchObject({ match: 'unique', product_id: '1' });
      expect(result.net).toEqual({ previous: 100, current: 50, delta: null, percent: null, direction: 'unknown' });
      expect(result.gross).toEqual({ previous: 119, current: 60, delta: null, percent: null, direction: 'unknown' });
    }
    const [unknown] = compareInvoiceOcrPrices([{ ...item, measurement_unit: null }],
      [{ id: '1', code: 'SKU', cost_price: 100, cost_price_tax: 119, measurement_unit: 'unit' }]);
    expect(unknown.net.delta).toBeNull();
  });
  it('compares only an explicitly equal measurement basis without converting kilograms to grams', () => {
    const [same, different] = compareInvoiceOcrPrices([
      { ...item, cost_price: 50, measurement_unit: 'kg' },
      { ...item, cost_price: 50, measurement_unit: 'g' },
    ], [{ id: '1', code: 'SKU', cost_price: 100, cost_price_tax: 119, measurement_unit: 'kg' }]);
    expect(same.net).toMatchObject({ delta: -50, percent: -50 });
    expect(different.net).toMatchObject({ previous: 100, current: 50, delta: null, percent: null, direction: 'unknown' });
  });
  it('loads nullable-code products by current business and measurement without an unbounded or empty-code query', async () => {
    const query = vi.fn(async (_sql: string, _params: unknown[]) => [{ id: '1', code: 'SKU', cost_price: 100, cost_price_tax: 119, measurement_unit: 'kg' }]);
    const manager = { query } as unknown as EntityManager;
    const [result] = await loadInvoiceOcrComparison(manager, 'business', [item], 100);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('measurement_unit'), ['business', ['sku'], 101]);
    expect(query.mock.calls[0][0]).toContain('code IS NOT NULL');
    expect(result.net.delta).toBeNull();
    query.mockClear();
    const [missing] = await loadInvoiceOcrComparison(manager, 'business', [{ ...item, code: null }], 100);
    expect(query).not.toHaveBeenCalled();
    expect(missing.match).toBe('missing_code');
  });
  it('keeps decimal price changes and percentages without binary noise or integer truncation', () => {
    const [up, down, fraction] = compareInvoiceOcrPrices([
      { ...item, code: 'UP', cost_price: 1440, cost_price_tax: 1713.6 },
      { ...item, code: 'DOWN', cost_price: 640, cost_price_tax: 761.6 },
      { ...item, code: 'FRACTION', cost_price: 101.25, cost_price_tax: null },
    ], [
      { id: '1', code: 'UP', cost_price: 1200, cost_price_tax: 1428 },
      { id: '2', code: 'DOWN', cost_price: 800, cost_price_tax: 952 },
      { id: '3', code: 'FRACTION', cost_price: 100, cost_price_tax: null },
    ]);
    expect(up.gross).toMatchObject({ delta: 285.6, percent: 20, direction: 'up' });
    expect(down.gross).toMatchObject({ delta: -190.4, percent: -20, direction: 'down' });
    expect(fraction.net).toMatchObject({ delta: 1.25, percent: 1.25, direction: 'up' });
  });
  it('compares net and gross separately, preserving zero and unknown', () => {
    const [r] = compareInvoiceOcrPrices([item], [{ id: '7', code: 'sku', cost_price: 100, cost_price_tax: 119 }]);
    expect(r.net).toEqual({ previous: 100, current: 0, delta: -100, percent: -100, direction: 'down' });
    expect(r.gross).toEqual({ previous: 119, current: null, delta: null, percent: null, direction: 'unknown' });
  });
  it('retains absolute increase from zero without inventing percentage', () => {
    const [r] = compareInvoiceOcrPrices([{ ...item, cost_price: 5 }], [{ id: '7', code: 'sku', cost_price: 0, cost_price_tax: null }]);
    expect(r.net).toEqual({ previous: 0, current: 5, delta: 5, percent: null, direction: 'up' });
  });
  it('never chooses a product for ambiguous, missing or unmatched codes', () => {
    const rows = compareInvoiceOcrPrices([item, { ...item, code: null }, { ...item, code: 'absent' }],
      [{ id: '1', code: 'SKU', cost_price: 1, cost_price_tax: 2 }, { id: '2', code: ' sku ', cost_price: 3, cost_price_tax: 4 }]);
    expect(rows.map(r => r.match)).toEqual(['ambiguous', 'missing_code', 'unmatched']);
    expect(rows.every(r => r.product_id === null && r.net.previous === null && r.net.delta === null)).toBe(true);
  });
  it('does not derive gross from net or net from gross', () => {
    const [r] = compareInvoiceOcrPrices([{ ...item, cost_price: null, cost_price_tax: 120 }], [{ id: '1', code: 'sku', cost_price: 100, cost_price_tax: null }]);
    expect(r.net.delta).toBeNull(); expect(r.gross.delta).toBeNull(); expect(r.gross.current).toBe(120);
  });
  it('rejects nonfinite/negative values while preserving real zero delta', () => {
    const [r] = compareInvoiceOcrPrices([{ ...item, cost_price: NaN, cost_price_tax: 0 }], [{ id: '1', code: 'sku', cost_price: -1, cost_price_tax: 0 }]);
    expect(r.net.current).toBeNull(); expect(r.net.previous).toBeNull();
    expect(r.gross).toEqual({ previous: 0, current: 0, delta: 0, percent: null, direction: 'same' });
  });
});
