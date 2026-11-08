import { describe, expect, it } from 'vitest';
import { parseGeminiInvoiceExtraction } from './invoice-extraction.js';

const invoice = (item: Record<string, unknown> = {}) => ({
  code: null, total_amount: 0,
  data: { issue_date: '', items: [{ name: ' Producto ', ...item }] },
});

describe('shared Products invoice extraction projection', () => {
  it('preserves real zeros and leaves absent prices and quantities unknown', () => {
    const result = parseGeminiInvoiceExtraction(invoice({ quantity: 0, cost_price: 0, total_price: 0 }));
    expect(result.total_amount).toBe(0);
    expect(result.items[0]).toEqual({ name: 'Producto', code: null, quantity: 0,
      cost_price: 0, cost_price_tax: null, packages: null, units_per_package: null,
      unit_price: null, total_price: 0 });
    expect(result.issue_date).toBe('');
  });
  it('keeps the existing Products folio contract and strips untrusted extra fields', () => {
    const source = { ...invoice({ code: ' P1 ', hidden: 'not public' }), code: ' F1 ', secret: 'not public' };
    expect(parseGeminiInvoiceExtraction(source)).toMatchObject({ code: 'F1', items: [{ code: 'P1' }] });
    expect(JSON.stringify(parseGeminiInvoiceExtraction(source))).not.toContain('not public');
  });
  it.each([-1, NaN, Infinity, '0', '', false])('rejects an invalid numeric price %s', value => {
    expect(() => parseGeminiInvoiceExtraction(invoice({ cost_price: value }))).toThrow();
  });
  it.each([null, [], {}, { data: { items: [] } }, invoice({ name: ' ' }), invoice({ code: 0 })])(
    'rejects malformed responses or invoice lines', value => {
      expect(() => parseGeminiInvoiceExtraction(value)).toThrow();
    },
  );
});
