import { describe, expect, it } from 'vitest';
import { projectReinforcement, type ReinforcementAttempt, type ReinforcementGrade } from './teacher-reinforcement.js';
import type { PlanOutline } from '../types/teacher.types.js';

// Synthetic persisted plan/grades: one objective can map to several units.
const outline = { sections: [{ id: 'section', objectives: [{ id: 'names', description: 'Names' }, { id: 'records', description: 'Record types' }], units: [
  { id: 'unit2', title: 'Records', objective_ids: ['records'] },
  { id: 'unit1', title: 'Names', objective_ids: ['names', 'records'] },
] }] } as PlanOutline;
const attempt: ReinforcementAttempt = { scope: 'section_final', state: 'graded', result: 'not_passed', plan_revision_id: 'frozen', section_id: 'section', earned_points: 3, denominator_points: 6 };
const grades: ReinforcementGrade[] = [
  { objective_ids: ['names'], grade_state: 'graded', earned_points: 2, max_points: 2 },
  { objective_ids: ['records'], grade_state: 'graded', earned_points: 1, max_points: 2 },
  { objective_ids: ['records'], grade_state: 'graded', earned_points: 0, max_points: 2 },
];

describe('Teacher focal reinforcement projection', () => {
  it('uses persisted objective scores and frozen plan order, including every matching unit', () => {
    expect(projectReinforcement(attempt, 'frozen', outline, grades)).toEqual({ plan_revision_id: 'frozen', section_id: 'section', navigation: 'current_plan', objectives: [{
      objective_id: 'records', description: 'Record types', earned_points: 1, possible_points: 4,
      units: [{ unit_id: 'unit2', title: 'Records' }, { unit_id: 'unit1', title: 'Names' }],
    }] });
  });
  it('retains real zero and reports missing points without inventing a per-objective pass threshold', () => {
    const zero = grades.map(row => ({ ...row, earned_points: 0 }));
    expect(projectReinforcement({ ...attempt, earned_points: 0 }, 'frozen', outline, zero)?.objectives.map(row => row.earned_points)).toEqual([0, 0]);
    const almost = [{ ...grades[0], earned_points: 99, max_points: 100 }, { ...grades[1], earned_points: 0, max_points: 100 }];
    expect(projectReinforcement({ ...attempt, earned_points: 99, denominator_points: 200 }, 'frozen', outline, almost)?.objectives[0].earned_points).toBe(99);
  });
  it('labels an old plan as history without remapping its units onto the current plan', () => {
    const result = projectReinforcement(attempt, 'different-plan', outline, grades);
    expect(result?.navigation).toBe('history_only');
    expect(result?.plan_revision_id).toBe('frozen');
    expect(result?.objectives[0].units[0].unit_id).toBe('unit2');
  });
  it('publishes no recommendation for a partial grade, practice, assisted result or passed final', () => {
    for (const change of [{ state: 'grading_pending' }, { scope: 'unit_practice' }, { result: 'not_independent' }, { result: 'passed' }]) {
      expect(projectReinforcement({ ...attempt, ...change }, 'frozen', outline, grades)).toBeNull();
    }
    expect(projectReinforcement(attempt, 'frozen', outline, [{ ...grades[0], grade_state: 'pending', earned_points: null }, ...grades.slice(1)])).toBeNull();
  });
  it('keeps absent, invalid or inconsistent evidence unavailable rather than inventing targets', () => {
    expect(projectReinforcement(attempt, 'frozen', null, grades)).toBeNull();
    expect(projectReinforcement(attempt, 'frozen', outline, [])).toBeNull();
    for (const change of [{ objective_ids: ['unknown'] }, { objective_ids: [] }, { earned_points: -1 }, { earned_points: 3 }, { max_points: 0 }]) {
      expect(projectReinforcement(attempt, 'frozen', outline, [{ ...grades[0], ...change }, ...grades.slice(1)])).toBeNull();
    }
    expect(projectReinforcement({ ...attempt, earned_points: 4 }, 'frozen', outline, grades)).toBeNull();
    for (const value of [null, undefined, 'records', [0]]) {
      expect(projectReinforcement(attempt, 'frozen', outline, [{ ...grades[0], objective_ids: value as unknown as string[] }, ...grades.slice(1)])).toBeNull();
    }
  });
});
