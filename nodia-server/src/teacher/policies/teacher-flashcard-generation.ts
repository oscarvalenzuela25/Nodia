import { readFlashcardAnchor } from './teacher-flashcards.js';
import {
  object,
  parseJsonOutput,
  requireUuid,
  selection,
  teacherError,
  text,
} from './teacher-validation.js';

function readCardReference(cardId: unknown, revision: unknown) {
  if (
    typeof revision !== 'number' ||
    !Number.isInteger(revision) ||
    revision < 1 ||
    revision >= 2147483647
  )
    teacherError('invalid_input', 400);
  return { card_id: requireUuid(cardId).toLowerCase(), revision };
}

export function readFlashcardGenerationRequest(value: unknown) {
  const input = object(value, [
    'request_key',
    'source',
    'selection',
    'card_id',
    'revision',
    'parts',
  ]);
  const key = requireUuid(input.request_key).toLowerCase();
  const selected = selection(input.selection);
  if (input.source !== undefined) {
    if (
      input.card_id !== undefined ||
      input.revision !== undefined ||
      input.parts !== undefined
    )
      teacherError('invalid_input', 400);
    return {
      key,
      selection: selected,
      source: readFlashcardAnchor(input.source),
    };
  }
  if (input.parts !== 'text') teacherError('invalid_input', 400);
  return {
    key,
    selection: selected,
    card: readCardReference(input.card_id, input.revision),
  };
}

export function readFlashcardGenerationTarget(input: Record<string, unknown>) {
  const source = readFlashcardAnchor(input.source);
  if (input.card === undefined) return { source, card: null };
  const card = object(input.card, ['card_id', 'revision']);
  return { source, card: readCardReference(card.card_id, card.revision) };
}

export function readFlashcardTextProposal(output: string) {
  const value = object(parseJsonOutput(output), [
    'schema_version',
    'question',
    'answer',
  ]);
  if (value.schema_version !== 1)
    teacherError('invalid_generated_content', 422);
  return {
    question: text(value.question, 1, 2000),
    answer: text(value.answer, 1, 2000),
  };
}
