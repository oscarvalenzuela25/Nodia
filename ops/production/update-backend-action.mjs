// Runs as nodia in an isolated systemd job, never as root and never boots AppModule.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
const ensure = (condition, code) => {
  if (!condition) throw Object.assign(new Error('Backend update rejected'), { safeCode: code });
};
const releasePattern = /^backend-[a-f0-9]{12}-[a-f0-9]{12}$/;

export const quiescencePredicates = Object.freeze({
  jobs: ['nodia_ai_jobs', "state IN ('leased','unknown') OR (kind IN ('turn','execution') AND state IN ('ready','waiting')) OR (kind='reconcile' AND stage_key='reconcile_ack')"],
  runs: ['nodia_ai_runs', "state IN ('queued','running','cancel_requested','unknown')"],
  executions: ['nodia_ai_executions', "state IN ('queued','running','cancel_requested','unknown')"],
  steps: ['nodia_ai_execution_steps', "state IN ('running','unknown')"],
  slots: ['nodia_ai_runtime_slots', "state<>'free'"],
  api_dispatches: ['nodia_ai_api_dispatches', "state<>'closed' OR acknowledged_at IS NULL"],
  teacher_jobs: ['teacher_generation_jobs', "state IN ('queued','running','unknown')"],
  teacher_attempts: ['teacher_generation_attempts', "phase<>'terminal' OR ended_at IS NULL"],
  generation_operations: ['ai_generation_operations', "phase<>'closed' OR (owner_kind='teacher' AND (acknowledged_at IS NULL OR (agentic_transport_descriptor IS NOT NULL AND agentic_acknowledged_at IS NULL))) OR (owner_kind='chat' AND selection_snapshot->>'mode'='api_key' AND acknowledged_at IS NULL)"],
});
export const quiescenceSql = `SELECT ${Object.entries(quiescencePredicates).map(([name, [table, predicate]]) =>
  `(SELECT count(*)::text FROM public.${table} WHERE ${predicate}) AS ${name}`).join(',\n')}`;

export function migrationInventory(manifest) {
  ensure(manifest?.schema_version === 1 && Array.isArray(manifest.files), 'manifest_invalid');
  const items = manifest.files.filter(file => /^dist\/migrations\/[^/]+\.js$/.test(file.path)).map(file => {
    const match = /^dist\/migrations\/([0-9]{13})-([A-Za-z][A-Za-z0-9_]*)\.js$/.exec(file.path);
    ensure(match && file.type === 'file' && /^[a-f0-9]{64}$/.test(file.sha256), 'migration_file_invalid');
    return { timestamp: match[1], name: match[2] + match[1], path: file.path, sha256: file.sha256 };
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  ensure(items.length >= 2 && new Set(items.map(item => item.timestamp)).size === items.length,
    'migration_inventory_invalid');
  return items;
}

export function validateHistory(oldManifest, candidateManifest, rows, { after = false } = {}) {
  const before = migrationInventory(oldManifest);
  const target = migrationInventory(candidateManifest);
  ensure(target.length >= before.length && before.every((item, index) =>
    ['timestamp', 'name', 'path', 'sha256'].every(key => item[key] === target[index]?.[key])),
  'historical_migration_changed');
  const expected = after ? target : before;
  ensure(Array.isArray(rows) && rows.length === expected.length && rows.every((row, index) =>
    String(row.timestamp) === expected[index].timestamp && row.name === expected[index].name), 'migration_ledger_mismatch');
  return { before: before.length, target: target.length, pending: after ? 0 : target.length - before.length,
    incremental_migrations: target.length - before.length,
    ledger_sha256: hash(JSON.stringify(rows.map(row => ({ timestamp: String(row.timestamp), name: row.name })))) };
}

export function quiescentCounters(row) {
  ensure(row && Object.keys(row).length === Object.keys(quiescencePredicates).length, 'runtime_counters_invalid');
  const counts = {};
  for (const name of Object.keys(quiescencePredicates)) {
    ensure(typeof row[name] === 'string' && /^(?:0|[1-9][0-9]*)$/.test(row[name]) &&
      Number.isSafeInteger(Number(row[name])), 'runtime_counter_invalid');
    counts[name] = Number(row[name]);
  }
  return { quiescent: Object.values(counts).every(count => count === 0), counts };
}

function releaseDirectory(value) {
  const absolute = path.resolve(value);
  ensure(path.dirname(absolute) === '/opt/nodia/releases' && releasePattern.test(path.basename(absolute)) &&
    fs.realpathSync(absolute) === absolute, 'canonical_release_required');
  return absolute;
}

async function runAction(mode, oldDirectory, candidateDirectory) {
  ensure(['inspect', 'migrate', 'verify'].includes(mode) && process.platform === 'linux' && process.getuid() !== 0,
    'unprivileged_linux_action_required');
  ensure(process.env.PGSSLMODE === 'verify-full' && process.env.DOTENV_CONFIG_PATH === '/dev/null',
    'verified_private_environment_required');
  const old = releaseDirectory(oldDirectory);
  const candidate = releaseDirectory(candidateDirectory);
  const oldManifest = JSON.parse(fs.readFileSync(path.join(old, 'release-manifest.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(candidate, 'release-manifest.json'), 'utf8'));
  const require = createRequire(path.join(candidate, 'package.json'));
  const { Client } = require('pg');
  const db = new Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
    connectionTimeoutMillis: 10_000, query_timeout: 15_000, statement_timeout: 15_000,
    application_name: 'nodia-backend-update', options: '-c lock_timeout=5000' });
  db.on('error', () => {});
  let dataSource;
  try {
    await db.connect();
    ensure(db.connection.stream.authorized === true && ['TLSv1.2', 'TLSv1.3'].includes(db.connection.stream.getProtocol?.()),
      'postgres_tls_not_verified');
    const ledger = async () => (await db.query('SELECT timestamp::text AS timestamp,name FROM public.migrations ORDER BY id')).rows;
    await db.query('BEGIN READ ONLY');
    const before = validateHistory(oldManifest, manifest, await ledger(), { after: mode === 'verify' });
    const runtime = quiescentCounters((await db.query(quiescenceSql)).rows[0]);
    await db.query('ROLLBACK');
    if (mode !== 'migrate') return { schema_version: 1, status: 'verified', mode, ...before, ...runtime,
      read_only: true, client_tls_authorized: true, migrations_executed: false };
    ensure(runtime.quiescent, 'live_or_unconfirmed_runtime_work');
    const locked = (await db.query('SELECT pg_try_advisory_lock(1868848993, 140117) AS locked')).rows[0]?.locked;
    ensure(locked === true, 'database_update_lock_busy');
    ({ default: dataSource } = await import(pathToFileURL(path.join(candidate, 'dist/config/data-source.js')).href));
    ensure(dataSource.options.synchronize === false && dataSource.options.migrationsRun !== true,
      'unsafe_data_source_options');
    // TypeORM logs migration failures even with logging:false. Install an explicit
    // logger so SQL/error details never precede the sole safe JSON response.
    const quietLogger = { logQuery() {}, logQueryError() {}, logQuerySlow() {},
      logSchemaBuild() {}, logMigration() {}, log() {} };
    dataSource.setOptions({ logging: false, logger: quietLogger, migrationsTransactionMode: 'all' });
    await dataSource.initialize();
    const expected = migrationInventory(manifest);
    const actualNames = dataSource.migrations.map(migration => migration.name ?? migration.constructor.name).sort();
    ensure(JSON.stringify(actualNames) === JSON.stringify(expected.map(item => item.name).sort()) &&
      dataSource.migrations.every(migration => migration.transaction !== false),
    'compiled_migrations_mismatch');
    // No seed/setup wrapper and no replay: root records migration_started before calling us.
    const applied = await dataSource.runMigrations({ transaction: 'all' });
    const after = validateHistory(oldManifest, manifest, await ledger(), { after: true });
    ensure(applied.length === before.pending, 'migration_applied_count_mismatch');
    const columns = (await db.query(`SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema='public'`)).rows;
    const available = new Set(columns.map(row => `${row.table_name}.${row.column_name}`));
    ensure(dataSource.entityMetadatas.length > 0 && dataSource.entityMetadatas.every(entity =>
      (entity.schema === undefined || entity.schema === 'public') &&
      entity.columns.every(column => available.has(`${entity.tableName}.${column.databaseName}`))),
    'entity_table_or_column_missing');
    return { schema_version: 1, status: 'migrated', ...after, applied: applied.length,
      entity_tables_checked: dataSource.entityMetadatas.length, entity_columns_present: true,
      client_tls_authorized: true, seed_requested: false, automatic_retry_allowed: false };
  } finally {
    try {
      if (dataSource?.isInitialized) await dataSource.destroy();
    } finally { await db.end(); }
  }
}

export function failureResult(error) {
  return { schema_version: 1, status: 'failed',
    error_code: typeof error?.safeCode === 'string' && /^[a-z0-9_]{1,100}$/.test(error.safeCode)
      ? error.safeCode : 'database_update_action_failed',
    ...(typeof error?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? { database_sqlstate: error.code } : {}),
    automatic_retry_allowed: false };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    ensure(process.argv.length === 5, 'action_arguments_invalid');
    console.log(JSON.stringify(await runAction(...process.argv.slice(2))));
  } catch (error) {
    console.log(JSON.stringify(failureResult(error)));
    process.exitCode = 1;
  }
}
