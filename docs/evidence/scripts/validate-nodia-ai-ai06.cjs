const { unwindAi32 } = require('./reconcile-nodia-ai-ai32-knowledge.cjs');
const { unwindAi32R02, unwindAi32Snapshot } = require('./reconcile-nodia-ai-ai32-r02-knowledge.cjs');
// Executes the real compiler against synthetic temporary files. No DB, HTTP or provider.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const fm = require(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs'));
const { unwindR01 } = require('./reconcile-nodia-ai-ai29-r01-knowledge.cjs');
const { unwindAi30 } = require('./reconcile-nodia-ai-ai30-knowledge.cjs');
const reportPath = 'docs/evidence/nodia-ai-ai06-knowledge-publication-validation.json';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const fileHash = p => fm.sha256(fs.readFileSync(path.join(root, p)));
const args = process.argv.slice(2);
const current = args.includes('--current');
assert(args.every(argument => ['--current', '--write'].includes(argument)), 'Unsupported knowledge validation argument');
assert(!(current && args.includes('--write')), '--current is read-only and cannot rewrite historical AI-06 evidence');

async function main() {
  const compiler = await import(pathToFileURL(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/compiler.mjs')).href);
  const { compileKnowledge, emitBundle, verifyBundle } = compiler;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nodia-ai-ai06-'));
  const owner = fs.realpathSync(temp), cases = [], unavailable = [];
  function removeFixtureTree(target) {
    const resolved = fs.realpathSync(target), relative = path.relative(owner, resolved);
    assert(!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep), 'Unsafe fixture target');
    fs.rmSync(resolved, { recursive: true });
  }
  const put = (workspace, p, content) => { const file = path.join(workspace, p); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
  const putJson = (workspace, p, data) => put(workspace, p, JSON.stringify(data, null, 2) + '\n');
  const source = 'docs/nodia-ai/knowledge/fixture/features/example.md';
  const parentSource = 'docs/nodia-ai/knowledge/fixture/README.md';
  let sequence = 0;
  function fixture() {
    const workspace = path.join(temp, String(++sequence)); fs.mkdirSync(workspace);
    const spec = 'docs/mvp/fixture-spec.md', proof = 'docs/evidence/fixture-proof.json';
    put(workspace, spec, '# Synthetic specification only\n'); putJson(workspace, proof, { fixture_only: true });
    put(workspace, 'docs/mvp/fixture-approval.md', '# Synthetic approval fixture; never approval of production documents\n');
    const implementation = 'nodia-server/src/fixture/fixture.use-case.ts';
    put(workspace, implementation, '// Synthetic contract source; no production capability or business operation.\n');
    const schemaPath = 'docs/evidence/fixture.schema.json';
    const schema = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://fixture.local/contracts',
      $defs: { FixtureInput: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' } }, required: ['id'] },
        FixtureOutput: { type: 'object', additionalProperties: false, properties: { found: { type: 'boolean' } }, required: ['found'] } } };
    putJson(workspace, schemaPath, schema);
    const digest = fm.sha256(fs.readFileSync(path.join(workspace, schemaPath)));
    const metadata = { schema_version: 1, document_id: 'fixture.example', product_id: 'fixture', kind: 'feature', revision: 1,
      document_status: 'approved', implementation: { status: 'implemented', notes: 'Synthetic compiler fixture only' },
      integration_status: 'verified', maintainer: 'METADATA_ONLY_FIXTURE', sources: [{ path: spec, kind: 'specification' }],
      verification: { checked_on: '2026-10-15', evidence_paths: [proof], notes: 'Synthetic evidence only' },
      approval: { reference: 'docs/mvp/fixture-approval.md', revision: 1, content_sha256: 'a'.repeat(64) } };
    const body = '# Synthetic feature\n\n## Uso\nPublic fixture explanation and [source](../../../../mvp/fixture-spec.md).\n\n## Interno\nPRIVATE_ONLY_FIXTURE\n';
    const product = { ...structuredClone(metadata), document_id: 'fixture', kind: 'product', document_status: 'draft',
      integration_status: 'unregistered', approval: null };
    put(workspace, parentSource, fm.serializeDocument(product, '# Synthetic product\n\n## Propósito\nDraft parent must not ship.\n'));
    const registry = { schema_version: 1, catalog_release: 'fixture-only/1', context_module_route: '/tools/nodia-ai',
      source_paths: [parentSource, source], capabilities: [{ capability_id: 'fixture_read', revision: 1, publication: 'published', kind: 'read',
        required_module_routes: ['/tools/fixture'], implementation_sources: [{ path: implementation,
          sha256: fm.sha256(fs.readFileSync(path.join(workspace, implementation))) }],
        input_schema: { path: schemaPath, definition: 'FixtureInput', sha256: digest },
        output_schema: { path: schemaPath, definition: 'FixtureOutput', sha256: digest }, evidence_paths: [proof] }],
      bindings: [{ document_id: 'fixture.example', fragment_id: 'usage', purpose: 'feature_explanation', sections: ['Uso'],
        requires: [{ capability_id: 'fixture_read', revision: 1, input_schema_sha256: digest, output_schema_sha256: digest }],
        required_module_routes: ['/tools/fixture'] }] };
    const f = { workspace, metadata, body, registry, schemaPath, implementation };
    save(f); return f;
  }
  function save(f, reapprove = true) {
    if (reapprove && f.metadata.approval) {
      f.metadata.approval.revision = f.metadata.revision;
      f.metadata.approval.content_sha256 = fm.contentHash(f.metadata, f.body);
    }
    put(f.workspace, source, fm.serializeDocument(f.metadata, f.body));
    putJson(f.workspace, compiler.registryPath, f.registry);
  }
  function check(name, action) { const result = action(); cases.push({ name, passed: result?.unavailable ? null : true }); }
  function reject(name, mutate, expected, options = {}) {
    check(name, () => { const f = fixture(); mutate(f); if (!options.raw) save(f, options.reapprove !== false);
      assert.throws(() => compileKnowledge(f.workspace), expected); });
  }
  try {
    check('approved bound fragment emits without draft parent or unselected metadata/body', () => {
      const f = fixture(), compiled = compileKnowledge(f.workspace);
      assert.equal(compiled.manifest.documents.length, 1); assert.equal(compiled.manifest.fragments.length, 1);
      const asset = [...compiled.assets.values()][0];
      for (const denied of ['PRIVATE_ONLY_FIXTURE', 'METADATA_ONLY_FIXTURE', 'Draft parent', '../../../../']) assert(!asset.includes(denied));
      assert.deepEqual(compiled.manifest.fragments[0].required_module_routes, ['/tools/fixture', '/tools/nodia-ai']);
      const output = emitBundle(f.workspace, compiled);
      assert.equal(verifyBundle(output, compiled.manifest.release_id, 'fixture-only/1').documents.length, 1);
      removeFixtureTree(path.join(f.workspace, 'docs'));
      assert.equal(verifyBundle(output, compiled.manifest.release_id, 'fixture-only/1').documents.length, 1);
    });
    check('identical inputs across two isolated roots produce identical manifest and bytes', () => {
      const a = compileKnowledge(fixture().workspace), b = compileKnowledge(fixture().workspace);
      assert.deepEqual(a.manifest, b.manifest); assert.deepEqual([...a.assets], [...b.assets]);
    });
    check('draft without runtime binding emits empty release', () => {
      const f = fixture(); f.metadata.document_status = 'draft'; f.metadata.integration_status = 'unregistered'; f.metadata.approval = null;
      f.registry.capabilities = []; f.registry.bindings = []; f.registry.context_module_route = null; save(f);
      const c = compileKnowledge(f.workspace); assert.equal(c.assets.size, 0); assert.equal(c.manifest.documents.length, 0);
    });
    reject('unknown author metadata field', f => f.metadata.secret = 'FIXTURE_NOT_REAL', /metadata_schema_invalid/);
    reject('duplicate canonical source entry', f => f.registry.source_paths.push(source), /registry_schema_invalid/);
    reject('duplicate capability identity', f => f.registry.capabilities.push(structuredClone(f.registry.capabilities[0])), /registry_schema_invalid|duplicate_capability/);
    reject('duplicate binding identity', f => f.registry.bindings.push(structuredClone(f.registry.bindings[0])), /registry_schema_invalid|duplicate_binding/);
    reject('missing indexed product document', f => f.registry.source_paths.shift(), /product_document_missing/);
    reject('missing document source file', f => fs.unlinkSync(path.join(f.workspace, 'docs/mvp/fixture-spec.md')), /source_missing/);
    reject('approval required for approved state', f => f.metadata.approval = null, /approval_required/);
    reject('approval requires a real verification date', f => f.metadata.verification.checked_on = null, /approval_verification_required/);
    reject('approval evidence reference must exist', f => f.metadata.approval.reference = 'docs/mvp/missing-approval.md', /source_missing/);
    reject('approval revision must match', f => f.metadata.approval.revision = 2, /approval_revision_mismatch/, { reapprove: false });
    reject('body edited without renewed approval', f => f.body += '\nChanged\n', /approval_hash_mismatch/, { reapprove: false });
    reject('draft cannot retain approval', f => f.metadata.document_status = 'draft', /approval_on_unapproved_document/);
    reject('active binding cannot publish draft', f => { f.metadata.document_status = 'draft'; f.metadata.approval = null; }, /binding_document_unapproved/);
    reject('registration alone does not verify integration', f => f.metadata.integration_status = 'registered', /binding_document_not_verified/);
    reject('planned implementation cannot publish', f => f.metadata.implementation.status = 'planned', /binding_document_not_verified/);
    reject('context module must be resolved', f => f.registry.context_module_route = null, /context_module_unresolved/);
    reject('unknown capability cannot bind', f => f.registry.bindings[0].requires[0].capability_id = 'fixture_missing', /capability_missing/);
    reject('capability revision incompatibility', f => f.registry.bindings[0].requires[0].revision = 2, /capability_contract_incompatible/);
    reject('schema incompatibility in binding', f => f.registry.bindings[0].requires[0].input_schema_sha256 = 'f'.repeat(64), /capability_contract_incompatible/);
    reject('schema bytes cannot change without registry update', f => put(f.workspace, f.schemaPath, '{}'), /contract_hash_mismatch/);
    reject('schema definition must exist', f => f.registry.capabilities[0].input_schema.definition = 'Missing', /contract_definition_missing/);
    reject('implementation source hash must match', f => put(f.workspace, f.implementation, '// changed fixture\n'), /implementation_hash_mismatch/);
    reject('module scope cannot be weakened or replaced', f => f.registry.bindings[0].required_module_routes = ['/settings/users'], /module_binding_mismatch/);
    reject('section must exist', f => f.registry.bindings[0].sections = ['Missing'], /section_missing/);
    reject('duplicate heading cannot select ambiguous text', f => f.body += '\n## Uso\nOther\n', /duplicate_section/);
    reject('unclosed fence rejected', f => f.body += '\n```text\nunclosed\n', /unclosed_markdown_fence/);
    reject('hidden HTML comment content is outside supported publication subset', f => f.body += '\n<!--\nPrivate comment\n-->\n', /html_comment_not_supported/);
    check('shorter inner fence does not expose a heading inside a longer fence', () => {
      const f = fixture(); f.body = '# Fixture\n\n````text\n## Uso\nPRIVATE_IN_CODE\n```\n````\n\n## Uso\nReal section.\n'; save(f);
      const c = compileKnowledge(f.workspace); assert(![...c.assets.values()][0].includes('PRIVATE_IN_CODE'));
    });
    reject('published capability needs a knowledge binding', f => { f.registry.bindings = []; f.metadata.integration_status = 'registered'; }, /published_capability_without_knowledge/);
    reject('verified document needs binding', f => { f.registry.bindings = []; f.registry.capabilities = []; }, /verified_document_without_binding/);
    reject('broken approved body link blocks publication', f => f.body += '\n[bad](./missing.md)\n', /source_missing/);
    reject('unsafe link scheme rejected', f => f.body += '\n[bad](file:///private)\n', /invalid_document_link/);
    reject('traversal cannot enter source index', f => f.registry.source_paths[1] = 'docs/nodia-ai/knowledge/fixture/features/../../private.md', /knowledge_path_denied/);
    reject('templates cannot enter source index', f => f.registry.source_paths[1] = 'docs/nodia-ai/knowledge/_templates/feature.md', /knowledge_path_denied/);
    reject('duplicate authoring table rejected', f => f.body += '\n| Metadato | Valor |\n', /duplicate_authoring_metadata/);
    reject('JSON duplicate key rejected', f => put(f.workspace, source,
      fm.serializeDocument(f.metadata, f.body).replace('"revision": 1,', '"revision": 1, "revision": 2,')), /duplicate_json_key/, { raw: true });
    reject('escaped JSON duplicate key rejected', f => put(f.workspace, source,
      fm.serializeDocument(f.metadata, f.body).replace('"document_id":', '"\\u0064ocument_id":"ignored", "document_id":')), /duplicate_json_key/, { raw: true });
    reject('unsafe JSON number rejected', f => put(f.workspace, source,
      fm.serializeDocument(f.metadata, f.body).replace('"revision": 1,', '"revision": 9007199254740992,')), /unsafe_json_number/, { raw: true });
    reject('UTF8 invalid bytes rejected', f => put(f.workspace, source, Buffer.from([0xff, 0xfe, 0x61])), /invalid_utf8/, { raw: true });
    reject('BOM rejected explicitly', f => put(f.workspace, source, '\uFEFF' + fm.serializeDocument(f.metadata, f.body)), /utf8_bom_denied/, { raw: true });
    reject('oversized authoring file rejected before parsing', f => put(f.workspace, source, 'x'.repeat(262145)), /input_too_large/, { raw: true });
    check('source junction rejected before following its target', () => {
      const f = fixture(), dir = path.join(f.workspace, 'docs/nodia-ai/knowledge/fixture/features'), target = path.join(temp, 'junction-target');
      fs.renameSync(dir, target);
      try { fs.symlinkSync(target, dir, process.platform === 'win32' ? 'junction' : 'dir'); }
      catch (error) { unavailable.push({ name: 'source junction', code: error.code }); return { unavailable: true }; }
      assert.throws(() => compileKnowledge(f.workspace), /symlink_denied/);
    });
    check('revision cannot be reused for changed approved content against prior release', () => {
      const f = fixture(), original = compileKnowledge(f.workspace).manifest; f.body += '\nChanged fixture\n'; save(f);
      assert.throws(() => compileKnowledge(f.workspace, original), /document_revision_not_advanced/);
      f.metadata.revision = 2; save(f); assert.equal(compileKnowledge(f.workspace, original).manifest.documents[0].revision, 2);
    });
    check('corrupted fragment and catalog mismatch rejected with trusted release pin', () => {
      const f = fixture(), compiled = compileKnowledge(f.workspace), out = emitBundle(f.workspace, compiled);
      assert.throws(() => verifyBundle(out, null, 'fixture-only/1'), /trusted_release_pin_required/);
      assert.throws(() => verifyBundle(out, compiled.manifest.release_id, 'other'), /release_contract_mismatch/);
      fs.appendFileSync(path.join(out, compiled.manifest.fragments[0].asset_path), 'tampered');
      assert.throws(() => verifyBundle(out, compiled.manifest.release_id, 'fixture-only/1'), /fragment_hash_mismatch/);
    });
    check('build lock excludes second writer', () => {
      const f = fixture(), c = compileKnowledge(f.workspace), parent = path.join(f.workspace, 'nodia-server/dist/nodia-ai');
      fs.mkdirSync(path.join(parent, '.knowledge.lock'), { recursive: true });
      assert.throws(() => emitBundle(f.workspace, c), /knowledge_build_locked/); fs.rmdirSync(path.join(parent, '.knowledge.lock'));
      emitBundle(f.workspace, c);
    });
    check('invalid next compile preserves valid bundle and retirement removes stale fragments', () => {
      const f = fixture(), c = compileKnowledge(f.workspace), out = emitBundle(f.workspace, c);
      f.registry.bindings[0].sections = ['Missing']; save(f); assert.throws(() => compileKnowledge(f.workspace), /section_missing/);
      assert.equal(verifyBundle(out, c.manifest.release_id, 'fixture-only/1').release_id, c.manifest.release_id);
      f.registry.bindings = []; f.registry.capabilities = []; f.metadata.document_status = 'retired';
      f.metadata.integration_status = 'retired'; f.metadata.approval = null; save(f);
      const empty = compileKnowledge(f.workspace); emitBundle(f.workspace, empty);
      assert.deepEqual(fs.readdirSync(out), ['manifest.json']);
    });
    check('a second metadata source is not accepted as a fallback', () => assert.throws(() => fm.parseDocument('# Old\n\n| Metadato | Valor |\n'), /json_frontmatter_required/));
    check('YAML syntax is not silently coerced to JSON', () => assert.throws(() => fm.parseDocument('---\ndocument_id: fixture.example\n---\n\n# Fixture\n'), /invalid_json/));
    check('templates use valid unique metadata with no invented check date or approval', () => {
      for (const kind of ['product', 'feature']) {
        const parsed = fm.parseDocument(read('docs/nodia-ai/knowledge/_templates/' + kind + '.md'));
        compiler.validateShape('Metadata', parsed.metadata); assert.equal(parsed.metadata.document_status, 'draft');
        assert.equal(parsed.metadata.verification.checked_on, null); assert.equal(parsed.metadata.approval, null);
      }
    });

    const corpus = compileKnowledge(root), registry = JSON.parse(read(compiler.registryPath));
    if (current) {
      check('current corpus preserves authorized AI-15 publication and excludes later drafts through AI-32', () => {
        const evidencePath = 'docs/evidence/nodia-ai-ai15-publication-validation.json';
        const evidence = JSON.parse(read(evidencePath));
        const previousRelease = '5b27b4a3873037c8e850df90a801d84c561545414a8b27de415a3c8ab1f66c96';
        const currentEvidence = JSON.parse(read('docs/evidence/nodia-ai-ai28-validation.json'));
        const baselineRelease = currentEvidence.knowledge.release_id;
        assert.match(baselineRelease, /^[a-f0-9]{64}$/);
        const rentalDraftSource = 'docs/nodia-ai/knowledge/reservations/features/confirmed-configuration.md';
        const lifecycleDraftSource = 'docs/nodia-ai/knowledge/reservations/features/confirmed-reservation-lifecycle.md';
        const moneyDraftSource = 'docs/nodia-ai/knowledge/reservations/features/confirmed-money.md';
        const preparationDraftSource = 'docs/nodia-ai/knowledge/reservations/features/confirmed-occupancy-preparation.md';
        const coreDraftSource = 'docs/nodia-ai/knowledge/general-settings/features/confirmed-administration.md';
        const providerDraftSource = 'docs/nodia-ai/knowledge/general-settings/features/confirmed-ai-configuration.md';
        const secureDraftSource = 'docs/nodia-ai/knowledge/general-settings/features/secure-ai-interaction.md';
        const expectedRelease = corpus.manifest.release_id;
        // Retain the original AI-29 evidence: first unwind R01's closed source
        // provenance tuples in BOTH registry and manifest, then AI-29 -> AI-28.
        const r01Delta = JSON.parse(read('docs/evidence/nodia-ai-ai29-r01-knowledge-delta.json'));
        // R02 preserves the original AI-32/R01 artifacts. Restore only its two
        // exact provenance tuples before traversing the historical draft delta.
        const ai32Historical = JSON.parse(read('docs/evidence/nodia-ai-ai32-knowledge-delta.json'));
        const ai32 = corpus.manifest.release_id === ai32Historical.release
          ? unwindAi32(corpus.manifest, registry)
          : (() => {
            const r02 = unwindAi32R02(corpus.manifest, registry);
            return unwindAi32Snapshot(r02.manifest, r02.registry);
          })();
        const ai30 = unwindAi30(ai32.manifest, ai32.registry);
        const ai29 = unwindR01(ai30.manifest, ai30.registry, r01Delta);
        const previousRegistry = { ...structuredClone(ai29.registry), source_paths: ai29.registry.source_paths.filter(source => ![secureDraftSource].includes(source)) };
        const { release_id: ai29Release, ...previousPayload } = structuredClone(ai29.manifest);
        previousPayload.registry_sha256 = fm.sha256(fm.canonical(previousRegistry));
        const coreDelta = JSON.parse(read('docs/evidence/nodia-ai-ai29-knowledge-delta.json'));
        assert.equal(coreDelta.previous_release, baselineRelease);
        assert.equal(coreDelta.release, ai29Release);
        assert.deepEqual(new Set(coreDelta.changed_manifest_fields), new Set(['documents','registry_sha256','release_id']));
        const allowedCoreSources = new Set(['nodia-server/src/ai-provider/ai-provider.service.ts']);
        assert.equal(coreDelta.document_source_hash_changes.length, 1);
        assert.deepEqual(new Set(coreDelta.document_source_hash_changes.map(change => change.path)), allowedCoreSources);
        for (const change of coreDelta.document_source_hash_changes) {
          assert.equal(fileHash(change.path), change.after_sha256, 'AI provider writer provenance changed after verification');
          const document = previousPayload.documents.find(item => item.document_id === change.document_id);
          const source = document?.source_hashes.find(item => item.path === change.path);
          assert.equal(source?.sha256, change.after_sha256);
          assert.match(change.before_sha256, /^[a-f0-9]{64}$/);
          source.sha256 = change.before_sha256;
        }
        assert.equal(fm.sha256(fm.canonical(previousPayload)), baselineRelease, 'AI-29 changed published content or read contracts beyond one draft and traced native-writer provenance');
        assert.equal(evidence.task, 'AI-15');
        assert.equal(evidence.status, 'publication_build_verified_provider_acceptance_separate');
        assert.equal(evidence.releaseId, previousRelease);
        assert.equal(evidence.capabilities, 67); assert.equal(evidence.documents, 27);
        assert.equal(evidence.fragments, 27); assert.equal(evidence.excludedDocuments, 17);
        assert.equal(corpus.counts.sources, 55); assert.equal(corpus.counts.excluded, 28);
        assert.equal(registry.source_paths.length, 55);
        assert.equal(currentEvidence.knowledge.sources, 52);
        assert.equal(currentEvidence.knowledge.excluded_drafts, 25);
        assert.equal(currentEvidence.knowledge.published_capabilities, 67);
        assert.equal(currentEvidence.knowledge.published_fragments, 27);
        assert.equal(currentEvidence.knowledge.provider_write_prepare_published, false);
        for (const [newSource, newDocumentId] of [
          ['docs/nodia-ai/knowledge/personal-finance/features/confirmed-movement-effect.md', 'personal-finance.confirmed-movement-effect'],
          ['docs/nodia-ai/knowledge/businesses/features/confirmed-business-effects.md', 'businesses.confirmed-business-effects'],
          [rentalDraftSource, 'reservations.confirmed-configuration'],
          [lifecycleDraftSource, 'reservations.confirmed-reservation-lifecycle'],
          [moneyDraftSource, 'reservations.confirmed-money'],
          [preparationDraftSource, 'reservations.confirmed-occupancy-preparation'],
          [coreDraftSource, 'general-settings.confirmed-administration'],
          [providerDraftSource, 'general-settings.confirmed-ai-configuration'],
          [secureDraftSource, 'general-settings.secure-ai-interaction'],
          ['docs/nodia-ai/knowledge/nodia-ai/features/restricted-reports.md', 'nodia-ai.restricted-reports'],
          ['docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md', 'nodia-ai.attachments-and-voice'],
        ]) {
          assert.equal(registry.source_paths.filter(source => source === newSource).length, 1);
          const draft = fm.parseDocument(read(newSource));
          assert.equal(draft.metadata.document_id, newDocumentId);
          assert.equal(draft.metadata.document_status, 'draft');
          assert.equal(draft.metadata.integration_status, 'unregistered');
          assert.equal(draft.metadata.approval, null);
          assert(!registry.bindings.some(binding => binding.document_id === newDocumentId));
          assert(!corpus.manifest.documents.some(document => document.document_id === newDocumentId));
          assert(!corpus.manifest.fragments.some(fragment => fragment.document_id === newDocumentId));
        }
        // Keep the AI-19 delta historical. Later releases also update traced
        // backend source hashes, so removing its one draft cannot reconstruct
        // the old manifest from today's source. The exact recorded current pin,
        // AI-15 approved document bytes and read-only contracts are checked here.
        const delta = JSON.parse(read('docs/evidence/nodia-ai-ai19-knowledge-delta.json'));
        assert.equal(delta.previous_release, previousRelease);
        assert.equal(delta.release, '057a331b12f05ae08f9f9b9a565d5349d17b7a2375e8852981f19c29d992a20e');
        assert.deepEqual(new Set(delta.changed_manifest_fields), new Set(['registry_sha256','release_id']));
        assert.equal(delta.new_published_content, false);
        assert.equal(corpus.manifest.catalog_release, evidence.catalogRelease);
        assert.equal(corpus.manifest.documents.length, 27); assert.equal(corpus.manifest.fragments.length, 27);
        assert.equal(corpus.assets.size, 27); assert.equal(registry.capabilities.length, 67);
        assert.equal(corpus.manifest.capability_contracts.length, 67);
        const expectedTools = JSON.parse(read('docs/mvp/nodia-ai-v1-tool-catalog.json')).domainTools
          .filter(tool => tool.publication.implemented && ['read', 'read_artifact'].includes(tool.kind));
        assert.equal(expectedTools.length, 67);
        assert.deepEqual(corpus.manifest.capability_contracts.map(tool => tool.capability_id).sort(), expectedTools.map(tool => tool.name).sort());
        assert(corpus.manifest.capability_contracts.every(tool => ['read', 'read_artifact'].includes(tool.kind)));
        const authorizationPath = 'docs/evidence/nodia-ai-ai15-publication-authorization.md';
        assert(read(authorizationPath).includes('Me parece bien, sigamos con lo pendiente de AI-15 para publicar las capacidades y verificarlas con Gemini real.'));
        for (const descriptor of corpus.manifest.documents) {
          const parsed = fm.parseDocument(read(descriptor.source_path));
          assert.equal(parsed.metadata.kind, 'feature'); assert.equal(parsed.metadata.document_status, 'approved');
          assert(['verified', 'published'].includes(parsed.metadata.integration_status));
          assert.equal(parsed.metadata.approval.reference, authorizationPath);
          assert.equal(parsed.metadata.approval.revision, parsed.metadata.revision);
          assert.equal(parsed.metadata.approval.content_sha256, fm.contentHash(parsed.metadata, parsed.body));
          const approvedHash = evidence.sourceHashes.find(item => item.path === descriptor.source_path);
          assert(approvedHash, 'Published source missing from AI-15 verification: ' + descriptor.source_path);
          assert.equal(fileHash(descriptor.source_path), approvedHash.sha256, 'Previously published source bytes changed');
        }
        for (const fragment of corpus.manifest.fragments) {
          assert.deepEqual(fragment.sections, ['Lecturas disponibles en AI-15']);
          assert.equal(fragment.required_module_routes.length, 2);
          assert(fragment.required_module_routes.includes('/tools/nodia-ai'));
          const content = corpus.assets.get(fragment.asset_path);
          assert(!/nodia_\w+_prepare_(?:create|update|delete)/.test(content));
          assert(!content.includes('Candidato; sin publicar'));
        }
        const schemaHash = fileHash('nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json');
        for (const location of ['src', 'dist']) {
          const pin = JSON.parse(read(`nodia-server/${location}/nodia-ai-context/config/knowledge-pin.json`));
          assert.equal(pin.release_id, expectedRelease); assert.equal(pin.catalog_release, evidence.catalogRelease);
          assert.equal(pin.schema_sha256, schemaHash);
        }
        const bundle = verifyBundle(path.join(root, 'nodia-server/dist/nodia-ai/knowledge'), expectedRelease, evidence.catalogRelease);
        assert.deepEqual(bundle, corpus.manifest, 'Compiled knowledge differs from its exact authorized source release');
      });
    } else {
      assert.equal(corpus.counts.sources, 43); assert.equal(corpus.counts.excluded, 43);
      assert.equal(corpus.manifest.documents.length, 0); assert.equal(corpus.assets.size, 0); assert.equal(registry.capabilities.length, 0);
    }
    const files = [compiler.registryPath, 'nodia-server/scripts/build-nodia-ai-knowledge.mjs',
      'nodia-server/scripts/nodia-ai-knowledge/compiler.mjs', 'nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs',
      'nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json', 'nodia-server/package.json',
      'docs/mvp/52-nodia-ai-ai06-knowledge-publication-contract.md',
      'docs/architecture/decisions/ADR-038-nodia-ai-compiled-knowledge-contract.md',
      'docs/evidence/scripts/validate-nodia-ai-ai06.cjs', ...registry.source_paths,
      'docs/nodia-ai/knowledge/_templates/product.md', 'docs/nodia-ai/knowledge/_templates/feature.md'];
    let localLinksChecked = 0;
    for (const file of files.filter(f => f.endsWith('.md'))) {
      const doc = read(file); assert(!doc.includes('\uFFFD'));
      assert(!doc.split(/\r?\n/).some(l => /[\t ]+$/.test(l)), 'Whitespace: ' + file);
      for (const match of doc.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
        const link = match[1].replace(/^<|>$/g, '').split('#')[0];
        if (!link || /^[a-z][a-z0-9+.-]*:\/\//i.test(link)) continue;
        const target = path.resolve(root, path.dirname(file), link);
        const generated = process.argv.includes('--write') && target === path.join(root, reportPath);
        assert(generated || fs.existsSync(target), 'Broken link: ' + file + ' -> ' + link); localLinksChecked++;
      }
    }
    if (current) {
      console.log(JSON.stringify({ status: 'compiler_fixtures_and_authorized_ai15_current_release_verified',
        checks: cases.length, unavailable: unavailable.length, fixtureChecks: cases.length - 1,
        sourceDocuments: corpus.counts.sources, excludedDocuments: corpus.counts.excluded,
        publishedDocuments: corpus.manifest.documents.length, publishedFragments: corpus.manifest.fragments.length,
        publishedCapabilities: corpus.manifest.capability_contracts.length, releaseId: corpus.manifest.release_id,
        schemaDefinitions: Object.keys(compiler.schema.$defs).length, localLinksChecked,
        wroteEvidence: false, approvalsChanged: false, servicesStarted: false, providerCalls: 0, businessWrites: 0 }, null, 2));
      return;
    }
    const report = { date: '2026-10-15', task: 'AI-06', status: 'compiler_verified_empty_corpus_release_runtime_pending',
      scope: 'Real build compiler and temporary-filesystem fixture execution, no production knowledge publication',
      checks: cases, unavailable, sourceDocuments: corpus.counts.sources, excludedDrafts: corpus.counts.excluded,
      publishedDocuments: 0, publishedFragments: 0, publishedCapabilities: 0, releaseId: corpus.manifest.release_id,
      schemaDefinitions: Object.keys(compiler.schema.$defs).length, localLinksChecked,
      artifacts: files.map(file => ({ file, sha256: fileHash(file) })),
      servicesStarted: false, providerCalls: 0, businessWrites: 0,
      limitations: ['Fixtures approvals/capabilities are synthetic and isolated; actual corpus remains draft/unregistered',
        'File/hash checks do not prove human approval provenance or semantic implementation/authorization of a capability',
        'Module IDs/authority and runtime KnowledgeRegistry/ContextBuilder/startup after prune remain AI-07/08/12',
        'No DB/HTTP/MCP/inference/deployment performed; full Server build is a separate command from this verifier'] };
    if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, reportPath), JSON.stringify(report, null, 2) + '\n');
    else assert.deepEqual(JSON.parse(read(reportPath)), report, 'AI-06 artifact drift; review then regenerate --write');
    console.log(JSON.stringify({ status: report.status, checks: cases.length, unavailable: unavailable.length,
      sourceDocuments: report.sourceDocuments, publishedDocuments: 0, schemaDefinitions: report.schemaDefinitions,
      localLinksChecked, wroteEvidence: process.argv.includes('--write') }, null, 2));
  } finally {
    const resolved = fs.realpathSync(temp), relative = path.relative(fs.realpathSync(os.tmpdir()), resolved);
    assert.equal(resolved, owner); assert(/^nodia-ai-ai06-[A-Za-z0-9_-]+$/.test(relative), 'Unsafe fixture cleanup');
    removeFixtureTree(resolved);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
