// AI-32 R01 evidence is independent of the frozen AI-32 delivery.
// No services, provider calls, database access or evidence repair occur here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const destination = 'docs/evidence/nodia-ai-ai32-r01-validation.json';
const historicalPaths = [
  'docs/evidence/nodia-ai-ai32-native-validation.json',
  'docs/evidence/nodia-ai-ai32-native-diagnostics.json',
];
const citationFailurePath = 'docs/evidence/nodia-ai-ai32-r01-web-audio-wav-before-citation.json';
const safePath = value => {
  assert.equal(typeof value, 'string');
  const normalized = value.replaceAll('\\', '/');
  assert(!path.posix.isAbsolute(normalized) && !/^[a-z]:/i.test(normalized));
  assert.equal(path.posix.normalize(normalized), normalized);
  assert(!normalized.split('/').some(part => ['..', '.env', 'browser_profile', 'session_state'].includes(part)));
  assert(normalized.length > 0);
  return normalized;
};
const bytes = file => fs.readFileSync(path.join(root, safePath(file)));
const hash = file => crypto.createHash('sha256').update(bytes(file)).digest('hex');
const read = file => JSON.parse(bytes(file).toString('utf8').replace(/^\uFEFF/, ''));
const receipt = file => ({ path: safePath(file), sha256: hash(file) });
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const timestamp = value => { const result = Date.parse(value); assert(Number.isFinite(result)); return result; };
const argument = process.argv.indexOf('--descriptor');
const checking = process.argv.includes('--check');
const saved = checking ? read(destination) : null;
const descriptor = argument >= 0 ? read(safePath(process.argv[argument + 1])) : saved?.inputs;
assert(descriptor, 'Provide --descriptor <repository-relative JSON path> for the first reconciliation.');
const requiredKeys = ['artifact_paths', 'current_native_manifest_path', 'final_activation_path', 'final_health_path',
  'current_native_probe_paths', 'mcp_probe_paths', 'python_linux_log', 'python_windows_log'];
assert.deepEqual(Object.keys(descriptor).sort(), requiredKeys.sort());
for (const key of ['artifact_paths', 'current_native_probe_paths', 'mcp_probe_paths']) {
  assert(Array.isArray(descriptor[key]));
  assert.equal(new Set(descriptor[key]).size, descriptor[key].length);
  descriptor[key].forEach(safePath);
}
for (const key of requiredKeys.filter(key => !Array.isArray(descriptor[key]))) safePath(descriptor[key]);
const allPaths = [...new Set([...descriptor.artifact_paths, ...descriptor.current_native_probe_paths,
  ...descriptor.mcp_probe_paths, ...historicalPaths, citationFailurePath, descriptor.current_native_manifest_path,
  descriptor.final_activation_path, descriptor.final_health_path, descriptor.python_linux_log,
  descriptor.python_windows_log])].sort();
assert(!allPaths.includes(destination), 'The output cannot pin itself.');
const artifacts = allPaths.map(receipt);
const activation = read(descriptor.final_activation_path);
const health = read(descriptor.final_health_path);
assert.equal(health.gemini_image, activation.new_image);
assert.match(health.gemini_image, /^sha256:[0-9a-f]{64}$/);
assert.deepEqual(health.source_drift_files, []);
for (const key of ['pending_jobs', 'open_attempts', 'held_or_unknown_slots']) assert.equal(health.quiet[key], 0);
for (const key of ['unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
  'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories']) assert.equal(health.native_cleanup[key], 0);
assert(Object.values(health.units).length > 0 && Object.values(health.units).every(value => value === 'active'));
assert(Object.values(health.http).length > 0 && Object.values(health.http).every(value => value === 200));
for (const key of ['r2_configuration_present', 'r2_data_path_verified']) assert.equal(typeof health[key], 'boolean');
const manifest = read(descriptor.current_native_manifest_path);
assert(Object.keys(manifest).length > 0);
const sources = Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)).map(([file, expected]) => {
  assert.match(expected, /^[0-9a-f]{64}$/);
  const current = receipt('nodia-gemini-microservice/' + safePath(file));
  assert.equal(current.sha256, expected, 'Current source differs: ' + file);
  return current;
});
assert.equal(health.native_source_files_verified, sources.length);
if (health.native_manifest_sha256 !== undefined) assert.equal(health.native_manifest_sha256, hash(descriptor.current_native_manifest_path));
const tests = file => {
  const text = bytes(file).toString('utf8').replace(/\x1b\[[0-9;]*m/g, '');
  const counts = [...text.matchAll(/Ran (\d+) tests? in ([\d.]+)s/g)];
  assert.equal(counts.length, 1, 'Expected one completed Python suite in ' + file);
  const terminal = /\nOK(?: \(skipped=(\d+)\))?\s*$/.exec(text);
  assert(terminal, 'Python suite did not finish successfully: ' + file);
  const executed = Number(counts[0][1]), skipped = Number(terminal[1] ?? 0);
  assert(executed >= skipped);
  return { executed, passed: executed - skipped, skipped, elapsed_seconds: Number(counts[0][2]), log: receipt(file) };
};
const currentSession = engine => {
  const value = health.native_sessions[engine];
  const generation = typeof value === 'string' ? value : value.session_generation;
  assert.match(generation, /^[0-9a-f]{32}$/);
  return generation;
};
const selectionMatches = (report, probe, engine) => {
  const observation = health.native_observations[engine];
  const generation = probe.reference?.session_generation ?? probe.session_generation;
  return timestamp(report.observed_at_utc) >= timestamp(activation.observed_at_utc)
    && generation === currentSession(engine)
    && (!probe.reference?.resource_key || probe.reference.resource_key === observation.resource_key)
    && probe.model_id === observation.model_id
    && probe.effort_id === observation.effort_id
    && probe.configuration_generation === observation.configuration_generation;
};
const currentNative = descriptor.current_native_probe_paths.map(file => {
  const report = read(file), probe = report.probe;
  assert(probe && ['web', 'agentic'].includes(probe.engine));
  assert(['image', 'pdf', 'audio'].includes(probe.kind));
  assert.equal(report.automatic_inference_retries, 0);
  assert.equal(report.credentials_logged, false);
  assert.equal(report.provider_response_text_stored, false);
  assert.equal(probe.native_acknowledged, true);
  const exact = selectionMatches(report, probe, probe.engine);
  assert(exact, 'The declared current native evidence belongs to an earlier image/session/selection: ' + file);
  // `verified` in the live harness observes its kind-level cache. A previous
  // WAV success cannot prove that this later WebM canary matched its oracle.
  const passed = probe.verified === true && probe.semantic_canary_matches === true
    && probe.answer_sha256 === probe.expected_answer_sha256 && report.status === 'passed';
  if (passed) {
    assert.equal(probe.http_status, 200);
    assert.equal(probe.native_outcome, 'completed');
    assert.equal(probe.semantic_canary_matches, true);
    assert.equal(probe.answer_sha256, probe.expected_answer_sha256);
    assert(report.observation_after.verified_modalities.includes(probe.kind));
  }
  return { artifact: receipt(file), engine: probe.engine, kind: probe.kind, media_type: probe.media_type ?? null,
    attempt_id: probe.attempt_id, session_generation: currentSession(probe.engine), model_id: probe.model_id,
    effort_id: probe.effort_id, configuration_generation: probe.configuration_generation,
    verified: passed, cached_kind_verified: probe.cached_modality_verified ?? probe.verified,
    semantic_canary_matches: probe.semantic_canary_matches ?? null,
    native_outcome: probe.native_outcome ?? null, native_acknowledged: true };
});
const currentMcp = descriptor.mcp_probe_paths.map(file => {
  const report = read(file);
  assert.equal(report.automatic_inference_retries, 0);
  if (report.generation_requests > 0) assert.equal(report.native_acknowledged, true);
  const exact = report.attempt_id ? selectionMatches(report, report, 'agentic') : false;
  if (report.status === 'passed') {
    assert(exact, 'Successful MCP evidence belongs to an earlier image/session/selection: ' + file);
    assert(report.callbacks > 0);
    if (report.scope === 'real_agentic_mcp_and_attachment_synthetic_canary') {
      assert.equal(report.observation_after.supports_mcp, true);
      assert.equal(report.native_hook_file_and_mcp_attested, true);
      assert.equal(report.semantic_canary_matches, true);
      assert.equal(report.answer_sha256, report.expected_answer_sha256);
    } else {
      assert.equal(report.supports_mcp_after, true);
      assert.equal(report.attested, true);
      assert.equal(report.nonce_returned, true);
    }
  }
  return { artifact: receipt(file), scope: report.scope, status: report.status,
    generation_requests: report.generation_requests, verified_current: report.status === 'passed' && exact,
    native_acknowledged: report.native_acknowledged ?? null, callbacks: report.callbacks ?? null };
});
const modalities = {};
for (const engine of ['web', 'agentic']) {
  const observation = health.native_observations[engine];
  modalities[engine] = {};
  for (const kind of ['image', 'pdf', 'audio']) {
    const passed = currentNative.some(item => item.engine === engine && item.kind === kind && item.verified);
    assert.equal(observation.verified_modalities.includes(kind), passed, 'Final native health does not match exact current proof.');
    modalities[engine][kind] = passed ? true : null;
  }
}
const currentMcpPassed = currentMcp.some(item => item.verified_current);
assert.equal(health.native_observations.agentic.supports_mcp, currentMcpPassed);
const individualArtifacts = allPaths.filter(file => file.endsWith('.json')).flatMap(file => {
  const report = read(file);
  return report.stage === 'AI-32-R01' && report.probe?.attempt_id ? [{ file, report, probe: report.probe }] : [];
});
const earlier = individualArtifacts.filter(item => !descriptor.current_native_probe_paths.includes(item.file));
for (const item of individualArtifacts) {
  assert.equal(item.report.automatic_inference_retries, 0);
  assert.equal(item.report.generation_requests, 1);
  assert.equal(item.report.maximum_generations, 1);
  assert.equal(item.report.credentials_logged, false);
  assert.equal(item.report.provider_response_text_stored, false);
  assert.equal(item.probe.native_acknowledged, true);
}
const numericVoice = individualArtifacts.find(item => item.probe.expected_answer_sha256 === digest('the purple lantern is eleven')
  && item.probe.answer_sha256 === digest('the purple lantern is 11'));
assert(numericVoice, 'Preserve the independent numeric-versus-spelled voice oracle evidence.');
assert.equal(numericVoice.probe.verified, false);
const original = read(historicalPaths[0]), originalDiagnostic = read(historicalPaths[1]);
const invalidJsonObservation = originalDiagnostic.diagnostics.find(item => item.error_type === 'JSONDecodeError');
assert(invalidJsonObservation, 'Preserve the original malformed-response observation.');
const citationFailure = read(citationFailurePath);
const citationDiagnostic = citationFailure.diagnostics.find(item => item.error_type === 'JSONDecodeError');
const syntheticJson = JSON.stringify({ kind: 'answer', text: 'The purple lantern is glowing.' });
const syntheticSuffix = '[cite: 1]';
const reconstructedDigest = digest(syntheticJson + syntheticSuffix);
assert.equal(citationFailure.probe.expected_answer_sha256, digest('the purple lantern is glowing'));
assert.equal(citationFailure.probe.native_acknowledged, true);
assert.equal(citationFailure.probe.native_outcome, 'abandoned_unknown');
assert.equal(citationDiagnostic.reply_format.json_syntax.category, 'extra_data');
assert.equal(citationDiagnostic.reply_format.json_syntax.position, syntheticJson.length);
assert.equal(citationDiagnostic.reply_format.json_syntax.document_chars, syntheticJson.length + syntheticSuffix.length);
assert.equal(citationDiagnostic.reply_format.json_syntax.document_sha256, reconstructedDigest);
const uniqueAttempts = new Set(individualArtifacts.map(item => item.probe.attempt_id));
const earlierMcp = [];
for (const file of allPaths.filter(file => file.endsWith('.json'))) {
  const report = read(file);
  const r01 = report.stage === 'AI-32-R01' || file.includes('ai32-r01');
  if (r01 && report.scope?.includes('mcp') && report.generation_requests > 0 && report.attempt_id) {
    assert.equal(report.generation_requests, 1);
    assert.equal(report.automatic_inference_retries, 0);
    assert.equal(report.native_acknowledged, true);
    uniqueAttempts.add(report.attempt_id);
    if (!descriptor.mcp_probe_paths.includes(file)) earlierMcp.push({ artifact: receipt(file),
      scope: report.scope, status: report.status, callbacks: report.callbacks ?? null,
      native_acknowledged: true, current_runtime_proof: false });
  }
}
const result = { stage: 'AI-32-R01', status: 'private_lab_revalidation_acceptance_gates_explicit',
  documentary_approval: false, observed_at_utc: health.observed_at_utc, inputs: descriptor,
  current_runtime: { image: health.gemini_image, activation: receipt(descriptor.final_activation_path),
    health: receipt(descriptor.final_health_path), native_sessions: health.native_sessions,
    sources: sources.length, source_files: sources, quiet: health.quiet,
    native_cleanup: health.native_cleanup, units: health.units, http: health.http },
  python: { linux: tests(descriptor.python_linux_log), windows: tests(descriptor.python_windows_log) },
  live: { current_native_modalities: modalities, current_native_probes: currentNative,
    current_mcp_probes: currentMcp, current_agentic_mcp_verified: currentMcpPassed,
    current_agentic_file_and_mcp_verified: currentMcp.some(item => item.verified_current
      && item.scope === 'real_agentic_mcp_and_attachment_synthetic_canary'),
    individual_r01_generation_attempts_preserved: uniqueAttempts.size, automatic_inference_retries: 0,
    earlier_r01_native_probes: earlier.map(item => ({ artifact: receipt(item.file), engine: item.probe.engine,
      kind: item.probe.kind, status: item.report.status,
      cached_kind_verified: item.probe.cached_modality_verified ?? item.probe.verified,
      semantic_canary_matches: item.probe.semantic_canary_matches ?? null,
      native_outcome: item.probe.native_outcome ?? null,
      superseded_by_runtime_restart: !selectionMatches(item.report, item.probe, item.probe.engine) })),
    earlier_r01_mcp_probes: earlierMcp,
    historical_invalid_json: { evidence: receipt(historicalPaths[0]), diagnostics: receipt(historicalPaths[1]),
      preserved_status: original.status, exact_cause: 'undetermined_without_original_response',
      original_diagnostic_scope: originalDiagnostic.scope ?? null,
      original_observation: { phase: invalidJsonObservation.phase, error_type: invalidJsonObservation.error_type,
        text_bytes: invalidJsonObservation.reply_format.text_bytes,
        upstream_http_status: invalidJsonObservation.generation.http_status,
        upstream_eof_seen: invalidJsonObservation.generation.upstream_eof_seen },
      reproduced_in_preserved_r01_native_probes: individualArtifacts.some(item =>
        item.report.diagnostics?.some(diagnostic => diagnostic.error_type === 'JSONDecodeError')) },
    numeric_voice_oracle: { artifact: receipt(numericVoice.file), offline_provider_calls: 0,
      difference: 'digits_11_vs_spelled_eleven', expected_hash: digest('the purple lantern is eleven'),
      observed_hash_matches_numeric_variant: true, enables_modality: false },
    confirmed_web_citation_presentation: { artifact: receipt(citationFailurePath),
      cause: 'canonical_citation_after_complete_valid_json', valid_json_chars: syntheticJson.length,
      trailing_citation_chars: syntheticSuffix.length, whole_response_sha256: reconstructedDigest,
      offline_synthetic_reconstruction_matches_observed_digest: true, provider_calls_for_reconstruction: 0,
      raw_provider_response_retained: false, original_51_byte_failure_cause_remains_undetermined: true,
      local_normalization_scope: 'Web_only_canonical_bounded_citations_after_complete_strict_JSON' } },
  acceptance: { r2_configuration_present: health.r2_configuration_present,
    r2_data_path_verified: health.r2_data_path_verified, physical_microphone_verified: false,
    productive_acceptance: false, approval: false }, artifacts };
if (checking) assert.deepEqual(saved, result); else fs.writeFileSync(path.join(root, destination), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ stage: result.stage, current_native_sources: sources.length,
  python_linux: result.python.linux.executed, python_windows: result.python.windows.executed,
  current_native_modalities: modalities, current_agentic_mcp_verified: currentMcpPassed,
  individual_r01_generation_attempts_preserved: uniqueAttempts.size, documentary_approval: false }));
