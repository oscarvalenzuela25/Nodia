import { z } from "zod";
import { nullableText } from "../PropertyModal/schema";

export const collaboratorSchema = z.object({
  user_id: z
    .string()
    .refine(
      (value) =>
        /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n,
      "rental:validation_required",
    ),
  position: nullableText(255),
  is_active: z.boolean(),
});
export type CollaboratorForm = z.input<typeof collaboratorSchema>;
export type CollaboratorFormOutput = z.output<typeof collaboratorSchema>;
