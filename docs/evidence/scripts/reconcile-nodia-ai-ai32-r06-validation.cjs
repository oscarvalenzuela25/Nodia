// Offline reconciliation only: never connects to SQL, R2 or an AI provider.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const prefix = 'docs/evidence/nodia-ai-ai32-r06-';
const output = prefix + 'validation.json';
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const receipt = file => ({ path: file, sha256: sha(file) });
const purge = read(prefix + 'purge-real.json');
const invoice = read(prefix + 'invoice-validation.json');
const cleanup = read(prefix + 'purge-sandbox-cleanup.json');
const health = read(prefix + 'purge-final-health.json');
const preservation = read(prefix + 'purge-configured-chat-preservation.json');
const baseline = read(prefix + 'baseline.json');
for (const report of [purge, cleanup, health, preservation, baseline]) assert.equal(report.status, 'passed');
assert.equal(purge.checks.length, 16);
assert.deepEqual(purge.expiry_result, { purged_chats: 1, unresolved_jobs: 2 });
assert.deepEqual(purge.snapshots.at(-1), { label: 'fully_settled', chats: 0, attachments: 0, messages: 0, parts: 0, jobs: [] });
assert.equal(purge.objects_verified_absent, 2);
assert.equal(purge.additional_puts_during_resume, 0);
assert.equal(purge.actual_cloud_delete_operations, 3);
assert.equal(purge.retention_fixture.last_owner_message_age_days, 91);
assert.deepEqual(purge.injected_fault, { kind: 'local_lost_ack_after_successful_real_DELETE', r2_outage_claimed: false });
assert.deepEqual(purge.lost_ack_cleanup_result, { processed: 1, settled: 0 });
assert.deepEqual(purge.manual_recovery_result, { processed: 1, settled: 1 });
assert.equal(invoice.status, 'passed_with_separate_fixture_cleanup');
assert.equal(invoice.functional_checks, 16);
assert.equal(invoice.offline_guard_checks, 5);
assert.equal(invoice.corrected_harness_cloud_reexecuted, false);
assert.equal(invoice.fixture_cleanup.additional_puts, 0);
assert.equal(invoice.fixture_cleanup.rows_removed, 2);
assert.equal(invoice.fixture_cleanup.complete, true);
assert.equal(invoice.fixture_cleanup.all_eight_ledger_objects_get_404, true);
assert.equal(invoice.storage.physical_own_objects_remaining, 0);
assert.equal(invoice.provider_generations, 0);
assert.equal(invoice.configured_business_records_modified, 0);
assert.equal(cleanup.sandboxes.length, 2);
assert.equal(cleanup.sandboxes.reduce((n, item) => n + item.ledger_record_count, 0), 10);
for (const sandbox of cleanup.sandboxes) {
  for (const flag of ['ledger_records_settled', 'private_ledger_mode_0600', 'owned_container_removed', 'private_descriptor_and_ledger_removed', 'private_directory_removed']) assert.equal(sandbox[flag], true);
  for (const count of Object.values(sandbox.database_final_counts)) assert.equal(count, 0);
}
for (const value of Object.values(health.units)) assert.equal(value, 'active');
for (const status of Object.values(health.http)) assert.equal(status, 200);
for (const name of ['pending_jobs', 'open_attempts', 'held_or_unknown_slots']) assert.equal(health.sql_quiet[name], 0);
for (const count of Object.values(health.native_runtime_artifact_counts)) assert.equal(count, 0);
assert.equal(health.sql_quiet.migrations, 26);
assert.equal(health.compiled_files_verified, 909);
assert.deepEqual(health.compiled_drift_files, []);
assert.equal(health.native_source_files_verified, 92);
assert.equal(health.native_source_drift_count, 0);
assert.equal(health.acknowledgement_count_observed, null);
for (const flag of ['configuration_modified', 'services_restarted']) assert.equal(health[flag], false);
assert.equal(health.provider_generations, 0);
assert.equal(preservation.attachments_preserved, 3);
assert.equal(preservation.provider_dispatches_remain, 1);
assert.equal(preservation.metadata_byte_equivalent_after_json_projection, true);
const project = file => { const value = read(file); delete value.observed_at_utc; delete value.completed_at_utc; return value; };
assert.deepEqual(project(preservation.source_before), project(preservation.source_after));
for (const item of baseline.sources) assert.equal(sha(item.path), item.sha256, item.path + ' drift');
const knowledge = read('nodia-server/src/nodia-ai/knowledge/manifest.json');
assert.equal(knowledge.release_id, baseline.knowledge_release);
assert.equal(knowledge.documents.length, 27);
assert.equal(knowledge.fragments.length, 27);
assert.equal(knowledge.capability_contracts.length, 67);
const documents = [
  'docs/mvp/78-nodia-ai-ai32-attachments-voice.md', 'docs/mvp/00-progress.md', 'docs/mvp/README.md',
  'docs/mvp/45-nodia-ai-implementation-plan.md', 'docs/mvp/68-nodia-ai-ai22-business-operations.md',
  'docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md', 'docs/mvp/vps-local-vm-lab.md',
  'docs/nodia-ai/knowledge/README.md', 'docs/nodia-ai/knowledge/nodia-ai/README.md',
  'docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md',
  'docs/nodia-ai/knowledge/businesses/features/confirmed-business-effects.md',
];
assert(source(documents[3]).includes('- [ ] **AI-32 —'));
assert(source(documents[5]).includes('> Estado: propuesto'));
for (const [file, revision] of [[documents[8], 31], [documents[9], 7], [documents[10], 4]]) {
  const metadata = JSON.parse(source(file).split('---')[1]);
  assert.equal(metadata.revision, revision);
  assert.equal(metadata.approval, null);
  assert.equal(metadata.document_status, 'draft');
  assert.equal(metadata.integration_status, 'unregistered');
  assert(metadata.verification.evidence_paths.includes(output));
}
const artifacts = fs.readdirSync(path.join(root, 'docs/evidence'))
  .filter(name => name.startsWith('nodia-ai-ai32-r06-') && name.endsWith('.json') && 'docs/evidence/' + name !== output)
  .map(name => 'docs/evidence/' + name);
const scripts = fs.readdirSync(path.join(root, 'docs/evidence/scripts'))
  .filter(name => name.includes('nodia-ai-ai32-r06') && /\.(?:cjs|mjs)$/.test(name))
  .map(name => 'docs/evidence/scripts/' + name);
const result = {
  stage: 'AI-32-R06', status: 'passed_with_documented_fixture_recovery',
  scope: 'compiled_use_cases_private_lab_real_R2_real_inspector_disposable_PostgreSQL',
  documentary_approval: false, ai32_product_acceptance_checkbox_open: true,
  application_code_changed: false, configured_business_database_modified: false,
  provider_generations: 0, production_services_restarted: false,
  checks: { purge: 16, invoice_functional: 16, invoice_offline_guards: 5 },
  verified: ['retention_cascade_and_R2_deletion', 'write_window_and_locally_lost_DELETE_ACK_recovery',
    'independent_invoice_copy_and_atomic_receipt', 'distinct_PDF_replacement_and_legacy_transfer',
    'SQL_rollback_and_orphan_compensation', 'invoice_survives_origin_chat_expiry'],
  fixture_recovery: {
    purge: 'stdin_and_SQL_fixture_failures_preserved_final_resume_reused_same_objects_without_PUT',
    invoice: 'sixteen_functional_checks_passed_before_bigint_fixture_teardown_failure_separate_cleanup_completed',
    corrected_invoice_harness_cloud_reexecuted: false,
  },
  cleanup: { own_cloud_objects_verified_absent: 10, disposable_databases_removed: 2, operational_chat_attachments_preserved: 3 },
  final_health: { services: health.units, http: health.http, compiled_files_matched: 909, native_sources_matched: 92,
    pending_jobs: 0, open_attempts: 0, held_or_unknown_slots: 0, acknowledgement_count_observed: null },
  limitations: ['Synthetic actors and due timestamps; no new UI, Gemini or MCP end-to-end call.',
    'Lost DELETE acknowledgement was locally injected after successful R2 response; no R2 outage claimed.',
    'No 90-day wall-clock wait, scheduler SLA or production acceptance established.',
    'MCP publication and native invoice download acceptance are separate gates.'],
  knowledge_release_unchanged: baseline.knowledge_release,
  knowledge: { published_documents: 27, fragments: 27, read_capability_contracts: 67, publication_changed: false },
  baseline: baseline.sources, documents: documents.map(receipt), artifacts: artifacts.sort().map(receipt), scripts: scripts.sort().map(receipt),
};
if (process.argv.includes('--check')) assert.deepEqual(read(output), result, 'R06 evidence drift');
else fs.writeFileSync(path.join(root, output), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ stage: result.stage, status: result.status, checks: result.checks, cleanup: result.cleanup, documentary_approval: false }));
