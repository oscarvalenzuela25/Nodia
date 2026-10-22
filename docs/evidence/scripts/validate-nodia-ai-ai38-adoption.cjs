// Offline cross-check of the closed A->B->A rehearsal. Never loads runtime or connects to services.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const destination = 'docs/evidence/nodia-ai-ai38-adoption-validation.json';
const mode = process.argv[2];
assert.ok(['--write', '--check'].includes(mode), 'Use --write or --check');
const acceptedBackupCut = process.argv[3] ?? (mode === '--check'
  ? JSON.parse(fs.readFileSync(path.join(root, destination), 'utf8')).backup.accepted_cut : null);
assert.match(acceptedBackupCut ?? '', /^r[0-9]{2}$/u, '--write requires the explicitly accepted backup cut, e.g. r03');
const cleanupSourcePath = process.argv[4] ?? (mode === '--check'
  ? JSON.parse(fs.readFileSync(path.join(root, destination), 'utf8')).backup.cleanup_source.path : null);
assert.match(cleanupSourcePath ?? '', /^docs\/evidence\/scripts\/nodia-ai-ai38-adoption-backup-cleanup(?:-[a-z0-9-]+)?\.py$/u,
  '--write requires the explicit reviewed cleanup source path');
const source = 'docs/evidence/scripts/nodia-ai-ai38-adoption.py';
const sourceSHA = '10df76eabd6c068a6e3ae033333c6807e082d4c34b5dcc6deb0b614eaf487749';
const continuationSource = 'docs/evidence/scripts/nodia-ai-ai38-adoption-r02.py';
const continuationSHA = '5ba19dc450c2dc443f27a42a5f338fbe69178d33c6e00426417f577e969c4bba';
const activationSource = 'docs/evidence/scripts/nodia-ai-ai38-adoption-r03.py';
const activationSHA = '703a068c6dcd1089b12c0961646d4768bc916d7b56c908ba389d902f2c4e2bee';
const references = new Map();
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const resolve = relative => {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative) && !relative.includes('\\'));
  const result = path.resolve(root, relative);
  assert.ok(result.startsWith(root + path.sep));
  return result;
};
const ref = relative => {
  const value = { path: relative, sha256: digest(fs.readFileSync(resolve(relative))) };
  references.set(relative, value); return value;
};
const read = relative => { ref(relative); return JSON.parse(fs.readFileSync(resolve(relative), 'utf8')); };
const get = suffix => read('docs/evidence/nodia-ai-ai38-adoption-' + suffix + '.json');
const pin = (relative, expected) => { const value = ref(relative); assert.equal(value.sha256, expected, relative); return value; };
const services = ['nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx'];
const originalRoot = '/opt/nodia/releases/nodia-server-ai15-20261016';
const candidateRoot = '/opt/nodia/releases/nodia-server-ai38-candidate01';
const originalSHA = 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792';
const nativeKeys = ['unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
  'temporary_attachment_directories', 'temporary_cli_directories'];
const SQLKeys = ['pending_jobs', 'open_attempts', 'retained_slots'];
const zeros = (value, keys) => { for (const key of keys) assert.equal(value[key], 0, key); };
const quiet = value => { zeros(value.native, nativeKeys); zeros(value.SQL, SQLKeys); };
const instant = value => { const result = Date.parse(value); assert.ok(Number.isFinite(result)); return result; };
const metadataEpoch = value => ({ id: value.id ?? value.container_id,
  image: value.image ?? value.container_image,
  started_at: value.started_at ?? value.started_at_utc ?? value.container_started_at_utc });

function verifyStop(value) {
  quiet(value.before_stop); quiet(value.second_pre_stop); quiet(value.after_stop);
  assert.equal(value.active_job_drain_exercised, false);
  for (const unit of services.slice(0, 2)) {
    const result = value.stop_results[unit];
    assert.equal(result.Result, 'success'); assert.equal(result.MainPID, '0');
    assert.ok((result.ExecMainCode === '1' && result.ExecMainStatus === '0') ||
      (result.ExecMainCode === '2' && result.ExecMainStatus === '15'));
  }
}

function frozenPackage(reference, expectedMembers, expectedOutputs, repository) {
  const candidate = read(reference);
  pin(candidate.path + '/manifest.json', candidate.manifest_sha256);
  const manifest = JSON.parse(fs.readFileSync(resolve(candidate.path + '/manifest.json'), 'utf8'));
  assert.equal(Object.keys(manifest.files).length, expectedMembers);
  assert.equal(Object.keys(manifest.files).filter(name => name.startsWith('dist/')).length, expectedOutputs);
  for (const [relative, expected] of Object.entries(manifest.files)) {
    assert.equal(digest(fs.readFileSync(resolve(candidate.path + '/' + relative))), expected, relative);
  }
  for (const [relative, expected] of Object.entries(manifest.production_sources)) {
    assert.equal(digest(fs.readFileSync(resolve(repository + '/' + relative))), expected, relative);
  }
  return candidate;
}

function main() {
  pin(source, sourceSHA); pin('docs/evidence/nodia-ai-ai38-adoption-source-r01.py', sourceSHA);
  pin(continuationSource, continuationSHA); pin('docs/evidence/nodia-ai-ai38-adoption-r02-source.py', continuationSHA);
  pin(activationSource, activationSHA); pin('docs/evidence/nodia-ai-ai38-adoption-r03-source.py', activationSHA);
  const offline = get('offline-r01');
  assert.equal(offline.status, 'passed'); assert.equal(offline.source_sha256, sourceSHA);
  assert.equal(offline.checks_passed, 16); assert.equal(offline.checks.length, 16);
  assert.equal(offline.VM_changes, false); assert.equal(offline.provider_requests, 0);
  pin('docs/evidence/scripts/validate-nodia-ai-ai38-adoption-offline.py', offline.validator_sha256);
  const continuedOffline = get('offline-r02-final');
  assert.equal(continuedOffline.status, 'passed'); assert.equal(continuedOffline.source_sha256, continuationSHA);
  assert.equal(continuedOffline.checks_passed, 21); assert.equal(continuedOffline.checks.length, 21);
  assert.equal(continuedOffline.VM_changes, false); assert.equal(continuedOffline.provider_requests, 0);
  pin('docs/evidence/scripts/validate-nodia-ai-ai38-adoption-offline-r02-final.py', continuedOffline.validator_sha256);
  const activationOffline = get('offline-r03-final');
  assert.equal(activationOffline.status, 'passed'); assert.equal(activationOffline.source_sha256, activationSHA);
  assert.equal(activationOffline.checks_passed, 25); assert.equal(activationOffline.checks.length, 25);
  assert.equal(activationOffline.VM_changes, false); assert.equal(activationOffline.provider_requests, 0);
  pin('docs/evidence/scripts/validate-nodia-ai-ai38-adoption-offline-r03-final.py', activationOffline.validator_sha256);
  const server = frozenPackage('docs/evidence/nodia-ai-ai38-candidate01.json', 2933, 2827, 'nodia-server');
  const client = frozenPackage('docs/evidence/nodia-ai-ai38-client-candidate01.json', 177, 171, 'nodia-client');
  const prepare = get('prepare-r01'), failedQuiesce = get('quiesce-r01');
  const continuation = get('continuation-r02');
  const quiesce = get('quiesce-r02'), activate = get('activate-r03'), rollback = get('rollback-r03');
  assert.equal(failedQuiesce.phase, 'quiesce'); assert.equal(failedQuiesce.script_sha256, sourceSHA);
  assert.equal(failedQuiesce.status, 'failed_requires_review_no_automatic_replay_or_database_restore');
  assert.equal(failedQuiesce.failure_class, 'AssertionError');
  assert.equal(failedQuiesce.provider_generations, 0); assert.equal(failedQuiesce.direct_business_SQL_writes, 0);
  assert.equal(continuation.status, 'explicit_R01_to_R02_continuation');
  assert.equal(continuation.original_source_sha256, sourceSHA);
  assert.equal(continuation.continuation_source_sha256, continuationSHA);
  assert.equal(continuation.prior_prepare_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-prepare-r01.json').sha256);
  assert.equal(continuation.prior_failed_quiesce_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-quiesce-r01.json').sha256);
  assert.equal(continuation.prepare_and_private_descriptors_copied_byte_exact, true);
  assert.equal(continuation.prepare_reexecuted, false); assert.equal(continuation.failed_report_overwritten, false);
  assert.equal(continuation.provider_requests, 0);
  const activationContinuation = get('activation-continuation-r03');
  assert.equal(activationContinuation.status, 'explicit_R02_to_R03_activation_continuation');
  assert.equal(activationContinuation.activation_source_sha256, activationSHA);
  assert.equal(activationContinuation.prior_continuation_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-continuation-r02.json').sha256);
  assert.equal(activationContinuation.prior_prepare_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-prepare-r01.json').sha256);
  assert.equal(activationContinuation.prior_quiesce_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-quiesce-r02.json').sha256);
  assert.equal(activationContinuation.staging_or_quiesce_reexecuted, false);
  assert.equal(activationContinuation.provider_requests, 0); assert.equal(activationContinuation.prior_reports_overwritten, false);
  const phases = [prepare, quiesce, activate, rollback];
  assert.deepEqual(phases.map(value => value.phase), ['prepare', 'quiesce', 'adopt', 'rollback']);
  for (const phase of phases) {
    const expectedSource = phase.phase === 'prepare' ? sourceSHA : phase.phase === 'quiesce' ? continuationSHA : activationSHA;
    assert.equal(phase.status, 'passed'); assert.equal(phase.script_sha256, expectedSource);
    assert.equal(phase.original_Node_manifest_sha256, originalSHA);
    assert.deepEqual(phase.epoch, prepare.epoch);
    for (const key of ['provider_generations', 'Gemini_restarts', 'migrations_executed', 'database_restores', 'direct_business_SQL_writes']) {
      assert.equal(phase[key], 0, key);
    }
    assert.equal(phase.public_traffic_opened, false); assert.equal(phase.full_environment_release_authorized, false);
    assert.equal(phase.existing_proxy_body_limit_MiB, 11); assert.equal(phase.attachment_limit_acceptance, false);
    assert.ok(instant(phase.finished_at_utc) >= instant(phase.started_at_utc));
  }
  for (let index = 1; index < phases.length; index++) {
    assert.ok(instant(phases[index].started_at_utc) >= instant(phases[index - 1].finished_at_utc));
  }
  assert.equal(prepare.epoch.id, '802d6d8792ff9c6f2c8d491b151e984966f854661da172cb6887f69fb8912678');
  assert.equal(prepare.epoch.image, 'sha256:b8efad6217a4f04cb135db027fd899c1826b39c3a16154cca79f1b4f0deb977e');
  assert.equal(prepare.epoch.started_at, '2026-10-20T19:14:35.412657745Z');
  assert.deepEqual(failedQuiesce.epoch, prepare.epoch);
  quiet(prepare.quiet); quiet(activate.quiet); quiet(rollback.quiet);
  verifyStop(quiesce.quiescence); verifyStop(rollback.quiescence);
  for (const phase of [prepare, activate, rollback]) assert.deepEqual(phase.services, Object.fromEntries(services.map(name => [name, 'active'])));
  assert.deepEqual(quiesce.services, { 'nodia-api': 'inactive', 'nodia-ai-worker': 'inactive', 'nodia-gemini-lab': 'active', nginx: 'active' });
  assert.equal(quiesce.IPv4_IPv6_non_loopback_API_fences_active, true);
  assert.equal(activate.IPv4_IPv6_non_loopback_API_fences_active, true);
  assert.equal(rollback.only_owned_IPv4_IPv6_fences_removed, true);
  assert.equal(rollback.rollback_descriptors_byte_exact, true);
  assert.equal(prepare.migration_code_unchanged, true); assert.equal(prepare.SQL_baseline.migrations, 29);
  assert.equal(prepare.SQL_baseline.read_only, true);
  assert.equal(prepare.Server.manifest_sha256, server.manifest_sha256); assert.equal(prepare.Server.files, 2933);
  assert.equal(prepare.Server.fresh_dependencies_copied_physically, true);
  assert.equal(prepare.Client.manifest_sha256, client.manifest_sha256); assert.equal(prepare.Client.files, 177);
  assert.equal(prepare.Client.dist_files, 171); assert.equal(prepare.Client.rebuilt, false);
  assert.equal(activate.restricted_UI_available_for_separate_authenticated_acceptance, true);

  const failedBackupCuts = [];
  for (let index = 1; index < Number(acceptedBackupCut.slice(1)); index++) {
    const cut = 'r' + String(index).padStart(2, '0');
    const failed = get('backup-' + cut);
    assert.equal(failed.status, 'failed_preserved_no_retry');
    assert.equal(failed.disposable_restore_verified, false); assert.equal(failed.original_database_restored, false);
    assert.equal(failed.failed_copy_and_passphrase_removed, true); assert.equal(failed.owned_containers_remaining, 0);
    pin('docs/evidence/scripts/nodia-ai-ai38-adoption-backup' + (cut === 'r01' ? '' : '-' + cut) + '.py', failed.source_sha256);
    failedBackupCuts.push(cut);
  }
  const backup = get('backup-' + acceptedBackupCut);
  assert.equal(backup.status, 'passed'); assert.equal(backup.configured_database_backup, true);
  assert.equal(backup.disposable_restore_verified, true); assert.equal(backup.original_database_restored, false);
  assert.equal(backup.restored_content_served, false); assert.equal(backup.configured_database_writes, 0);
  assert.equal(backup.provider_requests, 0); assert.equal(backup.storage_operations, 0);
  assert.deepEqual(backup.encryption, { format: 'openpgp', cipher: 'AES256', integrity: 'MDC' });
  assert.ok(backup.encrypted_backup_bytes > 0); assert.match(backup.encrypted_backup_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(backup.migration_count, 29); zeros(backup.guard_state, [...SQLKeys, 'active_executions']);
  assert.equal(backup.restore_network_none_no_ports_tmpfs, true); assert.equal(backup.owned_containers_remaining, 0);
  assert.equal(backup.expiry_timer_persistent, true); assert.equal(backup.expiry_timer_active_after, true);
  assert.ok(backup.retention_hours > 0 && backup.retention_hours <= 168);
  assert.ok(instant(backup.source_snapshot_finished_at_utc) >= instant(quiesce.finished_at_utc));
  assert.ok(instant(backup.finished_at_utc) <= instant(activate.started_at_utc));
  assert.equal(backup.external_rotation_journal_or_production_restore_verified, false);
  assert.equal(backup.schema_comparison_policy, 'visible_column_order_extended_types_and_exact_native_CHECK_reparse_v1');
  assert.equal(backup.logical_schema_equal, true); assert.equal(backup.database_locale_equal, true);
  assert.equal(backup.physical_attribute_holes_not_required_for_logical_restore, true);
  const metadata = backup.metadata_comparison;
  assert.equal(metadata.source_table_count, 62); assert.equal(metadata.restored_table_count, 62);
  assert.equal(metadata.row_count_mismatches, 0);
  assert.deepEqual([...metadata.mismatched_keys].sort(), ['columns', 'constraints']);
  for (const key of ['tables', 'indexes', 'migrations', 'database_locale', 'guard']) {
    assert.equal(metadata.source_digests[key], metadata.restored_digests[key], key);
  }
  const parserProof = backup.constraint_parser_proof;
  assert.equal(parserProof.literal_constraints_exact, 456); assert.equal(parserProof.CHECKs_reparsed, 13);
  assert.equal(parserProof.all_constraint_definitions_preserved_after_native_parser, true);
  assert.equal(parserProof.all_weakened_TRUE_counterexamples_rejected, true);
  assert.equal(parserProof.checks.length, 13);
  for (const check of parserProof.checks) {
    assert.equal(check.parser_exact_match, true); assert.equal(check.weakened_TRUE_rejected, true);
    assert.match(check.reparsed_sha256, /^[a-f0-9]{64}$/u);
  }
  const schemaControl = read('docs/evidence/nodia-ai-ai38-backup-schema-only-control-r02.json');
  assert.equal(schemaControl.status, 'observed_not_backup_acceptance');
  assert.equal(schemaControl.business_rows_dumped, false); assert.equal(schemaControl.real_backup_created, false);
  assert.equal(schemaControl.original_constraints, 469); assert.equal(schemaControl.restored_constraints, 469);
  assert.equal(schemaControl.exact_constraint_key_sets_equal, true); assert.equal(schemaControl.CHECKs_reparsed, 13);
  assert.equal(schemaControl.all_weakened_TRUE_counterexamples_rejected, true);
  assert.equal(schemaControl.parser_checks.length, 13);
  for (const check of schemaControl.parser_checks) {
    const current = parserProof.checks.find(value => value.table === check.table && value.constraint === check.constraint);
    assert.ok(current); assert.equal(check.parser_exact_match, true); assert.equal(check.weakened_TRUE_rejected, true);
    assert.equal(check.original_reparsed_sha256, check.restored_sha256);
    assert.equal(current.reparsed_sha256, check.restored_sha256);
  }
  pin('docs/evidence/scripts/nodia-ai-ai38-adoption-backup' + (acceptedBackupCut === 'r01' ? '' : '-' + acceptedBackupCut) + '.py', backup.source_sha256);
  assert.equal(activate.backup_receipt_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-backup-' + acceptedBackupCut + '.json').sha256);

  const runtimeSnapshots = {};
  for (const phase of ['candidate', 'original']) {
    const value = get('runtime-' + phase + '-r03');
    assert.equal(value.status, 'passed_read_only_runtime_snapshot_not_full_release_acceptance');
    assert.equal(value.phase, phase); assert.equal(value.active_Node_role, phase);
    pin('docs/evidence/scripts/nodia-ai-ai38-adoption-runtime.py', value.inspector_sha256);
    assert.equal(value.R03_helpers_source_sha256, activationSHA);
    assert.deepEqual(value.Gemini, prepare.epoch);
    assert.deepEqual(value.SQL_schema_and_selection, prepare.SQL_baseline);
    quiet(value.quiet_before); quiet(value.quiet_after);
    assert.equal(value.frozen_original_Node.manifest_sha256, originalSHA);
    assert.equal(value.frozen_original_Node.outputs, 932); assert.equal(value.frozen_original_Node.active, phase === 'original');
    assert.deepEqual(value.owned_fences, { iptables: phase === 'candidate', ip6tables: phase === 'candidate' });
    for (const unit of services) assert.equal(value.units[unit].active_state, 'active');
    for (const unit of services.slice(0, 2)) {
      const process = value.units[unit], directory = phase === 'candidate' ? candidateRoot : originalRoot;
      const entry = unit === 'nodia-api' ? 'main.js' : 'nodia-ai-worker.js';
      assert.ok(Number.isSafeInteger(process.MainPID) && process.MainPID > 0);
      assert.equal(process.cwd, directory); assert.equal(process.systemd_WorkingDirectory, directory);
      assert.equal(process.argv_exact_match, true); assert.equal(process.expectedentrypointmatch, true);
      assert.equal(process.expected_entrypoint, phase === 'candidate' ? directory + '/dist/' + entry : 'dist/' + entry);
      assert.equal(process.expected_node_command, '/usr/local/bin/node');
    }
    assert.equal(value.proxy.API_root.status, 200);
    assert.equal(value.proxy.root.status, phase === 'candidate' ? 200 : 404);
    if (phase === 'candidate') {
      assert.equal(value.active_candidate.manifest_members, 2933); assert.equal(value.active_candidate.dist_outputs, 2827);
      assert.equal(value.active_candidate.manifest_sha256, server.manifest_sha256);
      assert.equal(value.Client_manifest_sha256, client.manifest_sha256);
      assert.equal(value.proxy.served_outputs, 171); assert.equal(value.proxy.members.length, 171);
      assert.equal(value.proxy.all_served_bytes_match_frozen_Client, true); assert.equal(value.proxy.HTTP_requests, 174);
      const manifest = JSON.parse(fs.readFileSync(resolve(client.path + '/manifest.json'), 'utf8'));
      for (const member of value.proxy.members) {
        assert.equal(member.status, 200); assert.equal(member.COOP, 'same-origin-allow-popups');
        assert.equal(member.sha256, manifest.files['dist' + member.path]);
      }
      assert.equal(value.proxy.SPA_deep_link.sha256, manifest.files['dist/index.html']);
      assert.equal(value.proxy.root.sha256, manifest.files['dist/index.html']);
    }
    for (const key of ['provider_requests', 'configured_SQL_writes', 'storage_operations', 'service_changes', 'remote_file_writes']) {
      assert.equal(value.effects[key], 0, key);
    }
    assert.equal(value.effects.authentication_or_profile_reads, false);
    assert.ok(instant(value.started_at_utc) >= instant((phase === 'candidate' ? activate : rollback).finished_at_utc));
    runtimeSnapshots[phase] = value;
  }

  // Deliberately fail closed until the actual UI and A/B/A process observations exist.
  const UI = get('ui-r01');
  assert.ok(['passed', 'partial'].includes(UI.status));
  assert.equal(typeof UI.full_frozen_Client_shell, 'boolean'); assert.equal(UI.fixture_session_or_token_injected, false);
  assert.ok([null, 'existing_legitimate_session_restored', 'human_Google_exchange'].includes(UI.authentication_kind));
  if (UI.status === 'passed') { assert.ok(UI.authentication_kind); assert.equal(UI.full_frozen_Client_shell, true); }
  assert.equal(UI.business_effects, 0);
  pin(UI.screenshot.path, UI.screenshot.sha256);
  assert.ok(instant(UI.started_at_utc) >= instant(activate.finished_at_utc));
  assert.ok(instant(UI.finished_at_utc) <= instant(rollback.started_at_utc));
  assert.ok(UI.checks && typeof UI.checks === 'object');
  for (const state of Object.values(UI.checks)) assert.ok(['passed', 'blocked', 'not_exercised', 'failed'].includes(state));
  const requiredUI = ['auth_me', 'authorization_context', 'own_chat_history', 'drawer_exact_selection', 'away_return', 'deep_reload'];
  if (UI.status === 'passed') for (const key of requiredUI) assert.equal(UI.checks[key], 'passed', key);
  const provider = UI.provider;
  for (const key of ['browser_message_submissions', 'native_requests', 'terminal_ACKs', 'completed']) {
    assert.ok([0, 1].includes(provider[key]), key);
  }
  assert.equal(provider.unknown, 0); assert.equal(provider.fixture_transport, false);
  assert.equal(provider.terminal_ACKs, provider.native_requests);
  assert.ok(provider.completed <= provider.native_requests && provider.native_requests <= provider.browser_message_submissions);
  if (provider.native_requests) assert.match(provider.attempt_id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u);
  else assert.equal(provider.attempt_id, null);
  assert.ok([null, true, false].includes(provider.semantic_match));
  if (provider.completed) assert.equal(provider.semantic_match, true);
  const postRollback = UI.post_rollback_read;
  assert.ok(['passed', 'blocked', 'not_exercised', 'failed'].includes(postRollback.status));
  assert.ok(instant(postRollback.started_at_utc) >= instant(rollback.finished_at_utc));
  assert.ok(instant(postRollback.finished_at_utc) >= instant(postRollback.started_at_utc));
  if (UI.status === 'passed') assert.equal(postRollback.status, 'passed');
  const observerBegin = read(UI.observer_reports.begin), observerEnd = read(UI.observer_reports.end);
  assert.equal(observerBegin.schema, 'ai38-ui-nginx-observer-v1'); assert.equal(observerEnd.schema, observerBegin.schema);
  assert.equal(observerBegin.action, 'begin'); assert.equal(observerEnd.action, 'end');
  assert.equal(observerBegin.status, 'cursor_created_no_UI_acceptance');
  assert.equal(observerEnd.status, 'bounded_metadata_observed_not_Google_or_UI_acceptance');
  assert.equal(observerBegin.cursor_sha256, observerEnd.cursor_sha256);
  assert.equal(observerBegin.acceptance_conversation_sha256, observerEnd.acceptance_conversation_sha256);
  assert.equal(observerEnd.start_anchor_verified, true); assert.equal(observerEnd.raw_log_saved, false);
  assert.equal(observerEnd.credentials_emitted, false); assert.equal(observerEnd.provider_requests, 0);
  assert.equal(observerEnd.unparseable_lines, 0);
  ref('docs/evidence/scripts/nodia-ai-ai38-ui-adoption-observer.py');
  const successfulHTTP = (endpoint, method) => observerEnd.counts.some(value => value.endpoint === endpoint &&
    value.method === method && value.status >= 200 && value.status < 300 && value.count > 0);
  if (UI.authentication_kind === 'human_Google_exchange') assert.ok(successfulHTTP('auth_login', 'POST'));
  if (UI.authentication_kind) assert.ok(successfulHTTP('auth_me', 'GET'));
  // These counts corroborate the explicitly exclusive UI window. They do not independently identify its browser.

  const purge = get('backup-purge-' + acceptedBackupCut);
  assert.equal(purge.status, 'passed'); assert.equal(purge.encrypted_copy_absent, true);
  assert.equal(purge.passphrase_file_absent, true); assert.equal(purge.only_owned_expiry_units_removed, true);
  assert.equal(purge.expiry_units_remaining, 0); assert.equal(purge.original_database_restored, false);
  assert.equal(purge.configured_SQL_writes, 0); assert.equal(purge.provider_requests, 0);
  assert.equal(purge.physical_erasure_or_external_rotation_proven, false);
  assert.equal(purge.backup_receipt_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-backup-' + acceptedBackupCut + '.json').sha256);
  assert.equal(purge.rollback_receipt_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-rollback-r03.json').sha256);
  const failedPurge = get('backup-purge-attempt-r01');
  assert.equal(failedPurge.status, 'failed_closed_no_mutations');
  assert.equal(failedPurge.purge_report_created, false); assert.equal(failedPurge.expiry_units_not_modified, true);
  assert.equal(failedPurge.cipher_retained, true); assert.equal(failedPurge.key_retained, true);
  assert.equal(failedPurge.configured_SQL_writes, 0); assert.equal(failedPurge.provider_requests, 0);
  assert.equal(failedPurge.original_database_restored, false);
  pin('docs/evidence/scripts/nodia-ai-ai38-adoption-backup-cleanup-current.py', failedPurge.source_sha256);
  const cleanupSource = pin(cleanupSourcePath, purge.source_sha256);
  assert.ok(instant(purge.started_at_utc) >= instant(rollback.finished_at_utc));
  const localClosure = get('localclosure-r01');
  assert.equal(localClosure.status, 'passed'); assert.equal(localClosure.owned_browser_tab_closed, true);
  assert.equal(localClosure.browser_viewport_changed, false); assert.equal(localClosure.owned_tunnel_stopped, true);
  assert.equal(localClosure.owned_tunnel_identity_and_127_0_0_1_forward_verified_before_stop, true);
  assert.equal(localClosure.port_5174_listeners_remaining, 0); assert.equal(localClosure.unrelated_processes_stopped, 0);
  assert.equal(localClosure.provider_requests, 0); assert.equal(localClosure.configured_SQL_writes, 0);
  assert.equal(localClosure.authenticated_UI_accepted, false);
  assert.deepEqual(localClosure.services, Object.fromEntries(services.map(name => [name, 'active'])));
  assert.equal(localClosure.original_runtime_receipt_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-runtime-original-r03.json').sha256);
  assert.equal(localClosure.purge_receipt_sha256, ref('docs/evidence/nodia-ai-ai38-adoption-backup-purge-' + acceptedBackupCut + '.json').sha256);
  const clock = get('clock-r01');
  assert.equal(clock.clocks_or_tolerance_changed, false); assert.equal(clock.job_and_backup_processes_execute_on_VM, true);
  assert.equal(clock.browser_clock_limitation_recorded, true);
  const fichePath = 'docs/nodia-ai/knowledge/nodia-ai/features/runtime-policy.md';
  const fiche = JSON.parse(fs.readFileSync(resolve(fichePath), 'utf8').split('---', 3)[1]);
  assert.equal(fiche.revision, 9); assert.equal(fiche.document_status, 'draft');
  assert.equal(fiche.integration_status, 'unregistered'); assert.equal(fiche.approval, null);
  assert.ok(fiche.verification.evidence_paths.includes(destination)); ref(fichePath);
  const approved = read('.tmp/ai37-baseline.json').approved_knowledge_hashes;
  assert.equal(Object.keys(approved).length, 31);
  for (const [relative, expected] of Object.entries(approved)) pin(relative, expected);
  ref('docs/evidence/nodia-ai-ai38-adoption-r01.md');

  const report = {
    schema_version: 1, stage: 'AI-38', status: UI.status === 'passed'
      ? 'restricted_VM_A_B_A_and_authenticated_UI_verified_full_release_incomplete'
      : 'restricted_VM_A_B_A_verified_UI_partial_full_release_incomplete',
    scope: 'closed_localhost_full_Server_Client_adoption_and_reversal_not_public_environment_release',
    release_authorized: false, AI38_complete: false,
    packages: { Server_manifest_sha256: server.manifest_sha256, Server_members: 2933, compiled_outputs: 2827,
      Client_manifest_sha256: client.manifest_sha256, Client_outputs: 171, Client_rebuilt: false,
      fresh_physical_dependencies_sha256: prepare.Server.fresh_dependencies_sha256 },
    sequence: { phases: ['A_original', 'quiesce_and_local_encrypted_backup', 'B_full_candidates',
      UI.status === 'passed' ? 'authenticated_UI' : 'login_UI_authenticated_checks_blocked', 'A_original'],
      original_Server: originalRoot, candidate_Server: candidateRoot,
      original_Node932_unchanged_sha256: originalSHA, epoch: metadataEpoch(prepare.epoch),
      same_native_descriptor_sha256: prepare.epoch.descriptor_sha256,
      descriptor_reversal_byte_exact: true, effective_process_paths_asserted_by_frozen_phase_program: true,
      effective_processes_and_all_171_served_assets_observed_independently: true,
      final_services_active: 4, final_SQL_and_native_pending: 0, original_database_restored: false,
      only_owned_IPv4_IPv6_API_fences_removed: true, Gemini_restarts: 0, migration_executions: 0 },
    backup: { accepted_cut: acceptedBackupCut, prior_failed_cuts_preserved: failedBackupCuts,
      cleanup_source: cleanupSource,
      encryption: backup.encryption, isolated_unserved_restore_verified: true,
      retention_hours: backup.retention_hours, persistent_expiry_timer: true,
      early_purge_after_verified_rollback: true, encrypted_copy_and_key_absent: true, expiry_units_removed: true,
      logical_schema_policy: backup.schema_comparison_policy, table_row_count_mismatches: 0,
      literal_constraints_exact: 456, CHECKs_native_reparsed_and_weakened_counterexamples_rejected: 13,
      external_backup_rotation_or_production_restore_verified: false },
    UI: { status: UI.status, authentication_kind: UI.authentication_kind, full_frozen_Client_shell: UI.full_frozen_Client_shell,
      fixture_session_or_token_injected: false, checks: UI.checks, provider,
      post_rollback_read_status: postRollback.status, bounded_nginx_metadata_correlated: true,
      metadata_alone_identifies_browser_or_proves_provider: false, business_effects: 0 },
    documentation: { runtime_policy_revision: 9, status: 'draft_unregistered_approval_null',
      approved_documents_byte_identical: 31, new_knowledge_approval_or_tool_publication: false },
    clock: { VM_timestamps_order_runtime_phases: true, Windows_offset_observed_seconds: clock.VM_minus_Windows_seconds,
      clocks_or_tolerance_changed: false, failed_cleanup_report_host_timestamp_not_used_to_order_VM_events: true },
    local_closure: { owned_browser_and_tunnel_closed: true, remaining_5174_listeners: 0,
      unrelated_processes_stopped: 0, original_services_active_after_purge: 4,
      cross_host_observation_is_not_atomic: true },
    offline_controls: { original: 16, reload_continuation: 21, activation_continuation: 25 }, active_job_drain_exercised: false,
    preserved_incident: { original_quiesce_failed_before_consumer_stop: true,
      exact_transient_HTTP_status_recorded: false,
      explicit_continuation_preserves_prior_report_and_sources: true,
      reload_HTTP_status_wait_is_bounded_and_requires_two_successive_observations: true,
      first_isolated_backup_restore_failure_preserved: true,
      activation_consumes_distinct_successful_backup_cut_without_repeating_quiesce: true,
      first_cleanup_template_guard_failure_preserved_without_mutation: true },
    limits: ['Final active Server is original Node932 after the rehearsal; candidates are retained but not left adopted.',
      'Authenticated UI, private chat history, drawer and cross-version conversation recovery remain blocked; no provider request was submitted in this rehearsal.',
      'Restoring an existing legitimate session does not demonstrate a new Google authentication exchange.',
      'Existing nginx 11 MiB limit is preserved; this rehearsal does not accept 20 MiB attachments through that proxy.',
      'External encrypted rotation, journal, restore/object-version inventory and public HTTPS/origin remain independent gates.'],
    sources: [...references.values()].sort((a, b) => a.path.localeCompare(b.path)),
    validator: ref('docs/evidence/scripts/validate-nodia-ai-ai38-adoption.cjs'),
  };
  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (mode === '--write') fs.writeFileSync(resolve(destination), serialized, { flag: 'wx' });
  else assert.equal(fs.readFileSync(resolve(destination), 'utf8'), serialized, 'Frozen adoption validation drift');
  console.log(JSON.stringify({ status: report.status, mode, report_sha256: ref(destination).sha256 }));
}
main();
