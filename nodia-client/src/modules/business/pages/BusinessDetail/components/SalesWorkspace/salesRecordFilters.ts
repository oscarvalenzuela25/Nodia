import { salesPeriod } from "../../../../infrastructure/salesDates";
import { POS_PAYMENT_METHODS } from "../../../../infrastructure/salesTypes";
import type { SaleStatus, SalesParams } from "../../../../infrastructure/salesTypes";

export const SALES_RECORD_STATUSES = ["draft", "completed", "cancelled", "discarded"] as const satisfies readonly SaleStatus[];
export const SALES_RECORD_PAYMENT_METHODS = [...POS_PAYMENT_METHODS, "other"] as const;
type SalesRecordPaymentMethod = (typeof SALES_RECORD_PAYMENT_METHODS)[number];
export interface SalesRecordFilters { status: SaleStatus | null; paymentMethod: SalesRecordPaymentMethod | null; from: string; through: string }
export const emptySalesRecordFilters = (): SalesRecordFilters => ({ status: null, paymentMethod: null, from: "", through: "" });
export const isSalesRecordStatus = (value: unknown): value is SaleStatus => SALES_RECORD_STATUSES.some((status) => status === value);
export const isSalesRecordPaymentMethod = (value: unknown): value is SalesRecordPaymentMethod => SALES_RECORD_PAYMENT_METHODS.some((method) => method === value);

/** Civil dates are inclusive in Santiago; the HTTP upper bound is the next local midnight. */
export function salesRecordFilterParams(filters: SalesRecordFilters): Pick<SalesParams, "status" | "payment_method" | "from" | "to_exclusive"> {
  if (filters.status !== null && !isSalesRecordStatus(filters.status)) throw new Error("invalid_sale_status");
  const params = {
    ...(filters.status === null ? {} : { status: filters.status }),
    ...(filters.paymentMethod === null ? {} : { payment_method: filters.paymentMethod }),
  };
  if (!filters.from && !filters.through) return params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.from) || !/^\d{4}-\d{2}-\d{2}$/.test(filters.through)) throw new Error("invalid_period");
  return { ...params, ...salesPeriod(filters.from, filters.through) };
}
