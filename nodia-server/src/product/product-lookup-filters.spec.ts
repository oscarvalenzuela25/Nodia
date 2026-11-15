import { describe, expect, it } from 'vitest';
import type { SelectQueryBuilder } from 'typeorm';
import type { Product } from './entities/product.entity.js';
import { applyProductLookupFilters } from './product-lookup-filters.js';
import { FilterProductDto } from './dto/filter-product.dto.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

function fixture() {
  const clauses: { sql: string; params?: object }[] = [];
  const qb = { andWhere(sql: string, params?: object) { clauses.push({ sql, params }); return qb; } };
  return { clauses, qb: qb as Pick<SelectQueryBuilder<Product>, 'andWhere'> };
}
describe('product alias/name lookup and independent code completeness', () => {
  it('binds a literal search once across the two columns, escaping wildcard characters', () => {
    const f = fixture();
    applyProductLookupFilters(f.qb, { search: '  Café_%\\  ' });
    expect(f.clauses[0].sql).toContain('product.name ILIKE :productSearch OR product.alias ILIKE :productSearch');
    expect(f.clauses[0].params).toEqual({ productSearch: '%Café\\_\\%\\\\%' });
    expect(f.clauses[0].sql).not.toContain('Café');
  });
  it('leaves an empty search and omitted presence unfiltered; rejects invalid internal inputs too', () => {
    const f = fixture();
    applyProductLookupFilters(f.qb, { search: ' \t ' });
    expect(f.clauses).toHaveLength(0);
    for (const search of [[], false, null, 'x'.repeat(256)])
      expect(() => applyProductLookupFilters(f.qb, { search })).toThrow('product:invalid_search');
    for (const code_presence of ['all', 'true', false, []])
      expect(() => applyProductLookupFilters(f.qb, { code_presence })).toThrow('product:invalid_code_presence');
  });
  it('validates the HTTP query contract without coercing malformed arrays or booleans', async () => {
    expect(await validate(plainToInstance(FilterProductDto, { search: 'Alias', code_presence: 'missing', barcode_presence: 'present' }))).toHaveLength(0);
    const invalid = await validate(plainToInstance(FilterProductDto, { search: ['Alias'], code_presence: true, barcode_presence: 'all' }));
    expect(new Set(invalid.map(error => error.property))).toEqual(new Set(['search', 'code_presence', 'barcode_presence']));
  });
});
