// Read-only metadata/function probe. Credentials stay on the VM and are never printed.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const runtime = '/opt/nodia/releases/nodia-server-ai15-20261016';
const require = createRequire(runtime + '/package.json');
const env = require('dotenv').parse(fs.readFileSync(runtime + '/.env'));
const { Client } = require('pg');
const db = new Client({ host: env.POSTGRES_HOST, port: Number(env.POSTGRES_PORT), user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB, options: '-c default_transaction_read_only=on' });
try {
  await db.connect();
  await db.query('BEGIN READ ONLY');
  await db.query("SET LOCAL statement_timeout='5s'");
  const [row] = (await db.query(`SELECT current_setting('server_version_num') AS server_version_num,
    current_setting('transaction_read_only') AS transaction_read_only,
    encode(sha256(convert_to('abc','UTF8')),'hex') AS known_sha256,
    to_regprocedure('pg_catalog.sha256(bytea)')::text AS hash_function,
    (SELECT count(*)::integer FROM pg_extension WHERE extname='pgcrypto') AS pgcrypto_installed`)).rows;
  assert.equal(row.transaction_read_only, 'on');
  assert.ok(Number(row.server_version_num) >= 160000);
  assert.equal(row.known_sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(row.hash_function, 'sha256(bytea)');
  await db.query('ROLLBACK');
  console.log(JSON.stringify({ stage: 'AI-34', scope: 'read_only_postgresql_core_sha256_probe', status: 'passed', observed_at_utc: new Date().toISOString(), ...row, configured_database_writes: 0, extension_installs: 0, provider_generations: 0, services_restarted: false }, null, 2));
} finally {
  await db.end();
}
