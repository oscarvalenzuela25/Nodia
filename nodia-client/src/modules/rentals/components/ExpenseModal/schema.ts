import { z } from "zod";
import {
  nullableText,
  rentalCivilDate,
  rentalNullableId,
  rentalPositiveMoney,
} from "../PaymentModal/schema";

export const expenseSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "rental:required")
      .max(255, "rental:invalid_input"),
    amount: rentalPositiveMoney,
    incurred_on: rentalCivilDate,
    status: z.enum(["pending", "paid"]),
    paid_on: z.string(),
    reservation_id: rentalNullableId,
    category: z.string().trim().max(100, "rental:invalid_input"),
    notes: z.string().trim().max(5000, "rental:invalid_input"),
  })
  .superRefine((data, ctx) => {
    if (
      data.status === "paid" &&
      (!rentalCivilDate.safeParse(data.paid_on).success ||
        data.paid_on < data.incurred_on)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["paid_on"],
        message: "rental:invalid_date",
      });
    }
  });
export type ExpenseForm = z.infer<typeof expenseSchema>;

export function buildExpensePayload(
  data: ExpenseForm,
  editingStatus?: "pending" | "paid" | "voided",
) {
  const metadata = {
    name: data.name,
    category: nullableText(data.category),
    notes: nullableText(data.notes),
    reservation_id: data.reservation_id,
  };
  if (editingStatus === "paid") return metadata;
  if (editingStatus)
    return { ...metadata, amount: data.amount, incurred_on: data.incurred_on };
  return {
    ...metadata,
    amount: data.amount,
    incurred_on: data.incurred_on,
    status: data.status,
    paid_on: data.status === "paid" ? data.paid_on : null,
  };
}
