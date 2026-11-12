// Private systemd action. No AppModule, automatic retry, journal bootstrap or app startup.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const hash = value => createHash('sha256').update(value).digest('hex');
const PREFLIGHT_SHA = 'd720a261ddb9d414949b395c6a10fcb05faccf67b57ac48bbaf3072f189d05d3';
const BASELINE_SHA = '7f4977ac62b5bae24e193f8848b7ec6dd1fda8b3e94cdb19a76c554a5e69dd7f';
const RECOVERY = '/var/lib/nodia/config/recovery.json';

export function assertPristineJournal(value) {
  ensure(value?.operation === 'status' && value.first_sequence === 1 && value.last_sequence === 0 &&
    value.entries === 0 && value.unconfirmed === 0 && value.backups === 0 && value.expired_backups === 0 &&
    value.coverage_closed_at === null && value.release_authorized === false &&
    typeof value.coverage_from === 'string' && Number.isFinite(Date.parse(value.coverage_from)) &&
    typeof value.updated_at === 'string' && Number.isFinite(Date.parse(value.updated_at)), 'journal_not_pristine_open');
  return { first_sequence: 1, last_sequence: 0, entries: 0, backups: 0, open: true };
}

export function verifyInstallationMetadata(data, bootstrapEmail) {
  const expected = [...data.expectedMigrations].sort();
  ensure(expected.length === 45 && new Set(expected).size === 45 &&
    JSON.stringify(data.ledger.map(row => row.name).sort()) === JSON.stringify(expected), 'migration_ledger_mismatch');
  const columns = new Set(data.columns.map(row => `${row.table_schema}.${row.table_name}.${row.column_name}`));
  ensure(data.entities.length === 68 && data.entities.every(entity => entity.columns.every(column =>
    columns.has(`${entity.schema ?? 'public'}.${entity.tableName}.${column.databaseName}`))), 'entity_schema_mismatch');
  const counts = data.counts;
  ensure(counts.users === 1 && counts.user_roles === 1 && counts.user_modules === 4 && counts.ai_providers === 0 && counts.ai_keys === 0,
    'bootstrap_counts_mismatch');
  ensure(typeof bootstrapEmail === 'string' && bootstrapEmail.trim().length > 0 && data.accounts.length === 1 &&
    data.accounts[0].email === bootstrapEmail.trim().toLowerCase() && data.accounts[0].is_active === true, 'bootstrap_identity_mismatch');
  ensure(data.roles.length === 1 && data.roles[0].key === 'super_admin' && data.roles[0].is_active === true && data.roles[0].assignment_active === true,
    'bootstrap_role_mismatch');
  const modules = [...data.modules].sort((a, b) => a.key.localeCompare(b.key));
  ensure(JSON.stringify(modules.map(row => row.key)) === JSON.stringify(['actions', 'modules', 'roles', 'users']) &&
    modules.every(row => row.link === `/${row.key}` && row.group_key === 'general_settings' &&
      row.is_active === true && row.assignment_active === true && row.group_active === true), 'bootstrap_access_mismatch');
  return { migrations_verified: expected.length, entity_tables_verified: data.entities.length,
    migration_ledger_sha256: hash(JSON.stringify(expected)), users: 1, core_assignments: 4,
    provider_credentials: 0, migration_names: expected };
}

export async function readInstallationMetadata(client, dataSource, environment) {
  const metadata = (await client.query("SELECT current_database()=$1 AS matched,current_schema()='public' AS schema_public,current_setting('transaction_read_only') AS readonly", [environment.POSTGRES_DB])).rows[0];
  ensure(metadata.matched === true && metadata.schema_public === true && metadata.readonly === 'on', 'postcheck_database_invalid');
  const ledger = (await client.query('SELECT name FROM public.migrations ORDER BY name')).rows;
  const columns = (await client.query('SELECT table_schema,table_name,column_name FROM information_schema.columns')).rows;
  const counts = (await client.query(`SELECT (SELECT count(*)::int FROM public.users) AS users,
    (SELECT count(*)::int FROM public.user_roles) AS user_roles,(SELECT count(*)::int FROM public.user_modules) AS user_modules,
    (SELECT count(*)::int FROM public.ai_providers) AS ai_providers,(SELECT count(*)::int FROM public.ai_api_keys) AS ai_keys`)).rows[0];
  const accounts = (await client.query('SELECT email,is_active FROM public.users')).rows;
  const roles = (await client.query('SELECT r.key,r.is_active,ur.is_active AS assignment_active FROM public.roles r JOIN public.user_roles ur ON ur.role_id=r.id')).rows;
  const modules = (await client.query(`SELECT m.key,m.link,m.is_active,um.is_active AS assignment_active,g.key AS group_key,g.is_active AS group_active
    FROM public.modules m JOIN public.user_modules um ON um.module_id=m.id JOIN public.module_groups g ON g.id=m.module_group_id ORDER BY m.key`)).rows;
  return verifyInstallationMetadata({ expectedMigrations: dataSource.migrations.map(value => value.name ?? value.constructor.name),
    ledger, columns, entities: dataSource.entityMetadatas, counts, accounts, roles, modules }, environment.BOOTSTRAP_SUPER_ADMIN_EMAIL);
}

export async function closeInstallationClient(client) {
  let timer;
  try {
    await Promise.race([client.end(), new Promise(resolveClose => { timer = setTimeout(resolveClose, 2000); })]);
  } catch { /* Connection closure cannot reverse committed SQL; destroy the stream. */ }
  finally { clearTimeout(timer); client.connection?.stream?.destroy(); }
}

async function execute(mode, sourceSha) {
  ensure(['install', 'verify'].includes(mode) && /^[a-f0-9]{40}$/u.test(sourceSha), 'arguments_invalid');
  ensure(process.platform === 'linux' && process.getuid() !== 0 && process.env.NODE_ENV === 'production' &&
    process.env.PGSSLMODE === 'verify-full' && process.env.RATE_LIMIT_STORAGE === 'redis' &&
    process.env.NODIA_AI_RECOVERY_CONFIG_FILE === RECOVERY, 'private_runtime_invalid');
  const root = fs.realpathSync(process.cwd());
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));
  ensure(manifest.source_sha === sourceSha && manifest.source_provenance === 'git_archive' && manifest.deployment_eligible === true,
    'release_identity_mismatch');
  const require = createRequire(path.join(root, 'package.json'));
  const status = spawnSync(process.execPath, ['scripts/nodia-ai-journal.mjs', 'status', RECOVERY],
    { cwd: root, env: process.env, encoding: 'utf8', timeout: 30000, maxBuffer: 65536 });
  process.stderr.write(status.stderr ?? '');
  ensure(status.status === 0, 'journal_status_failed');
  const journal = assertPristineJournal(JSON.parse(status.stdout));
  const preflightPath = `/usr/local/lib/nodia/inspect-postgres-installation-${PREFLIGHT_SHA}.mjs`;
  const baselinePath = `/usr/local/lib/nodia/postgres-provider-baseline-${BASELINE_SHA}.json`;
  ensure(hash(fs.readFileSync(preflightPath)) === PREFLIGHT_SHA && hash(fs.readFileSync(baselinePath)) === BASELINE_SHA,
    'preflight_pin_mismatch');
  const preflight = await import(pathToFileURL(preflightPath));
  let inspection;
  if (mode === 'install') {
    inspection = await preflight.inspectPostgresInstallation({ catalogDetails: true, providerBaselineFile: baselinePath });
    ensure(inspection.status === 'inspected' && inspection.gates?.first_installation_preconditions === true &&
      inspection.extensions?.length === 2 && inspection.extensions.every(value => value.installed === true && value.installed_in_public === true),
      'fresh_database_preflight_failed');
    const seeded = spawnSync(process.execPath, ['scripts/seed-core.mjs', '--migrate'],
      { cwd: root, env: process.env, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
    // Keep every CLI byte in the root-owned private journal; none reaches public JSON.
    process.stderr.write(seeded.stdout ?? ''); process.stderr.write(seeded.stderr ?? '');
    ensure(seeded.status === 0, 'installation_cli_failed_no_automatic_retry');
  }
  require('reflect-metadata');
  const { default: dataSource } = await import(pathToFileURL(path.join(root, 'dist/config/data-source.js')));
  ensure(dataSource.options.synchronize === false, 'synchronize_must_be_disabled');
  // Build metadata without DataSource.initialize, which can install extensions.
  await dataSource.buildMetadatas();
  const { Client } = require('pg');
  const configuration = preflight.validatePostgresEnvironment(process.env);
  const client = new Client({ ...configuration, connectionTimeoutMillis: 10000, query_timeout: 10000,
    options: '-c default_transaction_read_only=on -c lock_timeout=3000', application_name: 'nodia-first-install-verification' });
  client.on('error', () => {});
  let transaction = false;
  try {
    await client.connect();
    ensure(client.connection.stream.encrypted === true && client.connection.stream.authorized === true, 'postcheck_tls_invalid');
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); transaction = true;
    const verified = await readInstallationMetadata(client, dataSource, process.env);
    await client.query('ROLLBACK'); transaction = false;
    return { schema_version: 1, status: 'verified', mode, source_sha: sourceSha, release_id: manifest.release_id,
      ...verified, journal, application_started: false, worker_started: false,
      migrations_requested: mode === 'install', postcheck_read_only: true, client_tls_authorized: true };
  } finally {
    if (transaction) await Promise.race([client.query('ROLLBACK').catch(() => {}), new Promise(resolveRollback => setTimeout(resolveRollback, 2000))]);
    await closeInstallationClient(client);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  Promise.resolve().then(() => { ensure(args.length === 2, 'arguments_invalid'); return execute(...args); }).then(value => process.stdout.write(JSON.stringify(value) + '\n')).catch(error => {
    const code = error instanceof Error && /^[a-z0-9_]{1,100}$/u.test(error.message) ? error.message : 'installation_action_failed';
    process.stderr.write(code + '\n'); process.exitCode = 1;
  });
}
