// SQL readonly snapshot for the original AI15 canary; no observe or generation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [runtime, candidate, outputDirectory, baselineFile, rolePolicy] = process.argv.slice(2);
assert.ok([runtime, candidate, outputDirectory, baselineFile].every(path.isAbsolute));
assert.match(rolePolicy, /^[a-f0-9]{64}$/u);
const require = createRequire(path.join(candidate, 'package.json'));
require('reflect-metadata');
const { parse } = require('dotenv'), { DataSource } = require('typeorm');
const config = parse(fs.readFileSync(path.join(runtime, '.env')));
const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
const previous = baseline.observations.find(v => v.selection?.mode === 'token_plan_agentic');
assert.equal(previous.available, true);
const source = await new DataSource({ type: 'postgres', host: config.POSTGRES_HOST, port: Number(config.POSTGRES_PORT),
  username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD, database: config.POSTGRES_DB,
  ssl: config.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  extra: { options: '-c default_transaction_read_only=on' }, synchronize: false, migrationsRun: false }).initialize();
const { projectNodiaAiConnection: project } = await import(pathToFileURL(path.join(candidate, 'dist/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.js')).href);
try {
  assert.equal((await source.query('SHOW default_transaction_read_only'))[0].default_transaction_read_only, 'on');
  const rows = await source.query(`SELECT p.id::text,p.name label,p.fields,p.updated_at,p.is_active,p.use_api_key,p.use_token_plan_web,p.use_token_plan_agentic,
    c.key provider_key,c.is_active catalog_active,c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE c.key='gemini' AND p.is_active AND c.is_active`);
  assert.equal(rows.length, 1);
  const selection = project(rows[0]).modes.find(m => m.mode === 'token_plan_agentic').configured_selection;
  assert.deepEqual(selection, previous.selection, 'No model or effort replacement');
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const snapshot = { rows: [{ provider_key: 'gemini', is_active: true, connection_id: selection.connection_id,
    agentic_model: selection.model_id, agentic_effort: selection.effort_id }] };
  const binding = { schema_version: 1,
    candidate_image_id: 'sha256:3f004c6c170ea79d16a544a788a5189f3afc17d3d68d465cb5092c3099cd0404',
    role_policy_sha256: rolePolicy, public_mode_configuration_sha256: sha(JSON.stringify(rows[0].fields.token_plan_agentic)),
    configuration_generation: previous.configuration_generation, selection,
    baseline_observation_sha256: sha(fs.readFileSync(baselineFile)),
    scope: 'exact_current_configured_High_native_owned_role_no_old_proof_transfer' };
  fs.writeFileSync(path.join(outputDirectory, 'selection.json'), JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(outputDirectory, 'binding.json'), JSON.stringify(binding, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'passed', selection, binding, configured_SQL_writes: 0, provider_generations: 0 }));
} finally { await source.destroy(); }
