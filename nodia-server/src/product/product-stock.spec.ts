import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { FilterProductDto } from './dto/filter-product.dto.js';
import { resolveOcrStockWrite, validateProductStockWrite } from './product-stock.js';

const tracked = { track_stock: true, stock: 2.3, measurement_unit: 'kg' } as const;
const dormant = { ...tracked, track_stock: false, stock: -2 };

describe('product stock writes', () => {
  it('preserves an inactive historical balance and requires a valid balance on reactivation', () => {
    expect(() => validateProductStockWrite(dormant, {})).not.toThrow();
    expect(() => validateProductStockWrite(dormant, { track_stock: true }))
      .toThrow('product:invalid_stock');
    expect(() => validateProductStockWrite(dormant, { track_stock: true, stock: 0 }))
      .not.toThrow();
    expect(() => validateProductStockWrite(tracked, { track_stock: false, stock: 0 }))
      .toThrow('product:stock_tracking_disabled');
  });

  it('requires a reviewed balance for a change in unit while tracking stock', () => {
    expect(() => validateProductStockWrite(tracked, { measurement_unit: 'g' }))
      .toThrow('product:stock_quantity_required');
    expect(() => validateProductStockWrite(tracked, { measurement_unit: 'g', stock: 2300 }))
      .not.toThrow();
  });

  it('uses exact thousandths for OCR and requires replacement when the old balance is invalid', () => {
    expect(resolveOcrStockWrite(tracked, undefined, { mode: 'add', quantity: 0.145 }))
      .toEqual({ stock: 2.445 });
    expect(resolveOcrStockWrite(dormant, true, { mode: 'replace', quantity: 0 }))
      .toEqual({ track_stock: true, stock: 0 });
    expect(() => resolveOcrStockWrite(dormant, true, { mode: 'add', quantity: 2.25 }))
      .toThrow('product:invalid_stock');
    expect(() => resolveOcrStockWrite(tracked, false, { mode: 'replace', quantity: 0 }))
      .toThrow('product:stock_tracking_disabled');
    expect(() => resolveOcrStockWrite(tracked, undefined, { mode: 'add', quantity: 2147483647 }))
      .toThrow('product:invalid_stock');
  });

  it('validates HTTP quantities without coercing null or comparing a blank filter as zero', async () => {
    const q = (value: unknown) => plainToInstance(FilterProductDto, { tracked_stock_lteq: value });
    expect(q(' ').tracked_stock_lteq).toBeUndefined();
    expect(q('0').tracked_stock_lteq).toBe(0);
    expect(q('1.012').tracked_stock_lteq).toBe(1.012);
    for (const value of [null, '1e0', '1.0001', '-1', '2147483648', ['1']])
      expect(await validate(q(value))).toHaveLength(1);
    for (const value of [null, '1', 1.0001, -1, 2147483648])
      expect(await validate(plainToInstance(UpdateProductDto, { stock: value }))).toHaveLength(1);
    expect(await validate(plainToInstance(UpdateProductDto, { stock: 0 }))).toEqual([]);
  });
});
