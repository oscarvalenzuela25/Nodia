// Read-only schema/snapshot revision metadata. No messages, summaries, secrets, or business data.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('/opt/nodia/releases/nodia-server-ai15-20261016/package.json');
const env = require('dotenv').parse(fs.readFileSync('/opt/nodia/releases/nodia-server-ai15-20261016/.env'));
const { Client } = require('pg');
const db = new Client({ host: env.POSTGRES_HOST, port: Number(env.POSTGRES_PORT), user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB, options: '-c default_transaction_read_only=on', statement_timeout: 5000 });
try {
  await db.connect();
  const { rows: [value] } = await db.query(`SELECT current_setting('transaction_read_only') AS transaction_read_only,
    (SELECT count(*)::integer FROM migrations) AS migrations,
    (SELECT count(*)::integer FROM information_schema.columns WHERE table_schema='public' AND table_name='nodia_ai_context_snapshots') AS snapshot_columns,
    (SELECT count(*)::integer FROM information_schema.columns WHERE table_schema='public' AND table_name='nodia_ai_runs' AND column_name='context_snapshot_id') AS run_snapshot_columns,
    (SELECT count(*)::integer FROM nodia_ai_context_snapshots) AS snapshots,
    (SELECT coalesce(max(revision),0)::integer FROM nodia_ai_context_snapshots) AS maximum_snapshot_revision`);
  assert.equal(value.transaction_read_only, 'on');
  assert.equal(value.migrations, 28);
  assert.equal(value.snapshot_columns, 9);
  assert.equal(value.run_snapshot_columns, 1);
  console.log(JSON.stringify({ stage: 'AI-34', scope: 'read_only_schema_snapshot_revision_metadata', status: 'passed', ...value, configured_database_writes: 0, provider_generations: 0 }));
} finally { await db.end(); }
