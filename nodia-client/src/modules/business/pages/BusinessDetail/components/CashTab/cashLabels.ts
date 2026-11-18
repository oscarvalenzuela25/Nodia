import type { TFunction } from "i18next";
import type { CashMovement } from "../../../../infrastructure/cashTypes";
import type { CashFilters } from "./cashFilters";

export function cashMovementName(movement: CashMovement, t: TFunction): string {
  if (movement.source === "manual") return movement.description;
  return t("business:cash.invoice_source", {
    code: movement.invoice.code ?? t("business:invoice_without_code"),
  });
}

export function cashPeriodLabel(
  { from, to }: Pick<CashFilters, "from" | "to">,
  format: (date: string) => string,
  t: TFunction,
): string {
  if (from && from === to) return t("business:cash.period_day", { date: format(from) });
  if (from && to) return t("business:cash.period_range", { from: format(from), to: format(to) });
  if (from) return t("business:cash.period_from", { from: format(from) });
  if (to) return t("business:cash.period_to", { to: format(to) });
  return t("business:cash.all_dates");
}
