// Closed provenance delta only. Never edits approved Markdown, registry, pins or historical AI-29 evidence.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const fm = require(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs'));
const deltaPath = 'docs/evidence/nodia-ai-ai29-r01-knowledge-delta.json';
const registryPath = 'nodia-server/config/nodia-ai-knowledge.registry.json';
const provenancePath = 'nodia-server/src/common/ai/codex/codex-runtime.service.ts';
const capabilityIds = [
  'nodia_ai_providers_codex_session', 'nodia_ai_providers_health',
  'nodia_ai_providers_models', 'nodia_invoices_eligible_invoice_connections',
];
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const digest = value => fm.sha256(fm.canonical(value));
const fileHash = file => fm.sha256(fs.readFileSync(path.join(root, file)));
function release(manifest) {
  const { release_id, ...payload } = manifest;
  assert.equal(digest(payload), release_id, 'Invalid manifest self hash');
  return release_id;
}
function changes(before, after, identity, collection, allowedIds) {
  assert.deepEqual(after.map(item => item[identity]), before.map(item => item[identity]), 'Provenance cannot change identities/order');
  const result = [];
  for (let index = 0; index < before.length; index++) {
    const old = before[index], next = after[index];
    const restored = structuredClone(next);
    assert.deepEqual(next[collection].map(item => item.path), old[collection].map(item => item.path), 'Provenance cannot add/remove sources');
    for (let sourceIndex = 0; sourceIndex < old[collection].length; sourceIndex++) {
      const a = old[collection][sourceIndex], b = next[collection][sourceIndex];
      if (a.sha256 === b.sha256) continue;
      assert(allowedIds.includes(old[identity]), 'Unexpected provenance identity: ' + old[identity]);
      assert.equal(a.path, provenancePath, 'Unexpected provenance path');
      assert.match(a.sha256, /^[a-f0-9]{64}$/); assert.match(b.sha256, /^[a-f0-9]{64}$/);
      assert.equal(fileHash(b.path), b.sha256, 'Final source is stale: ' + b.path);
      result.push({ [identity]: old[identity], path: a.path, before_sha256: a.sha256, after_sha256: b.sha256 });
      restored[collection][sourceIndex].sha256 = a.sha256;
    }
    assert.deepEqual(restored, old, 'Change outside traced source hashes: ' + old[identity]);
  }
  return result;
}
function restoreSources(items, changes, identity, collection, verifyFiles) {
  for (const change of changes) {
    assert.deepEqual(Object.keys(change).sort(), [identity, 'path', 'before_sha256', 'after_sha256'].sort());
    assert(capabilityIds.includes(change[identity]), 'Unexpected R01 capability');
    assert.equal(change.path, provenancePath);
    assert.match(change.before_sha256, /^[a-f0-9]{64}$/); assert.match(change.after_sha256, /^[a-f0-9]{64}$/);
    if (verifyFiles) assert.equal(fileHash(change.path), change.after_sha256, 'R01 implementation source drift');
    const source = items.find(item => item[identity] === change[identity])?.[collection].find(item => item.path === change.path);
    assert.equal(source?.sha256, change.after_sha256, 'R01 source tuple mismatch');
    source.sha256 = change.before_sha256;
  }
}
function unwindR01(manifest, registry, delta, { verifyFiles = true } = {}) {
  const historical = read('docs/evidence/nodia-ai-ai29-knowledge-delta.json');
  assert.deepEqual(Object.keys(delta).sort(), ['schema_version', 'stage', 'previous_release', 'release',
    'previous_registry_sha256', 'registry_sha256', 'changed_manifest_fields', 'document_source_hash_changes',
    'capability_implementation_source_hash_changes', 'registry_implementation_source_hash_changes',
    'published_document_bytes_unchanged', 'published_fragments_unchanged', 'public_contracts_unchanged',
    'new_published_content', 'reason', 'sources', 'excluded', 'published_capabilities', 'published_fragments'].sort());
  assert.equal(delta.schema_version, 1); assert.equal(delta.stage, 'AI-29-R01');
  assert.equal(delta.previous_release, historical.release);
  assert.equal(delta.release, release(manifest));
  assert.equal(delta.registry_sha256, digest(registry));
  assert.equal(manifest.registry_sha256, delta.registry_sha256);
  assert.deepEqual(delta.changed_manifest_fields, ['registry_sha256', 'capability_contracts', 'release_id']);
  assert.deepEqual(delta.document_source_hash_changes, [], 'R01 cannot change approved document provenance without review');
  assert.deepEqual(delta.capability_implementation_source_hash_changes, delta.registry_implementation_source_hash_changes);
  assert.equal(delta.capability_implementation_source_hash_changes.length, 4);
  assert.deepEqual(delta.capability_implementation_source_hash_changes.map(change => change.capability_id), capabilityIds);
  assert.equal(delta.published_document_bytes_unchanged, true); assert.equal(delta.published_fragments_unchanged, true);
  assert.equal(delta.public_contracts_unchanged, true); assert.equal(delta.new_published_content, false);
  assert.equal(delta.sources, 53); assert.equal(delta.excluded, 26);
  assert.equal(delta.published_capabilities, 67); assert.equal(delta.published_fragments, 27);
  const previousManifest = structuredClone(manifest), previousRegistry = structuredClone(registry);
  restoreSources(previousManifest.capability_contracts, delta.capability_implementation_source_hash_changes, 'capability_id', 'implementation_sources', verifyFiles);
  restoreSources(previousRegistry.capabilities, delta.registry_implementation_source_hash_changes, 'capability_id', 'implementation_sources', verifyFiles);
  assert.equal(digest(previousRegistry), delta.previous_registry_sha256, 'R01 registry changed outside traced provenance');
  previousManifest.registry_sha256 = delta.previous_registry_sha256;
  previousManifest.release_id = delta.previous_release;
  assert.equal(release(previousManifest), historical.release, 'R01 changed published content/contracts beyond traced provenance');
  return { manifest: previousManifest, registry: previousRegistry };
}
function buildDelta(before, final, registryBefore, registryFinal, counts) {
  const historical = read('docs/evidence/nodia-ai-ai29-knowledge-delta.json');
  assert.equal(release(before), historical.release);
  assert.equal(before.registry_sha256, digest(registryBefore));
  assert.equal(final.registry_sha256, digest(registryFinal));
  const manifestChanges = changes(before.capability_contracts, final.capability_contracts, 'capability_id', 'implementation_sources', capabilityIds);
  const registryChanges = changes(registryBefore.capabilities, registryFinal.capabilities, 'capability_id', 'implementation_sources', capabilityIds);
  assert.deepEqual(final.documents, before.documents, 'Approved documents/source hashes changed');
  assert.deepEqual(final.fragments, before.fragments, 'Published fragments changed');
  const delta = {
    schema_version: 1, stage: 'AI-29-R01', previous_release: before.release_id, release: release(final),
    previous_registry_sha256: before.registry_sha256, registry_sha256: final.registry_sha256,
    changed_manifest_fields: Object.keys(before).filter(key => fm.canonical(before[key]) !== fm.canonical(final[key])),
    document_source_hash_changes: [], capability_implementation_source_hash_changes: manifestChanges,
    registry_implementation_source_hash_changes: registryChanges,
    published_document_bytes_unchanged: true, published_fragments_unchanged: true,
    public_contracts_unchanged: true, new_published_content: false,
    reason: 'Durable Codex login/runtime ownership updates only the existing implementation provenance of four published reads; approved Markdown, fragments, schemas, routes, bindings and published identities remain unchanged. Gemini/Python durable login sources are not registered knowledge inputs.',
    sources: counts.sources, excluded: counts.excluded,
    published_capabilities: final.capability_contracts.length, published_fragments: final.fragments.length,
  };
  const restored = unwindR01(final, registryFinal, delta);
  assert.deepEqual(restored.manifest, before); assert.deepEqual(restored.registry, registryBefore);
  return delta;
}
function mutationChecks(manifest, registry, delta) {
  const checks = [];
  const reject = (name, mutate) => {
    const candidate = { manifest: structuredClone(manifest), registry: structuredClone(registry), delta: structuredClone(delta) };
    mutate(candidate);
    // Rehash the tampered inputs: rejection must come from the historical
    // closed delta, rather than merely a stale top-level checksum.
    candidate.manifest.registry_sha256 = digest(candidate.registry);
    candidate.delta.registry_sha256 = candidate.manifest.registry_sha256;
    const { release_id: ignored, ...payload } = candidate.manifest;
    void ignored;
    candidate.manifest.release_id = digest(payload);
    candidate.delta.release = candidate.manifest.release_id;
    assert.throws(() => unwindR01(candidate.manifest, candidate.registry, candidate.delta), undefined, name);
    checks.push(name);
  };
  reject('additional published capability', c => c.manifest.capability_contracts.push(structuredClone(c.manifest.capability_contracts[0])));
  reject('changed input contract', c => c.manifest.capability_contracts[0].input_schema.sha256 = '0'.repeat(64));
  reject('changed published document', c => c.manifest.documents[0].content_sha256 = '0'.repeat(64));
  reject('changed fragment asset', c => c.manifest.fragments[0].sha256 = '0'.repeat(64));
  reject('changed registry binding', c => c.registry.bindings[0].required_module_routes = ['/settings/users']);
  reject('unexpected implementation source', c => c.delta.capability_implementation_source_hash_changes[0].path = 'nodia-server/src/common/ai/gemini.service.ts');
  reject('duplicate provenance tuple', c => c.delta.capability_implementation_source_hash_changes.push(structuredClone(c.delta.capability_implementation_source_hash_changes[0])));
  reject('historical pin replacement', c => c.delta.previous_release = '0'.repeat(64));
  reject('publication declaration changed', c => c.delta.new_published_content = true);
  reject('additional delta fields', c => c.delta.unreviewed = true);
  return checks;
}
async function main() {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === '--write'), 'Only --write is supported');
  const compiler = await import(pathToFileURL(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/compiler.mjs')).href);
  assert.equal(compiler.registryPath, registryPath);
  const current = compiler.compileKnowledge(root), registry = read(registryPath);
  const delta = args.includes('--write')
    ? buildDelta(read('.tmp/ai29-r01-knowledge-before.json'), current.manifest, read('.tmp/ai29-r01-registry-before.json'), registry, current.counts)
    : read(deltaPath);
  unwindR01(current.manifest, registry, delta);
  const rejectedMutations = mutationChecks(current.manifest, registry, delta);
  if (args.includes('--write')) fs.writeFileSync(path.join(root, deltaPath), JSON.stringify(delta, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'r01_closed_knowledge_provenance_verified', previousRelease: delta.previous_release,
    releaseId: delta.release, publishedCapabilities: delta.published_capabilities, changedImplementationSourceTuples: delta.capability_implementation_source_hash_changes.length,
    rejectedMutationChecks: rejectedMutations.length,
    approvedDocumentsChanged: false, newCapabilitiesPublished: false, historicalAi29DeltaRewritten: false, wroteEvidence: args.includes('--write') }, null, 2));
}
module.exports = { buildDelta, unwindR01, mutationChecks };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
