import {
  FLASHCARD_IMPORT_MAX_BYTES,
  FLASHCARD_IMPORT_MAX_CARDS,
  type FlashcardDeckDefinition,
  type FlashcardImportCard,
} from '../types/teacher-flashcards.types.js';
import {
  flashcardDeckDefinition,
  flashcardDeckId,
  readFlashcardSource,
} from './teacher-flashcards.js';
import {
  object,
  requireUuid,
  teacherError,
  text,
} from './teacher-validation.js';

type Destination =
  | { kind: 'existing'; deckId: string | null }
  | { kind: 'new'; deck: FlashcardDeckDefinition };

function readDestination(raw: unknown): Destination {
  const input = object(raw, ['kind', 'deck_id', 'title', 'category']);
  if (input.kind === 'existing') {
    object(input, ['kind', 'deck_id']);
    return { kind: 'existing', deckId: flashcardDeckId(input.deck_id) };
  }
  if (input.kind === 'new') {
    object(input, ['kind', 'title', 'category']);
    return {
      kind: 'new',
      deck: flashcardDeckDefinition(input.title, input.category),
    };
  }
  teacherError('invalid_input', 400);
}

function readCard(raw: unknown): FlashcardImportCard {
  const input = object(raw, ['question', 'answer', 'source']);
  return {
    question: text(input.question, 1, 2000),
    answer: text(input.answer, 1, 2000),
    source:
      input.source === undefined
        ? null
        : readFlashcardSource({ label: input.source }),
  };
}

export function readFlashcardImport(raw: unknown) {
  const input = object(raw, ['request_key', 'destination', 'cards']);
  const requestKey = requireUuid(input.request_key).toLowerCase();
  const destination = readDestination(input.destination);
  if (
    !Array.isArray(input.cards) ||
    !input.cards.length ||
    input.cards.length > FLASHCARD_IMPORT_MAX_CARDS
  )
    teacherError('invalid_input', 400);
  const cards = input.cards.map(readCard);
  if (Buffer.byteLength(JSON.stringify(input)) > FLASHCARD_IMPORT_MAX_BYTES)
    teacherError('flashcard_import_too_large', 413);
  return { requestKey, destination, cards };
}
