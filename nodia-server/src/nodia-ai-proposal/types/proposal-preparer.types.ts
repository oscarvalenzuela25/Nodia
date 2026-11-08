import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type { NodiaAiProposalReviewField } from './proposal-review.types.js';
import type { NodiaAiProposalBindingSource } from './workflow.types.js';
import { NODIA_AI_DELETION_PROOF } from '../../nodia-ai-recovery/types/deletion-journal.js';

export const NODIA_AI_PROPOSAL_PREPARERS = Symbol(
  'NODIA_AI_PROPOSAL_PREPARERS',
);
export type ProposalPreparerContext = NodiaAiToolHandlerContext & {
  readonly conversationId: string;
  /** Backend-owned execution identity, supplied only inside the confirmed effect transaction. */
  readonly executionStepId?: string;
  /** Ephemeral backend-only proof supplied after external preflight, never a DTO. */
  readonly [NODIA_AI_DELETION_PROOF]?: {
    readonly executionStepId: string;
    readonly preferenceId: string;
  };
};
export interface ProposalFieldEdit {
  readonly step_id: string;
  readonly field_key: string;
  readonly value: NodiaAiJsonValue;
}
export interface PreparedProposalStep {
  readonly commandTemplate: NodiaAiJsonObject;
  readonly scope: NodiaAiJsonObject;
  readonly preconditions: NodiaAiJsonObject;
  /** Exact PublicStep except the backend-generated step_id. */
  readonly publicStep: NodiaAiJsonObject;
}
export type ProposalPreparation =
  | {
      readonly status: 'needs_clarification';
      readonly partial: NodiaAiJsonObject;
      readonly missingFields: readonly string[];
      readonly clarificationKeys: readonly string[];
    }
  | ({ readonly status: 'ready' } & PreparedProposalStep);
export interface StoredProposalStep extends PreparedProposalStep {
  readonly id: string;
  readonly toolName: string;
  readonly contractHash: string;
  readonly position: number;
  readonly outputBindings: readonly NodiaAiJsonObject[];
}
/** Trusted code registration. Markdown and model output cannot introduce a preparer. */
export interface NodiaAiProposalPreparer {
  readonly toolName: string;
  readonly contractHash: string;
  readonly catalogVersion: string;
  readonly moduleRoutes: readonly string[];
  readonly actionKeys: readonly string[];
  readonly editableFields: Readonly<Record<string, string>>;
  readonly bindableFields: Readonly<Record<string, string>>;
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly reviewFields?: readonly NodiaAiProposalReviewField[];
  prepare(
    partial: NodiaAiJsonObject,
    context: ProposalPreparerContext,
    /** Stored preparation state; only the domain preparer can merge a clarification reply. */
    previousPartial?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation>;
  /** Backend-only path for a template returned by applyEdits, never model arguments. */
  reprepareStored?(
    template: NodiaAiJsonObject,
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation>;
  /** Backend-only future references checked against this port's closed binding registry. */
  prepareWithBindings?(
    partial: NodiaAiJsonObject,
    bindings: readonly NodiaAiProposalBindingSource[],
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation>;
  reprepareWithBindings?(
    template: NodiaAiJsonObject,
    bindings: readonly NodiaAiProposalBindingSource[],
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation>;
  /** Resolve verified completed outputs once, without changing any other approved field. */
  bindOutputs?(
    step: StoredProposalStep,
    values: Readonly<
      Record<
        string,
        {
          readonly value: NodiaAiJsonValue;
          readonly source: StoredProposalStep;
        }
      >
    >,
    context: ProposalPreparerContext,
  ): Promise<PreparedProposalStep>;
  applyEdits(
    template: NodiaAiJsonObject,
    edits: readonly ProposalFieldEdit[],
    context: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject>;
  /** Authorization only: never refresh or replace frozen command/projection/preconditions. */
  verifyAuthority(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void>;
  /** Opt-in read authority for an immutable older contract. Never prepares or executes it. */
  verifyHistoricalReadAuthority?(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void>;
  /** Reject stale material conditions without rewriting any approved values. */
  verifyPreconditions(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void>;
}

/** Read-only registrations never enter preparation, confirmation or ToolRegistry. */
export const NODIA_AI_HISTORICAL_PROPOSAL_READERS = Symbol(
  'NODIA_AI_HISTORICAL_PROPOSAL_READERS',
);
