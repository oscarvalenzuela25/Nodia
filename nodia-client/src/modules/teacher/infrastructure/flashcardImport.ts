import { z } from "zod";
import {
  flashcardCategoryLimit, flashcardDeckIdSchema, flashcardDeckSchema, flashcardDeckTitleLimit,
  flashcardSetSchema, flashcardSourceLabelLimit, flashcardTextLimit,
} from "./flashcards";

export const flashcardImportLimit = 30;
const inputByteLimit = 512 * 1024;
const requestByteLimit = 200 * 1024;
const utf8 = new TextEncoder();
const validText = (limit: number) => z.string().trim().min(1).max(limit)
  .refine(text => !text.includes("\0") && !/[\uD800-\uDFFF]/u.test(text));
const normalizeName = (title: string) => title.normalize("NFKC").replace(/[\p{White_Space}\uFEFF]+/gu, " ").trim();
const normalizedName = (limit: number) => validText(limit)
  .transform(normalizeName)
  .pipe(validText(limit));
const deckTitle = normalizedName(flashcardDeckTitleLimit);
export const flashcardCollectionTitleKey = (title: string) => normalizeName(title).toLocaleLowerCase("es").normalize("NFKC");
const newDeckTitle = deckTitle.refine(title => flashcardCollectionTitleKey(title) !== "general");
const category = normalizedName(flashcardCategoryLimit);
const cardText = validText(flashcardTextLimit);

const card = z.strictObject({
  question: cardText,
  answer: cardText,
  source: validText(flashcardSourceLabelLimit).optional(),
});

const cards = z.array(card).min(1).max(flashcardImportLimit);
const deck = z.strictObject({ title: deckTitle, category: category.optional() });
const envelope = z.strictObject({
  version: z.literal(1),
  deck: deck.optional(),
  cards,
});

const setDeck = deck.extend({ title: newDeckTitle, cards });
const setEnvelope = z.strictObject({
  version: z.literal(1),
  set: z.strictObject({ title: deckTitle }),
  decks: z.array(setDeck).min(1).max(flashcardImportLimit),
});

export const flashcardImportDestinationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("existing"), deck_id: flashcardDeckIdSchema }),
  z.strictObject({
    kind: z.literal("new"),
    title: newDeckTitle,
    category: category.optional(),
    set_id: z.uuid().optional(),
  }),
]);

export const flashcardImportReceiptSchema = z.object({
  deck: flashcardDeckSchema,
  imported_count: z.number().int().min(1).max(flashcardImportLimit),
});

export const flashcardSetImportReceiptSchema = flashcardImportReceiptSchema.omit({ deck: true })
  .extend({ set: flashcardSetSchema });

export type FlashcardImportPlan = z.infer<typeof envelope> | z.infer<typeof setEnvelope>;
type FlashcardImportCard = z.infer<typeof card>;
export type FlashcardImportDestination = z.infer<typeof flashcardImportDestinationSchema>;
export type FlashcardImportReceipt = z.infer<typeof flashcardImportReceiptSchema> | z.infer<typeof flashcardSetImportReceiptSchema>;
export type FlashcardImportBatch = { destination: FlashcardImportDestination; cards: FlashcardImportCard[] }
  | Omit<z.infer<typeof setEnvelope>, "version">;
export type FlashcardImportIssue =
  | { code: "size" | "syntax" | "version" | "format" | "deck" | "count" | "set" | "set_decks" | "set_count" | "duplicate_decks" | "single_deck" }
  | { code: "card"; index: number }
  | { code: "set_deck"; index: number }
  | { code: "set_card"; index: number; deckIndex: number };
type Result = { plan: FlashcardImportPlan; issue?: never } | { issue: FlashcardImportIssue; plan?: never };

function parseSet(data: unknown, newDeckOnly: boolean): Result {
  const parsed = setEnvelope.safeParse(data);
  if (!parsed.success) {
    const [field, deckIndex, detail, index] = parsed.error.issues[0].path;
    if (field === "version") return { issue: { code: "version" } };
    if (field === "set") return { issue: { code: "set" } };
    if (field === "decks" && typeof deckIndex === "number") {
      return { issue: detail === "cards" && typeof index === "number"
        ? { code: "set_card", deckIndex: deckIndex + 1, index: index + 1 }
        : { code: "set_deck", index: deckIndex + 1 } };
    }
    return { issue: { code: "set_decks" } };
  }
  const { decks } = parsed.data;
  if (newDeckOnly && decks.length !== 1) return { issue: { code: "single_deck" } };
  if (decks.reduce((total, deck) => total + deck.cards.length, 0) > flashcardImportLimit)
    return { issue: { code: "set_count" } };
  if (new Set(decks.map(deck => flashcardCollectionTitleKey(deck.title))).size !== decks.length)
    return { issue: { code: "duplicate_decks" } };
  return { plan: parsed.data };
}

export function parseFlashcardImport(value: string, newDeckOnly = false): Result {
  if (utf8.encode(value).byteLength > inputByteLimit) return { issue: { code: "size" } };
  const input = value.trim();
  // Some assistants wrap the complete JSON response in a single fenced block.
  const fenced = /^\x60{3}(?:json)?[ \t]*\r?\n([\s\S]+?)\r?\n\x60{3}$/iu.exec(input);
  let data: unknown;
  try {
    data = JSON.parse(fenced?.[1] ?? input);
  } catch {
    return { issue: { code: "syntax" } };
  }
  if (data && typeof data === "object" && ("set" in data || "decks" in data)) return parseSet(data, newDeckOnly);
  const parsed = envelope.safeParse(data);
  if (parsed.success) {
    if (newDeckOnly && (!parsed.data.deck || !newDeckTitle.safeParse(parsed.data.deck.title).success))
      return { issue: { code: "single_deck" } };
    return { plan: parsed.data };
  }
  const [field, index] = parsed.error.issues[0].path;
  if (field === "version") return { issue: { code: "version" } };
  if (field === "deck") return { issue: { code: "deck" } };
  if (field === "cards") return { issue: typeof index === "number" ? { code: "card", index: index + 1 } : { code: "count" } };
  return { issue: { code: "format" } };
}

export function selectedFlashcardSetDecks(
  decks: z.infer<typeof setDeck>[], selected: readonly boolean[],
) {
  let offset = 0;
  return decks.flatMap(deck => {
    const cards = deck.cards.filter((_, index) => selected[offset + index]);
    offset += deck.cards.length;
    return cards.length ? [{ ...deck, cards }] : [];
  });
}

export function fitsFlashcardImportRequest(batch: FlashcardImportBatch): boolean {
  const request_key = "00000000-0000-4000-8000-000000000000";
  return utf8.encode(JSON.stringify({ ...batch, request_key })).byteLength <= requestByteLimit;
}
