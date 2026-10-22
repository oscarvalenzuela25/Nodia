import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
export type NodiaAiCoreResource =
  | 'users'
  | 'roles'
  | 'actions'
  | 'business_actions'
  | 'modules'
  | 'module_groups';
export type NodiaAiCoreAction = 'create' | 'update' | 'delete';
export interface NodiaAiCoreOperation extends NodiaAiProposalPreparer {
  readonly resourceKey: NodiaAiCoreResource;
  readonly operation: NodiaAiCoreAction;
  reprepareStored: NonNullable<NodiaAiProposalPreparer['reprepareStored']>;
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string }>;
}
export const NODIA_AI_CORE_OPERATIONS = Symbol('NODIA_AI_CORE_OPERATIONS');
