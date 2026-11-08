import { salesPeriod } from "../../../../infrastructure/salesDates";
import type { SaleStatus, SalesParams } from "../../../../infrastructure/salesTypes";

export const SALES_RECORD_STATUSES = ["draft", "completed", "cancelled", "discarded"] as const satisfies readonly SaleStatus[];
export interface SalesRecordFilters { status: SaleStatus | null; from: string; through: string }
export const emptySalesRecordFilters = (): SalesRecordFilters => ({ status: null, from: "", through: "" });
export const isSalesRecordStatus = (value: unknown): value is SaleStatus => SALES_RECORD_STATUSES.some((status) => status === value);

/** Civil dates are inclusive in Santiago; the HTTP upper bound is the next local midnight. */
export function salesRecordFilterParams(filters: SalesRecordFilters): Pick<SalesParams, "status" | "from" | "to_exclusive"> {
  if (filters.status !== null && !isSalesRecordStatus(filters.status)) throw new Error("invalid_sale_status");
  const status = filters.status === null ? {} : { status: filters.status };
  if (!filters.from && !filters.through) return status;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.from) || !/^\d{4}-\d{2}-\d{2}$/.test(filters.through)) throw new Error("invalid_period");
  return { ...status, ...salesPeriod(filters.from, filters.through) };
}
