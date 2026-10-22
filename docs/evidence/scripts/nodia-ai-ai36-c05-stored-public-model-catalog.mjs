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
const report = { stage: 'AI-36-C05', scope: 'non_generative_exact_configuration_preflight',
  status: 'running', started_at_utc: new Date().toISOString(), configured_SQL_writes: 0,
  provider_generations: 0, services_restarted: false, storage_operations: 0,
  source_sha256: createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex') };
try {
  await source.initialize();
  const [readOnly] = await source.query('SHOW default_transaction_read_only');
  assert.equal(readOnly.default_transaction_read_only, 'on');
  report.scope = 'stored_public_model_catalog_SQL_readonly_not_live_availability';
  report.catalog = await source.query(`SELECT p.id::text connection_id,
    p.fields->'token_plan_agentic'->>'selected_model' configured_model_id,
    entry->>'id' model_id, entry->>'name' name,
    entry->>'displayName' display_name
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
    CROSS JOIN LATERAL jsonb_array_elements(p.fields->'token_plan_agentic'->'available_models') entry
    WHERE p.id=2 AND c.key='gemini' ORDER BY entry->>'id'`);
  assert.ok(report.catalog.length > 0 && report.catalog.length <= 512);
  report.catalog.forEach(row => {
    assert.ok(typeof row.model_id === 'string' && row.model_id.length <= 1024);
    for (const value of [row.name, row.display_name]) assert.ok(value === null || typeof value === 'string' && value.length <= 1024);
  });
  report.catalog_interpretation = 'Persisted discovered IDs/names only; current availability, effort support, MCP proof and model equivalence not inferred';
  report.provider_metadata_requests = 0;
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.safe_failure_code = 'catalog_read_or_validation_failed';
} finally {
  if (source.isInitialized) await source.destroy();
  report.finished_at_utc = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
}
if (report.status !== 'passed') process.exitCode = 1;
