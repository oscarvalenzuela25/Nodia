// Maintained extraction of the historical AI-06 filesystem/compiler fixtures.
// No dated publication unwind, registry reconciliation or operational calls.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import * as compiler from './compiler.mjs';
import fm from './frontmatter.cjs';

export function createKnowledgeCompilerFixtures(root = compiler.defaultRoot) {
  const { compileKnowledge, emitBundle, verifyBundle } = compiler;
  const read = p => fs.readFileSync(path.join(root, p), 'utf8');
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
  function check(name, action) { cases.push({ name, run: action }); }
  function reject(name, mutate, expected, options = {}) {
    check(name, () => { const f = fixture(); mutate(f); if (!options.raw) save(f, options.reapprove !== false);
      assert.throws(() => compileKnowledge(f.workspace), expected); });
  }
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


  return { cases, unavailable, cleanup() {
    const resolved = fs.realpathSync(temp), relative = path.relative(fs.realpathSync(os.tmpdir()), resolved);
    assert.equal(resolved, owner); assert(/^nodia-ai-ai06-[A-Za-z0-9_-]+$/.test(relative), 'Unsafe fixture cleanup');
    removeFixtureTree(resolved);
  } };
}
