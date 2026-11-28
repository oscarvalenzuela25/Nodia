import { describe, expect, it } from 'vitest';
import {
  readFlashcardImport,
  readFlashcardImportContent,
  readFlashcardSetImport,
} from './teacher-flashcard-import.js';

const requestKey = 'fe0af13c-3385-4401-be2b-7dcf7b9d02df';
const validCard = { question: 'Why?', answer: 'Because.' };
const common = {
  request_key: requestKey,
  destination: { kind: 'existing', deck_id: 'general' },
  cards: [validCard],
};

describe('flashcard import policy', () => {
  it('normalizes titles, categories, and visible card text', () => {
    expect(
      readFlashcardImport({
        ...common,
        destination: {
          kind: 'new',
          title: '  Ｆirst   cards  ',
          category: '  Ｅnglish　grammar  ',
        },
        cards: [
          { ...validCard, answer: ' Because.   ', source: ' lesson notes ' },
        ],
      }),
    ).toEqual({
      requestKey,
      destination: {
        kind: 'new',
        deck: {
          title: 'First cards',
          normalizedTitle: 'first cards',
          category: 'English grammar',
        },
      },
      cards: [{ ...validCard, source: { label: 'lesson notes' } }],
    });
  });

  it('rejects unknown fields and invalid content before storage', () => {
    for (const candidate of [
      { ...common, destination: { ...common.destination, category: 'Extra' } },
      { ...common, destination: { ...common.destination, set_id: requestKey } },
      { ...common, destination: { kind: 'new', title: 'Valid', set_id: null } },
      {
        ...common,
        destination: { kind: 'new', title: 'Valid', category: ' ' },
      },
      {
        ...common,
        cards: [{ ...validCard, image: 'https://example.test/picture.webp' }],
      },
      {
        ...common,
        cards: [{ ...validCard, source: { label: 'Untrusted anchor' } }],
      },
      { ...common, cards: [{ ...validCard, answer: String.fromCharCode(0) }] },
      { ...common, cards: [{ ...validCard, question: ' ' }] },
      { ...common, cards: [] },
      { ...common, cards: Array.from({ length: 31 }, () => validCard) },
    ]) {
      expect(() => readFlashcardImport(candidate)).toThrow('invalid_input');
    }
  });

  it('normalizes the explicit target Set for a new deck', () => {
    const destination = {
      kind: 'new',
      title: 'Vocabulary',
      set_id: requestKey.toUpperCase(),
    };
    const result = readFlashcardImport({
      ...common,
      destination,
    });
    expect(result.destination).toEqual({
      kind: 'new',
      deck: {
        title: 'Vocabulary',
        normalizedTitle: 'vocabulary',
        category: null,
      },
      setId: requestKey,
    });
    expect(() => readFlashcardImportContent(destination, common.cards)).toThrow(
      'invalid_input',
    );
  });

  it('counts serialized UTF-8 bytes across otherwise valid cards', () => {
    const full = '学'.repeat(2000);
    const payload = (count: number) => ({
      ...common,
      cards: Array.from({ length: count }, () => ({
        question: full,
        answer: full,
      })),
    });
    expect(readFlashcardImport(payload(17)).cards).toHaveLength(17);
    expect(() => readFlashcardImport(payload(18))).toThrow(
      'flashcard_import_too_large',
    );
  });
});

describe('flashcard set import policy', () => {
  const input = {
    request_key: requestKey,
    set: { title: ' Set ' },
    decks: [{ title: ' Uno ', cards: [validCard] }],
  };

  it('rejects ambiguous and oversized batches across decks', () => {
    const read = (decks: unknown[]) => readFlashcardSetImport({ ...input, decks });
    expect(() => read([input.decks[0], { title: 'ＵＮＯ', cards: [validCard] }]))
      .toThrow('flashcard_deck_duplicate');
    expect(() => read([
      { title: 'Uno', cards: Array.from({ length: 30 }, () => validCard) },
      { title: 'Dos', cards: [validCard] },
    ])).toThrow('invalid_input');
    expect(() => read([{ title: 'Dos', cards: [{ ...validCard, source: { label: 'Invalid' } }] }]))
      .toThrow('invalid_input');
    const longCard = { question: '学'.repeat(2000), answer: '学'.repeat(2000) };
    expect(() => read([{ title: 'Uno', cards: Array.from({ length: 18 }, () => longCard) }]))
      .toThrow('flashcard_import_too_large');
  });
});
