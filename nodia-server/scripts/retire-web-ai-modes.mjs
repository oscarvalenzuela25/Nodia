/** Coordinated maintenance only. Default action is read-only; never starts/stops consumers. */
import 'dotenv/config';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  createReadStream,
  createWriteStream,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statfsSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { RetireWebAiModes1793300000000 } from '../dist/migrations/1793300000000-RetireWebAiModes.js';

const migrationName = 'RetireWebAiModes1793300000000';
const migrationPath = fileURLToPath(
  new URL(
    '../dist/migrations/1793300000000-RetireWebAiModes.js',
    import.meta.url,
  ),
);
const packagePath = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const args = Object.fromEntries(
  process.argv.slice(2).map((value) => {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/.exec(value);
    if (!match) throw new Error('maintenance:invalid_arguments');
    return [match[1], match[2]];
  }),
);
if (
  Object.keys(args).some(
    (key) =>
      ![
        'action',
        'work-dir',
        'report',
        'expected-migration-sha256',
        'baseline-report',
      ].includes(key),
  )
)
  throw new Error('maintenance:invalid_arguments');
const action = args.action ?? 'preflight';
if (!['preflight', 'up', 'down'].includes(action))
  throw new Error('maintenance:invalid_action');
const config = {
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
const expectedChanges = [
  'ai_provider_catalog',
  'ai_providers',
  'nodia_ai_conversations',
  'migrations',
  'ai_mode_retirement_backup',
];
const report = {
  action,
  success: false,
  operational_mutation_requested: action !== 'preflight',
  migration_name: migrationName,
  migration_sha256: hash(readFileSync(migrationPath)),
  provider_inferences: 0,
  stages: [],
};
const read = new Client({
  ...config,
  options: '-c statement_timeout=30000 -c default_transaction_read_only=on',
});
let writer,
  readConnected = false,
  stage = 'configuration',
  reportPath;

function syncFile(path) {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function saveCheckpoint() {
  if (!reportPath) return;
  const temporary = reportPath + '.tmp-' + randomBytes(5).toString('hex');
  writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  syncFile(temporary);
  renameSync(temporary, reportPath);
  syncFile(dirname(reportPath));
}
function fail(code) {
  throw Object.assign(new Error(code), { safeCode: code });
}
function services() {
  const result = {};
  for (const unit of [
    'nodia-api.service',
    'nodia-ai-worker.service',
    'nodia-gemini-lab.service',
  ]) {
    const state = spawnSync('systemctl', ['is-active', unit], {
      encoding: 'utf8',
    });
    const pid = spawnSync(
      'systemctl',
      ['show', '--property=MainPID', '--value', unit],
      { encoding: 'utf8' },
    );
    if (state.error || pid.status !== 0)
      fail('maintenance:consumer_state_unverifiable');
    result[unit] = { state: state.stdout.trim(), pid: pid.stdout.trim() };
  }
  return result;
}
function assertStopped() {
  const result = services();
  if (
    Object.values(result).some(
      (value) => value.state !== 'inactive' || value.pid !== '0',
    )
  )
    fail('maintenance:consumers_not_stopped');
  return result;
}
async function quiet(connection) {
  const rows = await connection.query(
    `SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) AS active_jobs,(SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) AS open_attempts,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') AS busy_slots,(SELECT count(*)::int FROM nodia_ai_conversations WHERE active_job_id IS NOT NULL) AS active_chats`,
  );
  const value = rows.rows[0];
  if (Object.values(value).some((count) => count !== 0))
    fail('maintenance:runtime_not_quiet');
  return value;
}
async function aggregates(connection) {
  const tables = (
    await connection.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const result = {};
  for (const { tablename } of tables) {
    const rows = (
      await connection.query(
        `SELECT to_jsonb(t)::text AS canonical FROM ${quote(tablename)} t ORDER BY to_jsonb(t)::text COLLATE "C"`,
      )
    ).rows;
    const value = createHash('sha256');
    for (const row of rows) value.update(row.canonical).update('\n');
    result[tablename] = { count: rows.length, sha256: value.digest('hex') };
  }
  return result;
}
async function identitySets(connection) {
  const result = {};
  for (const table of [
    'ai_provider_catalog',
    'ai_providers',
    'nodia_ai_conversations',
  ]) {
    result[table] = hash(
      JSON.stringify(
        (
          await connection.query(
            `SELECT id::text AS id FROM ${quote(table)} ORDER BY id`,
          )
        ).rows,
      ),
    );
  }
  return result;
}
async function verifyDownBeforeBackup(connection) {
  const stoppedBeforeDdl = Symbol('read_only_down_probe');
  let reachedDdl = false;
  try {
    await new RetireWebAiModes1793300000000().down({
      query: async (sql) => {
        if (/^\s*(SET LOCAL|LOCK TABLE)/.test(sql)) return [];
        if (/^\s*SELECT/.test(sql)) return (await connection.query(sql)).rows;
        if (
          sql.startsWith('ALTER TABLE nodia_ai_conversations DROP CONSTRAINT')
        ) {
          reachedDdl = true;
          throw stoppedBeforeDdl;
        }
        fail('maintenance:unexpected_down_probe_statement');
      },
    });
    fail('maintenance:down_probe_missing_guard');
  } catch (error) {
    if (error === stoppedBeforeDdl && reachedDdl) return true;
    throw error;
  }
}
function compare(before, after, exclusions = []) {
  const excluded = new Set(exclusions);
  const changed = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].filter(
    (table) =>
      !excluded.has(table) &&
      JSON.stringify(before[table]) !== JSON.stringify(after[table]),
  );
  if (changed.length)
    throw Object.assign(new Error('maintenance:integrity_mismatch'), {
      safeCode: 'maintenance:integrity_mismatch',
      safeTables: changed,
    });
  return {
    unchanged_tables: Object.keys(before).filter(
      (table) => !excluded.has(table),
    ).length,
    differences: [],
  };
}
function privateDirectory(value) {
  if (
    !value ||
    !isAbsolute(value) ||
    !existsSync(value) ||
    lstatSync(value).isSymbolicLink()
  )
    fail('maintenance:private_work_directory_required');
  const path = realpathSync(value),
    stat = statSync(path),
    local = relative(packagePath, path);
  if (
    !stat.isDirectory() ||
    (stat.mode & 0o077) !== 0 ||
    stat.uid !== process.getuid() ||
    local === '' ||
    (local.split(/[\\/]/)[0] !== '..' && !isAbsolute(local))
  )
    fail('maintenance:unsafe_work_directory');
  return path;
}
async function backup(snapshot, work, databaseSize) {
  const path = resolve(
    work,
    `before-${action}-${Date.now()}-${randomBytes(5).toString('hex')}.dump`,
  );
  const env = {
    PATH: process.env.PATH,
    LANG: 'C',
    LC_ALL: 'C',
    PGHOST: config.host,
    PGPORT: String(config.port),
    PGUSER: config.user,
    PGDATABASE: config.database,
    PGPASSWORD: config.password,
    PGCONNECT_TIMEOUT: '15',
  };
  const child = spawn(
    'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl', `--snapshot=${snapshot}`],
    {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: AbortSignal.timeout(60000),
    },
  );
  child.stderr.resume();
  let bytes = 0;
  const closed = new Promise((accept, reject) => {
    child.once('error', () =>
      reject(
        Object.assign(new Error('maintenance:backup_failed'), {
          safeCode: 'maintenance:backup_failed',
        }),
      ),
    );
    child.once('close', (code) =>
      code === 0
        ? accept()
        : reject(
            Object.assign(new Error('maintenance:backup_failed'), {
              safeCode: 'maintenance:backup_failed',
            }),
          ),
    );
  });
  const bounded = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(
        bytes > Math.min(268435456, databaseSize * 4 + 16777216)
          ? new Error('dump_limit')
          : null,
        chunk,
      );
    },
  });
  try {
    await pipeline(
      child.stdout,
      bounded,
      createWriteStream(path, { flags: 'wx', mode: 0o600 }),
    );
    await closed;
  } catch {
    child.kill('SIGTERM');
    await closed.catch(() => undefined);
    fail('maintenance:backup_failed');
  }
  syncFile(path);
  syncFile(work);
  const stat = statSync(path);
  if ((stat.mode & 0o777) !== 0o600 || !stat.size)
    fail('maintenance:backup_permissions');
  const sha = createHash('sha256');
  for await (const chunk of createReadStream(path)) sha.update(chunk);
  return {
    private_path: path,
    bytes: stat.size,
    sha256: sha.digest('hex'),
    mode: '600',
    exported: false,
  };
}

try {
  if (
    !process.env.DOTENV_CONFIG_PATH ||
    Object.values(config).some(
      (value) => value === undefined || value === '',
    ) ||
    !Number.isInteger(config.port) ||
    config.port < 1 ||
    config.port > 65535
  )
    fail('maintenance:explicit_private_configuration_required');
  if (action !== 'preflight') {
    const work = privateDirectory(args['work-dir']);
    if (args['expected-migration-sha256'] !== report.migration_sha256)
      fail('maintenance:migration_pin_mismatch');
    if (
      !args.report ||
      !isAbsolute(args.report) ||
      realpathSync(dirname(args.report)) !== work ||
      existsSync(args.report)
    )
      fail('maintenance:new_private_report_required');
    reportPath = args.report;
    report.stopped_consumers = assertStopped();
  }
  await read.connect();
  readConnected = true;
  await read.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await read.query("SET LOCAL TIME ZONE 'UTC'");
  const identity = (
    await read.query(
      'SELECT current_database() AS db,(pg_control_system()).system_identifier::text AS cluster',
    )
  ).rows[0];
  report.database_identity_sha256 = hash(JSON.stringify(identity));
  report.quiet = await quiet(read);
  report.migration_ledger_entry_present = (
    await read.query(
      'SELECT EXISTS(SELECT 1 FROM migrations WHERE name=$1) AS present',
      [migrationName],
    )
  ).rows[0].present;
  const size = Number(
      (
        await read.query(
          'SELECT pg_database_size(current_database())::text AS bytes',
        )
      ).rows[0].bytes,
    ),
    fs = statfsSync('/');
  report.capacity = {
    database_bytes: size,
    available_bytes: Number(fs.bavail) * Number(fs.bsize),
    required_bytes: 1073741824 + size * 4,
  };
  report.before_tables = await aggregates(read);
  report.before_identity_sets = await identitySets(read);
  report.stages.push('canonical_readonly_baseline');
  if (action === 'preflight') {
    report.consumer_states = services();
    report.ready_to_apply =
      Object.values(report.consumer_states).every(
        (value) => value.state === 'inactive' && value.pid === '0',
      ) &&
      report.capacity.available_bytes > report.capacity.required_bytes &&
      Object.keys(report.before_tables).length === 62;
    report.success = true;
  } else {
    if (report.capacity.available_bytes <= report.capacity.required_bytes)
      fail('maintenance:insufficient_capacity');
    if (action === 'up' && report.migration_ledger_entry_present)
      fail('maintenance:already_applied');
    if (action === 'down' && !report.migration_ledger_entry_present)
      fail('maintenance:expected_migration_not_applied');
    const expectedCount = action === 'up' ? 62 : 63;
    if (Object.keys(report.before_tables).length !== expectedCount)
      fail('maintenance:unexpected_table_count');
    let baseline;
    if (action === 'down') {
      if (!args['baseline-report'] || !isAbsolute(args['baseline-report']))
        fail('maintenance:up_baseline_required');
      baseline = JSON.parse(readFileSync(args['baseline-report'], 'utf8'));
      if (
        !baseline.success ||
        baseline.action !== 'up' ||
        baseline.migration_name !== migrationName ||
        baseline.migration_sha256 !== report.migration_sha256 ||
        baseline.database_identity_sha256 !== report.database_identity_sha256
      )
        fail('maintenance:baseline_identity_mismatch');
      const latest = (
        await read.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 1')
      ).rows[0];
      if (latest?.name !== migrationName)
        fail('maintenance:unexpected_latest_migration');
      report.down_after_state_unchanged_before_backup =
        await verifyDownBeforeBackup(read);
    }
    stage = 'fresh_private_backup';
    const snapshot = (
      await read.query('SELECT pg_export_snapshot() AS snapshot')
    ).rows[0].snapshot;
    if (!/^[A-F0-9-]+$/i.test(snapshot)) fail('maintenance:invalid_snapshot');
    report.backup = await backup(snapshot, args['work-dir'], size);
    await read.query('ROLLBACK');
    report.stages.push('fresh_private_backup_600');
    saveCheckpoint();
    assertStopped();
    await read.query('BEGIN READ ONLY');
    await quiet(read);
    await read.query('ROLLBACK');
    writer = new DataSource({
      type: 'postgres',
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      database: config.database,
      migrations: [RetireWebAiModes1793300000000],
      migrationsTableName: 'migrations',
      synchronize: false,
      logging: false,
    });
    await writer.initialize();
    stage = `transactional_${action}`;
    if (action === 'up') {
      const result = await writer.runMigrations({ transaction: 'all' });
      if (result.length !== 1 || result[0].name !== migrationName)
        fail('maintenance:unexpected_migration');
    } else await writer.undoLastMigration({ transaction: 'all' });
    report.migration_committed = true;
    report.stages.push(`transactional_${action}_complete`);
    saveCheckpoint();
    await read.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await read.query("SET LOCAL TIME ZONE 'UTC'");
    report.after_tables = await aggregates(read);
    report.after_identity_sets = await identitySets(read);
    if (
      JSON.stringify(report.before_identity_sets) !==
      JSON.stringify(report.after_identity_sets)
    )
      fail('maintenance:resource_ids_changed');
    report.integrity =
      action === 'up'
        ? compare(report.before_tables, report.after_tables, expectedChanges)
        : compare(baseline.before_tables, report.after_tables);
    report.stages.push('canonical_integrity_verified');
    assertStopped();
    report.success = true;
  }
} catch (error) {
  report.failed_stage = stage;
  report.error_code =
    error.safeCode ??
    (typeof error.code === 'string' ? error.code : 'maintenance:failed');
  if (error.safeTables) report.different_tables = error.safeTables;
  if (report.migration_committed) report.keep_consumers_stopped = true;
  process.exitCode = 1;
} finally {
  if (readConnected) await read.query('ROLLBACK').catch(() => undefined);
  await read.end().catch(() => undefined);
  if (writer?.isInitialized) await writer.destroy().catch(() => undefined);
  saveCheckpoint();
  console.log(JSON.stringify(report));
}
