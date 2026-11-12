// First-start READ ONLY snapshot for the exact f01 package. Never imports AppModule or initializes TypeORM.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCE = 'f01b493336883403a84b1c80759ce4fc43cbd370';
const INSPECTOR_SHA = 'd720a261ddb9d414949b395c6a10fcb05faccf67b57ac48bbaf3072f189d05d3';
const PROFILE_SHA = '7f4977ac62b5bae24e193f8848b7ec6dd1fda8b3e94cdb19a76c554a5e69dd7f';
const PROFILE = `/usr/local/lib/nodia/postgres-provider-baseline-${PROFILE_SHA}.json`;
const INSPECTOR = `/usr/local/lib/nodia/inspect-postgres-installation-${INSPECTOR_SHA}.mjs`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (condition, code = 'metadata_invalid') => { if (!condition) throw Object.assign(new Error('Start readiness rejected'), { safeCode: code }); };
const flags = { application_started: false, worker_started: false, mutations_requested: false,
  provider_inference_requested: false, boot_performs_no_writes_claimed: false };

// Sources f01: invoice/product-image immediate recovery ticks; Worker claims,
// retention, execution/secure-flow recovery and Teacher recovery. All these tables
// must be empty for this first-start procedure, including terminal/unknown witnesses.
export const emptyTables = Object.freeze([
  'nodia_ai_conversations', 'nodia_ai_jobs', 'nodia_ai_job_attempts', 'nodia_ai_runs',
  'nodia_ai_executions', 'nodia_ai_execution_steps', 'nodia_ai_runtime_slots',
  'nodia_ai_attachments', 'nodia_ai_preferences', 'nodia_ai_confirmation_challenges',
  'nodia_ai_proposals', 'nodia_ai_proposal_revisions', 'nodia_ai_proposal_steps', 'nodia_ai_drafts',
  'teacher_sessions', 'teacher_generation_jobs', 'teacher_generation_attempts', 'teacher_attempts',
  'ai_generation_operations', 'nodia_ai_api_dispatches', 'invoice_uploads', 'product_images',
  'ai_providers', 'ai_api_keys',
]);
const activePredicates = Object.freeze({
  jobs_ready: ['nodia_ai_jobs', "state='ready'"], jobs_leased: ['nodia_ai_jobs', "state='leased'"],
  jobs_waiting: ['nodia_ai_jobs', "state='waiting'"], jobs_unknown: ['nodia_ai_jobs', "state='unknown'"],
  runs_queued: ['nodia_ai_runs', "state='queued'"], runs_running: ['nodia_ai_runs', "state='running'"],
  runs_cancel_requested: ['nodia_ai_runs', "state='cancel_requested'"], runs_unknown: ['nodia_ai_runs', "state='unknown'"],
  executions_queued: ['nodia_ai_executions', "state='queued'"], executions_running: ['nodia_ai_executions', "state='running'"],
  executions_waiting_for_user: ['nodia_ai_executions', "state='waiting_for_user'"], executions_unknown: ['nodia_ai_executions', "state='unknown'"],
  generation_operations_unclosed: ['ai_generation_operations', "phase<>'closed'"],
  teacher_jobs_queued: ['teacher_generation_jobs', "state='queued'"], teacher_jobs_running: ['teacher_generation_jobs', "state='running'"],
  teacher_jobs_paused: ['teacher_generation_jobs', "state='blocked_paused'"], teacher_jobs_unknown: ['teacher_generation_jobs', "state='unknown'"],
  teacher_attempts_in_progress: ['teacher_attempts', "state='in_progress'"],
  invoice_uploads_due: ['invoice_uploads', 'retry_after<=clock_timestamp()'],
  product_image_cleanup_due: ['product_images', 'NOT is_current AND retry_after<=clock_timestamp()'],
});
export const counterNames = Object.freeze([...emptyTables.map(name => `${name}_total`), ...Object.keys(activePredicates)]);
export const countersSql = `SELECT ${[
  ...emptyTables.map(name => `(SELECT count(*)::text FROM public.${name}) AS ${name}_total`),
  ...Object.entries(activePredicates).map(([name, [table, predicate]]) => `(SELECT count(*)::text FROM public.${table} WHERE ${predicate}) AS ${name}`),
].join(',\n')}`;

export const scopeSql = `SELECT
 (SELECT count(*)::text FROM pg_catalog.pg_largeobject_metadata) AS large_objects,
 (SELECT count(*)::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN ('public','information_schema')) AS nonpublic_relations,
 (SELECT count(*)::text FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
  WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN ('public','information_schema')) AS nonpublic_types,
 COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM (SELECT nspname AS name,
  nspowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user) AS owner_is_current
  FROM pg_catalog.pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema') ORDER BY nspname LIMIT 101) s),'[]'::jsonb) AS schemas,
 COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT n.nspname AS schema,p.proname AS name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS signature,p.prokind::text AS kind,l.lanname AS language,
  p.prosecdef AS security_definer,p.proowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user) AS owner_is_current
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_catalog.pg_language l ON l.oid=p.prolang
  WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN ('public','information_schema')
  ORDER BY n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) LIMIT 101) r),'[]'::jsonb) AS routines`;

function count(value) {
  ensure((typeof value === 'string' || typeof value === 'number') && /^(0|[1-9][0-9]*)$/u.test(String(value)));
  const result = Number(value); ensure(Number.isSafeInteger(result)); return result;
}
function sameRecords(observed, expected) {
  if (!Array.isArray(observed) || !Array.isArray(expected) || observed.length !== expected.length || observed.length > 100) return false;
  const canonical = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify(observed.map(canonical)) === JSON.stringify(expected.map(canonical));
}

export function deriveStartReadiness({ metadata, stream, scope, counters, ledger, expectedMigrations, entities, columns, providerCatalog }) {
  ensure(metadata?.database_matched === true && metadata.default_schema_public === true && metadata.transaction_read_only === 'on' &&
    metadata.isolation_level === 'repeatable read', 'read_only_metadata_invalid');
  const protocol = stream?.getProtocol?.();
  ensure(stream?.encrypted === true && stream?.authorized === true && ['TLSv1.2', 'TLSv1.3'].includes(protocol), 'tls_invalid');
  ensure(scope && typeof scope === 'object' && counters && typeof counters === 'object' &&
    Object.keys(counters).length === counterNames.length && counterNames.every(name => Object.hasOwn(counters, name)));
  const parsed = Object.fromEntries(counterNames.map(name => [name, count(counters[name])]));
  const largeObjects = count(scope.large_objects), foreignRelations = count(scope.nonpublic_relations), foreignTypes = count(scope.nonpublic_types);
  const providerScope = sameRecords(scope.schemas, providerCatalog?.schemas) && sameRecords(scope.routines, providerCatalog?.routines) &&
    foreignRelations === 0 && foreignTypes === 0;
  ensure(Array.isArray(expectedMigrations) && expectedMigrations.length === 45 && new Set(expectedMigrations).size === 45 &&
    expectedMigrations.every(name => /^[A-Za-z][A-Za-z0-9_]{1,150}$/u.test(name)) &&
    Array.isArray(ledger) && ledger.length <= 100, 'migration_metadata_invalid');
  const expected = [...expectedMigrations].sort();
  const ledgerMatches = JSON.stringify(ledger.map(row => row.name).sort()) === JSON.stringify(expected);
  ensure(Array.isArray(entities) && entities.length === 68 && Array.isArray(columns) && columns.length <= 10_000, 'entity_metadata_invalid');
  const present = new Set(columns.map(row => `${row.table_schema}.${row.table_name}.${row.column_name}`));
  const entitiesMatch = entities.every(entity => (entity.schema ?? 'public') === 'public' && entity.columns.every(column =>
    present.has(`public.${entity.tableName}.${column.databaseName}`)));
  const empty = Object.values(parsed).every(value => value === 0);
  const gates = { provider_scope_matches: providerScope, no_large_objects: largeObjects === 0,
    public_entity_schema_matches: entitiesMatch, exact_migration_ledger: ledgerMatches, persisted_runtime_empty: empty };
  return { schema_version: 1, status: Object.values(gates).every(value => value) ? 'ready_to_start_empty' : 'blocked',
    postgres: { database_matched: true, server_version_num: count(metadata.server_version_num), transaction_read_only: true,
      isolation_level: 'repeatable read', client_tls_authorized: true, client_tls_protocol: protocol },
    scope: { provider_schema_count: Array.isArray(scope.schemas) ? scope.schemas.length : null,
      nonpublic_relations: foreignRelations, nonpublic_types: foreignTypes, large_objects: largeObjects },
    migrations: { expected: 45, observed: ledger.length, ledger_sha256: ledgerMatches ? hash(JSON.stringify(expected)) : null },
    entity_tables_expected: 68, counters: parsed, gates, ...flags };
}

export function safeError(error) {
  if (['metadata_invalid', 'read_only_metadata_invalid', 'tls_invalid', 'migration_metadata_invalid', 'entity_metadata_invalid',
    'runtime_invalid', 'release_invalid', 'installed_helper_pin_invalid'].includes(error?.safeCode)) return error.safeCode;
  if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL'].includes(error?.code)) return 'dns_error';
  if (['ETIMEDOUT', '57014'].includes(error?.code) || ['AbortError', 'TimeoutError'].includes(error?.name)) return 'timeout';
  if (['28P01', '28000'].includes(error?.code)) return 'authentication_error';
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE'].includes(error?.code)) return 'connection_error';
  if (typeof error?.code === 'string' && /^(?:ERR_TLS_|ERR_SSL_|CERT_|DEPTH_ZERO_|SELF_SIGNED_|UNABLE_TO_VERIFY_|UNABLE_TO_GET_)/u.test(error.code)) return 'tls_invalid';
  return 'query_or_configuration_error';
}

export async function inspectBackendStartReadiness(sourceSha) {
  let client, transaction = false;
  try {
    ensure(process.platform === 'linux' && process.getuid() === 900 && sourceSha === SOURCE && process.env.NODE_ENV === 'production' &&
      process.env.PGSSLMODE === 'verify-full' && process.env.NODIA_AI_OPERATION_MODE === 'normal', 'runtime_invalid');
    const root = fs.realpathSync(process.cwd());
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));
    ensure(manifest.source_sha === sourceSha && manifest.source_provenance === 'git_archive' && manifest.deployment_eligible === true,
      'release_invalid');
    ensure(hash(fs.readFileSync(INSPECTOR)) === INSPECTOR_SHA && hash(fs.readFileSync(PROFILE)) === PROFILE_SHA, 'installed_helper_pin_invalid');
    const preflight = await import(pathToFileURL(INSPECTOR));
    const profile = await preflight.loadProviderBaselineFile(PROFILE);
    const configuration = preflight.validatePostgresEnvironment(process.env);
    preflight.assertProviderBaselineDestination(profile, { host: configuration.host, port: configuration.port, database: configuration.database });
    const require = createRequire(path.join(root, 'package.json'));
    require('reflect-metadata');
    const { default: dataSource } = await import(pathToFileURL(path.join(root, 'dist/config/data-source.js')));
    ensure(dataSource.options.synchronize === false && dataSource.isInitialized === false, 'runtime_invalid');
    await dataSource.buildMetadatas(); // Imports metadata only; never initialize/connect/install extensions.
    const { Client } = require('pg');
    client = new Client({ ...configuration, sslnegotiation: 'postgres', application_name: 'nodia-first-start-readonly',
      connectionTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 10_000,
      options: '-c default_transaction_read_only=on -c lock_timeout=3000' });
    client.on('error', () => {});
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); transaction = true;
    const metadata = (await client.query(`SELECT current_database()=$1 AS database_matched,current_schema()='public' AS default_schema_public,
      current_setting('transaction_read_only') AS transaction_read_only,current_setting('transaction_isolation') AS isolation_level,
      current_setting('server_version_num') AS server_version_num`, [configuration.database])).rows[0];
    const scope = (await client.query(scopeSql)).rows[0];
    const columns = (await client.query('SELECT table_schema,table_name,column_name FROM information_schema.columns')).rows;
    const ledger = (await client.query('SELECT name FROM public.migrations ORDER BY name')).rows;
    const counters = (await client.query(countersSql)).rows[0];
    const result = deriveStartReadiness({ metadata, scope, columns, ledger, counters, stream: client.connection.stream,
      expectedMigrations: dataSource.migrations.map(value => value.name ?? value.constructor.name), entities: dataSource.entityMetadatas,
      providerCatalog: profile.catalog });
    await client.query('ROLLBACK'); transaction = false;
    return { ...result, source_sha: sourceSha, release_id: manifest.release_id };
  } catch (error) {
    return { schema_version: 1, status: 'blocked', error_code: safeError(error), ...flags };
  } finally {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    if (client) {
      let timer;
      try { await Promise.race([client.end(), new Promise(resolve => { timer = setTimeout(resolve, 2000); })]); }
      catch { /* No raw driver/connection exception is published. */ }
      finally { clearTimeout(timer); client.connection?.stream?.destroy(); }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argumentsValid = process.argv.length === 3;
  const result = argumentsValid ? await inspectBackendStartReadiness(process.argv[2]) :
    { schema_version: 1, status: 'blocked', error_code: 'arguments_invalid', ...flags };
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'ready_to_start_empty' ? 0 : 1;
}
