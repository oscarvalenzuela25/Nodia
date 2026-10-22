// AI-32-R02 independent evidence reconciliation. Read-only and offline except
// for writing this stage's new consolidated JSON when explicit inputs are given.
// Historical AI-32/R01 artifacts and validators are never repaired or rerun.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const destination = 'docs/evidence/nodia-ai-ai32-r02-validation.json';
const historical = [
  { path: 'docs/evidence/nodia-ai-ai32-validation.json', sha256: '69fb56e8182599862f429643241232f23bd08e250c171749feb48241ab7c1800' },
  { path: 'docs/evidence/nodia-ai-ai32-r01-validation.json', sha256: 'c33efcc0f4f539bd1d2494d8aa97eff80ada87354fdf0c4ff596db11640dd60c' },
];
const safePath = value => {
  assert.equal(typeof value, 'string');
  const normalized = value.replaceAll('\\', '/');
  assert(normalized.length > 0 && normalized.length <= 1024);
  assert(!path.posix.isAbsolute(normalized) && !/^[a-z]:/i.test(normalized));
  assert.equal(path.posix.normalize(normalized), normalized);
  assert(!normalized.split('/').some(part => ['..', '.env', 'browser_profile', 'session_state'].includes(part) || part.startsWith('.env.')));
  return normalized;
};
const bytes = file => fs.readFileSync(path.join(root, safePath(file)));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const hash = file => digest(bytes(file));
const read = file => JSON.parse(bytes(file).toString('utf8').replace(/^\uFEFF/, ''));
const receipt = file => ({ path: safePath(file), sha256: hash(file) });
const timestamp = value => { const result = Date.parse(value); assert(Number.isFinite(result)); return result; };
const ansiSgr = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
const cleanText = file => bytes(file).toString('utf8').replace(ansiSgr, '');
const requiredKeys = ['artifact_paths', 'baseline_health_path', 'node_activation_attempt_path', 'node_activation_path',
  'gemini_activation_path', 'final_health_path', 'native_manifest_path', 'node_package_manifest_path',
  'node_package_archive_path', 'current_native_probe_paths', 'mcp_probe_paths', 'server_test_log', 'client_test_log',
  'python_linux_log', 'python_windows_log', 'legacy_sql_path', 'sql_regression_path', 'catalog_delta_path', 'knowledge_delta_path'];
const argument = process.argv.indexOf('--inputs');
const checking = process.argv.includes('--check');
assert(!(checking && argument >= 0), '--check uses the saved immutable input descriptor.');
const saved = checking ? read(destination) : null;
const descriptor = argument >= 0 ? read(safePath(process.argv[argument + 1])) : saved?.inputs;
assert(descriptor, 'Provide --inputs <repository-relative JSON descriptor> for the first consolidation.');
assert.deepEqual(Object.keys(descriptor).sort(), [...requiredKeys].sort());
for (const key of requiredKeys) {
  if (['artifact_paths', 'current_native_probe_paths', 'mcp_probe_paths'].includes(key)) {
    assert(Array.isArray(descriptor[key]));
    assert.equal(new Set(descriptor[key]).size, descriptor[key].length);
    descriptor[key].forEach(safePath);
  } else safePath(descriptor[key]);
}
const inventoryPath = 'docs/mvp/nodia-ai-current-endpoints.json';
const allPaths = [...new Set([...requiredKeys.flatMap(key => Array.isArray(descriptor[key]) ? descriptor[key] : [descriptor[key]]),
  inventoryPath, 'docs/evidence/scripts/reconcile-nodia-ai-ai32-r02-validation.cjs',
  'docs/evidence/scripts/reconcile-nodia-ai-ai32-r02-catalog.cjs',
  'docs/evidence/scripts/reconcile-nodia-ai-ai32-r02-knowledge.cjs',
  'docs/evidence/scripts/nodia-ai-ai32-r02-native-probe.py',
  'docs/evidence/scripts/nodia-ai-ai32-r02-web-text-control.py',
  'docs/evidence/nodia-ai-ai32-r02-harness-provenance.json',
  '.tmp/ai32-r02-native-probe-initial.py',
  ...historical.map(value => value.path)])].sort();
assert(!allPaths.includes(destination), 'The output cannot pin itself.');
const artifacts = allPaths.map(receipt);
for (const old of historical) assert.equal(hash(old.path), old.sha256, 'Historical evidence changed: ' + old.path);
const harnessProvenance = read('docs/evidence/nodia-ai-ai32-r02-harness-provenance.json');
assert.equal(harnessProvenance.provider_generations_requested_by_this_note, 0);
assert.equal(harnessProvenance.historical_attempts_rewritten, false);
assert.equal(harnessProvenance.raw_provider_content_stored, false);
assert.equal(hash(harnessProvenance.initial_harness.path), harnessProvenance.initial_harness.sha256);
assert.equal(hash(harnessProvenance.current_harness.path), harnessProvenance.current_harness.sha256);
assert.equal(harnessProvenance.current_harness.path, 'docs/evidence/scripts/nodia-ai-ai32-r02-native-probe.py');
assert.equal(harnessProvenance.initial_harness.attempt_paths.length, 2);
for (const file of harnessProvenance.initial_harness.attempt_paths) {
  assert(allPaths.includes(file), 'Preserve original pre-hardening canary: ' + file);
  assert(!descriptor.current_native_probe_paths.includes(file), 'The initial harness is historical, not a current proof.');
}

const baseline = read(descriptor.baseline_health_path);
const failedActivation = read(descriptor.node_activation_attempt_path);
assert.equal(failedActivation.status, 'readiness_deadline_exceeded_rolled_back');
assert.equal(failedActivation.readiness_window_seconds, 10);
assert.equal(failedActivation.previous_runtime_restored, true);
assert.equal(failedActivation.previous_api_worker_gemini_active_after_rollback, true);
assert.equal(failedActivation.new_runtime_left_active, false);
assert.equal(failedActivation.new_provider_generations, 0);
assert.equal(failedActivation.business_writes, 0);
assert.equal(failedActivation.new_migrations, 0);
assert.match(failedActivation.corrective_action, /45 seconds/);
const nodeActivation = read(descriptor.node_activation_path);
assert.equal(nodeActivation.migration.applied, 0);
for (const key of ['business_writes', 'new_tables', 'new_columns', 'existing_columns_added', 'real_inferences_by_deployment']) assert.equal(nodeActivation[key], 0);
assert.equal(nodeActivation.gemini_container_restarted, false);
assert.equal(nodeActivation.provider_login_logout_or_inference_requested, false);
assert.equal(nodeActivation.configured_provider_environment_dependencies_unchanged, true);
assert.equal(nodeActivation.http_health, 200);
const activation = read(descriptor.gemini_activation_path);
assert.equal(activation.container_restarted, true);
assert.equal(activation.credential_bytes_owner_mode_preserved, true);
assert.equal(activation.docker_limits_mounts_network_capabilities_namespace_preserved, true);
assert.equal(activation.provider_login_logout_or_inference_requested_by_activation, false);
assert.equal(activation.profile_files_copied_or_hashed, false);
assert.equal(activation.database_modified, false);
assert.equal(activation.health_http, 200);
assert.equal(activation.old_image, baseline.gemini_image);
assert(timestamp(activation.observed_at_utc) >= timestamp(nodeActivation.activated_at_utc));
const health = read(descriptor.final_health_path);
assert.equal(health.stage, 'AI-32-R02');
assert.equal(health.status, 'passed');
assert.equal(health.gemini_image, activation.new_image);
assert.match(health.gemini_image, /^sha256:[0-9a-f]{64}$/);
assert(timestamp(health.observed_at_utc) >= timestamp(activation.observed_at_utc));
assert.deepEqual(health.source_drift_files, []);
for (const key of ['pending_jobs', 'open_attempts', 'held_or_unknown_slots']) assert.equal(health.quiet[key], 0);
for (const [key, value] of Object.entries({ migrations: 26, nodia_ai_tables: 19, nodia_ai_columns: 267 })) {
  assert.equal(health.quiet[key], value); assert.equal(baseline.quiet[key], value);
}
for (const key of ['unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
  'temporary_attachment_directories', 'temporary_cli_directories']) assert.equal(health.native_cleanup[key], 0);
assert(Object.values(health.units).length >= 4 && Object.values(health.units).every(value => value === 'active'));
assert(Object.values(health.http).length >= 2 && Object.values(health.http).every(value => value === 200));
for (const key of ['r2_configuration_present', 'r2_data_path_verified']) assert.equal(typeof health[key], 'boolean');
assert.equal(health.provider_generations_requested_by_health, 0);
assert.equal(health.configured_database_written, false);
assert.equal(health.profile_files_copied_or_hashed, false);

const inventory = read(inventoryPath), catalogDelta = read(descriptor.catalog_delta_path);
assert.equal(catalogDelta.after_inventory_sha256, hash(inventoryPath));
assert.equal(inventory.sourceChecksums.length, 825);
assert.equal(catalogDelta.source_hash_changes.length, 11);
assert.deepEqual(inventory.counts, catalogDelta.unchanged_counts);
for (const source of inventory.sourceChecksums) assert.equal(hash(source.file), source.sha256, 'Node source drift: ' + source.file);
const nativeManifest = read(descriptor.native_manifest_path);
const nativeSources = Object.entries(nativeManifest).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, expected]) => {
  assert.match(expected, /^[0-9a-f]{64}$/);
  const source = receipt('nodia-gemini-microservice/' + safePath(file));
  assert.equal(source.sha256, expected, 'Native source drift: ' + file);
  return source;
});
assert.equal(nativeSources.length, 85);
assert.equal(health.native_source_files_verified, nativeSources.length);
assert.equal(health.native_manifest_sha256, hash(descriptor.native_manifest_path));
const nodeManifest = read(descriptor.node_package_manifest_path);
assert.equal(nodeManifest.kind, 'server');
assert.equal(nodeManifest.files.length, 970);
assert.equal(new Set(nodeManifest.files.map(value => value.path)).size, 970);
for (const item of nodeManifest.files) {
  assert.match(item.sha256, /^[0-9a-f]{64}$/);
  assert.equal(hash('nodia-server/' + safePath(item.path)), item.sha256, 'Packaged source/compiled drift: ' + item.path);
}
// pathlib.Path orders component tuples, so directory 'a/file' precedes file
// 'a.js'. Sorting whole path strings would compute a different valid tree hash.
const pythonPathOrder = (left, right) => {
  const a=left.path.split('/'), b=right.path.split('/');
  for(let index=0;index<Math.min(a.length,b.length);index++)
    if(a[index]!==b[index])return a[index]<b[index]?-1:1;
  return a.length-b.length;
};
const dist = nodeManifest.files.filter(value => value.path.startsWith('dist/'))
  .map(value => ({ path: value.path, sha256: value.sha256 })).sort(pythonPathOrder);
assert.equal(dist.length, 905);
assert.equal(health.compiled_dist_files_verified, dist.length);
assert.equal(health.final_package_files_verified, nodeManifest.files.length);
assert.equal(health.compiled_stage_and_runtime_equal, true);
assert.equal(health.dist_tree_sha256, digest(JSON.stringify(dist)));
assert.equal(health.final_package_manifest_sha256, hash(descriptor.node_package_manifest_path));
assert.equal(health.final_package_archive_sha256, hash(descriptor.node_package_archive_path));
const nodeObservationPath = 'docs/evidence/nodia-ai-ai32-r02-node-observation.json';
assert(allPaths.includes(nodeObservationPath), 'Retain the real Node read-only adapter observation.');
const nodeObservation = read(nodeObservationPath);
assert.equal(nodeObservation.status, 'passed'); assert.equal(nodeObservation.exit_code, 0);
assert.equal(nodeObservation.provider_generations, 0); assert.equal(nodeObservation.database_writes, 0);
assert.equal(nodeObservation.configured_database_read_only, true);
assert.deepEqual(nodeObservation.database_session, {default_read_only:'on',transaction_read_only:'on',pool_max:1});
assert.equal(hash(nodeObservation.script_path), nodeObservation.script_sha256);
assert.equal(hash(nodeObservation.log_path), nodeObservation.log_sha256);
const observedDistPaths = [
  'dist/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.js',
  'dist/nodia-ai-adapter/nodia-ai-adapter.service.js',
  'dist/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.js',
];
assert.deepEqual(Object.keys(nodeObservation.source_hashes).sort(), [...observedDistPaths].sort());
for (const file of observedDistPaths) {
  assert.equal(nodeObservation.source_hashes[file], hash('nodia-server/'+file));
  assert.equal(nodeObservation.source_hashes[file], nodeManifest.files.find(value=>value.path===file)?.sha256);
}
assert.equal(nodeObservation.selections.length, 2);
assert.deepEqual(nodeObservation.selections.map(value=>value.mode).sort(), ['token_plan_agentic','token_plan_web']);
for (const value of nodeObservation.selections) {
  const engine = value.mode === 'token_plan_web' ? 'web' : 'agentic';
  const current = health.native_observations[engine];
  assert.equal(value.connectionId, nodeObservation.connection_id);
  assert.equal(value.status, 'contract_accepted'); assert.equal(value.available, true);
  for (const [nodeKey,nativeKey] of Object.entries({modelId:'model_id',effortId:'effort_id',resourceKey:'resource_key',
    configurationGeneration:'configuration_generation',sessionGeneration:'session_generation',supportsMcp:'supports_mcp'}))
    assert.equal(value[nodeKey], current[nativeKey], 'Node/native selection differs: '+engine+'/'+nodeKey);
  assert.deepEqual([...value.verifiedModalities].sort(), [...current.verified_modalities].sort());
  assert.deepEqual([...value.verifiedAttachmentMediaTypes].sort(), [...current.verified_attachment_media_types].sort());
  assert(timestamp(value.observedAt)>=timestamp(activation.observed_at_utc));
}
const knowledge = read(descriptor.knowledge_delta_path);
assert.equal(knowledge.release, health.knowledge_release);
assert.equal(knowledge.published_capabilities, 67);
assert.equal(knowledge.published_fragments, 27);
assert.equal(knowledge.registry_changed, false);
assert.equal(knowledge.new_published_content, false);

function pythonTests(file) {
  const text = cleanText(file), counts = [...text.matchAll(/Ran (\d+) tests? in ([\d.]+)s/g)];
  assert.equal(counts.length, 1, 'Expected one completed Python suite: ' + file);
  const terminal = /\nOK(?: \(skipped=(\d+)\))?\s*$/.exec(text); assert(terminal);
  const executed = Number(counts[0][1]), skipped = Number(terminal[1] ?? 0);
  assert.equal(executed, 341);
  return { executed, passed: executed - skipped, skipped, elapsed_seconds: Number(counts[0][2]), log: receipt(file) };
}
function vitestTests(file) {
  const text = cleanText(file), files = [...text.matchAll(/Test Files\s+(\d+) passed \((\d+)\)/g)], tests = [...text.matchAll(/Tests\s+(\d+) passed \((\d+)\)/g)];
  assert.equal(files.length, 1, 'Expected one completed Vitest suite: ' + file);
  assert.equal(tests.length, 1);
  assert.equal(files[0][1], files[0][2]); assert.equal(tests[0][1], tests[0][2]);
  assert(!/Test Files\s+\d+ failed|Tests\s+\d+ failed/.test(text));
  return { tests: Number(tests[0][1]), files: Number(files[0][1]), failed: 0, log: receipt(file) };
}
const python = { linux: pythonTests(descriptor.python_linux_log), windows: pythonTests(descriptor.python_windows_log) };
assert.equal(python.linux.skipped, 0); assert.equal(python.windows.skipped, 2);
const unit = { server: vitestTests(descriptor.server_test_log), client: vitestTests(descriptor.client_test_log) };
assert.equal(unit.server.tests, 3336); assert.equal(unit.server.files, 211);
assert(unit.client.tests >= 1687 && unit.client.files >= 217);
const legacy = read(descriptor.legacy_sql_path), regressions = read(descriptor.sql_regression_path);
assert.equal(legacy.status, 'passed'); assert.equal(legacy.exit_code, 0); assert.equal(legacy.integration.checks, 33);
assert.equal(legacy.configured_database_used, false); assert.equal(legacy.provider_inference, false); assert.equal(legacy.cloud_storage_used, false);
assert.deepEqual(legacy.remaining_owned_containers, []);
assert.equal(hash(legacy.script_path), legacy.script_sha256); assert.equal(hash(legacy.log_path), legacy.log_sha256);
assert.equal(regressions.status, 'passed'); assert.equal(regressions.results.length, 2);
for (const value of regressions.results) {
  assert.equal(value.status, 'passed'); assert.equal(value.exit_code, 0); assert.deepEqual(value.remaining_owned_containers, []);
  assert.equal(value.integration.status, 'passed'); assert.equal(value.integration.cleanup_complete, true);
  assert.equal(hash(value.source_path), value.source_sha256); assert.equal(hash(value.log_path), value.log_sha256);
}
assert.deepEqual(regressions.results.map(value => value.integration.checks).sort((a,b) => a-b), [44,58]);
const sqlChecks = legacy.integration.checks + regressions.results.reduce((sum, value) => sum + value.integration.checks, 0);
assert.equal(sqlChecks, 135);

const currentSession = engine => {
  const value = health.native_sessions[engine], generation = typeof value === 'string' ? value : value.session_generation;
  assert.match(generation, /^[0-9a-f]{32}$/); return generation;
};
const exactCurrent = (report, probe, engine) => {
  const observation = health.native_observations[engine];
  return timestamp(report.observed_at_utc) >= timestamp(activation.observed_at_utc)
    && timestamp(report.observed_at_utc) <= timestamp(health.observed_at_utc)
    && (probe.reference?.session_generation ?? probe.session_generation) === currentSession(engine)
    && probe.reference?.resource_key === observation.resource_key
    && probe.model_id === observation.model_id && probe.effort_id === observation.effort_id
    && probe.configuration_generation === observation.configuration_generation;
};
const currentNative = descriptor.current_native_probe_paths.map(file => {
  const report = read(file), probe = report.probe;
  assert(probe && ['web','agentic'].includes(probe.engine));
  assert(['image','pdf','audio'].includes(probe.kind));
  assert.equal(report.automatic_inference_retries, 0); assert.equal(report.generation_requests, 1);
  assert.equal(report.maximum_generations, 1); assert.equal(report.credentials_logged, false);
  assert.equal(report.provider_response_text_stored, false); assert.equal(probe.native_acknowledged, true);
  assert.equal(report.harness_sha256, hash(harnessProvenance.current_harness.path));
  assert.equal(report.observation_after.resource_key, probe.reference.resource_key);
  assert.equal(report.observation_after.session_generation, probe.reference.session_generation);
  assert.match(probe.expected_answer_sha256, /^[0-9a-f]{64}$/);
  if (probe.answer_sha256 !== null && probe.answer_sha256 !== undefined) assert.match(probe.answer_sha256, /^[0-9a-f]{64}$/);
  assert(exactCurrent(report, probe, probe.engine), 'Native proof belongs to another session/selection: ' + file);
  const observedTypes = health.native_observations[probe.engine].verified_attachment_media_types;
  assert(Array.isArray(observedTypes));
  const semantic = probe.semantic_canary_matches === true && probe.answer_sha256 === probe.expected_answer_sha256;
  const passed = semantic && probe.http_status === 200 && probe.native_outcome === 'completed'
    && probe.native_acknowledged === true && observedTypes.includes(probe.media_type);
  // Final MIME proof is selection/session scoped. A historical kind-level cache
  // or the success of WAV can never admit failed WebM/Ogg audio.
  if (report.status === 'passed') assert(passed, 'Successful canary lacks exact current MIME proof: ' + file);
  return { artifact: receipt(file), engine: probe.engine, kind: probe.kind, media_type: probe.media_type,
    attempt_id: probe.attempt_id, session_generation: currentSession(probe.engine), model_id: probe.model_id,
    effort_id: probe.effort_id, configuration_generation: probe.configuration_generation,
    verified: passed, semantic_canary_matches: semantic,
    exact_format_verified_by_final_observation: observedTypes.includes(probe.media_type),
    cached_kind_verified: probe.cached_modality_verified ?? null, original_harness_verified: probe.verified,
    native_outcome: probe.native_outcome, native_acknowledged: true,
    verification_basis: 'exact_start_reference_and_final_session_selection_MIME_plus_independent_semantic_hash_completed_ACK' };
});
const currentMcp = descriptor.mcp_probe_paths.map(file => {
  const report = read(file); assert.equal(report.automatic_inference_retries, 0);
  if (report.generation_requests > 0) assert.equal(report.native_acknowledged, true);
  const exact = report.attempt_id ? exactCurrent(report, report, 'agentic') : false;
  const passed = report.status === 'passed' && exact;
  if (report.status === 'passed') {
    assert(passed, 'MCP proof belongs to another session/selection: ' + file);
    assert.equal(report.scope, 'real_agentic_mcp_and_attachment_synthetic_canary');
    assert.match(report.expected_answer_sha256, /^[0-9a-f]{64}$/);
    assert.equal(report.callbacks, 1); assert.equal(report.native_hook_file_and_mcp_attested, true);
    assert.equal(report.semantic_canary_matches, true); assert.equal(report.answer_sha256, report.expected_answer_sha256);
    assert.equal(report.native_outcome, 'completed'); assert.equal(report.observation_after.supports_mcp, true);
  }
  return { artifact: receipt(file), scope: report.scope, status: report.status,
    verified_current: passed, generation_requests: report.generation_requests,
    callbacks: report.callbacks ?? null, native_acknowledged: report.native_acknowledged ?? null };
});
const mediaTypes = {}, modalities = {};
for (const engine of ['web','agentic']) {
  const observation = health.native_observations[engine];
  mediaTypes[engine] = [...new Set(currentNative.filter(value => value.engine === engine && value.verified).map(value => value.media_type))].sort();
  assert.deepEqual([...observation.verified_attachment_media_types].sort(), mediaTypes[engine], 'Final MIME cache lacks or overstates actual current canaries: ' + engine);
  modalities[engine] = {};
  for (const kind of ['image','pdf','audio']) {
    const passed = currentNative.some(value => value.engine === engine && value.kind === kind && value.verified);
    assert.equal(observation.verified_modalities.includes(kind), passed, 'Kind summary disagrees with exact formats: ' + engine + '/' + kind);
    modalities[engine][kind] = passed ? true : null;
  }
}
const mcpPassed = currentMcp.some(value => value.verified_current);
assert.equal(health.native_observations.agentic.supports_mcp, mcpPassed);
assert.equal(health.native_observations.web.supports_mcp, false);
const attempts = new Map(), observationOnly = [], earlierNative = [], textControls = [], webAudioFormatsAttempted = new Set();
for (const file of allPaths.filter(value => value.endsWith('.json') && value.includes('ai32-r02'))) {
  const report = read(file);
  if (!['individual_real_gemini_synthetic_native_canary','real_agentic_mcp_and_attachment_synthetic_canary',
    'real_gemini_web_text_control_no_attachments'].includes(report.scope)) continue;
  assert.equal(report.automatic_inference_retries, 0);
  assert.equal(report.credentials_logged, false); assert.equal(report.provider_response_text_stored, false);
  if (report.generation_requests === 0) { observationOnly.push({artifact:receipt(file),status:report.status,generation_requests:0}); continue; }
  assert.equal(report.generation_requests, 1); assert.equal(report.maximum_generations, 1);
  const probe = report.probe ?? report, id = probe.attempt_id;
  assert.match(id, /^[0-9a-f-]{36}$/); assert.equal(probe.native_acknowledged, true);
  const fingerprint = { engine: probe.engine ?? 'agentic', scope: report.scope,
    file_sha256: probe.file_sha256, expected_answer_sha256: probe.expected_answer_sha256,
    model_id: probe.model_id, configuration_generation: probe.configuration_generation,
    session_generation: probe.reference?.session_generation ?? probe.session_generation };
  if (attempts.has(id)) assert.deepEqual(attempts.get(id).fingerprint, fingerprint, 'One attempt changed semantic identity across retained projections.');
  else attempts.set(id, {fingerprint, artifact:receipt(file)});
  if (report.scope === 'real_gemini_web_text_control_no_attachments') {
    assert.equal(report.attachment_modalities_proved, false);
    assert.equal(report.harness_sha256, hash('docs/evidence/scripts/nodia-ai-ai32-r02-web-text-control.py'));
    assert.equal(report.native_harness_sha256, hash('docs/evidence/scripts/nodia-ai-ai32-r02-native-probe.py'));
    assert.match(probe.expected_answer_sha256, /^[0-9a-f]{64}$/);
    if (report.status === 'passed') {
      assert.equal(probe.engine, 'web'); assert.equal(probe.http_status, 200);
      assert.equal(probe.native_outcome, 'completed'); assert.equal(probe.semantic_control_matches, true);
      assert.equal(probe.answer_sha256, probe.expected_answer_sha256);
      assert.equal(probe.same_session_available_after, true);
    }
    textControls.push({artifact:receipt(file),attempt_id:id,status:report.status,
      semantic_control_matches:probe.semantic_control_matches??null,native_outcome:probe.native_outcome??null,
      native_acknowledged:probe.native_acknowledged,
      verified_current:report.status==='passed'&&exactCurrent(report,probe,'web'),
      attachment_modalities_proved:false});
  } else if (report.probe) {
    if (probe.engine === 'web' && probe.kind === 'audio') webAudioFormatsAttempted.add(probe.media_type);
    if (!descriptor.current_native_probe_paths.includes(file)) earlierNative.push({artifact:receipt(file),
      engine:probe.engine,kind:probe.kind,media_type:probe.media_type,attempt_id:id,status:report.status,
      semantic_canary_matches:probe.semantic_canary_matches??null,native_outcome:probe.native_outcome??null,
      native_acknowledged:probe.native_acknowledged,included_in_current_proof_matrix:false,
      final_session_and_selection_match:exactCurrent(report,probe,probe.engine)});
  }
}
assert(attempts.size >= currentNative.length + currentMcp.filter(value => value.generation_requests > 0).length,
  'Retain all distinct current generation attempts.');
assert.equal(attempts.size, 12, 'The completed R02 cycle retains ten native, one MCP and one text-control generation.');
assert.equal(currentNative.length, 4); assert.equal(earlierNative.length, 6); assert.equal(textControls.length, 1);
const result = {
  stage:'AI-32-R02', status:'private_lab_revalidation_with_explicit_acceptance_gates', documentary_approval:false,
  observed_at_utc:health.observed_at_utc, inputs:descriptor,
  history:{preserved_artifacts:historical, historical_sources_not_required_to_match_current_tree:true,
    failed_activation:{artifact:receipt(descriptor.node_activation_attempt_path),readiness_seconds:10,rollback_verified:true,
      correction:'deployment_readiness_45_seconds_no_provider_retry_or_application_timeout_change'}},
  current_runtime:{gemini_image:health.gemini_image,gemini_activation:receipt(descriptor.gemini_activation_path),
    node_activation:receipt(descriptor.node_activation_path),health:receipt(descriptor.final_health_path),
    native_sessions:health.native_sessions,native_sources:nativeSources.length,native_source_files:nativeSources,
    node_sources_checked:inventory.sourceChecksums.length,node_inventory:receipt(inventoryPath),
    compiled_dist_files:dist.length,package_files:nodeManifest.files.length,package_manifest:receipt(descriptor.node_package_manifest_path),
    package_archive:receipt(descriptor.node_package_archive_path),dist_tree_sha256:health.dist_tree_sha256,
    node_adapter_observation:{artifact:receipt(nodeObservationPath),source_files:observedDistPaths.length,
      configured_database_read_only:true,provider_generations:0,database_writes:0,
      exact_native_selection_and_MIME_projection_match:true},
    knowledge_release:health.knowledge_release,quiet:health.quiet,native_cleanup:health.native_cleanup,units:health.units,http:health.http,
    schema_changes:{migrations_applied:0,new_tables:0,new_columns:0}},
  tests:{python,unit,sql:{checks:sqlChecks,legacy_checks:33,attachment_regression_checks:58,invoice_regression_checks:44,
    legacy:receipt(descriptor.legacy_sql_path),regression:receipt(descriptor.sql_regression_path),
    configured_database_used:false,storage:'synthetic_private_port',provider_inference:false}},
  live:{current_native_modalities:modalities,current_verified_media_types:mediaTypes,current_native_probes:currentNative,
    current_mcp_probes:currentMcp,current_agentic_file_and_mcp_verified:mcpPassed,
    individual_r02_generation_attempts_preserved:attempts.size,attempt_ids:[...attempts.keys()].sort(),
    earlier_r02_native_probes:earlierNative,text_controls:textControls,observation_only_artifacts:observationOnly,automatic_inference_retries:0,business_writes:0,
    mcp_callback:'synthetic_read_callback_not_a_business_SQL_or_write_proof',physical_microphone_used:false},
  acceptance:{r2_configuration_present:health.r2_configuration_present,r2_data_path_verified:health.r2_data_path_verified,
    web_audio_formats:[...webAudioFormatsAttempted].sort().map(media_type=>({media_type,verified:mediaTypes.web.includes(media_type)?true:null})),
    physical_microphone_verified:false,productive_acceptance:false,approval:false,
    legacy_sql_and_recovery_verified:true,legacy_cloud_copy_verified:false,
    legacy_content_identity_limit:'Frozen persisted source key and invoice snapshot; externally overwriting immutable legacy keys is not detected before the confirmed GET'},
  artifacts,
};
if (checking) assert.deepEqual(saved,result,'R02 evidence, input artifacts or current sources drifted.');
else fs.writeFileSync(path.join(root,destination),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({stage:result.stage,status:'passed',artifacts:artifacts.length,native_sources:nativeSources.length,
  node_sources:inventory.sourceChecksums.length,compiled:dist.length,package_files:nodeManifest.files.length,
  tests:{server:unit.server.tests,client:unit.client.tests,python_linux:python.linux.passed,python_windows:python.windows.passed,sql:sqlChecks},
  current_verified_media_types:mediaTypes,generation_attempts:attempts.size,documentary_approval:false}));
