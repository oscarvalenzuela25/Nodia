// Real native observations only. No generations, chat writes, credentials or provider bodies in the report.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'dotenv';
assert.equal(process.env.NODIA_AI_ALLOW_LIVE, 'yes');
const config = parse(fs.readFileSync(process.env.NODIA_AI_LAB_API_ENV));
const base = new URL(config.GEMINI_MICROSERVICE_URL);
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(base.hostname));
assert.match(config.GEMINI_SERVICE_TOKEN ?? '', /^[a-f0-9]{64}$/i);
process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL.replace(/\/+$/, '');
process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
process.env.DOTENV_CONFIG_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
const { GeminiService } = await import('../dist/common/ai/gemini.service.js');
const nativeFetch = globalThis.fetch, requests = [];
globalThis.fetch = async function (input, init) {
  const url = new URL(input);
  assert.equal(url.origin, base.origin, 'Native observations may contact only the configured private origin');
  const started = performance.now();
  const response = await nativeFetch(input, init);
  requests.push({ path: url.pathname, status: response.status, elapsed_ms: Math.round(performance.now() - started) });
  return response;
};
try {
  const native = new GeminiService();
  const engines = await native.getDualEngineStatus(AbortSignal.timeout(15000));
  const agentic = await native.getModelsAndQuota('agentic', AbortSignal.timeout(15000));
  const shape = (value) => ({ available: typeof value?.available === 'boolean' ? value.available : null, authenticated: typeof value?.authenticated === 'boolean' ? value.authenticated : null, model_count: Array.isArray(value?.models) ? value.models.length : null });
  const report = { task: 'AI-15', scope: 'native_gemini_observations_without_generation', provider_inferences: 0, configured_database_modified: false, native_requests: requests, engines: engines ? { agentic: shape(engines.agentic) } : null, agentic: shape(agentic), configured_url_trailing_slash_removed_in_driver: true };
  if (process.env.NODIA_AI_LAB_REPORT_JSON) fs.writeFileSync(process.env.NODIA_AI_LAB_REPORT_JSON, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { globalThis.fetch = nativeFetch; }
