import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, validateObject } from '../export-backup-cipher.mjs';

const id = 'a0000000-0000-4000-8000-000000000001', hash = 'a'.repeat(64);
const entry = { backup_id: id, status: 'ready', cipher_sha256: hash, cipher_bytes: 100,
  encryption_key_id: 'f7af9aea7868daa71a9500f9bbd91f35a3fe6fea396f82d5f5a9c78ab8510bbd',
  object_key: `nodia-ai-recovery/synthetic/backups/${id}.bin`,
  captured_at: '2026-11-11T00:00:00.000Z', expires_at: '2026-11-18T00:00:00.000Z' };
const now = Date.parse('2026-11-12T00:00:00.000Z');
test('only the pinned ready fresh backup is exportable', () => {
  validateEntry(entry, id, hash, now);
  for (const change of [{ status: 'pending' }, { cipher_sha256: 'b'.repeat(64) }, { encryption_key_id: 'b'.repeat(64) },
    { cipher_bytes: 1024 ** 3 }, { captured_at: 'invalid' }, { expires_at: '2026-11-11T00:00:00.000Z' },
    { object_key: 'nodia-ai-recovery/synthetic/backups/other.bin' }])
    assert.throws(() => validateEntry({ ...entry, ...change }, id, hash, now));
});
test('HEAD and GET must carry exact catalog identity, length and digest without versions', () => {
  const object = { ETag: 'synthetic-etag', ContentLength: 100, Metadata: {
    'nodia-backup-id': id, 'encryption-key-id': entry.encryption_key_id, 'cipher-sha256': hash } };
  validateObject(object, entry);
  for (const change of [{ VersionId: 'foreign-version' }, { ETag: '' }, { ContentLength: 101 }, { Metadata: {} }])
    assert.throws(() => validateObject({ ...object, ...change }, entry));
});
