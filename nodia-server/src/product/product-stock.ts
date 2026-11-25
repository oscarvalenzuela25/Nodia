import { BadRequestException } from '@nestjs/common';
import { stockQuantityMillis } from '../common/utils/stock-quantity.js';
import type { Product } from './entities/product.entity.js';

type StockState = Pick<Product, 'track_stock' | 'stock' | 'measurement_unit'>;
export type ProductStockAction = { mode: 'add' | 'replace'; quantity: number };

export function validateProductStockWrite(
  current: StockState | undefined,
  attributes: Partial<StockState>,
): void {
  const { track_stock, stock, measurement_unit } = attributes;
  if (track_stock !== undefined && typeof track_stock !== 'boolean')
    throw new BadRequestException('product:invalid_stock_tracking');
  const tracking = track_stock ?? current?.track_stock ?? false;
  if (!tracking && stock !== undefined)
    throw new BadRequestException('product:stock_tracking_disabled');
  if (!tracking) return;
  if (
    current &&
    measurement_unit !== undefined &&
    measurement_unit !== current.measurement_unit &&
    stock === undefined
  )
    throw new BadRequestException('product:stock_quantity_required');
  stockQuantityMillis(stock === undefined ? current?.stock ?? 0 : stock);
}

export function resolveOcrStockWrite(
  current: Pick<StockState, 'stock' | 'track_stock'> | undefined,
  track_stock: boolean | undefined,
  action: ProductStockAction | undefined,
): Partial<Pick<StockState, 'stock' | 'track_stock'>> {
  const attributes = track_stock === undefined ? {} : { track_stock };
  if (!action) return attributes;
  if (!(track_stock ?? current?.track_stock))
    throw new BadRequestException('product:stock_tracking_disabled');
  const quantity = stockQuantityMillis(action.quantity);
  const base = action.mode === 'add' ? stockQuantityMillis(current?.stock ?? 0) : 0;
  const stock = (base + quantity) / 1000;
  stockQuantityMillis(stock);
  return { ...attributes, stock };
}
