// Deterministic consolidation of frozen acceptance receipts; no runtime or network imports.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const destination = path.join(root, 'docs/evidence/nodia-ai-ai38-c05-current-delta-r01.json');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file)));
const baselinePath = 'docs/evidence/nodia-ai-ai36-c05-r05-validation.json';
assert.equal(digest(baselinePath), '25f3ee4a8a82f778522c55ff88922905acc6a22d40f2e74617ba6791baf236c4');
const baseline = read(baselinePath);
const previous = baseline.accumulated_accepted_capability_ids;
assert.equal(previous.length, 4);
const cases = {
  preferences: ['nodia_preferences_prepare', 'nodia_preferences_list'],
  finance: ['nodia_finance_movements_prepare_create'],
};
const sources = { [baselinePath]: digest(baselinePath) };
const details = {};
let context, epoch;
for (const [caseId, names] of Object.entries(cases)) {
  const prefix = `docs/evidence/nodia-ai-ai38-live-capabilities-${caseId}-r01-`;
  const files = Object.fromEntries(['driver', 'case', 'guard', 'capture', 'receipt'].map(kind => [kind, prefix + kind + '.json']));
  for (const file of Object.values(files)) sources[file] = digest(file);
  const values = Object.fromEntries(Object.entries(files).map(([kind, file]) => [kind, read(file)]));
  for (const [file, hash] of Object.entries(values.receipt.files)) assert.equal(digest(file), hash);
  const { driver, guard, capture } = values, result = values.case;
  assert.equal(driver.status, 'passed'); assert.equal(result.status, 'passed'); assert.equal(guard.status, 'passed');
  assert.equal(driver.case_id, caseId); assert.equal(driver.native_start_requests, 2);
  assert.equal(driver.accepted_native_starts, 2); assert.equal(guard.native_start_requests, 2);
  assert.equal(result.native_terminal_ACKs.length, 2); assert.equal(result.unresolved_native_or_proof_state, false);
  assert.equal(driver.runtime_unchanged, true); assert.deepEqual(driver.runtime_before, driver.runtime_after);
  assert.equal(driver.disposable_containers_remaining, 0); assert.equal(driver.configured_SQL_writes, 0);
  assert.equal(driver.services_restarted, false); assert.equal(driver.operational_publication_modified, false);
  assert.equal(driver.automatic_inference_retries, 0); assert.equal(guard.operational_publication_modified, false);
  assert.equal(digest('nodia-server/test/nodia-ai-ai38-live-capabilities.mjs'), driver.wrapper_sha256);
  assert.equal(digest('docs/evidence/scripts/nodia-ai-ai38-verifications-capabilities.py'), driver.source_sha256);
  assert.equal(capture.driver_report_sha256, sources[files.driver]);
  assert.equal(capture.case_report_sha256, sources[files.case]);
  assert.equal(capture.guard_report_sha256, sources[files.guard]);
  assert.equal(capture.log_window_since_utc, result.started_at_utc);
  assert.equal(capture.log_window_until_utc, result.finished_at_utc);
  assert.equal(capture.private_log.permissions_octal, '0o600'); assert.equal(capture.private_log.raw_emitted, false);
  assert.equal(capture.provider_requests, 0); assert.equal(capture.services_restarted, false);
  assert.equal(capture.same_container_epoch_after_capture, true);
  const currentEpoch = { container_id: driver.runtime_before.container_id, image: driver.runtime_before.image,
    started_at: driver.runtime_before.started_at };
  if (epoch) assert.deepEqual(currentEpoch, epoch); else epoch = currentEpoch;
  if (context) assert.deepEqual(driver.context_pin, context); else context = driver.context_pin;
  const generations = result.turns.flatMap(turn => turn.generations);
  assert.equal(generations.length, 2);
  assert.deepEqual(generations.map(item => item.phase), ['discovery', 'execution']);
  assert.ok(generations.every(item => item.terminal_proof_received && item.process_closed && item.terminal_proof_outcome === 'completed'));
  assert.equal(generations[1].discovery_ACK_completed_before_dispatch, true);
  assert.deepEqual([...capture.attempt_ids].sort(), generations.map(item => item.attempt_id).sort());
  const accepted = Object.fromEntries(names.map(name => {
    const item = result.per_capability[name];
    assert.equal(item.actual_callbacks, 1); assert.equal(item.successful_callbacks, 1);
    assert.ok(item.semantic_assertions.length > 0);
    for (const observation of item.semantic_assertions) {
      assert.equal(observation.passed, true); assert.deepEqual(observation.observed, observation.expected);
    }
    return [name, { contract_hash: item.contract_hash, successful_callbacks: 1,
      semantic_assertions_passed: item.semantic_assertions.length }];
  }));
  assert.equal(result.human_confirmations.length, 1);
  assert.ok(result.human_confirmations.every(item => item.duplicate_confirmation_same_execution));
  assert.deepEqual(result.disposable_sql_final.business_counts, caseId === 'preferences'
    ? { finance_movements: 0, accepted_preferences: 1 } : { finance_movements: 1, accepted_preferences: 0 });
  details[caseId] = { status: 'accepted_in_disposable_SQL_with_real_High', accepted_capabilities: accepted,
    native_start_requests: 2, accepted_native_starts: 2, native_ACKs: 2,
    disposable_business_counts: result.disposable_sql_final.business_counts,
    confirmation_layer: 'operator_HTTP_fixture_not_physical_UI', post_case_fixture_removed: true };
}
const current = Object.values(cases).flat();
assert.equal(new Set([...previous, ...current]).size, 7);
const result = {
  stage: 'AI-38', scope: 'C05_three_pending_capabilities_same_epoch_delta_not_historical_reacceptance',
  status: 'three_of_three_pending_capabilities_accepted', epoch, context_pin: context,
  current_epoch_newly_accepted_capability_ids: current,
  historical_accepted_capability_ids_not_reexecuted: previous,
  accumulated_accepted_capability_ids_across_cohorts: [...previous, ...current],
  accumulated_accepted_count: 7, C05_target_capabilities: 7,
  native_start_requests_this_delta: 4, accepted_native_starts_this_delta: 4, native_ACKs_this_delta: 4,
  per_case: details, configured_SQL_writes: 0, operational_business_effects: 0,
  operational_publication_modified: false, unpublished_candidates_remaining: 77,
  AI36_complete: false, standalone_worker_accepted: false, physical_UI_accepted: false,
  successful_fixtures_retained: false, provider_unknown_timeout_cause_resolved: false,
  boundaries: ['Three current-epoch acceptances plus four historical acceptances; not seven current-epoch reruns.',
    'Native Stage/Claim/Execute and exact HTTP confirmation were driven inline against disposable PostgreSQL.',
    'No operational Node adoption, global publication, physical UI or standalone-worker acceptance is implied.',
    'The prior timeout has no demonstrated root cause; successful runs do not establish a diagnostic-code fix.'],
  sources, consolidator: { path: path.relative(root, __filename).replaceAll('\\', '/'),
    sha256: digest(path.relative(root, __filename)) },
};
const mode = process.argv[2];
assert.ok(['--write', '--check'].includes(mode));
if (mode === '--write') fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
else assert.deepEqual(read(path.relative(root, destination)), result);
console.log(JSON.stringify({ status: 'passed', accepted_current_delta: 3, accepted_accumulated_across_cohorts: 7,
  starts: 4, ACKs: 4, AI36_complete: false, output: path.relative(root, destination) }));
