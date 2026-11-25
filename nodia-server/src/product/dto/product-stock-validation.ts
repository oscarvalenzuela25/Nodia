import { ValidateBy, type ValidationOptions } from 'class-validator';
import { stockQuantityMillis } from '../../common/utils/stock-quantity.js';

export function toProductStockQueryValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(trimmed) ? Number(trimmed) : value;
}

export function IsProductStockQuantity(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy({
    name: 'isProductStockQuantity',
    validator: {
      validate(value: unknown) {
        try {
          stockQuantityMillis(value);
          return true;
        } catch {
          return false;
        }
      },
      defaultMessage: () => 'product:invalid_stock',
    },
  }, options);
}
