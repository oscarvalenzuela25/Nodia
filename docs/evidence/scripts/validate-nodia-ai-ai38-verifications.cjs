// Offline cross-check only. No runtime imports, SQL, network, provider or emitted assets.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const destination = 'docs/evidence/nodia-ai-ai38-verifications-r01.json';
const mode = process.argv[2];
assert.ok(['--write', '--check'].includes(mode));
const references = new Map();
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const resolve = relative => {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative) && !relative.includes('\\'));
  const resolved = path.resolve(root, relative);
  assert.ok(resolved.startsWith(root + path.sep));
  return resolved;
};
const hash = relative => digest(fs.readFileSync(resolve(relative)));
const ref = relative => {
  const value = { path: relative, sha256: hash(relative) }; references.set(relative, value); return value;
};
const read = relative => { ref(relative); return JSON.parse(fs.readFileSync(resolve(relative), 'utf8')); };
const evidence = name => 'docs/evidence/nodia-ai-ai38-' + name + '.json';
const get = name => read(evidence(name));
const pinned = (relative, expected) => { assert.equal(hash(relative), expected, relative); return ref(relative); };
const pinMap = values => { for (const [relative, expected] of Object.entries(values)) pinned(relative, expected); };
const epoch = value => ({ id: value.id ?? value.container_id,
  image: value.image ?? value.container_image,
  started_at: value.started_at ?? value.started_at_utc ?? value.container_started_at_utc });
const sameEpoch = (value, expected) => assert.deepEqual(epoch(value), epoch(expected));
const quietKeys = ['pending_jobs', 'open_attempts', 'retained_slots'];
const nativeKeys = ['unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
  'temporary_attachment_directories', 'temporary_cli_directories'];
const zeros = (value, keys) => { for (const key of keys) assert.equal(value[key], 0, key); };
const allActualAttempts = new Set(), allACKs = new Set();
function attempt(id, acknowledged) {
  assert.match(id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u);
  assert.ok(!allActualAttempts.has(id), 'Do not count the same generation twice');
  allActualAttempts.add(id); assert.equal(acknowledged, true); allACKs.add(id);
}
const services = ['nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx'];

async function main() {
  const pause = get('verifications-pause-r01'), resume = get('verifications-resume-r01');
  assert.equal(pause.status, 'passed'); assert.equal(resume.status, 'passed');
  assert.deepEqual(pause.baseline, resume.baseline);
  assert.deepEqual(resume.services, Object.fromEntries(services.map(name => [name, 'active'])));
  for (const value of [pause, resume]) {
    zeros(value.quiet_before.SQL, quietKeys); zeros(value.quiet_before.native, nativeKeys);
    assert.equal(value.native_restarts, 0); assert.equal(value.provider_generations, 0);
    pinned('docs/evidence/scripts/nodia-ai-ai38-verifications-control.py', value.source_sha256);
  }
  const actualEpoch = resume.baseline;
  const server = get('candidate01'), client = get('client-candidate01');
  pinned(server.path + '/manifest.json', server.manifest_sha256);
  pinned(client.path + '/manifest.json', client.manifest_sha256);
  const serverManifest = JSON.parse(fs.readFileSync(resolve(server.path + '/manifest.json'), 'utf8'));
  const clientManifest = JSON.parse(fs.readFileSync(resolve(client.path + '/manifest.json'), 'utf8'));
  for (const [file, expected] of Object.entries(serverManifest.files)) assert.equal(hash(server.path + '/' + file), expected, file);
  for (const [file, expected] of Object.entries(serverManifest.production_sources)) assert.equal(hash('nodia-server/' + file), expected, file);
  for (const [file, expected] of Object.entries(clientManifest.files)) assert.equal(hash(client.path + '/' + file), expected, file);
  for (const [file, expected] of Object.entries(clientManifest.production_sources)) assert.equal(hash('nodia-client/' + file), expected, file);
  assert.equal(Object.keys(serverManifest.production_sources).length, 924);
  assert.equal(Object.keys(clientManifest.production_sources).length, 647);
  const manifestPath = server.path + '/dist/nodia-ai/knowledge/manifest.json';
  const frozenKnowledge = JSON.parse(fs.readFileSync(resolve(manifestPath), 'utf8'));
  assert.equal(frozenKnowledge.release_id, server.knowledge_release_id);
  assert.equal(frozenKnowledge.capability_contracts.length, 74);
  const pythonFreeze = get('mcp-r01-candidate-source-freeze02');
  for (const [file, expected] of Object.entries(pythonFreeze.sources)) {
    pinned('nodia-gemini-microservice/' + file, expected);
  }

  const c05 = get('c05-current-delta-r01');
  assert.equal(c05.status, 'three_of_three_pending_capabilities_accepted'); sameEpoch(c05.epoch, actualEpoch);
  assert.equal(c05.accumulated_accepted_count, 7); assert.equal(c05.current_epoch_newly_accepted_capability_ids.length, 3);
  assert.equal(c05.historical_accepted_capability_ids_not_reexecuted.length, 4);
  assert.equal(new Set(c05.accumulated_accepted_capability_ids_across_cohorts).size, 7);
  assert.equal(c05.native_start_requests_this_delta, 4); assert.equal(c05.accepted_native_starts_this_delta, 4);
  assert.equal(c05.native_ACKs_this_delta, 4); assert.equal(c05.unpublished_candidates_remaining, 77);
  assert.equal(c05.AI36_complete, false); assert.equal(c05.configured_SQL_writes, 0);
  assert.equal(c05.context_pin.release_id, frozenKnowledge.release_id);
  pinMap(c05.sources); pinned(c05.consolidator.path, c05.consolidator.sha256);
  for (const caseName of ['preferences', 'finance']) {
    const record = get(`live-capabilities-${caseName}-r01-case`);
    const guard = get(`live-capabilities-${caseName}-r01-guard`);
    const driver = get(`live-capabilities-${caseName}-r01-driver`);
    const capture = get(`live-capabilities-${caseName}-r01-capture`);
    const receipt = get(`live-capabilities-${caseName}-r01-receipt`);
    pinMap(receipt.files);
    assert.equal(record.status, 'passed'); assert.equal(driver.status, 'passed');
    assert.equal(record.actual_provider_generations, 2); assert.equal(record.provider_dispatch_attempts, 2);
    assert.equal(guard.native_start_requests, 2); assert.equal(record.native_terminal_ACKs.length, 2);
    assert.equal(record.unresolved_native_or_proof_state, false);
    assert.equal(record.disposable_database_retained_for_reconciliation, false);
    assert.equal(record.operational_database_writes, 0); assert.equal(record.synthetic_provider_transport, false);
    assert.equal(record.publication.release_id, frozenKnowledge.release_id);
    sameEpoch(driver.runtime_before, actualEpoch); sameEpoch(capture, actualEpoch);
    assert.equal(capture.same_container_epoch_after_capture, true);
    assert.deepEqual(record.selection, get('modalities-agentic-cohort-02').binding.selection);
    for (const ack of record.native_terminal_ACKs) attempt(ack.attempt_id, true);
    for (const [capability, accepted] of Object.entries(c05.per_case[caseName].accepted_capabilities)) {
      assert.ok(accepted.successful_callbacks >= 1 && accepted.semantic_assertions_passed >= 1);
      assert.equal(record.per_capability[capability].contract_hash, accepted.contract_hash);
      assert.ok(record.per_capability[capability].successful_callbacks >= 1);
    }
  }
  const routing = get('live-routing-routing01'), routingPreflight = get('live-routing-preflight01');
  assert.equal(routingPreflight.status, 'passed'); assert.equal(routingPreflight.native_result.provider_dispatch_requests, 0);
  assert.equal(routing.status, 'passed'); sameEpoch(routing.container_before, actualEpoch); sameEpoch(routing.container_after, actualEpoch);
  const routed = routing.native_result;
  assert.equal(routed.status, 'passed'); assert.equal(routed.checks.length, 13);
  assert.equal(routed.provider_dispatch_requests, 5); assert.equal(routed.terminal_ACKs.length, 5);
  assert.deepEqual(routed.native_accepted_starts, { web: 3, agentic: 2 });
  assert.equal(routed.native_pending_identity, false); assert.equal(routed.configured_snapshot_unchanged_after, true);
  assert.equal(routed.configured_SQL_writes, 0); assert.equal(routed.synthetic_provider_transport, false);
  for (const generation of routed.generations) {
    assert.equal(generation.terminal_received, true); assert.equal(generation.terminal_outcome, 'completed');
    attempt(generation.attempt_id, routed.terminal_ACKs.some(ack => ack.attempt_id === generation.attempt_id && ack.terminal_proof_sha256 === generation.terminal_proof_sha256));
    if (generation.selection.mode === 'token_plan_web') assert.equal(generation.tool_names.length, 0);
  }
  assert.deepEqual(routed.turns.map(value => [value.label, value.dispatches, value.delegations]),
    [['web_conversation', 1, 0], ['delegated', 3, 1], ['next_turn_web', 1, 0]]);
  pinned('nodia-server/test/nodia-ai-ai38-live-routing.mjs', routing.harness_sha256);
  pinned('docs/evidence/scripts/nodia-ai-ai38-verifications-routing.py', routing.runner_sha256);

  const contextValidation = get('context-evolution-validation'), context = get('context-evolution-r03');
  pinMap(contextValidation.sources);
  for (const value of Object.values(contextValidation.attempt_reports)) pinned(value.path, value.sha256);
  assert.equal(context.status, 'passed'); assert.equal(context.integration.checks.length, 14);
  assert.equal(contextValidation.checks, 14); assert.equal(context.provider_generations, 0);
  assert.equal(context.integration.synthetic_dispatches, 2); assert.equal(context.integration.hot_reload, false);
  assert.equal(new Set(context.integration.process_ids).size, 2);
  assert.ok(Object.values(contextValidation.acceptance).every(value => value === true));
  assert.equal(context.integration.cleanup_complete, true);
  assert.equal(contextValidation.operational_adoption, false);
  assert.equal(contextValidation.candidate_manifest_sha256, server.manifest_sha256);

  const worker = get('worker-process02');
  const dependencies = get('dependencies-r01');
  assert.equal(worker.status, 'passed'); assert.equal(dependencies.status, 'passed');
  for (const record of [worker.native_result, dependencies.worker_control]) {
    assert.equal(record.status, 'passed'); assert.equal(record.checks.length, 11);
    assert.equal(record.child_entrypoint, 'dist/nodia-ai-worker.js'); assert.equal(record.inline_claim_or_execution, false);
    assert.equal(record.fixture_API_closed_before_worker, true); assert.equal(record.child_exit.signal, 'SIGTERM');
    assert.equal(record.own_child_stopped, true); assert.equal(record.disposable_cleanup_complete, true);
    assert.equal(record.disposable_final.effects, 1); assert.equal(record.disposable_final.receipts, 1);
    zeros(record.disposable_final, quietKeys);
    assert.ok(record.worker_network.postgres_connections > 0 && record.worker_network.redis_connections > 0);
    zeros(record.worker_network, ['blocked_sockets', 'fetch_attempts', 'listen_attempts']);
  }
  assert.equal(worker.owned_containers_remaining, 0); assert.equal(worker.own_process_group_remaining, false);
  assert.equal(dependencies.npm_ci_invocations, 1); assert.equal(dependencies.npm_ci_exit_code, 0);
  assert.equal(dependencies.automatic_install_retries, 0); assert.equal(dependencies.lifecycle_scripts_disabled, false);
  assert.equal(dependencies.TLS_verification_disabled, false); assert.equal(dependencies.registry_or_dependency_fallbacks, false);
  assert.equal(dependencies.all_installed_versions_match_lock, true);
  assert.equal(dependencies.all_979_runtime_assets_and_2827_outputs_match_candidate, true);
  assert.equal(dependencies.owned_containers_remaining, 0); assert.equal(dependencies.adopted, false);
  assert.equal(dependencies.lock_sha256, server.package_lock_sha256);
  pinned('nodia-server/test/nodia-ai-ai38-worker-process.mjs', worker.harness_sha256);
  pinned('docs/evidence/scripts/nodia-ai-ai38-worker-process.py', worker.runner_sha256);
  pinned('docs/evidence/scripts/nodia-ai-ai38-dependencies.py', dependencies.runner_sha256);
  get('worker-process01');

  const apiValidation = get('fresh-api-process-validation'), api = get('fresh-api-process-r01');
  const apiNative = get('fresh-api-process-r01-native');
  pinMap(apiValidation.source_and_evidence_sha256);
  assert.equal(apiValidation.status, 'passed'); assert.equal(api.status, 'passed'); assert.deepEqual(api.native_result, apiNative);
  assert.equal(apiNative.checks.length, 11); assert.equal(apiNative.entrypoint, 'dist/main.js');
  assert.equal(apiNative.NODE_ENV, 'production'); assert.equal(apiNative.Nest_testing_used, false);
  assert.equal(apiNative.service_overrides, false); assert.equal(apiNative.fixture_issued_sessions, true);
  assert.equal(apiNative.full_Google_login_tested, false); assert.equal(apiNative.provider_requests, 0);
  assert.equal(apiNative.network_isolation_verified, true); assert.equal(api.disposable_cleanup_complete, true);
  assert.equal(api.owned_containers_remaining, 0); assert.equal(api.fresh_compiled_tree_unchanged_after, true);
  assert.deepEqual(apiNative.HTTP_requests.map(value => value.status), [200, 401, 200, 200, 200, 404, 403, 401]);
  assert.equal(apiNative.child_exit.signal, 'SIGTERM');

  const webValidation = get('modalities-web-validation'), agenticReceipt = get('modalities-agentic-receipt');
  for (const reference of [...webValidation.references, ...webValidation.sources]) pinned(reference.path, reference.sha256);
  pinMap(agenticReceipt.source_sha256);
  for (const [name, expected] of Object.entries(agenticReceipt.evidence_sha256)) pinned('docs/evidence/' + name, expected);
  assert.equal(agenticReceipt.status, 'passed'); assert.equal(agenticReceipt.live_provider_generations, 4);
  assert.equal(agenticReceipt.earlier_bootstrap_probe_requests, 0);
  const formats = [['png', 'image/png'], ['pdf', 'application/pdf'], ['wav', 'audio/wav'], ['webm', 'audio/webm']];
  const bindings = {}, acceptedFormats = [];
  for (const providerMode of ['agentic', 'web']) {
    const cohort = get(`modalities-${providerMode}-cohort-${providerMode === 'agentic' ? '02' : '01'}`);
    assert.equal(cohort.status, 'passed'); assert.equal(cohort.probe_requests_declared_in_reports, 4);
    assert.equal(cohort.unknown_native_state, false); assert.equal(cohort.automatic_inference_retries, 0);
    sameEpoch(cohort.epoch_before, actualEpoch); bindings[providerMode] = cohort.binding;
    assert.deepEqual(cohort.binding.selection, routed.selections[providerMode]);
    for (const [index, [format, media]] of formats.entries()) {
      const relative = evidence(`modalities-${providerMode}-${format}-01`), value = read(relative), summary = cohort.cases[index];
      assert.equal(hash(relative), summary.report_sha256); assert.deepEqual(summary.probe_result, value);
      assert.equal(summary.status, 'passed'); assert.ok(summary.same_binding && summary.same_format && summary.same_epoch);
      assert.equal(value.status, 'passed'); assert.equal(value.media_type, media); assert.equal(value.http_status, 200);
      assert.equal(value.generation_requests, 1); assert.equal(value.maximum_generations, 1);
      assert.equal(value.semantic_match, true); assert.equal(value.expected_answer_sha256, value.actual_answer_sha256);
      assert.equal(value.native_outcome, 'completed'); assert.equal(value.native_pending_identity, false);
      assert.equal(value.exact_format_verified_after, true); assert.equal(value.inference_replayed, false);
      assert.deepEqual(value.selection, cohort.binding.selection);
      assert.equal(value.configuration_generation, cohort.binding.configuration_generation);
      assert.equal(value.session_generation, cohort.binding.session_generation);
      attempt(value.attempt_id, value.native_acknowledged);
      acceptedFormats.push({ mode: providerMode, media_type: media, real_probe: true, completed_and_ACKed: true });
    }
  }
  assert.equal(allActualAttempts.size, 17); assert.equal(allACKs.size, 17);
  const modalitiesFinal = get('verifications-modalities-final-r01');
  const inventory = get('verifications-final-inventory-r01');
  const nativeClosure = get('verifications-final-native-closure-r01');
  assert.equal(modalitiesFinal.provider_generations, 0); assert.equal(modalitiesFinal.metadata_requests, 2);
  zeros(modalitiesFinal.quiet, quietKeys); zeros(inventory.SQL_read_only, quietKeys); zeros(nativeClosure, nativeKeys);
  assert.equal(inventory.operational_node.compiled_files, 932);
  assert.equal(inventory.operational_node.manifest_sha256, actualEpoch.Node932_manifest_sha256);
  assert.equal(inventory.gemini_container.environment_matches_private_baseline, true);
  assert.equal(inventory.gemini_container.mounts_match_private_baseline, true);
  sameEpoch(inventory.gemini_container, actualEpoch);
  for (const name of services) assert.equal(inventory.units[name].active_state, 'active');
  for (const providerMode of ['agentic', 'web']) {
    const value = modalitiesFinal.observations.find(item => item.selection.mode === 'token_plan_' + providerMode);
    assert.equal(value.available, true); assert.deepEqual(value.selection, bindings[providerMode].selection);
    assert.equal(value.configuration_generation, bindings[providerMode].configuration_generation);
    assert.equal(value.session_generation_sha256, digest(Buffer.from(bindings[providerMode].session_generation)));
    assert.equal(value.supports_mcp, providerMode === 'agentic');
    assert.deepEqual([...value.verified_attachment_media_types].sort(), formats.map(([, media]) => media).sort());
  }

  const fichePath = 'docs/nodia-ai/knowledge/nodia-ai/features/runtime-policy.md';
  const ficheText = fs.readFileSync(resolve(fichePath), 'utf8');
  const fiche = JSON.parse(ficheText.split('---', 3)[1]);
  assert.equal(fiche.revision, 8); assert.equal(fiche.document_status, 'draft');
  assert.equal(fiche.integration_status, 'unregistered'); assert.equal(fiche.approval, null);
  assert.ok(fiche.verification.evidence_paths.includes(destination));
  ref(fichePath); ref('docs/evidence/nodia-ai-ai38-verifications-runtime-policy-entry.md');
  const approved = read('.tmp/ai37-baseline.json').approved_knowledge_hashes;
  assert.equal(Object.keys(approved).length, 31); pinMap(approved);
  const { compileKnowledge } = await import(pathToFileURL(resolve('nodia-server/scripts/nodia-ai-knowledge/compiler.mjs')).href);
  const compiled = compileKnowledge(root, frozenKnowledge);
  assert.deepEqual(compiled.manifest, frozenKnowledge);
  assert.deepEqual(compiled.counts, { sources: 59, excluded: 28 });
  const report = {
    schema_version: 1, stage: 'AI-38',
    status: 'representative_VM_acceptance_verified_full_environment_release_incomplete',
    evidence_observed_at_utc: inventory.observed_at_utc,
    clock_source: 'latest_VM_inventory_not_development_host_clock',
    scope: 'current_epoch_representative_C05_routing_formats_plus_isolated_context_process_and_installation_checks',
    real_provider_requests: { C05_delta: 4, routing: 5, Agentic_formats: 4, Web_formats: 4, total: 17,
      generation_count_scope: 'native_adapter_requests_not_provider_internal_tokens_or_billing',
      exact_native_terminal_ACKs: 17, duplicate_attempts: 0, automatic_inference_retries: 0 },
    capabilities: { current_epoch_new_acceptances: c05.current_epoch_newly_accepted_capability_ids,
      historical_not_reexecuted: c05.historical_accepted_capability_ids_not_reexecuted,
      accumulated_representative_C05_acceptances: 7, target_representative_C05: 7,
      unpublished_candidates_remaining: 77, AI36_complete: false, operational_business_effects: 0 },
    routing: { checks: 13, real_generations: 5, exact_ACKs: 5, Web_receives_MCP: false,
      opted_in_same_connection_Agentic: true, next_turn_returns_Web: true },
    isolated_checks: { context_evolution: { checks: 14, distinct_real_processes: 2,
      synthetic_provider_dispatches: 2, real_provider_requests: 0, hot_reload: false,
      operational_publication_or_adoption: false }, standalone_worker: { checks: 11,
      real_entrypoint: true, HTTP_fixture_actor: true, inline_execution: false },
      production_installation: { npm_ci_invocations: 1, exit_code: 0,
        node: dependencies.node_version, npm: dependencies.npm_version,
        direct_production_dependencies: dependencies.direct_production_dependencies,
        installed_package_records: dependencies.installed_package_records,
        fresh_runtime_worker_repeat_checks: 11, repeat_is_not_11_new_product_cases: true },
      fresh_production_API: { checks: 11, actual_main_entrypoint: true, functional_HTTP_GETs: 8,
        Nest_testing_or_service_overrides: false, fixture_issued_sessions: true,
        full_OAuth_login_or_physical_UI: false } },
    native_formats: { accepted_current_exact_mode_format_pairs: 8, accepted: acceptedFormats,
      physical_microphone_or_current_UI_capture: false, audio_source: 'known_synthetic_TTS',
      historical_Web_configuration_session_comparison: false, Web_configuration_session_freshly_bound: true },
    knowledge: { release_id: frozenKnowledge.release_id, approved_documents_byte_identical: 31,
      sources: 59, excluded: 28, fragments: 31, published_capabilities: 74,
      fiche_revision: 8, fiche_status: 'draft_unregistered_approval_null',
      in_memory_manifest_matches_candidate: true, assets_emitted: false,
      approvals_or_executable_bindings_added: false },
    environment: { target: 'VM Linux local', epoch: epoch(actualEpoch),
      original_Node_outputs: 932, original_Node_manifest_sha256: inventory.operational_node.manifest_sha256,
      services_active: 4, native_and_SQL_pending: 0, retained_native_temporaries: 0,
      native_restarts_this_verification_run: 0, consumer_pause_resume_only: true,
      model_or_configuration_mutations: false, configured_SQL_writes: 0,
      full_Node_and_Client_adoption: false, current_minimal_Python_diagnostics_image_retained: true },
    release_authorized: false, AI38_complete: false,
    open_scope: [
      '77 candidate capabilities remain unpublished; seven accumulated representative C05 acceptances are not full AI36 completion.',
      'Full candidate Node/Client operational adoption, rollback rehearsal and target Client origin/proxy are not verified by these isolated processes.',
      'Production OAuth login and current physical UI/microphone capture were not exercised; API sessions are fixtures and audio is synthetic TTS.',
      'External retention, encrypted rotating backups, continuous journal and external restore/object-version inventory retain their infrastructure gates.',
      'Current success does not establish the cause of historical MCP timeouts or stability after another session/configuration/runtime change.',
    ],
    references: [...references.values()].sort((a, b) => a.path.localeCompare(b.path)),
    reproducible_validator: ref('docs/evidence/scripts/validate-nodia-ai-ai38-verifications.cjs'),
  };
  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (mode === '--write') {
    assert.deepEqual(JSON.parse(fs.readFileSync(resolve(destination), 'utf8')),
      { schema_version: 1, stage: 'AI-38', status: 'under_validation_not_frozen' }, 'Never overwrite a frozen report');
    const temporary = resolve(destination + '.building');
    fs.writeFileSync(temporary, serialized, { flag: 'wx' }); fs.renameSync(temporary, resolve(destination));
  } else assert.equal(fs.readFileSync(resolve(destination), 'utf8'), serialized, 'Frozen verification report drift');
  console.log(JSON.stringify({ stage: 'AI-38', mode, status: report.status,
    actual_requests: 17, ACKs: 17, current_C05_delta: 3, accumulated_C05: 7,
    accepted_mode_format_pairs: 8, global_release_complete: false, report_sha256: hash(destination) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
