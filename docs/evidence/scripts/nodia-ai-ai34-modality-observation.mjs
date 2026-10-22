// Non-generative observation of the exact selections from the completed live canary.
// This does not rerun attachment inference or assume that a prior modality proof survives restart.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const runtime = '/opt/nodia/releases/nodia-server-ai15-20261016';
const priorPath = process.argv[2];
assert(priorPath && path.isAbsolute(priorPath));
const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
assert(['passed', 'failed'].includes(prior.status), 'The real canary must have finished first');
const require = createRequire(path.join(runtime, 'package.json'));
const config = require('dotenv').parse(fs.readFileSync(path.join(runtime, '.env')));
for (const [key, value] of Object.entries(config)) if (process.env[key] === undefined) process.env[key] = value;
process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL;
process.env.DOTENV_CONFIG_PATH = '/dev/null';
const load = file => import(pathToFileURL(path.join(runtime, 'dist', file + '.js')).href);
const { DataSource } = require('typeorm');
const [{ GeminiNodiaAiAdapterUseCase: Adapter }, { NodiaAiAdapterTransport: Transport }] = await Promise.all([load('nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case'), load('nodia-ai-adapter/nodia-ai-adapter.service')]);
const source = new DataSource({ type: 'postgres', host: config.POSTGRES_HOST, port: Number(config.POSTGRES_PORT), username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD, database: config.POSTGRES_DB, synchronize: false, logging: false, entities: [], extra: { max: 1, options: '-c default_transaction_read_only=on', statement_timeout: 15000 } });
try {
  await source.initialize();
  const adapter = new Adapter(source, new Transport());
  const observations = [];
  for (const probe of prior.probes ?? []) {
    assert(probe.selection && ['token_plan_web', 'token_plan_agentic'].includes(probe.selection.mode));
    const observed = await adapter.observe(probe.selection, AbortSignal.timeout(35000));
    const mediaTypes = observed.verifiedAttachmentMediaTypes ?? null;
    observations.push({ mode: probe.selection.mode, connection_id: probe.selection.connection_id, model_id: probe.selection.model_id, available: observed.available, supports_mcp: typeof observed.supportsMcp === 'boolean' ? observed.supportsMcp : null, observed_at: observed.observedAt.toISOString(), verified_modalities: observed.verifiedModalities ?? null, verified_attachment_media_types: mediaTypes, modality_cache_state: mediaTypes === null ? 'not_reported' : mediaTypes.length === 0 ? 'no_current_verified_formats' : 'reported_current_verified_formats', attachment_inference_repeated: false });
  }
  console.log(JSON.stringify({ stage: 'AI-34', scope: 'post_canary_non_generative_current_modality_observation', status: 'passed', observed_at_utc: new Date().toISOString(), observations, configured_database_writes: 0, provider_generations: 0, provider_metadata_requests: observations.length, storage_operations: 0, limitations: ['No image/PDF/audio inference was repeated; missing or empty proofs cannot be interpreted as available attachment support'] }, null, 2));
} finally { await source.destroy(); }
