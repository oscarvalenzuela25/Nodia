// Readonly baseline and exact configured selection; no provider requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [runtime, candidate, previousBinding, output] = process.argv.slice(2);
assert.ok([runtime, candidate, previousBinding, output].every(path.isAbsolute));
const require = createRequire(path.join(candidate, 'package.json'));
require('reflect-metadata');
const { parse } = require('dotenv'), { DataSource } = require('typeorm');
const config = parse(fs.readFileSync(path.join(runtime, '.env')));
const old = JSON.parse(fs.readFileSync(previousBinding));
const source = await new DataSource({ type: 'postgres', host: config.POSTGRES_HOST, port: Number(config.POSTGRES_PORT),
  username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD, database: config.POSTGRES_DB,
  ssl: config.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  extra: { options: '-c default_transaction_read_only=on' }, synchronize: false, migrationsRun: false }).initialize();
const load = name => import(pathToFileURL(path.join(candidate, 'dist', name + '.js')).href);
const [{ projectNodiaAiConnection: project }, { GeminiNodiaAiAdapterUseCase: Adapter }] = await Promise.all([
  load('nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case'),
  load('nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case'),
]);
try {
  assert.equal((await source.query('SHOW default_transaction_read_only'))[0].default_transaction_read_only, 'on');
  const rows = await source.query(`SELECT p.id::text,p.name label,p.fields,p.updated_at,p.is_active,p.use_api_key,p.use_token_plan_web,p.use_token_plan_agentic,
    c.key provider_key,c.is_active catalog_active,c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE c.key='gemini' AND p.is_active AND c.is_active`);
  assert.equal(rows.length, 1);
  const selection = project(rows[0]).modes.find(m => m.mode === 'token_plan_agentic').configured_selection;
  assert.deepEqual(selection, old.selection);
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha(JSON.stringify(rows[0].fields.token_plan_agentic)), old.public_mode_configuration_sha256);
  await new Adapter(source, { request() { throw Error('No provider requests in baseline'); } }).verifyConfiguration(selection, old.configuration_generation);
  const [quiet] = await source.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots,
    (SELECT count(*)::int FROM nodia_ai_conversations WHERE id='33d6c32d-19a3-4533-8077-3ca7299d30cb') preserved_r05_chat`);
  assert.deepEqual(quiet, { pending_jobs: 0, open_attempts: 0, retained_slots: 0, preserved_r05_chat: 1 });
  const report = { stage: 'AI-36-C05-R02', scope: 'readonly_SQL_exact_configured_High_baseline', status: 'passed',
    observed_at_utc: new Date().toISOString(), selection, configuration_generation: old.configuration_generation,
    public_mode_configuration_sha256: old.public_mode_configuration_sha256, quiet,
    configured_SQL_writes: 0, provider_requests: 0, source_sha256: sha(fs.readFileSync(new URL(import.meta.url))) };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report));
} finally { await source.destroy(); }
