import { describe, expect, it } from 'vitest';
import { bindInvoiceRow, canBindInvoiceProduct, invoiceProductPayload, mapExtractedItemsToRows, validateInvoiceRows, reviewInvoiceAlias, invoiceAliasNeedsReview, prepareInvoiceProductPayloads } from '../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/helpers';
import type { ProductEntity } from '../../../../../../../../../modules/business/infrastructure/types';

describe('Purchase invoice versus POS catalog', () => {
  it('retains invoice quantity without assigning inventory, availability, barcode or alternative price', () => {
    const existing = { id: '12', code: 'SUP', name: 'Existing', alias: 'Existing alias', sale_price: 10, cost_price: 5, cost_price_tax: 6,
      stock: 999, has_stock: false, barcode: '00012', offer_price: 150,
      is_offer_enabled: true, version: 4, is_active: false } as ProductEntity;
    const [row] = mapExtractedItemsToRows([{ code: 'SUP', name: 'New label', quantity: 7, cost_price: 8, cost_price_tax: 9 }], [existing]);
    expect(row).toMatchObject({ quantity: 7, has_stock: false, version: 4, is_active: false });
    expect(row.stock).toBeUndefined();
    const update = invoiceProductPayload(row, 'business', 'supplier');
    expect(update).toMatchObject({ id: '12', expected_version: 4, is_active: false });
    for (const field of ['stock','quantity','has_stock','barcode','offer_price','is_offer_enabled']) expect(update).not.toHaveProperty(field);
  });
  it('requires a manual availability choice for a new item even when purchase quantity is positive or zero', () => {
    const [row] = mapExtractedItemsToRows([{ code: 'NEW', name: 'New', quantity: 0, cost_price: 0, cost_price_tax: 0 }], []);
    expect(row.quantity).toBe(0);
    expect(row.has_stock).toBeUndefined();
    expect(() => invoiceProductPayload({ ...row, sale_price: 0 }, 'business', null)).toThrow();
    expect(invoiceProductPayload({ ...reviewInvoiceAlias(row, 'New alias'), has_stock: false, sale_price: 0 }, 'business', null)).toMatchObject({ has_stock: false });
  });
});

// Synthetic catalog and invoice: no provider calls or personal data.
const product: ProductEntity = { id: '12', business_id: 'business', provider_id: 'old-provider', code: null, name: 'Manual product', alias: 'Manual alias',
  cost_price: 800, cost_price_tax: 952, sale_price: 990, stock: 77, has_stock: false, version: 3, is_active: true,
  barcode: '000123', offer_price: 950, is_offer_enabled: true, measurement_unit: 'kg' };
const sourceRow = () => mapExtractedItemsToRows([{ code: 'INV-9', name: 'Invoice label', quantity: 6, cost_price: 900, cost_price_tax: 1071 }], [])[0];

describe('Manual invoice product binding', () => {
  it('prepares only checked fields by ID/version, retaining manual sale and original invoice identity', () => {
    const row = bindInvoiceRow(sourceRow(), product, ['code', 'cost_price', 'cost_price_tax'], 'business');
    expect(row).toMatchObject({ id: '12', version: 3, code: 'INV-9', name: 'Manual product', alias: 'Manual alias', sale_price: 990, quantity: 6, invoice_code: 'INV-9' });
    expect(invoiceProductPayload(row, 'business', 'new-provider')).toEqual({ id: '12', expected_version: 3, code: 'INV-9', cost_price: 900, cost_price_tax: 1071 });
    expect(product).toMatchObject({ barcode: '000123', has_stock: false, stock: 77, offer_price: 950, provider_id: 'old-provider' });
  });
  it('preserves a nullable catalog code and updates a sale price only when explicitly selected', () => {
    const row = bindInvoiceRow({ ...sourceRow(), sale_price: 1020 }, product, ['sale_price'], 'business');
    expect(row.code).toBe(''); expect(row.invoice_code).toBe('INV-9');
    expect(invoiceProductPayload(row, 'business', null)).toEqual({ id: '12', expected_version: 3, sale_price: 1020 });
  });
  it('rejects missing version, foreign business, invalid money, empty choices and unassigned sale', () => {
    for (const candidate of [{ ...product, version: undefined }, { ...product, business_id: 'other' }, { ...product, cost_price: Number.NaN }, { ...product, sale_price: 2147483648 }]) {
      expect(canBindInvoiceProduct(candidate, 'business')).toBe(false);
      expect(() => bindInvoiceRow(sourceRow(), candidate, ['code'], 'business')).toThrow();
    }
    expect(() => bindInvoiceRow(sourceRow(), product, [], 'business')).toThrow();
    expect(() => bindInvoiceRow(sourceRow(), product, ['sale_price'], 'business')).toThrow();
  });
  it('refuses a changed target, version or business at payload creation', () => {
    const row = bindInvoiceRow(sourceRow(), product, ['code'], 'business');
    expect(() => invoiceProductPayload({ ...row, id: '13' }, 'business', null)).toThrow();
    expect(() => invoiceProductPayload({ ...row, version: 4 }, 'business', null)).toThrow();
    expect(() => invoiceProductPayload(row, 'other', null)).toThrow();
  });
  it('blocks two invoice rows from updating the same product even if their codes differ', () => {
    const first = bindInvoiceRow(sourceRow(), product, ['code'], 'business');
    const second = bindInvoiceRow({ ...sourceRow(), code: 'ANOTHER' }, product, ['code'], 'business');
    const rows = validateInvoiceRows([first, second]);
    expect(rows.every(row => !row.isValid && row.errors.some(error => error.includes('dos veces')))).toBe(true);
    expect(validateInvoiceRows(rows.slice(0, 1))[0].isValid).toBe(true);
  });
  it('requires a manually assigned new sale, preserves zero, and rejects fractional CLP', () => {
    const row = sourceRow(); expect(row.sale_price).toBeNaN();
    expect(() => invoiceProductPayload({ ...row, has_stock: true }, 'business', null)).toThrow();
    expect(invoiceProductPayload({ ...reviewInvoiceAlias(row, 'Reviewed alias'), sale_price: 0, has_stock: false }, 'business', null)).toMatchObject({ sale_price: 0, has_stock: false });
    expect(() => invoiceProductPayload({ ...row, sale_price: 990.5, has_stock: false }, 'business', null)).toThrow();
  });
});


describe('Human-reviewed OCR aliases', () => {
  it('ignores a provider-supplied alias and preserves the extracted name until a human reviews a new row', () => {
    const [row] = mapExtractedItemsToRows([{ code: 'NEW', name: 'Abbreviated invoice label', alias: 'Do not trust OCR alias', quantity: 0, cost_price: 0, cost_price_tax: 0 }], []);
    expect(row).toMatchObject({ name: 'Abbreviated invoice label', alias: null, alias_reviewed: false });
    expect(invoiceAliasNeedsReview(row)).toBe(true);
    const reviewed = reviewInvoiceAlias(row, '  Commercial label  ');
    expect(reviewed).toMatchObject({ name: row.name, alias: 'Commercial label', alias_reviewed: true, quantity: 0 });
    expect(invoiceAliasNeedsReview(reviewed)).toBe(false);
    expect(row.alias).toBeNull();
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
    expect(invoiceProductPayload(explicit, 'business', null)).toEqual({ id: product.id, expected_version: product.version, code: 'INV-9', alias: 'Fresh human alias' });
  });
  it('allows binding a missing-alias target, then requires explicit review and includes its exact version in the update', () => {
    const row = bindInvoiceRow(sourceRow(), { ...product, alias: null }, ['cost_price'], 'business');
    expect(row).toMatchObject({ id: product.id, alias: null, alias_reviewed: false, isValid: false });
    expect(() => invoiceProductPayload(row, 'business', null)).toThrow();
    const reviewed = reviewInvoiceAlias(row, 'Original name chosen by user');
    expect(invoiceProductPayload(reviewed, 'business', null)).toEqual({ id: product.id, expected_version: product.version, cost_price: 900, alias: 'Original name chosen by user' });
  });
  it('rejects every invalid command before a caller can start saving an invoice, preserving aliases when duplicate rows are removed', () => {
    const first = { ...reviewInvoiceAlias(sourceRow(), 'Reviewed'), sale_price: 0, has_stock: false };
    const duplicate = { ...first };
    expect(() => prepareInvoiceProductPayloads([first, duplicate], 'business', null)).toThrow();
    expect(prepareInvoiceProductPayloads([first], 'business', null).newItems[0]).toMatchObject({ name: first.name, alias: 'Reviewed', sale_price: 0 });
    const stale = { ...first, code: 'OTHER', id: '12', version: undefined };
    expect(() => prepareInvoiceProductPayloads([first, stale], 'business', null)).toThrow();
    expect(first.alias).toBe('Reviewed');
  });
});
