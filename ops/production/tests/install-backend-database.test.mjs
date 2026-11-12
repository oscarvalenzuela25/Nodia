import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPristineJournal, verifyInstallationMetadata } from '../install-backend-database.mjs';

const journal = () => ({ operation: 'status', first_sequence: 1, last_sequence: 0, entries: 0, unconfirmed: 0,
  backups: 0, expired_backups: 0, coverage_closed_at: null, coverage_from: '2026-11-11T00:00:00.000Z',
  updated_at: '2026-11-11T00:00:00.000Z', release_authorized: false });
const metadata = () => {
  const names = Array.from({ length: 45 }, (_, index) => `Migration${String(index).padStart(3, '0')}`);
  return { expectedMigrations: names, ledger: names.map(name => ({ name })),
    entities: Array.from({ length: 68 }, (_, index) => ({ tableName: `table${index}`, columns: [{ databaseName: 'id' }] })),
    columns: Array.from({ length: 68 }, (_, index) => ({ table_schema: 'public', table_name: `table${index}`, column_name: 'id' })),
    counts: { users: 1, user_roles: 1, user_modules: 4, ai_providers: 0, ai_keys: 0 },
    accounts: [{ email: 'synthetic@example.com', is_active: true }],
    roles: [{ key: 'super_admin', is_active: true, assignment_active: true }],
    modules: ['actions', 'modules', 'roles', 'users'].map(key => ({ key, link: `/${key}`, group_key: 'general_settings',
      is_active: true, assignment_active: true, group_active: true })) };
};

test('only an existing open journal with no history or backups passes', () => {
  assert.deepEqual(assertPristineJournal(journal()), { first_sequence: 1, last_sequence: 0, entries: 0, backups: 0, open: true });
  for (const change of [{ operation: 'bootstrap' }, { first_sequence: 2 }, { last_sequence: 1 }, { entries: 1 },
    { unconfirmed: 1 }, { backups: 1 }, { expired_backups: 1 }, { coverage_closed_at: '2026-11-11T00:00:00Z' },
    { coverage_from: null }, { updated_at: 'invalid' }, { release_authorized: true }]) {
    assert.throws(() => assertPristineJournal({ ...journal(), ...change }), /journal_not_pristine_open/u);
  }
});

test('postcheck verifies exact ledger, entity columns and private admin identity without exposing it', () => {
  const result = verifyInstallationMetadata(metadata(), ' Synthetic@Example.com ');
  assert.equal(result.migrations_verified, 45);
  assert.equal(result.entity_tables_verified, 68);
  assert.equal(result.core_assignments, 4);
  assert.ok(!JSON.stringify(result).includes('synthetic@example.com'));
});

test('wrong/missing/extra migration and missing entity column fail closed', () => {
  for (const change of [data => data.ledger.pop(), data => data.ledger.push({ name: 'ForeignMigration' }),
    data => { data.ledger[0].name = 'OtherMigration'; }, data => data.columns.pop()]) {
    const data = metadata(); change(data);
    assert.throws(() => verifyInstallationMetadata(data, 'synthetic@example.com'), /migration_ledger_mismatch|entity_schema_mismatch/u);
  }
});

test('extra identities, keys, changed ownership and noncanonical access are refused', () => {
  for (const change of [data => { data.counts.users = 2; }, data => { data.counts.ai_keys = 1; },
    data => { data.accounts[0].email = 'other@example.com'; }, data => { data.roles[0].assignment_active = false; },
    data => { data.modules[0].link = '/settings/actions'; }, data => { data.modules[0].group_key = 'other'; },
    data => { data.modules[0].assignment_active = false; }]) {
    const data = metadata(); change(data);
    assert.throws(() => verifyInstallationMetadata(data, 'synthetic@example.com'), /bootstrap_/u);
  }
});
