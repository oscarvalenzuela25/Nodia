import { z } from "zod";
import { requiredText, percentInput } from "../PropertyModal/schema";

export const policySchema = z
  .object({
    name: requiredText,
    is_active: z.boolean(),
    rules: z
      .array(
        z.object({
          min_days_before: z
            .string()
            .refine(
              (value) => /^\d+$/.test(value) && Number(value) <= 36500,
              "rental:validation_integer",
            ),
          refund_percent: percentInput,
        }),
      )
      .min(1, "rental:validation_rules")
      .max(100, "rental:validation_rules"),
  })
  .superRefine((value, context) => {
    const days = value.rules.map((rule) => Number(rule.min_days_before));
    if (!days.includes(0) || new Set(days).size !== days.length)
      context.addIssue({
        code: "custom",
        path: ["rules"],
        message: "rental:validation_rules",
      });
  });
export type PolicyForm = z.infer<typeof policySchema>;
export const policyPayload = (value: PolicyForm) => ({
  ...value,
  rules: value.rules.map((rule) => ({
    ...rule,
    min_days_before: Number(rule.min_days_before),
  })),
});
