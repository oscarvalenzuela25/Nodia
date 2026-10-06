import { z } from "zod";
import { isFinanceAmount } from "../../utils/money";

export const financeName = z
  .string()
  .trim()
  .min(1, "finance:validation_required")
  .max(255, "finance:validation_name_length");
export const financeAmount = z
  .string()
  .refine(isFinanceAmount, "finance:validation_amount");
export const financeId = z
  .string()
  .refine(isFinanceAmount, "finance:validation_required");
export const catalogSchema = z.object({
  name: financeName,
  key: financeName,
  is_active: z.boolean(),
});
export type CatalogForm = z.infer<typeof catalogSchema>;
