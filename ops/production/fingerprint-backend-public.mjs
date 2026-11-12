// Data-only equality evidence: PUBLIC base-table row counts and MD5 bags, wrapped in SHA256.
// Does not attest sequences, DDL, extension data, or resistance to deliberately colliding MD5 inputs.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCE = 'f01b493336883403a84b1c80759ce4fc43cbd370';
const INSPECTOR_SHA = 'd720a261ddb9d414949b395c6a10fcb05faccf67b57ac48bbaf3072f189d05d3';
const PROFILE_SHA = '7f4977ac62b5bae24e193f8848b7ec6dd1fda8b3e94cdb19a76c554a5e69dd7f';
const INSPECTOR = `/usr/local/lib/nodia/inspect-postgres-installation-${INSPECTOR_SHA}.mjs`;
const PROFILE = `/usr/local/lib/nodia/postgres-provider-baseline-${PROFILE_SHA}.json`;
const MAX_TABLES = 100;
const MAX_ROWS = 1_000_000;
const MAX_TABLE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (condition, code) => { if (!condition) throw Object.assign(new Error('Fingerprint rejected'), { safeCode: code }); };
const closed = (value, names) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));

export function quotePublicTable(name) {
  ensure(typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/u.test(name), 'table_identifier_invalid');
  return `"public"."${name}"`;
}

export function fingerprintDigest(tables) {
  ensure(Array.isArray(tables) && tables.length <= MAX_TABLES, 'table_limit_exceeded');
  let previous = null;
  const normalized = tables.map(value => {
    ensure(closed(value, ['name', 'rows', 'md5']), 'fingerprint_metadata_invalid');
    quotePublicTable(value.name);
    ensure((previous === null || previous < value.name) && Number.isSafeInteger(value.rows) && value.rows >= 0 && value.rows <= MAX_ROWS &&
      typeof value.md5 === 'string' && /^[a-f0-9]{32}$/u.test(value.md5), 'fingerprint_metadata_invalid');
    previous = value.name;
    return { name: value.name, rows: value.rows, md5: value.md5 };
  });
  return hash(JSON.stringify(normalized));
}

export function validateFingerprint(value) {
  ensure(closed(value, ['tables', 'aggregate_sha256']) && typeof value.aggregate_sha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(value.aggregate_sha256) && fingerprintDigest(value.tables) === value.aggregate_sha256,
  'fingerprint_digest_mismatch');
  return value;
}

function count(value, maximum, code) {
  ensure((typeof value === 'number' || typeof value === 'string') && /^(0|[1-9][0-9]*)$/u.test(String(value)), code);
  const parsed = Number(value); ensure(Number.isSafeInteger(parsed) && parsed <= maximum, code); return parsed;
}

export const publicTablesSql = `WITH RECURSIVE extension_owned(classid,objid) AS (
 SELECT classid,objid FROM pg_catalog.pg_depend WHERE deptype='e'
 UNION
 SELECT d.classid,d.objid FROM pg_catalog.pg_depend d JOIN extension_owned owner
 ON d.refclassid=owner.classid AND d.refobjid=owner.objid WHERE d.deptype IN ('a','i')
)
SELECT c.relname AS name,c.relrowsecurity AS row_security,c.relforcerowsecurity AS force_row_security
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT EXISTS (
 SELECT 1 FROM extension_owned WHERE classid='pg_catalog.pg_class'::regclass AND objid=c.oid)
ORDER BY c.relname COLLATE "C" LIMIT 101`;

/** Caller owns BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY and its final ROLLBACK.
 * No connection/environment/application imports here; usable in isolated restore quarantine.
 */
export async function fingerprintPublicSchema(client) {
  const state = await client.query(`SELECT current_setting('transaction_read_only') AS readonly,
    current_setting('transaction_isolation') AS isolation,current_setting('server_encoding') AS encoding`);
  ensure(state.rows.length === 1 && state.rows[0].readonly === 'on' && state.rows[0].isolation === 'repeatable read' &&
    state.rows[0].encoding === 'UTF8', 'read_only_repeatable_utf8_transaction_required');
  // SAVEPOINT fails outside an explicit transaction, even if connection defaults are read-only/repeatable-read.
  await client.query('SAVEPOINT nodia_public_fingerprint');
  let succeeded = false;
  try {
    await client.query(`SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='3s';
      SET LOCAL search_path=pg_catalog; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD';
      SET LOCAL intervalstyle='postgres'; SET LOCAL extra_float_digits=3; SET LOCAL bytea_output='hex'`);
    const catalog = await client.query(publicTablesSql);
    ensure(catalog.rows.length <= MAX_TABLES, 'table_limit_exceeded');
    const tables = [];
    let totalBytes = 0;
    const deadline = Date.now() + 120_000;
    for (const relation of catalog.rows) {
      ensure(Date.now() < deadline, 'fingerprint_deadline_exceeded');
      ensure(relation.row_security === false && relation.force_row_security === false, 'row_security_filtering_not_supported');
      const table = quotePublicTable(relation.name);
      const measured = await client.query(`SELECT count(*)::text AS rows,
        COALESCE(sum(octet_length(row_to_json(t)::text)),0)::text AS serialized_bytes FROM ONLY ${table} AS t`);
      ensure(measured.rows.length === 1, 'fingerprint_metadata_invalid');
      const rows = count(measured.rows[0].rows, MAX_ROWS, 'row_limit_exceeded');
      const bytes = count(measured.rows[0].serialized_bytes, MAX_TABLE_BYTES, 'table_byte_limit_exceeded') + Math.max(rows - 1, 0);
      ensure(bytes <= MAX_TABLE_BYTES, 'table_byte_limit_exceeded');
      totalBytes += bytes; ensure(totalBytes <= MAX_TOTAL_BYTES, 'total_byte_limit_exceeded');
      const fingerprint = await client.query(`SELECT count(*)::text AS rows,
        md5(COALESCE(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text COLLATE "C"),'')) AS md5
        FROM ONLY ${table} AS t`);
      ensure(fingerprint.rows.length === 1 && count(fingerprint.rows[0].rows, MAX_ROWS, 'row_limit_exceeded') === rows &&
        typeof fingerprint.rows[0].md5 === 'string' && /^[a-f0-9]{32}$/u.test(fingerprint.rows[0].md5), 'fingerprint_metadata_invalid');
      tables.push({ name: relation.name, rows, md5: fingerprint.rows[0].md5 });
    }
    const result = { tables, aggregate_sha256: fingerprintDigest(tables) };
    succeeded = true;
    return result;
  } finally {
    if (!succeeded) await client.query('ROLLBACK TO SAVEPOINT nodia_public_fingerprint').catch(() => {});
    await client.query('RELEASE SAVEPOINT nodia_public_fingerprint');
  }
}

function safeError(error) {
  if (typeof error?.safeCode === 'string' && /^[a-z0-9_]{1,100}$/u.test(error.safeCode)) return error.safeCode;
  if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL'].includes(error?.code)) return 'dns_error';
  if (['ETIMEDOUT', '57014'].includes(error?.code)) return 'timeout';
  if (['28P01', '28000'].includes(error?.code)) return 'authentication_error';
  if (typeof error?.code === 'string' && /^(?:ERR_TLS_|ERR_SSL_|CERT_|DEPTH_ZERO_|SELF_SIGNED_|UNABLE_TO_VERIFY_|UNABLE_TO_GET_)/u.test(error.code)) return 'tls_invalid';
  return 'fingerprint_failed';
}

async function main(sourceSha) {
  let client, transaction = false;
  try {
    ensure(process.platform === 'linux' && process.getuid() === 900 && sourceSha === SOURCE && process.env.NODE_ENV === 'production' &&
      process.env.PGSSLMODE === 'verify-full', 'private_runtime_invalid');
    const root = fs.realpathSync(process.cwd());
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));
    ensure(manifest.source_sha === sourceSha && manifest.source_provenance === 'git_archive' && manifest.deployment_eligible === true &&
      manifest.release_id === path.basename(root) && /^[a-f0-9]{64}$/u.test(manifest.package_tree_sha256) &&
      manifest.release_id === `backend-${sourceSha.slice(0, 12)}-${manifest.package_tree_sha256.slice(0, 12)}`, 'release_identity_invalid');
    ensure(hash(fs.readFileSync(process.execPath)) === manifest.runtime.executable_sha256 &&
      hash(fs.readFileSync(INSPECTOR)) === INSPECTOR_SHA && hash(fs.readFileSync(PROFILE)) === PROFILE_SHA, 'installed_pin_invalid');
    const preflight = await import(pathToFileURL(INSPECTOR));
    const profile = await preflight.loadProviderBaselineFile(PROFILE);
    const configuration = preflight.validatePostgresEnvironment(process.env);
    preflight.assertProviderBaselineDestination(profile, { host: configuration.host, port: configuration.port, database: configuration.database });
    const { Client } = createRequire(path.join(root, 'package.json'))('pg');
    client = new Client({ ...configuration, sslnegotiation: 'postgres', application_name: 'nodia-public-fingerprint-readonly',
      connectionTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 10_000,
      options: '-c default_transaction_read_only=on -c lock_timeout=3000' });
    client.on('error', () => {});
    await client.connect();
    const stream = client.connection.stream, protocol = stream?.getProtocol?.();
    ensure(stream?.encrypted === true && stream?.authorized === true && ['TLSv1.2', 'TLSv1.3'].includes(protocol), 'tls_invalid');
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); transaction = true;
    const fingerprint = await fingerprintPublicSchema(client);
    await client.query('ROLLBACK'); transaction = false;
    return { schema_version: 1, status: 'fingerprinted', source_sha: sourceSha, release_id: manifest.release_id, fingerprint,
      postgres: { transaction_read_only: true, isolation_level: 'repeatable read', client_tls_authorized: true, client_tls_protocol: protocol },
      mutations_requested: false, rows_exposed: false, application_started: false };
  } catch (error) {
    return { schema_version: 1, status: 'failed', error_code: safeError(error), mutations_requested: false, rows_exposed: false, application_started: false };
  } finally {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    if (client) {
      let timer;
      try { await Promise.race([client.end(), new Promise(resolve => { timer = setTimeout(resolve, 2000); })]); }
      catch { /* Never publish raw connection or row data. */ }
      finally { clearTimeout(timer); client.connection?.stream?.destroy(); }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = process.argv.length === 3 ? await main(process.argv[2]) :
    { schema_version: 1, status: 'failed', error_code: 'arguments_invalid', mutations_requested: false, rows_exposed: false, application_started: false };
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'fingerprinted' ? 0 : 1;
}
