// Offline evidence cross-check only: never imports app/runtime or contacts the VM/provider.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const evidence = path.join(root, 'docs/evidence');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const input = relative => {
  const bytes = fs.readFileSync(path.join(root, relative));
  assert.ok(bytes.length <= 1048576);
  return { relative, sha256: sha(bytes), value: JSON.parse(bytes) };
};
const mode = process.argv[2];
assert.ok(['--write', '--check'].includes(mode));
const references = [];
const read = relative => { const entry = input(relative); references.push({ path: relative, sha256: entry.sha256 }); return entry; };
const cohortEntry = read('docs/evidence/nodia-ai-ai38-modalities-web-cohort-01.json');
const closureEntry = read('docs/evidence/nodia-ai-ai38-modalities-web-closure-01.json');
const routingEntry = read('docs/evidence/nodia-ai-ai38-live-routing-routing01.json');
const cohort = cohortEntry.value, closure = closureEntry.value, routing = routingEntry.value;
assert.equal(cohort.status, 'passed');
assert.equal(cohort.unknown_native_state, false);
assert.equal(cohort.probe_requests_declared_in_reports, 4);
assert.equal(cohort.maximum_probe_requests, 4);
assert.equal(cohort.automatic_inference_retries, 0);
assert.equal(cohort.routing_report_sha256, routingEntry.sha256);
assert.equal(routing.status, 'passed');
assert.deepEqual(cohort.binding.selection, routing.native_result.selections.web);
assert.equal(cohort.mode_fields_binding.mode_fields_sha256, routing.native_result.public_mode_fields_sha256);
assert.deepEqual(cohort.epoch_before, routing.container_after);
assert.equal(cohort.historical_Web_selection_and_epoch_compared, true);
assert.equal(cohort.historical_Web_configuration_session_compared, false);
assert.equal(cohort.mode_fields_and_updated_at_unchanged_after, true);
assert.equal(closure.status, 'passed');
assert.equal(closure.cohort_sha256, cohortEntry.sha256);
assert.deepEqual(closure.epoch, cohort.epoch_before);
assert.ok(Object.values(closure.native).every(value => value === 0));
assert.ok(Object.values(closure.SQL).every(value => value === 0));
assert.equal(closure.Node_outputs, 932);
assert.equal(closure.Node_manifest_sha256, 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792');
const formats = [['png', 'image', 'image/png'], ['pdf', 'pdf', 'application/pdf'], ['wav', 'audio', 'audio/wav'], ['webm', 'audio', 'audio/webm']];
assert.deepEqual(cohort.formats_order, formats.map(([format]) => format));
assert.equal(cohort.cases.length, 4);
const accepted = [];
for (const [index, [format, kind, media]] of formats.entries()) {
  const entry = read(`docs/evidence/nodia-ai-ai38-modalities-web-${format}-01.json`);
  const value = entry.value, summary = cohort.cases[index];
  assert.equal(summary.format, format);
  assert.equal(summary.status, 'passed');
  assert.equal(summary.native_state, 'closed_acknowledged');
  assert.equal(summary.report_sha256, entry.sha256);
  assert.equal(summary.exit_code, 0);
  assert.ok(summary.same_binding && summary.same_format && summary.same_epoch);
  assert.deepEqual(summary.probe_result, value);
  assert.equal(value.status, 'passed');
  assert.equal(value.source_sha256, cohort.helper_sha256);
  assert.equal(value.generation_requests, 1);
  assert.equal(value.maximum_generations, 1);
  assert.equal(value.http_status, 200);
  assert.equal(value.kind, kind); assert.equal(value.media_type, media);
  assert.equal(value.semantic_match, true);
  assert.equal(value.expected_answer_sha256, value.actual_answer_sha256);
  assert.equal(value.native_outcome, 'completed');
  assert.equal(value.native_acknowledged, true);
  assert.equal(value.native_pending_identity, false);
  assert.equal(value.exact_format_verified_after, true);
  assert.equal(value.inference_replayed, false);
  assert.equal(value.configured_SQL_writes, 0);
  assert.equal(value.business_effects, 0);
  assert.deepEqual(value.selection, cohort.binding.selection);
  assert.equal(value.configuration_generation, cohort.binding.configuration_generation);
  assert.equal(value.session_generation, cohort.binding.session_generation);
  accepted.push({ format, media_type: media, generations: 1, semantic_match: true, native_completed_and_ACKed: true });
}
const sources = [
  ['docs/evidence/scripts/nodia-ai-ai38-verifications-modalities.py', cohort.helper_sha256],
  ['docs/evidence/scripts/nodia-ai-ai38-web-modalities-cohort.py', cohort.source_sha256],
  ['docs/evidence/scripts/nodia-ai-ai38-web-modalities-closure.py', closure.source_sha256],
  ['docs/evidence/scripts/validate-nodia-ai-ai38-web-modalities.cjs', sha(fs.readFileSync(__filename))],
].map(([relative, digest]) => {
  assert.equal(sha(fs.readFileSync(path.join(root, relative))), digest);
  return { path: relative, sha256: digest };
});
const report = {
  stage: 'AI-38', scope: 'offline_current_exact_Web_attachment_evidence_cross_check',
  status: 'verified_current_Web_formats_not_global_environment_release',
  evidence_observed_at_utc: closure.observed_at_utc,
  timestamp_source: 'VM_closure_not_unsynchronized_development_clock',
  total_probe_requests: 4, automatic_inference_retries: 0, accepted,
  same_Web_selection_fresh_configuration_session_and_provider_epoch: true,
  historical_Web_configuration_session_compared: false,
  current_physical_microphone_or_UI_acceptance: false,
  frontend_upload_R2_or_business_effect_acceptance: false,
  configured_SQL_writes: 0, services_or_models_modified: false,
  native_and_SQL_pending_after: false,
  provider_requests_by_this_validator: 0,
  references, sources,
};
const destination = path.join(evidence, 'nodia-ai-ai38-modalities-web-validation.json');
if (mode === '--write') fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
else assert.deepEqual(JSON.parse(fs.readFileSync(destination, 'utf8')), report);
console.log(JSON.stringify({ status: 'passed', mode, formats: 4, native_probes: 4, frozen_report_sha256: sha(fs.readFileSync(destination)) }));
