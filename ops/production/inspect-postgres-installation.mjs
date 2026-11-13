#!/usr/bin/env node
// Operator-only catalog inspection. Never imports application bootstrap or dotenv.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
const catalogCteSql = `WITH RECURSIVE extension_owned(classid, objid) AS (
  SELECT classid, objid FROM pg_depend WHERE deptype = 'e'
  UNION
  SELECT dependency.classid, dependency.objid FROM pg_depend AS dependency
  JOIN extension_owned AS owner ON dependency.refclassid = owner.classid AND dependency.refobjid = owner.objid
  WHERE dependency.deptype IN ('a', 'i')
), user_namespaces AS (
  SELECT oid, nspname, nspowner FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
)`;
export const inventorySql = `${catalogCteSql}
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

const detailLimit = 100;
const detailCategories = ['schemas', 'relations', 'routines', 'types', 'unexpected_extensions'];
const detailInventoryKeys = { schemas: 'user_schemas', relations: 'relations', routines: 'routines',
  types: 'types', unexpected_extensions: 'unexpected_extensions' };
const detailFields = { schemas: ['name', 'owner_is_current'],
  relations: ['schema', 'name', 'kind', 'owner_is_current'],
  routines: ['schema', 'name', 'signature', 'kind', 'language', 'security_definer', 'owner_is_current'],
  types: ['schema', 'name', 'kind', 'owner_is_current'],
  unexpected_extensions: ['name', 'version', 'schema', 'owner_is_current'] };
const metadataText = (value, maxBytes, empty = false) => typeof value === 'string' &&
  (empty || value.length > 0) && Buffer.byteLength(value, 'utf8') <= maxBytes && !/[\u0000-\u001f\u007f]/u.test(value);

export function parseInspectionArguments(argv) {
  ensure(Array.isArray(argv), 'NODIA_ARGUMENTS_INVALID');
  const result = { catalogDetails: false };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--catalog-details') {
      ensure(!result.catalogDetails, 'NODIA_ARGUMENTS_INVALID'); result.catalogDetails = true;
    } else if (argv[index] === '--provider-baseline-file') {
      ensure(!Object.hasOwn(result, 'providerBaselineFile') && typeof argv[index + 1] === 'string' &&
        /^\/usr\/local\/lib\/nodia\/postgres-provider-baseline-[a-f0-9]{64}\.json$/u.test(argv[index + 1]),
      'NODIA_ARGUMENTS_INVALID');
      result.providerBaselineFile = argv[++index];
    } else fail('NODIA_ARGUMENTS_INVALID');
  }
  ensure(!result.providerBaselineFile || result.catalogDetails, 'NODIA_ARGUMENTS_INVALID');
  return result;
}

export function attachCatalogDetails(inspection, rows) {
  ensure(inspection?.status === 'inspected' && rows && typeof rows === 'object' && !Array.isArray(rows) &&
    Object.keys(rows).length === detailCategories.length && detailCategories.every(category => Object.hasOwn(rows, category)));
  const details = { limit_per_category: detailLimit };
  for (const category of detailCategories) {
    const total = count(inspection.inventory?.[detailInventoryKeys[category]]);
    const entries = rows[category];
    ensure(Array.isArray(entries) && entries.length === Math.min(total, detailLimit + 1));
    const identities = new Set();
    const parsed = entries.map(row => {
      const fields = detailFields[category];
      ensure(row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).length === fields.length &&
        fields.every(field => Object.hasOwn(row, field)));
      ensure(metadataText(row.name, 63) && typeof row.owner_is_current === 'boolean');
      if (category !== 'schemas') ensure(metadataText(row.schema, 63));
      if (category === 'relations') ensure(['r', 'i', 'S', 't', 'v', 'm', 'c', 'f', 'p', 'I'].includes(row.kind));
      if (category === 'types') ensure(['b', 'c', 'd', 'e', 'p', 'r', 'm'].includes(row.kind));
      if (category === 'routines') ensure(metadataText(row.signature, 32768, true) &&
        ['f', 'p', 'a', 'w'].includes(row.kind) && metadataText(row.language, 63) && typeof row.security_definer === 'boolean');
      if (category === 'unexpected_extensions') ensure(versionText(row.version));
      const identity = JSON.stringify([row.schema ?? null, row.name, row.signature ?? null]);
      ensure(!identities.has(identity)); identities.add(identity);
      return Object.fromEntries(fields.map(field => [field, row[field]]));
    });
    details[category] = { total_count: total, returned_count: Math.min(total, detailLimit),
      truncated: total > detailLimit, items: parsed.slice(0, detailLimit) };
  }
  // Catalog diagnostics never change inventory, admission or privilege gates.
  return { ...inspection, catalog_details: details };
}

const profileKeys = ['schema_version', 'profile_id', 'observed_on', 'scope', 'destination',
  'destination_fingerprint_sha256', 'server_version_num', 'inventory', 'catalog', 'provenance'];
const inventoryKeys = ['user_schemas', 'relations', 'routines', 'types', 'unexpected_extensions'];
const closed = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function providerDestinationFingerprint(destination) {
  ensure(closed(destination, ['host', 'port', 'database']) && metadataText(destination.host, 4096) &&
    !/[\s,@\/=]/u.test(destination.host) && Number.isSafeInteger(destination.port) && destination.port > 0 &&
    destination.port <= 65535 && metadataText(destination.database, 4096), 'NODIA_BASELINE_INVALID');
  return sha256(JSON.stringify({ host: destination.host, port: destination.port, database: destination.database }));
}

export function validateProviderBaseline(profile) {
  try {
    ensure(closed(profile, profileKeys) && profile.schema_version === 1 &&
      typeof profile.profile_id === 'string' && /^[a-z0-9][a-z0-9-]{1,99}$/u.test(profile.profile_id) &&
      typeof profile.observed_on === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(profile.observed_on) &&
      profile.scope === 'observed_catalog_metadata_only');
    ensure(profile.destination_fingerprint_sha256 === providerDestinationFingerprint(profile.destination));
    ensure(Number.isSafeInteger(profile.server_version_num) && profile.server_version_num > 0 && profile.server_version_num <= 99_999_999);
    ensure(closed(profile.inventory, inventoryKeys) && inventoryKeys.every(key => Number.isSafeInteger(profile.inventory[key]) &&
      profile.inventory[key] >= 0 && profile.inventory[key] <= detailLimit));
    // This observed profile contains no application relations or types. Supporting
    // another kind of provider baseline requires explicit review, not broader ignores.
    ensure(profile.inventory.relations === 0 && profile.inventory.types === 0 &&
      Object.values(profile.inventory).some(value => value > 0));
    const catalog = attachCatalogDetails({ status: 'inspected', inventory: profile.inventory }, profile.catalog).catalog_details;
    ensure(detailCategories.every(category => !catalog[category].truncated &&
      catalog[category].items.every(row => row.owner_is_current === false)));
    ensure(closed(profile.provenance, ['observation', 'provider_origin', 'security_attestation', 'product_approval', 'inference_note', 'references']) &&
      profile.provenance.observation === 'operator_read_only_catalog' && profile.provenance.provider_origin === 'inferred_not_attested' &&
      profile.provenance.security_attestation === false && profile.provenance.product_approval === false &&
      metadataText(profile.provenance.inference_note, 4096) && Array.isArray(profile.provenance.references) &&
      profile.provenance.references.length > 0 && profile.provenance.references.length <= 8);
    for (const reference of profile.provenance.references) {
      ensure(closed(reference, ['title', 'url', 'relationship']) && metadataText(reference.title, 256) && metadataText(reference.url, 2048) &&
        ['matching_helper_signature', 'extension_monitoring_reference'].includes(reference.relationship));
      const url = new URL(reference.url);
      ensure(url.protocol === 'https:' && !url.username && !url.password);
    }
    return profile;
  } catch { fail('NODIA_BASELINE_INVALID'); }
}

export function decodeProviderBaselineBytes(bytes, expectedHash) {
  try {
    ensure(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 65536 &&
      typeof expectedHash === 'string' && /^[a-f0-9]{64}$/u.test(expectedHash) && sha256(bytes) === expectedHash);
    const profile = JSON.parse(bytes.toString('utf8'));
    // Canonical JSON rejects duplicate-key or alternate-byte encodings of a pinned profile.
    ensure(bytes.equals(Buffer.from(JSON.stringify(profile, null, 2) + '\n', 'utf8')));
    return validateProviderBaseline(profile);
  } catch { fail('NODIA_BASELINE_INVALID'); }
}

export async function loadProviderBaselineFile(filename) {
  try {
    const match = /^\/usr\/local\/lib\/nodia\/postgres-provider-baseline-([a-f0-9]{64})\.json$/u.exec(filename);
    ensure(match && await realpath(filename) === filename);
    const info = await lstat(filename);
    ensure(info.isFile() && !info.isSymbolicLink() && info.uid === 0 && info.gid === 0 && info.nlink === 1 &&
      (info.mode & 0o777) === 0o644 && info.size > 0 && info.size <= 65536);
    let current = dirname(filename);
    while (true) {
      const parent = await lstat(current);
      ensure(parent.isDirectory() && parent.uid === 0 && (parent.mode & 0o022) === 0);
      if (current === '/') break;
      current = dirname(current);
    }
    const bytes = await readFile(filename);
    ensure(bytes.length === info.size);
    return decodeProviderBaselineBytes(bytes, match[1]);
  } catch { fail('NODIA_BASELINE_INVALID'); }
}

export function assertProviderBaselineDestination(profile, destination) {
  validateProviderBaseline(profile);
  ensure(providerDestinationFingerprint(destination) === profile.destination_fingerprint_sha256, 'NODIA_BASELINE_DESTINATION_MISMATCH');
}

export function applyProviderBaseline(inspection, profile, destination) {
  assertProviderBaselineDestination(profile, destination);
  ensure(inspection?.status === 'inspected' && inspection.catalog_details, 'NODIA_BASELINE_INVALID');
  const expected = attachCatalogDetails({ status: 'inspected', inventory: profile.inventory }, profile.catalog).catalog_details;
  const sorted = entries => entries.map(entry => JSON.stringify(entry)).sort();
  const versionMatched = inspection.postgres?.server_version_num === profile.server_version_num;
  const matches = Boolean(versionMatched && inspection.postgres?.database_matched === true &&
    inspection.postgres?.transaction_read_only === true && inspection.postgres?.client_tls_authorized === true &&
    closed(inspection.inventory, inventoryKeys) && inventoryKeys.every(key => inspection.inventory[key] === profile.inventory[key]) &&
    closed(inspection.catalog_details, ['limit_per_category', ...detailCategories]) && inspection.catalog_details.limit_per_category === detailLimit && detailCategories.every(category => {
      const actual = inspection.catalog_details[category], wanted = expected[category];
      return closed(actual, ['total_count', 'returned_count', 'truncated', 'items']) &&
        actual.truncated === false && actual.total_count === wanted.total_count &&
        actual.returned_count === wanted.returned_count && Array.isArray(actual.items) && actual.items.length === wanted.items.length &&
        JSON.stringify(sorted(actual.items)) === JSON.stringify(sorted(wanted.items));
    }));
  return { ...inspection, provider_baseline: { profile_id: profile.profile_id,
    profile_sha256: sha256(JSON.stringify(profile, null, 2) + '\n'),
    destination_fingerprint_sha256: profile.destination_fingerprint_sha256, destination_matched: true,
    server_version_matched: versionMatched, metadata_only: true, provider_origin_attested: false },
  gates: { ...inspection.gates, provider_baseline_matches: matches, application_destination_empty: matches,
    first_installation_preconditions: matches && inspection.gates.public_schema_writable &&
      inspection.gates.required_extensions_installable && inspection.gates.default_schema_public } };
}

export const catalogDetailsSql = `${catalogCteSql}
SELECT jsonb_build_object(
  'schemas', COALESCE((SELECT jsonb_agg(to_jsonb(detail)) FROM (
    SELECT object.nspname AS name, object.nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user) AS owner_is_current
    FROM user_namespaces AS object WHERE object.nspname <> 'public' AND NOT EXISTS
      (SELECT FROM extension_owned WHERE classid = 'pg_namespace'::regclass AND objid = object.oid)
    ORDER BY object.nspname LIMIT 101
  ) AS detail), '[]'::jsonb),
  'relations', COALESCE((SELECT jsonb_agg(to_jsonb(detail)) FROM (
    SELECT namespace.nspname AS schema, object.relname AS name, object.relkind::text AS kind,
      object.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user) AS owner_is_current
    FROM pg_class AS object JOIN user_namespaces AS namespace ON namespace.oid = object.relnamespace
    WHERE NOT EXISTS (SELECT FROM extension_owned WHERE classid = 'pg_class'::regclass AND objid = object.oid)
    ORDER BY namespace.nspname, object.relname LIMIT 101
  ) AS detail), '[]'::jsonb),
  'routines', COALESCE((SELECT jsonb_agg(to_jsonb(detail)) FROM (
    SELECT namespace.nspname AS schema, object.proname AS name, pg_get_function_identity_arguments(object.oid) AS signature,
      object.prokind::text AS kind, language.lanname AS language, object.prosecdef AS security_definer,
      object.proowner = (SELECT oid FROM pg_roles WHERE rolname = current_user) AS owner_is_current
    FROM pg_proc AS object JOIN user_namespaces AS namespace ON namespace.oid = object.pronamespace
    JOIN pg_language AS language ON language.oid = object.prolang
    WHERE NOT EXISTS (SELECT FROM extension_owned WHERE classid = 'pg_proc'::regclass AND objid = object.oid)
    ORDER BY namespace.nspname, object.proname, pg_get_function_identity_arguments(object.oid) LIMIT 101
  ) AS detail), '[]'::jsonb),
  'types', COALESCE((SELECT jsonb_agg(to_jsonb(detail)) FROM (
    SELECT namespace.nspname AS schema, object.typname AS name, object.typtype::text AS kind,
      object.typowner = (SELECT oid FROM pg_roles WHERE rolname = current_user) AS owner_is_current
    FROM pg_type AS object JOIN user_namespaces AS namespace ON namespace.oid = object.typnamespace
    WHERE NOT EXISTS (SELECT FROM extension_owned WHERE classid = 'pg_type'::regclass AND objid = object.oid)
    ORDER BY namespace.nspname, object.typname LIMIT 101
  ) AS detail), '[]'::jsonb),
  'unexpected_extensions', COALESCE((SELECT jsonb_agg(to_jsonb(detail)) FROM (
    SELECT object.extname AS name, object.extversion AS version, namespace.nspname AS schema,
      object.extowner = (SELECT oid FROM pg_roles WHERE rolname = current_user) AS owner_is_current
    FROM pg_extension AS object JOIN pg_namespace AS namespace ON namespace.oid = object.extnamespace
    WHERE object.extname NOT IN ('plpgsql', 'uuid-ossp', 'pg_trgm')
    ORDER BY object.extname LIMIT 101
  ) AS detail), '[]'::jsonb)
) AS catalog_details`;

function safeError(error) {
  if (error?.code === 'NODIA_BASELINE_INVALID') return 'provider_baseline_invalid';
  if (error?.code === 'NODIA_BASELINE_DESTINATION_MISMATCH') return 'provider_baseline_destination_mismatch';
  if (error?.code === 'NODIA_ARGUMENTS_INVALID') return 'arguments_invalid';
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

export async function inspectPostgresInstallation({ catalogDetails = false, providerBaselineFile } = {}) {
  let client, transaction = false;
  try {
    ensure(typeof catalogDetails === 'boolean' && (!providerBaselineFile || catalogDetails), 'NODIA_ARGUMENTS_INVALID');
    const configuration = validatePostgresEnvironment(process.env);
    const destination = { host: configuration.host, port: configuration.port, database: configuration.database };
    const baseline = providerBaselineFile ? await loadProviderBaselineFile(providerBaselineFile) : null;
    if (baseline) assertProviderBaselineDestination(baseline, destination);
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
    let result = deriveInstallationInspection(metadata.rows[0], inventory.rows[0], extensions.rows, client.connection.stream);
    if (catalogDetails) {
      const details = await client.query(catalogDetailsSql);
      ensure(details.rowCount === 1);
      result = attachCatalogDetails(result, details.rows[0].catalog_details);
      if (baseline) result = applyProviderBaseline(result, baseline, destination);
    }
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
  let result;
  try { result = await inspectPostgresInstallation(parseInspectionArguments(process.argv.slice(2))); }
  catch (error) { result = { schema_version: 1, status: 'failed', error_code: safeError(error), ...flags }; }
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'inspected' ? (result.gates.first_installation_preconditions ? 0 : 2) : 1;
}
