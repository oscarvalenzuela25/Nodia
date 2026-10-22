import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

export type NodiaAiRentalResource = 'rental_blocks' | 'rental_turnovers';
export type NodiaAiRentalAction = 'create' | 'update' | 'approve_same_day';
export interface NodiaAiRentalOperation extends NodiaAiProposalPreparer {
  readonly resourceKey: NodiaAiRentalResource;
  readonly operation: NodiaAiRentalAction;
  reprepareStored: NonNullable<NodiaAiProposalPreparer['reprepareStored']>;
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; propertyId: string }>;
}
export const NODIA_AI_RENTAL_OPERATIONS = Symbol('NODIA_AI_RENTAL_OPERATIONS');
