const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const destination = 'docs/evidence/nodia-ai-ai31-validation.json';
const sql = read('docs/evidence/nodia-ai-ai31-sql-validation.json');
const health = read('docs/evidence/nodia-ai-ai31-final-health.json');
const activation = read('docs/evidence/nodia-ai-ai31-lab-activation.json');
const client = read('nodia-client/.tmp/ai31-client-validation.json');
assert.equal(client.all_passed, true);
for (const check of Object.values(client.checks)) {
  assert.equal(check.exit_code, 0);
  assert.equal(hash(check.log_path), check.log_sha256);
}
for (const [file, sha256] of Object.entries(client.source_sha256)) assert.equal(hash(file), sha256);
const qa = read('docs/evidence/nodia-ai-ai31-ui-validation.json');
const knowledge = read('.tmp/ai31-knowledge.log');
assert.equal(knowledge.unavailable, 0);
assert.equal(knowledge.releaseId, health.knowledge_release);
assert.equal(knowledge.publishedCapabilities, 67);
const contractsLog = fs.readFileSync(path.join(root, '.tmp/ai31-contracts.log'), 'utf8');
assert(/fixtures: 505/.test(contractsLog) && /hashes: 793/.test(contractsLog));
const serverLogPath = 'nodia-server/.tmp/ai31-server-tests-final.log';
const log = fs.readFileSync(path.join(root, serverLogPath), 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
const files = /Test Files\s+(\d+) passed \((\d+)\)/.exec(log);
const tests = /Tests\s+(\d+) passed \((\d+)\)/.exec(log);
assert(files && tests && files[1] === files[2] && tests[1] === tests[2]);
assert(Number(tests[1]) >= 3248);
assert.equal(sql.status, 'passed_disposable_postgresql');
assert.equal(sql.checks, 273);
assert.equal(sql.package.archive_sha256, health.final_package_archive_sha256);
assert.equal(sql.package.compiled_dist_sha256, health.dist_tree_sha256);
assert.equal(sql.package.compiled_dist_files, health.compiled_dist_files_verified);
assert.equal(health.passed, true);
assert.equal(activation.migration.applied, 0);
assert(Object.values(health.units).every(state => state === 'active'));
assert.equal(health.quiet.pending_jobs, 0);
assert.equal(health.knowledge_release, '9e57cbe2a469543df6f2d9db5a400e549268fb68012c59c34878ab2b996e2cfd');
assert.equal(qa.status, 'passed_synthetic_browser');
for (const entry of sql.source_files) assert.equal(hash(entry.path), entry.sha256);
const artifacts = [
  'docs/evidence/nodia-ai-ai31-sql-validation.json', 'docs/evidence/nodia-ai-ai31-final-health.json',
  'docs/evidence/nodia-ai-ai31-lab-activation.json', 'docs/evidence/nodia-ai-ai31-ui-validation.json',
  'nodia-client/.tmp/ai31-client-validation.json', serverLogPath, '.tmp/ai31-contracts.log', '.tmp/ai31-knowledge.log',
  'nodia-server/.tmp/ai31-build.log', 'nodia-server/.tmp/ai31-typecheck-final.log', 'nodia-server/.tmp/ai31-server-lint-final.log',
];
const result = { stage: 'AI-31', date: '2026-10-17', status: 'technically_closed_private_lab',
  server: { command: 'npm test', tests: Number(tests[1]), files: Number(files[1]), all_passed: true, focused_checks: 83, typecheck: 'passed', build: 'passed', lint: { errors: 0, historical_warnings: 3 } },
  client, sql: { checks: sql.checks, report_queries: sql.report_sql_queries, configured_database_used: false, synthetic_adapter: true },
  publication: { technical_read_tools: ['nodia_reports_describe', 'nodia_reports_run'], approved_product_reads: 67, approved_fragments: 27, knowledge_release: health.knowledge_release, draft_knowledge_published: false },
  activation: { backup: activation.backup, package_sha256: health.final_package_archive_sha256, dist_sha256: health.dist_tree_sha256, compiled_dist_files: health.compiled_dist_files_verified, package_files: health.final_package_files_verified, health: health.http, quiet: health.quiet },
  ui: { status: qa.status, isolated_origin: 'http://127.0.0.1:5195', configured_data_used: false },
  schema: { added_tables: 0, added_columns: 0, added_migrations: 0, added_dependencies: 0, added_http_routes: 0 },
  limits: ['Independent source snapshots; no implicit cross-source grand total or FX.', 'compare_compatible requires all grouped source pages to be complete; otherwise use separate or refine filters.', 'Saved details are aggregate groups from the same original query, not individual record export.'],
  independent_pending: ['No new real Gemini generation was executed for these report tools.', 'Historical R2/file, write-tool publication, multimodal and production acceptance gates retain their own status.'],
  documentary_approval: false, artifacts: artifacts.map(file => ({ path: file, sha256: hash(file) })) };
if (process.argv.includes('--check')) assert.deepEqual(read(destination), result);
else fs.writeFileSync(path.join(root, destination), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ stage: result.stage, status: result.status, server_tests: result.server.tests, sql_checks: sql.checks, artifacts: artifacts.length }));
