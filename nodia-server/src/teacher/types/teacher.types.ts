import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';

export type TeacherState =
  'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type AssessmentScope = 'unit_practice' | 'section_final' | 'diagnostic';
export type QuestionKind = 'single_choice' | 'completion' | 'short_text';
export type TeacherPurpose =
  | 'setup_reply'
  | 'plan_outline'
  | 'plan_adjustment'
  | 'learning_packet'
  | 'assessment_only'
  | 'written_feedback'
  | 'contextual_reply';
export interface TeacherSelection {
  connection_id: string;
  mode: 'agentic' | 'api_key';
  model_id: string;
  effort_id: string | null;
}
export interface AssessmentCounts {
  single_choice: number;
  completion: number;
  short_text: number;
}
export interface AssessmentPolicy {
  version: 'teacher-assessment/1';
  practice_counts: AssessmentCounts;
  final_counts: AssessmentCounts;
  diagnostic_counts: AssessmentCounts;
  final_threshold_percent: 90;
  coverage_per_objective: 2;
  criterion_ids: ['objective', 'accuracy', 'clarity'];
  normalization: 'NFC-trim-collapse';
}
export interface PlanUnit {
  id: string;
  title: string;
  objective_ids: string[];
  day_start: number | null;
  day_end: number | null;
}
export interface PlanSection {
  id: string;
  title: string;
  required: boolean;
  prerequisite_section_ids: string[];
  objectives: { id: string; description: string }[];
  units: PlanUnit[];
}
export interface PlanOutline {
  schema_version: 1;
  title: string;
  topic: string;
  objective: string;
  explanation_language: string;
  organization: 'days' | 'topics';
  day_count: number | null;
  sections: PlanSection[];
  assessment_policy: AssessmentPolicy;
}
export interface PrivateGuide {
  schema_version: 1;
  strategy: 'explanatory' | 'examples_first' | 'balanced';
  context_notes: string;
  examples_context: string;
  prerequisite_knowledge: string[];
  preferred_formats: QuestionKind[];
}
export type TeacherAnswer =
  | { kind: 'single_choice'; option_id: string }
  | { kind: 'completion' | 'short_text'; text: string }
  | { kind: 'dont_know' };
export type PrivateKey =
  | { kind: 'single_choice'; option_id: string }
  | {
      kind: 'completion';
      alternatives: string[];
      case_sensitive: boolean;
      ambiguous?: boolean;
    }
  | {
      kind: 'short_text';
      criteria: {
        criterion_id: 'objective' | 'accuracy' | 'clarity';
        anchors: [string, string, string];
      }[];
    };
export interface BlueprintSlot {
  ordinal: number;
  objective_id: string;
  kind: QuestionKind;
  max_points: number;
}
export interface AssessmentCandidateItem {
  local_ref: string;
  objective_id: string;
  kind: QuestionKind;
  prompt: string;
  options?: { id: string; label: string }[];
  private_key: PrivateKey;
  explanation: string;
  hint?: string;
}
export interface AssessmentCandidate {
  schema_version: 1;
  scope: AssessmentScope;
  plan_revision_id: string | null;
  section_id: string | null;
  unit_id: string | null;
  items: AssessmentCandidateItem[];
}
export interface PublicBlock {
  id: string;
  kind:
    | 'explanation'
    | 'example'
    | 'guided_practice'
    | 'summary'
    | 'prediction'
    | 'check';
  title: string;
  body_markdown: string;
  citations?: {
    source_id: string;
    content_hash: string;
    page: number;
    quote: string;
  }[];
}
export interface LearningPacket {
  schema_version: 1;
  unit_id: string;
  plan_revision_id: string;
  blocks: PublicBlock[];
  practice_assessment: AssessmentCandidate;
}
export interface TeacherSessionRow {
  id: string;
  owner_user_id: string;
  title: string | null;
  topic: string;
  objective: string;
  declared_base: string | null;
  context: string | null;
  explanation_language: string;
  requested_organization: 'teacher_suggests' | 'days' | 'topics';
  requested_day_count: number | null;
  selection: TeacherSelection | null;
  setup_draft_text: string;
  setup_draft_revision: number;
  state: TeacherState;
  resume_state: TeacherState | null;
  archived_state: TeacherState | null;
  revision: number;
  current_plan_revision_id: string | null;
  dispatch_limit: number;
  dispatches_used: number;
  created_by_actor_id: string;
  created_at: Date;
  updated_at: Date;
}
export interface TeacherGenerationJob {
  id: string;
  session_id: string;
  actor_id: string;
  auth_session_public_id: string | null;
  purpose: TeacherPurpose;
  plan_revision_id: string | null;
  unit_id: string | null;
  section_id: string | null;
  attempt_id: string | null;
  state:
    | 'queued'
    | 'blocked_paused'
    | 'running'
    | 'ready'
    | 'failed_known'
    | 'unknown'
    | 'cancelled_before_dispatch';
  fence: string;
  input_snapshot: Record<string, unknown>;
  selection_snapshot: TeacherSelection;
  prompt_snapshot: string;
  input_hash: string;
  semantic_key: string;
  deadline_at: Date;
  dispatches_used: number;
  result_ref: Record<string, unknown> | null;
  error_code: string | null;
  blocks_duplicate: boolean;
  created_at: Date;
  updated_at: Date;
}
export const TEACHER_GENERATION_PORT = Symbol('TEACHER_GENERATION_PORT');
export interface TeacherConnectionModels {
  connection_id: string;
  mode: 'agentic';
  models: { model_id: string; label: string; efforts: { effort_id: string; label: string }[] }[];
}
/** Selection inspection is shared. Teacher owns its durable admission and outbox. */
export interface TeacherGenerationPort {
  setPublisher(
    publish: (
      manager: EntityManager,
      job: TeacherGenerationJob,
      output: string,
    ) => Promise<Record<string, unknown>>,
  ): void;
  connections(actor: ActorReference): Promise<unknown>;
  models(actor: ActorReference, connectionId: string, mode: string, signal?: AbortSignal): Promise<TeacherConnectionModels>;
  eligibility(
    actor: ActorReference,
    connectionId: string,
    selection: Omit<TeacherSelection, 'connection_id'>,
    signal?: AbortSignal,
  ): Promise<unknown>;
  verifySelection(
    manager: EntityManager,
    actor: ActorReference,
    selection: TeacherSelection,
    purpose?: TeacherPurpose,
  ): Promise<{
    configuration_generation: string;
    session_generation: string | null;
  }>;
}
