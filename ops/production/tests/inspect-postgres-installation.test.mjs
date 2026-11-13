import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { applyProviderBaseline, assertProviderBaselineDestination, attachCatalogDetails, decodeProviderBaselineBytes,
  deriveInstallationInspection, parseInspectionArguments, providerDestinationFingerprint, validatePostgresEnvironment, validateProviderBaseline } from '../inspect-postgres-installation.mjs';

const metadata = () => ({ database_matched: true, server_version_num: '160014', transaction_read_only: 'on',
  default_schema_public: true, database_create: true, public_schema_present: true, public_schema_usage: true, public_schema_create: true, backend_tls: true });
const inventory = () => ({ user_schemas: '0', relations: '0', routines: '0', types: '0', unexpected_extensions: '0' });
const extensions = () => ['uuid-ossp', 'pg_trgm'].map(name => ({ name, available: true, default_version: '1.0', trusted: true,
  installed: false, installed_version: null, installed_in_public: null }));
const tls = () => ({ encrypted: true, authorized: true, getProtocol: () => 'TLSv1.3' });
const derive = (meta = metadata(), catalog = inventory(), ext = extensions(), stream = tls()) =>
  deriveInstallationInspection(meta, catalog, ext, stream);

test('requires explicit database settings and certificate verification before connecting', () => {
  const environment = { PGSSLMODE: 'verify-full', POSTGRES_HOST: 'db.example.invalid', POSTGRES_PORT: '29102',
    POSTGRES_DB: 'fixture_database', POSTGRES_USER: 'fixture_role', POSTGRES_PASSWORD: 'synthetic-fixture-only' };
  assert.deepEqual(validatePostgresEnvironment(environment), { host: 'db.example.invalid', port: 29102,
    database: 'fixture_database', user: 'fixture_role', password: 'synthetic-fixture-only' });
  for (const key of Object.keys(environment)) {
    const missing = { ...environment }; delete missing[key];
    assert.throws(() => validatePostgresEnvironment(missing), { code: 'NODIA_CONFIGURATION_INVALID' });
  }
  for (const changed of [{ PGSSLMODE: 'require' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { POSTGRES_PORT: '5432junk' }, { POSTGRES_PORT: '65536' }, { POSTGRES_HOST: 'postgres://secret@example.invalid' }]) {
    assert.throws(() => validatePostgresEnvironment({ ...environment, ...changed }), { code: 'NODIA_CONFIGURATION_INVALID' });
  }
});

test('empty catalogs and trusted available extensions satisfy only first-install preconditions', () => {
  const result = derive({ ...metadata(), accidental_secret: 'synthetic-do-not-publish' });
  assert.deepEqual(result.gates, { empty_destination: true, public_schema_writable: true, default_schema_public: true,
    required_extensions_installable: true, first_installation_preconditions: true });
  assert.equal(result.postgres.server_version_num, 160014);
  assert.equal(result.postgres.client_tls_protocol, 'TLSv1.3');
  assert.equal(result.application_started, false);
  assert.equal(result.migrations_executed, false);
  assert.equal(result.mutations_requested, false);
  assert.equal(JSON.stringify(result).includes('synthetic-do-not-publish'), false);
  assert.deepEqual(Object.keys(result).sort(), ['application_started', 'extensions', 'gates', 'inventory',
    'migrations_executed', 'mutations_requested', 'postgres', 'privileges', 'schema_version', 'status'].sort());
});

test('a non-table object or unknown extension blocks the empty-destination gate', () => {
  for (const key of ['user_schemas', 'relations', 'routines', 'types', 'unexpected_extensions']) {
    const result = derive(metadata(), { ...inventory(), [key]: '1' });
    assert.equal(result.gates.empty_destination, false, key);
    assert.equal(result.gates.first_installation_preconditions, false, key);
  }
});

test('privileges and extension namespace determine installability without granting permissions', () => {
  for (const field of ['default_schema_public', 'database_create', 'public_schema_present', 'public_schema_usage', 'public_schema_create']) {
    const result = derive({ ...metadata(), [field]: false });
    assert.equal(result.gates.first_installation_preconditions, false, field);
  }
  const installed = extensions().map(value => ({ ...value, installed: true, installed_version: '1.0', installed_in_public: true }));
  const alreadyPresent = derive({ ...metadata(), database_create: false }, inventory(), installed);
  assert.equal(alreadyPresent.gates.first_installation_preconditions, true, 'installed extensions do not require CREATE DATABASE privilege');
  installed[0].installed_in_public = false;
  assert.equal(derive(metadata(), inventory(), installed).gates.first_installation_preconditions, false,
    'an extension installed in a different namespace is not silently moved');
  const untrusted = extensions(); untrusted[0].trusted = false;
  assert.equal(derive(metadata(), inventory(), untrusted).gates.required_extensions_installable, false);
  const absent = extensions(); absent[0] = { ...absent[0], available: false, default_version: null, trusted: null };
  assert.equal(derive(metadata(), inventory(), absent).gates.required_extensions_installable, false);
});

test('a database mismatch, writable transaction, invalid counts or malformed extension rows cannot be accepted', () => {
  for (const meta of [{ ...metadata(), database_matched: false }, { ...metadata(), transaction_read_only: 'off' },
    { ...metadata(), server_version_num: '' }, { ...metadata(), public_schema_usage: 'true' }]) {
    assert.throws(() => derive(meta), { code: 'NODIA_METADATA_INVALID' });
  }
  for (const value of [null, '', '-1', '1.5', true, '9007199254740992']) {
    assert.throws(() => derive(metadata(), { ...inventory(), routines: value }), { code: 'NODIA_METADATA_INVALID' });
  }
  for (const ext of [[], [extensions()[0], extensions()[0]], extensions().map(value => ({ ...value, installed_version: 'unexpected' })),
    extensions().map(value => ({ ...value, default_version: 'version\nsecret' }))]) {
    assert.throws(() => derive(metadata(), inventory(), ext), { code: 'NODIA_METADATA_INVALID' });
  }
});

test('the observed connection must have authorized TLS and a supported protocol', () => {
  for (const stream of [null, { ...tls(), authorized: false }, { ...tls(), encrypted: false },
    { ...tls(), getProtocol: () => 'TLSv1' }]) {
    assert.throws(() => derive(metadata(), inventory(), extensions(), stream), { code: 'NODIA_TLS_INVALID' });
  }
});

const emptyDetails = () => ({ schemas: [], relations: [], routines: [], types: [], unexpected_extensions: [] });
const diagnosticFixture = () => ({
  schemas: [{ name: 'fixture_platform', owner_is_current: false }], relations: [], types: [],
  routines: [{ schema: 'fixture_platform', name: 'fixture_catalog_helper', signature: '', kind: 'f',
    language: 'c', security_definer: true, owner_is_current: false }],
  unexpected_extensions: [{ name: 'fixture_extension_a', version: '1.0', schema: 'pg_catalog', owner_is_current: false },
    { name: 'fixture_extension_b', version: '2.0', schema: 'fixture_platform', owner_is_current: false }],
});
const diagnosticInspection = () => derive(metadata(), { ...inventory(), user_schemas: '1', routines: '1', unexpected_extensions: '2' });

test('catalog details require explicit CLI opt-in and reject unknown or duplicate arguments', () => {
  assert.deepEqual(parseInspectionArguments([]), { catalogDetails: false });
  assert.deepEqual(parseInspectionArguments(['--catalog-details']), { catalogDetails: true });
  for (const argv of [['--catalog-details', '--catalog-details'], ['--other'], ['--catalog-details=true'], null]) {
    assert.throws(() => parseInspectionArguments(argv), { code: 'NODIA_ARGUMENTS_INVALID' });
  }
  assert.equal(Object.hasOwn(derive(), 'catalog_details'), false);
});

test('closed catalog metadata identifies blockers without changing first-installation gates', () => {
  const base = diagnosticInspection();
  const result = attachCatalogDetails(base, diagnosticFixture());
  assert.deepEqual(result.gates, base.gates);
  assert.deepEqual(result.inventory, base.inventory);
  assert.equal(result.gates.empty_destination, false);
  assert.equal(result.gates.first_installation_preconditions, false);
  assert.equal(result.catalog_details.limit_per_category, 100);
  assert.deepEqual(result.catalog_details.routines, { total_count: 1, returned_count: 1, truncated: false,
    items: diagnosticFixture().routines });
  assert.equal(result.catalog_details.unexpected_extensions.total_count, 2);
  assert.deepEqual(Object.keys(result.catalog_details).sort(), ['limit_per_category', ...Object.keys(emptyDetails())].sort());
  assert.equal(result.mutations_requested, false);
});

test('catalog lists cap returned entries at 100 and report exact totals and truncation', () => {
  const details = emptyDetails();
  details.schemas = Array.from({ length: 101 }, (_, index) => ({ name: `fixture_${index}`, owner_is_current: false }));
  const base = derive(metadata(), { ...inventory(), user_schemas: '105' });
  const result = attachCatalogDetails(base, details);
  assert.equal(result.catalog_details.schemas.items.length, 100);
  assert.equal(result.catalog_details.schemas.returned_count, 100);
  assert.equal(result.catalog_details.schemas.total_count, 105);
  assert.equal(result.catalog_details.schemas.truncated, true);
  assert.equal(result.gates.first_installation_preconditions, false);
  assert.throws(() => attachCatalogDetails(base, { ...details, schemas: details.schemas.slice(0, 100) }),
    { code: 'NODIA_METADATA_INVALID' });
});

test('catalog parser rejects extra fields, malformed rows, duplicates and inconsistent inventory', () => {
  const mutations = [
    value => { value.routines[0].prosrc = 'synthetic-function-body-must-not-leak'; },
    value => { value.schemas[0].owner_is_current = 'false'; },
    value => { value.routines[0].security_definer = null; },
    value => { value.routines[0].signature = 'invalid\ncontrol'; },
    value => { value.routines[0].language = ''; },
    value => { value.routines[0].kind = 'unknown'; },
    value => { value.schemas[0].name = 'invalid\0name'; },
    value => { value.unexpected_extensions[0].version = 'invalid\nversion'; },
    value => { value.unexpected_extensions[1] = value.unexpected_extensions[0]; },
    value => { value.relations = null; },
    value => { value.unknown_category = []; },
  ];
  for (const mutate of mutations) {
    const details = diagnosticFixture(); mutate(details);
    assert.throws(() => attachCatalogDetails(diagnosticInspection(), details), { code: 'NODIA_METADATA_INVALID' });
  }
  const details = emptyDetails();
  details.relations = [{ schema: 'public', name: 'fixture_table', kind: 'r', owner_is_current: true }];
  details.types = [{ schema: 'public', name: 'fixture_type', kind: 'e', owner_is_current: true }];
  const base = derive(metadata(), { ...inventory(), relations: '1', types: '1' });
  assert.equal(attachCatalogDetails(base, details).catalog_details.types.items[0].kind, 'e');
  details.types[0].kind = 'unknown';
  assert.throws(() => attachCatalogDetails(base, details), { code: 'NODIA_METADATA_INVALID' });
});

const baselineBytes = readFileSync(new URL('../postgres-provider-baseline.json', import.meta.url));
const baseline = () => JSON.parse(baselineBytes.toString('utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const providerInspection = ({ meta = {}, counts = {}, catalog } = {}) => {
  const profile = baseline();
  const installed = extensions().map(row => ({ ...row, installed: true, installed_version: '1.0', installed_in_public: true }));
  const base = derive({ ...metadata(), database_create: false, ...meta }, { ...profile.inventory, ...counts }, installed);
  return attachCatalogDetails(base, catalog ?? profile.catalog);
};

test('baseline is explicitly pinned and requires diagnostic mode; default CLI contract is unchanged', () => {
  const filename = `/usr/local/lib/nodia/postgres-provider-baseline-${sha256(baselineBytes)}.json`;
  assert.deepEqual(parseInspectionArguments(['--catalog-details', '--provider-baseline-file', filename]),
    { catalogDetails: true, providerBaselineFile: filename });
  for (const argv of [['--provider-baseline-file', filename], ['--catalog-details', '--provider-baseline-file'],
    ['--catalog-details', '--provider-baseline-file', '/tmp/profile.json'],
    ['--catalog-details', '--provider-baseline-file', filename, '--provider-baseline-file', filename]]) {
    assert.throws(() => parseInspectionArguments(argv), { code: 'NODIA_ARGUMENTS_INVALID' });
  }
  const profile = decodeProviderBaselineBytes(baselineBytes, sha256(baselineBytes));
  assert.equal(profile.provenance.provider_origin, 'inferred_not_attested');
  assert.equal(profile.provenance.security_attestation, false);
  assert.equal(profile.provenance.product_approval, false);
  assert.equal(profile.destination_fingerprint_sha256, providerDestinationFingerprint(profile.destination));
  for (const bytes of [Buffer.concat([baselineBytes, Buffer.from(' ')]), Buffer.from(baselineBytes.toString().replaceAll('\n', '\r\n')),
    Buffer.from(baselineBytes.toString().replace('"schema_version": 1,', '"schema_version": 1, "schema_version": 1,'))]) {
    assert.throws(() => decodeProviderBaselineBytes(bytes, sha256(bytes)), { code: 'NODIA_BASELINE_INVALID' });
  }
  const malformedUtf8 = Buffer.from(baselineBytes);
  malformedUtf8[malformedUtf8.indexOf(Buffer.from('The observed helper'))] = 0xff;
  assert.throws(() => decodeProviderBaselineBytes(malformedUtf8, sha256(malformedUtf8)), { code: 'NODIA_BASELINE_INVALID' });
  assert.throws(() => decodeProviderBaselineBytes(baselineBytes, 'f'.repeat(64)), { code: 'NODIA_BASELINE_INVALID' });
});

test('exact observed provider metadata permits only application-empty admission and preserves raw inventory', () => {
  const before = providerInspection();
  assert.equal(before.gates.empty_destination, false);
  assert.equal(before.gates.first_installation_preconditions, false);
  assert.equal(Object.hasOwn(before.gates, 'provider_baseline_matches'), false);
  const after = applyProviderBaseline(before, baseline(), baseline().destination);
  assert.deepEqual(after.inventory, before.inventory);
  assert.deepEqual(after.catalog_details, before.catalog_details);
  assert.equal(after.gates.empty_destination, false);
  assert.equal(after.gates.provider_baseline_matches, true);
  assert.equal(after.gates.application_destination_empty, true);
  assert.equal(after.gates.first_installation_preconditions, true);
  assert.equal(after.provider_baseline.provider_origin_attested, false);
  assert.equal(after.provider_baseline.profile_sha256, sha256(baselineBytes));
  assert.equal(after.mutations_requested, false);
});

test('baseline profile rejects widening, extra fields, current ownership and inconsistent identity', () => {
  const changes = [
    profile => { profile.extra = true; },
    profile => { delete profile.catalog; },
    profile => { profile.destination.port = 5432; },
    profile => { profile.destination.password = 'synthetic-forbidden'; },
    profile => { profile.catalog.schemas[0].owner_is_current = true; },
    profile => { profile.catalog.routines[0].prosrc = 'synthetic-forbidden'; },
    profile => { profile.inventory.relations = 1; },
    profile => { profile.inventory.user_schemas = 101; },
    profile => { profile.provenance.product_approval = true; },
    profile => { profile.provenance.security_attestation = true; },
    profile => { profile.provenance.references[0].url = 'https://fixture:password@example.invalid/path'; },
  ];
  for (const change of changes) {
    const profile = baseline(); change(profile);
    assert.throws(() => validateProviderBaseline(profile), { code: 'NODIA_BASELINE_INVALID' });
  }
});

test('a different host, port or database rejects the baseline before querying the destination', () => {
  for (const changed of [{ host: 'other.example.invalid' }, { port: 5432 }, { database: 'other_db' }]) {
    const destination = { ...baseline().destination, ...changed };
    assert.throws(() => assertProviderBaselineDestination(baseline(), destination), { code: 'NODIA_BASELINE_DESTINATION_MISMATCH' });
    assert.throws(() => applyProviderBaseline(providerInspection(), baseline(), destination), { code: 'NODIA_BASELINE_DESTINATION_MISMATCH' });
  }
});

test('extra, missing, changed or truncated objects never become an automatic provider ignore', () => {
  const modifications = [
    value => { value.catalog_details.routines.items[0].signature = 'other text'; },
    value => { value.catalog_details.routines.items[0].security_definer = false; },
    value => { value.catalog_details.routines.items[0].language = 'sql'; },
    value => { value.catalog_details.routines.items[0].owner_is_current = true; },
    value => { value.catalog_details.unexpected_extensions.items[0].version = '9.9'; },
    value => { value.catalog_details.unexpected_extensions.items[0].schema = 'other'; },
    value => { value.catalog_details.routines.truncated = true; },
    value => { value.postgres.server_version_num = 160015; },
    value => { value.inventory.user_schemas = 2; },
    value => { value.catalog_details.extra = { items: [] }; },
  ];
  for (const change of modifications) {
    const inspection = providerInspection(); change(inspection);
    const result = applyProviderBaseline(inspection, baseline(), baseline().destination);
    assert.equal(result.gates.provider_baseline_matches, false);
    assert.equal(result.gates.application_destination_empty, false);
    assert.equal(result.gates.first_installation_preconditions, false);
  }
  const extraCatalog = baseline().catalog;
  extraCatalog.schemas.push({ name: 'application_schema', owner_is_current: true });
  const extra = providerInspection({ counts: { user_schemas: 2 }, catalog: extraCatalog });
  assert.equal(applyProviderBaseline(extra, baseline(), baseline().destination).gates.provider_baseline_matches, false);
  const missingCatalog = baseline().catalog; missingCatalog.routines = [];
  const missing = providerInspection({ counts: { routines: 0 }, catalog: missingCatalog });
  assert.equal(applyProviderBaseline(missing, baseline(), baseline().destination).gates.provider_baseline_matches, false);
});

test('an exact baseline never bypasses extension, public-schema or default-schema preconditions', () => {
  for (const changed of [{ public_schema_create: false }, { public_schema_usage: false }, { default_schema_public: false }]) {
    const result = applyProviderBaseline(providerInspection({ meta: changed }), baseline(), baseline().destination);
    assert.equal(result.gates.provider_baseline_matches, true);
    assert.equal(result.gates.first_installation_preconditions, false);
  }
  const profile = baseline();
  const withoutExtensions = attachCatalogDetails(derive({ ...metadata(), database_create: false }, profile.inventory), profile.catalog);
  const result = applyProviderBaseline(withoutExtensions, profile, profile.destination);
  assert.equal(result.gates.provider_baseline_matches, true);
  assert.equal(result.gates.required_extensions_installable, false);
  assert.equal(result.gates.first_installation_preconditions, false);
});
