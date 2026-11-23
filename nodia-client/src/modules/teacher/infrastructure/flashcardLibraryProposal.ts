import { z } from "zod";
import { mainInstance } from "../../../config/api";
import { flashcardTextLimit, type FlashcardSource } from "./flashcards";
import type { Selection } from "./schemas";
import { readTeacher } from "./services";

export const flashcardLibraryPath = "flashcards/proposals";
export const flashcardNotesMaxBytes = 8000;
const previewMaxBytes = 4 * 1024 * 1024;
const previewMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export type FlashcardProposalPart = "text" | "image";
export type FlashcardProposalParts = FlashcardProposalPart | "both";
export type FlashcardProposalOrigin = { kind: "notes"; notes: string }
  | { kind: "quote"; anchor: NonNullable<FlashcardSource["anchor"]> }
  | { kind: "card"; id: string; revision: number };
export type FlashcardProposalIntent = {
  origin: FlashcardProposalOrigin;
  parts: FlashcardProposalParts;
  text_selection?: Selection;
  image_selection?: Selection;
};

const generationState = z.enum(["skipped", "queued", "running", "ready", "failed", "unknown"]);
const partSchema = z.object({ state: generationState, error_code: z.string().nullable() });
const cardText = z.string().trim().min(1).max(flashcardTextLimit);
const textValueSchema = z.object({ question: cardText, answer: cardText });
const responseSchema = z.object({
  id: z.uuid(),
  text: partSchema.extend({ value: textValueSchema.nullable() })
    .refine(part => (part.state === "ready") === Boolean(part.value)),
  image: partSchema,
  expires_at: z.iso.datetime({ offset: true }),
});
const admissionSchema = z.object({ id: z.uuid() });

export type FlashcardProposalState = z.infer<typeof generationState>;
export type FlashcardProposalStatus = z.infer<typeof responseSchema>;

function responseFor(id: string) {
  return responseSchema.refine(proposal => proposal.id.toLowerCase() === id.toLowerCase());
}

export async function startFlashcardProposal(intent: FlashcardProposalIntent, requestKey: string) {
  const { status, data } = await mainInstance.post<unknown>("/teacher/" + flashcardLibraryPath, {
    ...intent, request_key: requestKey,
  });
  if (status !== 202) throw new Error("flashcard_proposal_unconfirmed");
  return admissionSchema.parse(data);
}

export function readFlashcardProposal(id: string, signal?: AbortSignal) {
  return readTeacher(flashcardLibraryPath + "/" + encodeURIComponent(id), responseFor(id), signal);
}

export function findFlashcardProposal(requestKey: string) {
  return readTeacher(flashcardLibraryPath + "/requests/" + encodeURIComponent(requestKey), responseSchema);
}

export async function readFlashcardProposalImage(id: string, signal: AbortSignal) {
  const { data } = await mainInstance.get<unknown>("/teacher/" + flashcardLibraryPath + "/" + encodeURIComponent(id) + "/image", {
    responseType: "blob", signal,
  });
  if (!(data instanceof Blob) || !previewMimeTypes.has(data.type) || data.size === 0 || data.size > previewMaxBytes)
    throw new Error("flashcard_proposal_invalid_image");
  return data;
}

export function proposalPartPending(state: FlashcardProposalState) {
  return state === "queued" || state === "running";
}

export function flashcardProposalPending(proposal: FlashcardProposalStatus) {
  return proposalPartPending(proposal.text.state) || proposalPartPending(proposal.image.state);
}
