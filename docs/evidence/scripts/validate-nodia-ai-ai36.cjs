// Evidence reconciliation: never connects to a database, provider or storage.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'); process.chdir(root);
const mode = process.argv[2] ?? '--check'; assert(['--write', '--check'].includes(mode));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const emit = (file, data) => {
  const value = JSON.stringify(data, null, 2) + '\n';
  if (mode === '--write') fs.writeFileSync(file, value);
  else assert.equal(fs.readFileSync(file, 'utf8'), value, file);
};
const files = {
  capabilities: 'docs/evidence/nodia-ai-ai36-capability-coverage.json',
  integration: 'docs/evidence/nodia-ai-ai36-integration-validation.json',
  regressions: 'docs/evidence/nodia-ai-ai36-regressions.json',
  client: 'docs/evidence/nodia-ai-ai36-client-acceptance.json',
  units: 'docs/evidence/nodia-ai-ai36-unit-validation.json',
  nativeBudget: 'docs/evidence/nodia-ai-ai36-native-budget-validation.json',
  integrationStage: 'docs/evidence/nodia-ai-ai36-integration-stage.json',
  runtimeParity: 'docs/evidence/nodia-ai-ai36-integration-runtime-parity.json',
  catalogDelta: 'docs/evidence/nodia-ai-ai36-catalog-delta.json',
  activation: 'docs/evidence/nodia-ai-ai36-runtime-activation.json',
  finalHealth: 'docs/evidence/nodia-ai-ai36-final-health.json',
};
const data = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
cp.execFileSync(process.execPath, ['docs/evidence/scripts/nodia-ai-ai36-capability-coverage.cjs', '--check'], {stdio: 'pipe'});
cp.execFileSync(process.execPath, ['docs/evidence/scripts/reconcile-nodia-ai-ai36.cjs', '--check'], {stdio: 'pipe'});
const capability = data.capabilities;
assert.equal(capability.counts.domain_candidates, 141);
assert.equal(capability.counts.candidate_names, 156);
assert.equal(capability.counts.baseline_handlers, 177);
assert.equal(capability.counts.current_handlers, 217);
assert.equal(capability.counts.current_aliases, 336);
assert.equal(capability.counts.excluded_bulk_handlers, 7);
assert.equal(capability.verification.every_domain_candidate_classified, true);
assert.equal(data.integration.status, 'passed'); assert.equal(data.integration.exit_code, 0);
const integrated = data.integration.assertion_result;
assert(integrated.checks >= 24); assert.equal(integrated.results.length, integrated.checks);
assert.equal(integrated.migrations, 29); assert.equal(integrated.provider_calls, 0);
assert.equal(data.integration.configured_database_used, false);
assert.equal(data.integration.storage_operations, 0);
assert.equal(data.integration.disposable_containers_remaining, 0);
for (const key of ['stdout', 'stderr', 'manifest']) assert.equal(sha(data.integration[key + '_source_local']), data.integration[key + '_sha256']);
assert.equal(sha(data.integration.source_report_local), data.integration.source_report_sha256);
assert.equal(data.integrationStage.status, 'passed');
assert.equal(data.runtimeParity.status, 'passed');
assert.deepEqual(data.runtimeParity.mismatches, []);
assert.equal(data.integration.manifest_sha256, data.integrationStage.manifest_sha256);
assert.equal(data.runtimeParity.manifest_sha256, data.integrationStage.manifest_sha256);
assert.equal(sha('nodia-server/test/nodia-ai-ai36.integration.mjs'), data.integrationStage.test_sha256);
assert.equal(data.runtimeParity.integration_test_sha256, data.integrationStage.test_sha256);
assert.equal(data.client.status, 'passed');
assert.equal(sha(data.client.test_file), data.client.source_sha256);
assert.equal(data.units.server_production_build.status, 'passed');
assert.equal(data.units.client_production_build.status, 'passed');
for (const suite of data.units.suites) {
  const output = read(suite.source_report_local);
  assert.equal(sha(suite.source_report_local), suite.report_sha256);
  assert.equal(output.numFailedTests, 0); assert.equal(output.numPendingTests, 0);
  assert.equal(output.numPassedTests, suite.tests_passed);
  assert.equal(output.testResults.length, suite.files);
}
for (const report of Object.values(data.units.coverage)) {
  assert.equal(sha(report.source_report_local), report.sha256);
  assert.deepEqual(read(report.source_report_local).total, report.totals);
}
assert.equal(data.units.global_server_fixture_types.byte_identical_to_baseline, true);
assert.equal(sha(data.units.global_server_fixture_types.log_local), data.units.global_server_fixture_types.log_sha256);
const fixtureBaseline = read(data.units.global_server_fixture_types.baseline);
assert.equal(data.units.global_server_fixture_types.log_sha256, fixtureBaseline.log_sha256);
assert.equal(data.units.global_server_fixture_types.errors, fixtureBaseline.errors);
assert.equal(data.units.global_server_fixture_types.files, fixtureBaseline.files);
for (const build of [data.units.server_production_build, data.units.client_production_build]) assert.equal(sha(build.log_local), build.log_sha256);
assert.equal(sha(data.units.new_knowledge_regression.source_report_local), data.units.new_knowledge_regression.sha256);
assert.equal(sha(data.units.new_prearm_regression.source_report_local), data.units.new_prearm_regression.sha256);
for (const [file, digest] of Object.entries(data.units.new_prearm_regression.final_specs)) assert.equal(sha(file), digest);
assert.equal(sha(data.units.lint.server_log_local), data.units.lint.server_log_sha256);
assert.equal(sha(data.units.lint.client_log_local), data.units.lint.client_log_sha256);
assert.equal(data.units.lint.server_errors, 0);
assert.equal(data.units.lint.client_new_acceptance_errors, 0);
assert.equal(data.nativeBudget.status, 'passed');
assert.equal(data.nativeBudget.tool_count, 74);
assert.equal(data.nativeBudget.within_budget, true);
assert.equal(data.nativeBudget.network, 'none');
assert.equal(data.nativeBudget.profiles_or_credentials_mounted, false);
assert.equal(data.nativeBudget.provider_generations, 0);
assert.equal(sha(data.nativeBudget.payload_source_local), data.nativeBudget.payload_sha256);
assert.equal(sha(data.nativeBudget.extractor_script_path), data.nativeBudget.extractor_script_sha256);
assert(data.nativeBudget.initial_and_first_listing_utf8_bytes <= data.nativeBudget.measurement.max_utf8_bytes);
assert.equal(data.activation.status, 'passed');
assert.equal(data.activation.native_restarted, false);
assert.equal(data.activation.publication_changed, false);
assert.equal(data.activation.compiled_files_verified, 932);
assert.equal(data.activation.provider_generations, 0);
assert.equal(data.activation.storage_operations, 0);
assert.equal(data.activation.configured_chat_preserved, true);
assert.deepEqual(data.activation.changed_paths, [
  'dist/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.js',
  'dist/nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.js',
]);
assert.equal(data.finalHealth.status, 'passed');
assert.equal(data.finalHealth.native_source_drift_count, 0);
assert.deepEqual(data.finalHealth.compiled_drift_files, []);
assert.equal(data.finalHealth.configured_chat_preserved, true);
assert.equal(data.finalHealth.compiled_manifest_sha256, data.activation.compiled_manifest_sha256);
for (const key of ['pending_jobs', 'open_attempts', 'held_or_unknown_slots']) assert.equal(data.finalHealth.sql_quiet[key], 0);
assert.equal(data.finalHealth.sql_quiet.migrations, 29);
assert(Object.values(data.finalHealth.units).every(value => value === 'active'));
assert(Object.values(data.finalHealth.http).every(value => value === 200));
assert(Object.values(data.finalHealth.native_runtime_artifact_counts).every(value => value === 0));
const runtimeManifestFile = '.tmp/ai36-runtime-candidate-manifest.json';
assert.equal(sha(runtimeManifestFile), data.activation.compiled_manifest_sha256);
const runtimeManifest = read(runtimeManifestFile);
assert.equal(Object.keys(runtimeManifest).length, 932);
const excludedRuntimeAssets = new Set(data.runtimeParity.runtime_non_executable_maps_and_declarations_excluded);
for (const [file, digest] of Object.entries(runtimeManifest)) if (!excludedRuntimeAssets.has(file)) assert.equal(sha('nodia-server/' + file), digest, file);
assert.equal(read('nodia-server/dist/nodia-ai-context/config/knowledge-pin.json').release_id, data.finalHealth.knowledge_release);
assert.equal(data.regressions.status, 'passed');
assert.equal(data.regressions.configured_database_used, false);
assert.equal(data.regressions.results.length, data.regressions.suites);
assert.equal(data.regressions.suites_failed, 0);
for (const regression of data.regressions.results) {
  assert.equal(regression.status, 'passed'); assert.equal(regression.exit_code, 0);
  assert.equal(sha(regression.harness_path), regression.source_sha256, regression.harness_path);
  const result = regression.assertion_result;
  if (result?.checks !== undefined) {
    const assertions = result.passed ?? result.results;
    assert.equal(assertions.length, result.checks, regression.harness);
  }
}
const sourceFile = 'docs/mvp/44-nodia-ai-data-model-review.md';
const requirements = [...fs.readFileSync(sourceFile, 'utf8').matchAll(/^\| (NR-\d{2}) \| ([^\n]+?) \| ([^\n]+?) \|$/gm)];
assert.equal(requirements.length, 34);
// Explicit traceability, reviewed alongside the actual assertions. A mapping is
// not a new execution and never changes the outcome of the source evidence.
const groups = {
  '01': ['AI-17', 'AI-21'], '02': ['AI-18', 'AI-19', 'AI-21'], '03': ['AI-19', 'AI-20', 'AI-21'],
  '04': ['AI-21'], '05': ['AI-15', 'AI-30'], '06': ['AI-30'], '07': ['AI-31'],
  '08': ['AI-23'], '09': ['AI-23'], '10': ['AI-22'], '11': ['AI-22'],
  '12': ['AI-25'], '13': ['AI-25'], '14': ['AI-25'], '15': ['AI-25', 'AI-26'],
  '16': ['AI-21', 'AI-24'], '17': ['AI-14', 'AI-21', 'AI-24'], '18': ['AI-20', 'AI-23'],
  '19': ['AI-27'], '20': ['AI-27'], '21': ['AI-29'],
  '22': ['AI-10', 'AI-16'], '23': ['AI-11'], '24': ['AI-11'], '25': ['AI-12'],
  '26': [], '27': [], '28': ['AI-10'], '29': ['AI-33'], '30': ['AI-34'],
  '31': [], '32': [], '33': [], '34': [],
};
const historical = {
  '21': 'docs/evidence/nodia-ai-ai29-validation.json',
  '24': 'docs/evidence/nodia-ai-ai34-native-mcp-offline.json',
  '26': 'docs/evidence/nodia-ai-ai32-r05-validation.json',
  '27': 'docs/evidence/nodia-ai-ai32-r06-validation.json',
  '28': 'docs/evidence/nodia-ai-ai32-r07-validation.json',
  '30': 'docs/evidence/nodia-ai-ai34-live-validation.json',
  '33': 'docs/evidence/nodia-ai-ai35-sql-validation.json',
};
const integratedCases = new Set(['02', '03', '04', '07', '16', '17', '18', '22', '27', '28', '32']);
const cases = requirements.map(([, id, request, expected]) => {
  const number = id.slice(-2), prior = historical[number];
  const evidence = [];
  if (groups[number].length) {
    for (const group of groups[number]) assert(data.regressions.results.some(item => item.suite === group && item.status === 'passed'), 'Missing passing regression group ' + group);
    evidence.push({file: files.regressions, layer: 'compiled_SQL_synthetic_records_with_per_suite_candidate_provenance', suite_groups: groups[number]});
  }
  if (integratedCases.has(number)) evidence.push({file: files.integration, layer: 'current_cross_product_HTTP_SQL_synthetic_records'});
  if (prior) {assert(fs.existsSync(prior)); evidence.push({file: prior, sha256: sha(prior), layer: 'historical_external_or_volume_evidence_not_reexecuted_by_AI36'});}
  if (['02', '03', '09', '18', '22'].includes(number)) evidence.push({file: files.client, layer: 'current_actual_client_components_synthetic_HTTP'});
  if (number === '31') {
    const evolution = read('.tmp/ai36-knowledge-evolution-final.json');
    assert(evolution.testResults.some(test => test.assertionResults.some(result => result.fullName.includes('NR-31') && result.status === 'passed')));
    evidence.push({file: files.units, layer: 'current_real_loader_and_builder_with_synthetic_published_bundle', selector: 'NR-31 exposes a new published product'});
  }
  const limits = [];
  if (Number(number) <= 21) limits.push('Internal guarantees and classification do not prove natural-language preparation through an unpublished MCP adapter.');
  if (['21', '24', '26', '27', '28', '30'].includes(number)) limits.push('Real-account, native or R2 evidence retains its historical version and scope; it is not renewed here.');
  if (number === '24') limits.push('AI-11 SQL covers physical runtime exclusion; the historical AI-34 native MCP report is only a transport/budget complement, not a new OCR/login concurrency test.');
  if (number === '26') limits.push('R05 verifies microphone and transcription transport; PDF/voice prompt-injection behavior is not exercised by that report or newly accepted here.');
  if (number === '31') limits.push('No chat-table migration or model call is needed by this loader fixture; an actual product rollout with an existing account is not exercised.');
  if (number === '32') limits.push('Next-release admission metadata is synthetic; no actual two-release deployment or hot reload was exercised.');
  if (number === '33') limits.push('Volume/search laboratory evidence exists; concurrent load, production percentiles and broader operational profiling remain AI-37.');
  if (number === '34') limits.push('Restore and effective startup quarantine were not executed; planned AI-37/38. A policy declaration is not proof.');
  return {id, illustrative_request: request.trim(), required_behavior: expected.trim(),
    coverage: number === '34' ? 'planned_not_executed' : 'mapped_evidence_with_explicit_scope', evidence, limits,
    full_product_acceptance: false};
});
const matrix = {schema_version: 1, stage: 'AI-36', status: 'all_requirements_classified_not_all_accepted',
  source: {file: sourceFile, sha256: sha(sourceFile)}, cases_count: cases.length, cases,
  no_requirement_silently_dropped: true, cases_classified: 34, cases_fully_accepted: 0,
  notes: ['A populated row is traceability, not a new executed assertion or product approval.', 'AI-36 remains open for strict MCP contracts; later operational/provider gates remain independently assigned.']};
const matrixFile = 'docs/evidence/nodia-ai-ai36-requirements-matrix.json'; emit(matrixFile, matrix);
const links = JSON.parse(cp.execFileSync('python', ['docs/evidence/scripts/nodia-ai-ai36-doc-links.py'], {encoding: 'utf8'}));
assert.equal(links.status, 'passed'); assert.deepEqual(links.missing_targets, []);
assert.equal(links.external_requests, 0);
const linksFile = 'docs/evidence/nodia-ai-ai36-doc-links.json'; emit(linksFile, links);
files.docLinks = linksFile;
const missingDomain = capability.counts.domain_missing_closed_MCP_contract_and_binding;
const complete = missingDomain === 0 && capability.pending_acceptance.length === 0;
const output = {schema_version: 1, stage: 'AI-36', status: 'validation_passed_exit_criteria_open',
  audit_and_tests_verified: true, ai36_complete: complete, product_ready: capability.readiness,
  completion_criterion: 'All strict domain MCP contracts and candidate acceptance gates closed; AI-37/38 operational and real-provider gates are independent. Classified NR rows are not full product acceptance.',
  current_domain_contract_gaps: missingDomain, blocked_candidates: capability.counts.blocked_candidates,
  requirements_classified: 34, new_cross_product_checks: integrated.checks,
  new_cross_product_http_requests: integrated.http_requests,
  evidence: Object.fromEntries(Object.entries({...files, requirements: matrixFile}).map(([key, file]) => [key, {file, sha256: sha(file)}])),
  publication_changed: false, provider_generations: 0, configured_business_data_changed: false,
  limitations: ['Code coverage is not semantic acceptance.', 'Current compiled SQL uses synthetic domain records and a provider adapter that rejects generation.',
    'Missing MCP contracts/bindings remain open work, not implicitly postponed or published.', 'NR-33/34 operational and real-provider acceptance retain AI-37/38 scope.']};
emit('docs/evidence/nodia-ai-ai36-validation.json', output);
console.log(JSON.stringify({stage: 'AI-36', validation: 'passed', ai36_complete: complete, product_ready: capability.readiness, requirements: cases.length, missing_domain_MCP_contracts: missingDomain}));
if (process.argv.includes('--require-complete') && !complete) process.exitCode = 2;
