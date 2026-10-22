// Metadata-only wrapper of the existing exact-selection AI15 MCP canary.
// It never supplies another prompt/tool, model, effort, proof or generation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { parse } from 'dotenv';

assert.equal(process.env.NODIA_AI_ALLOW_LIVE, 'yes');
const output = process.env.NODIA_AI_C05_ROLE_CANARY_REPORT;
const bindingFile = process.env.NODIA_AI_C05_ROLE_CANDIDATE_BINDING;
assert.ok(output && bindingFile && path.isAbsolute(output) && path.isAbsolute(bindingFile));
assert.equal(fs.existsSync(output), false, 'Preserve each canary receipt');
const binding = JSON.parse(fs.readFileSync(bindingFile, 'utf8'));
assert.match(binding.candidate_image_id, /^sha256:[a-f0-9]{64}$/u);
assert.ok(binding.legacy_native_source_fingerprint_sha256 && binding.public_mode_configuration_sha256);
const config = parse(fs.readFileSync(process.env.NODIA_AI_LAB_API_ENV));
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(new URL(config.GEMINI_MICROSERVICE_URL).hostname));
process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL.replace(/\/+$/, '');
process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
process.env.DOTENV_CONFIG_PATH = '/dev/null';
process.env.NODE_ENV = 'test';
const { NodiaAiAdapterTransport } = await import('../dist/nodia-ai-adapter/nodia-ai-adapter.service.js');
const sha = value => createHash('sha256').update(Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const stamp = () => ({ at_utc: new Date().toISOString(), monotonic_ms: performance.now() });
const report = { stage: 'AI-36-C05-R01', scope: 'legacy_b110_restoration_single_exact_configured_MCP_probe_not_capability_acceptance',
  status: 'running', started_at_utc: new Date().toISOString(), maximum_native_start_requests: 1,
  native_start_requests: 0, accepted_native_starts: 0, real_provider_generations: 0,
  generation_count_scope: 'native_accepted_MCP_start_requests_not_token_or_billing_measurement',
  automatic_inference_retries: 0, capability_acceptance: false, business_effects: 0,
  configured_SQL_writes: 0, configured_selection_modified: false,
  image_binding: binding, image_binding_file_sha256: sha(fs.readFileSync(bindingFile)),
  source_sha256: sha(fs.readFileSync(new URL(import.meta.url))),
  existing_canary_source_sha256: sha(fs.readFileSync(new URL('./nodia-ai-ai15-live-attest.mjs', import.meta.url))),
  request_events: [], proofs: [], acknowledgements: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const original = NodiaAiAdapterTransport.prototype.request;
NodiaAiAdapterTransport.prototype.request = async function (target, payload, signal, dispatch) {
  const kind = target.split('/').at(-1);
  const measured = ['start', 'results', 'attest', 'cancel', 'reconcile', 'acknowledge'].includes(kind);
  const event = measured ? { kind, started: stamp() } : null;
  if (event) { report.request_events.push(event); save(); }
  if (kind === 'start') {
    assert.equal(++report.native_start_requests, 1, 'One canary, no replay');
    assert.equal(payload.diagnostic, true);
    assert.equal(payload.model_id, binding.selection.model_id);
    assert.equal(payload.effort_id, binding.selection.effort_id);
    assert.equal(payload.configuration_generation, binding.configuration_generation);
    report.attempt_id = payload.attempt_id;
    report.selection = { model_id: payload.model_id, effort_id: payload.effort_id };
    report.configuration_generation = payload.configuration_generation;
    report.native_timeout_seconds = payload.timeout_seconds;
    report.canonical_prompt_sha256 = sha(payload.canonical_prompt);
    report.tools_sha256 = sha(payload.tools);
    report.resource_key_sha256 = sha(payload.resource_key);
    report.session_generation_sha256 = sha(payload.session_generation);
    report.native_start_payload_sha256 = sha(payload);
    save();
  }
  try {
    const value = await original.call(this, target, payload, signal, dispatch);
    if (event) { event.finished = stamp(); event.returned = true; }
    if (kind === 'start' && value?.state === 'running' && value.attempt_id === report.attempt_id) {
      report.accepted_native_starts++; report.real_provider_generations++;
    }
    for (const item of value?.events ?? []) {
      if (item.kind === 'tool_request') {
        report.fixture_callbacks_observed = (report.fixture_callbacks_observed ?? 0) + 1;
      }
      const proof = item.terminal_proof;
      if (proof) report.proofs.push({ attempt_id: proof.attempt_id,
        terminal_proof_sha256: sha(proof.terminal_proof_id), outcome: proof.outcome,
        process_closed: proof.process_closed, observed_at_utc: proof.observed_at });
    }
    if (kind === 'reconcile' && value?.terminal_proof_id) {
      report.proofs.push({ attempt_id: value.attempt_id, terminal_proof_sha256: sha(value.terminal_proof_id),
        outcome: value.outcome, process_closed: value.process_closed, observed_at_utc: value.observed_at });
    }
    if (kind === 'attest') report.attestation = { verified: value?.verified === true,
      adapter_contract_version: value?.adapter_contract_version };
    if (kind === 'acknowledge') report.acknowledgements.push({ attempt_id: target.split('/')[4],
      terminal_proof_sha256: sha(payload.terminal_proof_id), acknowledged: value?.acknowledged === true });
    save();
    return value;
  } catch (error) {
    if (event) { event.finished = stamp(); event.returned = false; }
    save();
    throw error;
  }
};
try {
  await import(new URL('./nodia-ai-ai15-live-attest.mjs', import.meta.url).href);
  const accepted = JSON.parse(fs.readFileSync(process.env.NODIA_AI_LAB_REPORT_JSON, 'utf8'));
  report.existing_canary_report_sha256 = sha(fs.readFileSync(process.env.NODIA_AI_LAB_REPORT_JSON));
  report.existing_canary_status = accepted.status;
  report.native_pending_identity = accepted.native_pending_identity;
  assert.equal(accepted.status, 'passed');
  assert.equal(typeof accepted.supports_mcp_before, 'boolean', 'Record the observed baseline gate without transferring a proof');
  assert.equal(accepted.native_pending_identity, false);
  assert.equal(report.accepted_native_starts, 1);
  assert.equal(report.fixture_callbacks_observed, 1);
  assert.equal(report.attestation?.verified, true);
  assert.equal(report.proofs.length, 1);
  assert.equal(report.proofs[0].outcome, 'completed');
  assert.equal(report.proofs[0].process_closed, true);
  assert.deepEqual(report.acknowledgements, [{ attempt_id: report.proofs[0].attempt_id,
    terminal_proof_sha256: report.proofs[0].terminal_proof_sha256, acknowledged: true }]);
  assert.equal(report.attempt_id, report.proofs[0].attempt_id);
  report.status = 'passed';
} catch {
  report.status = 'failed'; process.exitCode = 1;
} finally {
  NodiaAiAdapterTransport.prototype.request = original;
  report.finished_at_utc = new Date().toISOString(); save();
}
