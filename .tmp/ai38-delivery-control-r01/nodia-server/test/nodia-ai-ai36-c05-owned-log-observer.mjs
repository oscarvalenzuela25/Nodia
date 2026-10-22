// Supplemental operator-owned reader. It never sends a provider request or alters native outcomes.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';

export function c05ObserverPolicySha(value) {
  const canonical = item => Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object'
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
  const ascii = JSON.stringify(canonical(value)).replace(/[\u0080-\uffff]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
  return createHash('sha256').update(ascii).digest('hex');
}

export async function startC05OwnedLogObserver(config, script, python, onObservation, spawnProcess = spawn) {
  assert.match(script, /^\/tmp\/nodia-ai-ai36-c05-[a-z0-9_.-]+\.py$/u);
  assert.ok(typeof python === 'string' && /^\/[a-zA-Z0-9_./-]+$/u.test(python) && !python.includes('..'));
  const started = performance.now();
  const observation = { attempt_id: config.attempt_id, state: 'starting',
    started_at_utc: new Date().toISOString(), ready: null, result: null,
    stdout_bytes: 0, stderr_bytes: 0, raw_output_persisted: false };
  const notify = () => { try { onObservation(observation); } catch { /* Supplemental evidence never controls native work. */ } };
  notify();
  let resolveReady, resolveClosed, closed = false, pending = '';
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const exited = new Promise(resolve => { resolveClosed = resolve; });
  const child = spawnProcess('docker', ['exec', '-i', '--user', '10001:10001', 'nodia-gemini-microservice',
    'env', '-i', 'PATH=/usr/local/bin:/usr/bin:/bin', 'HOME=/tmp', python, '-I', '-B', script],
  { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: '/usr/local/bin:/usr/bin:/bin' } });
  const rejectMessage = () => { observation.state = 'diagnostic_unavailable'; observation.reason = 'observer_invalid_output'; notify(); };
  child.stdout.on('data', chunk => {
    observation.stdout_bytes += chunk.length;
    if (observation.stdout_bytes > 262144) { rejectMessage(); return; }
    pending += chunk.toString('utf8');
    let boundary;
    while ((boundary = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, boundary); pending = pending.slice(boundary + 1);
      try {
        assert.ok(Buffer.byteLength(line) <= 131072);
        const value = JSON.parse(line);
        assert.equal(value.schema_version, 1); assert.equal(value.attempt_id, config.attempt_id);
        assert.ok(['ready', 'result'].includes(value.kind));
        assert.equal(value.parser_sha256, config.parser_sha256);
        assert.equal(value.expected_policy_sha256, c05ObserverPolicySha(config.expected_policy));
        const allowed = value.kind === 'ready'
          ? ['kind', 'schema_version', 'attempt_id', 'baseline_directories', 'baseline_marker_absent', 'parser_sha256', 'expected_policy_sha256', 'observed_at_utc']
          : ['kind', 'schema_version', 'attempt_id', 'state', 'reason', 'observed_at_utc', 'samples', 'parser_sha256', 'expected_policy_sha256', 'bounded_log_reads', 'maximum_read_bytes_per_window', 'raw_content_persisted', 'private_paths_emitted', 'provider_requests', 'runtime_mutations'];
        assert.deepEqual(Object.keys(value).sort(), allowed.sort());
        if (value.kind === 'ready') {
          assert.equal(value.baseline_directories, 0); assert.equal(value.baseline_marker_absent, true);
          observation.ready = value; observation.ready_elapsed_ms = performance.now() - started;
          observation.state = 'ready'; resolveReady(true);
        } else {
          assert.ok(['stopped', 'rejected'].includes(value.state));
          assert.ok(typeof value.reason === 'string' && /^[a-z][a-z0-9_]{0,63}$/u.test(value.reason));
          assert.ok(Array.isArray(value.samples) && value.samples.length <= 128);
          assert.equal(value.raw_content_persisted, false); assert.equal(value.private_paths_emitted, false);
          assert.equal(value.provider_requests, 0); assert.equal(value.runtime_mutations, 0);
          for (const sample of value.samples) {
            assert.deepEqual(Object.keys(sample).sort(), ['observed_at_utc', 'elapsed_ms', 'file_size_at_sample', 'bytes_read',
              'byte_window_truncated', 'interpretation', 'transport_indicators', 'provider_error_indicators', 'http_statuses'].sort());
            assert.equal(sample.interpretation, 'text_indicator_not_verified_cause');
            assert.ok(Number.isSafeInteger(sample.bytes_read) && sample.bytes_read >= 0 && sample.bytes_read <= 131072);
            assert.ok(Array.isArray(sample.transport_indicators) && sample.transport_indicators.every(item =>
              ['context_deadline', 'io_timeout', 'tls_timeout', 'dns_failure', 'connection_refused', 'network_unreachable'].includes(item)));
            assert.ok(Array.isArray(sample.provider_error_indicators) && sample.provider_error_indicators.every(item =>
              ['RESOURCE_EXHAUSTED', 'UNAUTHENTICATED', 'PERMISSION_DENIED', 'DEADLINE_EXCEEDED'].includes(item)));
            assert.ok(Array.isArray(sample.http_statuses) && sample.http_statuses.every(item =>
              [400, 401, 403, 404, 408, 409, 425, 429, 500, 502, 503, 504].includes(item)));
          }
          observation.result = value; observation.state = value.state;
        }
        notify();
      } catch { rejectMessage(); }
    }
  });
  child.stderr.on('data', chunk => { observation.stderr_bytes += chunk.length; });
  child.stdin.on('error', () => {});
  child.on('error', () => {
    observation.state = 'diagnostic_unavailable'; observation.reason = 'observer_launch_failed';
    resolveReady(false); notify();
  });
  child.on('close', code => {
    closed = true; observation.exit_code = code;
    observation.finished_at_utc = new Date().toISOString(); observation.elapsed_ms = performance.now() - started;
    if (!observation.result) { observation.state = 'diagnostic_unavailable'; observation.reason ??= 'observer_closed_without_result'; }
    resolveReady(false); resolveClosed(); notify();
  });
  child.stdin.write(JSON.stringify(config) + '\n');
  const timer = setTimeout(() => resolveReady(false), 2000);
  await ready; clearTimeout(timer);
  if (!observation.ready) {
    observation.state = 'diagnostic_unavailable'; observation.reason ??= 'observer_ready_timeout'; notify();
  }
  return { observation, async stop() {
    if (!closed) child.stdin.write(JSON.stringify({ kind: 'stop', attempt_id: config.attempt_id }) + '\n');
    let timeout;
    await Promise.race([exited, new Promise(resolve => { timeout = setTimeout(resolve, 2500); })]);
    clearTimeout(timeout);
    if (!closed) {
      observation.state = 'diagnostic_unavailable'; observation.reason = 'observer_stop_not_yet_acknowledged'; notify();
    }
  } };
}
