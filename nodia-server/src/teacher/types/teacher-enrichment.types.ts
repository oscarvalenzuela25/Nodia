export const ENRICHMENT_POLICY_VERSION = 'teacher-intervals/1' as const;
export type EnrichmentOperation =
  | 'card_create'
  | 'review_rate'
  | 'thread_create'
  | 'thread_message'
  | 'source_create'
  | 'activity_create'
  | 'activity_respond'
  | 'concept_create'
  | 'equivalence_set'
  | 'visual_create';
export interface ReviewSchedule {
  due_at: string;
  timezone: string;
  state: 'new' | 'learning' | 'review';
  interval_days: number;
  reviews: number;
}
export interface ReviewCard extends ReviewSchedule {
  id: string;
  revision: number;
  objective_id: string | null;
  question: string;
  answer: string;
}
export interface SourcePage {
  page: number;
  text: string;
}
export interface PreparedSource {
  title: string;
  media_type: 'text/plain' | 'application/pdf';
  pages: SourcePage[];
  notices: string[];
  content_hash: string;
}
export type ActivityKind =
  'ordering' | 'classification' | 'error_location' | 'completion';
export interface EnrichmentActivity {
  kind: ActivityKind;
  prompt: string;
  payload: Record<string, unknown>;
  solution: unknown;
}
export interface ActivityObservation {
  correct: boolean;
  explanation: string;
  independent: false;
  assisted: true;
  assistance_reason: 'user_authored_solution';
  grants_verification: false;
}
