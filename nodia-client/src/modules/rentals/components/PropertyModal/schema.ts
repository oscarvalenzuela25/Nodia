import { z } from "zod";

export const requiredText = z
  .string()
  .trim()
  .min(1, "rental:validation_required")
  .max(255, "rental:validation_length");
export const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "rental:validation_length")
    .transform((value) => value || null);
export const moneyInput = z
  .string()
  .refine(
    (value) =>
      /^(0|[1-9]\d{0,18})$/.test(value) &&
      BigInt(value) > 0n &&
      BigInt(value) <= 9223372036854775807n,
    "rental:validation_amount",
  );
export const percentInput = z
  .string()
  .refine(
    (value) =>
      /^(0|[1-9]\d?|100)(\.\d{1,2})?$/.test(value) && Number(value) <= 100,
    "rental:validation_percent",
  );
const integerInput = (min: number, max: number) =>
  z
    .string()
    .refine(
      (value) =>
        /^\d+$/.test(value) &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) >= min &&
        Number(value) <= max,
      "rental:validation_integer",
    );
export const propertySchema = z.object({
  name: requiredText,
  location: nullableText(500),
  timezone: z
    .string()
    .trim()
    .refine((value) => {
      if (!value || (!value.includes("/") && value !== "UTC")) return false;
      try {
        new Intl.DateTimeFormat("en", { timeZone: value }).format();
        return true;
      } catch {
        return false;
      }
    }, "rental:validation_timezone"),
  max_guests: integerInput(1, 1000),
  check_in_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "rental:validation_time"),
  check_out_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "rental:validation_time"),
  default_nightly_rate: z
    .union([z.literal(""), moneyInput])
    .transform((value) => value || null),
  default_deposit_percent: z
    .union([z.literal(""), percentInput])
    .transform((value) => value || null),
  minimum_turnover_minutes: integerInput(0, 10080),
  notes: nullableText(5000),
  is_active: z.boolean(),
});
export type PropertyForm = z.input<typeof propertySchema>;
export type PropertyFormOutput = z.output<typeof propertySchema>;
export const propertyPayload = (value: PropertyFormOutput) => ({
  ...value,
  max_guests: Number(value.max_guests),
  minimum_turnover_minutes: Number(value.minimum_turnover_minutes),
});
