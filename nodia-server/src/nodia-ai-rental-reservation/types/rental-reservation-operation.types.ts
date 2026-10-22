import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

export type NodiaAiRentalReservationAction =
  'create' | 'update' | 'confirm' | 'start' | 'complete' | 'cancel';
export interface NodiaAiRentalReservationOperation extends NodiaAiProposalPreparer {
  readonly resourceKey: 'rental_reservations';
  readonly operation: NodiaAiRentalReservationAction;
  reprepareStored: NonNullable<NodiaAiProposalPreparer['reprepareStored']>;
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; propertyId: string }>;
}
export const NODIA_AI_RENTAL_RESERVATION_OPERATIONS = Symbol(
  'NODIA_AI_RENTAL_RESERVATION_OPERATIONS',
);
