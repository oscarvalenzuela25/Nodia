import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { NodiaAiToolFamily } from '../../nodia-ai-tools/types/tool-registry.types.js';
import {
  ExecuteNodiaAiFinanceReadUseCase,
  type FinanceReadOperation,
  type NodiaAiFinanceReadPorts,
} from './use-case/execute-nodia-ai-finance-read.use-case.js';

export const NODIA_AI_FINANCE_READ_FAMILY = Symbol(
  'NODIA_AI_FINANCE_READ_FAMILY',
);
export const NODIA_AI_FINANCE_READ_DEFINITIONS = Object.freeze([
  [
    'categories_get',
    'finance_categories',
    'category',
    'CategoryInput',
    'Category',
  ],
  [
    'categories_list',
    'finance_categories',
    'categories',
    'CategoryQuery',
    'CategoryPage',
  ],
  [
    'category_groups_get',
    'finance_category_groups',
    'group',
    'CategoryInput',
    'GroupDetail',
  ],
  [
    'category_groups_list',
    'finance_category_groups',
    'groups',
    'CategoryQuery',
    'GroupPage',
  ],
  [
    'movements_get',
    'finance_movements',
    'movement',
    'CategoryInput',
    'Movement',
  ],
  [
    'movements_list',
    'finance_movements',
    'movements',
    'MovementQuery',
    'MovementPage',
  ],
  [
    'obligations_get',
    'finance_obligations',
    'obligation',
    'CategoryInput',
    'Obligation',
  ],
  [
    'obligations_list',
    'finance_obligations',
    'obligations',
    'ObligationQuery',
    'ObligationPage',
  ],
  [
    'summaries_by_category',
    'finance_summaries',
    'byCategory',
    'SummaryQuery',
    'SummaryPage',
  ],
  [
    'summaries_by_category_group',
    'finance_summaries',
    'byGroup',
    'SummaryQuery',
    'GroupSummaryPage',
  ],
  [
    'summaries_overview',
    'finance_summaries',
    'overview',
    'MovementQuery',
    'Overview',
  ],
] as const satisfies ReadonlyArray<
  readonly [string, string, FinanceReadOperation, string, string]
>);

/** Explicit typed export only. The composition root must also verify publication. */
export function createNodiaAiFinanceReadFamily(
  ports: NodiaAiFinanceReadPorts,
): NodiaAiToolFamily {
  const sourceJson = readFileSync(
    new URL('../contracts/finance.schema.json', import.meta.url),
    'utf8',
  );
  const sha256 = createHash('sha256').update(sourceJson, 'utf8').digest('hex');
  const reader = new ExecuteNodiaAiFinanceReadUseCase(ports);
  const route = '/finances-personal';
  return {
    familyKey: 'personal_finance',
    modules: [{ key: 'personal_finance', route, label: 'Personal finance' }],
    resources: [
      'finance_categories',
      'finance_category_groups',
      'finance_movements',
      'finance_obligations',
      'finance_summaries',
    ].map((key) => ({ key, label: key, requiredModuleRoutes: [route] })),
    capabilities: NODIA_AI_FINANCE_READ_DEFINITIONS.map(
      ([suffix, resourceKey, operation, input, output]) => ({
        capabilityId: `nodia_finance_${suffix}`,
        revision: 1,
        publication: 'published',
        toolName: `nodia_finance_${suffix}`,
        kind: 'read',
        moduleKey: 'personal_finance',
        resourceKey,
        operationKey: suffix,
        descriptionKey: `nodia_ai.finance.${suffix}`,
        description: `Read personal finance ${suffix.replaceAll('_', ' ')} using current owner authority. Amounts and IDs are exact decimal strings; filters default to active.`,
        requiredModuleRoutes: [route],
        actionKeys: [],
        effectKey: `finance.read.${suffix}`,
        readIsolation: 'REPEATABLE READ',
        inputSchema: { sourceJson, definition: input, sha256 },
        outputSchema: { sourceJson, definition: output, sha256 },
        verifyAuthority: (input, context) =>
          reader.verifyAuthority(input, context),
        verifyResultAuthority: (input, result, context) =>
          reader.verifyResultAuthority(input, result, context),
        handler: (input, context) => reader.execute(operation, input, context),
      }),
    ),
  };
}
