import { z } from "zod";
import { cashCatalogIdSchema } from "../../../../../infrastructure/cashSchemas";
import type { CashMutationOutcome } from "../../../../../infrastructure/cashTypes";
import {
  CASH_AMOUNT_PATTERN,
  isCashCivilDate,
  trimCashText,
} from "../../../../../infrastructure/cashValues";

function cashText(max: number, message: string, { normalize = false, allowBlank = false } = {}) {
  return z
    .string()
    .refine((value) => !value.includes("\u0000") && !/[\uD800-\uDFFF]/u.test(value), message)
    .transform((value) => trimCashText(normalize ? value.normalize("NFKC") : value))
    .refine((value) => (allowBlank || value.length > 0) && [...value].length <= max, message);
}

const description = cashText(500, "business:cash.invalid_description", { allowBlank: true });

export const categoryFields = z.object({
  name: cashText(120, "business:cash.invalid_category_name", { normalize: true }),
  description,
  is_active: z.boolean(),
});

export const movementFields = z.object({
  category_id: z
    .string()
    .refine(
      (value) => cashCatalogIdSchema.safeParse(value).success,
      "business:cash.category_selection_invalid",
    ),
  amount: z.string().regex(CASH_AMOUNT_PATTERN, "business:cash.invalid_amount"),
  occurred_on: z.string().refine(isCashCivilDate, "business:cash.invalid_date"),
  description,
  is_active: z.boolean(),
});

export type CategoryFields = z.infer<typeof categoryFields>;
export type MovementFields = z.infer<typeof movementFields>;

export const isCashVersionConflict = (outcome: CashMutationOutcome | undefined) =>
  outcome?.status === "rejected" && outcome.error.message === "business:cash_version_conflict";

export function changedFields<Fields extends object>(
  value: Fields,
  baseline: Fields,
): Partial<Fields> {
  const changes: Partial<Fields> = {};
  for (const field of Object.keys(value) as (keyof Fields)[]) {
    if (value[field] !== baseline[field]) changes[field] = value[field];
  }
  return changes;
}
