// Offline evidence reconciliation only; never connects to accounts, database, storage or VM.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'); process.chdir(root);
const mode = process.argv[2] ?? '--check'; assert(['--write', '--check'].includes(mode));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const encode = value => JSON.stringify(value, null, 2) + '\n';
const outputFile = 'docs/evidence/nodia-ai-ai35-validation.json';
const files = {
  units: 'docs/evidence/nodia-ai-ai35-unit-validation.json',
  sql: 'docs/evidence/nodia-ai-ai35-sql-validation.json',
  browser: 'docs/evidence/nodia-ai-ai35-browser-qa.json',
  baseline: 'docs/evidence/nodia-ai-ai35-runtime-baseline.json',
  activation: 'docs/evidence/nodia-ai-ai35-runtime-activation.json',
  health: 'docs/evidence/nodia-ai-ai35-final-health.json',
  catalog: 'docs/evidence/nodia-ai-ai35-catalog-delta.json',
  searchPerformance: 'docs/evidence/nodia-ai-ai35-search-performance.json',
  fixtureTypes: 'docs/evidence/nodia-ai-ai35-global-fixture-types.json',
  contextRegression: 'docs/evidence/nodia-ai-ai35-ai34-regression.json',
};
const data = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
assert(['passed', 'passed_with_documented_global_test_fixture_typing_limit'].includes(data.units.status));
const suite = name => {const value = data.units.suites.find(item => item.name === name); assert(value, name); assert.equal(value.failed, 0); assert.equal(hash(value.source_report_local), value.report_sha256); return value;};
const server = suite('server_all'), client = suite('client_all');
assert(server.tests_passed >= 3543 && server.files >= 219); assert(client.tests_passed >= 1716 && client.files >= 223);
assert.equal(data.units.server_production_build.status, 'passed'); assert.equal(data.units.server_lint.errors, 0); assert.equal(data.units.client_typecheck_build_lint.status, 'passed');
assert.equal(data.units.client_typecheck_build_lint.final_source_revision_verified, true, 'Final frontend rerun must cover the last UI change');
const clientManifestFile = data.units.client_typecheck_build_lint.source_manifest_local;
assert.equal(hash(clientManifestFile), data.units.client_typecheck_build_lint.source_manifest_sha256);
for (const [file, digest] of Object.entries(read(clientManifestFile))) assert.equal(hash(file), digest, file);
for (const key of ['sql', 'browser', 'baseline', 'activation', 'health']) assert.equal(data[key].status, 'passed', key);
assert.equal(data.browser.profile_count, 24); assert.equal(data.browser.profiles.length, 24); assert.deepEqual(data.browser.final_console_errors, []);
assert(data.browser.profiles.every(profile => profile.scroll <= profile.width && profile.regions.every(region => region.scroll <= region.width)));
assert.equal(data.browser.resize_draft_profiles.length, 6);
assert(data.browser.resize_draft_profiles.every(profile => profile.draft && profile.draft === data.browser.resize_draft_profiles[0].draft
  && profile.edited && profile.edited === data.browser.resize_draft_profiles[0].edited && profile.documentWidth <= profile.bodyWidth));
assert(Math.abs(data.browser.older_history_anchor.delta_px) < 1); assert(data.browser.checks.length >= 14);
assert.equal(data.browser.provider_generations, 0); assert.equal(data.browser.r2_calls, 0); assert.equal(data.browser.configured_database_mutations, 0);
for (const key of ['html', 'main']) assert.equal(hash(data.browser.fixture[key]), data.browser.fixture[key + '_sha256']);
for (const image of data.browser.screenshots) assert.equal(hash(image.file), image.sha256);
assert(data.sql.checks >= 47); assert.equal(data.sql.passed.length, data.sql.checks);
assert.deepEqual(data.sql.database, {migrations: 29, nodia_ai_tables: 21, nodia_ai_columns: 289});
assert.equal(data.sql.configured_database_touched, false); assert.equal(data.sql.providers_called, false); assert.equal(data.sql.r2_called, false); assert.equal(data.sql.cleanup.disposable_postgresql_removed, true);
assert.equal(data.sql.compiled_stage_parity.drift_count, 0);
assert.equal(data.sql.compiled_stage_manifest_sha256, hash('.tmp/ai35-backend-sql-manifest.json'));
assert.equal(data.sql.source_harness_sha256, hash('nodia-server/test/nodia-ai-ai35-search.integration.mjs'));
assert.equal(data.searchPerformance.status, 'passed');
assert.equal(data.searchPerformance.configured_database_touched, false); assert.equal(data.searchPerformance.providers_called, false);
assert.equal(data.searchPerformance.source_harness_sha256, hash(data.searchPerformance.source_harness_path));
assert.equal(data.searchPerformance.source_validation.sha256, hash(data.searchPerformance.source_validation.path));
assert.equal(data.searchPerformance.interpretation.initial_regression_reproduced_by_index_presence, false);
assert(Object.values(data.searchPerformance.profiles).every(profile => profile.same_plan_all_samples && profile.gin_index_used === false));
assert.equal(data.fixtureTypes.status, 'failed_unchanged_from_ai34_baseline');
assert.equal(data.fixtureTypes.errors, 192); assert.equal(data.fixtureTypes.files, 48); assert.equal(data.fixtureTypes.changed_ai35_files_errors, 0);
assert.equal(hash(data.fixtureTypes.source_log_local), data.fixtureTypes.log_sha256);
assert.equal(data.fixtureTypes.log_sha256, data.fixtureTypes.baseline_log_sha256);
assert.equal(data.contextRegression.status, 'passed'); assert.equal(data.contextRegression.checks, 36);
assert.equal(data.contextRegression.passed.length, 36); assert.equal(data.contextRegression.real_inference, false);
assert.equal(data.contextRegression.configured_database_used, false); assert.equal(data.contextRegression.storage_operations, 0);
assert.equal(data.contextRegression.source_harness_sha256, hash(data.contextRegression.source_harness_path));
assert.equal(data.contextRegression.compiled_stage_manifest_sha256, data.sql.compiled_stage_manifest_sha256);
assert.equal(data.contextRegression.compiled_stage_parity.drift_count, 0);
const timings = Object.fromEntries(Object.keys(data.sql.measurements.before_index).map(profile => [profile, {
  before_median_ms: data.sql.measurements.before_index[profile].median_execution_ms,
  after_median_ms: data.sql.measurements.after_index[profile].median_execution_ms,
}]));
assert(timings.RareBodyBenchmark.after_median_ms <= timings.RareBodyBenchmark.before_median_ms / 2);
assert.equal(data.activation.previous_compiled_files_verified, 931); assert.equal(data.activation.compiled_files_verified, 932);
assert.deepEqual(data.activation.migration.applied, ['AddNodiaAiTextSearchIndex1793100000000']);
assert.equal(data.activation.migration.migrations_before, 28); assert.equal(data.activation.migration.migrations_after, 29);
assert.deepEqual(data.activation.migration.schema, {tables: 21, columns: 289});
assert.equal(data.activation.migration.database_backup_created, true); assert.equal(data.activation.migration.database_backup_catalog_verified, true); assert.equal(data.activation.migration.database_backup_mode, '600');
assert.equal(data.activation.native_restarted, false); assert.equal(data.activation.native_container_identity_preserved, true); assert.equal(data.activation.configured_chat_preserved, true);
assert.equal(data.activation.environment_mounts_isolation_preserved, true); assert.equal(data.activation.nginx_identity_preserved, true);
assert.equal(data.activation.activation_script_sha256, hash('docs/evidence/scripts/nodia-ai-ai35-activate.py'));
assert.equal(data.activation.migration_script_sha256, hash('docs/evidence/scripts/nodia-ai-ai35-migrate.mjs'));
assert.equal(data.activation.packet_sha256, hash('.tmp/ai35-runtime-packet.tar'));
assert.equal(data.health.compiled_files_verified, 932); assert.deepEqual(data.health.compiled_drift_files, []); assert.equal(data.health.configured_chat_preserved, true);
assert.equal(data.health.sql_quiet.migrations, 29); assert(['pending_jobs', 'open_attempts', 'held_or_unknown_slots'].every(key => data.health.sql_quiet[key] === 0));
assert(Object.values(data.health.native_runtime_artifact_counts).every(value => value === 0));
assert(Object.values(data.health.units).every(value => value === 'active')); assert(Object.values(data.health.http).every(value => value === 200));
assert.equal(data.health.native_image, data.baseline.native_image); assert.equal(data.health.native_source_files_verified, 99); assert.equal(data.health.native_source_drift_count, 0);
assert.equal(data.health.native_source_manifest_sha256, data.baseline.native_source_manifest_sha256);
assert.equal(data.health.schema.search_index_valid, true); assert.equal(data.health.schema.pg_trgm_public, true);
for (const key of ['baseline', 'activation', 'health']) {assert.equal(data[key].provider_generations, 0); assert.equal(data[key].storage_operations, 0);}
const runtimeFile = 'nodia-server/.tmp/ai35-runtime-candidate-manifest.json', runtime = read(runtimeFile);
assert.equal(Object.keys(runtime).length, 932); assert.equal(hash(runtimeFile), data.activation.compiled_manifest_sha256); assert.equal(hash(runtimeFile), data.health.compiled_manifest_sha256);
for (const [file, digest] of Object.entries(runtime)) assert.equal(hash('nodia-server/' + file), digest, file);
const knowledge = read('nodia-server/dist/nodia-ai/knowledge/manifest.json'), pin = read('nodia-server/dist/nodia-ai-context/config/knowledge-pin.json');
assert.equal(pin.release_id, knowledge.release_id); assert.equal(pin.release_id, data.activation.knowledge_release); assert.equal(pin.release_id, data.health.knowledge_release);
assert.equal(data.contextRegression.knowledge_release, pin.release_id);
assert.equal(knowledge.documents.length, 27); assert.equal(knowledge.fragments.length, 27); assert.equal(knowledge.capability_contracts.length, 67);
const registry = read('nodia-server/config/nodia-ai-knowledge.registry.json'); assert.equal(registry.source_paths.length, 58);
const frontmatter = file => {const source = fs.readFileSync(file, 'utf8'); return JSON.parse(source.slice(source.indexOf('{'), source.indexOf('\n---', 4)));};
const corpus = registry.source_paths.map(frontmatter); assert.equal(corpus.filter(item => item.document_status === 'approved').length, 27);
const feature = corpus.find(item => item.document_id === 'nodia-ai.conversation-organization'); assert(feature);
assert.equal(feature.document_status, 'draft'); assert.equal(feature.integration_status, 'unregistered'); assert.equal(feature.approval, null); assert.equal(feature.implementation.status, 'implemented');
assert.match(fs.readFileSync('docs/architecture/decisions/ADR-060-nodia-ai-authorized-text-search.md', 'utf8'), /Estado: propuesto/);
const inventoryFile = 'docs/mvp/nodia-ai-current-endpoints.json', apiFile = 'docs/mvp/nodia-ai-v1-coordination-api.json';
const inventory = read(inventoryFile), api = read(apiFile);
assert.equal(inventory.sourceChecksums.length, 849); assert.equal(inventory.counts.localModules, 85); assert.equal(inventory.counts.handlerOperations, 217); assert.equal(inventory.counts.httpMethodPathPairs, 336); assert.equal(api.routes.length, 41);
for (const source of inventory.sourceChecksums) assert.equal(hash(source.file), source.sha256, source.file);
assert.equal(hash(inventoryFile), data.catalog.after_inventory_sha256); assert.equal(hash(apiFile), data.catalog.after_coordination_sha256);
// Create an honest placeholder only to permit checking links to the new report itself.
if (mode === '--write' && !fs.existsSync(outputFile)) fs.writeFileSync(outputFile, encode({stage: 'AI-35', status: 'pending', scope: 'offline_evidence_reconciliation_in_progress'}));
const links = JSON.parse(cp.execFileSync('python', ['docs/evidence/scripts/nodia-ai-ai35-doc-links.py'], {encoding: 'utf8'}));
assert.equal(links.status, 'passed'); assert.deepEqual(links.missing_targets, []); assert.equal(links.external_requests, 0);
const linksFile = 'docs/evidence/nodia-ai-ai35-doc-links.json';
if (mode === '--write') fs.writeFileSync(linksFile, encode(links)); else assert.deepEqual(read(linksFile), links);
files.docLinks = linksFile;
const output = {
  stage: 'AI-35', status: 'passed', scope: 'technical_laboratory_closure_not_document_approval_or_production_acceptance',
  verification_layers: {server: {tests: server.tests_passed, files: server.files}, client: {tests: client.tests_passed, files: client.files},
    sql: {checks: data.sql.checks, database: 'disposable_real_postgresql16', content: 'synthetic', volume: data.sql.volume, measured_search_profiles: timings,
      paired_wide_search: {profiles: Object.fromEntries(Object.entries(data.searchPerformance.profiles).map(([key, value]) => [key, {before_median_ms: value.before_ms, after_median_ms: value.after_ms, ratio: value.ratio}])),
        initial_regression_reproduced: false, cause_of_absolute_timing_variation: 'unknown'}},
    browser: {evidence: files.browser, source: 'isolated_synthetic_http_browser_fixture', profiles: 24, interaction_checks: data.browser.checks.length,
      resized_drafts: 6, older_history_anchor_delta_px: data.browser.older_history_anchor.delta_px},
    runtime: {compiled_files: 932, migrations: 29, nodia_ai_tables: 21, nodia_ai_columns: 289, native_restart: false},
    context_regression: {checks: 36, database: 'disposable_real_postgresql16', adapter: 'synthetic', real_inference: false}},
  knowledge: {source_documents: 58, excluded: 31, published_documents: 27, published_fragments: 27, published_capabilities: 67, release: pin.release_id,
    new_feature_document_status: 'draft', new_feature_integration_status: 'unregistered'},
  provider_generations: 0, new_cloud_storage_operations: 0, configured_chat_preserved: true, unresolved_runtime_attempts: 0,
  evidence_hashes: Object.fromEntries(Object.entries(files).map(([key, file]) => [key, {file, sha256: hash(file)}])),
  limitations: [
    'SQL corpus and browser HTTP are synthetic. AI-35 does not claim new real Gemini, microphone, native attachment or cloud-storage acceptance.',
    'Search measurements are warm isolated laboratory samples, not production percentiles, concurrency or an SLA; broad/short terms retain their measured cost for AI-37.',
    'Index construction is transactional and blocks writers; this laboratory activation stops API/worker admissions and keeps the native provider container running.',
    'The private PostgreSQL16 backup catalog was verified, but AI-35 does not perform a restore.',
    'Conversation ordering uses mutable updated_at/id; concurrent organization can move results between pages.',
    'Existing global test-fixture typing limits, if recorded by unit evidence, remain distinct from the successful production build.',
    'AI-36..38 and documentary/productive approval remain independent gates.'
  ],
};
if (mode === '--write') fs.writeFileSync(outputFile, encode(output)); else assert.deepEqual(read(outputFile), output);
console.log(JSON.stringify({stage: 'AI-35', mode, status: 'passed', server_tests: server.tests_passed, client_tests: client.tests_passed, sql_checks: data.sql.checks, runtime_files: 932, source_hashes: 849, knowledge_release: pin.release_id, local_doc_links: links.local_file_targets_checked}));
