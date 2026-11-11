#!/usr/bin/env node
// Operator-only catalog inspection. Never imports application bootstrap or dotenv.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fail = code => { throw Object.assign(new Error('PostgreSQL inspection rejected'), { code }); };
const ensure = (condition, code = 'NODIA_METADATA_INVALID') => { if (!condition) fail(code); };
const extensionNames = ['uuid-ossp', 'pg_trgm'];
const versionText = value => typeof value === 'string' && /^[A-Za-z0-9_.+-]{1,64}$/u.test(value);
const bool = value => { ensure(typeof value === 'boolean'); return value; };
const count = value => {
  ensure((typeof value === 'number' || typeof value === 'string') && /^(0|[1-9][0-9]*)$/u.test(String(value)));
  const result = Number(value); ensure(Number.isSafeInteger(result)); return result;
};
const flags = { application_started: false, migrations_executed: false, mutations_requested: false };

export function validatePostgresEnvironment(environment) {
  ensure(environment.PGSSLMODE === 'verify-full' &&
    (!environment.NODE_TLS_REJECT_UNAUTHORIZED || environment.NODE_TLS_REJECT_UNAUTHORIZED === '1'),
  'NODIA_CONFIGURATION_INVALID');
  for (const key of ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']) {
    const value = environment[key];
    ensure(typeof value === 'string' && value.length > 0 && value.length <= 4096 && !value.includes('\0'),
      'NODIA_CONFIGURATION_INVALID');
  }
  ensure(!/[\s,@\/=]/u.test(environment.POSTGRES_HOST) &&
    /^[1-9][0-9]{0,4}$/u.test(environment.POSTGRES_PORT) && Number(environment.POSTGRES_PORT) <= 65535,
  'NODIA_CONFIGURATION_INVALID');
  return { host: environment.POSTGRES_HOST, port: Number(environment.POSTGRES_PORT),
    database: environment.POSTGRES_DB, user: environment.POSTGRES_USER, password: environment.POSTGRES_PASSWORD };
}

export function deriveInstallationInspection(metadata, inventory, extensions, stream) {
  const protocol = stream?.getProtocol?.();
  ensure(stream?.encrypted === true && stream?.authorized === true && ['TLSv1.2', 'TLSv1.3'].includes(protocol),
    'NODIA_TLS_INVALID');
  ensure(metadata?.database_matched === true && metadata?.transaction_read_only === 'on');
  const version = count(metadata.server_version_num); ensure(version > 0 && version <= 99_999_999);
  const defaultSchemaPublic = bool(metadata.default_schema_public);
  const privileges = { database_create: bool(metadata.database_create), public_schema_present: bool(metadata.public_schema_present),
    public_schema_usage: bool(metadata.public_schema_usage), public_schema_create: bool(metadata.public_schema_create) };
  const counts = Object.fromEntries(['user_schemas', 'relations', 'routines', 'types', 'unexpected_extensions']
    .map(key => [key, count(inventory?.[key])]));
  ensure(Array.isArray(extensions) && extensions.length === extensionNames.length);
  const parsedExtensions = extensionNames.map(name => {
    const matched = extensions.filter(row => row?.name === name); ensure(matched.length === 1);
    const row = matched[0];
    const available = bool(row.available), installed = bool(row.installed);
    ensure(row.default_version === null || versionText(row.default_version));
    ensure(row.installed_version === null || versionText(row.installed_version));
    ensure((available && row.default_version !== null && typeof row.trusted === 'boolean') ||
      (!available && row.default_version === null && row.trusted === null));
    ensure((installed && row.installed_version !== null && typeof row.installed_in_public === 'boolean') ||
      (!installed && row.installed_version === null && row.installed_in_public === null));
    return { name, available, default_version: row.default_version, trusted: row.trusted,
      installed, installed_version: row.installed_version, installed_in_public: row.installed_in_public };
  });
  const empty = Object.values(counts).every(value => value === 0);
  const writable = privileges.public_schema_present && privileges.public_schema_usage && privileges.public_schema_create;
  const installable = parsedExtensions.every(extension => extension.installed ? extension.installed_in_public :
    extension.available && extension.trusted && privileges.database_create && writable);
  return { schema_version: 1, status: 'inspected', postgres: { database_matched: true, server_version_num: version,
    transaction_read_only: true, client_tls_authorized: true, client_tls_protocol: protocol,
    backend_tls: typeof metadata.backend_tls === 'boolean' ? metadata.backend_tls : null }, privileges, inventory: counts,
  extensions: parsedExtensions, gates: { empty_destination: empty, public_schema_writable: writable, default_schema_public: defaultSchemaPublic,
    required_extensions_installable: installable, first_installation_preconditions: empty && writable && installable && defaultSchemaPublic }, ...flags };
}

export const metadataSql = `SELECT current_database() = $1 AS database_matched,
  current_setting('server_version_num') AS server_version_num,
  current_setting('transaction_read_only') AS transaction_read_only,
  current_schema() = 'public' AS default_schema_public,
  has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
  EXISTS (SELECT FROM pg_namespace WHERE nspname = 'public') AS public_schema_present,
  COALESCE((SELECT has_schema_privilege(current_user, oid, 'USAGE') FROM pg_namespace WHERE nspname = 'public'), false) AS public_schema_usage,
  COALESCE((SELECT has_schema_privilege(current_user, oid, 'CREATE') FROM pg_namespace WHERE nspname = 'public'), false) AS public_schema_create,
  tls.ssl AS backend_tls FROM (SELECT 1) AS probe
  LEFT JOIN pg_stat_ssl AS tls ON tls.pid = pg_backend_pid()`;

// Extension membership and its automatic/internal dependents are excluded, while
// user objects merely referencing extension types/functions remain in the inventory.
export const inventorySql = `WITH RECURSIVE extension_owned(classid, objid) AS (
  SELECT classid, objid FROM pg_depend WHERE deptype = 'e'
  UNION
  SELECT dependency.classid, dependency.objid FROM pg_depend AS dependency
  JOIN extension_owned AS owner ON dependency.refclassid = owner.classid AND dependency.refobjid = owner.objid
  WHERE dependency.deptype IN ('a', 'i')
), user_namespaces AS (
  SELECT oid, nspname FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
)
SELECT
  (SELECT count(*)::text FROM user_namespaces AS object WHERE nspname <> 'public' AND NOT EXISTS
    (SELECT FROM extension_owned WHERE classid = 'pg_namespace'::regclass AND objid = object.oid)) AS user_schemas,
  (SELECT count(*)::text FROM pg_class AS object JOIN user_namespaces AS namespace ON namespace.oid = object.relnamespace
    WHERE NOT EXISTS (SELECT FROM extension_owned WHERE classid = 'pg_class'::regclass AND objid = object.oid)) AS relations,
  (SELECT count(*)::text FROM pg_proc AS object JOIN user_namespaces AS namespace ON namespace.oid = object.pronamespace
    WHERE NOT EXISTS (SELECT FROM extension_owned WHERE classid = 'pg_proc'::regclass AND objid = object.oid)) AS routines,
  (SELECT count(*)::text FROM pg_type AS object JOIN user_namespaces AS namespace ON namespace.oid = object.typnamespace
    WHERE NOT EXISTS (SELECT FROM extension_owned WHERE classid = 'pg_type'::regclass AND objid = object.oid)) AS types,
  (SELECT count(*)::text FROM pg_extension WHERE extname NOT IN ('plpgsql', 'uuid-ossp', 'pg_trgm')) AS unexpected_extensions`;

export const extensionsSql = `SELECT wanted.name, available.name IS NOT NULL AS available,
  available.default_version, version.trusted, installed.oid IS NOT NULL AS installed,
  installed.extversion AS installed_version,
  CASE WHEN installed.oid IS NULL THEN NULL ELSE namespace.nspname = 'public' END AS installed_in_public
  FROM (VALUES ('uuid-ossp'), ('pg_trgm')) AS wanted(name)
  LEFT JOIN pg_available_extensions AS available ON available.name = wanted.name
  LEFT JOIN pg_available_extension_versions AS version ON version.name = wanted.name AND version.version = available.default_version
  LEFT JOIN pg_extension AS installed ON installed.extname = wanted.name
  LEFT JOIN pg_namespace AS namespace ON namespace.oid = installed.extnamespace
  ORDER BY wanted.name`;

function safeError(error) {
  if (error?.code === 'NODIA_CONFIGURATION_INVALID') return 'configuration_invalid';
  if (error?.code === 'NODIA_METADATA_INVALID') return 'metadata_invalid';
  if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL'].includes(error?.code)) return 'dns_error';
  if (['ETIMEDOUT', '57014'].includes(error?.code) || /^(?:AbortError|TimeoutError)$/u.test(error?.name ?? '')) return 'timeout';
  if (['28P01', '28000'].includes(error?.code)) return 'authentication_error';
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE'].includes(error?.code)) return 'connection_error';
  if (error?.code === 'NODIA_TLS_INVALID' || (typeof error?.code === 'string' &&
    (/^(?:ERR_TLS_|ERR_SSL_)/u.test(error.code) || ['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT',
      'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(error.code)))) return 'tls_error';
  return 'query_error';
}

export async function inspectPostgresInstallation() {
  let client, transaction = false;
  try {
    const configuration = validatePostgresEnvironment(process.env);
    const require = createRequire(resolve(process.cwd(), 'package.json'));
    const { Client } = require('pg');
    client = new Client({ ...configuration, sslnegotiation: 'postgres',
      application_name: 'nodia-production-installation-preflight', connectionTimeoutMillis: 10_000,
      query_timeout: 10_000, statement_timeout: 10_000,
      options: '-c default_transaction_read_only=on -c lock_timeout=3000' });
    client.on('error', () => {});
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); transaction = true;
    const metadata = await client.query(metadataSql, [configuration.database]);
    const inventory = await client.query(inventorySql);
    const extensions = await client.query(extensionsSql);
    ensure(metadata.rowCount === 1 && inventory.rowCount === 1);
    const result = deriveInstallationInspection(metadata.rows[0], inventory.rows[0], extensions.rows, client.connection.stream);
    await client.query('ROLLBACK'); transaction = false;
    return result;
  } catch (error) {
    return { schema_version: 1, status: 'failed', error_code: safeError(error), ...flags };
  } finally {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    if (client) {
      let timer;
      try { await Promise.race([client.end(), new Promise(resolveClose => { timer = setTimeout(resolveClose, 2000); })]); }
      catch { /* Never publish a raw driver exception. */ }
      finally { clearTimeout(timer); client.connection?.stream?.destroy(); }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await inspectPostgresInstallation();
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'inspected' ? (result.gates.first_installation_preconditions ? 0 : 2) : 1;
}
