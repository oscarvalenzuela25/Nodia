import { z } from "zod";
import {
  financeAmount,
  financeId,
  financeName,
} from "../FinanceCatalogModal/schema";

export const movementSchema = z
  .object({
    name: financeName,
    amount: financeAmount,
    type: z.enum(["income", "expense"]),
    status: z.enum(["pending", "received", "paid", "cancelled"]),
    category_id: financeId,
    obligation_id: z.string().nullable(),
    is_active: z.boolean(),
  })
  .refine(
    (value) =>
      value.type === "income"
        ? value.status !== "paid"
        : value.status !== "received",
    { path: ["status"], message: "finance:invalid_movement_state" },
  );
export type MovementForm = z.infer<typeof movementSchema>;

export function normalizedStatus(
  type: "income" | "expense",
  status: MovementForm["status"],
): MovementForm["status"] {
  return status === "received" || status === "paid"
    ? type === "income"
      ? "received"
      : "paid"
    : status;
}
