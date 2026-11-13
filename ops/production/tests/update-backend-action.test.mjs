import assert from 'node:assert/strict';
import test from 'node:test';
import { migrationInventory, validateHistory, quiescentCounters, quiescencePredicates, failureResult } from '../update-backend-action.mjs';

const manifest = (extra = false) => ({ schema_version: 1, files: [
  { path: 'dist/migrations/1789257400000-InitialCoreSchema.js', type: 'file', sha256: 'a'.repeat(64) },
  { path: 'dist/migrations/1789257500000-InitialBusinessAiSchema.js', type: 'file', sha256: 'b'.repeat(64) },
  ...(extra ? [{ path: 'dist/migrations/1793630000000-TeacherLearningEvidence.js', type: 'file', sha256: 'c'.repeat(64) }] : []),
] });
const ledger = value => migrationInventory(value).map(({ name, timestamp }) => ({ name, timestamp }));

test('migration history must be an exact preserved prefix and the ledger match its phase', () => {
  const old = manifest(), next = manifest(true);
  assert.equal(validateHistory(old, next, ledger(old)).pending, 1);
  assert.equal(validateHistory(old, next, ledger(next), { after: true }).target, 3);
  assert.equal(validateHistory(old, next, ledger(next), { after: true }).pending, 0);
  assert.equal(validateHistory(old, next, ledger(next), { after: true }).incremental_migrations, 1);
  assert.throws(() => validateHistory(old, next, ledger(next)));
  assert.throws(() => validateHistory(old, next, ledger(old), { after: true }));
  for (const key of ['path', 'sha256']) {
    const changed = manifest(true); changed.files[0][key] = key === 'path' ? 'dist/migrations/1789257400000-Changed.js' : 'f'.repeat(64);
    assert.throws(() => validateHistory(old, changed, ledger(old)), { safeCode: 'historical_migration_changed' });
  }
  assert.throws(() => validateHistory(next, old, ledger(next)));
  assert.throws(() => validateHistory(old, next, ledger(old).reverse()));
});
test('missing, malformed and duplicate migration identities fail closed', () => {
  for (const files of [[], [manifest().files[0], manifest().files[0]],
    [{ ...manifest().files[0], sha256: 'not-a-hash' }, manifest().files[1]],
    [{ ...manifest().files[0], path: 'dist/migrations/invalid.js' }, manifest().files[1]]]) {
    assert.throws(() => migrationInventory({ schema_version: 1, files }));
  }
});

test('zero requires every known runtime counter; active, unknown or missing states cannot pass', () => {
  const zero = Object.fromEntries(Object.keys(quiescencePredicates).map(name => [name, '0']));
  assert.equal(quiescentCounters(zero).quiescent, true);
  for (const name of Object.keys(zero)) {
    assert.equal(quiescentCounters({ ...zero, [name]: '1' }).quiescent, false);
    for (const value of [null, undefined, 0, '-1', '1.5', '9007199254740992'])
      assert.throws(() => quiescentCounters({ ...zero, [name]: value }));
  }
  assert.throws(() => quiescentCounters({}));
});

test('database diagnostics expose only a safe code/SQLSTATE, never SQL, values or stack', () => {
  const error = Object.assign(new Error('synthetic-private-value and SQL'), { code: '42P01' });
  const result = failureResult(error);
  assert.equal(result.database_sqlstate, '42P01');
  assert.equal(result.error_code, 'database_update_action_failed');
  assert.equal(JSON.stringify(result).includes('synthetic-private'), false);
  assert.equal(failureResult({ safeCode: 'secret with spaces', code: 'untrusted-message' }).error_code,
    'database_update_action_failed');
});
