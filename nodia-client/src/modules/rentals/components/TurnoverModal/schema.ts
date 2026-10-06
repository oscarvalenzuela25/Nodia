import { z } from "zod";
import { instantInput } from "../ReservationModal/schema";
export const turnoverSchema = z
  .object({
    linen_ready: z.enum(["unknown", "yes", "no"]),
    cleaning_status: z.enum(["pending", "in_progress", "completed"]),
    planned_ready_at: z.union([z.literal(""), instantInput]),
    ready_at: z.union([z.literal(""), instantInput]),
    notes: z.string().max(5000),
  })
  .superRefine((value, ctx) => {
    if (
      value.ready_at &&
      (value.linen_ready !== "yes" ||
        value.cleaning_status !== "completed" ||
        Date.parse(value.ready_at) > Date.now())
    )
      ctx.addIssue({
        code: "custom",
        path: ["ready_at"],
        message: "rental:not_ready",
      });
  });
export type TurnoverForm = z.infer<typeof turnoverSchema>;
export function turnoverPayload(value: TurnoverForm) {
  return {
    ...value,
    linen_ready:
      value.linen_ready === "unknown" ? null : value.linen_ready === "yes",
    planned_ready_at: value.planned_ready_at || null,
    ready_at: value.ready_at || null,
    notes: value.notes.trim() || null,
  };
}
