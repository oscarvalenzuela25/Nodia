import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { NodiaAiToolFamily } from '../../nodia-ai-tools/types/tool-registry.types.js';
import { ExecuteNodiaAiArtifactUseCase } from './use-case/execute-nodia-ai-artifact.use-case.js';

export const NODIA_AI_ARTIFACT_CAPABILITIES = [
  ['invoices_file', 'InvoiceFile', 'business.invoice_files', 'Obtain a private invoice-file reference; the current file is reauthorized and streamed when a human downloads.'],
  ['products_export_csv', 'ProductsExport', 'business.product_exports', 'Obtain a private CSV reference for products; data is generated from current records at authenticated download, not a historical snapshot.'],
  ['providers_export_csv', 'ProvidersExport', 'business.provider_exports', 'Obtain a private CSV reference for commercial suppliers; data is generated from current records at authenticated download, not a historical snapshot.'],
] as const;

export function createNodiaAiArtifactsFamily(
  sourceJson = readFileSync(new URL('../contracts/artifacts.schema.json', import.meta.url), 'utf8'),
): NodiaAiToolFamily {
  const useCase = new ExecuteNodiaAiArtifactUseCase();
  const sha256 = createHash('sha256').update(sourceJson).digest('hex');
  return {
    familyKey: 'business_artifacts',
    modules: [{ key: 'businesses', route: '/business', label: 'Negocios' }],
    resources: NODIA_AI_ARTIFACT_CAPABILITIES.map(([, , key]) => ({ key, label: key, requiredModuleRoutes: ['/business'] })),
    capabilities: NODIA_AI_ARTIFACT_CAPABILITIES.map(([operation, prefix, resourceKey, description]) => ({
      capabilityId: `nodia_${operation}`, revision: operation === 'products_export_csv' ? 2 : 1, publication: 'published', toolName: `nodia_${operation}`,
      kind: 'read_artifact', moduleKey: 'businesses', resourceKey, operationKey: operation === 'invoices_file' ? 'file' : 'export_csv',
      descriptionKey: `nodia_ai.capabilities.${operation}`, description,
      requiredModuleRoutes: ['/business'], actionKeys: [], effectKey: `read:${resourceKey}`,
      inputSchema: { sourceJson, sha256, definition: `${prefix}Input` },
      outputSchema: { sourceJson, sha256, definition: `${prefix}Result` },
      verifyAuthority: (input, context) => useCase.verifyAuthority(operation, input, context),
      verifyResultAuthority: (input, result, context) => useCase.verifyResultAuthority(operation, input, result, context),
      external: { prepare: (input, context) => useCase.prepare(operation, input, context) },
      handler: async () => { throw new Error('nodia_ai:artifact_external_boundary_required'); },
    })),
  };
}
