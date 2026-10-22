// Non-generative inventory of current mode/format gates, after retaining the qualified R05 candidate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const [runtime, candidate] = process.argv.slice(2);
assert.ok(runtime && candidate && path.isAbsolute(runtime) && path.isAbsolute(candidate));
const require = createRequire(path.join(candidate, 'package.json'));
require('reflect-metadata');
const { parse } = require('dotenv'), { DataSource } = require('typeorm');
const config = parse(fs.readFileSync(path.join(runtime, '.env')));
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(new URL(config.GEMINI_MICROSERVICE_URL).hostname));
process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL;
process.env.DOTENV_CONFIG_PATH = '/dev/null';
const load = file => import(pathToFileURL(path.join(candidate, 'dist', file + '.js')).href);
const [{ GeminiNodiaAiAdapterUseCase: Adapter }, { NodiaAiAdapterTransport: Transport }, { projectNodiaAiConnection: project }] = await Promise.all([
  load('nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case'), load('nodia-ai-adapter/nodia-ai-adapter.service'),
  load('nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case'),
]);
const source = await new DataSource({ type: 'postgres', host: config.POSTGRES_HOST, port: Number(config.POSTGRES_PORT),
  username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD, database: config.POSTGRES_DB,
  ssl: config.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  extra: { options: '-c default_transaction_read_only=on' }, synchronize: false, migrationsRun: false }).initialize();
try {
  const [readOnly] = await source.query('SHOW default_transaction_read_only'); assert.equal(readOnly.default_transaction_read_only, 'on');
  const [quiet] = await source.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`);
  assert.ok(Object.values(quiet).every(value => value === 0));
  const rows = await source.query(`SELECT p.id::text,p.name label,p.fields,p.updated_at,p.is_active,p.use_api_key,p.use_token_plan_web,p.use_token_plan_agentic,
    c.key provider_key,c.is_active catalog_active,c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE c.key='gemini' AND p.is_active AND c.is_active`);
  assert.equal(rows.length, 1);
  const observations = [], adapter = new Adapter(source, new Transport());
  for (const mode of project(rows[0]).modes.filter(mode => ['token_plan_web', 'token_plan_agentic'].includes(mode.mode))) {
    if (!mode.configured_selection) { observations.push({ mode: mode.mode, selection: null, state: 'unconfigured' }); continue; }
    const selection = mode.configured_selection;
    const value = await adapter.observe(selection, AbortSignal.timeout(35000));
    observations.push({ selection, available: value.available, reason: value.reason, supports_mcp: value.supportsMcp,
      observed_at_utc: value.observedAt.toISOString(), configuration_generation: value.configurationGeneration,
      session_generation_sha256: createHash('sha256').update(value.sessionGeneration).digest('hex'),
      verified_modalities: value.verifiedModalities ?? null, verified_attachment_media_types: value.verifiedAttachmentMediaTypes ?? null });
  }
  console.log(JSON.stringify({ stage: 'AI-36-C05', scope: 'post_R05_qualified_candidate_retained_current_mode_gates_non_generative', status: 'passed',
    observed_at_utc: new Date().toISOString(), source_sha256: createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
    observations, quiet, configured_SQL_writes: 0, provider_generations: 0, metadata_requests: observations.filter(value => value.selection).length,
    modality_canaries_executed: 0, services_restarted: false }, null, 2));
} finally { await source.destroy(); }
