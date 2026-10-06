import { z } from "zod";

const max = 9223372036854775807n;
export const moneyInput = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, "rental:invalid_amount")
  .refine(
    (value) => /^(0|[1-9]\d*)$/.test(value) && BigInt(value) <= max,
    "rental:invalid_amount",
  );
export const instantInput = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) && Number.isFinite(Date.parse(value)),
    "rental:invalid_input",
  );
export const civilInput = z.string().refine((value) => {
  if (
    !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) ||
    Number(value.slice(0, 4)) < 1900
  )
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}, "rental:invalid_input");
const optionalInstant = z.union([z.literal(""), instantInput]);
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "rental:invalid_local_time");
export const reservationSchema = z
  .object({
    guest_name: z.string().trim().min(1, "rental:invalid_input").max(255),
    guest_contact: z.string().trim().min(1, "rental:invalid_input").max(255),
    guests_count: z
      .string()
      .regex(/^[1-9]\d*$/, "rental:invalid_input")
      .refine((value) => Number(value) <= 1000, "rental:invalid_input"),
    channel: z.enum(["whatsapp", "airbnb", "facebook", "other"]),
    external_reference: z.string().max(255),
    check_in_on: civilInput,
    check_out_on: civilInput,
    check_in_time: time,
    check_out_time: time,
    nightly_rate: moneyInput.refine(
      (value) => value !== "0",
      "rental:invalid_amount",
    ),
    cleaning_fee: moneyInput,
    discount_amount: moneyInput,
    commission_amount: moneyInput,
    deposit_amount: moneyInput,
    deposit_due_at: optionalInstant,
    balance_due_at: optionalInstant,
    cancellation_policy_id: z.string().nullable(),
    notes: z.string().max(5000),
    is_active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const nights =
      (Date.parse(`${value.check_out_on}T00:00:00Z`) -
        Date.parse(`${value.check_in_on}T00:00:00Z`)) /
      86400000;
    if (!Number.isInteger(nights) || nights < 1 || nights > 366)
      ctx.addIssue({
        code: "custom",
        path: ["check_out_on"],
        message: "rental:invalid_interval",
      });
    if (
      [
        value.nightly_rate,
        value.cleaning_fee,
        value.discount_amount,
        value.commission_amount,
        value.deposit_amount,
      ].every((v) => /^(0|[1-9]\d*)$/.test(v)) &&
      Number.isInteger(nights)
    ) {
      const total =
        BigInt(nights) * BigInt(value.nightly_rate) +
        BigInt(value.cleaning_fee) -
        BigInt(value.discount_amount);
      const expected = total - BigInt(value.commission_amount);
      if (
        total <= 0n ||
        total > max ||
        expected <= 0n ||
        BigInt(value.deposit_amount) > expected
      )
        ctx.addIssue({
          code: "custom",
          path: ["deposit_amount"],
          message: "rental:invalid_amount",
        });
    }
    if (
      value.channel === "airbnb" &&
      (value.deposit_amount !== "0" || value.cancellation_policy_id !== null)
    )
      ctx.addIssue({
        code: "custom",
        path: ["deposit_amount"],
        message: "rental:invalid_platform_agreement",
      });
  });
export type ReservationForm = z.infer<typeof reservationSchema>;
export function agreementEditable(
  status: string,
  paymentCount: number | undefined,
  propertyActive: boolean,
) {
  return status === "draft" && paymentCount === 0 && propertyActive;
}
export function reservationPayload(
  value: ReservationForm,
  commercial: boolean,
) {
  const personal = {
    guest_name: value.guest_name,
    guest_contact: value.guest_contact,
    notes: value.notes.trim() || null,
    is_active: value.is_active,
  };
  if (!commercial) return personal;
  return {
    ...value,
    ...personal,
    guests_count: Number(value.guests_count),
    external_reference: value.external_reference.trim() || null,
    deposit_due_at: value.deposit_due_at || null,
    balance_due_at: value.balance_due_at || null,
  };
}
