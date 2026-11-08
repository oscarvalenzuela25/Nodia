import { describe, expect, it } from 'vitest';
import {
  exactSaleQuantityReport,
  roundedSaleLineTotal,
  saleQuantityThousandths,
  saleQuantityTransformer,
} from './sale-quantity.js';

describe('exact fractional sale quantities', () => {
  it.each([
    [0.001, 1n],
    [0.3, 300n],
    [1.001, 1001n],
    [2147483647, 2147483647000n],
  ] as const)('represents %s exactly in thousandths', (quantity, expected) => {
    expect(saleQuantityThousandths(quantity)).toBe(expected);
  });
  it.each([
    0,
    -1,
    0.0009,
    1.0001,
    2147483647.001,
    NaN,
    Infinity,
    '1.001',
    null,
    undefined,
  ])('rejects invalid persisted quantity %s', (quantity) => {
    expect(() => saleQuantityThousandths(quantity)).toThrow(
      'business:sale_invalid_command',
    );
  });
  it('rounds HALF_UP per line without losing precision above the JS integer boundary', () => {
    expect(roundedSaleLineTotal(1n, 0.499)).toBe(0n);
    expect(roundedSaleLineTotal(1n, 0.5)).toBe(1n);
    expect(roundedSaleLineTotal(1n, 1.5)).toBe(2n);
    expect(roundedSaleLineTotal(1499n, 0.001)).toBe(1n);
    expect(roundedSaleLineTotal(1500n, 0.001)).toBe(2n);
    expect(roundedSaleLineTotal(9007199254740993n, 0.001)).toBe(9007199254741n);
  });
  it('accepts exact driver decimals and rejects coercions or excessive scale', () => {
    expect(saleQuantityTransformer.from('1.250')).toBe(1.25);
    expect(saleQuantityTransformer.to(0.001)).toBe(0.001);
    for (const value of ['1.0001', '', '1e3', 'NaN', '2147483647.001'])
      expect(() => saleQuantityTransformer.from(value)).toThrow();
  });
  it('canonicalizes aggregate decimal text without converting it to Number', () => {
    expect(exactSaleQuantityReport('18446744073709551614.125')).toBe(
      '18446744073709551614.125',
    );
    expect(exactSaleQuantityReport('1.250')).toBe('1.25');
    expect(exactSaleQuantityReport('0.000')).toBe('0');
    for (const value of ['1.0001', '-1', '1e3', 0, null])
      expect(() => exactSaleQuantityReport(value)).toThrow(
        'business:sale_report_invalid',
      );
  });
});
