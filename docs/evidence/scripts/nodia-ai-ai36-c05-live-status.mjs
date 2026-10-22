// Official native status metadata only. Never emit account/model lists or raw bodies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
const [runtime, dependencies] = process.argv.slice(2);
assert.ok(path.isAbsolute(runtime) && path.isAbsolute(dependencies));
const require = createRequire(path.join(dependencies, 'package.json'));
const { parse } = require('dotenv');
const configuration = parse(fs.readFileSync(path.join(runtime, '.env')));
const url = new URL('/agentic/status', configuration.GEMINI_MICROSERVICE_URL);
assert.ok(['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname));
assert.match(configuration.GEMINI_SERVICE_TOKEN ?? '', /^[a-f0-9]{64}$/iu);
const started = performance.now();
const response = await fetch(url, { headers: { 'X-Nodia-Service-Token': configuration.GEMINI_SERVICE_TOKEN }, signal: AbortSignal.timeout(30000) });
const raw = await response.text(); assert.ok(Buffer.byteLength(raw) <= 131072);
const value = JSON.parse(raw); assert.equal(response.status, 200);
const fraction = number => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
const buckets = value.quota && typeof value.quota === 'object' && !Array.isArray(value.quota)
  ? Object.entries(value.quota).slice(0, 64).map(([key, item]) => ({
    bucket_id_sha256: createHash('sha256').update(key).digest('hex'),
    remaining_fraction: fraction(item?.remaining_fraction),
    reset_at: typeof item?.reset_at === 'string' && Number.isFinite(Date.parse(item.reset_at)) ? new Date(item.reset_at).toISOString() : null,
    applies_to_selected_model: null,
  })) : null;
console.log(JSON.stringify({ stage: 'AI-36-C05', scope: 'official_agentic_status_non_generative_safe_projection',
  observed_at_utc: new Date().toISOString(), http_status: response.status, elapsed_ms: performance.now() - started,
  available: typeof value.available === 'boolean' ? value.available : null,
  has_active_session: typeof value.has_active_session === 'boolean' ? value.has_active_session : null,
  reason: value.reason === null ? null : typeof value.reason === 'string' && /^[a-z][a-z0-9_]{0,127}$/u.test(value.reason) ? value.reason : 'unclassified_reason',
  quota_source: value.quota_source === 'agentic_cli' ? value.quota_source : null,
  quota_observed_at: typeof value.quota_observed_at === 'number' && Number.isFinite(value.quota_observed_at)
    ? new Date(value.quota_observed_at * 1000).toISOString() : null,
  quota_buckets: buckets, model_bucket_mapping: 'not_provided_by_this_status_contract',
  provider_generations: 0, native_metadata_requests: 1, raw_private_body_included: false,
  services_restarted: false, configured_SQL_writes: 0,
  source_sha256: createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
}, null, 2));
