import { describe, expect, it } from 'vitest';
import { bindInvoiceRow, canBindInvoiceProduct, mapExtractedItemsToRows, validateInvoiceRows, reviewInvoiceAlias, reviewInvoiceSalePrice, invoiceAliasNeedsReview, invoiceRowEditPrice, updateInvoiceProductRevision } from '../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/helpers';
import { invoiceConfirmationItem, prepareInvoiceConfirmation } from '../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/invoiceOcrConfirmation';
import { evaluateInvoiceStock, observeInvoiceStock, setInvoiceStockTracking } from '../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/invoiceStock';
import type { ProductEntity } from '../../../../../../../../../modules/business/infrastructure/types';

describe('Purchase invoice versus POS catalog', () => {
  it('retains invoice quantity without assigning inventory, availability, barcode or alternative price', () => {
    const existing = { id: '12', code: 'SUP', name: 'Existing', alias: 'Existing alias', sale_price: 10, cost_price: 5, cost_price_tax: 6,
      stock: 999, has_stock: false, barcode: '00012', offer_price: 150,
      is_offer_enabled: true, version: 4, is_active: false } as ProductEntity;
    const [row] = mapExtractedItemsToRows([{ code: 'SUP', name: 'New label', quantity: 7, cost_price: 8, cost_price_tax: 9 }], [existing]);
    expect(row).toMatchObject({ quantity: 7, stockReview: { tracking: false, observedBalance: 999 }, version: 4, is_active: false });
    const update = invoiceConfirmationItem(row, 'business');
    expect(update).toMatchObject({ kind: 'update', product_id: '12', expected_version: 4, product: { is_active: false }, line: { quantity: 7 } });
    for (const field of ['stock','quantity','has_stock','barcode','offer_price','is_offer_enabled']) expect(update).not.toHaveProperty(`product.${field}`);
    expect(update).not.toHaveProperty('track_stock');
    expect(update).not.toHaveProperty('stock_action');
  });
  it('defaults a new item to untracked independently of purchase quantity, including zero', () => {
    const [row] = mapExtractedItemsToRows([{ code: 'NEW', name: 'New', quantity: 0, cost_price: 0, cost_price_tax: 0 }], []);
    expect(row.quantity).toBe(0);
    expect(row.stockReview).toEqual(observeInvoiceStock());
    expect(row.isValid).toBe(true);
    expect(invoiceConfirmationItem(row, 'business')).toMatchObject({ kind: 'create', line: { quantity: 0 }, product: { sale_price: 0, alias: 'New' } });
    expect(invoiceConfirmationItem(row, 'business')).not.toHaveProperty('track_stock');
    expect(invoiceConfirmationItem(row, 'business')).not.toHaveProperty('stock_action');
  });
});

// Synthetic catalog and invoice: no provider calls or personal data.
const product: ProductEntity = { id: '12', business_id: 'business', provider_id: 'old-provider', code: null, name: 'Manual product', alias: 'Manual alias',
  cost_price: 800, cost_price_tax: 952, sale_price: 990, stock: 77, has_stock: false, version: 3, is_active: true,
  barcode: '000123', offer_price: 950, is_offer_enabled: true, measurement_unit: 'kg' };
const invoice = { providerId: '9', code: '  Folio ', total: 119, issueDate: '' };
const sourceRow = () => mapExtractedItemsToRows([{ code: 'INV-9', name: 'Invoice label', quantity: 6, cost_price: 900, cost_price_tax: 1071 }], [])[0];

describe('OCR stock review', () => {
  it('adds decimal quantities exactly and distinguishes a blank amount from replacement zero', () => {
    const review = observeInvoiceStock({ track_stock: true, stock: 1.125 });
    expect(evaluateInvoiceStock({ ...review, quantity: '0,125' }, 6)).toEqual({
      action: { mode: 'add', quantity: 0.125 },
      projectedBalance: 1.25,
    });
    expect(evaluateInvoiceStock({ ...review, mode: 'replace', quantity: '' }, 6)).toEqual({});
    expect(evaluateInvoiceStock({ ...review, mode: 'replace', quantity: '0' }, 6)).toEqual({
      action: { mode: 'replace', quantity: 0 },
      projectedBalance: 0,
    });
    for (const quantity of ['0.0001', '-1', '1e2', '2147483647']) {
      expect(evaluateInvoiceStock({ ...review, quantity }, 6)).toHaveProperty('error');
    }
  });

  it('proposes the invoiced quantity for tracked products and keeps an explicit clear', () => {
    const tracked = observeInvoiceStock({ track_stock: true, stock: 1.125 });
    expect(evaluateInvoiceStock(tracked, 0.125)).toEqual({
      action: { mode: 'add', quantity: 0.125 },
      projectedBalance: 1.25,
    });
    expect(evaluateInvoiceStock(tracked, 0)).toMatchObject({ action: { quantity: 0 } });
    expect(evaluateInvoiceStock(tracked, Number.NaN)).toEqual({});
    expect(evaluateInvoiceStock(tracked, 0.0001)).toHaveProperty('error');
    expect(evaluateInvoiceStock({ ...tracked, quantity: '' }, 6)).toEqual({});
  });

  it('requires replacing an invalid saved balance when enabling stock, and clears a disabled draft', () => {
    const observed = observeInvoiceStock({ track_stock: false, stock: -1 });
    const review = setInvoiceStockTracking(observed, true);
    expect(evaluateInvoiceStock(review, 6)).toEqual({ error: 'business:ocr_stock_replace_invalid_balance' });
    const replacement = { ...review, mode: 'replace', quantity: '0' } as const;
    expect(evaluateInvoiceStock(replacement, 6)).toMatchObject({ projectedBalance: 0 });
    expect(setInvoiceStockTracking(replacement, false)).toEqual(observed);
  });

  it('serializes explicit tracking and stock intent at row level, alongside the independent invoice quantity', () => {
    const review = { ...setInvoiceStockTracking(observeInvoiceStock(), true), quantity: '1.25' };
    expect(invoiceConfirmationItem({ ...sourceRow(), stockReview: review }, 'business')).toMatchObject({
      kind: 'create',
      line: { quantity: 6 },
      track_stock: true,
      stock_action: { mode: 'add', quantity: 1.25 },
    });
    const tracked = { ...product, track_stock: true };
    const row = bindInvoiceRow(sourceRow(), tracked, ['cost_price'], 'business');
    expect(invoiceConfirmationItem(row, 'business')).toMatchObject({
      line: { quantity: 6 },
      stock_action: { mode: 'add', quantity: 6 },
    });
    expect(invoiceConfirmationItem({ ...row, stockReview: { ...observeInvoiceStock(tracked), mode: 'replace', quantity: '0' } }, 'business')).toMatchObject({
      kind: 'manual_match',
      expected_version: 3,
      line: { quantity: 6 },
      changes: { cost_price: 900 },
      stock_action: { mode: 'replace', quantity: 0 },
    });
    const disabled = invoiceConfirmationItem({ ...row, stockReview: setInvoiceStockTracking(observeInvoiceStock(tracked), false) }, 'business');
    expect(disabled).toHaveProperty('track_stock', false);
    expect(disabled).not.toHaveProperty('stock_action');
  });

  it('requires an explicit catalog or stock change and supports stock-only manual binding', () => {
    const row = bindInvoiceRow(sourceRow(), { ...product, track_stock: true }, [], 'business');
    expect(() => invoiceConfirmationItem({
      ...row,
      stockReview: { ...observeInvoiceStock({ ...product, track_stock: true }), quantity: '' },
    }, 'business')).toThrow('business:ocr_stock_manual_change_required');
    const stockReview = { ...observeInvoiceStock({ ...product, track_stock: true }), quantity: '2' };
    expect(invoiceConfirmationItem({ ...row, stockReview }, 'business')).toMatchObject({
      kind: 'manual_match',
      product_id: product.id,
      changes: {},
      stock_action: { mode: 'add', quantity: 2 },
    });
  });

  it('resets stock when binding a different product and recalculates an accepted revision using the same explicit intent', () => {
    const tracked = { ...product, track_stock: true };
    const row = {
      ...bindInvoiceRow(sourceRow(), tracked, ['cost_price'], 'business'),
      stockReview: { ...observeInvoiceStock(tracked), quantity: '2' },
    };
    const latest = updateInvoiceProductRevision(row, { ...tracked, stock: 78.5, version: 4 }, 'business');
    expect(latest.stockReview).toMatchObject({ quantity: '2', observedBalance: 78.5 });
    expect(evaluateInvoiceStock(latest.stockReview, latest.quantity)).toMatchObject({ projectedBalance: 80.5 });
    const cleared = updateInvoiceProductRevision(
      { ...row, stockReview: { ...row.stockReview, quantity: '' } },
      { ...tracked, stock: 78.5, version: 4 },
      'business',
    );
    expect(evaluateInvoiceStock(cleared.stockReview, cleared.quantity)).toEqual({});
    const different = bindInvoiceRow(row, { ...tracked, id: '13', stock: 1 }, ['cost_price'], 'business');
    expect(evaluateInvoiceStock(different.stockReview, different.quantity)).toMatchObject({
      action: { mode: 'add', quantity: 6 },
      projectedBalance: 7,
    });
    const noTracking = updateInvoiceProductRevision(row, { ...tracked, track_stock: false, version: 5 }, 'business');
    expect(invoiceConfirmationItem(noTracking, 'business')).not.toHaveProperty('stock_action');
    expect(invoiceConfirmationItem(noTracking, 'business')).not.toHaveProperty('track_stock');
  });
});

describe('Manual invoice product binding', () => {
  it('prepares only checked fields by ID/version, retaining manual sale and original invoice identity', () => {
    const row = bindInvoiceRow(sourceRow(), product, ['code', 'cost_price', 'cost_price_tax'], 'business');
    expect(row).toMatchObject({ id: '12', version: 3, code: 'INV-9', name: 'Manual product', alias: 'Manual alias', sale_price: 990, quantity: 6, invoice_code: 'INV-9' });
    expect(invoiceConfirmationItem(row, 'business')).toEqual({
      kind: 'manual_match', product_id: '12', expected_version: 3,
      line: { alias: 'Manual alias', alias_reviewed: true, name: 'Manual product', cost_price: 900, quantity: 6, invoice_code: 'INV-9' },
      changes: { code: 'INV-9', cost_price: 900, cost_price_tax: 1071 },
    });
    expect(product).toMatchObject({ barcode: '000123', has_stock: false, stock: 77, offer_price: 950, provider_id: 'old-provider' });
  });
  it('preserves a nullable catalog code and updates a sale price only when explicitly selected', () => {
    const row = bindInvoiceRow({ ...sourceRow(), sale_price: 1020 }, product, ['sale_price'], 'business');
    expect(row.code).toBe(''); expect(row.invoice_code).toBe('INV-9');
    expect(invoiceConfirmationItem(row, 'business')).toMatchObject({ product_id: '12', expected_version: 3, changes: { sale_price: 1020 } });
  });
  it('rejects missing version, foreign business, invalid money and unassigned sale', () => {
    for (const candidate of [{ ...product, version: undefined }, { ...product, business_id: 'other' }, { ...product, cost_price: Number.NaN }, { ...product, sale_price: 2147483648 }]) {
      expect(canBindInvoiceProduct(candidate, 'business')).toBe(false);
      expect(() => bindInvoiceRow(sourceRow(), candidate, ['code'], 'business')).toThrow();
    }
    expect(() => bindInvoiceRow({ ...sourceRow(), sale_price: Number.NaN }, product, ['sale_price'], 'business')).toThrow();
  });
  it('refuses a changed target, version or business at payload creation', () => {
    const row = bindInvoiceRow(sourceRow(), product, ['code'], 'business');
    expect(() => invoiceConfirmationItem({ ...row, id: '13' }, 'business')).toThrow();
    expect(() => invoiceConfirmationItem({ ...row, version: 4 }, 'business')).toThrow();
    expect(() => invoiceConfirmationItem(row, 'other')).toThrow();
  });
  it('blocks two invoice rows from updating the same product even if their codes differ', () => {
    const first = bindInvoiceRow(sourceRow(), product, ['code'], 'business');
    const second = bindInvoiceRow({ ...sourceRow(), code: 'ANOTHER' }, product, ['code'], 'business');
    const rows = validateInvoiceRows([first, second]);
    expect(rows.every(row => !row.isValid && row.errors.some(error => error.includes('dos veces')))).toBe(true);
    expect(validateInvoiceRows(rows.slice(0, 1))[0].isValid).toBe(true);
  });
  it('defaults sale to a rounded 30 percent markup, preserves explicit zero and rejects fractional CLP', () => {
    const row = sourceRow(); expect(row.sale_price).toBe(1390);
    expect(invoiceConfirmationItem(row, 'business')).toMatchObject({ product: { sale_price: 1390 } });
    expect(invoiceConfirmationItem({ ...row, sale_price: 0 }, 'business')).toMatchObject({ product: { sale_price: 0 } });
    expect(() => invoiceConfirmationItem({ ...row, sale_price: 990.5 }, 'business')).toThrow();
  });
});


describe('Editable OCR aliases', () => {
  it('defaults alias to the normalized extracted name, ignoring a provider-supplied alias', () => {
    const [row] = mapExtractedItemsToRows([{ code: 'NEW', name: '  Abbreviated invoice label  ', alias: 'Do not trust OCR alias', quantity: 0, cost_price: 0, cost_price_tax: 0 }], []);
    expect(row).toMatchObject({ name: 'Abbreviated invoice label', alias: 'Abbreviated invoice label', alias_reviewed: true });
    expect(invoiceAliasNeedsReview(row)).toBe(false);
    const reviewed = reviewInvoiceAlias(row, '  Commercial label  ');
    expect(reviewed).toMatchObject({ name: row.name, alias: 'Commercial label', alias_reviewed: true, quantity: 0 });
    expect(invoiceAliasNeedsReview(reviewed)).toBe(false);
    expect(row.alias).toBe('Abbreviated invoice label');
    expect(() => reviewInvoiceAlias(row, ' ')).toThrow();
    expect(() => reviewInvoiceAlias(row, 'x'.repeat(256))).toThrow();
  });
  it('accepts 255 Unicode codepoints and rejects 256 consistently for reviewed, automatic and manual aliases', () => {
    const alias = '🙂'.repeat(255);
    const reviewed = reviewInvoiceAlias(sourceRow(), alias);
    expect(reviewed.alias).toBe(alias);
    expect(invoiceAliasNeedsReview(reviewed)).toBe(false);
    expect(() => reviewInvoiceAlias(sourceRow(), '🙂'.repeat(256))).toThrow();
    const [automatic] = mapExtractedItemsToRows([{ code: 'SUP', name: 'Original', quantity: 1, cost_price: 0, cost_price_tax: 0 }], [{ ...product, code: 'SUP', alias }]);
    expect(automatic.alias_reviewed).toBe(true);
    expect(bindInvoiceRow(sourceRow(), { ...product, alias }, ['code'], 'business').alias_reviewed).toBe(true);
    expect(bindInvoiceRow(sourceRow(), { ...product, alias: '🙂'.repeat(256) }, ['code'], 'business').alias_reviewed).toBe(false);
  });
  it('preserves an existing alias in automatic and manual matches unless alias is explicitly selected', () => {
    const [row] = mapExtractedItemsToRows([{ code: 'SUP', name: 'Invoice original', quantity: 1, cost_price: 1, cost_price_tax: 2 }], [{ ...product, code: 'SUP' }]);
    expect(row).toMatchObject({ alias: 'Manual alias', alias_reviewed: true, name: 'Invoice original' });
    const prepared = reviewInvoiceAlias(sourceRow(), 'Fresh human alias');
    expect(bindInvoiceRow(prepared, product, ['code'], 'business').alias).toBe('Manual alias');
    const explicit = bindInvoiceRow(prepared, product, ['code', 'alias'], 'business');
    expect(invoiceConfirmationItem(explicit, 'business')).toMatchObject({ product_id: product.id, expected_version: product.version, changes: { code: 'INV-9', alias: 'Fresh human alias' } });
  });
  it('allows binding a missing-alias target, then requires explicit review and includes its exact version in the update', () => {
    const row = bindInvoiceRow(sourceRow(), { ...product, alias: null }, ['cost_price'], 'business');
    expect(row).toMatchObject({ id: product.id, alias: null, alias_reviewed: false, isValid: false });
    expect(() => invoiceConfirmationItem(row, 'business')).toThrow();
    const reviewed = reviewInvoiceAlias(row, 'Original name chosen by user');
    expect(invoiceConfirmationItem(reviewed, 'business')).toMatchObject({ product_id: product.id, expected_version: product.version, changes: { cost_price: 900, alias: 'Original name chosen by user' } });
  });
  it('rejects every invalid command before a caller can start saving an invoice, preserving aliases when duplicate rows are removed', () => {
    const first = { ...reviewInvoiceAlias(sourceRow(), 'Reviewed'), sale_price: 0, has_stock: false };
    const duplicate = { ...first };
    expect(() => prepareInvoiceConfirmation([first, duplicate], 'business', invoice)).toThrow();
    expect(prepareInvoiceConfirmation([first], 'business', invoice).items[0]).toMatchObject({ product: { name: first.name, alias: 'Reviewed', sale_price: 0 } });
    const stale = { ...first, code: 'OTHER', id: '12', version: undefined };
    expect(() => prepareInvoiceConfirmation([first, stale], 'business', invoice)).toThrow();
    expect(first.alias).toBe('Reviewed');
  });
});

// Defaults are local assistance, not fabricated OCR amounts.
describe('OCR default boundaries', () => {
  it('applies 30 percent over extracted gross cost for automatic catalog matches while preserving alias and availability', () => {
    const [row] = mapExtractedItemsToRows([{ code: 'SUP', name: 'Invoice name', quantity: 1, cost_price: 100, cost_price_tax: 119 }], [{ ...product, code: 'SUP' }]);
    expect(row).toMatchObject({ alias: 'Manual alias', alias_reviewed: true, stockReview: { tracking: false }, sale_price: 150 });
    const payload = invoiceConfirmationItem(row, 'business');
    expect(payload).toMatchObject({ product_id: product.id, product: { sale_price: 150, alias: 'Manual alias' } });
    expect(payload).not.toHaveProperty('product.has_stock');
  });
  it('leaves missing, nonfinite and overflowing costs invalid without assigning a sale price', () => {
    for (const gross of [undefined, null, Number.NaN, Infinity, -1, 2147483647]) {
      const [row] = mapExtractedItemsToRows([{ code: 'NEW', name: 'New', quantity: 1, cost_price: null, cost_price_tax: gross }], []);
      expect(row.isValid).toBe(false);
      expect(Number.isFinite(row.sale_price)).toBe(false);
      expect(() => invoiceConfirmationItem(row, 'business')).toThrow();
    }
  });
  it('requires repair for blank or overlong generated aliases without truncating the name', () => {
    for (const name of [' ', '🙂'.repeat(256)]) {
      const [row] = mapExtractedItemsToRows([{ code: 'NEW', name, quantity: 1, cost_price: 0, cost_price_tax: 0 }], []);
      expect(row.name).toBe(name.trim());
      expect(invoiceAliasNeedsReview(row)).toBe(true);
      expect(row.isValid).toBe(false);
    }
  });
});

describe('Local OCR sale price changes', () => {
  it.each([1547, 2147483647])('keeps an unselected catalog sale %s intact when editing only costs', sale_price => {
    const row = bindInvoiceRow(sourceRow(), { ...product, sale_price }, ['cost_price'], 'business');
    const edited = { cost_price: 901 };
    const intent = invoiceRowEditPrice(row, edited);
    const updated = { ...row, ...edited, ...intent };
    expect(intent).toMatchObject({ sale_price, manual_match: { fields: ['cost_price'] } });
    expect(validateInvoiceRows([updated])[0].isValid).toBe(true);
    expect(invoiceConfirmationItem(updated, 'business')).toMatchObject({ product_id: product.id, expected_version: product.version, changes: { cost_price: 901 } });
    expect(row.sale_price).toBe(sale_price);
    expect(row.manual_match?.fields).toEqual(['cost_price']);
  });
  it('rounds an explicitly edited sale and includes that exact field in the reviewed payload', () => {
    const row = bindInvoiceRow(sourceRow(), { ...product, sale_price: 1547 }, ['cost_price'], 'business');
    const edited = { ...row, sale_price: 1445 };
    const intent = invoiceRowEditPrice(row, edited);
    const updated = { ...edited, ...intent };
    expect(intent).toMatchObject({ sale_price: 1450, manual_match: { fields: ['cost_price', 'sale_price'] } });
    expect(invoiceConfirmationItem(updated, 'business')).toMatchObject({ product_id: product.id, expected_version: product.version, changes: { cost_price: 900, sale_price: 1450 } });
    expect(edited.sale_price).toBe(1445);
    expect(row.sale_price).toBe(1547);
    expect(row.manual_match?.fields).toEqual(['cost_price']);
  });
  it('replaces the editable price, recomputes comparison and preserves catalog identity and availability', () => {
    const row = bindInvoiceRow(sourceRow(), product, ['cost_price'], 'business');
    const changed = reviewInvoiceSalePrice(row, 1200);
    expect(changed).toMatchObject({ id: product.id, version: product.version, sale_price: 1200, stockReview: { tracking: false }, alias: product.alias, quantity: 6, priceDiff: { diff: 210, percent: 21, isIncrease: true } });
    expect(invoiceConfirmationItem(changed, 'business')).toMatchObject({ product_id: product.id, expected_version: product.version, changes: { cost_price: 900, sale_price: 1200 } });
    expect(row.sale_price).toBe(990);
  });
  it('preserves a real zero and rejects blank-equivalent nonfinite, negative, fractional and overflowing prices', () => {
    const row = sourceRow();
    expect(reviewInvoiceSalePrice(row, 0).sale_price).toBe(0);
    for (const price of [Number.NaN, Infinity, -1, 0.1, 2147483648]) {
      expect(() => reviewInvoiceSalePrice(row, price)).toThrow();
    }
    expect(row.sale_price).toBe(1390);
  });
});

describe('Compound OCR confirmation', () => {
  it('keeps the order of interleaved rows, the extracted code, and the reviewed product revision', () => {
    const created = { ...sourceRow(), code: ' CREATED ', invoice_code: '', quantity: 1.25 };
    const [automatic] = mapExtractedItemsToRows([{ code: 'AUTO', name: ' Imported ', quantity: 4, cost_price: 110, cost_price_tax: 131 }], [{ ...product, id: '31', code: 'AUTO', version: 8 }]);
    const manual = bindInvoiceRow(sourceRow(), product, ['cost_price'], 'business');
    const fields = prepareInvoiceConfirmation([manual, created, automatic], 'business', invoice);
    expect(fields.invoice).toEqual({ provider_id: '9', code: 'Folio', total_amount: 119 });
    expect(fields.items.map((item) => item.kind)).toEqual(['manual_match', 'create', 'update']);
    expect(fields.items[1]).toMatchObject({ line: { invoice_code: null, quantity: 1.25 }, product: { code: 'CREATED' } });
    expect(fields.items[2]).toMatchObject({
      product_id: '31', expected_version: 8,
      line: { name: 'Imported', alias: 'Manual alias', cost_price: 110 },
      product: { name: 'Imported', alias: 'Manual alias', cost_price: 110 },
    });
  });

  it('requires a real civil date and positive CLP when linked, and preserves a valid leap-day date', () => {
    for (const draft of [
      { ...invoice, total: -1 }, { ...invoice, total: 119.1 }, { ...invoice, total: 2147483648 },
      { ...invoice, issueDate: '2026-02-29' }, { ...invoice, issueDate: '2026-11-17T00:00:00Z' },
      { ...invoice, categoryId: '3' }, { ...invoice, categoryId: '3', issueDate: '2024-02-29', total: 0 },
    ]) {
      expect(() => prepareInvoiceConfirmation([sourceRow()], 'business', draft)).toThrow();
    }
    expect(prepareInvoiceConfirmation([sourceRow()], 'business', {
      ...invoice, categoryId: '3', issueDate: '2024-02-29',
    }).invoice).toMatchObject({ cash_category_id: '3', issue_date: '2024-02-29' });
  });

  it('enforces 1–500 items, normalized submitted codes, and unique target identities', () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({ ...sourceRow(), code: `NEW-${index}` }));
    expect(prepareInvoiceConfirmation(rows, 'business', invoice).items).toHaveLength(500);
    expect(() => prepareInvoiceConfirmation([], 'business', invoice)).toThrow();
    expect(() => prepareInvoiceConfirmation([...rows, sourceRow()], 'business', invoice)).toThrow();
    expect(() => prepareInvoiceConfirmation([rows[0], { ...rows[0], code: ' new-0 ' }], 'business', invoice)).toThrow();
    const manual = bindInvoiceRow(sourceRow(), product, ['cost_price'], 'business');
    expect(() => prepareInvoiceConfirmation([manual, manual], 'business', invoice)).toThrow();
  });

  it('reconciles a latest manual target only on explicit acceptance and retains reviewed edits', () => {
    const row = bindInvoiceRow(sourceRow(), product, ['cost_price'], 'business');
    const refreshed = updateInvoiceProductRevision(row, { ...product, version: 10, name: 'Latest product', alias: 'Latest alias', cost_price: 700 }, 'business');
    expect(row.version).toBe(3);
    expect(invoiceConfirmationItem(refreshed, 'business')).toMatchObject({
      expected_version: 10,
      changes: { cost_price: 900 },
      line: { name: 'Latest product', alias: 'Latest alias', invoice_code: 'INV-9', cost_price: 900 },
    });
  });
});
