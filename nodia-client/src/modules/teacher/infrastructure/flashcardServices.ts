import { mainInstance } from "../../../config/api";
import { fileToBase64 } from "./enrichmentSchemas";
import { flashcardImportReceiptSchema, flashcardSetImportReceiptSchema, type FlashcardImportBatch } from "./flashcardImport";
import {
  flashcardDeckSchema, flashcardImageByteLimit, flashcardSchema, flashcardSetSchema,
  type FlashcardDeckFields, type FlashcardDraft, type FlashcardUpdate,
} from "./flashcards";

const api = "/teacher/flashcards";
export const flashcardDecksPath = "flashcards/decks";
export const flashcardSetsPath = "flashcards/sets";
export const flashcardsPath = "flashcards/cards";
const cardPath = (id: string) => api + "/cards/" + encodeURIComponent(id);
const collectionPath = (kind: "decks" | "sets", id: string) => api + "/" + kind + "/" + encodeURIComponent(id);

export async function createFlashcardDeck(fields: FlashcardDeckFields) {
  const response = await mainInstance.post<unknown>(api + "/decks", fields);
  return flashcardDeckSchema.parse(response.data);
}

export async function updateFlashcardDeck(id: string, fields: FlashcardDeckFields) {
  const response = await mainInstance.patch<unknown>(collectionPath("decks", id), fields);
  const deck = flashcardDeckSchema.parse(response.data);
  if (deck.id.toLowerCase() !== id.toLowerCase()) throw new Error("flashcard_deck_identity_mismatch");
  return deck;
}

export async function createFlashcardSet(title: string) {
  const response = await mainInstance.post<unknown>(api + "/sets", { title });
  return flashcardSetSchema.parse(response.data);
}

export async function deleteFlashcardCollection(kind: "decks" | "sets", id: string) {
  const { status } = await mainInstance.delete(collectionPath(kind, id));
  if (status !== 204) throw new Error("flashcard_collection_delete_unconfirmed");
}

export async function importFlashcards(batch: FlashcardImportBatch, requestKey: string) {
  if ("set" in batch) {
    const response = await mainInstance.post<unknown>(api + "/imports/sets", { ...batch, request_key: requestKey });
    const receipt = flashcardSetImportReceiptSchema.parse(response.data);
    const count = batch.decks.reduce((total, deck) => total + deck.cards.length, 0);
    if (response.status !== 201 || receipt.set.title !== batch.set.title ||
      receipt.set.deck_count !== batch.decks.length || receipt.imported_count !== count) {
      throw new Error("flashcard_import_unconfirmed");
    }
    return receipt;
  }
  const response = await mainInstance.post<unknown>(api + "/imports", { ...batch, request_key: requestKey });
  const receipt = flashcardImportReceiptSchema.parse(response.data);
  const { destination } = batch;
  const correctDeck = destination.kind === "existing"
    ? receipt.deck.id.toLowerCase() === destination.deck_id.toLowerCase()
    : receipt.deck.id !== "general" && receipt.deck.title === destination.title &&
      (receipt.deck.category ?? null) === (destination.category ?? null);
  if (response.status !== 201 || receipt.imported_count !== batch.cards.length || !correctDeck) {
    throw new Error("flashcard_import_unconfirmed");
  }
  return receipt;
}

export async function createFlashcard(draft: FlashcardDraft, requestKey: string) {
  const response = await mainInstance.post<unknown>(api + "/cards", { ...draft, request_key: requestKey });
  return flashcardSchema.parse(response.data);
}

export async function updateFlashcard(id: string, update: FlashcardUpdate) {
  const response = await mainInstance.patch<unknown>(cardPath(id), update);
  const card = flashcardSchema.parse(response.data);
  if (card.id.toLowerCase() !== id.toLowerCase()) throw new Error("flashcard_identity_mismatch");
  return card;
}

export async function deleteFlashcard(id: string) {
  const { status } = await mainInstance.delete(cardPath(id));
  if (status !== 204) throw new Error("flashcard_delete_unconfirmed");
}

export async function recordFlashcardReview(id: string, remembered: boolean, requestKey: string) {
  const { status } = await mainInstance.post(cardPath(id) + "/reviews", { remembered, request_key: requestKey });
  if (status !== 204) throw new Error("flashcard_review_unconfirmed");
}

export async function readFlashcardImage(id: string, signal: AbortSignal) {
  const { data } = await mainInstance.get<Blob>(cardPath(id) + "/image", { responseType: "blob", signal });
  if (!(data instanceof Blob) || data.type !== "image/webp" || !data.size || data.size > flashcardImageByteLimit) {
    throw new Error("flashcard_image_invalid");
  }
  return "data:image/webp;base64," + fileToBase64(new Uint8Array(await data.arrayBuffer()));
}
