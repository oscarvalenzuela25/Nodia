import type { OcrStockAction } from "../../../../../../infrastructure/cashTypes";
import { isStockQuantity } from "../../../../../../infrastructure/productStock";
import { quantityThousandths } from "../../../../../../infrastructure/saleQuantities";
import type { ProductEntity } from "../../../../../../infrastructure/types";

export interface InvoiceStockReview {
  observedTracking: boolean;
  observedBalance: number | null;
  tracking: boolean;
  mode: OcrStockAction["mode"];
  quantity?: string;
}

export function observeInvoiceStock(product?: Pick<ProductEntity, "track_stock" | "stock">): InvoiceStockReview {
  const tracking = product?.track_stock === true;
  const observedBalance = product
    ? typeof product.stock === "number" && Number.isFinite(product.stock) ? product.stock : null
    : 0;
  return { observedTracking: tracking, observedBalance, tracking, mode: "add" };
}

export function setInvoiceStockTracking(review: InvoiceStockReview, tracking: boolean): InvoiceStockReview {
  if (review.tracking === tracking) return review;
  return { ...review, tracking, mode: "add", quantity: undefined };
}

/** An empty edit intentionally omits the adjustment. Only an untouched field uses the invoice quantity. */
export function invoiceStockQuantity(review: InvoiceStockReview, invoicedQuantity: number): string {
  return review.quantity ??
    (Number.isFinite(invoicedQuantity) && invoicedQuantity >= 0 ? String(invoicedQuantity) : "");
}

export function invoiceStockTrackingChange(review?: InvoiceStockReview): boolean | undefined {
  return review && review.tracking !== review.observedTracking ? review.tracking : undefined;
}

export function reviewLatestInvoiceStock(
  next: InvoiceStockReview,
  previous?: InvoiceStockReview,
): InvoiceStockReview {
  if (!previous) return next;
  const tracking = invoiceStockTrackingChange(previous) ?? next.tracking;
  return tracking
    ? { ...next, tracking, mode: previous.mode, quantity: previous.quantity }
    : setInvoiceStockTracking(next, false);
}

type StockError = "business:stock_tracking.invalid" | "business:ocr_stock_replace_invalid_balance";
type StockResult =
  | { error: StockError }
  | { error?: never; projectedBalance?: number; action?: OcrStockAction };

export function evaluateInvoiceStock(review: InvoiceStockReview | undefined, invoicedQuantity: number): StockResult {
  if (!review?.tracking) return {};
  const input = invoiceStockQuantity(review, invoicedQuantity).trim();
  const amount = quantityThousandths(input);
  if (input && amount === null) return { error: "business:stock_tracking.invalid" };
  if (amount !== null && review.mode === "replace") {
    const quantity = Number(amount) / 1000;
    return { action: { mode: "replace", quantity }, projectedBalance: quantity };
  }
  const observed = quantityThousandths(review.observedBalance);
  if (observed === null) return { error: "business:ocr_stock_replace_invalid_balance" };
  if (amount === null) return {};
  const projectedBalance = Number(observed + amount) / 1000;
  if (!isStockQuantity(projectedBalance)) return { error: "business:stock_tracking.invalid" };
  return { action: { mode: "add", quantity: Number(amount) / 1000 }, projectedBalance };
}
