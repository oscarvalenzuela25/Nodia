import { describe, expect, it } from 'vitest';
import { parseCSV, productImportPayload, exportProductsToCSV, validateRow } from '../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductBulkImport/helpers';
import type { ProductEntity } from '../../../../../../../../../modules/business/infrastructure/types';

describe('Product CSV catalog contract', () => {
  it.each([[255, true], [256, false]] as const)('counts %i astral supplier-code characters by Unicode code point', (length, valid) => {
    const code = '🧾'.repeat(length);
    const [row] = parseCSV(`code,name,cost_price,cost_price_tax,sale_price,has_stock\n ${code} ,Synthetic,0,0,1,true`);
    expect(row.code).toBe(code);
    expect(row.isValid).toBe(valid);
    if (valid) expect(productImportPayload(row, 'business')).toMatchObject({ code });
    else expect(() => productImportPayload(row, 'business')).toThrow();
  });
  it('does not translate legacy quantity into availability and preserves omitted POS fields on updates', () => {
    const header = 'id,code,name,cost_price,cost_price_tax,sale_price,stock';
    const [existing] = parseCSV(`${header}\n12,SUP,Existing,10,12,15,1000`);
    expect(existing.isValid).toBe(true);
    const update = productImportPayload(existing, 'business');
    expect(update).toMatchObject({ id: '12', sale_price: 15 });
    for (const field of ['stock','has_stock','barcode','offer_price','is_offer_enabled']) expect(update).not.toHaveProperty(field);
    const [fresh] = parseCSV(`${header}\n,SUP,New,10,12,15,1000`);
    expect(fresh.isValid).toBe(false);
    expect(fresh.has_stock).toBeUndefined();
    expect(() => productImportPayload(fresh, 'business')).toThrow();
    const [availableFresh] = parseCSV('code,name,cost_price,cost_price_tax,sale_price,has_stock\nSUP,New,10,12,15,true');
    expect(availableFresh.isValid).toBe(true);
    const create = productImportPayload(availableFresh, 'business');
    expect(create).toMatchObject({ code: 'SUP', has_stock: true });
    expect(create).not.toHaveProperty('barcode');
  });
  it('keeps quoted names and textual barcodes; false and a higher alternative are explicit values', () => {
    const [row] = parseCSV('code,name,cost_price,cost_price_tax,sale_price,barcode,offer_price,is_offer_enabled,has_stock\nSUP,"Name, with ""quotes""",0,0,100,00000123,150,true,false');
    expect(row).toMatchObject({ name: 'Name, with "quotes"', barcode: '00000123', offer_price: 150, is_offer_enabled: true, has_stock: false, isValid: true });
    expect(productImportPayload(row, 'business')).toMatchObject({ has_stock: false, barcode: '00000123', offer_price: 150 });
  });
  it('rejects malformed booleans and empty money without replacing them with valid defaults', () => {
    const [row] = parseCSV('code,name,cost_price,cost_price_tax,sale_price,has_stock,is_offer_enabled\nSUP,New,,0,1,false,0');
    expect(row.isValid).toBe(false);
    expect(Number.isNaN(row.cost_price)).toBe(true);
    expect(row.is_offer_enabled).toBeUndefined();
    expect(row.invalid_fields).toContain('is_offer_enabled');
  });
  it('round-trips the actual catalog identifiers, alternatives, availability and revision', () => {
    const product = { id: '12', code: 'SUP', barcode: '00001', name: 'Name, two', cost_price: 0,
      cost_price_tax: 0, sale_price: 100, offer_price: 150, is_offer_enabled: true,
      has_stock: false, is_active: true, version: 8 } as ProductEntity;
    const [row] = parseCSV(exportProductsToCSV([product], 'en'));
    expect(row).toMatchObject({ id: '12', barcode: '00001', offer_price: 150, is_offer_enabled: true, has_stock: false, version: 8, isValid: true });
    expect(productImportPayload(row, 'business')).toMatchObject({ id: '12', expected_version: 8 });
  });
  it('creates manual CSV rows without a code and defaults only new omitted measurements to units', () => {
    const [row] = parseCSV('name,cost_price,cost_price_tax,sale_price,has_stock\nSin código,10,12,15,true');
    expect(row.isValid).toBe(true);
    expect(productImportPayload(row, 'business')).toMatchObject({ code: null, measurement_unit: 'unit', name: 'Sin código' });
    const [update] = parseCSV('id,name,cost_price,cost_price_tax,sale_price\n12,Existing,10,12,15');
    const payload = productImportPayload(update, 'business');
    expect(payload).not.toHaveProperty('code');
    expect(payload).not.toHaveProperty('measurement_unit');
  });
  it('keeps an explicit empty code null and exact unit identifiers without fabricating identifiers', () => {
    const rows = parseCSV('code,name,cost_price,cost_price_tax,sale_price,has_stock,measurement_unit\n,Tomates,10,12,15,true,kg\n,Hierbas,10,12,15,true,bundle');
    expect(rows.map(row => productImportPayload(row, 'business'))).toEqual([
      expect.objectContaining({ code: null, measurement_unit: 'kg', name: 'Tomates' }),
      expect.objectContaining({ code: null, measurement_unit: 'bundle', name: 'Hierbas' }),
    ]);
  });
  it('rejects unknown measurement units and requires a revision to change an existing measurement', () => {
    const [unknown] = parseCSV('name,cost_price,cost_price_tax,sale_price,has_stock,measurement_unit\nTest,10,12,15,true,mg');
    expect(unknown.isValid).toBe(false);
    expect(() => productImportPayload(unknown, 'business')).toThrow();
    const [existing] = parseCSV('id,name,cost_price,cost_price_tax,sale_price,measurement_unit\n12,Test,10,12,15,kg');
    expect(existing.isValid).toBe(false);
    const revised = { ...existing, version: 7 };
    expect(validateRow(revised).isValid).toBe(true);
    expect(productImportPayload(revised, 'business')).toMatchObject({ id: '12', measurement_unit: 'kg', expected_version: 7 });
  });
  it('round-trips a product with no supplier code and a non-default measurement', () => {
    const product = { id: '12', code: null, name: 'Arroz', measurement_unit: 'kg', cost_price: 10,
      cost_price_tax: 12, sale_price: 15, has_stock: true, is_active: true, version: 8 } as ProductEntity;
    const [row] = parseCSV(exportProductsToCSV([product], 'es'));
    expect(row).toMatchObject({ id: '12', code: null, measurement_unit: 'kg', isValid: true });
    expect(productImportPayload(row, 'business')).toMatchObject({ id: '12', code: null, measurement_unit: 'kg', expected_version: 8 });
  });

});
