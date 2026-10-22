// GET-only private observation. No inference, settings mutation, or raw response export.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const runtime = '/opt/nodia/releases/nodia-server-ai15-20261016';
const require = createRequire(path.join(runtime, 'package.json'));
const config = require('dotenv').parse(fs.readFileSync(path.join(runtime, '.env')));
const selection = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).mcp_probe.selection;
const url = config.GEMINI_MICROSERVICE_URL.replace(/\/$/, '');
const text = value => typeof value === 'string' && value.length <= 256 && /^[A-Za-z0-9_.: ()/+-]+$/.test(value) ? value : null;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const observations = [];
for (const endpoint of ['/agentic/status', '/agentic/models', '/agentic/ready']) {
  const started = Date.now();
  try {
    const response = await fetch(url + endpoint, { method: 'GET', headers: { 'X-Nodia-Service-Token': config.GEMINI_SERVICE_TOKEN }, signal: AbortSignal.timeout(30000) });
    const value = await response.json();
    const item = { endpoint, http_status: response.status, elapsed_ms: Date.now() - started, available: typeof value.available === 'boolean' ? value.available : null, authenticated: typeof value.authenticated === 'boolean' ? value.authenticated : null, has_active_session: typeof value.has_active_session === 'boolean' ? value.has_active_session : null, reason: text(value.reason ?? value.error?.code), readiness_status: text(value.status), reported_model: text(value.model), configured_model: selection.model_id, configured_effort: selection.effort_id, configured_model_in_catalog: Array.isArray(value.models) ? value.models.some(model => model.id === selection.model_id) : null, catalog_count: Array.isArray(value.models) ? value.models.length : null, configured_catalog_entry: Array.isArray(value.models) ? value.models.filter(model => model.id === selection.model_id).map(model => ({ id: text(model.id), name: text(model.name) })) : null, quota_source: text(value.quota_source), quota_observed_at: number(value.quota_observed_at), quota: null };
    if (value.quota && typeof value.quota === 'object' && !Array.isArray(value.quota)) item.quota = Object.entries(value.quota).slice(0, 64).map(([id, bucket]) => ({ id: text(id), remaining_fraction: number(bucket.remaining_fraction), usage_percentage: number(bucket.usage_percentage), reset_at: text(bucket.reset_at), window: text(bucket.window), group: text(bucket.group), name: text(bucket.name), remaining: number(bucket.remaining), total: number(bucket.total) }));
    observations.push(item);
  } catch (error) { observations.push({ endpoint, elapsed_ms: Date.now() - started, error_type: text(error.name), http_status: null }); }
}
console.log(JSON.stringify({ stage: 'AI-34', scope: 'read_only_non_generative_agentic_status_catalog_quota', status: 'observed', observed_at_utc: new Date().toISOString(), observations, provider_generations: 0, provider_metadata_requests: observations.length, services_restarted: false, settings_changed: false, limitations: ['Authentication and catalog availability do not prove inference; quota buckets may not identify the exact selected model; missing values remain null'] }, null, 2));
