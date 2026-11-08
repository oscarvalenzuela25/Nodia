// Read-only source/catalog verification. Run after build; never initializes Nest,
// SQL, providers or handlers, and never authors publication metadata or evidence.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { compileKnowledge, defaultRoot, repositoryFile } from './nodia-ai-knowledge/compiler.mjs';
import frontmatter from './nodia-ai-knowledge/frontmatter.cjs';
import { auditCurrentCatalog, assertNoAdministrativeModuleFields, mergeCatalogExtensions } from './nodia-ai-knowledge/catalog-audit.mjs';

const read = (relative) => frontmatter.parseStrictJson(fs.readFileSync(repositoryFile(defaultRoot, relative), 'utf8'));
const fingerprint = (relative) => createHash('sha256').update(fs.readFileSync(repositoryFile(defaultRoot, relative))).digest('hex');
export async function auditPublishedCatalog() {
  const compiled = compileKnowledge(defaultRoot);
  const catalogPath = 'docs/mvp/nodia-ai-v1-tool-catalog.json';
  const extensionPath = 'docs/mvp/nodia-ai-v1-tool-catalog.extensions.json';
  const selectionPath = 'nodia-server/src/nodia-ai-tools/config/tool-selection-profiles.json';
  const runtime = async (relative) => import(pathToFileURL(path.join(defaultRoot, 'nodia-server/dist', relative)).href);
  const { compileNodiaAiToolSchema } = await runtime('nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js');
  const { NODIA_AI_MCP_CATALOG_LIMITS } = await runtime('nodia-ai-adapter/types/nodia-ai-adapter.types.js');
  const { loadNodiaAiToolSelectionProfiles } = await runtime('nodia-ai-tools/use-case/select-nodia-ai-turn-tools.use-case.js');
  const { NODIA_AI_SELECT_CAPABILITIES_TOOL } = await runtime('nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js');
  const selection = loadNodiaAiToolSelectionProfiles(JSON.stringify(read(selectionPath)));
  const catalog = mergeCatalogExtensions(read(catalogPath), read(extensionPath));
  const report = auditCurrentCatalog(catalog, compiled.manifest, selection, NODIA_AI_MCP_CATALOG_LIMITS, NODIA_AI_SELECT_CAPABILITIES_TOOL);
  const schemas = new Map();
  let closedContracts = 0;
  for (const capability of compiled.manifest.capability_contracts) {
    for (const direction of ['input_schema', 'output_schema']) {
      const reference = capability[direction];
      if (!schemas.has(reference.path)) schemas.set(reference.path, fs.readFileSync(repositoryFile(defaultRoot, reference.path), 'utf8'));
      const parsed = compileNodiaAiToolSchema({ sourceJson: schemas.get(reference.path), sha256: reference.sha256, definition: reference.definition });
      assertNoAdministrativeModuleFields(capability.capability_id, parsed.schema);
      closedContracts++;
    }
  }
  return {
    task: 'nodia_ai_current_catalog', status: 'passed', mode: 'read_only',
    publication_authority: 'explicit_registry_and_compiled_approved_knowledge',
    catalog_flags: 'historical_snapshot_plus_explicit_semantic_extensions_not_runtime_authority',
    release_id: compiled.manifest.release_id, documents: compiled.manifest.documents.length,
    fragments: compiled.manifest.fragments.length, closed_contracts: closedContracts,
    ...report,
    source_fingerprints: Object.fromEntries([catalogPath, extensionPath, selectionPath, 'nodia-server/config/nodia-ai-knowledge.registry.json'].map((file) => [file, fingerprint(file)])),
    limitations: ['Not provider inference, handler execution, SQL authorization or acceptance per capability.', 'Cross-checks the declared handlerCoverage cohort and a manifest compiled from source; it does not discover the current API AST, identify new routes, or prove equality with a deployed VM.', 'Generation counts are ceilings, not proof that every possible selected combination fits the byte limit.', 'Historical design publication flags are reported without modifying their source.'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) throw new Error('catalog_argument_invalid');
    console.log(JSON.stringify(await auditPublishedCatalog()));
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'catalog_check_failed';
    console.error(JSON.stringify({ task: 'nodia_ai_current_catalog', status: 'failed', code }));
    process.exitCode = 1;
  }
}
