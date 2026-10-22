// A single excluded draft is the only allowed AI-32 knowledge delta.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const fm = require(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs'));
const sourcePath = 'docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md';
const documentId = 'nodia-ai.attachments-and-voice';
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const digest = value => fm.sha256(fm.canonical(value));
function unwindAi32(manifest, registry, previousSourcePaths = read('docs/evidence/nodia-ai-ai32-knowledge-delta.json').previous_source_paths, sourceChanges = read('docs/evidence/nodia-ai-ai32-knowledge-delta.json').document_source_hash_changes) {
  const historical = read('docs/evidence/nodia-ai-ai30-knowledge-delta.json');
  const { release_id, ...payload } = manifest;
  assert.equal(digest(payload), release_id);
  assert.equal(manifest.registry_sha256, digest(registry));
  assert.equal(registry.source_paths.filter(source => source === sourcePath).length, 1);
  assert(Array.isArray(previousSourcePaths) && previousSourcePaths.length === 54 && new Set(previousSourcePaths).size === 54);
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
  const allowedDocuments = ['general-settings.ai-credentials-and-sessions', 'general-settings.ai-models-and-health'];
  assert.equal(sourceChanges.length, 2);
  assert.deepEqual(sourceChanges.map(change => change.document_id).sort(), allowedDocuments);
  for (const change of sourceChanges) {
    assert.equal(change.path, 'nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts');
    assert.equal(change.before_sha256, '9334cb76177f27fd047c54bcd6de9174b0c698c36c23fea43c7a9a1bf27c192b');
    assert.equal(fm.sha256(fs.readFileSync(path.join(root,change.path))), change.after_sha256);
    const source = previousManifest.documents.find(document=>document.document_id===change.document_id)?.source_hashes.find(source=>source.path===change.path);
    assert.equal(source?.sha256,change.after_sha256);
    source.sha256=change.before_sha256;
  }
  const { release_id: ignored, ...previousPayload } = previousManifest;
  void ignored;
  previousManifest.release_id = digest(previousPayload);
  assert.equal(previousManifest.release_id, historical.release, 'AI-32 only adds one excluded draft and traced adapter provenance; published content/read contracts cannot drift');
  return { manifest: previousManifest, registry: previousRegistry };
}
async function main() {
  const args = process.argv.slice(2); assert(args.every(argument => argument === '--write'));
  const compiler = await import(pathToFileURL(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/compiler.mjs')).href);
  const current = compiler.compileKnowledge(root), registry = read('nodia-server/config/nodia-ai-knowledge.registry.json');
  const previousSourcePaths = args.includes('--write') ? [...read('docs/evidence/nodia-ai-ai30-knowledge-delta.json').previous_source_paths, 'docs/nodia-ai/knowledge/nodia-ai/features/restricted-reports.md'].sort() : read('docs/evidence/nodia-ai-ai32-knowledge-delta.json').previous_source_paths;
  const sourceChanges = args.includes('--write') ? ['general-settings.ai-credentials-and-sessions','general-settings.ai-models-and-health'].map(document_id=>({document_id,path:'nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts',before_sha256:'9334cb76177f27fd047c54bcd6de9174b0c698c36c23fea43c7a9a1bf27c192b',after_sha256:fm.sha256(fs.readFileSync(path.join(root,'nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts')))})) : read('docs/evidence/nodia-ai-ai32-knowledge-delta.json').document_source_hash_changes;
  const prior = unwindAi32(current.manifest, registry, previousSourcePaths, sourceChanges);
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
    assert.throws(() => unwindAi32(value.manifest, value.registry, previousSourcePaths, sourceChanges));
  }
  const delta = { schema_version: 1, stage: 'AI-32', previous_release: prior.manifest.release_id, release: current.manifest.release_id,
    previous_registry_sha256: prior.manifest.registry_sha256, registry_sha256: current.manifest.registry_sha256,
    added_excluded_source: sourcePath, previous_source_paths: previousSourcePaths, existing_source_paths_reordered_only: true, changed_manifest_fields: ['documents','registry_sha256', 'release_id'], document_source_hash_changes: sourceChanges,
    sources: current.counts.sources, excluded: current.counts.excluded, published_capabilities: current.manifest.capability_contracts.length,
    published_fragments: current.manifest.fragments.length, new_published_content: false, approved_documents_changed: false, rejected_mutation_checks: mutations.length };
  const destination = path.join(root, 'docs/evidence/nodia-ai-ai32-knowledge-delta.json');
  if (args.includes('--write')) fs.writeFileSync(destination, JSON.stringify(delta, null, 2) + '\n');
  else assert.deepEqual(read('docs/evidence/nodia-ai-ai32-knowledge-delta.json'), delta);
  console.log(JSON.stringify({ status: 'ai32_excluded_draft_delta_verified', previous_release: delta.previous_release, release: delta.release, sources: delta.sources, excluded: delta.excluded, published_capabilities: delta.published_capabilities, published_fragments: delta.published_fragments, rejected_mutation_checks: mutations.length, new_published_content: false }));
}
module.exports = { unwindAi32 };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
