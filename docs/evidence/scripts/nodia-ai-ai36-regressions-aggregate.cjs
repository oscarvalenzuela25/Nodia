// Reconcile actual compiled executions without counting failed or superseded attempts.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const sha = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const inputs = [
  'docs/evidence/nodia-ai-ai36-regressions-priority-attempt01.json',
  'docs/evidence/nodia-ai-ai36-regressions-adapter-attempt02.json',
  'docs/evidence/nodia-ai-ai36-regressions-foundation-attempt02.json',
  'docs/evidence/nodia-ai-ai36-regressions-context-diagnostic-attempt03.json',
  'docs/evidence/nodia-ai-ai36-regressions-foundation-revalidation-attempt04.json',
  'docs/evidence/nodia-ai-ai36-regressions-full-read-attempt04.json',
  'docs/evidence/nodia-ai-ai36-regressions-runtime-fix-attempt05.json',
  'docs/evidence/nodia-ai-ai36-regressions-routing-attempt06.json',
  'docs/evidence/nodia-ai-ai36-regressions-final-revalidation.json',
].filter(file => fs.existsSync(path.join(root, file)));
const selected = new Map(), failed = [];
for (const file of inputs) {
  const report = read(file);
  assert(/^attempt\d{2}$/.test(report.attempt)); assert(/^[a-z-]+$/.test(report.group));
  const remoteRoot = '/opt/nodia/verification/ai36-regressions-' + report.attempt + (report.attempt === 'attempt01' ? '' : '/nodia-server');
  for (const result of report.results) {
    if (result.harness === 'ai36') continue; // The new cross-product suite has its own evidence and count.
    const entry = { ...result, source_report: { file, sha256: sha(file) }, candidate_manifest_sha256: report.manifest_sha256, attempt: report.attempt,
      raw_logs_remote: { stdout:remoteRoot+'/.tmp/'+report.group+'-'+result.harness+'.stdout', stderr:remoteRoot+'/.tmp/'+report.group+'-'+result.harness+'.stderr' }, candidate_manifest_remote:remoteRoot+'/.tmp/ai36-regressions-stage-manifest.json' };
    if (entry.status !== 'passed') failed.push(entry);
    selected.set(entry.harness, entry);
  }
}
const results = [...selected.values()].sort((a,b) => Number(a.harness.match(/^ai(\d+)/)[1]) - Number(b.harness.match(/^ai(\d+)/)[1]) || a.harness.localeCompare(b.harness)).map(item => {
  const harness_path = 'nodia-server/test/nodia-ai-' + item.harness + '.integration.mjs';
  assert.equal(sha(harness_path), item.test_sha256, harness_path + ' changed since its selected run');
  assert.equal(item.new_disposable_containers_remaining, 0);
  return { suite: 'AI-' + item.harness.match(/^ai(\d+)/)[1], variant: item.harness.replace(/^ai\d+/, '') || null, harness: item.harness, harness_path, source_sha256: item.test_sha256, status: item.status, exit_code: item.exit_code, timed_out: item.timed_out, assertion_result: item.assertion_result, cleanup: { orphan_disposable_containers_removed: item.orphan_disposable_containers_removed, new_disposable_containers_remaining: item.new_disposable_containers_remaining }, source_report: item.source_report, candidate_manifest_sha256: item.candidate_manifest_sha256, candidate_manifest_remote: item.candidate_manifest_remote, attempt: item.attempt, raw_logs_remote:item.raw_logs_remote, raw_log_sha256:{stdout:item.stdout_sha256,stderr:item.stderr_sha256}, raw_log_validation_scope:'Runner hashes are preserved; raw historical logs remain in private remote staging.' };
});
assert.equal(results.length, 30);
const passed = results.filter(item => item.status === 'passed');
const binaryVersions = [...new Set(results.map(item => item.candidate_manifest_sha256))];
const output = { schema_version: 1, stage: 'AI-36', scope: 'current_compiled_SQL_HTTP_domain_and_worker_regressions', status: passed.length === results.length ? 'passed' : 'failed', suites: results.length, suites_passed: passed.length, suites_failed: results.length - passed.length, total_numbered_checks: passed.reduce((sum,item) => sum + (Number.isInteger(item.assertion_result?.checks) ? item.assertion_result.checks : 0),0), suites_without_numbered_counter: passed.filter(item => !Number.isInteger(item.assertion_result?.checks)).map(item => item.harness), results, prior_failed_attempts: failed.map(item => ({ harness: item.harness, attempt: item.attempt, source_report: item.source_report, error_category: item.error_category, superseded_by_pass: selected.get(item.harness).status === 'passed' })), native_budget_measurement: { file: 'docs/evidence/nodia-ai-ai36-native-budget-validation.json', sha256: sha('docs/evidence/nodia-ai-ai36-native-budget-validation.json') }, configured_database_used: false, provider_generations: 0, storage_cloud_operations: 0, services_restarted: false, limitations: ['Authentication transport, providers and object storage are synthetic; actual authorization SQL and native domain writers execute.', 'A suite with no numbered counter contributes zero to total_numbered_checks; its actual output remains linked.', 'A failed or superseded execution contributes no successful check count.', 'Passing internal effects does not publish MCP preparers, execute a real account or constitute product approval.'] };
output.compiled_candidate_manifests = binaryVersions;
output.all_suites_executed_same_compiled_candidate = binaryVersions.length === 1;
output.runtime_fix_revalidated_suites = results.filter(item => /nodia-ai-ai36-regressions-(?:runtime-fix-attempt05|final-revalidation)\.json$/.test(item.source_report.file)).map(item => item.harness);
fs.writeFileSync(path.join(root, 'docs/evidence/nodia-ai-ai36-regressions.json'), JSON.stringify(output,null,2) + '\n');
console.log(JSON.stringify({ stage: output.stage, status: output.status, suites: output.suites, passed: output.suites_passed, checks: output.total_numbered_checks, failed: results.filter(item => item.status !== 'passed').map(item => item.harness) }));
