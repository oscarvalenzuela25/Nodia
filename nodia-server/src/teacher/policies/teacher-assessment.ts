import type { PrivateKey, TeacherAnswer } from '../types/teacher.types.js';
import { teacherError } from './teacher-validation.js';

export function normalizeCompletion(
  value: string,
  caseSensitive: boolean,
): string {
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  return caseSensitive ? normalized : normalized.toLocaleLowerCase('und');
}
export function deterministicGrade(
  answer: TeacherAnswer,
  key: PrivateKey,
): { state: 'graded' | 'pending' | 'needs_review'; points: number | null } {
  if (answer.kind === 'dont_know') return { state: 'graded', points: 0 };
  if (answer.kind !== key.kind) teacherError('invalid_input', 400);
  if (key.kind === 'single_choice' && answer.kind === 'single_choice')
    return {
      state: 'graded',
      points: answer.option_id === key.option_id ? 2 : 0,
    };
  if (key.kind === 'completion' && answer.kind === 'completion') {
    if (key.ambiguous) return { state: 'needs_review', points: null };
    const normalized = normalizeCompletion(answer.text, key.case_sensitive);
    return {
      state: 'graded',
      points: key.alternatives.some(
        (a) => normalizeCompletion(a, key.case_sensitive) === normalized,
      )
        ? 2
        : 0,
    };
  }
  return { state: 'pending', points: null };
}
export function aggregateGrade(
  scope: string,
  denominator: number,
  rows: readonly {
    grade_state: string;
    earned_points: number | null;
    max_points: number;
  }[],
  assisted: boolean,
) {
  if (
    !Number.isSafeInteger(denominator) ||
    denominator <= 0 ||
    rows.length === 0 ||
    rows.some(
      (r) => !Number.isSafeInteger(r.max_points) || r.max_points <= 0,
    ) ||
    rows.reduce((s, r) => s + r.max_points, 0) !== denominator
  )
    teacherError('invalid_assessment', 409);
  if (rows.some((r) => r.grade_state !== 'graded' || r.earned_points === null))
    return {
      state: 'grading_pending',
      result: scope === 'section_final' ? 'pending' : null,
      earned_points: null,
      percentage: null,
    };
  if (
    rows.some(
      (r) =>
        !Number.isSafeInteger(r.earned_points) ||
        r.earned_points! < 0 ||
        r.earned_points! > r.max_points,
    )
  )
    teacherError('invalid_generated_content', 422);
  const earned = rows.reduce((s, r) => s + r.earned_points!, 0);
  return {
    state: 'graded',
    result:
      scope !== 'section_final'
        ? null
        : assisted
          ? 'not_independent'
          : BigInt(earned) * 100n >= BigInt(denominator) * 90n
            ? 'passed'
            : 'not_passed',
    earned_points: earned,
    percentage: (100 * earned) / denominator,
  };
}
export function validateWrittenFeedback(
  value: unknown,
  expected: readonly {
    response_id: string;
    criterion_ids: readonly string[];
  }[],
): {
  response_id: string;
  points: number;
  criteria: { criterion_id: string; points: number; comment: string }[];
  explanation: string;
  uncertain: boolean;
}[] {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (k) => k !== 'schema_version' && k !== 'responses',
    ) ||
    (value as { schema_version?: unknown }).schema_version !== 1
  )
    teacherError('invalid_generated_content', 422);
  const rows = (value as { responses?: unknown }).responses;
  if (!Array.isArray(rows) || rows.length !== expected.length)
    teacherError('invalid_generated_content', 422);
  const seen = new Set<string>();
  return rows.map((row) => {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      Object.keys(row).some(
        (k) =>
          !['response_id', 'criteria', 'uncertain', 'explanation'].includes(k),
      )
    )
      teacherError('invalid_generated_content', 422);
    const r = row as Record<string, unknown>;
    const target = expected.find((e) => e.response_id === r.response_id);
    if (
      !target ||
      seen.has(target.response_id) ||
      typeof r.uncertain !== 'boolean' ||
      typeof r.explanation !== 'string' ||
      !r.explanation.trim() ||
      r.explanation.length > 3000 ||
      !Array.isArray(r.criteria) ||
      r.criteria.length !== 3
    )
      teacherError('invalid_generated_content', 422);
    seen.add(target.response_id);
    const criteria = r.criteria.map((raw: unknown, index: number) => {
      if (
        !raw ||
        typeof raw !== 'object' ||
        Array.isArray(raw) ||
        Object.keys(raw).some(
          (k) => !['criterion_id', 'points', 'comment'].includes(k),
        )
      )
        teacherError('invalid_generated_content', 422);
      const c = raw as Record<string, unknown>;
      if (
        c.criterion_id !== target.criterion_ids[index] ||
        typeof c.points !== 'number' ||
        !Number.isInteger(c.points) ||
        c.points < 0 ||
        c.points > 2 ||
        typeof c.comment !== 'string' ||
        c.comment.length > 1000
      )
        teacherError('invalid_generated_content', 422);
      return {
        criterion_id: String(c.criterion_id),
        points: c.points,
        comment: c.comment,
      };
    });
    return {
      response_id: target.response_id,
      points: criteria.reduce((s, c) => s + c.points, 0),
      criteria,
      explanation: r.explanation,
      uncertain: r.uncertain,
    };
  });
}
