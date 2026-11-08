import type { PlanOutline } from '../types/teacher.types.js';
import type { TeacherReinforcementDto } from '../dto/teacher-reinforcement.dto.js';

export interface ReinforcementAttempt {
  scope: string;
  state: string;
  result: string | null;
  plan_revision_id: string | null;
  section_id: string | null;
  earned_points: number | null;
  denominator_points: number;
}
export interface ReinforcementGrade {
  objective_ids: string[];
  grade_state: string;
  earned_points: number | null;
  max_points: number;
}

export const canProjectReinforcement = (attempt: ReinforcementAttempt) =>
  attempt.scope === 'section_final' && attempt.state === 'graded' && attempt.result === 'not_passed';

/** Missing or inconsistent evidence never becomes a synthetic recommendation. */
export function projectReinforcement(
  attempt: ReinforcementAttempt,
  currentPlanId: string | null,
  frozenOutline: PlanOutline | null,
  grades: readonly ReinforcementGrade[],
): TeacherReinforcementDto | null {
  if (!canProjectReinforcement(attempt) || !attempt.plan_revision_id || !attempt.section_id || !frozenOutline || !grades.length) return null;
  if (!Number.isSafeInteger(attempt.earned_points) || attempt.earned_points === null || attempt.earned_points < 0 ||
    !Number.isSafeInteger(attempt.denominator_points) || attempt.denominator_points <= 0 || attempt.earned_points > attempt.denominator_points) return null;
  const section = frozenOutline.sections.find(value => value.id === attempt.section_id);
  if (!section) return null;
  const totals = new Map(section.objectives.map(value => [value.id, { earned: 0, possible: 0 }]));
  for (const grade of grades) {
    if (grade.grade_state !== 'graded' || !Number.isSafeInteger(grade.earned_points) || grade.earned_points === null ||
      !Number.isSafeInteger(grade.max_points) || grade.max_points <= 0 || grade.earned_points < 0 || grade.earned_points > grade.max_points ||
      !Array.isArray(grade.objective_ids) || grade.objective_ids.length !== 1 || typeof grade.objective_ids[0] !== 'string') return null;
    const total = totals.get(grade.objective_ids[0]);
    if (!total) return null;
    total.earned += grade.earned_points;
    total.possible += grade.max_points;
    if (!Number.isSafeInteger(total.earned) || !Number.isSafeInteger(total.possible)) return null;
  }
  const values = [...totals.values()];
  if (values.some(value => value.possible === 0) ||
    values.reduce((sum, value) => sum + value.possible, 0) !== attempt.denominator_points ||
    values.reduce((sum, value) => sum + value.earned, 0) !== attempt.earned_points) return null;
  return {
    plan_revision_id: attempt.plan_revision_id,
    section_id: attempt.section_id,
    navigation: currentPlanId === attempt.plan_revision_id ? 'current_plan' : 'history_only',
    objectives: section.objectives.flatMap(objective => {
      const total = totals.get(objective.id);
      return total && total.earned < total.possible ? [{
        objective_id: objective.id,
        description: objective.description,
        earned_points: total.earned,
        possible_points: total.possible,
        units: section.units.filter(unit => unit.objective_ids.includes(objective.id)).map(unit => ({ unit_id: unit.id, title: unit.title })),
      }] : [];
    }),
  };
}
