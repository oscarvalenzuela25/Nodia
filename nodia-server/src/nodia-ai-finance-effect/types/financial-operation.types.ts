import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

export type NodiaAiFinanceResource =
  | 'finance_categories'
  | 'finance_category_groups'
  | 'finance_movements'
  | 'finance_obligations';
export type NodiaAiFinanceMutation = 'create' | 'update' | 'delete';
/** Code-owned native ports. Neither a model nor a Markdown document can register an effect. */
export interface NodiaAiFinanceOperation extends NodiaAiProposalPreparer {
  readonly resourceKey: NodiaAiFinanceResource;
  readonly operation: NodiaAiFinanceMutation;
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; ownerId: string }>;
}
export const NODIA_AI_FINANCE_OPERATIONS = Symbol(
  'NODIA_AI_FINANCE_OPERATIONS',
);

const identities: Readonly<
  Record<
    string,
    Readonly<{
      resourceKey: NodiaAiFinanceResource;
      operation: NodiaAiFinanceMutation;
    }>
  >
> = Object.freeze({
  nodia_finance_categories_prepare_create: Object.freeze({
    resourceKey: 'finance_categories',
    operation: 'create',
  }),
  nodia_finance_categories_prepare_update: Object.freeze({
    resourceKey: 'finance_categories',
    operation: 'update',
  }),
  nodia_finance_categories_prepare_delete: Object.freeze({
    resourceKey: 'finance_categories',
    operation: 'delete',
  }),
  nodia_finance_category_groups_prepare_create: Object.freeze({
    resourceKey: 'finance_category_groups',
    operation: 'create',
  }),
  nodia_finance_category_groups_prepare_update: Object.freeze({
    resourceKey: 'finance_category_groups',
    operation: 'update',
  }),
  nodia_finance_category_groups_prepare_delete: Object.freeze({
    resourceKey: 'finance_category_groups',
    operation: 'delete',
  }),
  nodia_finance_movements_prepare_create: Object.freeze({
    resourceKey: 'finance_movements',
    operation: 'create',
  }),
  nodia_finance_movements_prepare_update: Object.freeze({
    resourceKey: 'finance_movements',
    operation: 'update',
  }),
  nodia_finance_movements_prepare_delete: Object.freeze({
    resourceKey: 'finance_movements',
    operation: 'delete',
  }),
  nodia_finance_obligations_prepare_create: Object.freeze({
    resourceKey: 'finance_obligations',
    operation: 'create',
  }),
  nodia_finance_obligations_prepare_update: Object.freeze({
    resourceKey: 'finance_obligations',
    operation: 'update',
  }),
  nodia_finance_obligations_prepare_delete: Object.freeze({
    resourceKey: 'finance_obligations',
    operation: 'delete',
  }),
});
export function nodiaAiFinanceOperationIdentity(name: string) {
  return Object.hasOwn(identities, name) ? identities[name] : null;
}
/** Keep the AI-19 v2 witness stable; new ports bind the entire closed envelope, including the target ID. */
export function nodiaAiFinancialBinding(source: {
  tool_name: string;
  contract_hash: string;
  scope: unknown;
  command_template: { readonly [key: string]: unknown };
}) {
  return source.tool_name === 'nodia_finance_movements_prepare_create'
    ? {
        tool_name: source.tool_name,
        contract_hash: source.contract_hash,
        scope: source.scope,
        owner_id: source.command_template.owner_id,
        command: source.command_template.command,
      }
    : {
        tool_name: source.tool_name,
        contract_hash: source.contract_hash,
        scope: source.scope,
        command_template: source.command_template,
      };
}
