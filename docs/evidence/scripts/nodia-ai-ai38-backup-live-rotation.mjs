// Linux stdin operator fixture: real R2/cipher lifecycle, injected expiry clock, no SQL/pg_dump.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, readdir, rmdir, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { userInfo } from 'node:os';
import { Readable } from 'node:stream';

const root = '/opt/nodia/releases/nodia-server-ai38-journal-r01';
const manifestPin = 'fb4c52fc19c82a9cdb0aa610e7b0a5d3b97641de78980cb76900381cad6bc3d0';
const backupConfigPath = '/etc/nodia-ai-recovery/backup.json';
const deployment = 'ai38-rotation-r01', prefix = `nodia-ai-recovery/${deployment}`;
const spoolParent = '/var/lib/nodia-ai-recovery/spool';
const spoolDirectory = `${spoolParent}/rotation-test-r01`;
const ledgerPath = `${spoolParent}/rotation-test-r01-ledger.json`;
const day = 86_400_000, actualStarted = new Date(), backupId = randomUUID(), eraId = randomUUID();
const stateKey = `${prefix}/state.bin`, objectKey = `${prefix}/backups/${backupId}.bin`;
const checks = {}, signal = AbortSignal.timeout(60_000);
let external, client, ledgerCreated = false, cleanupCompleted = false;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const safeError = error => /^nodia_ai:[a-z0-9_]{1,100}$/u.test(error?.message ?? '') ? error.message : 'rotation_fixture_failed';
async function assertOwned(path, directory = false, mode = 0o600) {
  const info = await lstat(path);
  assert.equal(await realpath(path), path); assert.equal(info.isSymbolicLink(), false);
  assert.equal(directory ? info.isDirectory() : info.isFile(), true);
  assert.equal(info.uid, process.getuid()); assert.equal(info.mode & 0o777, mode);
  if (!directory) assert.equal(info.nlink, 1);
  return info;
}
try {
  assert.equal(process.platform, 'linux'); assert.equal(userInfo().username, 'nodia');
  assert.equal(sha(await readFile(`${root}/release-manifest.json`)), manifestPin);
  const require = createRequire(`${root}/package.json`);
  require('reflect-metadata');
  const { S3Client, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const { loadNodiaAiExternalRecoveryConfig, createNodiaAiExternalRecovery } = await import(`${root}/dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js`);
  const { EncryptNodiaAiBackupUseCase } = await import(`${root}/dist/nodia-ai-recovery/use-case/encrypt-nodia-ai-backup.use-case.js`);
  const { ManageNodiaAiBackupsUseCase } = await import(`${root}/dist/nodia-ai-recovery/use-case/manage-nodia-ai-backups.use-case.js`);
  const { loadNodiaAiBackupConfiguration, createNodiaAiBackupPorts } = await import(`${root}/scripts/nodia-ai-backups.mjs`);
  await assertOwned(backupConfigPath); const current = await loadNodiaAiBackupConfiguration(backupConfigPath);
  await assertOwned(current.recovery_config); await assertOwned(spoolParent, true, 0o700);
  const recovery = { ...loadNodiaAiExternalRecoveryConfig(current.recovery_config), deployment_id: deployment, era_id: eraId };
  assert.equal(current.spool_directory, spoolParent);
  const publicKey = await readFile(current.public_key_file, 'utf8');
  assert.equal(publicKey.includes('PRIVATE KEY'), false);
  const encryption = new EncryptNodiaAiBackupUseCase(), encryptionKeyId = encryption.keyId(publicKey);
  await mkdir(spoolDirectory, { mode: 0o700 }); await assertOwned(spoolDirectory, true, 0o700);
  const ledger = await open(ledgerPath, 'wx', 0o600); ledgerCreated = true;
  try { await ledger.writeFile(JSON.stringify({ schema_version: 1, prefix, era_id: eraId, backup_id: backupId, state_key: stateKey, object_key: objectKey, spool_directory: spoolDirectory })); await ledger.sync(); }
  finally { await ledger.close(); }
  const durableDirectory = await open(spoolParent, 'r'); try { await durableDirectory.sync(); } finally { await durableDirectory.close(); }
  external = createNodiaAiExternalRecovery(recovery);
  client = new S3Client({ region: 'auto', endpoint: recovery.endpoint,
    credentials: { accessKeyId: recovery.access_key_id, secretAccessKey: recovery.secret_access_key },
    maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: { connectionTimeout: 1500, requestTimeout: 60_000 } });
  const send = command => client.send(command, { abortSignal: signal });
  const missing = async key => {
    for (const Command of [HeadObjectCommand, GetObjectCommand]) {
      try { const value = await send(new Command({ Bucket: recovery.bucket, Key: key })); value.Body?.destroy?.(); assert.fail('owned_object_still_present'); }
      catch (error) { assert.equal(error?.$metadata?.httpStatusCode, 404); }
    }
  };
  // This isolated era's historical timestamp is a fixture, not a claim of past coverage.
  await external.store.initialize(new Date(actualStarted.getTime() - 8 * day)); checks.isolated_state_created_once = true;
  const config = { ...current, spool_directory: spoolDirectory, max_dump_bytes: 1024 * 1024, timeout_seconds: 60 };
  const ports = createNodiaAiBackupPorts(config, { ...external, client }, recovery.bucket, publicKey, signal);
  let fakeNow = new Date(actualStarted.getTime() - 7 * day + 60_000);
  ports.now = () => new Date(fakeNow);
  const marker = Buffer.from('Nodia AI-38 synthetic expiry boundary fixture; no application data.');
  ports.prepare = async (entry, operationSignal) => {
    assert.equal(entry.backup_id, backupId); assert.equal(entry.object_key, objectKey);
    const path = `${spoolDirectory}/${backupId}.enc`, file = await open(path, 'wx', 0o600); await file.close();
    const receipt = await encryption.execute({ source: Readable.from([marker]), destination: createWriteStream(path, { flags: 'r+', mode: 0o600 }),
      public_key_pem: publicKey, backup_id: backupId, max_plain_bytes: config.max_dump_bytes, signal: operationSignal });
    const spool = await open(path, 'r+'); try { await spool.sync(); } finally { await spool.close(); }
    const cipher = await readFile(path); assert.equal(cipher.subarray(0, 8).toString(), 'NODAI38B');
    assert.equal(cipher.includes(marker), false); assert.equal(cipher.length, receipt.cipher_bytes); assert.equal(sha(cipher), receipt.cipher_sha256);
    return receipt;
  };
  const lifecycle = new ManageNodiaAiBackupsUseCase();
  const ready = await lifecycle.create({ backup_id: backupId, prefix, encryption_key_id: encryptionKeyId, backup_max_days: 7 }, ports, signal);
  assert.equal(ready.status, 'ready'); assert.equal(ready.object_key, objectKey);
  const observed = await ports.inspect(ready, signal);
  assert.equal(observed?.cipher_bytes, ready.cipher_bytes); assert.equal(observed?.cipher_sha256, ready.cipher_sha256);
  assert.equal(observed.version_id, null); checks.real_encrypted_upload_HEAD_GET_digest = true;
  assert.equal((await ports.catalog.read()).length, 1); assert.deepEqual(await readdir(spoolDirectory), []);
  fakeNow = new Date(Date.parse(ready.expires_at) - 1);
  const before = await lifecycle.rotate(ports, signal);
  assert.equal(before.retained, 1); assert.equal(before.removed, 0);
  assert.ok(await ports.inspect(ready, signal)); checks.retained_one_millisecond_before_expiry = true;
  fakeNow = new Date(ready.expires_at);
  const atExpiry = await lifecycle.rotate(ports, signal);
  assert.equal(atExpiry.removed, 1); assert.equal(atExpiry.retained, 0);
  assert.deepEqual(await ports.catalog.read(), []); await missing(objectKey);
  checks.deleted_at_exact_injected_seven_day_boundary = true;
  const final = await external.store.snapshot();
  assert.equal(final.state.era_id, eraId); assert.equal(final.state.entries.length, 0); assert.equal(final.state.backups.length, 0);
  const head = await send(new HeadObjectCommand({ Bucket: recovery.bucket, Key: stateKey }));
  assert.equal(head.ETag, final.etag); assert.equal(head.VersionId ?? null, null); assert.ok(head.ContentLength > 28 && head.ContentLength <= 8 * 1024 * 1024 + 28);
  const read = await send(new GetObjectCommand({ Bucket: recovery.bucket, Key: stateKey, IfMatch: head.ETag }));
  assert.equal(read.ETag, head.ETag); assert.equal(read.VersionId ?? null, null);
  const chunks = []; let size = 0;
  try { for await (const chunk of read.Body) { size += chunk.length; assert.ok(size <= head.ContentLength); chunks.push(Buffer.from(chunk)); } }
  finally { read.Body.destroy?.(); }
  assert.equal(size, head.ContentLength); const stateCipherSha = sha(Buffer.concat(chunks));
  const headAgain = await send(new HeadObjectCommand({ Bucket: recovery.bucket, Key: stateKey }));
  assert.equal(headAgain.ETag, head.ETag);
  // Exclusively created test namespace and authenticated era; no atomic DELETE If-Match claim.
  await send(new DeleteObjectCommand({ Bucket: recovery.bucket, Key: stateKey })); await missing(stateKey);
  checks.own_state_removed_after_positive_observation = true;
  await assertOwned(ledgerPath); await assertOwned(spoolDirectory, true, 0o700);
  assert.deepEqual(await readdir(spoolDirectory), []); await rmdir(spoolDirectory); await unlink(ledgerPath);
  cleanupCompleted = true;
  process.stdout.write(JSON.stringify({ schema_version: 1, stage: 'AI-38', status: 'passed',
    observed_at_VM_utc: new Date().toISOString(), scope: 'real_R2_encrypted_synthetic_artifact_with_injected_expiry_clock',
    clock_injected: true, seven_days_actually_elapsed: false, VM_clock_changed: false, historical_coverage_claimed: false,
    backup_id: backupId, captured_at_fixture: ready.captured_at, expires_at_fixture: ready.expires_at,
    cipher_bytes: ready.cipher_bytes, cipher_sha256: ready.cipher_sha256, state_cipher_sha256_before_cleanup: stateCipherSha,
    checks, catalog_entries_after_rotation: 0, own_objects_absent_HEAD_GET: true, own_ledger_and_spool_removed: true,
    production_SQL_reads: 0, production_SQL_writes: 0, pg_dump_invocations: 0, provider_requests: 0,
    bucket_listing_requests: 0, bucket_role_changed: false, private_RSA_key_read: false, release_authorized: false }) + '\n');
} catch (error) {
  process.stdout.write(JSON.stringify({ schema_version: 1, stage: 'AI-38', status: 'failed', category: safeError(error),
    clock_injected: true, VM_clock_changed: false, seven_days_actually_elapsed: false, checks,
    cleanup_completed: cleanupCompleted, private_ledger_retained: ledgerCreated && !cleanupCompleted,
    cloud_state_not_automatically_removed_on_failure: !cleanupCompleted, private_details_emitted: false, release_authorized: false }) + '\n');
  process.exitCode = 1;
} finally { client?.destroy(); external?.client.destroy(); }
