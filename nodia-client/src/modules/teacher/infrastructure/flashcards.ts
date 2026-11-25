import { z } from "zod";

export const flashcardGeneralDeck = "general";
export const flashcardPageSize = 12;
export const flashcardDeckPageSize = 10;
export const flashcardTextLimit = 2000;
export const flashcardDeckTitleLimit = 120;
export const flashcardCategoryLimit = 80;
export const flashcardSourceLabelLimit = 200;
export const flashcardImageByteLimit = 144 * 1024;

export const flashcardDeckIdSchema = z.union([z.literal(flashcardGeneralDeck), z.uuid()]);
const nonnegative = z.number().int().nonnegative();
const revision = z.number().int().positive();
const side = z.enum(["question", "answer"]);
const cardText = z.string().trim().min(1).max(flashcardTextLimit);
const anchor = z.object({
  session_id: z.uuid(),
  content_version_id: z.uuid(),
  block_id: z.string().min(1).max(64),
  selection: z.string().min(1).max(flashcardTextLimit).refine(selection => Boolean(selection.trim())),
});

export const flashcardSourceSchema = z.object({
  label: z.string().trim().min(1).max(flashcardSourceLabelLimit),
  anchor: anchor.optional(),
});

export const flashcardDeckSchema = z.object({
  id: flashcardDeckIdSchema,
  title: z.string().trim().min(1).max(flashcardDeckTitleLimit),
  card_count: nonnegative,
  category: z.string().trim().min(1).max(flashcardCategoryLimit).nullable().optional(),
  set_id: z.uuid().nullable().optional(),
});

export const flashcardSetSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(flashcardDeckTitleLimit),
  deck_count: nonnegative,
});

export const flashcardSchema = z.object({
  id: z.uuid(),
  deck_id: flashcardDeckIdSchema,
  question: cardText,
  answer: cardText,
  revision,
  image: z.object({ side }).nullable(),
  source: flashcardSourceSchema.nullable(),
});

export const flashcardDecksSchema = z.array(flashcardDeckSchema);
export const flashcardSetsSchema = z.array(flashcardSetSchema);
export const flashcardPageSchema = z.object({
  data: z.array(flashcardSchema).max(flashcardPageSize),
  meta: z.object({
    page: z.number().int().positive(),
    total: nonnegative,
    total_pages: nonnegative,
  }),
});

export type FlashcardDeck = z.infer<typeof flashcardDeckSchema>;
export type FlashcardSet = z.infer<typeof flashcardSetSchema>;
export type FlashcardDeckFields = { title: string; category?: string | null; set_id?: string | null };
export type Flashcard = z.infer<typeof flashcardSchema>;
export type FlashcardPage = z.infer<typeof flashcardPageSchema>;
export type FlashcardSource = z.infer<typeof flashcardSourceSchema>;
export type FlashcardSide = z.infer<typeof side>;
export type FlashcardImageWrite = { data: string; side: FlashcardSide };
export type FlashcardDraft = {
  question: string;
  answer: string;
  deck_id?: string;
  source?: FlashcardSource | null;
  image?: FlashcardImageWrite | null;
};
export type FlashcardUpdate = Partial<FlashcardDraft> & { revision: number; image_side?: FlashcardSide };
