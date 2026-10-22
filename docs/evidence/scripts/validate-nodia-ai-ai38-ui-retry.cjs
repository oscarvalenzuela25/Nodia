// Complementary offline verification. No runtime imports, network or VM mutations.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const destination = 'docs/evidence/nodia-ai-ai38-ui-retry-validation.json';
const historicPath = 'docs/evidence/nodia-ai-ai38-adoption-validation.json';
const historicSHA = 'd3317ee551307fab73c4219eddc4e8fdd769a73336efec9358f99303dbb4d77c';
const SQLKeys = ['pending_jobs', 'open_attempts', 'retained_slots'];
const nativeKeys = ['unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
  'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'];
const units = ['nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx'];
const requiredUI = ['auth_me', 'authorization_context', 'own_chat_history', 'drawer_exact_selection', 'away_return', 'deep_reload'];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const instant = value => { const result = Date.parse(value); assert.ok(Number.isFinite(result)); return result; };
const zeros = (value, keys) => { for (const key of keys) assert.equal(value[key], 0, key); };
const quiet = value => { zeros(value.SQL, SQLKeys); zeros(value.native, nativeKeys); };
const safe = relative => {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative) && !relative.includes('\\'));
  const filename = path.resolve(root, relative); assert.ok(filename.startsWith(root + path.sep)); return filename;
};

function HTTPPassed(observer, endpoint, method = 'GET') {
  return observer.counts.some(value => value.endpoint === endpoint && value.method === method &&
    value.status >= 200 && value.status < 300 && value.count > 0);
}

// Pure acceptance gate: a partial human-login attempt remains partial, never silently passed.
function authenticatedGate(UI, before, after) {
  assert.ok(['passed', 'partial'].includes(UI.status));
  assert.equal(UI.fixture_session_or_token_injected, false); assert.equal(UI.business_effects, 0);
  assert.ok([null, 'existing_legitimate_session_restored', 'human_Google_exchange'].includes(UI.authentication_kind));
  for (const state of Object.values(UI.checks)) assert.ok(['passed', 'blocked', 'not_exercised', 'failed'].includes(state));
  const post = UI.post_rollback_read;
  assert.ok(['passed', 'blocked', 'not_exercised', 'failed'].includes(post.status));
  if (UI.status === 'partial') return false;
  assert.equal(UI.full_frozen_Client_shell, true); assert.ok(UI.authentication_kind);
  for (const key of requiredUI) assert.equal(UI.checks[key], 'passed', key);
  for (const endpoint of ['auth_me', 'authorization_context', 'conversation_list',
    'acceptance_conversation_messages', 'connection_catalog', 'connection_eligibility']) {
    assert.ok(HTTPPassed(before, endpoint), endpoint);
  }
  if (UI.authentication_kind === 'human_Google_exchange') assert.ok(HTTPPassed(before, 'auth_login', 'POST'));
  assert.equal(post.status, 'passed'); assert.equal(post.fresh_messages_GET, true);
  assert.equal(post.history_content_match, true); assert.equal(post.loaded_SPA_retained_without_reload, true);
  assert.ok(HTTPPassed(after, 'acceptance_conversation_messages'));
  assert.equal(after.acceptance_conversation_sha256, before.acceptance_conversation_sha256);
  assert.equal(post.conversation_sha256, before.acceptance_conversation_sha256);
  assert.match(post.before_visible_history_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(post.after_visible_history_sha256, post.before_visible_history_sha256);
  return true;
}

function selfTest() {
  const conversation = 'a'.repeat(64), visible = 'b'.repeat(64);
  const UI = { status: 'passed', fixture_session_or_token_injected: false, business_effects: 0,
    authentication_kind: 'human_Google_exchange', full_frozen_Client_shell: true,
    checks: Object.fromEntries(requiredUI.map(key => [key, 'passed'])), post_rollback_read: {
      status: 'passed', fresh_messages_GET: true, history_content_match: true, loaded_SPA_retained_without_reload: true,
      conversation_sha256: conversation, before_visible_history_sha256: visible, after_visible_history_sha256: visible } };
  const before = { acceptance_conversation_sha256: conversation, counts: ['auth_me', 'authorization_context',
    'conversation_list', 'acceptance_conversation_messages', 'connection_catalog', 'connection_eligibility', 'auth_login']
    .map(endpoint => ({ endpoint, method: endpoint === 'auth_login' ? 'POST' : 'GET', status: 200, count: 1 })) };
  const after = { acceptance_conversation_sha256: conversation,
    counts: [{ endpoint: 'acceptance_conversation_messages', method: 'GET', status: 200, count: 1 }] };
  assert.equal(authenticatedGate(UI, before, after), true);
  const negative = [
    value => { value.fixture_session_or_token_injected = true; },
    value => { value.authentication_kind = null; },
    value => { value.checks.drawer_exact_selection = 'blocked'; },
    value => { value.post_rollback_read.fresh_messages_GET = false; },
    value => { value.post_rollback_read.after_visible_history_sha256 = 'c'.repeat(64); },
  ];
  for (const mutate of negative) { const value = structuredClone(UI); mutate(value);
    assert.throws(() => authenticatedGate(value, before, after)); }
  assert.throws(() => authenticatedGate(UI, { ...before, counts: [] }, after));
  assert.throws(() => authenticatedGate(UI, before, { ...after, counts: [] }));
  const partial = structuredClone(UI); partial.status = 'partial'; partial.authentication_kind = null;
  partial.checks.auth_me = 'blocked'; partial.post_rollback_read.status = 'blocked';
  assert.equal(authenticatedGate(partial, { counts: [] }, { counts: [] }), false);
  return { status: 'passed_offline_acceptance_controls_only', positive: 1, negative: negative.length + 2,
    partial_remains_partial: true, network_requests: 0, VM_changes: false };
}

function main() {
  const mode = process.argv[2];
  if (mode === '--self-test') { console.log(JSON.stringify(selfTest())); return; }
  assert.ok(['--write', '--check'].includes(mode), 'Use --self-test, --write INPUT.json or --check');
  const references = new Map();
  const ref = filename => { const entry = { path: filename, sha256: digest(fs.readFileSync(safe(filename))) };
    references.set(filename, entry); return entry; };
  const pin = (filename, expected) => { const entry = ref(filename); assert.equal(entry.sha256, expected, filename); return entry; };
  const read = filename => { ref(filename); return JSON.parse(fs.readFileSync(safe(filename), 'utf8')); };
  const existing = mode === '--check' ? read(destination) : null;
  const inputPath = process.argv[3] ?? existing?.input.path;
  assert.ok(inputPath, 'Explicit evidence input required for --write');
  const input = read(inputPath), UIInput = read(input.reports.UI);
  const reports = Object.fromEntries(Object.entries(input.reports).filter(([key]) => UIInput.status === 'passed' ||
    !['SQL_before', 'SQL_after', 'DOM_before', 'DOM_after', 'mobile_metrics'].includes(key))
    .map(([key, filename]) => [key, read(filename)]));
  pin(historicPath, historicSHA); const historical = read(historicPath);
  assert.equal(historical.UI.status, 'partial'); assert.equal(historical.AI38_complete, false);
  for (const [filename, sha256] of Object.entries(input.source_pins)) pin(filename, sha256);
  const { baseline, prepare, continuation, quiesce, activate, rollback, backup, purge, candidate, original, UI, closure } = reports;
  assert.equal(input.schema, 'ai38-authenticated-UI-retry-input-v1');
  assert.equal(ref(input.reports.prepare).sha256,
    historical.sources.find(value => value.path === 'docs/evidence/nodia-ai-ai38-adoption-prepare-r01.json').sha256);
  assert.equal(continuation.status, 'new_authenticated_UI_window_after_verified_original_restore');
  assert.equal(continuation.source_sha256, input.adoption_source_sha256);
  assert.equal(continuation.pinned_helpers_sha256, '703a068c6dcd1089b12c0961646d4768bc916d7b56c908ba389d902f2c4e2bee');
  assert.equal(continuation.prior_rollback_sha256,
    historical.sources.find(value => value.path === 'docs/evidence/nodia-ai-ai38-adoption-rollback-r03.json').sha256);
  assert.equal(continuation.prepare_sha256, ref(input.reports.prepare).sha256);
  assert.equal(continuation.staging_reexecuted, false); assert.equal(continuation.historical_reports_overwritten, false);
  const phases = [quiesce, activate, rollback];
  assert.deepEqual(phases.map(value => value.phase), ['quiesce', 'adopt', 'rollback']);
  for (const phase of phases) {
    assert.equal(phase.status, 'passed'); assert.equal(phase.script_sha256, input.adoption_source_sha256);
    assert.ok(Object.values(input.source_pins).includes(phase.script_sha256));
    assert.deepEqual(phase.epoch, prepare.epoch);
    assert.equal(phase.original_Node_manifest_sha256, historical.sequence.original_Node932_unchanged_sha256);
    zeros(phase, ['provider_generations', 'Gemini_restarts', 'migrations_executed', 'database_restores', 'direct_business_SQL_writes']);
    assert.equal(phase.public_traffic_opened, false); assert.equal(phase.full_environment_release_authorized, false);
    assert.equal(phase.existing_proxy_body_limit_MiB, 11); assert.equal(phase.attachment_limit_acceptance, false);
    assert.ok(instant(phase.finished_at_utc) >= instant(phase.started_at_utc));
  }
  for (let index = 1; index < phases.length; index++) assert.ok(instant(phases[index].started_at_utc) >= instant(phases[index - 1].finished_at_utc));
  for (const phase of [activate, rollback]) quiet(phase.quiet);
  for (const phase of [quiesce, rollback]) {
    for (const key of ['before_stop', 'second_pre_stop', 'after_stop']) quiet(phase.quiescence[key]);
    assert.equal(phase.quiescence.active_job_drain_exercised, false);
  }
  assert.equal(rollback.rollback_descriptors_byte_exact, true); assert.equal(rollback.only_owned_IPv4_IPv6_fences_removed, true);
  assert.deepEqual(rollback.services, Object.fromEntries(units.map(unit => [unit, 'active'])));
  assert.equal(backup.status, 'passed'); assert.equal(backup.disposable_restore_verified, true);
  assert.equal(backup.source_sha256, ref('docs/evidence/scripts/nodia-ai-ai38-adoption-backup-r04.py').sha256);
  assert.equal(backup.logical_schema_equal, true); assert.equal(backup.database_locale_equal, true);
  assert.equal(backup.metadata_comparison.row_count_mismatches, 0); assert.equal(backup.owned_containers_remaining, 0);
  assert.equal(backup.original_database_restored, false); assert.equal(backup.restore_network_none_no_ports_tmpfs, true);
  assert.deepEqual(backup.encryption, { format: 'openpgp', cipher: 'AES256', integrity: 'MDC' });
  assert.equal(backup.constraint_parser_proof.all_constraint_definitions_preserved_after_native_parser, true);
  assert.equal(backup.constraint_parser_proof.all_weakened_TRUE_counterexamples_rejected, true);
  assert.ok(instant(backup.source_snapshot_finished_at_utc) >= instant(quiesce.finished_at_utc));
  assert.ok(instant(backup.finished_at_utc) <= instant(activate.started_at_utc));
  assert.equal(activate.backup_receipt_sha256, ref(input.reports.backup).sha256);
  assert.equal(purge.status, 'passed'); assert.equal(purge.backup_receipt_sha256, ref(input.reports.backup).sha256);
  assert.equal(purge.source_sha256, ref('docs/evidence/scripts/nodia-ai-ai38-adoption-backup-cleanup-r04.py').sha256);
  assert.equal(purge.rollback_receipt_sha256, ref(input.reports.rollback).sha256);
  for (const key of ['encrypted_copy_absent', 'passphrase_file_absent', 'only_owned_expiry_units_removed']) assert.equal(purge[key], true);
  assert.equal(purge.expiry_units_remaining, 0); assert.equal(purge.original_database_restored, false);
  assert.ok(instant(purge.started_at_utc) >= instant(rollback.finished_at_utc));
  for (const value of [backup, purge]) {
    assert.equal(value.provider_requests, 0); assert.equal(value.original_database_restored, false);
    assert.equal(value.configured_database_writes ?? value.configured_SQL_writes, 0);
  }
  for (const [role, value] of [['original', baseline], ['candidate', candidate], ['original', original],
    ['original', reports.final_runtime]]) {
    assert.equal(value.status, 'passed_read_only_runtime_snapshot_not_full_release_acceptance');
    assert.equal(value.active_Node_role, role); assert.deepEqual(value.Gemini, prepare.epoch);
    assert.equal(value.inspector_sha256, ref('docs/evidence/scripts/nodia-ai-ai38-adoption-runtime.py').sha256);
    assert.deepEqual(value.SQL_schema_and_selection, prepare.SQL_baseline); quiet(value.quiet_before); quiet(value.quiet_after);
    assert.equal(value.frozen_original_Node.manifest_sha256, historical.sequence.original_Node932_unchanged_sha256);
    assert.equal(value.frozen_original_Node.outputs, 932);
    for (const unit of units) assert.equal(value.units[unit].active_state, 'active');
    for (const unit of units.slice(0, 2)) {
      assert.equal(value.units[unit].argv_exact_match, true); assert.equal(value.units[unit].expectedentrypointmatch, true);
      assert.equal(value.units[unit].cwd, role === 'candidate' ? historical.sequence.candidate_Server : historical.sequence.original_Server);
    }
  }
  assert.ok(instant(baseline.finished_at_utc) <= instant(quiesce.started_at_utc));
  assert.ok(instant(candidate.started_at_utc) >= instant(activate.finished_at_utc));
  assert.ok(instant(original.started_at_utc) >= instant(rollback.finished_at_utc));
  assert.equal(candidate.active_candidate.manifest_sha256, historical.packages.Server_manifest_sha256);
  assert.equal(candidate.Client_manifest_sha256, historical.packages.Client_manifest_sha256);
  assert.equal(candidate.proxy.all_served_bytes_match_frozen_Client, true); assert.equal(candidate.proxy.served_outputs, 171);
  assert.equal(candidate.proxy.HTTP_requests, 174); assert.equal(candidate.proxy.members.length, 171);
  const observe = pair => {
    const begin = read(pair.begin), end = read(pair.end);
    assert.equal(begin.status, 'cursor_created_no_UI_acceptance');
    assert.equal(end.status, 'bounded_metadata_observed_not_Google_or_UI_acceptance');
    assert.equal(begin.cursor_sha256, end.cursor_sha256);
    assert.equal(begin.acceptance_conversation_sha256, end.acceptance_conversation_sha256);
    assert.equal(end.start_anchor_verified, true); assert.equal(end.raw_log_saved, false);
    assert.equal(end.credentials_emitted, false); assert.equal(end.unparseable_lines, 0);
    assert.equal(end.provider_requests, 0);
    return { begin, end };
  };
  const before = observe(UI.observer_reports), after = observe(UI.post_rollback_read.observer_reports);
  assert.ok(instant(UI.started_at_utc) >= instant(activate.finished_at_utc));
  assert.ok(instant(UI.finished_at_utc) <= instant(rollback.started_at_utc));
  assert.ok(instant(after.begin.began_at_utc) >= instant(rollback.finished_at_utc));
  assert.ok(instant(UI.post_rollback_read.started_at_utc) >= instant(rollback.finished_at_utc));
  const accepted = authenticatedGate(UI, before.end, after.end);
  assert.ok(Array.isArray(UI.screenshots) && UI.screenshots.length > 0);
  for (const screenshot of UI.screenshots) pin(screenshot.path, screenshot.sha256);
  assert.equal(UI.provider.fixture_transport, false); assert.equal(UI.provider.unknown, 0);
  for (const key of ['browser_message_submissions', 'native_requests', 'terminal_ACKs', 'completed']) {
    assert.ok([0, 1].includes(UI.provider[key]), key);
  }
  assert.equal(UI.provider.terminal_ACKs, UI.provider.native_requests);
  assert.ok(UI.provider.completed <= UI.provider.native_requests && UI.provider.native_requests <= UI.provider.browser_message_submissions);
  if (UI.provider.native_requests > 0) {
    assert.ok(input.reports.provider_receipt, 'A real provider receipt is required for any claimed generation');
    assert.equal(reports.provider_receipt.completed, UI.provider.completed);
    assert.equal(reports.provider_receipt.terminal_ACKs, UI.provider.terminal_ACKs);
  }
  if (accepted) {
    const sourceSHA = '897bcf3966cdcf747ba6b2cb0b9b6ea6375f7ca6c5c62aa2b13586d0e5dca30d';
    pin('docs/evidence/scripts/nodia-ai-ai38-ui-chat-snapshot.mjs', sourceSHA);
    assert.ok(reports.SQL_before && reports.SQL_after, 'Projected SQL continuity snapshots required');
    for (const snapshot of [reports.SQL_before, reports.SQL_after]) {
      assert.equal(snapshot.schema, 'ai38-ui-chat-snapshot-v1');
      assert.equal(snapshot.status, 'observed_not_provider_or_UI_acceptance');
      assert.equal(snapshot.source_sha256, sourceSHA);
      assert.deepEqual(snapshot.transaction, { read_only: true, isolation: 'repeatable read' });
      assert.equal(snapshot.configured_SQL_writes, 0); assert.equal(snapshot.provider_requests, 0);
      assert.equal(snapshot.plaintext_parts_emitted, false); zeros(snapshot.global_quiet, SQLKeys);
      assert.equal(digest(snapshot.snapshot.conversation.id), UI.post_rollback_read.conversation_sha256);
      assert.equal(snapshot.snapshot_sha256, digest(JSON.stringify(snapshot.snapshot)));
    }
    assert.equal(reports.SQL_before.snapshot_sha256, reports.SQL_after.snapshot_sha256);
    for (const snapshot of [reports.DOM_before, reports.DOM_after]) {
      assert.equal(snapshot.scope, 'DOM_rendered_message_articles_only');
      assert.equal(snapshot.conversation_sha256, UI.post_rollback_read.conversation_sha256);
      assert.equal(snapshot.plaintext_saved, false); assert.equal(snapshot.article_count, 2);
    }
    assert.equal(reports.DOM_before.message_articles_sha256, UI.post_rollback_read.before_visible_history_sha256);
    assert.equal(reports.DOM_after.message_articles_sha256, UI.post_rollback_read.after_visible_history_sha256);
    assert.equal(reports.DOM_after.loaded_SPA_retained_without_reload, true);
    const mobile = reports.mobile_metrics;
    assert.deepEqual(mobile.viewport, { height: 844, width: 390 });
    assert.ok(mobile.document.scrollWidth <= mobile.viewport.width);
    for (const dialog of mobile.dialog) { assert.ok(dialog.scrollWidth <= mobile.viewport.width);
      assert.ok(dialog.width <= mobile.viewport.width); }
    for (const action of mobile.actions) { assert.equal(action.visible, true);
      assert.ok(action.top >= 0 && action.bottom <= mobile.viewport.height); }
    assert.ok(instant(reports.SQL_before.observed_at_utc) <= instant(rollback.started_at_utc));
    assert.ok(instant(reports.SQL_after.observed_at_utc) >= instant(rollback.finished_at_utc));
    if (UI.provider.completed) {
      assert.equal(reports.SQL_after.nonce_requested, true);
      assert.equal(reports.SQL_after.semantic.assistant_messages_containing_nonce, 1);
      assert.equal(UI.provider.semantic_match, true);
    }
  }
  assert.equal(closure.status, 'passed'); assert.equal(closure.owned_tunnel_stopped, true);
  assert.equal(closure.owned_browser_tab_closed, true); assert.equal(closure.port_5174_listeners_remaining, 0);
  assert.equal(closure.unrelated_processes_stopped, 0); assert.equal(closure.authenticated_UI_accepted, accepted);
  assert.equal(closure.original_runtime_receipt_sha256, ref(input.reports.original).sha256);
  assert.equal(closure.purge_receipt_sha256, ref(input.reports.purge).sha256);
  assert.equal(closure.temporary_viewport_override_reset, true);
  assert.equal(closure.owned_tunnel_identity_and_127_0_0_1_forward_verified_before_stop, true);
  assert.equal(closure.final_runtime_receipt.path, input.reports.final_runtime);
  assert.equal(closure.final_runtime_receipt.sha256, ref(input.reports.final_runtime).sha256);
  assert.ok(instant(reports.final_runtime.started_at_utc) >= instant(purge.finished_at_utc));
  assert.deepEqual(closure.services, Object.fromEntries(units.map(unit => [unit, 'active'])));
  const approved = read('.tmp/ai37-baseline.json').approved_knowledge_hashes;
  assert.equal(Object.keys(approved).length, 31);
  for (const [filename, sha256] of Object.entries(approved)) pin(filename, sha256);
  ref('docs/evidence/nodia-ai-ai38-ui-retry-r01.md');
  const report = { schema_version: 1, stage: 'AI-38',
    status: accepted ? 'restricted_VM_authenticated_UI_and_rollback_chat_continuity_verified_full_release_incomplete'
      : 'restricted_VM_repeated_UI_partial_full_release_incomplete',
    scope: 'complement_to_frozen_A_B_A_evidence_actual_human_session_and_retained_SPA_reads',
    AI38_complete: false, release_authorized: false, input: ref(inputPath), historical: ref(historicPath),
    authenticated_UI_accepted: accepted, UI: { status: UI.status, authentication_kind: UI.authentication_kind,
      checks: UI.checks, post_rollback_read_status: UI.post_rollback_read.status, provider: UI.provider,
      fixture_session_or_token_injected: false, business_effects: 0 },
    final_state: { original_Node932_unchanged: true, original_services_active: 4, SQL_and_native_pending: 0,
      Gemini_restarts: 0, original_database_restored: false, owned_backup_and_key_purged: true,
      owned_expiry_units_removed: true, owned_tunnel_and_tab_closed: true },
    offline_controls: selfTest(),
    limits: ['This local human-session rehearsal does not close public deployment, TLS or external rotation/restore gates.',
      'The inherited nginx 11 MiB body limit does not accept the 20 MiB attachment contract.',
      'Browser-visible history and correlated GET metadata are the tested continuity scope; metadata alone does not authenticate a browser.',
      'No new capability, knowledge approval or AI-36 candidate publication follows from this verification.'],
    sources: [...references.values()].filter(value => value.path !== destination).sort((a, b) => a.path.localeCompare(b.path)),
    validator: ref('docs/evidence/scripts/validate-nodia-ai-ai38-ui-retry.cjs') };
  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (mode === '--write') fs.writeFileSync(safe(destination), serialized, { flag: 'wx' });
  else assert.equal(fs.readFileSync(safe(destination), 'utf8'), serialized, 'Frozen retry report drift');
  console.log(JSON.stringify({ status: report.status, report_sha256: ref(destination).sha256 }));
}
main();
