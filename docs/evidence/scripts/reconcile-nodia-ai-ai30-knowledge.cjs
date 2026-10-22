// A single excluded draft is the only allowed AI-30 knowledge delta.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const fm = require(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs'));
const sourcePath = 'docs/nodia-ai/knowledge/nodia-ai/features/restricted-reports.md';
const documentId = 'nodia-ai.restricted-reports';
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const digest = value => fm.sha256(fm.canonical(value));
function unwindAi30(manifest, registry, previousSourcePaths = read('docs/evidence/nodia-ai-ai30-knowledge-delta.json').previous_source_paths) {
  const historical = read('docs/evidence/nodia-ai-ai29-r01-knowledge-delta.json');
  const { release_id, ...payload } = manifest;
  assert.equal(digest(payload), release_id);
  assert.equal(manifest.registry_sha256, digest(registry));
  assert.equal(registry.source_paths.filter(source => source === sourcePath).length, 1);
  assert(Array.isArray(previousSourcePaths) && previousSourcePaths.length === 53 && new Set(previousSourcePaths).size === 53);
  assert(previousSourcePaths.every(source => typeof source === 'string' && source !== sourcePath));
  assert.deepEqual([...registry.source_paths].sort(), [...previousSourcePaths, sourcePath].sort(), 'Only the excluded draft and source-path ordering may differ');
  const parsed = fm.parseDocument(fs.readFileSync(path.join(root, sourcePath), 'utf8'));
  assert.equal(parsed.metadata.document_id, documentId);
  assert.equal(parsed.metadata.document_status, 'draft');
  assert.equal(parsed.metadata.integration_status, 'unregistered');
  assert.equal(parsed.metadata.approval, null);
  assert(!registry.bindings.some(binding => binding.document_id === documentId));
  assert(!manifest.documents.some(document => document.document_id === documentId));
  assert(!manifest.fragments.some(fragment => fragment.document_id === documentId));
  const previousRegistry = { ...structuredClone(registry), source_paths: structuredClone(previousSourcePaths) };
  const previousManifest = structuredClone(manifest);
  previousManifest.registry_sha256 = digest(previousRegistry);
  const { release_id: ignored, ...previousPayload } = previousManifest;
  void ignored;
  previousManifest.release_id = digest(previousPayload);
  assert.equal(previousManifest.release_id, historical.release, 'AI-30 must only add one excluded draft; published content and read contracts cannot drift');
  return { manifest: previousManifest, registry: previousRegistry };
}
async function main() {
  const args = process.argv.slice(2); assert(args.every(argument => argument === '--write'));
  const compiler = await import(pathToFileURL(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/compiler.mjs')).href);
  const current = compiler.compileKnowledge(root), registry = read('nodia-server/config/nodia-ai-knowledge.registry.json');
  const previousSourcePaths = args.includes('--write') ? read('.tmp/ai29-r01-registry-before.json').source_paths : read('docs/evidence/nodia-ai-ai30-knowledge-delta.json').previous_source_paths;
  const prior = unwindAi30(current.manifest, registry, previousSourcePaths);
  const mutations = [
    value => value.manifest.fragments[0].sha256 = '0'.repeat(64),
    value => value.manifest.documents[0].content_sha256 = '0'.repeat(64),
    value => value.manifest.capability_contracts[0].input_schema.sha256 = '0'.repeat(64),
    value => value.registry.source_paths.push('docs/unreviewed.md'),
    value => value.registry.capabilities.push(structuredClone(value.registry.capabilities[0])),
  ];
  for (const mutate of mutations) {
    const value = { manifest: structuredClone(current.manifest), registry: structuredClone(registry) }; mutate(value);
    value.manifest.registry_sha256 = digest(value.registry);
    const { release_id: ignored, ...payload } = value.manifest; void ignored; value.manifest.release_id = digest(payload);
    assert.throws(() => unwindAi30(value.manifest, value.registry, previousSourcePaths));
  }
  const delta = { schema_version: 1, stage: 'AI-30', previous_release: prior.manifest.release_id, release: current.manifest.release_id,
    previous_registry_sha256: prior.manifest.registry_sha256, registry_sha256: current.manifest.registry_sha256,
    added_excluded_source: sourcePath, previous_source_paths: previousSourcePaths, existing_source_paths_reordered_only: true, changed_manifest_fields: ['registry_sha256', 'release_id'],
    sources: current.counts.sources, excluded: current.counts.excluded, published_capabilities: current.manifest.capability_contracts.length,
    published_fragments: current.manifest.fragments.length, new_published_content: false, approved_documents_changed: false, rejected_mutation_checks: mutations.length };
  const destination = path.join(root, 'docs/evidence/nodia-ai-ai30-knowledge-delta.json');
  if (args.includes('--write')) fs.writeFileSync(destination, JSON.stringify(delta, null, 2) + '\n');
  else assert.deepEqual(read('docs/evidence/nodia-ai-ai30-knowledge-delta.json'), delta);
  console.log(JSON.stringify({ status: 'ai30_excluded_draft_delta_verified', previous_release: delta.previous_release, release: delta.release, sources: delta.sources, excluded: delta.excluded, published_capabilities: delta.published_capabilities, published_fragments: delta.published_fragments, rejected_mutation_checks: mutations.length, new_published_content: false }));
}
module.exports = { unwindAi30 };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
