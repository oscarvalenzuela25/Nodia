import { describe, expect, it } from 'vitest';
import { formatInvoiceOcrResult } from './format-invoice-ocr-result.js';

describe('completed invoice OCR text', () => {
  it('preserves zero and unknown values without inventing currency or sale prices', () => {
    const text = formatInvoiceOcrResult({ analysis_id: 'a', provider_id: '3', extraction: {
      code: null, total_amount: 0, data: { issue_date: null, items: [{ name: 'P\nStock guardado', cost_price: 0, cost_price_tax: null }] },
    }, comparison: null });
    expect(text).toContain('Total: 0. Fecha: sin dato');
    expect(text).toContain('1. P Stock guardado: 0 / sin dato.');
    expect(text).toContain('compare estos precios');
    expect(text).not.toContain('$');
  });
  it('reports comparable changes and ambiguous codes, requiring human review to save', () => {
    const net = { previous: 0, current: 10, delta: 10, percent: null, direction: 'up' };
    const text = formatInvoiceOcrResult({ analysis_id: 'a', provider_id: '3', extraction: {
      code: 'F', total_amount: 10, data: { items: [{ name: 'P', cost_price: 10, cost_price_tax: null }] },
    }, comparison: [{ name: 'P', match: 'unique', net, gross: { previous: null, current: null, delta: null, percent: null, direction: 'unknown' } },
      { name: 'Q', match: 'ambiguous' }] });
    expect(text).toContain('0 → 10 (subió, diferencia 10)');
    expect(text).toContain('no comparable');
    expect(text).toContain('más de un producto coincide');
    expect(text).toContain('revisar y confirmar cada propuesta');
    expect(text).toContain('No se han guardado cambios');
  });
});
