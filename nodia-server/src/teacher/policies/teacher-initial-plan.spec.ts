import { describe, expect, it } from 'vitest';
import { initialPlanInput } from './teacher-initial-plan.js';

describe('Initial Teacher plan request', () => {
  it('leaves scheduling unknown for Teacher to propose; never defaults it to topics or a day count', () => {
    expect(initialPlanInput(undefined, undefined)).toMatchObject({ organization: 'teacher_suggests', day_count: null });
    expect(initialPlanInput('days', null)).toMatchObject({ organization: 'days', day_count: null });
    expect(initialPlanInput('days', 12)).toMatchObject({ organization: 'days', day_count: 12 });
    expect(initialPlanInput('topics', null)).toMatchObject({ organization: 'topics', day_count: null });
  });
  it('rejects incompatible scheduling without silently correcting the explicit request', () => {
    for (const [organization, days] of [['topics', 2], ['weekly', null], ['days', 0], ['days', 366], ['days', 1.5], ['days', '10']])
      expect(() => initialPlanInput(organization, days)).toThrow('teacher:invalid_input');
  });
});
