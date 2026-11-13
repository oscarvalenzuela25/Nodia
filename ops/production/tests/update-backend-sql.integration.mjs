// Synthetic fixtures in an internal Docker network; never imports AppModule or providers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { migrationInventory, quiescenceSql } from '/input/update-backend-action.mjs';

const old = '/opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc';
const candidate = '/opt/nodia/releases/backend-aaaaaaaaaaaa-bbbbbbbbbbbb';
const require = createRequire(path.join(old, 'package.json'));
require('reflect-metadata');
const { Client } = require('pg');
const hash = value => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(old, 'release-manifest.json'), 'utf8'));
assert.equal(migrationInventory(manifest).length, 45);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const output = [];
const action = (mode, database = 'fixture_update', overrides = {}) => {
  const result = spawnSync(process.execPath, ['/input/update-backend-action.mjs', mode, old, candidate], {
    env: { ...process.env, POSTGRES_DB: database, ...overrides }, encoding: 'utf8', timeout: 60_000,
  });
  let body;
  try { body = JSON.parse(result.stdout.trim()); }
  catch { throw new Error(`Action ${mode} did not emit JSON: ${result.status}; ${result.stdout}; ${result.stderr}`); }
  output.push({ mode, database, exit_code: result.status, ...body });
  return { result, body };
};

const filename = 'dist/migrations/1793630000000-SyntheticUpdateProbe.js';
const migration = `export class SyntheticUpdateProbe1793630000000 {
  name = 'SyntheticUpdateProbe1793630000000';
  async up(runner) {
    await runner.query("CREATE TABLE synthetic_update_probe(id integer PRIMARY KEY,value text NOT NULL)");
    await runner.query("INSERT INTO synthetic_update_probe(id,value) VALUES(1,'synthetic-only')");
  }
  async down(runner) { await runner.query('DROP TABLE synthetic_update_probe'); }
}\n`;
fs.writeFileSync(path.join(candidate, filename), migration);
const candidateManifest = { ...manifest, release_id: path.basename(candidate), source_sha: 'a'.repeat(40),
  source_provenance: 'synthetic_sql_fixture', deployment_eligible: false,
  files: [...manifest.files, { path: filename, type: 'file', bytes: Buffer.byteLength(migration), mode: '0644', sha256: hash(migration) }] };
fs.writeFileSync(path.join(candidate, 'release-manifest.json'), JSON.stringify(candidateManifest));
const source = (await import(pathToFileURL(path.join(old, 'dist/config/data-source.js')))).default;
await source.initialize();
try {
  const migrations = await source.runMigrations({ transaction: 'all' });
  check(migrations.length === 45, 'full frozen 45-migration fixture installed');
} finally { await source.destroy(); }

const inspect = action('inspect');
check(inspect.result.status === 0 && inspect.body.before === 45 && inspect.body.target === 46 &&
  inspect.body.pending === 1 && inspect.body.quiescent && inspect.body.client_tls_authorized,
'inspect validates TLS, exact existing ledger and empty execution state');
const wrongHostname = action('inspect', 'fixture_update', { POSTGRES_HOST: 'wrong-pg' });
check(wrongHostname.result.status === 1, 'verify-full rejects a DNS alias absent from the same server certificate');

const historical = JSON.parse(JSON.stringify(candidateManifest));
historical.files.find(file => file.path.startsWith('dist/migrations/') && file.path.endsWith('.js')).sha256 = '0'.repeat(64);
fs.writeFileSync(path.join(candidate, 'release-manifest.json'), JSON.stringify(historical));
const changed = action('inspect');
check(changed.result.status === 1 && changed.body.error_code === 'historical_migration_changed',
  'changed frozen migration manifest hash rejected before mutation');
fs.writeFileSync(path.join(candidate, 'release-manifest.json'), JSON.stringify(candidateManifest));

const migrated = action('migrate');
check(migrated.result.status === 0 && migrated.body.status === 'migrated' && migrated.body.applied === 1 &&
  migrated.body.entity_columns_present && migrated.body.client_tls_authorized, 'one incremental migration applied with entity metadata check');
const verified = action('verify');
check(verified.result.status === 0 && verified.body.target === 46 && verified.body.pending === 0 &&
  verified.body.incremental_migrations === 1 && verified.body.quiescent && verified.body.read_only,
  'postmigration verify checks exact target ledger');
const replay = action('migrate');
check(replay.result.status === 1 && replay.body.error_code === 'migration_ledger_mismatch',
  'second mutate request rejected instead of replaying completed increment');

const db = new Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: 'fixture_update' });
await db.connect();
check(db.connection.stream.authorized, 'fixture inspection also uses authorized TLS');
check((await db.query('SELECT value FROM synthetic_update_probe WHERE id=1')).rows[0].value === 'synthetic-only',
  'incremental SQL effect is durable exactly once');
check((await db.query('SELECT count(*)::int AS count FROM users')).rows[0].count === 0,
  'no superadministrator seed requested by update');
await db.query("UPDATE migrations SET name='SyntheticLedgerTamper' WHERE timestamp=1793630000000");
const tampered = action('verify');
check(tampered.result.status === 1 && tampered.body.error_code === 'migration_ledger_mismatch',
  'tampered ledger rejected');
await db.query("UPDATE migrations SET name='SyntheticUpdateProbe1793630000000' WHERE timestamp=1793630000000");
await db.end();

// A separate real PostgreSQL database isolates each predicate from business FK chains.
const gates = new Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: 'fixture_gates' });
await gates.connect();
await gates.query(`CREATE TABLE migrations(id serial PRIMARY KEY,timestamp bigint NOT NULL,name text NOT NULL);
CREATE TABLE nodia_ai_jobs(state text,kind text,stage_key text);
CREATE TABLE nodia_ai_runs(state text);
CREATE TABLE nodia_ai_executions(state text);
CREATE TABLE nodia_ai_execution_steps(state text);
CREATE TABLE nodia_ai_runtime_slots(state text);
CREATE TABLE nodia_ai_api_dispatches(state text,acknowledged_at timestamptz);
CREATE TABLE teacher_generation_jobs(state text);
CREATE TABLE teacher_generation_attempts(phase text,ended_at timestamptz);
CREATE TABLE ai_generation_operations(phase text,owner_kind text,acknowledged_at timestamptz,
 agentic_transport_descriptor jsonb,agentic_acknowledged_at timestamptz,selection_snapshot jsonb,remote_outcome text);`);
for (const item of migrationInventory(manifest)) await gates.query('INSERT INTO migrations(timestamp,name) VALUES($1,$2)', [item.timestamp, item.name]);
const scenario = async (name, insert, expectedCount, counter) => {
  await gates.query('BEGIN');
  try {
    await gates.query(insert);
    const row = (await gates.query(quiescenceSql)).rows[0];
    check(row[counter] === String(expectedCount), name);
  } finally { await gates.query('ROLLBACK'); }
};
await scenario('leased jobs block', "INSERT INTO nodia_ai_jobs VALUES('leased','turn','stage')", 1, 'jobs');
await scenario('unknown jobs block', "INSERT INTO nodia_ai_jobs VALUES('unknown','turn','stage')", 1, 'jobs');
await scenario('queued turns block', "INSERT INTO nodia_ai_jobs VALUES('ready','turn','stage')", 1, 'jobs');
await scenario('pending native ACK job blocks', "INSERT INTO nodia_ai_jobs VALUES('failed','reconcile','reconcile_ack')", 1, 'jobs');
await scenario('completed job does not block', "INSERT INTO nodia_ai_jobs VALUES('done','turn','stage')", 0, 'jobs');
await scenario('active run blocks', "INSERT INTO nodia_ai_runs VALUES('running')", 1, 'runs');
await scenario('unknown execution blocks', "INSERT INTO nodia_ai_executions VALUES('unknown')", 1, 'executions');
await scenario('running step blocks', "INSERT INTO nodia_ai_execution_steps VALUES('running')", 1, 'steps');
await scenario('held capacity blocks', "INSERT INTO nodia_ai_runtime_slots VALUES('held')", 1, 'slots');
await scenario('unknown capacity blocks', "INSERT INTO nodia_ai_runtime_slots VALUES('unknown')", 1, 'slots');
await scenario('free capacity does not block', "INSERT INTO nodia_ai_runtime_slots VALUES('free')", 0, 'slots');
await scenario('unacknowledged API closure blocks', "INSERT INTO nodia_ai_api_dispatches VALUES('closed',NULL)", 1, 'api_dispatches');
await scenario('acknowledged API closure does not block', "INSERT INTO nodia_ai_api_dispatches VALUES('closed',now())", 0, 'api_dispatches');
await scenario('queued Teacher work blocks', "INSERT INTO teacher_generation_jobs VALUES('queued')", 1, 'teacher_jobs');
await scenario('nonterminal Teacher attempt blocks', "INSERT INTO teacher_generation_attempts VALUES('transport_open',NULL)", 1, 'teacher_attempts');
await scenario('terminal Teacher attempt with closure time does not block', "INSERT INTO teacher_generation_attempts VALUES('terminal',now())", 0, 'teacher_attempts');
await scenario('unclosed neutral operation blocks', "INSERT INTO ai_generation_operations(phase,owner_kind,selection_snapshot) VALUES('transport_open','chat','{\"mode\":\"agentic\"}')", 1, 'generation_operations');
await scenario('Teacher Agentic ACK pending blocks', "INSERT INTO ai_generation_operations VALUES('closed','teacher',now(),'{}',NULL,'{\"mode\":\"agentic\"}','unknown')", 1, 'generation_operations');
await scenario('historical unknown Teacher closed and ACKed is allowed', "INSERT INTO ai_generation_operations VALUES('closed','teacher',now(),'{}',now(),'{\"mode\":\"agentic\"}','unknown')", 0, 'generation_operations');
await scenario('historical unknown Agentic chat requires no neutral API ACK', "INSERT INTO ai_generation_operations VALUES('closed','chat',NULL,NULL,NULL,'{\"mode\":\"agentic\"}','unknown')", 0, 'generation_operations');
await scenario('API chat neutral ACK pending blocks', "INSERT INTO ai_generation_operations VALUES('closed','chat',NULL,NULL,NULL,'{\"mode\":\"api_key\"}','unknown')", 1, 'generation_operations');
await gates.query("INSERT INTO nodia_ai_runtime_slots VALUES('unknown')");
const gateInspect = action('inspect', 'fixture_gates');
check(gateInspect.result.status === 0 && gateInspect.body.quiescent === false,
  'inspect reports nonquiescence without pretending migration occurred');
const gateMigration = action('migrate', 'fixture_gates');
check(gateMigration.result.status === 1 && gateMigration.body.error_code === 'live_or_unconfirmed_runtime_work',
  'migration CLI refuses a live/unknown runtime gate');
await gates.query('DELETE FROM nodia_ai_runtime_slots');
await gates.query('ALTER TABLE ai_generation_operations DROP COLUMN agentic_acknowledged_at');
const missing = action('inspect', 'fixture_gates');
check(missing.result.status === 1, 'missing required ACK column is not treated as zero');
await gates.end();

const { DataSource } = require('typeorm');
const rollbackSource = new DataSource({ ...source.options, database: 'fixture_rollback', logging: false });
await rollbackSource.initialize();
try {
  check((await rollbackSource.runMigrations({ transaction: 'all' })).length === 45,
    'separate rollback fixture installs the same frozen baseline');
} finally { await rollbackSource.destroy(); }
const rollbackDb = new Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: 'fixture_rollback' });
await rollbackDb.connect();
await rollbackDb.query('SELECT pg_advisory_lock(1868848993, 140117)');
try {
  const locked = action('migrate', 'fixture_rollback');
  check(locked.result.status === 1 && locked.body.error_code === 'database_update_lock_busy',
    'concurrent database advisory lock prevents migration');
} finally { await rollbackDb.query('SELECT pg_advisory_unlock(1868848993, 140117)'); }
const failingMigration = migration.replace(
  "await runner.query(\"INSERT INTO synthetic_update_probe(id,value) VALUES(1,'synthetic-only')\");",
  "await runner.query(\"SELECT * FROM deliberately_missing_sql_fixture_relation\");");
assert.notEqual(failingMigration, migration);
fs.writeFileSync(path.join(candidate, filename), failingMigration);
const failingManifest = JSON.parse(JSON.stringify(candidateManifest));
const pendingFile = failingManifest.files.find(file => file.path === filename);
pendingFile.sha256 = hash(failingMigration); pendingFile.bytes = Buffer.byteLength(failingMigration);
fs.writeFileSync(path.join(candidate, 'release-manifest.json'), JSON.stringify(failingManifest));
try {
  const failedMigration = action('migrate', 'fixture_rollback');
  check(failedMigration.result.status === 1, 'failed incremental SQL produces a failed action');
  const rollbackState = (await rollbackDb.query(`SELECT
    (SELECT count(*)::int FROM migrations) AS migrations,
    to_regclass('public.synthetic_update_probe') IS NULL AS table_absent`)).rows[0];
  check(rollbackState.migrations === 45 && rollbackState.table_absent,
    'transaction all rolls back both synthetic DDL and ledger entry');
} finally {
  fs.writeFileSync(path.join(candidate, filename), migration);
  fs.writeFileSync(path.join(candidate, 'release-manifest.json'), JSON.stringify(candidateManifest));
  await rollbackDb.end();
}

let teacher = { tested: false };
if (fs.existsSync('/input/teacher-dist/config/data-source.js')) {
  const teacherCandidate = '/opt/nodia/releases/backend-555555555555-666666666666';
  // Explicit compiled local fixture, no claim of committed-source release provenance.
  fs.cpSync(old, teacherCandidate, { recursive: true });
  fs.rmSync(path.join(teacherCandidate, 'dist'), { recursive: true });
  fs.cpSync('/input/teacher-dist', path.join(teacherCandidate, 'dist'), { recursive: true });
  const migrationFiles = fs.readdirSync(path.join(teacherCandidate, 'dist/migrations')).filter(name => name.endsWith('.js')).sort();
  const inventory = migrationFiles.map(name => {
    const filename = 'dist/migrations/' + name;
    const data = fs.readFileSync(path.join(teacherCandidate, filename));
    return { path: filename, type: 'file', bytes: data.length, mode: '0644', sha256: hash(data) };
  });
  const teacherManifest = { ...manifest, release_id: path.basename(teacherCandidate),
    source_provenance: 'synthetic_local_teacher_compiled_fixture', deployment_eligible: false,
    files: [...manifest.files.filter(item => !item.path.startsWith('dist/migrations/')), ...inventory] };
  fs.writeFileSync(path.join(teacherCandidate, 'release-manifest.json'), JSON.stringify(teacherManifest));
  check(inventory.length === 48, 'explicit compiled fixture has48 migrations');
  check(migrationInventory(manifest).every(item => inventory.some(file => file.path === item.path && file.sha256 === item.sha256)),
    'all45 frozen migration bytes match candidate');
  const teacherSource = new DataSource({ ...source.options, database: 'fixture_teacher', logging: false });
  await teacherSource.initialize();
  try { check((await teacherSource.runMigrations({ transaction: 'all' })).length === 45, 'Teacher fixture starts at real45 baseline'); }
  finally { await teacherSource.destroy(); }
  const teacherActions = [];
  for (const mode of ['inspect', 'migrate', 'verify']) {
    const result = spawnSync(process.execPath, ['/input/update-backend-action.mjs', mode, old, teacherCandidate], {
      env: { ...process.env, POSTGRES_DB: 'fixture_teacher' }, encoding: 'utf8', timeout: 60_000,
    });
    const body = JSON.parse(result.stdout.trim());
    check(result.status === 0, `real Teacher48 ${mode} succeeds: ${JSON.stringify(body)}`);
    if (mode === 'migrate') check(body.applied === 3 && body.entity_tables_checked === 68 && body.entity_columns_present,
      `three Teacher migrations apply and existing ORM entity columns remain valid: ${JSON.stringify(body)}`);
    if (mode === 'verify') check(body.target === 48 && body.pending === 0 && body.read_only, 'Teacher48 ledger exact and read-only verified');
    teacherActions.push({ mode, ...body });
  }
  const teacherDb = new Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: 'fixture_teacher' });
  await teacherDb.connect();
  let publicTables;
  try { publicTables = Number((await teacherDb.query("SELECT count(*) AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0].count); }
  finally { await teacherDb.end(); }
  teacher = { tested: true, fixture_source: 'explicit local dist; not committed-source provenance or production release',
    baseline: 45, target: 48, actions: teacherActions,
    public_tables_observed: publicTables, orm_entity_tables_observed: 68,
    migration_files: inventory.map(file => ({ path: file.path, sha256: file.sha256 })) };
}
console.log(JSON.stringify({ schema_version: 1, status: 'passed', checks, teacher,
  postgres_major: 16, tls_verify_full: true, action_uid: process.getuid(),
  migration_baseline: 45, migration_target: 46, migrations_applied: 1,
  incorrect_tls_hostname_rejected: true, database_lock_conflict_rejected: true,
  failed_increment_transaction_rolled_back: true,
  no_seed_requested: true, no_typescript_build: true, provider_requests: 0,
  real_schema_and_separate_minimal_gate_database: true, actions: output }));
