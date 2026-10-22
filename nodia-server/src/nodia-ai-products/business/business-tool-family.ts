import { createHash } from 'node:crypto';
import type {
  NodiaAiToolFamily,
  NodiaAiToolRegistration,
} from '../../nodia-ai-tools/types/tool-registry.types.js';
import {
  ReadNodiaAiBusinessUseCase,
  type BusinessReadOperation,
} from './use-case/read-nodia-ai-business.use-case.js';

const definitions: readonly [BusinessReadOperation, string, string, string][] =
  [
    [
      'businesses_get',
      'Businesses',
      'Get',
      'Read a business accessible to the current actor.',
    ],
    [
      'businesses_list',
      'Businesses',
      'List',
      'List accessible businesses with bounded filters; all_businesses requires super_admin.',
    ],
    [
      'invoices_get',
      'Invoices',
      'Get',
      'Read an invoice summary. Its total is invoiced money, not a payment.',
    ],
    [
      'invoices_list',
      'Invoices',
      'List',
      'List invoice summaries by business, commercial provider, code or issue-date bounds.',
    ],
    [
      'products_get',
      'Products',
      'Get',
      'Read current product prices, stock and commercial associations.',
    ],
    [
      'products_list',
      'Products',
      'List',
      'List current products with permitted code, name, provider, stock and price-variation filters.',
    ],
    [
      'product_logs_get',
      'ProductLogs',
      'Get',
      'Read a historical product snapshot by UUID; a snapshot is not a sale.',
    ],
    [
      'product_logs_list',
      'ProductLogs',
      'List',
      'List bounded historical product snapshots with permitted filters.',
    ],
    [
      'product_logs_query',
      'ProductLogs',
      'Query',
      'Query historical product snapshots for explicit product IDs or codes.',
    ],
    [
      'providers_get',
      'Providers',
      'Get',
      'Read a commercial supplier summary; this is not an AI provider.',
    ],
    [
      'providers_list',
      'Providers',
      'List',
      'List commercial suppliers by business, name and activity.',
    ],
    [
      'provider_contacts_list',
      'ProviderContacts',
      'List',
      'List a commercial supplier’s contacts, phones and schedules.',
    ],
  ];

/** Explicit dormant export. Only the approved composition/publication pipeline may expose it. */
export function createNodiaAiBusinessToolFamily(
  sourceJson: string,
): NodiaAiToolFamily {
  const useCase = new ReadNodiaAiBusinessUseCase();
  const sha256 = createHash('sha256').update(sourceJson).digest('hex');
  const capabilities: NodiaAiToolRegistration[] = definitions.map(
    ([operation, prefix, action, description]) => {
      const resourceKey = operation.replace(/_(get|list|query)$/, '');
      return {
        capabilityId: `nodia_${operation}`,
        revision: 1,
        publication: 'published',
        toolName: `nodia_${operation}`,
        kind: 'read',
        moduleKey: 'businesses',
        resourceKey,
        operationKey: action.toLowerCase(),
        descriptionKey: `nodia_ai.capabilities.${operation}`,
        description,
        requiredModuleRoutes: ['/tools/business'],
        actionKeys: [],
        effectKey: `read:${resourceKey}`,
        inputSchema: {
          sourceJson,
          sha256,
          definition: `${prefix}${action}Input`,
        },
        outputSchema: {
          sourceJson,
          sha256,
          definition: `${prefix}${action}Result`,
        },
        verifyAuthority: (input, context) =>
          useCase.verifyAuthority(operation, input, context),
        verifyResultAuthority: (input, output, context) =>
          useCase.verifyResultAuthority(operation, input, output, context),
        handler: (input, context) => useCase.execute(operation, input, context),
      };
    },
  );
  return {
    familyKey: 'businesses',
    modules: [
      { key: 'businesses', route: '/tools/business', label: 'Negocios' },
    ],
    resources: [
      {
        key: 'businesses',
        label: 'Negocios',
        requiredModuleRoutes: ['/tools/business'],
      },
      {
        key: 'invoices',
        label: 'Facturas',
        requiredModuleRoutes: ['/tools/business'],
      },
      {
        key: 'products',
        label: 'Productos',
        requiredModuleRoutes: ['/tools/business'],
      },
      {
        key: 'product_logs',
        label: 'Historial de productos',
        requiredModuleRoutes: ['/tools/business'],
      },
      {
        key: 'providers',
        label: 'Proveedores comerciales',
        requiredModuleRoutes: ['/tools/business'],
      },
      {
        key: 'provider_contacts',
        label: 'Contactos de proveedores',
        requiredModuleRoutes: ['/tools/business'],
      },
    ],
    capabilities,
  };
}

export const NODIA_AI_BUSINESS_READ_TOOLS = Object.freeze(
  definitions.map(([operation]) => `nodia_${operation}`),
);
export const NODIA_AI_BUSINESS_PENDING_TOOLS = Object.freeze([
  {
    toolName: 'nodia_invoices_eligible_invoice_connections',
    reason: 'live_provider_calls_outside_sql_checkpoint_required',
  },
  {
    toolName: 'nodia_invoices_file',
    reason:
      'authenticated_artifact_reference_and_dereference_contract_required',
  },
  {
    toolName: 'nodia_products_export_csv',
    reason: 'bounded_artifact_lifecycle_and_csv_export_contract_required',
  },
  {
    toolName: 'nodia_providers_export_csv',
    reason: 'authenticated_artifact_lifecycle_contract_required',
  },
]);
