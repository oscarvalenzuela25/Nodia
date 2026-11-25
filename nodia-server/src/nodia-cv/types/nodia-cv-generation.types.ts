import type { AiSelection } from '../../ai-generation/ai-selection.js';
import type { CodexProcessIdentity } from '../../common/ai/codex/codex-process-ownership.js';
import type { NodiaAiApiConfiguration } from '../../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import type { ApiExecutorOwner } from '../../nodia-ai-adapter/api-nodia-ai-runtime-owner.js';
import type {
  CvAgenticDescriptor,
  CvAgenticReceipt,
} from '../agentic/nodia-cv-agentic-contract.js';
import type { CvTailoringDraft, PreparedCvTailoring } from '../engine/index.js';
import type { NodiaCvProfileDetail } from './nodia-cv-profile.types.js';

export type CvGenerationState =
  'queued' | 'running' | 'ready' | 'failed' | 'unknown' | 'expired';

export interface CvDraftReviewEvidence {
  requirement_id: string;
  source: string;
  detail: string;
}

export interface CvDraftReviewContent {
  included_fact_ids: string[];
  evidence: CvDraftReviewEvidence[];
}

export interface CvDraftReview extends CvDraftReviewContent {
  revision: number;
}

export interface CvGenerationRow {
  id: string;
  owner_user_id: string;
  auth_session_public_id: string | null;
  profile_id: string | null;
  profile_revision: number;
  request_hash: string | null;
  state: CvGenerationState;
  language: 'es' | 'en';
  purpose_version: string;
  prompt_version: string;
  profile_snapshot: NodiaCvProfileDetail | null;
  offer_text: string | null;
  vacancy_title: string | null;
  vacancy_company: string | null;
  selection_snapshot: AiSelection | null;
  configuration_generation: string;
  session_generation: string;
  resource_key: string;
  scope_hash: string;
  qualification: boolean;
  draft: CvTailoringDraft | null;
  review: CvDraftReviewContent | null;
  review_revision: number | null;
  error_code: string | null;
  expires_at: Date;
  created_at: Date;
}

export interface CvGenerationClaim {
  row: CvGenerationRow;
  prepared: PreparedCvTailoring;
  selection: AiSelection;
  configuration: CvGenerationConfiguration;
  agenticDescriptor?: CvAgenticDescriptor;
  fence: string;
  workerId: string;
  executionHash: string;
  deadlineAt: Date;
}

export interface CvAgenticConfiguration extends Omit<
  NodiaAiApiConfiguration,
  'providerKey' | 'keyId'
> {
  providerKey: 'openai';
  keyId: null;
  policyHash: string;
  runtimeHash: string;
}

export type CvGenerationConfiguration =
  NodiaAiApiConfiguration | CvAgenticConfiguration;

export interface CvAgenticCustody {
  owner: CodexProcessIdentity;
  native: CodexProcessIdentity | null;
  workspace: string;
}

export interface CvOperation {
  id: string;
  phase: 'dispatch_armed' | 'transport_open' | 'closed';
  started_exchanges: number;
  request_hash: string;
  runtime_fence: string;
  api_owner_identity: ApiExecutorOwner | null;
  agentic_transport_descriptor?: CvAgenticDescriptor | null;
  cv_agentic_native?: CvAgenticCustody | null;
  terminal_proof?: CvAgenticReceipt | null;
  valid_lease?: boolean;
}

export interface CvAgenticOperation extends CvOperation {
  resource_key: string;
  agentic_transport_descriptor: CvAgenticDescriptor;
  cv_agentic_native: CvAgenticCustody | null;
  terminal_proof: CvAgenticReceipt | null;
}
