import { z } from "zod";
import { instantInput, moneyInput } from "../ReservationModal/schema";
export const cancellationSchema = z.object({
  cancelled_at: instantInput,
  refund_amount: z.union([z.literal(""), moneyInput]),
  resolution_note: z.string().max(1000),
});
export type CancellationForm = z.infer<typeof cancellationSchema>;
export function cancellationPayload(
  value: CancellationForm,
  platform: boolean,
) {
  if (
    platform &&
    (!moneyInput.safeParse(value.refund_amount).success ||
      !value.resolution_note.trim())
  )
    throw new Error("rental:invalid_input");
  return {
    cancelled_at: value.cancelled_at,
    ...(platform
      ? {
          refund_amount: value.refund_amount,
          resolution_note: value.resolution_note.trim(),
        }
      : {}),
  };
}
