import test from 'node:test';
import assert from 'node:assert/strict';
import { counterNames, countersSql, deriveStartReadiness, emptyTables, safeError, scopeSql } from '../inspect-backend-start-readiness.mjs';

function fixture() {
  const providerCatalog = { schemas: [{ name: 'pooler', owner_is_current: false }], routines: [{ schema: 'pooler', name: 'user_lookup',
    signature: 'i_username text, OUT uname text, OUT phash text', kind: 'f', language: 'plpgsql', security_definer: true, owner_is_current: false }] };
  const entities = Array.from({ length: 68 }, (_, index) => ({ tableName: `synthetic_${index}`, columns: [{ databaseName: 'id' }] }));
  const expectedMigrations = Array.from({ length: 45 }, (_, index) => `SyntheticMigration${index}`);
  return { metadata: { database_matched: true, default_schema_public: true, transaction_read_only: 'on', isolation_level: 'repeatable read', server_version_num: '160014' },
    stream: { encrypted: true, authorized: true, getProtocol: () => 'TLSv1.3' }, providerCatalog,
    scope: { large_objects: '0', nonpublic_relations: '0', nonpublic_types: '0', schemas: providerCatalog.schemas, routines: providerCatalog.routines },
    counters: Object.fromEntries(counterNames.map(name => [name, '0'])), expectedMigrations,
    ledger: expectedMigrations.map(name => ({ name })), entities,
    columns: entities.map(entity => ({ table_schema: 'public', table_name: entity.tableName, column_name: 'id' })) };
}

test('only a complete, TLS verified, repeatable-read empty-runtime snapshot qualifies', () => {
  const result = deriveStartReadiness(fixture());
  assert.equal(result.status, 'ready_to_start_empty');
  assert.equal(result.boot_performs_no_writes_claimed, false);
  assert.equal(result.mutations_requested, false);
  assert.equal(result.migrations.observed, 45);
});

test('terminal witnesses and future-due uploads still block first start', () => {
  for (const name of emptyTables) {
    const value = fixture(); value.counters[`${name}_total`] = '1';
    assert.equal(deriveStartReadiness(value).status, 'blocked', name);
  }
});

test('provider lookalike, extra relation/type, large object or wrong app schema block', () => {
  for (const change of [value => value.scope.schemas = [], value => value.scope.routines = [],
    value => value.scope.nonpublic_relations = '1', value => value.scope.nonpublic_types = '1',
    value => value.scope.large_objects = '1', value => value.entities[0].schema = 'other']) {
    const value = fixture(); change(value); assert.equal(deriveStartReadiness(value).status, 'blocked');
  }
});

test('missing column or changed migration ledger is not accepted', () => {
  const columns = fixture(); columns.columns.pop(); assert.equal(deriveStartReadiness(columns).status, 'blocked');
  const ledger = fixture(); ledger.ledger[0].name = 'AnotherMigration'; assert.equal(deriveStartReadiness(ledger).status, 'blocked');
});

test('untrusted TLS, writable transaction, malformed counters or extra fields are rejected', () => {
  for (const change of [value => value.stream.authorized = false, value => value.metadata.transaction_read_only = 'off',
    value => value.metadata.isolation_level = 'read committed', value => value.counters.jobs_ready = null,
    value => value.counters.extra_secret = 'private', value => value.counters.jobs_ready = '-1']) {
    const value = fixture(); change(value); assert.throws(() => deriveStartReadiness(value));
  }
});

test('closed SQL uses real f01 state columns and exposes no content fields', () => {
  assert.match(countersSql, /ai_generation_operations WHERE phase<>'closed'/);
  assert.match(countersSql, /teacher_attempts WHERE state='in_progress'/);
  assert.match(countersSql, /invoice_uploads WHERE retry_after<=clock_timestamp/);
  assert.match(scopeSql, /pg_largeobject_metadata/);
  assert.doesNotMatch(countersSql, /\b(?:email|password|prompt|payload|storage_key|SELECT \*)\b/i);
  assert.equal(safeError(new Error('postgresql://synthetic-private')), 'query_or_configuration_error');
});
