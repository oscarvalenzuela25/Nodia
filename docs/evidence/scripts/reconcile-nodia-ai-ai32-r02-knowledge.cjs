// AI-32-R02 changes only two approved-document provenance references to one
// existing adapter source. Historical AI-32/R01 evidence is never rewritten.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const fm = require(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs'));
const deltaPath = 'docs/evidence/nodia-ai-ai32-r02-knowledge-delta.json';
const historicPath = 'docs/evidence/nodia-ai-ai32-knowledge-delta.json';
const sourcePath = 'nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts';
const allowedIds = ['general-settings.ai-credentials-and-sessions', 'general-settings.ai-models-and-health'];
const pins = Object.freeze({
  historical_delta_sha256: 'f48d999e9b4211771af60fbad10d9741f82b0d9d9825d7aab98648128ad93d71',
  previous_release: 'a26257366f459d3baa059280b1a4105cb35615dc929de59624ce8fc986f27a99',
  release: '6c4ff3a4259aebb2ec0d360c278457daa5cc8d59d46685246823f298c5423d50',
  registry_sha256: '2eb742fd5493148e67bf00c6470c6e3c77113937f87dafe4efbbafbb0a17146d',
  before_sha256: '03a35791afd48230fb232b1c32b4c09f8ebd568bf1b25ee97623331d9b7a1cf5',
  after_sha256: '57f9b9dd8d8cc7391d00ea5ca22cb595b9006569b41d49d2e8f170a1f3ff4f67',
});
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const fileHash = file => fm.sha256(fs.readFileSync(path.join(root, file)));
const digest = value => fm.sha256(fm.canonical(value));
function selfHash(manifest) {
  const { release_id, ...payload } = manifest;
  assert.equal(digest(payload), release_id, 'Invalid knowledge manifest self hash');
  return release_id;
}
function rehash(manifest) {
  const { release_id: ignored, ...payload } = manifest;
  void ignored;
  manifest.release_id = digest(payload);
}
function historical() {
  assert.equal(fileHash(historicPath), pins.historical_delta_sha256, 'Historical AI-32 delta changed');
  const value = read(historicPath);
  assert.equal(value.release, pins.previous_release);
  assert.equal(value.registry_sha256, pins.registry_sha256);
  assert.deepEqual(value.document_source_hash_changes, allowedIds.map(document_id => ({
    document_id, path: sourcePath,
    before_sha256: '9334cb76177f27fd047c54bcd6de9174b0c698c36c23fea43c7a9a1bf27c192b',
    after_sha256: pins.before_sha256,
  })));
  return value;
}
function expectedDelta() {
  historical();
  return {
    schema_version: 1, stage: 'AI-32-R02', previous_release: pins.previous_release,
    release: pins.release, previous_registry_sha256: pins.registry_sha256,
    registry_sha256: pins.registry_sha256, historical_ai32_delta_sha256: pins.historical_delta_sha256,
    changed_manifest_fields: ['documents', 'release_id'],
    document_source_hash_changes: allowedIds.map(document_id => ({ document_id, path: sourcePath,
      before_sha256: pins.before_sha256, after_sha256: pins.after_sha256 })),
    registry_changed: false, published_document_bytes_unchanged: true,
    published_fragments_unchanged: true, public_contracts_unchanged: true,
    new_published_content: false, approved_documents_changed: false,
    sources: 55, excluded: 28, published_capabilities: 67, published_fragments: 27,
    reason: 'Exact MIME evidence is an optional private runtime observation. Only the implementation-source hash in two existing approved feature descriptors changes; no approved Markdown, binding, capability, schema, fragment or permission is published or modified.',
  };
}
function unwindAi32R02(manifest, registry, delta = read(deltaPath)) {
  assert.deepEqual(delta, expectedDelta(), 'R02 permits only the exact reviewed provenance tuples');
  assert.equal(selfHash(manifest), pins.release, 'Unexpected R02 knowledge release');
  assert.equal(digest(registry), pins.registry_sha256, 'R02 cannot change registry, bindings or capabilities');
  assert.equal(manifest.registry_sha256, pins.registry_sha256);
  assert.equal(fileHash(sourcePath), pins.after_sha256, 'R02 adapter source drift');
  assert.equal(registry.source_paths.length, 55);
  assert.equal(registry.capabilities.length, 67);
  assert.equal(registry.bindings.length, 27);
  assert.equal(manifest.documents.length, 27);
  assert.equal(manifest.fragments.length, 27);
  assert.equal(manifest.capability_contracts.length, 67);
  const previous = structuredClone(manifest);
  for (const change of delta.document_source_hash_changes) {
    const document = previous.documents.find(value => value.document_id === change.document_id);
    const source = document?.source_hashes.find(value => value.path === sourcePath);
    assert.equal(source?.sha256, pins.after_sha256, 'R02 source tuple missing or stale');
    source.sha256 = pins.before_sha256;
  }
  rehash(previous);
  assert.equal(selfHash(previous), pins.previous_release, 'R02 drift outside two traced source hashes');
  // The release anchor protects the entire old manifest, while the original
  // publication pins independently protect the approved Markdown bytes.
  const publication = read('docs/evidence/nodia-ai-ai15-publication-validation.json');
  for (const document of manifest.documents) {
    const approved = publication.sourceHashes.find(value => value.path === document.source_path);
    assert(approved, 'Missing original approved-document pin');
    assert.equal(fileHash(document.source_path), approved.sha256, 'Approved document bytes changed');
  }
  return { manifest: previous, registry: structuredClone(registry) };
}
function unwindAi32Snapshot(manifest, registry) {
  // The original unwinder also requires the old adapter bytes on disk. Those
  // bytes are now historical, so this pure bridge instead accepts ONLY its
  // exact immutable manifest/registry anchors, then reproduces its closed delta.
  const delta = historical();
  assert.equal(selfHash(manifest), delta.release);
  assert.equal(digest(registry), delta.registry_sha256);
  assert.equal(manifest.registry_sha256, delta.registry_sha256);
  const draft = fm.parseDocument(fs.readFileSync(path.join(root, delta.added_excluded_source), 'utf8'));
  assert.equal(draft.metadata.document_id, 'nodia-ai.attachments-and-voice');
  assert.equal(draft.metadata.document_status, 'draft');
  assert.equal(draft.metadata.integration_status, 'unregistered');
  assert.equal(draft.metadata.approval, null);
  assert(!registry.bindings.some(value => value.document_id === draft.metadata.document_id));
  assert(!manifest.documents.some(value => value.document_id === draft.metadata.document_id));
  assert(!manifest.fragments.some(value => value.document_id === draft.metadata.document_id));
  const previousRegistry = { ...structuredClone(registry), source_paths: structuredClone(delta.previous_source_paths) };
  assert.deepEqual([...registry.source_paths].sort(), [...delta.previous_source_paths, delta.added_excluded_source].sort());
  assert.equal(digest(previousRegistry), delta.previous_registry_sha256);
  const previous = structuredClone(manifest);
  previous.registry_sha256 = delta.previous_registry_sha256;
  for (const change of delta.document_source_hash_changes) {
    const source = previous.documents.find(value => value.document_id === change.document_id)
      ?.source_hashes.find(value => value.path === change.path);
    assert.equal(source?.sha256, change.after_sha256);
    source.sha256 = change.before_sha256;
  }
  rehash(previous);
  assert.equal(selfHash(previous), delta.previous_release);
  assert.equal(previous.release_id, read('docs/evidence/nodia-ai-ai30-knowledge-delta.json').release);
  return { manifest: previous, registry: previousRegistry };
}
function mutationChecks(manifest, registry, delta) {
  const checks = [];
  const reject = (name, mutate) => {
    const value = { manifest: structuredClone(manifest), registry: structuredClone(registry), delta: structuredClone(delta) };
    mutate(value);
    value.manifest.registry_sha256 = digest(value.registry);
    rehash(value.manifest);
    // Rehash attacker-supplied metadata too: the closed source/release anchors
    // must reject semantic changes rather than relying on stale checksums.
    value.delta.registry_sha256 = value.manifest.registry_sha256;
    value.delta.release = value.manifest.release_id;
    assert.throws(() => unwindAi32R02(value.manifest, value.registry, value.delta), undefined, name);
    checks.push(name);
  };
  reject('approved document content digest', value => { value.manifest.documents[0].content_sha256 = '0'.repeat(64); });
  reject('published fragment bytes', value => { value.manifest.fragments[0].sha256 = '0'.repeat(64); });
  reject('public read input schema', value => { value.manifest.capability_contracts[0].input_schema.sha256 = '0'.repeat(64); });
  reject('registry source addition', value => { value.registry.source_paths.push('docs/unreviewed.md'); });
  reject('registry capability addition', value => { value.registry.capabilities.push(structuredClone(value.registry.capabilities[0])); });
  reject('runtime module scope', value => { value.registry.bindings[0].required_module_routes = []; });
  reject('other document provenance', value => { value.manifest.documents.find(item => !allowedIds.includes(item.document_id)).source_hashes[0].sha256 = '0'.repeat(64); });
  reject('wrong allowed adapter hash', value => { value.manifest.documents.find(item => item.document_id === allowedIds[0]).source_hashes.find(item => item.path === sourcePath).sha256 = '0'.repeat(64); });
  reject('extra delta field', value => { value.delta.allow_unreviewed = true; });
  reject('changed before provenance pin', value => { value.delta.document_source_hash_changes[0].before_sha256 = '0'.repeat(64); });
  reject('changed after provenance pin', value => { value.delta.document_source_hash_changes[0].after_sha256 = '0'.repeat(64); });
  reject('missing provenance tuple', value => { value.delta.document_source_hash_changes.pop(); });
  reject('changed historical anchor', value => { value.delta.previous_release = '0'.repeat(64); });
  return checks;
}
async function main() {
  const args = process.argv.slice(2);
  assert(args.every(value => value === '--write'), 'Unsupported R02 knowledge argument');
  const compiler = await import(pathToFileURL(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/compiler.mjs')).href);
  const current = compiler.compileKnowledge(root), registry = read(compiler.registryPath);
  assert.deepEqual(current.counts, { sources: 55, excluded: 28 });
  assert.equal(current.assets.size, 27);
  const delta = expectedDelta();
  const snapshot = unwindAi32R02(current.manifest, registry, delta);
  const prior = unwindAi32Snapshot(snapshot.manifest, snapshot.registry);
  const checks = mutationChecks(current.manifest, registry, delta);
  if (args.includes('--write')) fs.writeFileSync(path.join(root, deltaPath), JSON.stringify(delta, null, 2) + '\n');
  else assert.deepEqual(read(deltaPath), delta);
  console.log(JSON.stringify({ status: 'ai32_r02_exact_provenance_delta_verified', release: current.manifest.release_id,
    previous_release: snapshot.manifest.release_id, through_ai32_release: prior.manifest.release_id,
    sources: current.counts.sources, excluded: current.counts.excluded, published_capabilities: 67,
    published_fragments: 27, rejected_mutation_checks: checks.length, new_published_content: false }));
}
module.exports = { unwindAi32R02, unwindAi32Snapshot };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
