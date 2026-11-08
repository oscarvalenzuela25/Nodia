import { describe, expect, it } from 'vitest';
import { teacherGenerationDeadline } from './teacher-generation-deadline.js';
import type { TeacherPurpose } from '../types/teacher.types.js';

describe('Teacher execution deadline', () => {
  const now = Date.parse('2026-11-03T12:00:00.000Z');
  const admitted = new Date(now + 600000);

  it.each([
    ['learning_packet', 300000],
    ['assessment_only', 300000],
    ['setup_reply', 300000],
    ['plan_outline', 300000],
    ['plan_adjustment', 300000],
    ['written_feedback', 120000],
  ] as const)('limits %s to its authorized execution budget', (purpose, budget) => {
    expect(teacherGenerationDeadline(purpose, admitted, now)).toBe(now + budget);
  });

  it('preserves a nearer admitted deadline and never revives an expired job', () => {
    for (const purpose of ['learning_packet', 'assessment_only', 'setup_reply', 'plan_outline', 'plan_adjustment', 'written_feedback'] as const) {
      expect(teacherGenerationDeadline(purpose, new Date(now + 20000), now)).toBe(now + 20000);
      expect(teacherGenerationDeadline(purpose, new Date(now - 1), now)).toBe(now - 1);
    }
  });

  it('keeps an already bounded 120-second absolute deadline for newly expanded purposes', () => {
    const originalDeadline = new Date(now + 120000);
    for (const purpose of ['setup_reply', 'plan_outline', 'plan_adjustment'] as const) {
      expect(teacherGenerationDeadline(purpose, originalDeadline, now)).toBe(originalDeadline.getTime());
      expect(originalDeadline.getTime()).toBe(now + 120000);
    }
  });

  it('rejects missing or invalid purpose/deadline instead of granting a longer budget', () => {
    for (const purpose of [null, undefined, 'other']) {
      expect(() => teacherGenerationDeadline(purpose as TeacherPurpose, admitted, now)).toThrow('teacher:invalid_runtime_deadline');
    }
    for (const deadline of [null, undefined, new Date(NaN)]) {
      expect(() => teacherGenerationDeadline('learning_packet', deadline as Date, now)).toThrow('teacher:invalid_runtime_deadline');
    }
    expect(() => teacherGenerationDeadline('learning_packet', admitted, NaN)).toThrow('teacher:invalid_runtime_deadline');
  });
});
