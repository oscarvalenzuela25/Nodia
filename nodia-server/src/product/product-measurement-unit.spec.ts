import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateProductLogDto } from './dto/create-product-log.dto.js';
import { Product } from './entities/product.entity.js';
import { productSnapshot, validateCatalogProduct } from './product-catalog.js';
import {
  PRODUCT_MEASUREMENT_UNITS,
  isProductMeasurementUnit,
  normalizeProductCode,
  validateProductMeasurementUnit,
} from './product-measurement-unit.js';

describe('Product identifiers and measurement units', () => {
  it.each([undefined, null, '', '   ', '\t\n'])('represents absent supplier code as null: %j', (value) => {
    expect(normalizeProductCode(value)).toBeNull();
  });

  it('preserves actual codes and leading zeroes independently of the product ID', () => {
    expect(normalizeProductCode('  000123-ABC  ')).toBe('000123-ABC');
    expect(normalizeProductCode('0')).toBe('0');
    expect(normalizeProductCode('a'.repeat(255))).toHaveLength(255);
  });

  it.each([0, false, [], {}, 'a'.repeat(256)])('rejects a malformed supplier code: %j', (value) => {
    expect(() => normalizeProductCode(value)).toThrow('product:invalid_code');
  });

  it.each(['a', '😀'])('matches DTO character limits for BMP and astral supplier codes: %s', async (character) => {
    const base = { name: 'Product', cost_price: 0, cost_price_tax: 0,
      sale_price: 0, has_stock: true };
    const valid = character.repeat(255);
    const invalid = character.repeat(256);
    expect(normalizeProductCode(`  ${valid}  `)).toBe(valid);
    expect(() => normalizeProductCode(invalid)).toThrow('product:invalid_code');
    const validateCode = (code: string) => Promise.all([
      validate(plainToInstance(CreateProductDto, { ...base,
        business_id: '11111111-1111-4111-8111-111111111111', code })),
      validate(plainToInstance(CreateProductLogDto, { ...base, product_id: '1', code })),
    ]);
    for (const errors of await validateCode(`  ${valid}  `))
      expect(errors).toEqual([]);
    for (const errors of await validateCode(invalid))
      expect(errors.some((error) => error.property === 'code')).toBe(true);
  });

  it.each(PRODUCT_MEASUREMENT_UNITS)('accepts the explicit measurement unit %s', (unit) => {
    expect(isProductMeasurementUnit(unit)).toBe(true);
    expect(() => validateProductMeasurementUnit(unit)).not.toThrow();
  });

  it.each([null, undefined, '', 'mg', 'l', 'ml', 'm', 'KG', 'kilogram', 0, {}])('rejects unspecified or unsupported explicit unit %j', (unit) => {
    expect(isProductMeasurementUnit(unit)).toBe(false);
    expect(() => validateProductMeasurementUnit(unit)).toThrow('product:invalid_measurement_unit');
    if (unit !== undefined)
      expect(() => validateCatalogProduct({ measurement_unit: unit } as Partial<Product>)).toThrow('product:invalid_measurement_unit');
  });

  it('validates optional nullable code and units in the actual create DTO', async () => {
    const base = { business_id: '11111111-1111-4111-8111-111111111111', name: 'Product',
      cost_price: 0, cost_price_tax: 0, sale_price: 0, has_stock: true };
    for (const code of [undefined, null, '', '  ']) {
      const dto = plainToInstance(CreateProductDto, { ...base, code });
      expect(await validate(dto)).toEqual([]);
    }
    const dto = plainToInstance(CreateProductDto, { ...base, code: '  000123  ', measurement_unit: 'kg' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.code).toBe('000123');
    for (const measurement_unit of [null, 'mg', 'unknown'])
      expect((await validate(plainToInstance(CreateProductDto, { ...base, measurement_unit })))
        .some((error) => error.property === 'measurement_unit')).toBe(true);
    expect((await validate(plainToInstance(CreateProductDto, { ...base, code: 12 })))
      .some((error) => error.property === 'code')).toBe(true);
  });

  it('does not inject a unit or clear a code into partial updates', () => {
    const dto = plainToInstance(UpdateProductDto, { name: 'Renamed' });
    expect(dto).not.toHaveProperty('measurement_unit');
    expect(dto).not.toHaveProperty('code');
  });

  it('accepts a manual log without a supplier code and freezes its actual measurement', async () => {
    const dto = plainToInstance(CreateProductLogDto, { product_id: '1', name: 'Bulk rice',
      cost_price: 0, cost_price_tax: 0, sale_price: 10000, measurement_unit: 'kg' });
    expect(await validate(dto)).toEqual([]);
    const product = Object.assign(new Product(), dto, { id: '1', code: null, version: 3 });
    expect(productSnapshot(product, 'update', '9', ['measurement_unit']))
      .toMatchObject({ code: null, measurement_unit: 'kg', product_version: 3 });
  });
});
