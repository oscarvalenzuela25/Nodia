// Exact additive search index only. Backup and credentials stay inside the VM.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const runtime = '/opt/nodia/releases/nodia-server-ai15-20261016', backup = process.argv[2];
assert(/^\/opt\/nodia\/verification-backups\/ai35-[0-9]+$/.test(backup) && fs.statSync(backup).isDirectory()); process.umask(0o077);
const require = createRequire(path.join(runtime, 'package.json'));
const values = require('dotenv').parse(fs.readFileSync(path.join(runtime, '.env')));
for (const key of ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) assert(values[key]);
const {DataSource} = require('typeorm');
const {AddNodiaAiTextSearchIndex1793100000000: Migration} = await import(pathToFileURL('/tmp/nodia-ai35-runtime-candidate/dist/migrations/1793100000000-AddNodiaAiTextSearchIndex.js').href);
const db = new DataSource({type: 'postgres', host: values.POSTGRES_HOST, port: Number(values.POSTGRES_PORT), username: values.POSTGRES_USER, password: values.POSTGRES_PASSWORD, database: values.POSTGRES_DB,
  entities: [], migrations: [Migration], synchronize: false, logging: false, extra: {max: 1, statement_timeout: 60000, lock_timeout: 5000}});
const report = {stage: 'AI-35', scope: 'configured_database_exact_additive_search_index_migration', status: 'running', provider_generations: 0, storage_operations: 0, credential_values_exported: false, existing_domain_data_modified: false};
let phase = 'connect';
try {
  await db.initialize();
  assert.equal(Math.floor(Number((await db.query('SHOW server_version_num'))[0].server_version_num) / 10000), 16);
  const before = await db.query('SELECT timestamp::text,name FROM migrations ORDER BY timestamp'); assert.equal(before.length, 28);
  assert.equal((await db.query("SELECT to_regclass('public.ix_nodia_ai_message_parts_text_search') AS name"))[0].name, null);
  const [extensionBefore] = await db.query("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_trgm') AS present");
  await db.query("SELECT pg_advisory_lock(hashtext('nodia.ai35.migration'))");
  phase = 'private_pg16_backup';
  const dump = path.join(backup, 'configured-db-before.dump');
  const pgEnvironment = {PATH: '/usr/bin:/bin', PGHOST: values.POSTGRES_HOST, PGPORT: values.POSTGRES_PORT, PGUSER: values.POSTGRES_USER, PGPASSWORD: values.POSTGRES_PASSWORD, PGDATABASE: values.POSTGRES_DB};
  const inspected = spawnSync('/usr/bin/docker', ['image', 'inspect', 'postgres:16-alpine', '--format', '{{.Id}}'], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000}); assert.equal(inspected.status, 0);
  const base = ['run', '--rm', '--pull=never', '--network', 'host', '--read-only', '--security-opt', 'no-new-privileges', '--tmpfs', '/tmp:rw,size=16m'];
  const dumpArgs = [...base, '--mount', `type=bind,source=${backup},target=/backup`, ...['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].flatMap(key => ['-e', key]), 'postgres:16-alpine', 'pg_dump', '--format=custom', '--file', '/backup/configured-db-before.dump'];
  const dumped = spawnSync('/usr/bin/docker', dumpArgs, {env: pgEnvironment, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000}); assert.equal(dumped.status, 0);
  assert(fs.statSync(dump).size > 0); fs.chmodSync(dump, 0o600);
  const listed = spawnSync('/usr/bin/docker', [...base, '--mount', `type=bind,source=${backup},target=/backup,readonly`, 'postgres:16-alpine', 'pg_restore', '--list', '/backup/configured-db-before.dump'], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000});
  assert.equal(listed.status, 0); const catalog = listed.stdout.toString('utf8');
  assert(/Dumped from database version: 16\./.test(catalog) && /Dumped by pg_dump version: 16\./.test(catalog));
  Object.assign(report, {database_backup_created: true, database_backup_tool: 'cached_postgres16_ephemeral_pg_dump', database_backup_catalog_verified: true,
    database_backup_bytes: fs.statSync(dump).size, database_backup_mode: (fs.statSync(dump).mode & 0o777).toString(8),
    database_backup_sha256: createHash('sha256').update(fs.readFileSync(dump)).digest('hex')});
  phase = 'apply_exact_additive_index';
  const applied = await db.runMigrations({transaction: 'all'}); assert.deepEqual(applied.map(item => item.name), ['AddNodiaAiTextSearchIndex1793100000000']);
  const after = await db.query('SELECT timestamp::text,name FROM migrations ORDER BY timestamp'); assert.equal(after.length, 29); assert.deepEqual(after.slice(0, 28), before);
  const [index] = await db.query(`SELECT i.indisvalid AS valid,i.indisready AS ready,am.amname AS method,opc.opcname AS operator_class,n.nspname AS operator_schema,
    a.attname AS column,pg_get_expr(i.indpred,i.indrelid) AS predicate,pg_relation_size(idx.oid)::text AS bytes
    FROM pg_class idx JOIN pg_namespace ns ON ns.oid=idx.relnamespace JOIN pg_index i ON i.indexrelid=idx.oid
    JOIN pg_am am ON am.oid=idx.relam JOIN pg_opclass opc ON opc.oid=i.indclass[0] JOIN pg_namespace n ON n.oid=opc.opcnamespace
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
    WHERE ns.nspname='public' AND idx.relname='ix_nodia_ai_message_parts_text_search'`);
  assert(index?.valid && index.ready); assert.equal(index.method, 'gin'); assert.equal(index.operator_class, 'gin_trgm_ops'); assert.equal(index.operator_schema, 'public'); assert.equal(index.column, 'text'); assert(index.predicate.includes("'text'"));
  const [shape] = await db.query("SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name LIKE 'nodia_ai_%') AS tables,(SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS columns");
  assert.deepEqual(shape, {tables: 21, columns: 289});
  Object.assign(report, {status: 'passed', migrations_before: 28, migrations_after: 29, applied: applied.map(item => item.name), schema: shape, index, pg_trgm_previously_installed: extensionBefore.present, prior_migration_history_preserved: true});
} catch {
  Object.assign(report, {status: 'failed', safe_failure_phase: phase}); process.exitCode = 1;
} finally {
  if (db.isInitialized) {await db.query("SELECT pg_advisory_unlock(hashtext('nodia.ai35.migration'))").catch(() => {}); await db.destroy();}
}
console.log(JSON.stringify(report, null, 2));
