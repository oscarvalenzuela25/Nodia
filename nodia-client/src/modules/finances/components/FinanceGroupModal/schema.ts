import { z } from "zod";
import { catalogSchema, financeId } from "../FinanceCatalogModal/schema";
export const groupSchema = catalogSchema.extend({
  category_ids: z
    .array(financeId)
    .max(100, "finance:validation_category_limit")
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "finance:validation_duplicate_categories",
    ),
});
export type GroupForm = z.infer<typeof groupSchema>;
