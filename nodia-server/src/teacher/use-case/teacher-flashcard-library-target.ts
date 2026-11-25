import type { EntityManager } from 'typeorm';
import {
  readStoredFlashcardOrigin,
  type FlashcardLibraryPromptMaterial,
} from '../policies/teacher-flashcard-library.js';
import { readFlashcardSource } from '../policies/teacher-flashcards.js';
import { teacherError } from '../policies/teacher-validation.js';
import type { FlashcardAnchor } from '../types/teacher-flashcards.types.js';
import {
  readAnchor,
  rejectFinalHelp,
} from './teacher-enrichment-persistence.js';

async function requireOwnedQuote(
  manager: EntityManager,
  owner: string,
  anchor: FlashcardAnchor,
): Promise<FlashcardLibraryPromptMaterial> {
  const [session]: { explanation_language: string; state: string }[] =
    await manager.query(
      `SELECT explanation_language, state FROM teacher_sessions
     WHERE id=$1 AND owner_user_id=$2 FOR SHARE`,
      [anchor.session_id, owner],
    );
  if (!session) teacherError('not_found', 404);
  if (session.state === 'paused') teacherError('session_paused');
  if (session.state === 'archived') teacherError('session_archived');
  await rejectFinalHelp(manager, anchor.session_id);
  await readAnchor(manager, anchor.session_id, { ...anchor }, true);
  return { quote: anchor.selection, language: session.explanation_language };
}

/** Called under the current actor's authority before reserving, dispatching, or revealing a draft. */
export async function requireFlashcardLibraryTarget(
  manager: EntityManager,
  owner: string,
  value: Record<string, unknown>,
): Promise<FlashcardLibraryPromptMaterial> {
  const origin = readStoredFlashcardOrigin(value);
  if (origin.kind === 'notes') return {};
  if (origin.kind === 'quote')
    return requireOwnedQuote(manager, owner, origin.anchor);
  const [card]: {
    question: string;
    answer: string;
    revision: number;
    source: unknown;
  }[] = await manager.query(
    `SELECT question,answer,revision,source FROM teacher_flashcards
     WHERE owner_user_id=$1 AND id=$2 FOR SHARE`,
    [owner, origin.id],
  );
  if (!card) teacherError('not_found', 404);
  if (card.revision !== origin.revision) teacherError('revision_conflict');
  const source = readFlashcardSource(card.source)?.anchor;
  const material = source
    ? await requireOwnedQuote(manager, owner, source)
    : {};
  return {
    ...material,
    current_card: { question: card.question, answer: card.answer },
  };
}
