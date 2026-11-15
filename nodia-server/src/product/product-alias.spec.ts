import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { normalizeProductAlias } from './product-alias.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

describe('optional human product alias', () => {
  it('preserves omission, separates null from a supplied name, and trims blank Unicode whitespace', () => {
    expect(normalizeProductAlias(undefined)).toBeUndefined();
    expect(normalizeProductAlias(null)).toBeNull();
    expect(normalizeProductAlias(' \t\n\u00a0 ')).toBeNull();
    expect(normalizeProductAlias('  Café orgánico  ')).toBe('Café orgánico');
  });
  it('accepts the database character boundary without counting surrogate pairs twice', () => {
    expect(normalizeProductAlias('🫘'.repeat(255))).toBe('🫘'.repeat(255));
    expect(() => normalizeProductAlias('🫘'.repeat(256))).toThrow('product:invalid_alias');
    for (const value of [false, 0, [], {}, ['alias']]) expect(() => normalizeProductAlias(value)).toThrow('product:invalid_alias');
  });
  it('validates and transforms the public create/update surface without silently filling a name as alias', async () => {
    const input = { business_id: '11111111-1111-4111-8111-111111111111', name: 'INV/009A',
      cost_price: 1, cost_price_tax: 1, sale_price: 2, has_stock: true };
    const created = plainToInstance(CreateProductDto, input);
    expect(await validate(created)).toHaveLength(0);
    expect(created.alias).toBeUndefined();
    const update = plainToInstance(UpdateProductDto, { alias: ' \u00a0 ', expected_version: 2 });
    expect(await validate(update)).toHaveLength(0);
    expect(update.alias).toBeNull();
    const invalid = plainToInstance(UpdateProductDto, { alias: false });
    expect((await validate(invalid)).some(error => error.property === 'alias')).toBe(true);
  });
});
