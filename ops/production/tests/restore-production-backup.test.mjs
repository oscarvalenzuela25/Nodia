import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { argumentPairs, hashFile, localDockerEndpoint, PINS, validatePrepareResult } from '../restore-production-backup.mjs';

const args = () => Object.entries({ 'cipher-file': 'fixture.enc', 'cipher-sha256': 'a'.repeat(64),
  'backup-id': '12345678-1234-4234-8234-123456789abc', 'private-key-file': 'private-outside-repository.pem',
  'journal-directory': 'trusted-export', 'journal-metadata-sha256': 'b'.repeat(64),
  'journal-manifest-sha256': 'c'.repeat(64), 'journal-head-sha256': 'd'.repeat(64), 'fingerprint-file': 'fingerprint.json',
  'fingerprint-sha256': 'e'.repeat(64), 'package-archive': 'package.tar.gz', 'node-archive': 'node.tar.gz',
  output: 'safe-receipt.json' }).flatMap(([name, value]) => ['--' + name, value]);

test('all external input identities are explicit and duplicate/unknown arguments cannot override a pin', () => {
  const parsed = argumentPairs(args());
  assert.equal(parsed['backup-id'], '12345678-1234-4234-8234-123456789abc');
  for (const changed of [args().slice(2), [...args(), '--output', 'overwrite.json'],
    args().map(value => value === '--cipher-file' ? '--untrusted-code' : value),
    args().map(value => value === 'a'.repeat(64) ? 'truncated' : value),
    args().map(value => value === parsed['backup-id'] ? '../../other-target' : value)]) {
    assert.throws(() => argumentPairs(changed));
  }
});

test('RSA material cannot be sent through a TCP/SSH or remote Docker endpoint', () => {
  for (const value of ['npipe:////./pipe/dockerDesktopLinuxEngine', 'unix:///var/run/docker.sock']) assert.equal(localDockerEndpoint(value), true);
  for (const value of ['tcp://127.0.0.1:2375', 'ssh://vps', 'tcp://remote:2376', 'npipe:////remote/pipe/docker', '', null])
    assert.equal(localDockerEndpoint(value), false);
});

test('restore preparation result is closed and cannot authorize dispatch or normal release', () => {
  const value = { prepared: true, purged_chats: 0, deletion_entries: 0, external_generations_requiring_inventory: 0,
    attachment_tombstones_applied: 0, preference_tombstones_applied: 0, dispatches: 0,
    release_authorized: false, next_action: 'reconcile_current_domain_and_native_runtimes' };
  assert.deepEqual(validatePrepareResult(value), value);
  for (const changed of [{ ...value, dispatches: 1 }, { ...value, release_authorized: true },
    { ...value, private_key: 'must-not-be-published' }, { ...value, purged_chats: -1 }, { ...value, next_action: 'serve' }])
    assert.throws(() => validatePrepareResult(changed));
});

test('file hashing streams exact bytes and does not normalize artifact content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nodia-restore-hash-fixture-'));
  try {
    const filename = path.join(root, 'synthetic.bin'), bytes = Buffer.from('Synthetic fixture only\r\n\0bytes');
    fs.writeFileSync(filename, bytes);
    assert.equal(hashFile(filename), createHash('sha256').update(bytes).digest('hex'));
  } finally {
    const absolute = fs.realpathSync(root), temp = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(absolute), temp); assert.match(path.basename(absolute), /^nodia-restore-hash-fixture-/);
    fs.unlinkSync(path.join(absolute, 'synthetic.bin')); fs.rmdirSync(absolute);
  }
});

test('the restore harness pins the shipped release and only the two existing local images', () => {
  assert.equal(PINS.source, 'f01b493336883403a84b1c80759ce4fc43cbd370');
  assert.equal(PINS.package, 'b8ac639b2cc032839dd17769b81f1da85cb16263f39594230e06ed2e1f1b7f38');
  for (const key of ['postgres', 'runner']) assert.match(PINS[key], /^sha256:[a-f0-9]{64}$/);
});
