// Offline acceptance reconciliation. Does not connect to SQL, R2 or providers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const prefix = 'docs/evidence/nodia-ai-ai32-r07-';
const output = prefix + 'validation.json';
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const text = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const receipt = file => ({ path: file, sha256: sha(file) });
const verify = item => assert.equal(sha(item.path), item.sha256, item.path + ' drift');
const baseline = read(prefix + 'baseline.json');
baseline.sources.forEach(verify);
const upload = read(prefix + 'late-put-upload.json');
const cleanup = read(prefix + 'late-put-cleanup.json');
const guards = read(prefix + 'late-put-guards.json');
const inspector = read(prefix + 'inspector-validation.json');
const health = read(prefix + 'final-health.json');
const teardown = read(prefix + 'sandbox-cleanup.json');
const preservation = read(prefix + 'configured-chat-preservation.json');
const harness = 'docs/evidence/scripts/nodia-ai-ai32-r07-late-put.mjs';
assert.equal(sha(harness), '657e743b804669f0eebdf46640efea46105a8364dfdd0ffd229ec9daa31d1e21');
const initial = read(prefix + 'late-put-upload-attempt01.json');
const failedState = read(prefix + 'di-failure-state.json');
assert.equal(initial.status, 'failed');
for (const key of ['put_calls', 'delete_calls', 'inspector_calls', 'provider_generations']) assert.equal(initial[key], 0);
assert.equal(sha('docs/evidence/scripts/nodia-ai-ai32-r07-late-put-attempt01.mjs'), initial.coordinator.harness_sha256);
assert.equal(failedState.status, 'passed');
assert.equal(failedState.ledger_absent, true);
assert.equal(failedState.cloud_operations, 0);
for (const value of Object.values(failedState.sandbox_counts)) assert.equal(value, 0);
for (const item of [upload, cleanup]) {
  assert.equal(item.stage, 'AI-32-R07');
  assert.equal(item.status, 'passed');
  assert.equal(item.configured_database_used, false);
  assert.equal(item.configured_business_records_modified, 0);
  assert.equal(item.synthetic_only, true);
  assert.equal(item.provider_generations, 0);
  assert.equal(item.process_closed, true);
  assert.equal(item.write_deadline_modified, false);
  assert.equal(item.wallclock_measurement_uses_fixture_expiry_timestamp, false);
  assert.equal(item.checks, item.check_names.length);
  assert(item.checks >= 5);
  assert.equal(item.coordinator.harness_sha256, sha(harness));
  for (const source of item.source_receipts) verify({ path: 'nodia-server/' + source.path, sha256: source.sha256 });
}
assert.equal(upload.phase, 'upload');
assert.equal(upload.put_calls, 1);
assert.equal(upload.delete_calls, 0);
assert.equal(upload.inspector_calls, 1);
assert.equal(upload.put_started_after_purge, true);
assert.equal(upload.late_upload_published, false);
assert.equal(upload.write_window_seconds, 70);
assert.equal(upload.predeadline_delete_calls, 0);
assert.equal(upload.minimal_witness_verified, true);
assert.equal(upload.detached_jobs, 1);
assert.equal(cleanup.phase, 'cleanup');
assert.equal(cleanup.put_calls, 0);
assert.equal(cleanup.delete_calls, 1);
assert.equal(cleanup.inspector_calls, 0);
assert.equal(cleanup.upload_and_cleanup_pids_differ, true);
assert.equal(cleanup.same_boot_monotonic, true);
assert.equal(cleanup.waited_real_write_window, true);
assert.equal(cleanup.replay_delete_calls, 0);
assert.equal(cleanup.cleanup_complete, true);
assert.equal(cleanup.elapsed_below_24h_case_observed, true);
assert(cleanup.real_purge_to_get404_elapsed_ms >= cleanup.purge_ack_to_get404_lower_elapsed_ms);
assert(cleanup.purge_ack_to_get404_lower_elapsed_ms >= 0);
assert(cleanup.real_purge_to_get404_elapsed_ms < 86400000);
for (const value of Object.values(cleanup.final_counts)) assert.equal(value, 0);
assert.equal(guards.status, 'passed');
assert.equal(guards.checks, 9);
for (const key of ['real_storage_calls', 'database_calls', 'provider_calls', 'preexisting_collision_delete_calls']) assert.equal(guards[key], 0);
assert.equal(inspector.status, 'passed');
assert.equal(inspector.production_code_changed, false);
inspector.sources.forEach(verify);
for (const host of ['windows', 'linux']) {
  assert.equal(inspector[host].focal.passed, 4);
  assert.equal(inspector[host].focal.failed, 0);
  verify(inspector[host].focal.log);
}
assert.equal(inspector.windows.full_suite.total, 389);
assert.equal(inspector.windows.full_suite.passed, 387);
assert.equal(inspector.windows.full_suite.skipped, 2);
assert.equal(inspector.windows.full_suite.failed, 0);
verify(inspector.windows.full_suite.log);
verify(inspector.linux.receipt);
assert.equal(inspector.linux.network, 'none');
assert.equal(inspector.linux.production_container_modified, false);
assert.equal(health.status, 'passed');
for (const value of Object.values(health.units)) assert.equal(value, 'active');
for (const value of Object.values(health.http)) assert.equal(value, 200);
for (const key of ['pending_jobs', 'open_attempts', 'held_or_unknown_slots']) assert.equal(health.sql_quiet[key], 0);
assert.equal(health.compiled_files_verified, 909);
assert.deepEqual(health.compiled_drift_files, []);
assert.equal(health.native_source_files_verified, 92);
assert.equal(health.native_source_drift_count, 0);
assert.equal(health.services_restarted, false);
assert.equal(health.provider_generations, 0);
assert.equal(preservation.status, 'passed');
assert.equal(preservation.attachments_preserved, 3);
assert.equal(preservation.provider_dispatches_remain, 1);
assert.equal(preservation.metadata_byte_equivalent_after_json_projection, true);
const project = file => { const value = read(file); delete value.observed_at_utc; delete value.completed_at_utc; return value; };
assert.deepEqual(project(preservation.source_before), project(preservation.source_after));
assert.equal(teardown.status, 'passed');
assert.equal(teardown.ledger_objects, 1);
assert.equal(teardown.ledger_objects_settled, true);
assert.equal(teardown.cloud_operations, 0);
assert.equal(teardown.configured_database_used, false);
for (const flag of ['private_ledger_mode_0600', 'owned_container_removed', 'private_descriptor_and_ledger_removed',
  'private_directory_removed', 'inspector_temporary_container_removed']) assert.equal(teardown[flag], true);
assert.equal(teardown.private_files_removed, 8);
for (const value of Object.values(teardown.database_final_counts)) assert.equal(value, 0);
const documents = ['docs/mvp/78-nodia-ai-ai32-attachments-voice.md', 'docs/mvp/45-nodia-ai-implementation-plan.md',
  'docs/mvp/00-progress.md', 'docs/mvp/README.md', 'docs/mvp/vps-local-vm-lab.md',
  'docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md', 'docs/nodia-ai/knowledge/README.md',
  'docs/nodia-ai/knowledge/nodia-ai/README.md', 'docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md'];
assert(text(documents[1]).includes('- [x] **AI-32 —'));
assert(text(documents[5]).includes('> Estado: propuesto'));
for (const [file, revision] of [[documents[7], 32], [documents[8], 8]]) {
  const metadata = JSON.parse(text(file).split('---')[1]);
  assert.equal(metadata.revision, revision);
  assert.equal(metadata.approval, null);
  assert.equal(metadata.document_status, 'draft');
  assert.equal(metadata.integration_status, 'unregistered');
  assert(metadata.verification.evidence_paths.includes(output));
}
const knowledge = read('nodia-server/src/nodia-ai/knowledge/manifest.json');
assert.equal(knowledge.release_id, baseline.knowledge_release);
assert.equal(knowledge.documents.length, 27);
assert.equal(knowledge.fragments.length, 27);
assert.equal(knowledge.capability_contracts.length, 67);
const files = fs.readdirSync(path.join(root, 'docs/evidence')).filter(name => name.startsWith('nodia-ai-ai32-r07-') && name.endsWith('.json'))
  .map(name => 'docs/evidence/' + name).filter(file => file !== output);
const scripts = fs.readdirSync(path.join(root, 'docs/evidence/scripts')).filter(name => name.includes('nodia-ai-ai32-r07') && /\.(?:cjs|mjs)$/.test(name))
  .map(name => 'docs/evidence/scripts/' + name);
const result = {
  stage: 'AI-32-R07', status: 'passed', technical_ai32_lab_scope_closed: true,
  documentary_approval: false, production_acceptance: false, mcp_publication_changed: false,
  scope: 'remaining_AI32_inspector_lifecycle_and_late_PUT_after_expiry_with_new_process_cleanup',
  application_code_changed: false, configured_business_database_modified: false, provider_generations: 0,
  new_checks: { late_put_real_SQL_R2: upload.checks + cleanup.checks, offline_harness_guards: 9,
    inspector_focal_windows: 4, inspector_focal_linux: 4, windows_full_suite: { total: 389, passed: 387, skipped: 2, failed: 0 } },
  physical_cleanup: { real_purge_to_get404_upper_bound_ms: cleanup.real_purge_to_get404_elapsed_ms,
    purge_ack_to_get404_lower_bound_ms: cleanup.purge_ack_to_get404_lower_elapsed_ms,
    production_write_window_seconds: 70, put_calls: 1, delete_calls: 1, own_objects_remaining: 0,
    separate_OS_processes: true, production_services_restarted: false, scheduler_SLA_established: false },
  preserved_initial_failure: { phase: 'test_module_provider_visibility', provider_generations: 0, put_calls: 0,
    application_change_required: false, corrected_harness_completed_both_phases: true },
  acceptance: [
    { criterion: 'M3_intent_ownership_limits_review_unknown_metadata', evidence: 'docs/evidence/nodia-ai-ai32-validation.json', status: 'covered_historical' },
    { criterion: 'exact_native_modalities_and_file_MCP', evidence: 'docs/evidence/nodia-ai-ai32-r04-validation.json', status: 'covered_exact_historical_selection' },
    { criterion: 'physical_microphone_UI_R2_private_download_reload', evidence: 'docs/evidence/nodia-ai-ai32-r05-validation.json', status: 'covered_historical' },
    { criterion: 'purge_lost_DELETE_ACK_invoice_copy_legacy_rollback', evidence: 'docs/evidence/nodia-ai-ai32-r06-validation.json', status: 'covered_historical' },
    { criterion: 'dead_timeout_cancelled_inspector_resources', evidence: prefix + 'inspector-validation.json', status: 'passed_current_offline' },
    { criterion: 'late_PUT_after_expiry_cleanup_across_process_restart_real_elapsed', evidence: prefix + 'late-put-cleanup.json', status: 'passed_current_real_SQL_R2' },
  ],
  separate_gates: ['AI-15_native_invoice_binary_download_acceptance', 'AI-36_complete_published_domain_integral_matrix',
    'AI-37_load_operation_drain_monitoring', 'AI-36_AI-38_backup_rotation_restore_remote_retention', 'AI-38_product_acceptance_per_environment'],
  storage_applicability: { current_transport: 'immutable_generation_key_single_PutObject_no_multipart',
    versioning_api_documentation: 'https://developers.cloudflare.com/r2/api/s3/api/',
    documentation_checked_on: '2026-10-18', bucket_configuration_probed: false,
    versioned_or_multipart_storage_requires_revalidation: true },
  limitations: ['No new Gemini generation, availability observation or end-to-end MCP write acceptance in R07.',
    'The measured real deletion bound applies only to this synthetic due chat and manually invoked native maintenance.',
    'Inspector child lifecycle uses synthetic subprocess programs; content decoding/isolation remains separately evidenced.',
    'AI32 technical completion does not approve documents, publish drafts or establish production readiness.'],
  knowledge_release_unchanged: knowledge.release_id,
  baseline: baseline.sources, documents: documents.map(receipt), artifacts: files.sort().map(receipt), scripts: scripts.sort().map(receipt),
};
if (process.argv.includes('--check')) assert.deepEqual(read(output), result, 'R07 evidence drift');
else fs.writeFileSync(path.join(root, output), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ stage: result.stage, status: result.status, technical_ai32_lab_scope_closed: true, new_checks: result.new_checks,
  cleanup_upper_bound_ms: cleanup.real_purge_to_get404_elapsed_ms, documentary_approval: false, production_acceptance: false }));
