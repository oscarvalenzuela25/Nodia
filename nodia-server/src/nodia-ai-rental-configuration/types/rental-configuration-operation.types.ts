import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

export type NodiaAiRentalConfigurationResource =
  'rental_properties' | 'rental_collaborators' | 'rental_cancellation_policies';
export interface NodiaAiRentalConfigurationOperation extends NodiaAiProposalPreparer {
  readonly resourceKey: NodiaAiRentalConfigurationResource;
  readonly operation: 'create' | 'update';
  reprepareStored: NonNullable<NodiaAiProposalPreparer['reprepareStored']>;
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; propertyId: string }>;
}
export const NODIA_AI_RENTAL_CONFIGURATION_OPERATIONS = Symbol(
  'NODIA_AI_RENTAL_CONFIGURATION_OPERATIONS',
);
