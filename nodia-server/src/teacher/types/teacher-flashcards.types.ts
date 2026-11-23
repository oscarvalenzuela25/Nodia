export const flashcardImageSides = ['question', 'answer'] as const;
export type FlashcardImageSide = (typeof flashcardImageSides)[number];
export const FLASHCARD_IMPORT_MAX_CARDS = 30;
export const FLASHCARD_IMPORT_MAX_BYTES = 200 * 1024;

export interface FlashcardAnchor {
  session_id: string;
  content_version_id: string;
  block_id: string;
  selection: string;
}

export interface FlashcardSource {
  label: string;
  anchor?: FlashcardAnchor;
}

export interface FlashcardDeck {
  id: string;
  title: string;
  category: string | null;
  card_count: number;
}

export interface FlashcardDeckDefinition {
  title: string;
  normalizedTitle: string;
  category: string | null;
}

export interface Flashcard {
  id: string;
  deck_id: string;
  question: string;
  answer: string;
  revision: number;
  image: { side: FlashcardImageSide } | null;
  source: FlashcardSource | null;
}

export interface FlashcardPage {
  data: Flashcard[];
  meta: { page: number; total: number; total_pages: number };
}

export type FlashcardImage = { bytes: Buffer; side: FlashcardImageSide };

export type FlashcardCreate = Pick<
  Flashcard,
  'question' | 'answer' | 'source'
> & {
  deckId: string | null;
  image: FlashcardImage | null;
};

export type FlashcardPatch = Partial<FlashcardCreate> & {
  revision: number;
  imageSide?: FlashcardImageSide;
};

export type FlashcardImportCard = Pick<
  FlashcardCreate,
  'question' | 'answer' | 'source'
>;

export interface FlashcardImportResult {
  deck: FlashcardDeck;
  imported_count: number;
}
