import { z } from "zod";
import {
  flashcardCategoryLimit, flashcardDeckIdSchema, flashcardDeckSchema, flashcardDeckTitleLimit,
  flashcardSourceLabelLimit, flashcardTextLimit,
} from "./flashcards";

export const flashcardImportLimit = 30;
const inputByteLimit = 512 * 1024;
const requestByteLimit = 200 * 1024;
const utf8 = new TextEncoder();
const validText = (limit: number) => z.string().trim().min(1).max(limit)
  .refine(text => !text.includes("\0") && !/[\uD800-\uDFFF]/u.test(text));
const normalizedName = (limit: number) => validText(limit)
  .transform(text => text.normalize("NFKC").replace(/[\p{White_Space}\uFEFF]+/gu, " ").trim())
  .pipe(validText(limit));
const deckTitle = normalizedName(flashcardDeckTitleLimit);
const category = normalizedName(flashcardCategoryLimit);
const cardText = validText(flashcardTextLimit);

const card = z.strictObject({
  question: cardText,
  answer: cardText,
  source: validText(flashcardSourceLabelLimit).optional(),
});

const envelope = z.strictObject({
  version: z.literal(1),
  deck: z.strictObject({ title: deckTitle, category: category.optional() }).optional(),
  cards: z.array(card).min(1).max(flashcardImportLimit),
});

export const flashcardImportDestinationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("existing"), deck_id: flashcardDeckIdSchema }),
  z.strictObject({
    kind: z.literal("new"),
    title: deckTitle.refine(title => title.toLocaleLowerCase("es") !== "general"),
    category: category.optional(),
  }),
]);

export const flashcardImportReceiptSchema = z.object({
  deck: flashcardDeckSchema,
  imported_count: z.number().int().min(1).max(flashcardImportLimit),
});

export type FlashcardImportPlan = z.infer<typeof envelope>;
type FlashcardImportCard = z.infer<typeof card>;
export type FlashcardImportDestination = z.infer<typeof flashcardImportDestinationSchema>;
export type FlashcardImportReceipt = z.infer<typeof flashcardImportReceiptSchema>;
export type FlashcardImportBatch = { destination: FlashcardImportDestination; cards: FlashcardImportCard[] };
export type FlashcardImportIssue =
  | { code: "size" | "syntax" | "version" | "format" | "deck" | "count" }
  | { code: "card"; index: number };
type Result = { plan: FlashcardImportPlan; issue?: never } | { issue: FlashcardImportIssue; plan?: never };

export function parseFlashcardImport(value: string): Result {
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
  const parsed = envelope.safeParse(data);
  if (parsed.success) return { plan: parsed.data };
  const [field, index] = parsed.error.issues[0].path;
  if (field === "version") return { issue: { code: "version" } };
  if (field === "deck") return { issue: { code: "deck" } };
  if (field === "cards") return { issue: typeof index === "number" ? { code: "card", index: index + 1 } : { code: "count" } };
  return { issue: { code: "format" } };
}

export function fitsFlashcardImportRequest(batch: FlashcardImportBatch): boolean {
  const request_key = "00000000-0000-4000-8000-000000000000";
  return utf8.encode(JSON.stringify({ ...batch, request_key })).byteLength <= requestByteLimit;
}
