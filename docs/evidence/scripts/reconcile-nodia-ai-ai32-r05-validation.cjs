// Offline evidence reconciliation. Never contacts R2, SQL or an AI provider.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const target = 'docs/evidence/nodia-ai-ai32-r05-validation.json';
const bytes = file => fs.readFileSync(path.join(root, file));
const hash = file => crypto.createHash('sha256').update(bytes(file)).digest('hex');
const json = file => JSON.parse(bytes(file).toString('utf8').replace(/^\uFEFF/, ''));
const artifact = file => ({ path: file, bytes: bytes(file).length, sha256: hash(file) });
const prefix = 'docs/evidence/nodia-ai-ai32-r05-';
const r2 = name => json(`${prefix}r2-${name}.json`);

const configuration = r2('configuration');
assert.equal(configuration.status, 'passed');
assert.equal(configuration.other_environment_values_preserved, true);
assert.equal(configuration.gemini_container_identity_preserved, true);
assert.equal(configuration.credential_values_exported, false);
const activation = r2('storage-activation');
assert.equal(activation.compiled_files_verified, 909);
assert.equal(activation.unchanged_existing_compiled_files, 903);
assert.equal(activation.changed_paths.length, 2);
assert.equal(activation.added_output_paths.length, 4);
assert.equal(activation.schema_modified, false);
assert.equal(activation.gemini_restarted, false);
const manifest = r2('dist-manifest');
assert.equal(Object.keys(manifest).length, 909);
const baseManifest = r2('base-dist-manifest');
assert.equal(Object.keys(baseManifest).length, 905);
const installed = [...activation.changed_paths, ...activation.added_output_paths];
assert.deepEqual(Object.keys(manifest).sort(), [...Object.keys(baseManifest), ...activation.added_output_paths].sort());
for (const [file, expected] of Object.entries(manifest)) {
  // Runtime parity was observed remotely. Raw nest build intentionally lacks
  // copied policy/schema assets; compare its changed outputs, and require every
  // other remote output to retain the pinned baseline hash.
  if (installed.includes(file)) assert.equal(hash(`nodia-server/${file}`), expected, `installed output ${file}`);
  else assert.equal(expected, baseManifest[file], `preserved runtime output ${file}`);
}
const canary = r2('canary-final');
assert.equal(canary.status, 'passed');
assert.equal(canary.object_absence_verified, true);
assert.equal(canary.download_matches, true);
assert.equal(canary.nodia_ai_put_sdk_max_attempts, 1);
assert.equal(canary.cloud_request_count_verified, false);
assert.deepEqual(canary.operations.map(op => op.http_status), [200,200,204,404]);

const before = r2('app-uploads');
const after = r2('app-after-run');
const final = r2('app-final-metadata');
assert.equal(before.total_attachment_rows, 3);
assert.equal(before.messages.length, 0);
assert.equal(after.total_attachment_rows, 3);
assert.equal(after.runs.length, 1);
assert.equal(after.runs[0].state, 'completed');
assert.equal(after.runs[0].provider_dispatches_used, 1);
assert.equal(after.runs[0].tool_calls_used, 0);
assert.equal(after.runs[0].delegations_used, 0);
assert.deepEqual(after.messages.map(row => [row.role, row.count]).sort(), [['assistant',1],['user',1]]);
for (const snapshot of [before, after]) {
  assert.equal(snapshot.default_transaction_read_only, 'on');
  assert.equal(snapshot.transaction_read_only, 'on');
  assert.equal(snapshot.cloud_reads.length, 3);
  assert(snapshot.cloud_reads.every(row => row.matches_persisted_metadata));
  assert(snapshot.attachments.every(row => row.state === 'ready' && row.interpretation_reviewed === false));
}
assert(after.attachments.every(row => row.linked_message_parts === 1));
assert.deepEqual(final.attachment_parts.map(row => row.attachment_id), after.attachments.map(row => row.id));
assert(final.attachment_parts.every(row => row.has_part_text === false && row.interpretation_reviewed === false));
assert.deepEqual(final.attempts.map(row => row.stage_key), ['context','inference']);
const downloads = json(`${prefix}private-download-hashes.json`);
assert.equal(downloads.length, 3);
for (const [index, row] of after.attachments.entries()) {
  assert.equal(downloads[index].bytes, Number(row.byte_count));
  assert.equal(downloads[index].sha256, row.content_hash);
}

const health = r2('final-health');
assert.equal(health.status, 'passed');
assert(Object.values(health.units).every(value => value === 'active'));
assert(Object.values(health.http).every(value => value === 200));
assert.equal(health.sql_quiet.pending_jobs, 0);
assert.equal(health.sql_quiet.open_attempts, 0);
assert.equal(health.sql_quiet.held_or_unknown_slots, 0);
assert.equal(health.sql_quiet.migrations, 26);
assert(Object.values(health.native_runtime_artifact_counts).every(value => value === 0));
assert.equal(health.acknowledgement_count_observed, null);
assert.equal(health.compiled_files_verified, 909);
assert.equal(health.native_source_files_verified, 92);
assert.equal(health.native_source_drift_count, 0);

const flow = json(`${prefix}ui-flow.json`);
assert.equal(flow.status, 'passed');
assert.equal(flow.capture.physical_microphone_user_confirmed, true);
assert.equal(flow.capture.transcription_confirmed_by_user_after_response, true);
assert.equal(flow.capture.virtual_microphone_used, false);
assert.equal(flow.generation.provider_dispatches, 1);
assert.equal(flow.generation.automatic_inference_replay, false);
assert.equal(flow.persistence.reload_kept_three_references, true);
const layout = json(`${prefix}ui-layout.json`);
assert.equal(layout.checks.length, 5);
for (const check of layout.checks) {
  assert.equal(check.documentWidth, check.availableWidth);
  assert(check.form.bottom <= check.card.bottom);
  assert(check.files.every(file => file.present));
  assert.equal(check.panel.overflowY, 'visible');
}
const code = json(`${prefix}storage-code-validation.json`);
assert.equal(code.quality.use_case_tests_passed, 50);
assert.equal(code.quality.standalone_sdk_http_checks_passed, 12);
for (const source of [...code.sources, ...code.compiled_javascript, code.standalone_test, code.standalone_log]) {
  assert.equal(hash(source.path), source.sha256, `source validation ${source.path}`);
}
const logFiles = [
  '.tmp/ai32-r05-client-layout-regression.log', '.tmp/ai32-r05-client-layout-contract-regression.log',
  '.tmp/ai32-r05-client-layout-typecheck-final.log', '.tmp/ai32-r05-client-layout-lint-final.log',
  '.tmp/ai32-r05-client-build-final.log', '.tmp/ai32-r05-storage-retry.log',
];
assert(bytes(logFiles[0]).toString('utf8').includes('49 passed'));
assert(bytes(logFiles[1]).toString('utf8').includes('7 passed'));
assert(bytes(logFiles[4]).toString('utf8').includes('built in'));

const documents = [
  'docs/mvp/README.md', 'docs/mvp/00-progress.md', 'docs/mvp/45-nodia-ai-implementation-plan.md',
  'docs/mvp/78-nodia-ai-ai32-attachments-voice.md', 'docs/mvp/vps-local-vm-lab.md',
  'docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md',
  'docs/nodia-ai/knowledge/README.md', 'docs/nodia-ai/knowledge/nodia-ai/README.md',
  'docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md', 'nodia-client/DESIGN.md',
];
const sources = [
  'nodia-client/src/modules/nodiaAi/pages/NodiaAI/NodiaAI.tsx',
  'nodia-client/src/modules/nodiaAi/pages/NodiaAI/styles.ts',
  'nodia-client/src/modules/nodiaAi/components/Attachments/styles.ts',
  'nodia-client/src/test/modules/nodiaAi/pages/NodiaAI/NodiaAI.test.tsx',
  ...code.sources.map(item => item.path), code.standalone_test.path,
];
for (const file of documents.filter(file => /knowledge\/nodia-ai\//.test(file))) {
  const content = bytes(file).toString('utf8');
  const metadata = JSON.parse(content.split(/^---\s*$/m)[1]);
  assert.equal(metadata.document_status, 'draft');
  assert.equal(metadata.integration_status, 'unregistered');
  assert.equal(metadata.approval, null);
}
assert(bytes('docs/mvp/45-nodia-ai-implementation-plan.md').toString('utf8').includes('- [ ] **AI-32 —'));
const knowledge = json('nodia-server/src/nodia-ai/knowledge/manifest.json');
assert.equal(knowledge.release_id, '6c4ff3a4259aebb2ec0d360c278457daa5cc8d59d46685246823f298c5423d50');
const evidence = fs.readdirSync(path.join(root, 'docs/evidence')).filter(file => file.startsWith('nodia-ai-ai32-r05-') && file !== path.basename(target)).sort().map(file => artifact(`docs/evidence/${file}`));
const result = {
  stage: 'AI-32-R05', scope: 'r2_microphone_app_flow_and_responsive_composer', status: 'passed',
  provider_generations: 1, provider_mode: 'token_plan_web', automatic_inference_replays: 0,
  business_effects: 0, physical_microphone_and_response_confirmed_by_user: true,
  quality: { client_tests: 56, client_test_files: 7, server_use_case_tests: 50, server_use_case_files: 5,
    sdk_http_checks: 12, full_historical_suites_reexecuted: false, python_sources_changed: false },
  runtime: { node_compiled_files: 909, gemini_source_files: 92, gemini_restarted: false,
    migration_count: 26, open_jobs_attempts_slots: 0, observed_ack_count: null },
  knowledge: { release_id: knowledge.release_id, publication_changed: false, document_approval_changed: false },
  limitations: flow.not_verified_in_this_run,
  evidence, sources: sources.map(artifact), documents: documents.map(artifact), logs: logFiles.map(artifact),
  historical_r04: artifact('docs/evidence/nodia-ai-ai32-r04-validation.json'),
  reconciler: artifact('docs/evidence/scripts/reconcile-nodia-ai-ai32-r05-validation.cjs'),
};
const serialized = JSON.stringify(result, null, 2)+'\n';
if (process.argv.includes('--check')) assert.equal(bytes(target).toString('utf8'), serialized, 'R05 consolidated evidence drift');
else fs.writeFileSync(path.join(root, target), serialized, 'utf8');
console.log(JSON.stringify({ stage:'AI-32-R05', status:'passed', artifacts:evidence.length,
  client_tests:56, server_use_case_tests:50, sdk_http_checks:12, generations:1, runtime_compiled:909,
  historical_r04_preserved:true, knowledge_release_preserved:true, check:process.argv.includes('--check') }));
