import type { EntityManager } from 'typeorm';
import {
  readFlashcardGenerationTarget,
  readFlashcardTextProposal,
} from '../policies/teacher-flashcard-generation.js';
import { readFlashcardSource } from '../policies/teacher-flashcards.js';
import { hash, teacherError } from '../policies/teacher-validation.js';
import type { TeacherGenerationJob } from '../types/teacher.types.js';
import {
  readAnchor,
  rejectFinalHelp,
} from './teacher-enrichment-persistence.js';

export async function flashcardLessonCard(
  manager: EntityManager,
  owner: string,
  reference: { card_id: string; revision: number },
) {
  const [card]: {
    question: string;
    answer: string;
    revision: number;
    source: unknown;
  }[] = await manager.query(
    'SELECT question,answer,revision,source FROM teacher_flashcards WHERE owner_user_id=$1 AND id=$2',
    [owner, reference.card_id],
  );
  if (!card) teacherError('not_found', 404);
  if (card.revision !== reference.revision) teacherError('revision_conflict');
  const source = readFlashcardSource(card.source)?.anchor;
  if (!source) teacherError('invalid_anchor', 409);
  return { source, question: card.question, answer: card.answer };
}

export async function requireFlashcardGenerationTarget(
  manager: EntityManager,
  sessionId: string,
  owner: string,
  input: Record<string, unknown>,
) {
  const { source, card } = readFlashcardGenerationTarget(input);
  if (source.session_id !== sessionId) teacherError('invalid_anchor', 409);
  await rejectFinalHelp(manager, sessionId);
  await readAnchor(manager, sessionId, { ...source }, true);
  if (card) {
    const current = await flashcardLessonCard(manager, owner, card);
    if (hash(current.source) !== hash(source))
      teacherError('invalid_anchor', 409);
  }
}

export async function publishFlashcardText(
  manager: EntityManager,
  job: TeacherGenerationJob,
  output: string,
) {
  await requireFlashcardGenerationTarget(
    manager,
    job.session_id,
    job.actor_id,
    job.input_snapshot,
  );
  return { proposal: readFlashcardTextProposal(output) };
}
