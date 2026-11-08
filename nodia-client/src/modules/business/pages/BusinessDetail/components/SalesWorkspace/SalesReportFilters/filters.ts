import { Temporal } from "temporal-polyfill";
import { salesPeriod } from "../../../../../infrastructure/salesDates";

export interface ReportFilters { from: string; through: string; metric: "units" | "amount" }
export function defaultReportFilters(today = Temporal.Now.plainDateISO("America/Santiago")): ReportFilters {
  return { from: today.with({ day: 1 }).toString(), through: today.toString(), metric: "units" };
}
export function reportPeriod(value: Pick<ReportFilters, "from" | "through">) {
  if (![value.from, value.through].every(date => /^\d{4}-\d{2}-\d{2}$/.test(date))) return null;
  try { return salesPeriod(value.from, value.through); } catch { return null; }
}
