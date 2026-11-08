import { teacherError } from './teacher-validation.js';
export function validateCursorPhase(
  phase: unknown,
  anchors: {
    unit: unknown;
    content: unknown;
    attempt: unknown;
    item: unknown;
    block: unknown;
    attemptScope: string | null;
  },
) {
  if (
    !['setup', 'theory', 'practice', 'final', 'review'].includes(String(phase))
  )
    teacherError('invalid_input', 400);
  if ((anchors.item && !anchors.attempt) || (anchors.block && !anchors.content))
    teacherError('invalid_input', 400);
  if (phase === 'theory' && (!anchors.unit || !anchors.content))
    teacherError('invalid_input', 400);
  if (
    phase === 'final' &&
    (!anchors.attempt || anchors.attemptScope !== 'section_final')
  )
    teacherError('invalid_input', 400);
  if (
    phase === 'practice' &&
    ((!anchors.unit && anchors.attemptScope !== 'diagnostic') ||
      (anchors.attempt && anchors.attemptScope === 'section_final'))
  )
    teacherError('invalid_input', 400);
}
