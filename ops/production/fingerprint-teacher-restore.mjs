// Teacher adoption equality fingerprint: separate bounded profile, up to256 public tables.
// Same row/byte/deadline/RLS and extension-owned exclusions as the historical100-table profile.
// Data equality only: no sequence/DDL attestation or deliberately colliding-MD5 guarantee.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
export const MAX_TABLES = 256;
const MAX_ROWS = 1_000_000;
const MAX_TABLE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (condition, code) => { if (!condition) throw Object.assign(new Error('Teacher fingerprint rejected'), { safeCode: code }); };
const closed = (value, names) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
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
ORDER BY c.relname COLLATE "C" LIMIT 257`;

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

export function validateCaptureIdentity(manifest, digest, [source, manifestHash, release, tree]) {
  ensure(/^[a-f0-9]{40}$/u.test(source ?? '') && /^[a-f0-9]{64}$/u.test(manifestHash ?? '') && /^[a-f0-9]{64}$/u.test(tree ?? '') &&
    release === `backend-${source.slice(0, 12)}-${tree.slice(0, 12)}` && digest === manifestHash && manifest.schema_version === 1 &&
    manifest.source_sha === source && manifest.release_id === release && manifest.package_tree_sha256 === tree &&
    manifest.source_provenance === 'git_archive' && manifest.deployment_eligible === true, 'capture_release_identity_invalid');
}
export async function captureTeacherFingerprint(identity) {
  ensure(identity.length === 4 && process.platform === 'linux' && process.getuid() === 900 &&
    process.env.PGSSLMODE === 'verify-full' && process.env.DOTENV_CONFIG_PATH === '/dev/null', 'private_capture_identity_required');
  const root = fs.realpathSync(process.cwd());
  ensure(path.dirname(root) === '/opt/nodia/releases' && path.basename(root) === identity[2] && fs.realpathSync('/opt/nodia/current') === root, 'current_release_required');
  const raw = fs.readFileSync(path.join(root, 'release-manifest.json'));
  const manifest = JSON.parse(raw);
  validateCaptureIdentity(manifest, hash(raw), identity);
  ensure(hash(fs.readFileSync(process.execPath)) === manifest.runtime?.executable_sha256, 'capture_node_identity_invalid');
  for (const name of ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'])
    ensure(typeof process.env[name] === 'string' && process.env[name].length > 0, 'private_database_configuration_required');
  const { Client } = createRequire(path.join(root, 'package.json'))('pg');
  const client = new Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT), user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB, ssl: { rejectUnauthorized: true },
    application_name: 'nodia-teacher-restore-fingerprint', connectionTimeoutMillis: 10000, query_timeout: 15000,
    options: '-c default_transaction_read_only=on -c lock_timeout=3000' });
  client.on('error', () => {});
  try {
    await client.connect();
    const stream = client.connection.stream;
    ensure(stream.authorized === true && ['TLSv1.2', 'TLSv1.3'].includes(stream.getProtocol?.()), 'capture_tls_invalid');
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const fingerprint = await fingerprintPublicSchema(client);
    await client.query('ROLLBACK');
    return fingerprint;
  } finally { await client.end().catch(() => {}); client.connection?.stream?.destroy(); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length === 2) process.stdout.write(JSON.stringify({ inert: true, database_requested: false }) + '\n');
  else {
    try {
      ensure(process.argv[2] === '--capture' && process.argv.length === 7, 'capture_arguments_invalid');
      process.stdout.write(JSON.stringify(await captureTeacherFingerprint(process.argv.slice(3))) + '\n');
    } catch (error) {
      process.stderr.write((typeof error?.safeCode === 'string' ? error.safeCode : 'capture_failed') + '\n'); process.exitCode = 1;
    }
  }
}
