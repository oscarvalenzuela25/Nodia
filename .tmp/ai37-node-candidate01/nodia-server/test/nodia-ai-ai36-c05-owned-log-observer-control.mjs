// Isolated transport controls: no Docker, configured SQL, provider, or account access.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import { startC05OwnedLogObserver, c05ObserverPolicySha } from './nodia-ai-ai36-c05-owned-log-observer.mjs';
const checks = [];
const config = { attempt_id: randomUUID(), parser_sha256: 'a'.repeat(64), expected_policy: { description: 'Prueba ñ', tools: [] } };
const secret = 'SYNTHETIC_PRIVATE_SENTINEL_DO_NOT_PERSIST';
function fakeProcess(kind) {
  return (command, args, options) => {
    assert.equal(command, 'docker'); assert.ok(args.includes('-I') && args.includes('-B') && args.includes('-i'));
    assert.deepEqual(options.env, { PATH: '/usr/local/bin:/usr/bin:/bin' });
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin = new Writable({ write(chunk, _encoding, done) {
      const message = JSON.parse(chunk.toString());
      const common = { schema_version: 1, attempt_id: config.attempt_id, parser_sha256: config.parser_sha256,
        expected_policy_sha256: c05ObserverPolicySha(config.expected_policy), observed_at_utc: new Date().toISOString() };
      if (message.kind === 'stop') {
        const result = { kind: 'result', ...common, state: 'stopped', reason: 'requested_stop', samples: [],
          bounded_log_reads: 0, maximum_read_bytes_per_window: 131072, raw_content_persisted: false,
          private_paths_emitted: false, provider_requests: 0, runtime_mutations: 0 };
        if (kind === 'extra') result.private_payload = secret;
        if (kind === 'category') result.samples.push({ observed_at_utc: common.observed_at_utc, elapsed_ms: 1,
          file_size_at_sample: 1, bytes_read: 1, byte_window_truncated: false, interpretation: 'text_indicator_not_verified_cause',
          transport_indicators: [], provider_error_indicators: [secret], http_statuses: [] });
        child.stdout.write(JSON.stringify(result) + '\n'); queueMicrotask(() => child.emit('close', 0));
      } else child.stdout.write(JSON.stringify({ kind: 'ready', ...common, baseline_directories: 0, baseline_marker_absent: true }) + '\n');
      done();
    } });
    return child;
  };
}
for (const kind of ['valid', 'extra', 'category', 'throwing_sink']) {
  let latest;
  const observer = await startC05OwnedLogObserver(config, '/tmp/nodia-ai-ai36-c05-observer.py', '/usr/bin/python', value => {
    latest = value; if (kind === 'throwing_sink') throw Error(secret);
  }, fakeProcess(kind));
  await observer.stop();
  assert.equal(latest.raw_output_persisted, false);
  assert.ok(!JSON.stringify(latest).includes(secret));
  if (['valid', 'throwing_sink'].includes(kind)) assert.equal(latest.result?.state, 'stopped');
  else { assert.equal(latest.state, 'diagnostic_unavailable'); assert.equal(latest.result, null); }
  checks.push(kind);
}
console.log(JSON.stringify({ stage: 'AI-36-C05', scope: 'synthetic_observer_process_transport_controls', status: 'passed',
  checks, actual_provider_generations: 0, configured_database_used: false, docker_invoked: false,
  source_sha256: createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
  observer_driver_sha256: createHash('sha256').update(fs.readFileSync(new URL('./nodia-ai-ai36-c05-owned-log-observer.mjs', import.meta.url))).digest('hex'),
}, null, 2));
