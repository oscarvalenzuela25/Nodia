// Derive bounded structural timings from one preserved real-provider report.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const [input, output] = process.argv.slice(2);
assert.ok(input && output && !fs.existsSync(output));
const bytes = fs.readFileSync(input), report = JSON.parse(bytes);
assert.equal(report.stage, 'AI-36-C05');
assert.equal(report.synthetic_provider_transport, false);
const delta = (end, start) => typeof end === 'number' && typeof start === 'number' ? end - start : null;
const generations = report.turns.flatMap(turn => turn.generations.map(generation => {
  const trace = report.native_transport_observations[generation.attempt_id];
  const first = trace.transitions.find(item => item.kind === 'start' && item.direction === 'request_started');
  const accepted = trace.transitions.find(item => item.kind === 'start' && item.running);
  const finished = report.runtime_timings.find(item => item.kind === 'execute' && item.attempt_id === generation.attempt_id)?.finished;
  const callbacks = generation.callbacks.map(callback => {
    const response = trace.transitions.find(item => item.kind === 'mcp/results' && item.call_id === callback.call_id && item.accepted);
    return { name: callback.name, call_id: callback.call_id, status: callback.status,
      requested_at_utc: callback.requested_at_utc, completed_at_utc: callback.completed_at_utc,
      start_to_callback_request_ms: delta(callback.requested_monotonic_ms, first?.monotonic_ms),
      handler_elapsed_ms: delta(callback.completed_monotonic_ms, callback.requested_monotonic_ms),
      result_accepted_at_utc: response?.at_utc ?? null,
      result_submit_elapsed_ms: response?.elapsed_ms ?? null,
      result_accepted_to_terminal_ms: generation.terminal_proof_received
        ? delta(generation.finished_monotonic_ms, response?.monotonic_ms) : null,
      result_accepted_to_execute_exit_ms: delta(finished?.monotonic_ms, response?.monotonic_ms) };
  });
  return { turn: turn.label, run_id: turn.run_id, run_state: turn.state,
    attempt_id: generation.attempt_id, phase: generation.phase,
    started_at_utc: first?.at_utc ?? null, accepted_start_at_utc: accepted?.at_utc ?? null,
    native_start_request_ms: delta(accepted?.monotonic_ms, first?.monotonic_ms),
    execute_elapsed_ms: delta(finished?.monotonic_ms, generation.started_monotonic_ms),
    terminal_proof_received: generation.terminal_proof_received,
    terminal_proof_sha256: generation.terminal_proof_sha256 ?? null,
    terminal_proof_outcome: generation.terminal_proof_outcome ?? null,
    process_closed: generation.process_closed ?? null,
    callbacks, native_ACK: report.native_terminal_ACKs.find(item => item.attempt_id === generation.attempt_id) ?? null,
    latest_poll: trace.latest_poll, request_counts: trace.request_counts,
    response_counts: trace.response_counts, failed_counts: trace.failed_counts };
}));
const result = { stage: 'AI-36-C05', scope: 'derived_structural_monotonic_intervals_no_causal_attribution',
  source_report_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  source_completed_at_utc: report.finished_at_utc, provider_generations: report.actual_provider_generations,
  runtime_timings: report.runtime_timings, generations, provider_requests_for_derivation: 0 };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, generations: generations.length,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex') }));
