import { defaultPolicy, teacherError } from './teacher-validation.js';

/** Missing scheduling values remain proposals for Teacher, never fabricated defaults. */
export function initialPlanInput(organization: unknown, dayCount: unknown) {
  const requested = organization ?? 'teacher_suggests';
  const days = dayCount ?? null;
  if (!['teacher_suggests', 'days', 'topics'].includes(String(requested))
    || (days !== null && (!Number.isInteger(days) || Number(days) < 1 || Number(days) > 365))
    || (requested === 'topics' && days !== null))
    teacherError('invalid_input', 400);
  return {
    messages: [], organization: requested, day_count: days,
    base: null, adjustment_text: null, policy: defaultPolicy(),
  };
}
