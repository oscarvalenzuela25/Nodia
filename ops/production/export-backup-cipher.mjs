// Operator-only GET export of one ready encrypted backup. Never decrypts or mutates R2.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { link, lstat, open, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const KEY = 'f7af9aea7868daa71a9500f9bbd91f35a3fe6fea396f82d5f5a9c78ab8510bbd';
const DIRECTORY = '/var/lib/nodia/backups/export';
const MAXIMUM = 268435456 + 12 + 8192 + 16;
const fail = code => { throw Error(`nodia_backup_export:${code}`); };
const ensure = (ok, code) => { if (!ok) fail(code); };

export function validateEntry(entry, id, expectedHash, now = Date.now()) {
  ensure(entry?.backup_id === id && entry.status === 'ready' && entry.cipher_sha256 === expectedHash &&
    entry.encryption_key_id === KEY && Number.isSafeInteger(entry.cipher_bytes) && entry.cipher_bytes > 0 &&
    entry.cipher_bytes <= MAXIMUM && Date.parse(entry.captured_at) <= now && Date.parse(entry.expires_at) > now &&
    /^nodia-ai-recovery\/[a-z0-9_-]{1,48}\/backups\/[a-f0-9-]{36}\.bin$/u.test(entry.object_key) &&
    entry.object_key.endsWith(`/${id}.bin`), 'catalog_entry_mismatch');
}

export function validateObject(object, entry) {
  ensure(!object.VersionId && typeof object.ETag === 'string' && object.ETag.length > 0 &&
    object.ContentLength === entry.cipher_bytes && object.Metadata?.['nodia-backup-id'] === entry.backup_id &&
    object.Metadata?.['encryption-key-id'] === KEY && object.Metadata?.['cipher-sha256'] === entry.cipher_sha256,
  'object_metadata_mismatch');
}

async function fileDigest(filename, expectedBytes) {
  const info = await lstat(filename);
  ensure(info.isFile() && !info.isSymbolicLink() && info.uid === 900 && info.nlink === 1 &&
    (info.mode & 0o777) === 0o600 && info.size === expectedBytes, 'local_cipher_invalid');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  const [id, expectedHash, ...extra] = process.argv.slice(2);
  ensure(process.platform === 'linux' && process.getuid() === 900 && extra.length === 0 &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(id ?? '') &&
    /^[a-f0-9]{64}$/u.test(expectedHash ?? ''), 'arguments_invalid');
  const directory = await lstat(DIRECTORY);
  ensure(directory.isDirectory() && !directory.isSymbolicLink() && directory.uid === 900 &&
    (directory.mode & 0o777) === 0o700 && await realpath(DIRECTORY) === DIRECTORY, 'private_export_directory_required');
  const root = await realpath('/opt/nodia/current');
  ensure(await realpath(process.cwd()) === root, 'adopted_package_cwd_required');
  const require = createRequire(path.join(root, 'package.json'));
  const { HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
  const { createNodiaAiExternalRecovery, loadNodiaAiExternalRecoveryConfig } =
    await import(pathToFileURL(path.join(root, 'dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js')).href);
  const config = loadNodiaAiExternalRecoveryConfig('/var/lib/nodia/config/recovery.json');
  const external = createNodiaAiExternalRecovery(config);
  const target = path.join(DIRECTORY, `${id}.bin`);
  let temporary;
  try {
    const { state } = await external.store.snapshot();
    const matches = state.backups.filter(entry => entry.backup_id === id);
    ensure(matches.length === 1, 'backup_not_unique');
    const entry = matches[0]; validateEntry(entry, id, expectedHash);
    let existing = false;
    try { await lstat(target); existing = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing) ensure(await fileDigest(target, entry.cipher_bytes) === expectedHash, 'existing_cipher_mismatch');
    else {
      const signal = AbortSignal.timeout(120000);
      const head = await external.client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: entry.object_key }), { abortSignal: signal });
      validateObject(head, entry);
      const object = await external.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: entry.object_key, IfMatch: head.ETag }), { abortSignal: signal });
      try {
        validateObject(object, entry);
        ensure(object.ETag === head.ETag && object.Body?.[Symbol.asyncIterator], 'object_changed');
        temporary = path.join(DIRECTORY, `${id}.${randomUUID()}.partial`);
        const file = await open(temporary, 'wx', 0o600);
        let bytes = 0; const hash = createHash('sha256');
        try {
          for await (const chunk of object.Body) {
            bytes += chunk.length;
            ensure(bytes <= entry.cipher_bytes && bytes <= MAXIMUM, 'cipher_size_exceeded');
            hash.update(chunk); await file.writeFile(chunk);
          }
          ensure(bytes === entry.cipher_bytes && hash.digest('hex') === expectedHash, 'cipher_digest_mismatch');
          await file.sync();
        } finally { await file.close(); }
      } finally { object.Body?.destroy?.(); }
      validateEntry(entry, id, expectedHash);
      await link(temporary, target); await unlink(temporary); temporary = undefined;
      const parent = await open(DIRECTORY, 'r'); try { await parent.sync(); } finally { await parent.close(); }
      ensure(await fileDigest(target, entry.cipher_bytes) === expectedHash, 'saved_cipher_mismatch');
    }
    validateEntry(entry, id, expectedHash);
    process.stdout.write(JSON.stringify({ status: 'exported', backup_id: id, cipher_sha256: expectedHash,
      cipher_bytes: entry.cipher_bytes, encryption_key_id: KEY, existing_adopted: existing,
      cloud_mutations_requested: false, plaintext_created: false }) + '\n');
  } finally {
    external.client.destroy();
    if (temporary) await unlink(temporary).catch(() => {});
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    const code = /^nodia_backup_export:[a-z0-9_]+$/u.test(error?.message ?? '') ? error.message : 'nodia_backup_export:failed';
    process.stderr.write(code + '\n'); process.exitCode = 1;
  });
}
