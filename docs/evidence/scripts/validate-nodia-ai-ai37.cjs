// Offline consolidation only: no application imports, SQL, network or service mutation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const mode = process.argv[2] ?? '--check';
assert(['--write', '--check'].includes(mode));
const hash = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const ref = name => ({ path: name, sha256: hash(name) });
const prefix = 'docs/evidence/nodia-ai-ai37-';
const quality = read(prefix + 'quality.json');
const performance = read(prefix + 'performance.json');
const equivalence = read(prefix + 'performance-claim-equivalence.json');
const operations = read(prefix + 'operations-sql.json');
const recovery = read(prefix + 'recovery-sql-r01.json');
const knowledge = read(prefix + 'knowledge.json');
const state = read(prefix + 'operational-state.json');
assert.equal(quality.unit_tests.tests, 4274);
assert.equal(quality.unit_tests.passed, 4274);
assert.equal(quality.build.exit_code, 0);
assert.equal(quality.lint.exit_code, 0);
assert.equal(quality.fixture_types.new_diagnostics, 0);
assert.equal(quality.fixture_types.same_diagnostic_multiset_ignoring_line_column_only, true);
assert.equal(performance.status, 'passed');
assert.equal(performance.checks.length, 61);
assert.equal(equivalence.checks.length, 11);
assert.equal(equivalence.cleanup_complete, true);
assert.equal(operations.checks.length, 17);
assert.equal(operations.provider_inferences, 0);
assert.equal(recovery.checks.length, 33);
assert.equal(recovery.passed, 33);
assert.equal(recovery.provider_calls, 0);
assert.equal(state.status, 'passed');
assert.equal(state.compiled_files, 932);
assert.equal(state.SQL.pending_jobs + state.SQL.open_attempts + state.SQL.retained_slots, 0);
assert(Object.values(state.units).every(unit => unit.state === 'active' && unit.exit_code === 0));
assert.equal(state.provider_generations + state.metadata_requests, 0);
assert.equal(quality.candidate.deployment, false);
assert.equal(quality.boundaries.production_adoption, false);
assert.equal(quality.boundaries.AI36_C05_acceptance_unchanged, '4/7');
assert.equal(knowledge.status, 'verified_in_memory_publication_preserved_not_operationally_adopted');
const artifacts = ['quality', 'candidate04', 'performance', 'performance-claim-diagnostic',
  'performance-claim-equivalence', 'operations', 'operations-sql', 'recovery',
  'recovery-sql-r01', 'knowledge', 'operational-state'].map(name => ref(prefix + name + '.json'));
for (const reference of [quality.build.log, quality.lint.log, quality.unit_tests.report,
  quality.unit_tests.log, quality.fixture_types.baseline, quality.fixture_types.current,
  quality.startup.report, quality.startup.harness, quality.candidate.archive, quality.candidate.manifest])
  assert.equal(hash(reference.path), reference.sha256, reference.path);
const report = { schema_version: 1, stage: 'AI-37', status: 'verified_isolated_candidate_not_operationally_adopted',
  artifacts,
  checks: { unit_tests: 4274, unit_files: 237, performance: 61, claim_equivalence: 11,
    operations_SQL_DI: 17, recovery_SQL_processes: 33, quarantine_startup: 4,
    historical_fixture_type_diagnostics: 192, new_fixture_type_diagnostics: 0 },
  candidate: { compiled_outputs: 2827, runtime_assets: 979, operational_Node_outputs_unchanged: 932 },
  boundaries: { provider_inferences: 0, provider_metadata_requests: 0, operational_SQL_writes: 0,
    operational_SQL_read_only_closure_check: true, indices_added: 0, tables_added: 0,
    migrations_added: 0, productive_acceptance: false, AI36_C05_open: true,
    AI36_C05_accumulated_accepted_capabilities: '4/7', deployment: false },
  remaining_gates: [
    'AI36 real capability acceptance and remaining selective publication are unchanged.',
    'AI38 environment adoption and productive workload acceptance remain separate.',
    'Continuous trusted external deletion journal, encrypted backup rotation and all storage versions require environment evidence.',
    'Restore preparation never authorizes release; reconcile current domain/native state and inventory resources absent in the backup.',
    'Synthetic storage deletion and warm synthetic timings do not certify R2 cleanup, cold-cache percentiles or SLA.',
  ],
  reproducible_consolidator: ref('docs/evidence/scripts/validate-nodia-ai-ai37.cjs') };
const serialized = JSON.stringify(report, null, 2) + '\n';
const output = path.join(root, prefix + 'validation.json');
if (mode === '--write') {
  assert(!fs.existsSync(output), 'never replace a frozen AI37 report');
  fs.writeFileSync(output, serialized);
} else assert.equal(fs.readFileSync(output, 'utf8'), serialized, 'AI37 evidence drift');
console.log(JSON.stringify({ stage: 'AI-37', mode, status: report.status, checks: report.checks }));
