import { createHash } from 'node:crypto';
import type {
  LearningObservation,
  LearningObjective,
  LearningRecommendation,
} from '../types/teacher-learning.types.js';
import { teacherError, text } from './teacher-validation.js';

export function learningMetadata(explanation: unknown, confidence: unknown) {
  if (
    confidence !== null &&
    confidence !== undefined &&
    (!Number.isInteger(confidence) ||
      Number(confidence) < 0 ||
      Number(confidence) > 100)
  )
    teacherError('invalid_input', 400);
  return {
    self_explanation: explanation == null ? null : text(explanation, 0, 2000),
    confidence: confidence == null ? null : Number(confidence),
  };
}

/** Only actual graded observations guide recommendations; declarations never become grades. */
export function recommendLearning(
  objectives: readonly LearningObjective[],
  observations: readonly LearningObservation[],
): LearningRecommendation[] {
  return objectives.slice(0, 24).map((objective) => {
    const evidence = observations
      .filter(
        (o) =>
          o.objective_id === objective.objective_id &&
          o.plan_revision_id === objective.plan_revision_id,
      )
      .slice(0, 6);
    const graded = evidence.filter(
      (o) => o.answer_state === 'graded' && o.earned_points !== null,
    );
    const latest = graded[0];
    const reason = !latest
      ? 'insufficient_evidence'
      : latest.earned_points! < latest.max_points
        ? 'reinforce'
        : !latest.independent
          ? 'independent_check'
          : 'retrieval';
    return {
      objective_id: objective.objective_id,
      reason,
      evidence_ids: evidence.map((o) => o.id),
      unit_id: objective.unit_ids[0] ?? null,
      activity_mode:
        reason === 'reinforce'
          ? 'discrimination'
          : reason === 'independent_check'
            ? 'composition'
            : 'recall',
    };
  });
}

/** Retain position when option wording refers to sequence/labels. Stable across readers/reloads. */
export function stableOptions<T extends { id: string; label: string }>(
  options: T[],
  seed: string,
  prompt = '',
): T[] {
  const semanticOrder =
    /(?:\b(?:first|second|third|previous|above|below|primera?|segunda?|tercera?|anterior|siguiente|arriba|abajo)\b|\b[A-E]\)|\b(?:option|opción|respuesta|answer)\s+[A-E1-5]\b)/iu;
  if (
    semanticOrder.test([prompt, ...options.map((o) => o.label)].join(' ')) ||
    options.every((o) => /^[-+]?\d/.test(o.label)) ||
    options.some((o) =>
      /\b(?:all of|both|todas? las|ambas?|A y B|A and B)\b/iu.test(o.label),
    )
  )
    return options;
  return options
    .map((value) => ({
      value,
      rank: createHash('sha256').update(`${seed}:${value.id}`).digest('hex'),
    }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map((o) => o.value);
}
