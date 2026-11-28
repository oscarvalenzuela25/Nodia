import {
  FLASHCARD_IMPORT_MAX_BYTES,
  FLASHCARD_IMPORT_MAX_CARDS,
  type FlashcardDeckDefinition,
  type FlashcardImportCard,
} from '../types/teacher-flashcards.types.js';
import {
  flashcardCollectionTitle,
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

export function readFlashcardImportContent(
  rawDestination: unknown,
  rawCards: unknown,
) {
  const destination = readDestination(rawDestination);
  if (
    !Array.isArray(rawCards) ||
    !rawCards.length ||
    rawCards.length > FLASHCARD_IMPORT_MAX_CARDS
  )
    teacherError('invalid_input', 400);
  const cards = rawCards.map(readCard);
  return { destination, cards };
}

export function readFlashcardImport(raw: unknown) {
  const input = object(raw, ['request_key', 'destination', 'cards']);
  const requestKey = requireUuid(input.request_key).toLowerCase();
  const { destination, cards } = readFlashcardImportContent(
    input.destination,
    input.cards,
  );
  if (Buffer.byteLength(JSON.stringify(input)) > FLASHCARD_IMPORT_MAX_BYTES)
    teacherError('flashcard_import_too_large', 413);
  return { requestKey, destination, cards };
}

export function readFlashcardSetImport(raw: unknown) {
  const input = object(raw, ['request_key', 'set', 'decks']);
  const requestKey = requireUuid(input.request_key).toLowerCase();
  if (Buffer.byteLength(JSON.stringify(input)) > FLASHCARD_IMPORT_MAX_BYTES)
    teacherError('flashcard_import_too_large', 413);
  const set = flashcardCollectionTitle(object(input.set, ['title']).title);
  if (
    !Array.isArray(input.decks) ||
    !input.decks.length ||
    input.decks.length > FLASHCARD_IMPORT_MAX_CARDS
  )
    teacherError('invalid_input', 400);
  let cardCount = 0;
  const titles = new Set<string>();
  const decks = input.decks.map((rawDeck) => {
    const deck = object(rawDeck, ['title', 'category', 'cards']);
    const definition = flashcardDeckDefinition(deck.title, deck.category);
    if (titles.has(definition.normalizedTitle))
      teacherError('flashcard_deck_duplicate');
    titles.add(definition.normalizedTitle);
    if (!Array.isArray(deck.cards) || !deck.cards.length)
      teacherError('invalid_input', 400);
    cardCount += deck.cards.length;
    if (cardCount > FLASHCARD_IMPORT_MAX_CARDS)
      teacherError('invalid_input', 400);
    return { definition, cards: deck.cards.map(readCard) };
  });
  // All requests acquire unique deck titles in the same order.
  decks.sort((a, b) =>
    a.definition.normalizedTitle < b.definition.normalizedTitle ? -1 : 1,
  );
  return { requestKey, set, decks, cardCount };
}
