import type { ProductLogEntity, ProductEntity } from "../../../../infrastructure/types";

export interface PriceDiffData {
  diff: number;
  percent: number;
  isIncrease: boolean;
}

export type PriceChangeStatus = "increased" | "decreased" | "unchanged";

export const calculatePriceDiff = (
  currentSale: number,
  historicalSale?: number
): PriceDiffData | null => {
  if (
    historicalSale === undefined ||
    historicalSale === null ||
    historicalSale <= 0 ||
    currentSale <= 0
  ) {
    return null;
  }
  const diff = currentSale - historicalSale;
  if (diff === 0) return null;
  const percent = Math.trunc(((currentSale - historicalSale) / historicalSale) * 100);
  return {
    diff,
    percent: Math.abs(percent),
    isIncrease: diff > 0,
  };
};

/**
 * Resolves the historical log record representing the previous state before the current product's values.
 *
 * In nodia-server, whenever a product is created or updated, a snapshot is appended to product_logs.
 * Thus:
 * - If logs are ordered created_at DESC (newest first):
 *   - If logs[0] has the same sale_price and cost_price as the current product, and logs[1] exists,
 *     logs[1] is the state before that update.
 *   - If logs[0] has a different sale_price, it is the previous state before the current product update.
 *   - If only 1 log exists (the creation log), it is the baseline snapshot.
 */
export const resolveHistoricalLog = (
  product: Pick<ProductEntity, "sale_price" | "cost_price">,
  logs: ProductLogEntity[]
): ProductLogEntity | null => {
  if (!logs || logs.length === 0) return null;

  const newestLog = logs[0];
  if (
    logs.length > 1 &&
    newestLog.sale_price === product.sale_price &&
    newestLog.cost_price === product.cost_price
  ) {
    return logs[1];
  }

  if (newestLog.sale_price !== product.sale_price) {
    return newestLog;
  }

  return logs.length > 1 ? logs[1] : newestLog;
};

export const getPriceChangeStatus = (
  product: Pick<ProductEntity, "sale_price" | "cost_price">,
  historicalLog: ProductLogEntity | null
): PriceChangeStatus => {
  if (!historicalLog) return "unchanged";
  const diff = calculatePriceDiff(product.sale_price, historicalLog.sale_price);
  if (!diff) return "unchanged";
  return diff.isIncrease ? "increased" : "decreased";
};
