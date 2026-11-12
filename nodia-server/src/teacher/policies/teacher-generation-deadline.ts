import type { TeacherPurpose } from '../types/teacher.types.js';

const executionBudgetMs: Readonly<Record<TeacherPurpose, number>> = {
  setup_reply: 300000,
  plan_outline: 300000,
  plan_adjustment: 300000,
  learning_packet: 300000,
  assessment_only: 300000,
  contextual_reply: 120_000,
  written_feedback: 120000,
};

/** The purpose budget never extends the admitted job's absolute deadline. */
export function teacherGenerationDeadline(
  purpose: TeacherPurpose,
  jobDeadline: Date,
  now: number,
): number {
  if (
    !Object.hasOwn(executionBudgetMs, purpose) ||
    !(jobDeadline instanceof Date) ||
    !Number.isFinite(jobDeadline.getTime()) ||
    !Number.isFinite(now)
  ) {
    throw Error('teacher:invalid_runtime_deadline');
  }
  return Math.min(jobDeadline.getTime(), now + executionBudgetMs[purpose]);
}
