// Offline provenance and acceptance gate. This file never calls the network or mutates the VM.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const destination = 'docs/evidence/nodia-ai-ai38-proxy-attachments-validation.json';
const historic = 'docs/evidence/nodia-ai-ai38-ui-retry-validation.json';
const historicSHA = '758c6b18cbc77b41213853512c398e5ad56e875a64364d21a052b229c39391ac';
const LIMIT = 20 * 1024 * 1024;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hex = value => assert.match(value, /^[a-f0-9]{64}$/u);
const instant = value => { const date = Date.parse(value); assert.ok(Number.isFinite(date)); return date; };
const trueKeys = (value, keys) => { for (const key of keys) assert.equal(value[key], true, key); };
const safe = relative => {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative) && !relative.includes('\\'));
  const filename = path.resolve(root, relative);
  assert.ok(filename.startsWith(root + path.sep)); return filename;
};

// These are observed, normalized facts with required raw receipt references, not runtime fixtures.
function acceptanceGate(facts) {
  assert.equal(facts.fixture_session_or_token_injected, false);
  assert.ok(['human_Google_exchange', 'existing_legitimate_session_restored'].includes(facts.authentication_kind));
  assert.equal(facts.transport, 'PUT_application_octet_stream');
  assert.equal(facts.application_file_limit_bytes, LIMIT);
  assert.equal(facts.proxy_content_route_limit_bytes, LIMIT);
  assert.equal(facts.global_proxy_limit_changed, false);
  trueKeys(facts, ['route_scoped_limit', 'nginx_test_passed', 'proxy_reversal_byte_exact',
    'proxy_fix_durable_at_end', 'UI_real_attachment_upload_success', 'r2_private_download_verified',
    'over_limit_frontend_rejected', 'only_owned_resources_cleaned']);
  assert.equal(facts.exact_file_bytes, LIMIT); assert.equal(facts.R2_downloaded_file_bytes, LIMIT);
  hex(facts.fixture_sha256);
  assert.equal(facts.R2_download_sha256, facts.fixture_sha256);
  assert.equal(facts.over_limit_file_bytes, LIMIT + 1); assert.equal(facts.over_limit_proxy_HTTP_status, 413);
  assert.equal(facts.over_limit_R2_objects_created, 0); assert.equal(facts.owned_R2_objects_remaining, 0);
  assert.equal(facts.provider_generations, 0); assert.equal(facts.business_effects, 0);
  assert.equal(facts.original_database_restored, false);
  return true;
}

function selfTest() {
  const value = { fixture_session_or_token_injected: false, authentication_kind: 'existing_legitimate_session_restored',
    transport: 'PUT_application_octet_stream', application_file_limit_bytes: LIMIT, proxy_content_route_limit_bytes: LIMIT,
    global_proxy_limit_changed: false, exact_file_bytes: LIMIT, R2_downloaded_file_bytes: LIMIT,
    fixture_sha256: 'a'.repeat(64), R2_download_sha256: 'a'.repeat(64),
    over_limit_file_bytes: LIMIT + 1, over_limit_proxy_HTTP_status: 413, over_limit_R2_objects_created: 0,
    owned_R2_objects_remaining: 0, provider_generations: 0, business_effects: 0, original_database_restored: false };
  for (const key of ['route_scoped_limit', 'nginx_test_passed', 'proxy_reversal_byte_exact', 'proxy_fix_durable_at_end',
    'UI_real_attachment_upload_success', 'r2_private_download_verified',
    'over_limit_frontend_rejected', 'only_owned_resources_cleaned']) value[key] = true;
  assert.equal(acceptanceGate(value), true);
  const negatives = [
    ['fixture_session_or_token_injected', true], ['authentication_kind', null], ['transport', 'multipart'],
    ['proxy_content_route_limit_bytes', LIMIT + 1], ['global_proxy_limit_changed', true],
    ['exact_file_bytes', LIMIT - 1], ['R2_downloaded_file_bytes', LIMIT - 1], ['R2_download_sha256', 'b'.repeat(64)],
    ['r2_private_download_verified', false], ['over_limit_proxy_HTTP_status', 200],
    ['over_limit_frontend_rejected', false], ['owned_R2_objects_remaining', 1], ['only_owned_resources_cleaned', false],
    ['proxy_fix_durable_at_end', false], ['proxy_reversal_byte_exact', false], ['provider_generations', 1],
  ];
  for (const [key, replacement] of negatives) {
    const changed = structuredClone(value); changed[key] = replacement;
    assert.throws(() => acceptanceGate(changed), key);
  }
  return { status: 'passed_offline_controls_only', positive: 1, negative: negatives.length,
    network_requests: 0, VM_changes: false, real_acceptance_claimed_by_controls: false };
}

function main() {
  const mode = process.argv[2];
  if (mode === '--self-test') { console.log(JSON.stringify(selfTest())); return; }
  assert.ok(['--write', '--check'].includes(mode), 'Use --self-test, --write INPUT.json or --check');
  const references = new Map();
  const ref = relative => { const entry = { path: relative, sha256: digest(fs.readFileSync(safe(relative))) };
    references.set(relative, entry); return entry; };
  const read = relative => { ref(relative); return JSON.parse(fs.readFileSync(safe(relative), 'utf8')); };
  const old = mode === '--check' ? read(destination) : null;
  const inputPath = process.argv[3] ?? old?.input.path;
  assert.ok(inputPath, 'Explicit input required');
  const input = read(inputPath);
  assert.equal(input.schema, 'ai38-proxy-attachments-evidence-input-v1');
  assert.equal(ref(historic).sha256, historicSHA);
  assert.equal(read(historic).authenticated_UI_accepted, true);
  const sources = Object.entries(input.source_pins);
  assert.ok(sources.length >= 3, 'Pin proxy driver, snippet and storage observer');
  for (const [filename, sha256] of sources) { hex(sha256); assert.equal(ref(filename).sha256, sha256, filename); }
  const reports = Object.fromEntries(Object.entries(input.reports).map(([key, filename]) => [key, read(filename)]));
  for (const key of ['proxy_apply', 'proxy_revert', 'proxy_final', 'proxy_probe', 'R2_before', 'R2_after',
    'over_limit_SQL', 'HTTP_observer', 'HTTP_begin', 'entry_runtime', 'final_runtime', 'UI_open', 'UI_close',
    'auth_probe', 'ledger_cleanup', 'chat_final', 'UI', 'closure']) {
    assert.ok(reports[key], 'Required raw receipt: ' + key);
  }
  assert.equal(acceptanceGate(input.observed_facts), true);
  const phases = [reports.proxy_apply, reports.proxy_revert, reports.proxy_final];
  assert.deepEqual(phases.map(value => value.phase), ['apply', 'revert', 'apply']);
  for (const value of phases) {
    assert.equal(value.status, 'passed');
    assert.ok(sources.some(([, sha256]) => sha256 === value.source_sha256));
    trueKeys(value, ['nginx_test_passed', 'nginx_reload_passed']);
    assert.equal(value.API_or_provider_restarts_requested, false);
    assert.equal(value.database_writes_or_provider_calls, 0);
    assert.deepEqual(value.services_before, value.services_after);
    assert.equal(value.rollback_of_database, false);
    assert.ok(instant(value.finished_at_utc) >= instant(value.started_at_utc));
  }
  for (let index = 1; index < phases.length; index++) {
    assert.ok(instant(phases[index].started_at_utc) >= instant(phases[index - 1].finished_at_utc));
    assert.deepEqual(phases[index].services_before, phases[0].services_before);
  }
  assert.equal(phases[0].site_after_sha256, phases[1].site_before_sha256);
  assert.equal(phases[0].site_before_sha256, phases[1].site_after_sha256);
  assert.equal(phases[1].site_after_sha256, phases[2].site_before_sha256);
  assert.equal(phases[0].site_after_sha256, phases[2].site_after_sha256);
  const probe = reports.proxy_probe;
  assert.equal(probe.status, 'passed'); assert.ok(sources.some(([, sha256]) => sha256 === probe.source_sha256));
  assert.equal(probe.exact_bytes, LIMIT); assert.equal(probe.exact_status, 100);
  assert.deepEqual(probe.settled_exact_status_observations, [100, 100]);
  assert.equal(probe.over_bytes, LIMIT + 1); assert.equal(probe.over_status, 413);
  assert.equal(probe.other_route_over_11MiB_status, 413); assert.equal(probe.invalid_UUID_route_over_11MiB_status, 413);
  assert.equal(probe.request_body_bytes_sent, 0); assert.equal(probe.authentication_used, false);
  assert.equal(probe.provider_requests, 0); assert.equal(probe.configured_SQL_writes, 0);
  assert.ok(instant(probe.started_at_utc) >= instant(phases[2].finished_at_utc));
  const fixtures = read(input.fixture_manifest);
  assert.equal(fixtures.synthetic_only, true); assert.equal(fixtures.file_limit_bytes, LIMIT);
  const exact = fixtures.files.find(value => value.byte_count === LIMIT);
  const over = fixtures.files.find(value => value.byte_count === LIMIT + 1);
  assert.ok(exact && over, 'Both exact boundary and one-byte-over fixtures required');
  assert.equal(exact.sha256, input.observed_facts.fixture_sha256);
  for (const value of [reports.R2_before, reports.R2_after]) {
    assert.equal(value.stage, 'AI-38-proxy-attachments'); assert.equal(value.status, 'passed');
    assert.ok(sources.some(([, sha256]) => sha256 === value.source_sha256));
    assert.equal(value.sql_read_only, true); assert.equal(value.secret_or_key_or_bucket_exported, false);
    for (const key of ['configured_sql_writes', 'provider_requests', 'provider_generations', 'puts', 'deletes', 'listings', 'signed_urls']) {
      assert.equal(value[key], 0, key);
    }
  }
  const ready = reports.R2_before, absent = reports.R2_after;
  assert.equal(ready.phase, 'ready'); assert.equal(absent.phase, 'absent');
  assert.ok(instant(ready.observed_at_utc) >= instant(probe.finished_at_utc));
  assert.ok(instant(absent.observed_at_utc) >= instant(ready.observed_at_utc));
  assert.equal(ready.conversation_id, absent.conversation_id); assert.equal(ready.attachment_id, absent.attachment_id);
  assert.equal(ready.attachment.sql_state, 'ready'); assert.equal(ready.attachment.byte_count, LIMIT);
  assert.equal(ready.attachment.actual_sha256, exact.sha256);
  assert.equal(ready.attachment.head_status, 200); assert.equal(ready.attachment.get_status, 200);
  assert.ok(ready.cloud_reads.some(value => value.operation === 'GET' && value.status === 200));
  assert.equal(absent.objects_verified_absent, 1); assert.equal(absent.remaining_owned_cleanup_jobs, 0);
  assert.ok(absent.cloud_reads.some(value => value.operation === 'HEAD' && value.status === 404 && value.not_found === true));
  assert.ok(absent.cloud_reads.some(value => value.operation === 'GET' && value.status === 404 && value.not_found === true));
  const overSQL = reports.over_limit_SQL;
  assert.equal(overSQL.status, 'passed'); assert.equal(overSQL.action, 'discover');
  assert.equal(overSQL.conversation_id, ready.conversation_id);
  assert.equal(overSQL.expected_file_name, over.file_name);
  assert.equal(overSQL.sql_read_only, true); assert.equal(overSQL.storage_keys_or_secrets_emitted, false);
  assert.ok(sources.some(([, sha256]) => sha256 === overSQL.source_sha256));
  for (const key of ['configured_sql_writes', 'provider_requests', 'storage_operations', 'chat_attachment_count', 'matching_attachment_count']) {
    assert.equal(overSQL[key], 0, key);
  }
  assert.deepEqual(overSQL.attachments, []);
  assert.ok(instant(overSQL.observed_at_utc) <= instant(ready.observed_at_utc));
  const observer = reports.HTTP_observer;
  assert.equal(observer.status, 'bounded_metadata_observed_not_Google_or_UI_acceptance');
  assert.ok(sources.some(([, sha256]) => sha256 === observer.source_sha256));
  assert.equal(observer.start_anchor_verified, true); assert.equal(observer.unparseable_lines, 0);
  assert.equal(observer.raw_log_saved, false); assert.equal(observer.credentials_emitted, false);
  assert.equal(observer.body_or_query_or_tokens_read, false); assert.equal(observer.provider_requests, 0);
  assert.deepEqual(observer.known_attachment_ids, [ready.attachment_id]);
  assert.equal(observer.acceptance_conversation_sha256, digest(ready.conversation_id));
  assert.equal(reports.HTTP_begin.status, 'cursor_created_no_UI_acceptance');
  assert.equal(reports.HTTP_begin.cursor_sha256, observer.cursor_sha256);
  assert.equal(reports.HTTP_begin.acceptance_conversation_sha256, observer.acceptance_conversation_sha256);
  for (const [endpoint, method, status] of [['attachment_reservation', 'POST', 201],
    ['owned_attachment_content', 'PUT', 200], ['owned_attachment_metadata_or_discard', 'DELETE', 200]]) {
    const value = observer.counts.find(item => item.endpoint === endpoint && item.method === method && item.status === status);
    assert.equal(value?.count, 1, endpoint);
  }
  const UI = reports.UI;
  assert.equal(UI.status, 'passed'); assert.equal(UI.fixture_session_or_token_injected, false);
  assert.equal(UI.authentication_kind, input.observed_facts.authentication_kind);
  assert.equal(UI.provider_generations, 0); assert.equal(UI.business_effects, 0);
  assert.equal(UI.attachment_id, ready.attachment_id); assert.equal(UI.conversation_id, ready.conversation_id);
  assert.equal(UI.uploaded_file_bytes, LIMIT);
  trueKeys(UI, ['upload_success', 'over_limit_frontend_rejected', 'owned_attachment_discarded']);
  assert.equal(UI.application_download_exercised, false);
  trueKeys(UI, ['message_draft_preserved_on_size_rejection', 'R2_private_download_verified_by_operator',
    'chat_archived_via_UI', 'message_draft_cleared']);
  assert.equal(UI.new_messages, 0); assert.equal(UI.oversize_created_intents, 0);
  assert.ok(Array.isArray(UI.screenshots) && UI.screenshots.length > 0, 'Actual UI screenshot required');
  const closure = reports.closure;
  assert.equal(closure.status, 'passed'); assert.equal(closure.owned_R2_objects_remaining, 0);
  assert.equal(closure.SQL_and_native_pending, 0); assert.equal(closure.original_services_active, 4);
  assert.equal(closure.Gemini_restarts, 0); assert.equal(closure.original_Node932_unchanged, true);
  assert.equal(closure.owned_tunnel_and_tab_closed, true); assert.equal(closure.temporary_viewport_override_reset, true);
  assert.equal(closure.final_proxy_site_sha256, phases[2].site_after_sha256);
  assert.equal(closure.original_database_restored, false);
  trueKeys(closure, ['owned_tunnel_identity_and_loopback_listener_verified', 'private_owned_R2_ledger_removed',
    'chat_archived_not_deleted']);
  for (const key of ['port_5174_listeners_remaining', 'unrelated_processes_stopped', 'API_or_worker_restarts',
    'chat_new_messages', 'chat_new_runs']) assert.equal(closure[key], 0);
  const entry = reports.entry_runtime, final = reports.final_runtime;
  for (const value of [entry, final]) {
    assert.equal(value.status, 'passed_read_only_runtime_snapshot_not_full_release_acceptance');
    assert.equal(value.active_Node_role, 'original'); assert.equal(value.active_candidate, null);
    assert.equal(value.frozen_original_Node.outputs, 932); assert.equal(value.frozen_original_Node.active, true);
    assert.ok(sources.some(([, sha256]) => sha256 === value.inspector_sha256));
    for (const unit of ['nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx']) {
      assert.equal(value.units[unit].active_state, 'active');
    }
    for (const unit of ['nodia-api', 'nodia-ai-worker']) {
      assert.equal(value.units[unit].cwd, value.frozen_original_Node.root);
      assert.equal(value.units[unit].argv_exact_match, true); assert.equal(value.units[unit].expectedentrypointmatch, true);
    }
    for (const phase of [value.quiet_before, value.quiet_after]) {
      for (const key of ['pending_jobs', 'open_attempts', 'retained_slots']) assert.equal(phase.SQL[key], 0);
      for (const key of ['unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
        'temporary_attachment_directories', 'temporary_cli_directories']) assert.equal(phase.native[key], 0);
    }
  }
  assert.deepEqual(final.units, entry.units); assert.deepEqual(final.Gemini, entry.Gemini);
  assert.deepEqual(final.SQL_schema_and_selection, entry.SQL_schema_and_selection);
  assert.deepEqual(final.frozen_original_Node, entry.frozen_original_Node);
  assert.ok(instant(final.started_at_utc) >= instant(absent.observed_at_utc));
  assert.equal(closure.runtime_receipt.path, input.reports.final_runtime);
  assert.equal(closure.runtime_receipt.sha256, ref(input.reports.final_runtime).sha256);
  const [open, close] = [reports.UI_open, reports.UI_close];
  for (const value of [open, close]) {
    assert.equal(value.status, 'passed'); assert.ok(sources.some(([, sha256]) => sha256 === value.source_sha256));
    assert.deepEqual(value.Gemini, final.Gemini); assert.equal(value.scoped_20MiB_preserved, true);
    for (const key of ['provider_generations', 'configured_SQL_writes', 'service_restarts']) assert.equal(value[key], 0);
  }
  assert.equal(open.phase, 'open'); assert.equal(close.phase, 'close');
  assert.equal(open.site_before_sha256, phases[2].site_after_sha256);
  assert.equal(open.site_after_sha256, close.site_before_sha256);
  assert.equal(close.site_after_sha256, phases[2].site_after_sha256);
  assert.equal(UI.started_at_utc, open.finished_at_utc); assert.equal(UI.finished_at_utc, close.started_at_utc);
  const auth = reports.auth_probe;
  assert.equal(auth.status, 'passed'); assert.ok(sources.some(([, sha256]) => sha256 === auth.source_sha256));
  assert.deepEqual(auth.requests, ['POST', 'PUT', 'GET'].map(method => ({ method, status: 401 })));
  assert.equal(auth.credentials_or_tokens_used, false); assert.equal(auth.provider_generations, 0);
  assert.equal(auth.configured_SQL_writes, 0);
  const cleanup = reports.ledger_cleanup;
  assert.equal(cleanup.status, 'passed'); assert.ok(sources.some(([, sha256]) => sha256 === cleanup.source_sha256));
  assert.equal(cleanup.absence_receipt_sha256, ref(input.reports.R2_after).sha256);
  trueKeys(cleanup, ['private_owned_ledger_absent', 'only_settled_owned_attachment_ledger_removed']);
  assert.equal(cleanup.configured_SQL_writes, 0); assert.equal(cleanup.R2_operations, 0);
  assert.equal(cleanup.private_key_or_bucket_exported, false);
  assert.equal(closure.cleanup_receipt.path, input.reports.ledger_cleanup);
  assert.equal(closure.cleanup_receipt.sha256, ref(input.reports.ledger_cleanup).sha256);
  const chat = reports.chat_final;
  assert.equal(chat.schema, 'ai38-ui-chat-snapshot-v1'); assert.equal(chat.status, 'observed_not_provider_or_UI_acceptance');
  assert.ok(sources.some(([, sha256]) => sha256 === chat.source_sha256));
  assert.deepEqual(chat.transaction, { read_only: true, isolation: 'repeatable read' });
  assert.equal(chat.snapshot.conversation.id, ready.conversation_id);
  for (const key of ['messages', 'parts', 'runs', 'jobs', 'attempts']) {
    assert.equal(chat.snapshot.counts[key], 0); assert.deepEqual(chat.snapshot[key], []);
  }
  assert.equal(chat.snapshot_sha256, digest(JSON.stringify(chat.snapshot)));
  assert.equal(chat.configured_SQL_writes, 0); assert.equal(chat.provider_requests, 0);
  assert.equal(UI.SQL_chat_final.path, input.reports.chat_final);
  assert.equal(UI.SQL_chat_final.sha256, ref(input.reports.chat_final).sha256);
  for (const screenshot of reports.UI.screenshots ?? []) {
    hex(screenshot.sha256); assert.equal(ref(screenshot.path).sha256, screenshot.sha256);
  }
  const approved = read('.tmp/ai37-baseline.json').approved_knowledge_hashes;
  assert.equal(Object.keys(approved).length, 31);
  for (const [filename, sha256] of Object.entries(approved)) assert.equal(ref(filename).sha256, sha256, filename);
  ref('docs/evidence/nodia-ai-ai38-proxy-attachments-contract-r01.md');
  ref('docs/evidence/nodia-ai-ai38-proxy-attachments-r01.md');
  const report = { schema_version: 1, stage: 'AI-38',
    status: 'restricted_VM_scoped_proxy20MiB_and_real_attachment_transport_verified_full_release_incomplete',
    AI38_complete: false, release_authorized: false, input: ref(inputPath), historical: ref(historic),
    observed_facts: input.observed_facts, offline_controls: selfTest(),
    limits: ['This accepts real UI upload and discard plus operator-authenticated R2 HEAD/GET on the local Linux VM; the draft UI has no download action.',
      'No authenticated application-download API or UI acceptance is claimed for the 20 MiB fixture. No new provider inference or OCR is claimed.',
      'TLS, public deployment, backup rotation, external restore and AI36 remaining publication retain their separate gates.',
      'Absence of owned live objects is not proof of physical storage erasure or a continuous retention SLA.'],
    sources: [...references.values()].filter(value => value.path !== destination).sort((a, b) => a.path.localeCompare(b.path)),
    validator: ref('docs/evidence/scripts/validate-nodia-ai-ai38-proxy-attachments.cjs') };
  const text = JSON.stringify(report, null, 2) + '\n';
  if (mode === '--write') fs.writeFileSync(safe(destination), text, { flag: 'wx' });
  else assert.equal(fs.readFileSync(safe(destination), 'utf8'), text, 'Frozen acceptance report drift');
  console.log(JSON.stringify({ status: report.status, report_sha256: ref(destination).sha256 }));
}
main();
