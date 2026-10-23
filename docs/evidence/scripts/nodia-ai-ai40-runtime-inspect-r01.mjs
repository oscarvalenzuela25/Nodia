// Bounded operator observation. No application bootstrap or native/account request.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
const current = process.cwd();
const require = createRequire(path.join(current, 'package.json'));
const cfg = require('dotenv').parse(fs.readFileSync(process.env.DOTENV_CONFIG_PATH));
const effective = { ...cfg, ...process.env };
const { DataSource } = require('typeorm');
let source;
try {
  source = new DataSource({ type: 'postgres', host: effective.POSTGRES_HOST,
    port: Number(effective.POSTGRES_PORT), database: effective.POSTGRES_DB,
    username: effective.POSTGRES_USER, password: effective.POSTGRES_PASSWORD,
    ssl: effective.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    synchronize: false, migrationsRun: false, logging: false,
    extra: { connectionTimeoutMillis: 5000, statement_timeout: 5000 } });
  await source.initialize();
  const rows = await source.transaction(async manager => {
    await manager.query('SET TRANSACTION READ ONLY');
    return manager.query(`SELECT p.id::text,c.key AS provider_key,p.is_active,
      p.use_token_plan_agentic,p.default_mode,p.updated_at,
      p.fields->'token_plan_agentic'->>'selected_model' AS selected_model,
      p.fields->'token_plan_agentic'->>'thinking_level' AS configured_effort,
      jsonb_array_length(COALESCE(p.fields->'token_plan_agentic'->'available_models','[]'::jsonb)) AS stored_model_count
      FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
      WHERE c.key='openai' ORDER BY p.id LIMIT 10`);
  });
  let native = null;
  try {
    const candidate = path.join(path.dirname(require.resolve('@openai/codex-linux-x64/package.json'))),
      binary = path.join(candidate, 'vendor', 'x86_64-unknown-linux-musl', 'bin', 'codex');
    const info = fs.statSync(binary);
    native = { exists: true, bytes: info.size,
      sha256: createHash('sha256').update(fs.readFileSync(binary)).digest('hex') };
  } catch { native = { exists: false }; }
  const profileRoot = effective.NODIA_CODEX_PROFILE_ROOT ?? path.join(os.homedir(), '.local', 'share', 'nodia', 'codex');
  console.log(JSON.stringify({ stage: 'AI40', status: 'observed_read_only',
    runtime: { enabled: effective.NODIA_CODEX_ENABLED === 'true',
      enabled_explicit: effective.NODIA_CODEX_ENABLED ?? null,
      profile_root: profileRoot, profile_root_exists: fs.existsSync(profileRoot), native },
    connections: rows, configured_SQL_writes: 0, provider_requests: 0,
    credential_values_emitted: false }));
} catch (error) {
  console.log(JSON.stringify({ stage: 'AI40', status: 'inspection_failed', error_type: error?.constructor?.name,
    sql_state: typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null,
    private_output_emitted: false }));
  process.exitCode = 1;
} finally { await source?.destroy(); }
