import { z } from "zod";
import { countNights, isCivilDate } from "../../utils/dates";

export const rentalPositiveMoney = z
  .string()
  .refine(
    (value) =>
      /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n,
    "rental:invalid_amount",
  );
export const rentalCivilDate = z
  .string()
  .refine(isCivilDate, "rental:invalid_date");
export const rentalNullableId = z
  .string()
  .regex(/^[1-9]\d{0,18}$/, "rental:invalid_input")
  .nullable();
export const nullableText = (value: string): string | null =>
  value.trim() || null;
export function validRentalPeriod(from: string, to: string): boolean {
  if (!isCivilDate(from) || !isCivilDate(to)) return false;
  try {
    countNights(from, to);
    return true;
  } catch {
    return false;
  }
}

export const paymentSchema = z.object({
  reservation_id: z
    .string()
    .regex(/^[1-9]\d{0,18}$/, "rental:reservation_required"),
  type: z.enum(["payment", "refund"]),
  amount: rentalPositiveMoney,
  occurred_on: rentalCivilDate,
  method: z.string().trim().max(100, "rental:invalid_input"),
  reference: z.string().trim().max(255, "rental:invalid_input"),
  notes: z.string().trim().max(5000, "rental:invalid_input"),
  platform_reference: z.string().trim().max(255, "rental:invalid_input"),
  platform_description: z.string().trim().max(5000, "rental:invalid_input"),
});
export type PaymentForm = z.infer<typeof paymentSchema>;

export function buildPaymentPayload(
  data: PaymentForm,
  needsPlatformPolicy: boolean,
) {
  return {
    reservation_id: data.reservation_id,
    type: data.type,
    amount: data.amount,
    occurred_on: data.occurred_on,
    method: nullableText(data.method),
    reference: nullableText(data.reference),
    notes: nullableText(data.notes),
    ...(needsPlatformPolicy
      ? {
          platform_policy: {
            reference: data.platform_reference,
            description: data.platform_description,
          },
        }
      : {}),
  };
}
