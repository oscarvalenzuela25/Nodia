// Reconcile the final AI-34 evidence without accounts, network, migrations or inference.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
process.chdir(root);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = {
  units: 'docs/evidence/nodia-ai-ai34-unit-validation.json',
  sql: 'docs/evidence/nodia-ai-ai34-sql-validation.json',
  budgets: 'docs/evidence/nodia-ai-ai34-adapter-budgets.json',
  native: 'docs/evidence/nodia-ai-ai34-native-offline.json',
  nativeParity: 'docs/evidence/nodia-ai-ai34-native-active-parity.json',
  ui: 'docs/evidence/nodia-ai-ai34-ui-validation.json',
  activation: 'docs/evidence/nodia-ai-ai34-runtime-activation.json',
  live: 'docs/evidence/nodia-ai-ai34-live-validation.json',
  health: 'docs/evidence/nodia-ai-ai34-final-health.json',
  catalog: 'docs/evidence/nodia-ai-ai34-catalog-delta.json',
  lineage: 'docs/evidence/nodia-ai-ai34-knowledge-lineage.json',
  modalities: 'docs/evidence/nodia-ai-ai34-modality-observation.json',
  successfulMcpDiagnostic: 'docs/evidence/nodia-ai-ai34-mcp-compat-diagnostic.json',
  docLinks: 'docs/evidence/nodia-ai-ai34-doc-links.json',
};
const data = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
const diagnosticActivation = 'docs/evidence/nodia-ai-ai34-native-diagnostics-activation.json';
if (fs.existsSync(diagnosticActivation)) {
  files.diagnosticActivation = diagnosticActivation;
  data.diagnosticActivation = read(diagnosticActivation);
  assert.equal(data.diagnosticActivation.status, 'passed');
}
const roleActivation = 'docs/evidence/nodia-ai-ai34-native-role-activation.json';
if (fs.existsSync(roleActivation)) {
  files.roleActivation = roleActivation;
  data.roleActivation = read(roleActivation);
  assert.equal(data.roleActivation.status, 'passed');
}
const metadataRefresh = 'docs/evidence/nodia-ai-ai34-metadata-refresh.json';
if (fs.existsSync(metadataRefresh)) {
  files.metadataRefresh = metadataRefresh;
  data.metadataRefresh = read(metadataRefresh);
  assert.equal(data.metadataRefresh.status, 'passed');
}
const mcpActivation = 'docs/evidence/nodia-ai-ai34-native-mcp-activation.json';
if (fs.existsSync(mcpActivation)) {
  files.mcpActivation = mcpActivation;
  data.mcpActivation = read(mcpActivation);
  assert.equal(data.mcpActivation.status, 'passed');
}
for (const key of ['sql', 'budgets', 'native', 'nativeParity', 'ui', 'activation', 'health'])
  assert.equal(data[key].status, 'passed', key);
assert.ok(['passed', 'partial'].includes(data.live.status));
assert.equal(data.units.status, 'passed_with_documented_global_test_fixture_typing_limit');
assert.equal(data.units.suites[0].files, 219);
assert.ok(data.units.suites[0].tests_passed >= 3538);
assert.equal(data.units.suites[0].failed, 0);
assert.deepEqual(data.units.suites.slice(1, 2).map(suite => [suite.tests_passed, suite.files, suite.failed]), [[1716, 223, 0]]);
assert.equal(data.sql.assertion_result.checks, 36);
assert.equal(data.sql.configured_database_used, false);
assert.equal(data.sql.disposable_containers_remaining, 0);
assert.ok(data.native.linux_tests >= 409);
assert.ok(data.native.source_files >= 96);
assert.equal(data.native.native_image_source_drift, 0);
assert.equal(data.nativeParity.drift_count, 0);
assert.equal(data.nativeParity.source_manifest_sha256, data.native.source_manifest_sha256);
assert.equal((data.mcpActivation ?? data.roleActivation ?? data.diagnosticActivation ?? data.activation).native_image_after, data.native.candidate_image);
assert.equal(data.activation.compiled_files_verified, 931);
assert.equal(data.activation.migration.migrations_after, 28);
assert.deepEqual(data.activation.migration.schema, { tables: 21, columns: 289, snapshot_columns: 9, snapshots: 0 });
assert.equal(data.activation.configured_chat_preserved, true);
assert.equal(data.ui.combinations, 50);
assert.equal(data.ui.lost_draft_cases, 0);
assert.equal(data.ui.horizontal_overflow_cases, 0);
assert.ok(data.live.generation_requests >= 4);
assert.equal(data.live.operational_sql_writes, 0);
assert.equal(data.live.user_chats_created, 0);
assert.equal(data.live.unresolved_attempts, 0);
assert.equal(data.lineage.status, 'passed');
assert.equal(data.lineage.published_fragments_unchanged, true);
assert.equal(data.lineage.capability_contracts_unchanged, true);
assert.equal(data.modalities.status, 'passed');
assert.equal(data.modalities.observations.find(item => item.mode === 'token_plan_web').supports_mcp, false);
assert.equal(data.modalities.observations.find(item => item.mode === 'token_plan_agentic').supports_mcp,
  data.live.agentic_acceptance_complete);
assert.ok(data.modalities.observations.every(item => item.available === true &&
  item.verified_modalities.length === 0 && item.verified_attachment_media_types.length === 0));
assert.equal(data.successfulMcpDiagnostic.status, 'not_found');
assert.deepEqual(data.successfulMcpDiagnostic.events, []);
assert.equal(data.docLinks.status, 'passed');
assert.deepEqual(data.docLinks.missing_targets, []);
assert.equal(data.docLinks.external_requests, 0);
if (data.live.status === 'passed') {
  assert.equal(data.live.successful_compactions, 2);
  assert.equal(data.live.successful_continuity_answers, 2);
  assert.equal(data.live.successful_mcp_read_probes, 1);
} else {
  assert.equal(data.live.agentic_acceptance_complete, false);
  assert.equal(data.live.successful_compactions >= 1, true);
  assert.equal(data.live.successful_continuity_answers >= 1, true);
}
const manifest = read('nodia-server/dist/nodia-ai/knowledge/manifest.json');
const pin = read('nodia-server/dist/nodia-ai-context/config/knowledge-pin.json');
assert.equal(pin.release_id, manifest.release_id);
assert.equal(data.live.knowledge_release, manifest.release_id);
assert.equal(manifest.documents.length, 27);
assert.equal(manifest.fragments.length, 27);
assert.equal(manifest.capability_contracts.length, 67);
const registry = read('nodia-server/config/nodia-ai-knowledge.registry.json');
assert.equal(registry.source_paths.length, 57);
const sourceManifest = read('.tmp/ai34-native-manifest.json');
assert.equal(Object.keys(sourceManifest).length, data.native.source_files);
assert.equal(hash('.tmp/ai34-native-manifest.json'), data.native.source_manifest_sha256);
for (const [file, digest] of Object.entries(sourceManifest)) assert.equal(hash('nodia-gemini-microservice/' + file), digest, file);
assert.equal(data.health.compiled_files_verified, 931);
assert.deepEqual(data.health.compiled_drift_files, []);
assert.equal(data.health.native_image, data.native.candidate_image);
assert.equal(data.health.native_source_files_verified, data.native.source_files);
assert.equal(data.health.native_source_drift_count, 0);
assert.equal(data.health.native_source_manifest_sha256, data.native.source_manifest_sha256);
assert.equal(data.health.knowledge_release, manifest.release_id);
assert.equal(data.health.configured_chat_preserved, true);
assert.ok(Object.values(data.health.units).every(value => value === 'active'));
assert.ok(Object.values(data.health.http).every(value => value === 200));
assert.equal(data.health.sql_quiet.migrations, 28);
assert.ok(['pending_jobs', 'open_attempts', 'held_or_unknown_slots'].every(key => data.health.sql_quiet[key] === 0));
assert.ok(Object.values(data.health.native_runtime_artifact_counts).every(value => value === 0));
const runtimeManifest = read('nodia-server/.tmp/ai34-runtime-candidate-manifest.json');
assert.equal(Object.keys(runtimeManifest).length, 931);
assert.equal(hash('nodia-server/.tmp/ai34-runtime-candidate-manifest.json'),
  (data.metadataRefresh ?? data.roleActivation ?? data.activation).compiled_manifest_sha256);
assert.equal(data.health.compiled_manifest_sha256,
  (data.metadataRefresh ?? data.roleActivation ?? data.activation).compiled_manifest_sha256);
for (const [file, digest] of Object.entries(runtimeManifest)) assert.equal(hash('nodia-server/' + file), digest, file);
const inventory = read('docs/mvp/nodia-ai-current-endpoints.json');
for (const source of inventory.sourceChecksums) assert.equal(hash(source.file), source.sha256, source.file);
const approved = registry.source_paths.map(file => {
  const text = fs.readFileSync(file, 'utf8');
  return JSON.parse(text.slice(text.indexOf('{'), text.indexOf('\n---', 4)));
});
assert.equal(approved.filter(item => item.document_status === 'approved').length, 27);
const feature = approved.find(item => item.document_id === 'nodia-ai.long-context-compaction');
assert.equal(feature.document_status, 'draft');
assert.equal(feature.integration_status, 'unregistered');
assert.equal(feature.approval, null);
assert.equal(feature.implementation.status, 'implemented');
assert.match(fs.readFileSync('docs/mvp/45-nodia-ai-implementation-plan.md', 'utf8'), /\[x\] \*\*AI-34/);
assert.match(fs.readFileSync('docs/architecture/decisions/ADR-059-nodia-ai-cited-context-compaction.md', 'utf8'), /Estado: propuesto/);
const output = {
  stage: 'AI-34', status: data.live.status,
  scope: data.live.status === 'passed' ? 'technical_laboratory_closure_not_document_approval_or_production_acceptance' :
    'implementation_activated_and_web_verified_real_agentic_acceptance_pending',
  observed_at_utc: new Date().toISOString(),
  clock_source: 'local_authoring_host; remote evidence retains VM timestamps, no cross-host clock synchronization claimed',
  verification_layers: {
    server: { tests: data.units.suites[0].tests_passed, files: data.units.suites[0].files }, client: { tests: 1716, files: 223 },
    python_linux: { tests: data.native.linux_tests, skipped: 0 }, python_windows: data.units.windows_python,
    sql: { checks: 36, database: 'disposable_real_postgresql', adapter: 'synthetic', business_effects: 0 },
    ui: { combinations: 50, source: 'isolated_synthetic_browser_fixture', mutations: 0 },
    gemini: { requests: data.live.generation_requests, compactions: data.live.successful_compactions,
      continuity_answers: data.live.successful_continuity_answers, mcp_read_probes: data.live.successful_mcp_read_probes,
      acceptance_complete: data.live.agentic_acceptance_complete,
      scope: 'compiled_builders_and_real_adapter_canary; SQL_worker_and_snapshot_persistence_separate', operational_sql_writes: 0 },
  },
  runtime: { node_files: 931, native_source_files: data.native.source_files, native_image: data.native.candidate_image,
    migrations: 28, nodia_ai_tables: 21, nodia_ai_columns: 289, snapshot_columns: 9,
    configured_chat_preserved: true, final_health: files.health },
  knowledge: { sources: 57, excluded: 30, published_documents: 27, published_fragments: 27,
    capabilities: 67, release: manifest.release_id, new_mcp_publication: false },
  global_test_fixture_typing: data.units.global_server_test_fixture_typecheck,
  limitations: [
    'Literal citations, complete new-message coverage and monotonic previous memory do not prove exhaustive semantic recall.',
    'One compaction per run and a bounded summary can still require a smaller request or a new chat; originals remain intact.',
    'The byte budget covers initial prompts and MCP responses controlled by Nodia, not private SDK reasoning or model token windows.',
    'Real canaries expose no business writes; product-wide and production acceptance remain AI-36..38.',
    'Native attachment format verification is not renewed by text or MCP-only canaries after restart.',
    'Successful MCP terminal INFO was not retained by this runtime; final used byte count is unknown, not synthesized from offline or failed runs.',
    'Global server test-fixture TypeScript remains failing outside changed AI-34 scope; production compilation and runtime suites pass.',
  ],
  evidence: Object.fromEntries(Object.entries(files).map(([key, file]) => [key, { path: file, sha256: hash(file) }])),
};
const target = 'docs/evidence/nodia-ai-ai34-validation.json';
const mode = process.argv[2] ?? '--check';
assert.ok(['--write', '--check'].includes(mode));
if (mode === '--write') fs.writeFileSync(target, JSON.stringify(output, null, 2) + '\n');
else {
  const existing = read(target);
  assert.deepEqual(existing.evidence, output.evidence);
  assert.deepEqual(existing.runtime, output.runtime);
  assert.deepEqual(existing.knowledge, output.knowledge);
}
console.log(JSON.stringify({ stage: output.stage, status: output.status, mode, release: manifest.release_id, node_files: 931, native_files: data.native.source_files }));
