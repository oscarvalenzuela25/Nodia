import { describe, expect, it } from 'vitest';
import {
  gradeActivity,
  validateActivity,
  validateVisual,
} from './teacher-enrichment-activities.js';
describe('Teacher declarative activity contracts', () => {
  it('requires a real permutation and distinguishes correctness from independent evidence', () => {
    const activity = validateActivity({
      kind: 'ordering',
      prompt: 'Order',
      payload: { items: ['read', 'write'] },
      solution: ['read', 'write'],
    });
    expect(gradeActivity(activity, ['write', 'read'])).toMatchObject({
      correct: false,
      assisted: true,
      independent: false,
      grants_verification: false,
    });
    expect(gradeActivity(activity, ['read', 'write']).correct).toBe(true);
    expect(() => gradeActivity(activity, ['read', 'read'])).toThrow();
  });
  it('checks every classification key and permits only the supplied categories', () => {
    const activity = validateActivity({
      kind: 'classification',
      prompt: 'Classify',
      payload: { items: ['A', 'B'], categories: ['X', 'Y'] },
      solution: { A: 'X', B: 'Y' },
    });
    expect(gradeActivity(activity, { A: 'X', B: 'Y' }).correct).toBe(true);
    expect(() => gradeActivity(activity, { A: 'X' })).toThrow();
    expect(() => gradeActivity(activity, { A: 'Z', B: 'Y' })).toThrow();
  });
  it('does not execute or admit unknown render types and preserves zero chart values', () => {
    expect(() =>
      validateActivity({
        kind: 'javascript',
        prompt: 'Run',
        payload: {},
        solution: 'alert(1)',
      }),
    ).toThrow();
    expect(() =>
      validateVisual({
        kind: 'bar_chart',
        title: 'Data',
        labels: ['A'],
        values: [0],
        script: 'alert(1)',
      }),
    ).toThrow();
    expect(
      validateVisual({
        kind: 'bar_chart',
        title: 'Data',
        labels: ['A'],
        values: [0],
      }).values,
    ).toEqual([0]);
  });
  it('normalizes text without silently ignoring case or accepting an absent answer', () => {
    const activity = validateActivity({
      kind: 'completion',
      prompt: 'Fill',
      payload: {},
      solution: 'café',
    });
    expect(gradeActivity(activity, ' cafe\u0301 ').correct).toBe(true);
    expect(gradeActivity(activity, 'CAFÉ').correct).toBe(false);
    expect(() => gradeActivity(activity, null)).toThrow();
  });
});
