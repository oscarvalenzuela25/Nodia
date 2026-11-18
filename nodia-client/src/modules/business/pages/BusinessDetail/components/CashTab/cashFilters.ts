import type { ActiveFilterStatus } from "../../../../../../components/Filter/components/ActiveStatusSelect";
import { cashToday, isCashCivilDate, trimCashText } from "../../../../infrastructure/cashValues";

export interface CashFilters {
  from: string;
  to: string;
  activity: ActiveFilterStatus;
  category: { id: string; name: string } | null;
}

export function defaultCashFilters(today = cashToday()): CashFilters {
  return { from: today, to: today, activity: "active", category: null };
}

export function validCashFilterPeriod({ from, to }: Pick<CashFilters, "from" | "to">): boolean {
  return (!from || isCashCivilDate(from)) && (!to || isCashCivilDate(to)) &&
    (!from || !to || from <= to);
}

export function cashFilterCriteria({ from, to, category, activity }: CashFilters) {
  return {
    from: from || undefined,
    to: to || undefined,
    categoryId: category?.id,
    active: activity === "all" ? undefined : activity === "active",
  };
}

export function validCashSearch(value: string): boolean {
  return !value.includes("\u0000") && !/[\uD800-\uDFFF]/u.test(value) &&
    Array.from(trimCashText(value)).length <= 255;
}
