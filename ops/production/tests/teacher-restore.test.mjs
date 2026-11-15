import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { argumentPairs, validateRelease, parseArguments, restoreTeacherBackup, privateKeyOutsideRepository, sameFingerprintData, PINS } from '../restore-teacher-backup.mjs';
import { fingerprintDigest, fingerprintPublicSchema, validateFingerprint, validateCaptureIdentity, MAX_TABLES } from '../fingerprint-teacher-restore.mjs';

const sha = data => createHash('sha256').update(data).digest('hex');
const source = 'a'.repeat(40), tree = 'b'.repeat(64), release = `backend-${source.slice(0, 12)}-${tree.slice(0, 12)}`;
const options = () => ({ 'cipher-file': 'backup.enc', 'cipher-sha256': 'c'.repeat(64), 'backup-id': '12345678-1234-4234-8234-123456789abc',
  'private-key-file': 'outside-repo.pem', 'fingerprint-file': 'fingerprint.json', 'fingerprint-sha256': 'd'.repeat(64),
  'package-archive': 'release.tar.gz', 'package-sha256': 'e'.repeat(64), 'node-archive': 'node.tar.gz', 'node-sha256': 'f'.repeat(64),
  'manifest-sha256': '1'.repeat(64), 'source-sha': source, 'release-id': release, 'tree-sha256': tree, output: 'receipt.json' });
const args = value => Object.entries(value).flatMap(([key, item]) => ['--' + key, item]);
const manifest = () => ({ schema_version: 1, deployment_eligible: true, source_provenance: 'git_archive', source_sha: source,
  release_id: release, package_tree_sha256: tree, runtime: { node: 'v24.22.2', platform: 'linux', arch: 'x64', executable_sha256: '2'.repeat(64) }, files: [] });
const expected = { source_sha: source, release_id: release, tree_sha256: tree, manifest_sha256: '1'.repeat(64) };

test('current release identities are explicit; old/static source and unknown or duplicate fields cannot slip through', () => {
  assert.equal(argumentPairs(args(options()))['release-id'], release);
  for (const changed of [args(options()).slice(2), [...args(options()), '--output', 'other'],
    args({ ...options(), 'source-sha': 'f01b493336883403a84b1c80759ce4fc43cbd370' }),
    args({ ...options(), 'manifest-sha256': 'bad' }), args(options()).map(x => x === '--tree-sha256' ? '--ignore-ledger' : x)])
    assert.throws(() => argumentPairs(changed));
  assert.equal(validateRelease(manifest(), expected.manifest_sha256, expected).source_sha, source);
  for (const changed of [{ source_sha: '0'.repeat(40) }, { deployment_eligible: false }, { source_provenance: 'overlay' },
    { release_id: 'backend-wrong' }, { package_tree_sha256: 'f'.repeat(64) }, { runtime: { node: 'v24.22.2' } }])
    assert.throws(() => validateRelease({ ...manifest(), ...changed }, expected.manifest_sha256, expected));
  assert.throws(() => validateRelease(manifest(), '0'.repeat(64), expected));
});

test('capture and restore bind the same exact current manifest without a historical CLI source pin', () => {
  const value = manifest(), digest = sha(JSON.stringify(value));
  validateCaptureIdentity(value, digest, [source, digest, release, tree]);
  assert.throws(() => validateCaptureIdentity(value, '0'.repeat(64), [source, digest, release, tree]));
  assert.throws(() => validateCaptureIdentity({ ...value, source_provenance: 'overlay' }, digest, [source, digest, release, tree]));
});

test('a ..custody directory inside the repository is not an outside private-key path', () => {
  const repo = path.resolve('synthetic-repository');
  assert.equal(privateKeyOutsideRepository(repo, path.join(repo, '..custody', 'key.pem')), false);
  assert.equal(privateKeyOutsideRepository(repo, path.join(repo, 'secrets', 'key.pem')), false);
  assert.equal(privateKeyOutsideRepository(repo, path.resolve(repo, '..', 'private', 'key.pem')), true);
});

test('the separate Teacher fingerprint accepts102 tables and rejects257 without lowering legacy limits', () => {
  assert.equal(MAX_TABLES, 256);
  const table = index => ({ name: `table_${String(index).padStart(3, '0')}`, rows: 0, md5: 'a'.repeat(32) });
  const tables = Array.from({ length: 102 }, (_, index) => table(index));
  assert.equal(validateFingerprint({ tables, aggregate_sha256: fingerprintDigest(tables) }).tables.length, 102);
  assert.throws(() => fingerprintDigest(Array.from({ length: 257 }, (_, index) => table(index))));
  const old = fs.readFileSync(new URL('../fingerprint-backend-public.mjs', import.meta.url), 'utf8');
  assert.match(old, /const MAX_TABLES = 100;/);
});

test('Python sort_keys fingerprints compare by all data, independently of JSON object key order', () => {
  const tables = [{ name: 'teacher_studies', rows: 3, md5: 'a'.repeat(32) },
    { name: 'users', rows: 2, md5: 'b'.repeat(32) }];
  const actual = validateFingerprint({ tables, aggregate_sha256: fingerprintDigest(tables) });
  // Exact object-key order produced by Python json.dumps(..., sort_keys=True).
  const captured = validateFingerprint(JSON.parse(`{"aggregate_sha256":"${actual.aggregate_sha256}","tables":[{"md5":"${tables[0].md5}","name":"teacher_studies","rows":3},{"md5":"${tables[1].md5}","name":"users","rows":2}]}`));
  assert.notEqual(JSON.stringify(actual), JSON.stringify(captured));
  assert.equal(sameFingerprintData(actual, captured), true);
  assert.equal(sameFingerprintData(captured, actual), true);
  for (const [field, changed] of [['name', 'teacher_topics'], ['rows', 4], ['md5', 'c'.repeat(32)]]) {
    const differentTables = tables.map((row, index) => index === 0 ? { ...row, [field]: changed } : { ...row });
    const different = validateFingerprint({ tables: differentTables, aggregate_sha256: fingerprintDigest(differentTables) });
    assert.equal(sameFingerprintData(actual, different), false);
  }
  const missingTables = tables.slice(1);
  assert.equal(sameFingerprintData(actual, validateFingerprint({ tables: missingTables, aggregate_sha256: fingerprintDigest(missingTables) })), false);
  assert.equal(sameFingerprintData(actual, { tables, aggregate_sha256: '0'.repeat(64) }), false);
  assert.equal(sameFingerprintData(actual, { ...actual, tables: [...tables].reverse() }), false);
});

test('fingerprinting still rejects RLS filtering and nonrepeatable/write transactions', async () => {
  const queries = [];
  const client = { query: async sql => {
    queries.push(sql);
    if (sql.includes("current_setting('transaction_read_only')")) return { rows: [{ readonly: 'on', isolation: 'repeatable read', encoding: 'UTF8' }] };
    if (sql.startsWith('WITH RECURSIVE')) return { rows: [{ name: 'teacher_studies', row_security: true, force_row_security: false }] };
    return { rows: [] };
  } };
  await assert.rejects(fingerprintPublicSchema(client), { safeCode: 'row_security_filtering_not_supported' });
  assert.ok(queries.includes('ROLLBACK TO SAVEPOINT nodia_public_fingerprint'));
  await assert.rejects(fingerprintPublicSchema({ query: async () => ({ rows: [{ readonly: 'off', isolation: 'read committed', encoding: 'UTF8' }] }) }),
    { safeCode: 'read_only_repeatable_utf8_transaction_required' });
});

test('input CAS is checked before Docker or RSA reads; private key stays outside repository', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-restore-fixture-'));
  try {
    const value = options();
    for (const key of ['cipher-file', 'private-key-file', 'package-archive', 'node-archive']) {
      value[key] = path.join(root, key); fs.writeFileSync(value[key], 'Synthetic fixture only');
    }
    const fingerprint = { tables: [], aggregate_sha256: fingerprintDigest([]) };
    value['fingerprint-file'] = path.join(root, 'fp.json'); fs.writeFileSync(value['fingerprint-file'], JSON.stringify(fingerprint));
    for (const [key, pin] of [['cipher-file', 'cipher-sha256'], ['package-archive', 'package-sha256'], ['node-archive', 'node-sha256'], ['fingerprint-file', 'fingerprint-sha256']])
      value[pin] = sha(fs.readFileSync(value[key]));
    value.output = path.join(root, 'receipt.json');
    assert.equal(parseArguments(args(value)).sourceFingerprint.aggregate_sha256, fingerprint.aggregate_sha256);
    fs.appendFileSync(value['cipher-file'], 'changed');
    assert.throws(() => parseArguments(args(value)), { safeCode: 'restore_input_digest_mismatch' });
  } finally { fs.rmSync(root, { recursive: true }); }
});

test('a remote Docker endpoint fails before any container or private key operation and cannot authorize recovery', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-restore-remote-'));
  try {
    const calls = [];
    const result = await restoreTeacherBackup({ ...options(), output: path.join(root, 'receipt.json'), sourceFingerprint: { aggregate_sha256: 'a'.repeat(64) } },
      { spawn: (_name, call) => { calls.push(call); return { status: 0, stdout: Buffer.from(call[0] === 'context' && call[1] === 'show' ? 'local' : '"ssh://remote"'), stderr: Buffer.alloc(0) }; } });
    assert.equal(result.status, 'failed'); assert.equal(result.error_code, 'remote_docker_endpoint_denied');
    assert.equal(result.release_authorized, false); assert.equal(result.runtime_recovery_authorized, false);
    assert.ok(calls.every(call => call[0] === 'context'));
  } finally { fs.rmSync(root, { recursive: true }); }
});

for (const interruption of [false, true]) test(interruption ? 'an interruption after decrypt begins cleans owned resources without reusing the aborted signal' : 'a rejected authenticated decryption never starts PostgreSQL and removes only its labeled resources', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-restore-gcm-'));
  try {
    const key = path.join(root, 'private.pem'); fs.writeFileSync(key, 'SYNTHETIC-PRIVATE-RSA-FIXTURE');
    const calls = [], containers = new Map(), volumes = new Map();
    let owner;
    const controller = new AbortController();
    const value = { ...options(), 'private-key-file': key, output: path.join(root, 'receipt.json'),
      sourceFingerprint: { aggregate_sha256: 'a'.repeat(64) }, fingerprintHelper: 'fp.mjs', inventoryHelper: 'inventory.mjs', inventoryHash: '3'.repeat(64) };
    const transferred = { '/tmp/package.tar.gz': value['package-sha256'], '/tmp/node.tar.gz': value['node-sha256'],
      '/harness/fingerprint-teacher-restore.mjs': PINS.fingerprint, '/quarantine/backup.enc': value['cipher-sha256'],
      '/quarantine/source-fingerprint.json': value['fingerprint-sha256'], '/harness/update-backend-action.mjs': value.inventoryHash };
    const fake = (_command, call, settings) => {
      calls.push({ call, input: settings.input });
      const result = text => ({ status: 0, stdout: Buffer.from(text), stderr: Buffer.alloc(0) });
      if (call[0] === 'context') return result(call[1] === 'show' ? 'local' : '"unix:///var/run/docker.sock"');
      if (call[0] === 'image') return result(call[2]);
      if (call[0] === 'volume' && call[1] === 'create') {
        const label = call[call.indexOf('--label') + 1]; owner = label.split('=')[1]; volumes.set(call.at(-1), owner); return result(call.at(-1));
      }
      if (call[0] === 'create') { const id = call[call.indexOf('--name') + 1]; containers.set(id, owner); return result(id); }
      if (call[0] === 'exec' && call[2] === '/usr/bin/sha256sum') return result(transferred[call[3]] + '  ' + call[3]);
      if (call[0] === 'start' && call.includes('-a')) {
        if (interruption) controller.abort();
        return { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.from('restore_decryption_failed') };
      }
      if (controller.signal.aborted) assert.equal(settings.signal, undefined, 'cleanup must have an independent lifetime');
      if (call[0] === 'inspect') return result(JSON.stringify([{ Config: { Labels: { 'nodia.teacher.database.restore': containers.get(call[1]) } } }]));
      if (call[0] === 'volume' && call[1] === 'inspect') return result(JSON.stringify([{ Labels: { 'nodia.teacher.database.restore': volumes.get(call[2]) } }]));
      return result('');
    };
    const receipt = await restoreTeacherBackup(value, { spawn: fake, signal: controller.signal });
    assert.equal(receipt.status, 'failed'); assert.equal(receipt.error_code, interruption ? 'restore_interrupted' : 'restore_decryption_failed');
    assert.equal(receipt.cleanup.errors.length, 0);
    assert.ok(!calls.some(item => item.call.includes('pg_restore') || item.call[0] === 'network'));
    const secretInputs = calls.filter(item => Buffer.isBuffer(item.input) && item.input.includes(Buffer.from('SYNTHETIC-PRIVATE-RSA-FIXTURE')));
    assert.equal(secretInputs.length, 0, 'input buffer is wiped after the decryption attempt');
    assert.ok(!JSON.stringify(calls.map(item => item.call)).includes('SYNTHETIC-PRIVATE-RSA-FIXTURE'));
    assert.ok(!fs.readFileSync(value.output, 'utf8').includes('SYNTHETIC-PRIVATE-RSA-FIXTURE'));
    const generated = calls.find(item => item.call.includes('cat > /harness/restore.mjs')).input;
    fs.writeFileSync(path.join(root, 'runner.mjs'), generated);
    assert.equal(spawnSync(process.execPath, ['--check', path.join(root, 'runner.mjs')]).status, 0);
  } finally { fs.rmSync(root, { recursive: true }); }
});

test('without explicit arguments both new entry points remain inert', () => {
  for (const name of ['restore-teacher-backup.mjs', 'fingerprint-teacher-restore.mjs']) {
    const result = spawnSync(process.execPath, [new URL('../' + name, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], { encoding: 'utf8' });
    assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).inert, true);
  }
  assert.match(PINS.postgres, /^sha256:/);
});
