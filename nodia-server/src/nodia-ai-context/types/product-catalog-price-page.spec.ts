import { describe, expect, it } from 'vitest';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { productCatalogPricePage } from './product-catalog-price-page.js';

describe('productCatalogPricePage', () => {
  const meta = { page: 2, limit: 3, total_items: 6, total_pages: 2 };

  it('keeps all rows, price values and pagination while removing unrelated product fields', () => {
    const offer = {
      name: 'Pan',
      measurement_unit: 'kg',
      sale_price: 900,
      effective_price: '600',
      price_source: 'offer',
    };
    const zero = {
      name: 'Muestra',
      measurement_unit: 'unit',
      sale_price: 0,
      effective_price: '0',
      price_source: 'regular',
    };
    const missing = { name: 'Harina', sale_price: 600, measurement_unit: 'kg' };
    const result = {
      data: [
        { ...offer, id: '1', stock: 10 },
        { ...zero, id: '2', stock: 5 },
        { ...missing, id: '3', effective_price: null, price_source: null },
      ],
      meta,
    };

    const projected = productCatalogPricePage(result);
    expect(projected).toEqual({
      data: [
        offer,
        zero,
        { ...missing, effective_price: null, price_source: null },
      ],
      meta,
    });
    expect(result.data[0]).toHaveProperty('stock', 10);
  });

  it('retains an empty page and optional field absence', () => {
    const empty = {
      data: [],
      meta: { ...meta, page: 1, total_items: 0, total_pages: 0 },
    };
    const row = { name: 'Harina', sale_price: 600, measurement_unit: 'kg' };
    expect(productCatalogPricePage(empty)).toEqual(empty);
    expect(
      productCatalogPricePage({ data: [{ ...row, id: '1' }], meta }),
    ).toStrictEqual({
      data: [row],
      meta,
    });
  });

  it.each<NodiaAiJsonObject>([
    { error: 'nodia_ai:unavailable' },
    { data: [] },
    { data: { name: 'Pan' }, meta },
    { data: [null], meta },
  ])('passes an error or non-page result through unchanged', (result) => {
    expect(productCatalogPricePage(result)).toBe(result);
  });
});
