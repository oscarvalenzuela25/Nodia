export const LEARNING_POLICY = 'teacher-learning/1' as const;
export interface LearningDimension {
  id: string;
  description: string;
}
export interface DiagnosticBankItem {
  dimension_id: string;
  kind: 'single_choice' | 'completion';
  prompt: string;
  options?: { id: string; label: string }[];
  private_key:
    | { kind: 'single_choice'; option_id: string }
    | { kind: 'completion'; alternatives: string[]; case_sensitive: boolean };
  explanation: string;
}
export interface LearningBlueprint {
  id: string;
  session_id: string;
  revision: number;
  title: string;
  dimensions: LearningDimension[];
  items: DiagnosticBankItem[];
  reviewed: boolean;
}
export interface LearningObservation {
  id: string;
  objective_id: string;
  description: string;
  plan_revision_id: string | null;
  answer_state: 'graded' | 'pending' | 'needs_review';
  earned_points: number | null;
  max_points: number;
  assisted: boolean;
  independent: boolean;
  self_explanation: string | null;
  confidence: number | null;
  observed_at: string;
  attempt_id: string;
  response_id: string;
}
export interface LearningObjective {
  objective_id: string;
  description: string;
  plan_revision_id: string;
  section_id: string;
  unit_ids: string[];
}
export interface LearningRecommendation {
  objective_id: string;
  reason:
    'reinforce' | 'independent_check' | 'retrieval' | 'insufficient_evidence';
  evidence_ids: string[];
  unit_id: string | null;
  activity_mode: 'recall' | 'discrimination' | 'composition';
}
