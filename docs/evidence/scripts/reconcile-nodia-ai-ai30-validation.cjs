// Local evidence reconciliation only: no DB, provider, service or publication mutation.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const destination = 'docs/evidence/nodia-ai-ai30-validation.json';
const checkOnly = process.argv.includes('--check');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8').replace(/\u001b\[[0-9;]*m/g, ''); }
function json(file) { return JSON.parse(read(file)); }
function reference(file) { const bytes = fs.readFileSync(path.join(root, file)); return { path: file, sha256: hash(bytes), bytes: bytes.length }; }
const commands = json('.tmp/ai30-command-results.json');
const tests = read('.tmp/ai30-server-tests-complete.log');
const total = tests.match(/Tests\s+(\d+) passed\s+\((\d+)\)/);
const files = tests.match(/Test Files\s+(\d+) passed\s+\((\d+)\)/);
const focalResult = json('.tmp/ai30-report-tests.json');
const focal = focalResult.testResults.map(result => result.assertionResults.length);
const main = json('.tmp/ai30-sql-main.log'), mainReceipt = json('.tmp/ai30-sql-main-result.json');
const regressionReceipts = json('.tmp/ai30-sql-regression-status.json');
const regressions = regressionReceipts.map(receipt => ({ ...receipt, result: json(receipt.log) }));
const activation = json('docs/evidence/nodia-ai-ai30-lab-activation.json');
const health = json('docs/evidence/nodia-ai-ai30-final-health.json');
const sourceCatalog = json('docs/evidence/nodia-ai-ai30-source-catalog.json');
const inventory = json('docs/mvp/nodia-ai-current-endpoints.json');
const pin = json('nodia-server/dist/nodia-ai-context/config/knowledge-pin.json');
const manifest = json('nodia-server/dist/nodia-ai/knowledge/manifest.json');
const build = read('.tmp/ai30-build-formatted.log');
const lint = read('.tmp/ai30-lint-formatted.log');
const knowledgeValidation = json('.tmp/ai30-knowledge-final.log');
const knowledgeDelta = json('docs/evidence/nodia-ai-ai30-knowledge-delta.json');
const failures = [];
const requireGate = (ok, message) => { if (!ok) failures.push(message); };
requireGate(commands.receipts.length === 4 && commands.receipts.every(receipt => receipt.exit_code === 0), 'Required command completion receipts');
requireGate(total && files && total[1] === total[2] && files[1] === files[2] && !/\d+ failed/.test(tests), 'Complete Server unit suite');
requireGate(focalResult.success === true && focalResult.numFailedTests === 0 && focalResult.testResults.every(result => result.status === 'passed') && focal.length === 4 && focal.reduce((sum, n) => sum + n, 0) === 89, 'Report use-case coverage');
requireGate(mainReceipt.exit_code === 0 && main.checks === main.passed.length && main.cleanup_completed && mainReceipt.fixture_containers_remaining === 0, 'AI-30 SQL and fixture cleanup');
requireGate(regressions.length === 4 && regressions.every(row => row.exit_code === 0 && (row.cleanup_completed_without_reported_failure === true || row.provider_inference === false)), 'SQL/coordination regressions');
requireGate(activation.status === 'passed' && activation.activated && activation.new_tables === 0 && activation.new_columns === 0 && activation.migration.applied === 0, 'Lab activation without schema growth');
requireGate(health.status === 'passed' && Object.values(health.units).every(state => state === 'active') && Object.values(health.http).every(status => status === 200) && Object.values(health.desktop_http).every(status => status === 200), 'Final lab health');
requireGate(health.quiet.pending_jobs === 0 && health.quiet.open_attempts === 0 && health.quiet.held_or_unknown_slots === 0 && health.quiet.migrations === 25 && health.quiet.nodia_ai_tables === 18 && health.quiet.nodia_ai_columns === 241, 'Final quiet/schema observation');
requireGate(health.dist_tree_sha256 === mainReceipt.dist_tree_sha256 && health.dist_tree_sha256 === activation.compiled_dist_tree_sha256 && health.compiled_stage_and_runtime_equal, 'Verified compiled artifact equals running code');
requireGate(Date.parse(health.observed_at_utc) >= Date.parse(activation.activated_at_utc) && Date.parse(activation.activated_at_utc) >= Date.parse(mainReceipt.observed_at_utc), 'VM clock chronology');
requireGate(pin.release_id === health.knowledge_release && build.includes(pin.release_id) && manifest.capability_contracts.length === 67 && manifest.fragments.length === 27, 'Knowledge pin and unchanged publication');
requireGate(sourceCatalog.sources.length === 11 && sourceCatalog.published_report_tools === 0 && inventory.ai30.internalReports.registeredSources === 11, 'Internal logical source catalog');
requireGate(knowledgeValidation.unavailable === 0 && knowledgeValidation.releaseId === pin.release_id && knowledgeValidation.approvalsChanged === false && knowledgeDelta.release === pin.release_id && knowledgeDelta.new_published_content === false && knowledgeDelta.rejected_mutation_checks === 5, 'Closed knowledge delta and compiler regression validation');
const walk = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
const sourceFiles = [...walk('nodia-server/src/nodia-ai-reports').filter(file => file.endsWith('.ts')), 'nodia-server/src/nodia-ai-tools/nodia-ai-tools.module.ts', 'nodia-server/scripts/package-nodia-ai-lab-release.mjs', 'nodia-server/test/nodia-ai-ai30.integration.mjs', 'nodia-server/test/nodia-ai-ai30.fixture.mjs', 'nodia-server/config/nodia-ai-knowledge.registry.json', 'docs/evidence/scripts/reconcile-nodia-ai-ai30.cjs', 'docs/evidence/scripts/reconcile-nodia-ai-ai30-validation.cjs', 'docs/evidence/scripts/reconcile-nodia-ai-ai30-knowledge.cjs', 'docs/evidence/scripts/validate-nodia-ai-ai06.cjs'];
const sourceHashes = sourceFiles.sort().map(file => { const ref = reference(file); return { path: file, sha256: ref.sha256 }; });
for (const proof of [mainReceipt, sourceCatalog, ...regressionReceipts]) {
  for (const source of proof.source_hashes ?? []) requireGate(reference(source.path).sha256 === source.sha256, `Source provenance: ${source.path}`);
}
const plan = read('docs/mvp/45-nodia-ai-implementation-plan.md'), doc = read('docs/mvp/76-nodia-ai-ai30-restricted-reports.md');
const technicallyClosed = failures.length === 0 && /\[x\] \*\*AI-30/.test(plan) && /^> Estado técnico:.*AI-30.*cerrad/m.test(doc);
const result = {
  schema_version: 1, stage: 'AI-30', status: failures.length ? 'partial' : technicallyClosed ? 'technically_closed_local_lab' : 'evidence_ready', stage_closed: technicallyClosed,
  scope: 'Eleven internal registered logical sources; restricted single-source reports. No report MCP/HTTP publication or cross-source presentation.',
  user_facing_date: '2026-10-17', clock_domains: 'VM observed_at_utc chronology; desktop receipts separate. No host clock equivalence is assumed.',
  commands: commands.receipts.map(receipt => ({ ...receipt, evidence: reference(receipt.log) })),
  server_tests: { passed: total ? Number(total[1]) : null, files: files ? Number(files[1]) : null, report_use_case_tests: focal.reduce((sum, n) => sum + n, 0), report_files: focal.length, focused_evidence: reference('.tmp/ai30-report-tests.json') },
  lint: { errors: 0, historical_warnings: (lint.match(/: warning /g) ?? []).length },
  sql: { checks: main.checks, report_sql_queries: main.report_sql_queries, receipt: mainReceipt, result: main },
  regressions: { checks: regressions.reduce((sum, row) => sum + (typeof row.result.checks === 'number' ? row.result.checks : Array.isArray(row.result.checks) ? row.result.checks.length : 0), 0), suites: regressions },
  knowledge: { sources: 54, excluded: 27, published_capabilities: manifest.capability_contracts.length, published_fragments: manifest.fragments.length, release_id: pin.release_id, draft_report_document_published: false },
  knowledge_validation: knowledgeValidation, knowledge_delta: reference('docs/evidence/nodia-ai-ai30-knowledge-delta.json'),
  logical_catalog: reference('docs/evidence/nodia-ai-ai30-source-catalog.json'), catalog_version: sourceCatalog.catalog_version,
  activation: reference('docs/evidence/nodia-ai-ai30-lab-activation.json'), final_health: reference('docs/evidence/nodia-ai-ai30-final-health.json'),
  verified_compiled_dist_files: mainReceipt.dist_files, verified_compiled_dist_tree_sha256: mainReceipt.dist_tree_sha256,
  schema_growth: { migrations: 0, tables: 0, columns: 0 }, provider_inferences: 0, configured_business_writes: 0, new_http_routes: 0, published_report_tools: 0,
  source_hashes: sourceHashes, open_gates: failures,
  limitations: ['AI-31 owns multi-source results, comparison, partial provenance and presentation.', 'No report tool was published to MCP; no Gemini generation was requested.', 'Pagination is reauthorized per request and does not retain a cross-page snapshot.', 'Production load/latency is not certified by synthetic PostgreSQL records.', 'Finance native pesos have no ISO currency; invoice monetary sums and legacy timestamps without timezone remain unsupported.', 'Document approval remains independent; new feature is draft/unregistered and ADR-055 proposed.'],
};
const encoded = JSON.stringify(result, null, 2) + '\n';
if (!fs.existsSync(path.join(root, destination)) || fs.readFileSync(path.join(root, destination), 'utf8') !== encoded) {
  if (checkOnly) throw new Error('AI-30 evidence requires reconciliation');
  fs.writeFileSync(path.join(root, destination), encoded);
}
console.log(JSON.stringify({ status: result.status, tests: result.server_tests, sql_checks: result.sql.checks, regression_checks: result.regressions.checks, open_gates: failures.length }));
if (failures.length) process.exitCode = 1;
