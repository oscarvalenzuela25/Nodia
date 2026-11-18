import { z } from "zod";
import type { CommandResult } from "./schemas";
import type { TeacherCommand } from "./services";

const createReceipt = z.object({
  kind: z.literal("clarification"), session_id: z.uuid(), revision: z.number().int().positive(), resource_id: z.uuid(),
});
const messageReceipt = z.object({
  kind: z.literal("job"), session_id: z.uuid(), revision: z.number().int().positive(), job_id: z.uuid(), thread_id: z.uuid(),
});

/** A malformed success leaves the original request pending for read-only recovery. */
export function validateClarificationReceipt(command: TeacherCommand, result: CommandResult) {
  const route = /^sessions\/([^/]+)\/enrichment\/commands$/.exec(command.path);
  if (!route) return result;
  if (command.body.operation === "thread_create") {
    createReceipt.refine(receipt => receipt.session_id === route[1]).parse(result);
  }
  if (command.body.operation === "thread_message") {
    const payload = command.body.payload;
    messageReceipt.refine(receipt => receipt.session_id === route[1] && Boolean(
      payload && typeof payload === "object" && "thread_id" in payload && payload.thread_id === receipt.thread_id,
    )).parse(result);
  }
  return result;
}
