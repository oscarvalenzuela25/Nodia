// Read-only SQL and the real non-generative observe contract; no dispatch/login/probe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
const [runtime, candidate] = process.argv.slice(2);
assert.ok(runtime && candidate && path.isAbsolute(runtime) && path.isAbsolute(candidate));
const require = createRequire(path.join(candidate, 'package.json'));
const { parse } = require('dotenv'), { DataSource } = require('typeorm');
require('reflect-metadata');
const config = parse(fs.readFileSync(path.join(runtime, '.env')));
const url = new URL(config.GEMINI_MICROSERVICE_URL);
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname));
assert.match(config.GEMINI_SERVICE_TOKEN ?? '', /^[a-f0-9]{64}$/iu);
process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL;
process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
process.env.DOTENV_CONFIG_PATH = '/dev/null'; process.env.NODE_ENV = 'test';
const sha = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const source = new DataSource({ type: 'postgres', host: config.POSTGRES_HOST,
  port: Number(config.POSTGRES_PORT), database: config.POSTGRES_DB,
  username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD,
  ssl: config.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  extra: { options: '-c default_transaction_read_only=on' }, synchronize: false, migrationsRun: false });
const report = { stage: 'AI-36-C05', scope: 'non_generative_high_low_exact_model_preflight',
  status: 'running', started_at_utc: new Date().toISOString(), configured_SQL_writes: 0,
  provider_generations: 0, services_restarted: false, storage_operations: 0,
  source_sha256: createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex') };
try {
  await source.initialize();
  const [readOnly] = await source.query('SHOW default_transaction_read_only');
  assert.equal(readOnly.default_transaction_read_only, 'on');
  const rows = await source.query(`SELECT p.id::text,p.fields->'token_plan_agentic' mode_fields,
    p.fields->'token_plan_agentic'->>'selected_model' model_id,
    COALESCE(p.fields->'token_plan_agentic'->'thinking_levels'->>(p.fields->'token_plan_agentic'->>'selected_model'),
    p.fields->'token_plan_agentic'->>'thinking_level') effort_id
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
    WHERE p.is_active AND c.is_active AND c.key='gemini' AND p.use_token_plan_agentic AND c.can_use_token_plan_agentic`);
  assert.equal(rows.length, 1, 'One exact configured Gemini Agentic connection');
  const row = rows[0];
  assert.ok(typeof row.model_id === 'string' && row.model_id.trim());
  const selection = { connection_id: row.id, mode: 'token_plan_agentic', model_id: row.model_id,
    effort_id: row.effort_id ?? null, auto_delegate_to_agentic: false };
  assert.equal(selection.effort_id, 'high', 'Stored selection must explicitly be High');
  const low = { ...selection, effort_id: 'low' };
  report.compare_input = { schema_version: 1, high_selection: selection, low_selection: low,
    public_mode_configuration_sha256: sha(row.mode_fields) };
  report.observations = [];
  const { GeminiNodiaAiAdapterUseCase: Adapter } = await import(pathToFileURL(path.join(candidate,
    'dist/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.js')));
  const { NodiaAiAdapterTransport: Transport } = await import(pathToFileURL(path.join(candidate,
    'dist/nodia-ai-adapter/nodia-ai-adapter.service.js')));
  const base = new Transport(); report.native_metadata_requests = 0;
  const transport = { request(target, ...args) {
    assert.equal(target, '/nodia-ai/agentic/observe', 'Only non-generative observe is permitted');
    report.native_metadata_requests++; return base.request(target, ...args);
  } };
  for (const current of [selection, low]) {
    const started = performance.now();
    const observed = await new Adapter(source, transport).observe(current, AbortSignal.timeout(35000));
    report.observations.push({ effort_id: current.effort_id, elapsed_ms: performance.now() - started,
      available: observed.available, supports_mcp: observed.supportsMcp,
      reason: observed.reason, source: observed.source, observed_at_utc: observed.observedAt.toISOString(),
      configuration_generation: observed.configurationGeneration,
      resource_key_sha256: sha(observed.resourceKey), session_generation_sha256: sha(observed.sessionGeneration),
      adapter_contract_version: observed.adapterContractVersion });
    assert.ok(observed.available, 'CLI must accept exact model with requested effort');
    if (current === selection) assert.ok(observed.supportsMcp, 'Stored High proof must remain available');
  }
  assert.equal(report.observations[0].configuration_generation, report.observations[1].configuration_generation);
  assert.equal(report.observations[0].resource_key_sha256, report.observations[1].resource_key_sha256);
  assert.equal(report.observations[0].session_generation_sha256, report.observations[1].session_generation_sha256);
  const [after] = await source.query(`SELECT fields->'token_plan_agentic' mode_fields FROM ai_providers WHERE id=$1`, [row.id]);
  assert.equal(sha(after.mode_fields), report.compare_input.public_mode_configuration_sha256);
  report.interpretation = 'CLI model-command acceptance only; no generative effort effectiveness or Low MCP proof inferred';
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.safe_failure_code = typeof error?.code === 'string' && /^[a-z][a-z0-9_]{0,127}$/u.test(error.code)
    ? error.code : 'preflight_assertion_or_invalid_observation';
} finally {
  if (source.isInitialized) await source.destroy();
  report.finished_at_utc = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
}
if (report.status !== 'passed') process.exitCode = 1;
