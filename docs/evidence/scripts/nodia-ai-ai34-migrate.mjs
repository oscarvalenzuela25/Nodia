// Exact additive migration only; private database backup remains inside the VM.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const runtime = '/opt/nodia/releases/nodia-server-ai15-20261016', backup = process.argv[2];
assert(/^\/opt\/nodia\/verification-backups\/ai34-[0-9]+$/.test(backup));
assert(fs.statSync(backup).isDirectory()); process.umask(0o077);
const require = createRequire(path.join(runtime, 'package.json'));
const values = require('dotenv').parse(fs.readFileSync(path.join(runtime, '.env')));
for (const key of ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) assert(values[key]);
const { DataSource } = require('typeorm');
const file = '/tmp/nodia-ai34-runtime-candidate/dist/migrations/1793000000000-CreateNodiaAiContextSnapshots.js';
const { CreateNodiaAiContextSnapshots1793000000000: Migration } = await import(pathToFileURL(file).href);
const db = new DataSource({ type: 'postgres', host: values.POSTGRES_HOST, port: Number(values.POSTGRES_PORT), username: values.POSTGRES_USER, password: values.POSTGRES_PASSWORD, database: values.POSTGRES_DB, entities: [], migrations: [Migration], synchronize: false, logging: false, extra: { max: 1, statement_timeout: 15000 } });
let phase = 'connect';
const report = { stage: 'AI-34', scope: 'configured_database_exact_additive_M4_snapshot_migration', status: 'running', provider_generations: 0, storage_operations: 0, credential_values_exported: false, existing_domain_data_modified: false };
try {
  await db.initialize();
  const before = await db.query('SELECT timestamp::text,name FROM migrations ORDER BY timestamp'); assert.equal(before.length, 27);
  assert.equal((await db.query("SELECT to_regclass('public.nodia_ai_context_snapshots') AS name"))[0].name, null);
  await db.query("SELECT pg_advisory_lock(hashtext('nodia.ai34.migration'))");
  phase = 'private_pg_dump';
  const dump = path.join(backup, 'configured-db-before.dump');
  const pgEnvironment = { PATH: '/usr/bin:/bin', PGHOST: values.POSTGRES_HOST, PGPORT: values.POSTGRES_PORT, PGUSER: values.POSTGRES_USER, PGPASSWORD: values.POSTGRES_PASSWORD, PGDATABASE: values.POSTGRES_DB };
  const nativeDump = fs.existsSync('/usr/bin/pg_dump');
  const command = nativeDump ? '/usr/bin/pg_dump' : '/usr/bin/docker';
  const args = nativeDump ? ['--format=custom', '--file', dump] : ['run', '--rm', '--network', 'host', '--read-only', '--security-opt', 'no-new-privileges', '--tmpfs', '/tmp:rw,size=16m', '--mount', `type=bind,source=${backup},target=/backup`, ...['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].flatMap(key => ['-e', key]), 'postgres:16-alpine', 'pg_dump', '--format=custom', '--file', '/backup/configured-db-before.dump'];
  const result = spawnSync(command, args, { env: pgEnvironment, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  assert.equal(result.status, 0); assert(fs.statSync(dump).size > 0); fs.chmodSync(dump, 0o600);
  Object.assign(report, { database_backup_created: true, database_backup_tool: nativeDump ? 'native_pg_dump' : 'cached_postgres16_ephemeral_pg_dump', database_backup_bytes: fs.statSync(dump).size, database_backup_sha256: createHash('sha256').update(fs.readFileSync(dump)).digest('hex') });
  phase = 'apply_exact_M4';
  const applied = await db.runMigrations({ transaction: 'all' }); assert.deepEqual(applied.map(item => item.name), ['CreateNodiaAiContextSnapshots1793000000000']);
  const after = await db.query('SELECT timestamp::text,name FROM migrations ORDER BY timestamp'); assert.equal(after.length, 28); assert.deepEqual(after.slice(0, 27), before);
  const [shape] = await db.query("SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name LIKE 'nodia_ai_%') AS tables,(SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS columns,(SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='nodia_ai_context_snapshots') AS snapshot_columns,(SELECT count(*)::int FROM nodia_ai_context_snapshots) AS snapshots");
  assert.equal(shape.tables, 21); assert.equal(shape.columns, 289); assert.equal(shape.snapshot_columns, 9); assert.equal(shape.snapshots, 0);
  Object.assign(report, { status: 'passed', migrations_before: 27, migrations_after: 28, applied: applied.map(item => item.name), schema: shape, prior_migration_history_preserved: true });
} catch {
  Object.assign(report, { status: 'failed', safe_failure_phase: phase }); process.exitCode = 1;
} finally {
  if (db.isInitialized) { await db.query("SELECT pg_advisory_unlock(hashtext('nodia.ai34.migration'))").catch(() => {}); await db.destroy(); }
}
console.log(JSON.stringify(report, null, 2));
