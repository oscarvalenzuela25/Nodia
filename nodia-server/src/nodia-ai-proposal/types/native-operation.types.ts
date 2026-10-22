import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from './proposal-preparer.types.js';

export type NodiaAiBusinessResource =
  | 'businesses'
  | 'products'
  | 'product_logs'
  | 'providers'
  | 'provider_contacts'
  | 'invoices';
export type NodiaAiBusinessMutation =
  'create' | 'update' | 'set_collaborators' | 'set_active';

/** Trusted local SQL ports. Files requiring external I/O use a separate staged protocol. */
export interface NodiaAiNativeOperation extends NodiaAiProposalPreparer {
  readonly resourceKey: NodiaAiBusinessResource;
  readonly operation: NodiaAiBusinessMutation;
  reprepareStored: NonNullable<NodiaAiProposalPreparer['reprepareStored']>;
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; businessId: string }>;
}
export const NODIA_AI_BUSINESS_OPERATIONS = Symbol(
  'NODIA_AI_BUSINESS_OPERATIONS',
);
