import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

export type NodiaAiRentalMoneyAction = 'create' | 'update' | 'pay' | 'void';
export type NodiaAiRentalMoneyResource = 'rental_payments' | 'rental_expenses';
export interface NodiaAiRentalMoneyOperation extends NodiaAiProposalPreparer {
  readonly resourceKey: NodiaAiRentalMoneyResource;
  readonly operation: NodiaAiRentalMoneyAction;
  reprepareStored: NonNullable<NodiaAiProposalPreparer['reprepareStored']>;
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; propertyId: string }>;
}
export const NODIA_AI_RENTAL_MONEY_OPERATIONS = Symbol(
  'NODIA_AI_RENTAL_MONEY_OPERATIONS',
);
