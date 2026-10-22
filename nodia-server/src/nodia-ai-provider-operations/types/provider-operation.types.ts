import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

export type NodiaAiProviderResource = 'ai_providers' | 'ai_provider_catalog';
export interface NodiaAiProviderOperation extends NodiaAiProposalPreparer {
  readonly resourceKey: NodiaAiProviderResource;
  readonly operation: 'create' | 'update';
  reprepareStored: NonNullable<NodiaAiProposalPreparer['reprepareStored']>;
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string }>;
}
export const NODIA_AI_PROVIDER_OPERATIONS = Symbol(
  'NODIA_AI_PROVIDER_OPERATIONS',
);
