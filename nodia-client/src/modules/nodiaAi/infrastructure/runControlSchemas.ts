import { z } from "zod";
import { nodiaAiRunSchema } from "./schemas";

export const runCancellationInputSchema = z.object({ client_request_id: z.uuidv4() }).strict();
export const runCancellationResultSchema = z.object({
  status: z.enum(["accepted", "already_terminal"]), run: nodiaAiRunSchema,
}).strict().refine(value => value.status === "accepted" ? value.run.state === "cancel_requested"
  : !["queued", "running", "cancel_requested"].includes(value.run.state));
export type NodiaAiRunCancellationInput = z.infer<typeof runCancellationInputSchema>;
export type NodiaAiRunCancellationResult = z.infer<typeof runCancellationResultSchema>;
