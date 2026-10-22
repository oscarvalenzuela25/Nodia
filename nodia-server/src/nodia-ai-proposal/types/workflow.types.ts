import type { StoredProposalStep } from './proposal-preparer.types.js';

/** A coordinator release, independent of the version of each frozen native port. */
export const NODIA_AI_WORKFLOW_CATALOG_VERSION = 'nodia-ai-ai23-workflow/1';
export interface NodiaAiWorkflowDraftBinding {
  readonly draft_id: string;
  readonly target_field_key: string;
  readonly from_draft_id: string;
  readonly output_key: string;
}
export interface NodiaAiWorkflowPrepareInput {
  readonly catalog_version: string;
  /** Stable execution order; never sorted by the coordinator. */
  readonly draft_ids: readonly string[];
  readonly bindings?: readonly NodiaAiWorkflowDraftBinding[];
}
export interface NodiaAiProposalOutputBinding {
  readonly target_field_key: string;
  readonly from_step_id: string;
  readonly output_key: string;
}
/** Backend-derived source; never accepted as arguments from a model/client. */
export interface NodiaAiProposalBindingSource extends NodiaAiProposalOutputBinding {
  readonly source: StoredProposalStep;
}
