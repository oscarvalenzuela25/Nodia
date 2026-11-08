import { z } from "zod";
import { mainInstance } from "../../../config/api";
import { runCancellationInputSchema, runCancellationResultSchema } from "./runControlSchemas";
import type { NodiaAiRunCancellationInput } from "./runControlSchemas";

export async function cancelNodiaAiRun(runId: string, conversationId: string, input: NodiaAiRunCancellationInput, signal: AbortSignal) {
  const id = z.uuidv4().parse(runId);
  const chat = z.uuidv4().parse(conversationId);
  const body = runCancellationInputSchema.parse(input);
  signal.throwIfAborted();
  const { data } = await mainInstance.post<unknown>(`/nodia-ai/runs/${encodeURIComponent(id)}/cancel`, body, { signal });
  signal.throwIfAborted();
  const result = runCancellationResultSchema.parse(data);
  if (result.run.run_id !== id || result.run.conversation_id !== chat) throw new Error("nodia_ai:invalid_response");
  return result;
}
