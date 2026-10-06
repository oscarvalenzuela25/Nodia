import { z } from "zod";
import { instantInput } from "../ReservationModal/schema";
export const blockSchema = z
  .object({
    starts_at: instantInput,
    ends_at: instantInput,
    reason: z.string().trim().min(1, "rental:invalid_input").max(255),
    notes: z.string().max(5000),
    is_active: z.boolean(),
  })
  .refine((value) => Date.parse(value.starts_at) < Date.parse(value.ends_at), {
    path: ["ends_at"],
    message: "rental:invalid_interval",
  });
export type BlockForm = z.infer<typeof blockSchema>;
