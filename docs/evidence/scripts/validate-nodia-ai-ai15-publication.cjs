// Publication/build validation only. Does not call providers, grant permissions or approve documents.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const repository = path.resolve(__dirname, '../../..');
const args = process.argv.slice(2);
let root = repository;
let reportPath = path.join(repository, 'docs/evidence/nodia-ai-ai15-publication-validation.json');
let writeReport = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--root' && args[index + 1]) root = path.resolve(args[++index]);
  else if (args[index] === '--report' && args[index + 1]) reportPath = path.resolve(args[++index]);
  else if (args[index] === '--write') writeReport = true;
  else throw new Error('Unsupported publication validation argument');
}
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fm = require(path.join(repository, 'nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs'));

async function main() {
  const { compileKnowledge, verifyBundle } = await import(pathToFileURL(path.join(repository, 'nodia-server/scripts/nodia-ai-knowledge/compiler.mjs')));
  const compiled = compileKnowledge(root);
  const registryPath = 'nodia-server/config/nodia-ai-knowledge.registry.json';
  const registry = JSON.parse(read(registryPath));
  const catalog = JSON.parse(read('docs/mvp/nodia-ai-v1-tool-catalog.json'));
  const expected = catalog.domainTools.filter(tool => tool.publication.implemented && ['read', 'read_artifact'].includes(tool.kind));
  assert.equal(expected.length, 67);
  assert.deepEqual(compiled.manifest.capability_contracts.map(tool => tool.capability_id).sort(), expected.map(tool => tool.name).sort());
  assert(compiled.manifest.capability_contracts.every(tool => ['read', 'read_artifact'].includes(tool.kind)));
  assert.equal(compiled.manifest.documents.length, 27);
  assert.equal(compiled.manifest.fragments.length, 27);
  assert.equal(compiled.counts.sources, 44);
  assert.equal(compiled.counts.excluded, 17);
  const cases = ['67 exact executable read/artifact contracts; no write capabilities', '27 selected feature documents; 17 other documents remain excluded'];
  const authorizationPath = 'docs/evidence/nodia-ai-ai15-publication-authorization.md';
  assert(read(authorizationPath).includes('Me parece bien, sigamos con lo pendiente de AI-15 para publicar las capacidades y verificarlas con Gemini real.'));
  for (const descriptor of compiled.manifest.documents) {
    const { metadata } = fm.parseDocument(read(descriptor.source_path));
    assert.equal(metadata.kind, 'feature');
    assert.equal(metadata.document_status, 'approved');
    assert(['verified', 'published'].includes(metadata.integration_status));
    assert.equal(metadata.approval.reference, authorizationPath);
    assert.equal(metadata.approval.revision, metadata.revision);
  }
  cases.push('Approval provenance points to the exact human publication instruction; compiler verifies revision/content hashes');
  for (const fragment of compiled.manifest.fragments) {
    assert.deepEqual(fragment.sections, ['Lecturas disponibles en AI-15']);
    assert.equal(fragment.required_module_routes.length, 2);
    assert(fragment.required_module_routes.includes('/tools/nodia-ai'));
    const content = compiled.assets.get(fragment.asset_path);
    assert(!/nodia_\w+_prepare_(?:create|update|delete)/.test(content));
    assert(!content.includes('Candidato; sin publicar'));
  }
  cases.push('Every prompt fragment selects only its reviewed read section and exact NodiaAI plus destination-module scope');

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nodia-ai15-publication-check-'));
  const original = fs.realpathSync(temporary);
  const fixture = path.join(temporary, 'source');
  try {
    fs.cpSync(path.join(root, 'docs'), path.join(fixture, 'docs'), { recursive: true });
    // Metadata references may include Client source or Server build scripts: copy the explicit file closure.
    for (const relative of registry.source_paths) {
      const parsed = fm.parseDocument(read(relative));
      const references = [...parsed.metadata.sources.map(item => item.path), ...parsed.metadata.verification.evidence_paths, ...(parsed.metadata.approval ? [parsed.metadata.approval.reference] : [])];
      if (parsed.metadata.document_status === 'approved') for (const match of parsed.body.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
        const link = match[1].replace(/^<|>$/g, '');
        if (link && !link.startsWith('#') && !/^https?:\/\//i.test(link)) references.push(path.posix.normalize(path.posix.join(path.posix.dirname(relative), link.split('#')[0])));
      }
      for (const reference of references) copy(reference);
    }
    copy(registryPath);
    for (const tool of registry.capabilities) {
      for (const source of tool.implementation_sources) copy(source.path);
      copy(tool.input_schema.path); copy(tool.output_schema.path);
    }
    const metadataPath = compiled.manifest.documents[0].source_path;
    const originalDocument = read(metadataPath);
    const parsed = fm.parseDocument(originalDocument);
    parsed.metadata.document_status = 'draft'; parsed.metadata.approval = null;
    fs.writeFileSync(path.join(fixture, metadataPath), fm.serializeDocument(parsed.metadata, parsed.body));
    assert.throws(() => compileKnowledge(fixture), /binding_document_unapproved/);
    fs.writeFileSync(path.join(fixture, metadataPath), originalDocument);
    cases.push('A formerly approved document reverted to draft cannot retain an active binding');

    const registryFile = path.join(fixture, registryPath);
    const invalidContract = structuredClone(registry);
    invalidContract.capabilities[0].input_schema.sha256 = 'f'.repeat(64);
    fs.writeFileSync(registryFile, JSON.stringify(invalidContract));
    assert.throws(() => compileKnowledge(fixture), /contract_hash_mismatch/);
    cases.push('Changed schema bytes/hash are rejected before publishing');

    const invalidScope = structuredClone(registry);
    invalidScope.bindings[0].required_module_routes = ['/settings/users'];
    fs.writeFileSync(registryFile, JSON.stringify(invalidScope));
    assert.throws(() => compileKnowledge(fixture), /module_binding_mismatch/);
    cases.push('A destination-module binding cannot be weakened or replaced');
    fs.writeFileSync(registryFile, JSON.stringify(registry));
    const recompiled = compileKnowledge(fixture);
    assert.equal(recompiled.manifest.release_id, compiled.manifest.release_id);
    const bundle = path.join(temporary, 'bundle');
    for (const [relative, content] of recompiled.assets) {
      fs.mkdirSync(path.dirname(path.join(bundle, relative)), { recursive: true });
      fs.writeFileSync(path.join(bundle, relative), content);
    }
    fs.writeFileSync(path.join(bundle, 'manifest.json'), JSON.stringify(recompiled.manifest));
    verifyBundle(bundle, compiled.manifest.release_id, compiled.manifest.catalog_release);
    const asset = compiled.manifest.fragments[0].asset_path;
    fs.appendFileSync(path.join(bundle, asset), 'tampered');
    assert.throws(() => verifyBundle(bundle, compiled.manifest.release_id, compiled.manifest.catalog_release), /fragment_hash_mismatch/);
    cases.push('Explicit-source copy recompiles deterministically; a corrupted deployed fragment fails verification');
  } finally {
    assert.equal(fs.realpathSync(temporary), original);
    const relative = path.relative(fs.realpathSync(os.tmpdir()), original);
    assert(/^nodia-ai15-publication-check-[A-Za-z0-9_-]+$/.test(relative));
    fs.rmSync(original, { recursive: true, force: true });
  }
  const sourcePaths = [...new Set([registryPath, authorizationPath, ...registry.source_paths, ...registry.capabilities.flatMap(tool => [...tool.implementation_sources.map(source => source.path), tool.input_schema.path, tool.output_schema.path])])].sort();
  const report = {
    date: '2026-10-16', task: 'AI-15', status: 'publication_build_verified_provider_acceptance_separate',
    scope: root === repository ? 'repository_publication_source' : 'isolated_candidate_publication_source',
    checks: cases, capabilities: 67, documents: 27, fragments: 27, excludedDocuments: 17,
    catalogRelease: compiled.manifest.catalog_release, releaseId: compiled.manifest.release_id,
    fragmentUtf8Bytes: [...compiled.assets.values()].reduce((sum, text) => sum + Buffer.byteLength(text), 0),
    sourceHashes: sourcePaths.map(relative => ({ path: relative, sha256: sha256(fs.readFileSync(path.join(root, relative))) })),
    providerCalls: 0, configuredDatabaseChanges: false,
    limitations: ['This command verifies the actual compiler, publication closure and corrupted/draft rejection; it does not call Gemini or certify provider availability.', 'Human provenance is the explicit publication instruction; hashes identify the technically reviewed revision and do not imply a human line-by-line review.', 'AI-06 historical evidence is retained; its old empty-corpus harness was not run as current publication acceptance.'],
  };
  if (writeReport) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  } else assert.deepEqual(JSON.parse(fs.readFileSync(reportPath, 'utf8')), report, 'Publication report drift: inspect changes before regenerating --write');
  console.log(JSON.stringify({ task: report.task, scope: report.scope, checks: cases.length, capabilities: report.capabilities, documents: report.documents, fragments: report.fragments, release: report.releaseId, wroteReport: writeReport }));

  function copy(relative) {
    const target = path.join(fixture, relative);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, relative), target);
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
