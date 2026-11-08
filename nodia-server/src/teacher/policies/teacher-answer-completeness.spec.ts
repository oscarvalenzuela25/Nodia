import { describe, expect, it } from 'vitest';
import {
  isCompleteTeacherAnswer,
  teacherAnswerStatus,
} from './teacher-answer-completeness.js';
describe('Teacher answer completeness', () => {
  it('keeps cleared or whitespace-only text incomplete, distinct from explicit dont_know', () => {
    expect(isCompleteTeacherAnswer(null)).toBe(false);
    expect(isCompleteTeacherAnswer({ kind: 'completion', text: '' })).toBe(
      false,
    );
    expect(
      isCompleteTeacherAnswer({ kind: 'short_text', text: ' \t\n\u00a0 ' }),
    ).toBe(false);
    expect(isCompleteTeacherAnswer({ kind: 'dont_know' })).toBe(true);
    expect(isCompleteTeacherAnswer({ kind: 'completion', text: ' DNS ' })).toBe(
      true,
    );
  });
  it('projects blank drafts as empty without changing confirmed submission', () => {
    expect(teacherAnswerStatus({ kind: 'completion', text: '' }, false)).toBe(
      'empty',
    );
    expect(
      teacherAnswerStatus({ kind: 'short_text', text: '\u00a0' }, false),
    ).toBe('empty');
    expect(teacherAnswerStatus({ kind: 'dont_know' }, false)).toBe('dont_know');
    expect(
      teacherAnswerStatus(
        { kind: 'single_choice', option_id: 'opaque' },
        false,
      ),
    ).toBe('draft');
    expect(teacherAnswerStatus({ kind: 'completion', text: 'DNS' }, true)).toBe(
      'submitted',
    );
  });
});
