import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintDigest, quotePublicTable, validateFingerprint } from '../fingerprint-backend-public.mjs';

const table = (name = 'synthetic', rows = 1) => ({ name, rows, md5: 'a'.repeat(32) });

test('table names are closed and quoted, never schema/SQL fragments', () => {
  assert.equal(quotePublicTable('MixedCase_1'), '"public"."MixedCase_1"');
  for (const name of ['public.table', 'table;DROP', 'a"b', 'with space', '../table', '', 'a'.repeat(64)])
    assert.throws(() => quotePublicTable(name));
});

test('aggregate binds ordered names, real zero counts, multiplicity and row digests', () => {
  const initial = [table('a', 0), table('b', 1)];
  const digest = fingerprintDigest(initial);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(fingerprintDigest([table('a', 0), table('b', 2)]), digest);
  assert.notEqual(fingerprintDigest([table('a', 0), { ...table('b', 1), md5: 'b'.repeat(32) }]), digest);
  assert.equal(validateFingerprint({ tables: initial, aggregate_sha256: digest }).aggregate_sha256, digest);
});

test('unordered/duplicate tables, null counts, unsafe sizes and extra row fields are rejected', () => {
  for (const value of [[table('b'), table('a')], [table('a'), table('a')], [table('a', null)], [table('a', 1_000_001)],
    [table('a', -1)], [{ ...table(), payload: 'must-not-escape' }], Array.from({ length: 101 }, (_, index) => table(`a${index}`))])
    assert.throws(() => fingerprintDigest(value));
});

test('consumer payload is closed and cannot substitute aggregate or leak values', () => {
  const tables = [table()];
  assert.throws(() => validateFingerprint({ tables, aggregate_sha256: 'f'.repeat(64) }));
  assert.throws(() => validateFingerprint({ tables, aggregate_sha256: fingerprintDigest(tables), email: 'synthetic@example.invalid' }));
});
