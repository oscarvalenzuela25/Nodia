// Read-only retirement verification. This former apply entry point cannot
// restore sales writers, edit approval metadata, initialize SQL or call a provider.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import frontmatter from './nodia-ai-knowledge/frontmatter.cjs';
import { compileKnowledge, validateShape } from './nodia-ai-knowledge/compiler.mjs';
import { mergeCatalogExtensions, auditCurrentCatalog } from './nodia-ai-knowledge/catalog-audit.mjs';

const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(server, '..');
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => frontmatter.parseStrictJson(read(relative));
const load = relative => import(pathToFileURL(path.join(server, 'dist', relative)).href);
const readNames = ['nodia_sales_get', 'nodia_sales_list'];
const retiredNames = ['create', 'update', 'complete', 'cancel', 'discard'].map(operation => 'nodia_sales_prepare_' + operation);
const sameNames = (actual, expected) => Array.isArray(actual) && actual.length === expected.length
  && new Set(actual).size === actual.length && expected.every(value => actual.includes(value));

/** Checks the active declaration, not a prospective approval or a patch to apply. */
export function auditSalesReadOnlyPublication({ candidate, registry, extension, document }) {
  ensure(candidate.schema_version === 1 && candidate.status === 'sales_read_only_retirement'
    && candidate.authoring_only === true && sameNames(candidate.read_capability_ids, readNames)
    && sameNames(candidate.retired_capability_ids, retiredNames), 'sales_read_only_retirement_invalid');
  validateShape('Registry', registry);
  const published = registry.capabilities.filter(capability => capability.capability_id.startsWith('nodia_sales_'));
  ensure(sameNames(published.map(capability => capability.capability_id), readNames)
    && published.every(capability => capability.kind === 'read'), 'sales_write_capability_published');
  ensure(registry.catalog_release === candidate.catalog_release, 'sales_read_only_release_mismatch');
  const review = candidate.document_review;
  ensure(document.metadata.document_id === review.document_id && document.metadata.revision === review.revision
    && document.metadata.document_status === 'approved' && document.metadata.approval?.revision === review.revision
    && document.metadata.approval.reference === review.approval_reference
    && document.metadata.approval.content_sha256 === review.approved_content_sha256
    && frontmatter.contentHash(document.metadata, document.body) === review.approved_content_sha256,
  'sales_approved_document_changed');
  const bindings = registry.bindings.filter(binding => binding.document_id === review.document_id);
  ensure(bindings.length === 1 && sameNames(bindings[0].sections, ['Filtros e informes'])
    && sameNames(bindings[0].requires.map(requirement => requirement.capability_id), readNames)
    && frontmatter.canonical(bindings[0]) === frontmatter.canonical(candidate.required_binding),
  'sales_read_only_binding_invalid');
  const salesCandidates = extension.domainTools.filter(tool => tool.resourceKey === 'sales' || tool.name.startsWith('nodia_sales_'));
  ensure(sameNames(salesCandidates.map(tool => tool.name), readNames) && salesCandidates.every(tool => tool.kind === 'read'),
    'sales_write_catalog_candidate_present');
  const salesHandlers = (extension.newHandlers ?? []).filter(handler => handler.operationId.startsWith('SaleController.'));
  ensure(sameNames(salesHandlers.map(handler => handler.operationId), ['SaleController.get', 'SaleController.list'])
    && extension.handlerCoverage.filter(handler => handler.operationId.startsWith('SaleController.'))
      .every(handler => sameNames(handler.toolNames, [handler.operationId === 'SaleController.get' ? readNames[0] : readNames[1]])),
  'sales_write_catalog_handler_present');
  return { read_tools: readNames, retired_tools: retiredNames, approved_document_revision: review.revision,
    context_sections: bindings[0].sections, approval_created: false };
}

export async function checkSalesReadOnlyPublication(args = []) {
  ensure(args.length === 0, 'sales_read_only_check_argument_invalid');
  const candidate = json('nodia-server/config/nodia-ai-pos-publication.candidate.json');
  const registry = json(candidate.registry_path), extension = json(candidate.catalog_extension_path);
  const document = frontmatter.parseDocument(read(candidate.document_review.path));
  const result = auditSalesReadOnlyPublication({ candidate, registry, extension, document });
  const compiled = compileKnowledge(root);
  const fragment = compiled.manifest.fragments.find(item => item.document_id === candidate.document_review.document_id);
  ensure(fragment && sameNames(fragment.sections, ['Filtros e informes'])
    && sameNames(fragment.requires.map(requirement => requirement.capability_id), readNames), 'sales_compiled_context_invalid');
  const context = compiled.assets.get(fragment.asset_path);
  ensure(typeof context === 'string' && !/nodia_sales_prepare_|Crear\/editar draft|Completar\/anular\/descartar/.test(context),
    'sales_write_context_projected');
  // Historical contracts remain parseable data for old previews/receipts. They
  // are never passed to BuildNodiaAiWriteToolsUseCase by this verifier.
  for (const relative of candidate.preserved_historical_contract_paths) json(relative);
  const blocked = new Proxy({}, { get() { throw new Error('sales_read_only_domain_call_forbidden'); } });
  const { createNodiaAiSalesToolFamily } = await load('nodia-ai-products/business/sales-tool-family.js');
  const readCapability = registry.capabilities.find(capability => capability.capability_id === readNames[0]);
  const reads = createNodiaAiSalesToolFamily(read(readCapability.input_schema.path), blocked);
  const { NodiaAiToolRegistryUseCase } = await load('nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js');
  const runtime = new NodiaAiToolRegistryUseCase([reads], 'sales-read-only-retirement');
  ensure(sameNames(runtime.list(['/business']).map(tool => tool.capabilityId), readNames), 'sales_read_runtime_incomplete');
  for (const tool of reads.capabilities) {
    const capability = registry.capabilities.find(value => value.capability_id === tool.capabilityId);
    ensure(capability?.kind === 'read' && capability.revision === tool.revision
      && capability.input_schema.sha256 === tool.inputSchema.sha256
      && capability.output_schema.sha256 === tool.outputSchema.sha256, 'sales_read_runtime_contract_mismatch');
  }
  const merged = mergeCatalogExtensions(json('docs/mvp/nodia-ai-v1-tool-catalog.json'), extension);
  const { NODIA_AI_MCP_CATALOG_LIMITS } = await load('nodia-ai-adapter/types/nodia-ai-adapter.types.js');
  const { NODIA_AI_SELECT_CAPABILITIES_TOOL } = await load('nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js');
  auditCurrentCatalog(merged, compiled.manifest, json('nodia-server/src/nodia-ai-tools/config/tool-selection-profiles.json'),
    NODIA_AI_MCP_CATALOG_LIMITS, NODIA_AI_SELECT_CAPABILITIES_TOOL);
  return { task: 'business_sales_read_only_publication', status: 'passed', mode: 'read_only', ...result,
    catalog_release: compiled.manifest.catalog_release, release_id: compiled.manifest.release_id,
    limits: 'No authoring mutation, new document approval, SQL, provider inference or deployment is performed.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await checkSalesReadOnlyPublication(process.argv.slice(2)))); }
  catch (error) {
    console.error(JSON.stringify({ task: 'business_sales_read_only_publication', status: 'failed',
      code: error instanceof Error ? error.message : 'sales_read_only_check_failed' }));
    process.exitCode = 1;
  }
}
