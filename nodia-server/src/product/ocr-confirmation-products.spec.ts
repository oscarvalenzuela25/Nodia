import { describe, expect, it } from 'vitest';
import {
  buildOcrInvoiceData,
  normalizeOcrProducts,
} from './ocr-confirmation-products.js';

const line = {
  invoice_code: '  SUP-7 ',
  name: ' Harina ',
  alias: ' Harina revisada ',
  alias_reviewed: true,
  cost_price: 440,
  quantity: 1.25,
};

const product = {
  code: ' CAT-7 ',
  name: 'Harina',
  alias: 'Harina revisada',
  cost_price: 440,
  cost_price_tax: 524,
  sale_price: 685,
  is_active: false,
};

const initial = { kind: 'create', line, product };
const update = {
  kind: 'update',
  line,
  product,
  product_id: '12',
  expected_version: 3,
};
const manual = {
  kind: 'manual_match',
  line,
  product_id: '15',
  expected_version: 4,
  changes: { code: null, sale_price: 684 },
};

describe('Reviewed product confirmation command', () => {
  it('keeps stock intent out of the legacy command shape and invoice quantity', () => {
    const [legacy] = normalizeOcrProducts([initial]);
    expect(Object.keys(legacy)).toEqual(['kind', 'line', 'product']);
    const [reviewed] = normalizeOcrProducts([{
      ...manual,
      changes: {},
      track_stock: true,
      stock_action: { mode: 'replace', quantity: 0 },
    }]);
    expect(reviewed).toMatchObject({
      changes: {},
      track_stock: true,
      stock_action: { mode: 'replace', quantity: 0 },
    });
    const invoice = buildOcrInvoiceData([reviewed], [{ id: '15', version: 5 }]);
    expect(invoice.extracted_items[0]).toMatchObject({ quantity: 1.25, selected_update_fields: [] });
    expect(invoice.extracted_items[0]).not.toHaveProperty('stock_action');
  });

  it('normalizes canonical intent and keeps supplier code and fractional quantity in the invoice snapshot', () => {
    const items = normalizeOcrProducts([manual, initial]);
    expect(items[0]).toMatchObject({
      changes: { code: null, sale_price: 680 },
    });
    expect(items[1]).toMatchObject({
      product: { code: 'CAT-7', sale_price: 690, is_active: false },
    });
    expect(
      buildOcrInvoiceData(items, [
        { id: '15', version: 5 },
        { id: '60', version: 1 },
      ]),
    ).toEqual({
      items_count: 2,
      extracted_items: [
        {
          code: 'SUP-7',
          name: 'Harina',
          alias: 'Harina revisada',
          alias_reviewed: true,
          cost_price: 440,
          quantity: 1.25,
          is_update: true,
          matched_product_id: '15',
          selected_update_fields: ['code', 'sale_price'],
        },
        {
          code: 'SUP-7',
          name: 'Harina',
          alias: 'Harina revisada',
          alias_reviewed: true,
          cost_price: 440,
          quantity: 1.25,
          is_update: false,
        },
      ],
    });
    expect(
      normalizeOcrProducts([
        { ...update, product: { ...product, code: '   ' } },
      ]),
    ).toMatchObject([{ product: { code: null } }]);
  });

  it.each(
    [
      [],
      Array.from({ length: 501 }, () => initial),
      [{ ...initial, product: { ...product, code: null } }],
      [{ ...initial, product: { ...product, stock: 999 } }],
      [{ ...initial, line: { ...line, alias_reviewed: 'true' } }],
      [{ ...initial, line: { ...line, quantity: Number.NaN } }],
      [{ ...initial, line: { ...line, name: '\uD800' } }],
      [{ ...initial, product: { ...product, alias: 'Unreviewed' } }],
      [{ ...initial, product: { ...product, sale_price: 2147483645 } }],
      [{ ...manual, changes: {} }],
      [{ ...manual, track_stock: false, stock_action: { mode: 'add', quantity: 1 } }],
      [{ ...manual, stock_action: { mode: 'add', quantity: 0.0001 } }],
      [{ ...manual, stock_action: { mode: 'add', quantity: 1, stock: 2 } }],
      [{ ...initial, stock_action: { mode: 'add', quantity: 0 } }],
      [{ ...manual, changes: { cost_price: 441 } }],
      [{ ...manual, changes: { provider_id: '9' } }],
      [{ ...update, product_id: '0012' }],
      [{ ...update, expected_version: '3' }],
      [update, { ...manual, product_id: update.product_id }],
      [initial, { ...update, product: { ...product, code: ' cat-7 ' } }],
    ].map((value, index) => [index + 1, value] as const),
  )('rejects invalid intent case %i before persistence', (_index, items) => {
    expect(() => normalizeOcrProducts(items)).toThrow();
  });
});
