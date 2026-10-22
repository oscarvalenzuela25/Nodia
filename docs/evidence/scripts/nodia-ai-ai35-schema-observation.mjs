// Read-only index/schema metadata, never message or summary content.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const expected = Number(process.argv[2] ?? 29); assert([28, 29].includes(expected));
const require = createRequire('/opt/nodia/releases/nodia-server-ai15-20261016/package.json');
const env = require('dotenv').parse(fs.readFileSync('/opt/nodia/releases/nodia-server-ai15-20261016/.env'));
const {Client} = require('pg');
const db = new Client({host: env.POSTGRES_HOST, port: Number(env.POSTGRES_PORT), user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB,
  options: '-c default_transaction_read_only=on', statement_timeout: 5000});
try {
  await db.connect();
  const {rows: [value]} = await db.query(`SELECT current_setting('transaction_read_only') AS transaction_read_only,
    (SELECT count(*)::int FROM migrations) AS migrations,
    (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name LIKE 'nodia_ai_%') AS tables,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS columns,
    (SELECT count(*)::int FROM nodia_ai_context_snapshots) AS snapshots,
    (SELECT coalesce(max(revision),0)::int FROM nodia_ai_context_snapshots) AS maximum_snapshot_revision,
    has_database_privilege(current_user,current_database(),'CREATE') AS can_install_trusted_extension,
    (SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_trgm')) AS pg_trgm_available,
    (SELECT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm' AND n.nspname='public')) AS pg_trgm_public,
    (SELECT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_namespace n ON n.oid=idx.relnamespace
      WHERE n.nspname='public' AND idx.relname='ix_nodia_ai_message_parts_text_search' AND i.indisvalid AND i.indisready)) AS search_index_valid`);
  assert.equal(value.transaction_read_only, 'on'); assert.equal(value.migrations, expected); assert.equal(value.tables, 21); assert.equal(value.columns, 289);
  assert.equal(value.search_index_valid, expected === 29); if (expected === 29) assert(value.pg_trgm_public);
  console.log(JSON.stringify({stage: 'AI-35', scope: 'read_only_search_schema_snapshot_metadata', status: 'passed', ...value, configured_database_writes: 0, provider_generations: 0}));
} finally {await db.end();}
