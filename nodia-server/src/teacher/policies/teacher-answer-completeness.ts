import type { TeacherAnswer } from '../types/teacher.types.js';
/** A cleared input is a durable draft, never an implicit zero-point answer. */
export function isCompleteTeacherAnswer(value: TeacherAnswer | null): boolean {
  if (value === null) return false;
  return (
    value.kind === 'dont_know' ||
    value.kind === 'single_choice' ||
    value.text.trim().length > 0
  );
}
export function teacherAnswerStatus(
  draft: TeacherAnswer | null,
  submitted: boolean,
): 'submitted' | 'dont_know' | 'empty' | 'draft' {
  if (submitted) return 'submitted';
  if (draft?.kind === 'dont_know') return 'dont_know';
  return isCompleteTeacherAnswer(draft) ? 'draft' : 'empty';
}
