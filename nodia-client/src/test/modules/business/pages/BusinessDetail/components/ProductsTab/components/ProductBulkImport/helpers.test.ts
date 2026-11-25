import { describe, expect, it } from 'vitest';
import { parseCSV, productImportPayload, validateRow } from '../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductBulkImport/helpers';

describe('Product CSV catalog contract', () => {
  it('preserves an omitted alias, clears an explicit blank and requires a version to change the alias', () => {
    const base = 'id,name,cost_price,cost_price_tax,sale_price';
    const [omitted] = parseCSV(`${base}\n12,Original,0,0,1`);
    expect(productImportPayload(omitted, 'business')).not.toHaveProperty('alias');
    const [blank] = parseCSV(`${base},alias,version\n12,Original,0,0,1,   ,4`);
    expect(productImportPayload(blank, 'business')).toMatchObject({ name: 'Original', alias: null, expected_version: 4 });
    const [custom] = parseCSV(`${base},alias\n12,Original,0,0,1,Commercial`);
    expect(custom.isValid).toBe(false);
    expect(productImportPayload({ ...custom, version: 4 }, 'business')).toMatchObject({ name: 'Original', alias: 'Commercial', expected_version: 4 });
  });
  it.each([[255, true], [256, false]] as const)('counts %i astral supplier-code characters by Unicode code point', (length, valid) => {
    const code = '🧾'.repeat(length);
    const [row] = parseCSV(`code,name,cost_price,cost_price_tax,sale_price,has_stock\n ${code} ,Synthetic,0,0,1,true`);
    expect(row.code).toBe(code);
    expect(row.isValid).toBe(valid);
    if (valid) expect(productImportPayload(row, 'business')).toMatchObject({ code });
    else expect(() => productImportPayload(row, 'business')).toThrow();
  });
  it('ignores legacy availability and stock while preserving omitted fields on updates', () => {
    const header = 'id,code,name,cost_price,cost_price_tax,sale_price,stock,has_stock';
    const [existing] = parseCSV(`${header}\n12,SUP,Existing,10,12,15,1000,true`);
    expect(existing.isValid).toBe(true);
    const update = productImportPayload(existing, 'business');
    expect(update).toMatchObject({ id: '12', sale_price: 20 });
    for (const field of ['stock', 'has_stock', 'track_stock', 'barcode', 'offer_price', 'is_offer_enabled']) expect(update).not.toHaveProperty(field);
    const [fresh] = parseCSV(`${header}\n,SUP,New,10,12,15,1000,true`);
    expect(fresh.isValid).toBe(true);
    const create = productImportPayload(fresh, 'business');
    expect(create).toMatchObject({ code: 'SUP', track_stock: false });
    expect(create).not.toHaveProperty('stock');
    expect(create).not.toHaveProperty('barcode');
  });
  it('keeps quoted names and textual barcodes; false and a higher alternative are explicit values', () => {
    const [row] = parseCSV('code,name,cost_price,cost_price_tax,sale_price,barcode,offer_price,is_offer_enabled,track_stock\nSUP,"Name, with ""quotes""",0,0,100,00000123,150,true,false');
    expect(row).toMatchObject({ name: 'Name, with "quotes"', barcode: '00000123', offer_price: 150, is_offer_enabled: true, track_stock: false, isValid: true });
    expect(productImportPayload(row, 'business')).toMatchObject({ track_stock: false, barcode: '00000123', offer_price: 150 });
  });
  it('rejects malformed booleans and empty money without replacing them with valid defaults', () => {
    const [row] = parseCSV('code,name,cost_price,cost_price_tax,sale_price,has_stock,is_offer_enabled\nSUP,New,,0,1,false,0');
    expect(row.isValid).toBe(false);
    expect(Number.isNaN(row.cost_price)).toBe(true);
    expect(row.is_offer_enabled).toBeUndefined();
    expect(row.invalid_fields).toContain('is_offer_enabled');
  });
  it('reads the native export format and writes exact stock against its observed revision', () => {
    const [row] = parseCSV('Code (code),Name (name),Base cost (cost_price),Tax-inclusive cost (cost_price_tax),Sale price (sale_price),Track stock (track_stock),Stock (stock),Active (is_active),ID (id),Barcode (barcode),Alternative price (offer_price),Alternative enabled (is_offer_enabled),Version (version),Measurement unit (measurement_unit),Alias (alias)\nSUP,"Name, two",0,0,100,true,0.125,true,12,00001,150,true,8,kg,');
    expect(row).toMatchObject({ id: '12', barcode: '00001', offer_price: 150, is_offer_enabled: true, track_stock: true, stock: 0.125, version: 8, isValid: true });
    expect(productImportPayload(row, 'business')).toMatchObject({ id: '12', expected_version: 8, track_stock: true, stock: 0.125 });
    expect(validateRow({ ...row, stock: 0 }).isValid).toBe(true);
    expect(validateRow({ ...row, stock: 0.0001 }).isValid).toBe(false);
    expect(validateRow({ ...row, version: undefined }).isValid).toBe(false);
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
  it('imports the Spanish export with no supplier code, no stock control and a non-default measurement', () => {
    const [row] = parseCSV('Código (code),Nombre (name),Costo base (cost_price),Costo con IVA (cost_price_tax),Precio de venta (sale_price),Usar stock (track_stock),Stock (stock),Activo (is_active),ID (id),Código de barras (barcode),Precio alternativo (offer_price),Alternativo habilitado (is_offer_enabled),Versión (version),Unidad de medida (measurement_unit),Alias (alias)\n,Arroz,10,12,15,false,,true,12,,,,8,kg,');
    expect(row).toMatchObject({ id: '12', code: null, measurement_unit: 'kg', isValid: true });
    expect(productImportPayload(row, 'business')).toMatchObject({ id: '12', code: null, measurement_unit: 'kg', expected_version: 8 });
  });

});
