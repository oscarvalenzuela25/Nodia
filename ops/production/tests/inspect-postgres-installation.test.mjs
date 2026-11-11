import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveInstallationInspection, validatePostgresEnvironment } from '../inspect-postgres-installation.mjs';

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
