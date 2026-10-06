import { z } from "zod";
import {
  catalogSchema,
  financeAmount,
  financeId,
} from "../FinanceCatalogModal/schema";
export const obligationSchema = catalogSchema.extend({
  amount: financeAmount,
  type: z.enum(["loan", "debt"]),
  description: z.string().max(5000, "finance:validation_description_length"),
  category_id: z.string(),
});
export const createObligationSchema = obligationSchema.extend({
  category_id: financeId,
});
export type ObligationForm = z.infer<typeof obligationSchema>;
