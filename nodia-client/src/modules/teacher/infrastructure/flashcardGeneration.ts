import { z } from "zod";
import { mainInstance } from "../../../config/api";
import { flashcardTextLimit, type FlashcardSource } from "./flashcards";
import { jobStateSchema, type Selection } from "./schemas";
import { readTeacher } from "./services";

const path = "flashcards/generations";
const proposalText = z.string().trim().min(1).max(flashcardTextLimit);
const proposalSchema = z.object({ question: proposalText, answer: proposalText });
const statusSchema = z.object({
  id: z.uuid(),
  state: jobStateSchema,
  error_code: z.string().nullable(),
  proposal: proposalSchema.nullable(),
}).refine(status => (status.state === "ready") === Boolean(status.proposal));

export type FlashcardTextProposal = z.infer<typeof proposalSchema>;
export type FlashcardGenerationStatus = z.infer<typeof statusSchema>;
export type FlashcardGenerationTarget = { source: NonNullable<FlashcardSource["anchor"]> }
  | { card_id: string; revision: number; parts: "text" };

export async function startFlashcardGeneration(target: FlashcardGenerationTarget, selection: Selection, requestKey: string) {
  const { status, data } = await mainInstance.post<unknown>("/teacher/" + path, {
    ...target, selection, request_key: requestKey,
  });
  if (status !== 202) throw new Error("flashcard_generation_unconfirmed");
  return statusSchema.parse(data);
}

export function readFlashcardGeneration(id: string, signal?: AbortSignal) {
  return readTeacher(path + "/" + encodeURIComponent(id),
    statusSchema.refine(status => status.id.toLowerCase() === id.toLowerCase()), signal);
}

export function findFlashcardGeneration(key: string) {
  return readTeacher(path + "/requests/" + encodeURIComponent(key), statusSchema);
}

export function flashcardGenerationPending(status: FlashcardGenerationStatus) {
  return status.state === "queued" || status.state === "running" || status.state === "blocked_paused";
}
