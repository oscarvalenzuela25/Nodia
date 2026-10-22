// Offline finalization: compare source provenance without emitting a release or rewriting historical receipts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const mode = process.argv[2] ?? '--check';
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const hash = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const reference = name => ({ path: name, sha256: hash(name) });

async function main() {
  assert(['--write', '--check'].includes(mode));
  const manifestPath = 'nodia-server/dist/nodia-ai/knowledge/manifest.json';
  const prior = read(manifestPath);
  const { compileKnowledge } = await import(pathToFileURL(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/compiler.mjs')).href);
  const compiled = compileKnowledge(root, prior);
  const current = compiled.manifest;
  assert.equal(prior.release_id, 'bde4090377b15d8519c9e001a758cf24e70ee3d54bff93ea67fb5dce1fb0a134');
  assert.equal(current.release_id, 'c70317bf3106f002a399c5449158f0cdea204a308f1016dc0053a27be3e6ad36');
  const sourcePath = 'docs/mvp/45-nodia-ai-implementation-plan.md';
  const documentId = 'nodia-ai.conversation-coordination';
  const originalSource = prior.documents.find(d => d.document_id === documentId).source_hashes.find(s => s.path === sourcePath);
  const changedSource = current.documents.find(d => d.document_id === documentId).source_hashes.find(s => s.path === sourcePath);
  assert.equal(originalSource.sha256, '26f47d8b6fbeb8831f80c0da2bd63e2094e3b707495fe7c875ddae9a16f3e2e7');
  assert.equal(changedSource.sha256, hash(sourcePath));
  const normalized = structuredClone(current);
  normalized.release_id = prior.release_id;
  normalized.documents.find(d => d.document_id === documentId).source_hashes.find(s => s.path === sourcePath).sha256 = originalSource.sha256;
  assert.deepEqual(normalized, prior, 'unexpected release differences beyond the documented source hash');
  assert.deepEqual(compiled.counts, { sources: 59, excluded: 28 });
  const historical = read('docs/evidence/nodia-ai-ai36-c05-publication-validation.json');
  assert.equal(historical.compiled_publication.release_id, prior.release_id);
  const record = {
    schema_version: 1,
    stage: 'AI-37',
    status: 'source_hash_only_release_change_pending_next_build_not_adopted',
    reason: 'AI37 checklist completion changes the source provenance of an approved conversation-coordination fiche.',
    historical_and_candidate04_release: prior.release_id,
    next_in_memory_release: current.release_id,
    exact_diff: [
      { document_id: documentId, source: sourcePath, before: originalSource.sha256, after: changedSource.sha256 },
      { field: 'release_id', before: prior.release_id, after: current.release_id },
    ],
    unchanged: { approved_document_content_and_revisions: true, fragments: 31, capabilities: 74,
      bindings_registry_and_contracts: true, source_count: 59, excluded_count: 28,
      all_other_manifest_fields: true, frozen_candidate04: true },
    historical_C05_comparator: {
      command: 'node docs/evidence/scripts/nodia-ai-ai36-c05-publication-build.cjs --check',
      exit_code: 1,
      result: 'artifact drift solely in compiled_publication.release_id; historical receipt retained unchanged',
      rerun_log: reference('.tmp/ai37-publication-final.log'),
    },
    evidence: [reference(sourcePath), reference(manifestPath),
      reference('docs/evidence/nodia-ai-ai36-c05-publication-validation.json'),
      reference('docs/evidence/nodia-ai-ai37-knowledge.json'),
      reference('docs/evidence/nodia-ai-ai37-validation.json')],
    boundaries: { assets_emitted: false, historical_receipts_rewritten: false, deployment: false,
      provider_calls: 0, SQL_access: false, new_knowledge_approval: false },
    next_gate: 'Next official build and immutable deployment packet must pin the new release and validate its assets; candidate04 does not contain this documentation-only provenance update.',
    validator: reference('docs/evidence/scripts/validate-nodia-ai-ai37-documentation.cjs'),
  };
  const serialized = JSON.stringify(record, null, 2) + '\n';
  const output = path.join(root, 'docs/evidence/nodia-ai-ai37-documentation-finalization.json');
  if (mode === '--write') {
    assert(!fs.existsSync(output), 'never overwrite frozen finalization evidence');
    fs.writeFileSync(output, serialized);
  } else assert.equal(fs.readFileSync(output, 'utf8'), serialized, 'documentation finalization drift');
  console.log(JSON.stringify({ stage: 'AI-37', mode, status: record.status, exact_diff_fields: 2,
    published: prior.release_id, next_in_memory: current.release_id }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
