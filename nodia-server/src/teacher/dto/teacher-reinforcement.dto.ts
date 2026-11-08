/** Public read projection. It contains no answers, private keys or mastery threshold. */
export interface TeacherReinforcementDto {
  plan_revision_id: string;
  section_id: string;
  navigation: 'current_plan' | 'history_only';
  objectives: {
    objective_id: string;
    description: string;
    earned_points: number;
    possible_points: number;
    units: { unit_id: string; title: string }[];
  }[];
}
