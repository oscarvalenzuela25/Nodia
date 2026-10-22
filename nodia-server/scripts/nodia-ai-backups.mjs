// Operator-only, no AppModule, MCP endpoint, migration or configured application env.
import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, statfs, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { finished } from 'node:stream/promises';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { EncryptNodiaAiBackupUseCase } from '../dist/nodia-ai-recovery/use-case/encrypt-nodia-ai-backup.use-case.js';
import { ManageNodiaAiBackupsUseCase } from '../dist/nodia-ai-recovery/use-case/manage-nodia-ai-backups.use-case.js';
import { loadNodiaAiExternalRecoveryConfig, createNodiaAiExternalRecovery } from '../dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js';

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u;
const fail = code => { throw Error(`nodia_ai:backup_${code}`); };
async function ownedFile(path, { privateFile = true, maxBytes = 65536 } = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || (await realpath(path)) !== path) return fail('file_invalid');
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.uid !== process.getuid() || info.size > maxBytes ||
    (privateFile && (info.mode & 0o777) !== 0o600) || (!privateFile && (info.mode & 0o022) !== 0)) return fail('file_invalid');
  return info;
}
export async function loadNodiaAiBackupConfiguration(path) {
  await ownedFile(path);
  const config = JSON.parse(await readFile(path, 'utf8'));
  const fields = ['recovery_config', 'public_key_file', 'spool_directory', 'pg_dump_binary', 'database', 'max_dump_bytes', 'timeout_seconds'];
  const dbFields = ['host', 'port', 'username', 'password', 'database'];
  if (!config || Object.keys(config).length !== fields.length || fields.some(key => !Object.hasOwn(config, key)) ||
    !config.database || Object.keys(config.database).length !== dbFields.length || dbFields.some(key => !Object.hasOwn(config.database, key)) ||
    !['host', 'username', 'password', 'database'].every(key => typeof config.database[key] === 'string' && config.database[key].length > 0 && config.database[key].length <= 4096 && !config.database[key].includes('\0')) ||
    !Number.isSafeInteger(config.database.port) || config.database.port < 1 || config.database.port > 65535 ||
    !Number.isSafeInteger(config.max_dump_bytes) || config.max_dump_bytes < 1 || config.max_dump_bytes > 1024 ** 3 ||
    !Number.isSafeInteger(config.timeout_seconds) || config.timeout_seconds < 1 || config.timeout_seconds > 3600 ||
    typeof config.spool_directory !== 'string' || !config.spool_directory.startsWith('/') ||
    !/^\/usr\/(?:bin|lib\/postgresql\/\d+\/bin)\/pg_dump$/u.test(config.pg_dump_binary)) return fail('configuration_invalid');
  await ownedFile(config.public_key_file, { privateFile: false, maxBytes: 16384 });
  const binary = await lstat(config.pg_dump_binary);
  if (!binary.isFile() || binary.uid !== 0 || (binary.mode & 0o022) !== 0) return fail('dump_binary_invalid');
  await mkdir(config.spool_directory, { recursive: false, mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  if ((await realpath(config.spool_directory)) !== config.spool_directory) return fail('spool_invalid');
  const directory = await lstat(config.spool_directory);
  if (!directory.isDirectory() || directory.uid !== process.getuid() || (directory.mode & 0o777) !== 0o700) return fail('spool_invalid');
  return config;
}
const missing = error => error?.$metadata?.httpStatusCode === 404 || error?.name === 'NoSuchKey' || error?.name === 'NotFound';

/** Deliberately emits no process environment, command line, config or PID. This
 * checks live writer identity/configuration; package adoption checks attest code. */
export async function assertNodiaAiBackupWriters(config) {
  const inspectUnit = async unit => {
    const stdout = await new Promise((resolveOutput, reject) => {
      execFile('/usr/bin/systemctl', ['show', unit, '--property=ActiveState,MainPID', '--no-pager'],
        { timeout: 3000, maxBuffer: 2048, encoding: 'utf8' }, (error, output) => error ? reject(Error('nodia_ai:backup_writers_unverified')) : resolveOutput(output));
    });
    const fields = Object.fromEntries(stdout.trim().split('\n').map(line => line.split('=')));
    const pid = Number(fields.MainPID);
    if (fields.ActiveState !== 'active' || !Number.isSafeInteger(pid) || pid <= 0) return fail('writers_unverified');
    return pid;
  };
  const packageRoot = await realpath(fileURLToPath(new URL('../', import.meta.url)));
  try {
    for (const unit of ['nodia-api.service', 'nodia-ai-worker.service']) {
      const pid = await inspectUnit(unit);
      if ((await realpath(`/proc/${pid}/cwd`)) !== packageRoot) return fail('writers_unverified');
      const file = await open(`/proc/${pid}/environ`, 'r');
      const bytes = Buffer.alloc(1024 * 1024 + 1);
      let count;
      try { ({ bytesRead: count } = await file.read(bytes, 0, bytes.length, 0)); } finally { await file.close(); }
      if (count > 1024 * 1024) return fail('writers_unverified');
      const key = Buffer.from('NODIA_AI_RECOVERY_CONFIG_FILE=');
      const environment = bytes.subarray(0, count);
      let value = null, matches = 0, position = 0;
      while (position < environment.length) {
        const end = environment.indexOf(0, position);
        if (end < 0) return fail('writers_unverified');
        if (environment.subarray(position, position + key.length).equals(key)) {
          value = environment.subarray(position + key.length, end).toString('utf8'); matches++;
        }
        position = end + 1;
      }
      environment.fill(0);
      if (matches !== 1 || value !== config.recovery_config || await inspectUnit(unit) !== pid) return fail('writers_unverified');
    }
  } catch { return fail('writers_unverified'); }
}

/** Storage adapter is deliberately exact-key and single-attempt. No bucket listing,
 * multipart upload, raw SQL or plaintext dump is performed by this adapter. */
export function createNodiaAiBackupPorts(config, external, bucket, publicKeyPem, signal) {
  const encrypter = new EncryptNodiaAiBackupUseCase();
  const maxCipherBytes = config.max_dump_bytes + 8220;
  const spool = entry => {
    if (!uuid.test(entry.backup_id) || entry.object_key !== `${external.prefix}/backups/${entry.backup_id}.bin`) return fail('ownership_invalid');
    return join(config.spool_directory, `${entry.backup_id}.enc`);
  };
  const readOwnedSpool = async entry => {
    const path = spool(entry), info = await ownedFile(path, { maxBytes: maxCipherBytes });
    if (info.size !== entry.cipher_bytes) return fail('spool_mismatch');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path, { highWaterMark: 65536, signal })) hash.update(chunk);
    if (hash.digest('hex') !== entry.cipher_sha256) return fail('spool_mismatch');
    return path;
  };
  const client = external.client;
  return {
    catalog: external.store.catalog,
    now: () => new Date(),
    async prepare(entry, operationSignal) {
      const path = spool(entry);
      const space = await statfs(config.spool_directory);
      if (space.bavail * space.bsize < maxCipherBytes) return fail('spool_capacity');
      const file = await open(path, 'wx', 0o600); await file.close();
      const child = spawn(config.pg_dump_binary, ['--format=custom', '--no-owner', '--no-acl', '--compress=0', '--no-password', '--host', config.database.host, '--port', String(config.database.port), '--username', config.database.username, '--dbname', config.database.database], {
        stdio: ['ignore', 'pipe', 'ignore'], shell: false,
        env: { PATH: '/usr/bin:/bin', LANG: 'C', PGPASSWORD: config.database.password, PGCONNECT_TIMEOUT: String(Math.min(30, config.timeout_seconds)), PGAPPNAME: 'nodia-ai-encrypted-backup' },
      });
      let childError;
      const closed = new Promise(resolveChild => {
        child.once('error', () => { childError = Error('nodia_ai:backup_dump_start_failed'); });
        child.once('close', code => resolveChild(code));
      });
      const abort = () => child.kill('SIGTERM'); operationSignal.addEventListener('abort', abort, { once: true });
      try {
        const receipt = await encrypter.execute({ source: child.stdout, destination: createWriteStream(path, { flags: 'r+', mode: 0o600, highWaterMark: 65536 }), public_key_pem: publicKeyPem, backup_id: entry.backup_id, max_plain_bytes: config.max_dump_bytes, signal: operationSignal });
        const code = await closed;
        if (childError || code !== 0) throw childError ?? Error('nodia_ai:backup_dump_failed');
        const durable = await open(path, 'r+'); try { await durable.sync(); } finally { await durable.close(); }
        return receipt;
      } finally {
        operationSignal.removeEventListener('abort', abort);
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGTERM');
          const killTimer = setTimeout(() => child.kill('SIGKILL'), 1000); killTimer.unref();
          await closed; clearTimeout(killTimer);
        }
      }
    },
    async upload(entry, operationSignal) {
      const path = await readOwnedSpool(entry), body = createReadStream(path, { highWaterMark: 65536, signal: operationSignal });
      try {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: entry.object_key, Body: body, ContentLength: entry.cipher_bytes, ContentType: 'application/octet-stream', IfNoneMatch: '*', Metadata: { 'nodia-backup-id': entry.backup_id, 'encryption-key-id': entry.encryption_key_id, 'cipher-sha256': entry.cipher_sha256 } }), { abortSignal: operationSignal });
      } finally { body.destroy(); await finished(body).catch(() => {}); }
    },
    async inspect(entry, operationSignal) {
      spool(entry); // checks exact namespace before any remote request
      let head;
      try { head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: entry.object_key }), { abortSignal: operationSignal }); }
      catch (error) { if (missing(error)) return null; throw error; }
      if (head.VersionId) return fail('versioned_object_unsupported');
      if (!head.ETag || !Number.isSafeInteger(head.ContentLength) || head.ContentLength < 1 || head.ContentLength > maxCipherBytes ||
        head.Metadata?.['nodia-backup-id'] !== entry.backup_id || head.Metadata?.['encryption-key-id'] !== entry.encryption_key_id || head.Metadata?.['cipher-sha256'] !== entry.cipher_sha256) return fail('object_mismatch');
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: entry.object_key, IfMatch: head.ETag }), { abortSignal: operationSignal });
      if (!object.Body || object.ETag !== head.ETag || object.ContentLength !== head.ContentLength) { object.Body?.destroy?.(); return fail('object_mismatch'); }
      if (object.VersionId) { object.Body.destroy?.(); return fail('versioned_object_unsupported'); }
      const hash = createHash('sha256'); let bytes = 0;
      try {
        for await (const chunk of object.Body) { bytes += chunk.length; if (bytes > maxCipherBytes) return fail('size_exceeded'); hash.update(chunk); }
      } finally { object.Body.destroy?.(); }
      if (bytes !== head.ContentLength) return fail('object_mismatch');
      return { cipher_bytes: bytes, cipher_sha256: hash.digest('hex'), backup_id: head.Metadata['nodia-backup-id'], encryption_key_id: head.Metadata['encryption-key-id'], etag: head.ETag, version_id: head.VersionId ?? null };
    },
    async deleteExact(entry, observation, operationSignal) {
      spool(entry);
      if (observation.version_id !== null) return fail('versioned_object_unsupported');
      if (observation.backup_id !== entry.backup_id || observation.encryption_key_id !== entry.encryption_key_id ||
        observation.cipher_bytes !== entry.cipher_bytes || observation.cipher_sha256 !== entry.cipher_sha256 ||
        typeof observation.etag !== 'string' || observation.etag.length === 0) return fail('object_mismatch');
      // Real R2 ignored DELETE If-Match. Safety instead comes from this exclusively
      // owned UUID key: single conditional PUT, no overwrite/replay, runner flock,
      // and the positive HEAD/GET digest above. Administrative foreign writers are
      // outside this contract; the destination must not grant them this namespace.
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: entry.object_key }), { abortSignal: operationSignal });
    },
    async cleanupSpool(entry) {
      const path = spool(entry);
      try { await ownedFile(path, { maxBytes: maxCipherBytes }); await unlink(path); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    },
  };
}

async function main() {
  if (process.platform !== 'linux') return fail('linux_required');
  const [operation, configPath, ...extra] = process.argv.slice(2);
  if (!['backup', 'rotate'].includes(operation) || extra.length || !configPath) return fail('arguments_invalid');
  const config = await loadNodiaAiBackupConfiguration(configPath);
  const lockPath = join(config.spool_directory, '.backup.lock');
  const lock = await open(lockPath, 'a', 0o600); await lock.close(); await ownedFile(lockPath, { maxBytes: 0 });
  if (process.env.NODIA_AI_BACKUP_LOCK_CHILD !== '1') {
    const child = spawn('/usr/bin/flock', ['--nonblock', '--conflict-exit-code', '75', lockPath, process.execPath, fileURLToPath(import.meta.url), operation, configPath], { shell: false, stdio: 'inherit', env: { ...process.env, NODIA_AI_BACKUP_LOCK_CHILD: '1' } });
    const code = await new Promise((resolveCode, reject) => { child.once('error', reject); child.once('close', resolveCode); });
    process.exitCode = code ?? 1; return;
  }
  const recoveryConfig = await loadNodiaAiExternalRecoveryConfig(config.recovery_config);
  const external = createNodiaAiExternalRecovery(recoveryConfig);
  const backupClient = new S3Client({ region: 'auto', endpoint: recoveryConfig.endpoint,
    credentials: { accessKeyId: recoveryConfig.access_key_id, secretAccessKey: recoveryConfig.secret_access_key },
    maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: { connectionTimeout: 1500, requestTimeout: Math.min(config.timeout_seconds * 1000, 120000) } });
  try {
    const publicKey = await readFile(config.public_key_file, 'utf8');
    const signal = AbortSignal.timeout(config.timeout_seconds * 1000);
    const keyId = new EncryptNodiaAiBackupUseCase().keyId(publicKey);
    const ports = createNodiaAiBackupPorts(config, { ...external, client: backupClient }, recoveryConfig.bucket, publicKey, signal);
    const lifecycle = new ManageNodiaAiBackupsUseCase();
    const rotated = await lifecycle.rotate(ports, signal);
    await external.store.prune();
    if (operation === 'rotate') { process.stdout.write(JSON.stringify({ schema_version: 1, operation, ...rotated }) + '\n'); return; }
    await assertNodiaAiBackupWriters(config);
    const ready = await lifecycle.create({ backup_id: randomUUID(), prefix: external.prefix, encryption_key_id: keyId, backup_max_days: 7 }, ports, signal);
    process.stdout.write(JSON.stringify({ schema_version: 1, operation, backup_id: ready.backup_id, status: ready.status, captured_at: ready.captured_at, expires_at: ready.expires_at, cipher_bytes: ready.cipher_bytes, cipher_sha256: ready.cipher_sha256, encryption_key_id: ready.encryption_key_id, journal_sequence: ready.journal_sequence, rotated }) + '\n');
  } finally { backupClient.destroy(); external.client.destroy(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const code = error instanceof Error && /^nodia_ai:[a-z0-9_]{1,100}$/u.test(error.message) ? error.message : 'nodia_ai:backup_failed';
    process.stderr.write(code + '\n'); process.exitCode = 1;
  });
}
