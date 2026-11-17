import { describe, expect, it } from 'vitest';
import { normalizeCatalogSalePrice, roundProductSalePrice } from './product-sale-price.js';

describe('product selling price rounding', () => {
  it.each([[1444, 1440], [1445, 1450], [1449, 1450], [1450, 1450], [0, 0], [4, 0], [5, 10], [2147483644, 2147483640]])('rounds %i to %i without changing the monetary domain', (input, expected) => {
    expect(roundProductSalePrice(input)).toBe(expected);
  });
  it.each([2147483645, 2147483647, -1, 0.5, Number.NaN, Infinity, '1445', null, undefined])('rejects invalid or overflowing persisted price %j', value => {
    expect(() => roundProductSalePrice(value)).toThrow('product:invalid_price');
  });
  it('does not mutate input, cost or offer and preserves an omitted PATCH price', () => {
    const input = { sale_price: 1445, cost_price: 1445, cost_price_tax: 1719, offer_price: 1234 };
    expect(normalizeCatalogSalePrice(input)).toEqual({ ...input, sale_price: 1450 });
    expect(input.sale_price).toBe(1445);
    expect(normalizeCatalogSalePrice({ cost_price: 1445 })).toEqual({ cost_price: 1445 });
  });
});
