// Local configuration/custody actions only. Never invokes backup, storage or application bootstrap.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { constants, createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey,
  privateDecrypt, publicEncrypt, randomBytes } from 'node:crypto';

const fail = code => { throw new Error(`nodia_backup_setup:${code}`); };
const ensure = (condition, code) => { if (!condition) fail(code); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const PURPOSE = 'nodia_configuration_custody';
const MAGIC = Buffer.from('NODCFG01');
const MAX_PLAIN = 256 * 1024;
const CONFIG_PATH = '/var/lib/nodia/config/backup.json';
const RECOVERY_PATH = '/var/lib/nodia/config/recovery.json';
const PUBLIC_PATH = '/var/lib/nodia/config/backup-public.pem';
const SPOOL_PATH = '/var/lib/nodia/backups/spool';
const DATABASE_BINARY = '/usr/lib/postgresql/16/bin/pg_dump';
const ROOT_CERT = '/etc/ssl/certs/ca-certificates.crt';
const FILE_NAMES = ['runtime.env', 'redis.env', 'recovery.json'];
const closed = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));

export function publicKeyDetails(pem, expected) {
  ensure(typeof pem === 'string' && Buffer.byteLength(pem) <= 16_384 &&
    /^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END PUBLIC KEY-----\r?\n?$/u.test(pem), 'public_spki_only');
  const encoded = pem.replace(/^-----BEGIN PUBLIC KEY-----\r?\n/u, '').replace(/-----END PUBLIC KEY-----\r?\n?$/u, '').replace(/[\r\n]/gu, '');
  const der = Buffer.from(encoded, 'base64');
  ensure(der.length > 0 && der.toString('base64') === encoded, 'public_spki_only');
  let key;
  try { key = createPublicKey({ key: der, format: 'der', type: 'spki' }); }
  catch { return fail('public_spki_only'); }
  ensure(key.asymmetricKeyType === 'rsa' && key.asymmetricKeyDetails?.modulusLength >= 3072 &&
    key.asymmetricKeyDetails.modulusLength <= 8192 && key.export({ type: 'spki', format: 'der' }).equals(der), 'rsa_public_key_invalid');
  const id = sha(der);
  ensure(typeof expected === 'string' && /^[a-f0-9]{64}$/u.test(expected) && id === expected, 'public_key_fingerprint_mismatch');
  return { key, id, modulus_bits: key.asymmetricKeyDetails.modulusLength };
}

export function createBackupConfiguration(environment, maxDumpBytes, timeoutSeconds) {
  ensure(environment.PGSSLMODE === 'verify-full' && environment.NODIA_AI_RECOVERY_CONFIG_FILE === RECOVERY_PATH, 'runtime_contract_invalid');
  for (const name of ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'])
    ensure(typeof environment[name] === 'string' && environment[name].length > 0 && environment[name].length <= 4096 &&
      !environment[name].includes('\0'), 'explicit_database_configuration_required');
  ensure(/^[1-9][0-9]{0,4}$/u.test(environment.POSTGRES_PORT) && Number(environment.POSTGRES_PORT) <= 65535 &&
    !/[\s,@\\/]/u.test(environment.POSTGRES_HOST) && !environment.POSTGRES_DB.includes('=') &&
    !/^postgres(?:ql)?:/iu.test(environment.POSTGRES_DB), 'database_destination_invalid');
  ensure(Number.isSafeInteger(maxDumpBytes) && maxDumpBytes > 0 && maxDumpBytes <= 1024 ** 3 &&
    Number.isSafeInteger(timeoutSeconds) && timeoutSeconds > 0 && timeoutSeconds <= 3600, 'capture_limits_invalid');
  return { recovery_config: RECOVERY_PATH, public_key_file: PUBLIC_PATH, spool_directory: SPOOL_PATH,
    pg_dump_binary: DATABASE_BINARY, database: { host: environment.POSTGRES_HOST, port: Number(environment.POSTGRES_PORT),
      username: environment.POSTGRES_USER, password: environment.POSTGRES_PASSWORD, database: environment.POSTGRES_DB,
      tls: { mode: 'verify-full', root_cert_file: ROOT_CERT } }, max_dump_bytes: maxDumpBytes, timeout_seconds: timeoutSeconds };
}

export function validateCustodyPayload(value) {
  ensure(closed(value, ['schema_version', 'purpose', 'created_at_utc', 'restore_policy', 'files']) &&
    value.schema_version === 1 && value.purpose === PURPOSE && value.restore_policy === 'operator_review_only' &&
    typeof value.created_at_utc === 'string' && new Date(value.created_at_utc).toISOString() === value.created_at_utc &&
    Array.isArray(value.files) && value.files.length === FILE_NAMES.length, 'custody_payload_invalid');
  for (const [index, entry] of value.files.entries()) {
    ensure(closed(entry, ['name', 'encoding', 'sha256', 'content']) && entry.name === FILE_NAMES[index] && entry.encoding === 'base64' &&
      typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(entry.sha256) && typeof entry.content === 'string', 'custody_payload_invalid');
    const bytes = Buffer.from(entry.content, 'base64');
    ensure(bytes.length > 0 && bytes.length <= 65536 && bytes.toString('base64') === entry.content && sha(bytes) === entry.sha256,
      'custody_payload_invalid');
  }
  return value;
}

export function sealCustody(payload, publicPem, expectedKeyId) {
  validateCustodyPayload(payload);
  const plaintext = Buffer.from(JSON.stringify(payload));
  ensure(plaintext.length <= MAX_PLAIN, 'custody_payload_too_large');
  const { key, id } = publicKeyDetails(publicPem, expectedKeyId);
  const dek = randomBytes(32), nonce = randomBytes(12);
  try {
    const header = Buffer.from(JSON.stringify({ schema_version: 1, purpose: PURPOSE, algorithm: 'AES-256-GCM',
      wrapping: 'RSA-OAEP-SHA256', encryption_key_id: id,
      wrapped_key: publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, dek).toString('base64'),
      nonce: nonce.toString('base64') }));
    ensure(header.length <= 8192, 'custody_header_invalid');
    const size = Buffer.alloc(4); size.writeUInt32BE(header.length);
    const prefix = Buffer.concat([MAGIC, size, header]);
    const cipher = createCipheriv('aes-256-gcm', dek, nonce); cipher.setAAD(prefix);
    return Buffer.concat([prefix, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  } finally { dek.fill(0); plaintext.fill(0); }
}

// Offline consumer primitive for testing/operator tooling. There is deliberately no decrypt CLI on the VPS.
// The independently recorded ciphertext digest must be pinned: a public key alone does not authenticate origin.
export function openCustody(envelope, privatePem, expectedCipherSha256) {
  ensure(Buffer.isBuffer(envelope) && envelope.length > 28 && envelope.length <= MAX_PLAIN + 8220 &&
    typeof expectedCipherSha256 === 'string' && /^[a-f0-9]{64}$/u.test(expectedCipherSha256) && sha(envelope) === expectedCipherSha256 &&
    envelope.subarray(0, 8).equals(MAGIC), 'custody_ciphertext_invalid');
  const length = envelope.readUInt32BE(8);
  ensure(length > 0 && length <= 8192 && envelope.length > 12 + length + 16, 'custody_header_invalid');
  const header = JSON.parse(envelope.subarray(12, 12 + length).toString('utf8'));
  ensure(closed(header, ['schema_version', 'purpose', 'algorithm', 'wrapping', 'encryption_key_id', 'wrapped_key', 'nonce']) &&
    header.schema_version === 1 && header.purpose === PURPOSE && header.algorithm === 'AES-256-GCM' && header.wrapping === 'RSA-OAEP-SHA256' &&
    typeof header.wrapped_key === 'string' && typeof header.nonce === 'string', 'custody_header_invalid');
  const privateKey = createPrivateKey(privatePem);
  const derivedPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
  publicKeyDetails(derivedPem, header.encryption_key_id);
  const wrapped = Buffer.from(header.wrapped_key, 'base64'), nonce = Buffer.from(header.nonce, 'base64');
  ensure(wrapped.toString('base64') === header.wrapped_key && nonce.toString('base64') === header.nonce && nonce.length === 12,
    'custody_header_invalid');
  const dek = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, wrapped);
  try {
    ensure(dek.length === 32, 'custody_key_invalid');
    const decipher = createDecipheriv('aes-256-gcm', dek, nonce);
    decipher.setAAD(envelope.subarray(0, 12 + length)); decipher.setAuthTag(envelope.subarray(-16));
    const plaintext = Buffer.concat([decipher.update(envelope.subarray(12 + length, -16)), decipher.final()]);
    try { return validateCustodyPayload(JSON.parse(plaintext.toString('utf8'))); }
    finally { plaintext.fill(0); }
  } finally { dek.fill(0); }
}

function privateOutputRequired() {
  const output = fs.fstatSync(1);
  ensure(output.isFile() && output.uid === 0 && output.nlink === 1 && (output.mode & 0o777) === 0o600, 'private_root_stdout_required');
}

async function main() {
  const [mode, expectedKeyId, maximum, seconds, ...extra] = process.argv.slice(2);
  ensure(process.platform === 'linux' && extra.length === 0 && /^[a-f0-9]{64}$/u.test(expectedKeyId ?? ''), 'arguments_invalid');
  if (mode === 'public-key') {
    ensure(process.getuid() === 0 && maximum === undefined && seconds === undefined, 'root_action_required');
    const bytes = fs.readFileSync(0); ensure(bytes.length <= 16_384, 'public_spki_only');
    const result = publicKeyDetails(bytes.toString('utf8'), expectedKeyId);
    process.stdout.write(JSON.stringify({ key_id: result.id, modulus_bits: result.modulus_bits, spki_public_only: true }) + '\n');
    return;
  }
  privateOutputRequired();
  if (mode === 'seal') {
    ensure(process.getuid() === 0 && maximum === undefined && seconds === undefined, 'root_action_required');
    const bytes = fs.readFileSync(0); ensure(bytes.length <= MAX_PLAIN, 'custody_payload_too_large');
    const pem = fs.readFileSync(PUBLIC_PATH, 'utf8');
    const encrypted = sealCustody(JSON.parse(bytes.toString('utf8')), pem, expectedKeyId);
    bytes.fill(0); fs.writeSync(1, encrypted); return;
  }
  ensure(process.getuid() === 900 && ['generate', 'validate'].includes(mode), 'nodia_action_required');
  ensure(/^[1-9][0-9]{0,9}$/u.test(maximum ?? '') && /^[1-9][0-9]{0,3}$/u.test(seconds ?? ''), 'capture_limits_invalid');
  const expected = createBackupConfiguration(process.env, Number(maximum), Number(seconds));
  const pem = fs.readFileSync(PUBLIC_PATH, 'utf8');
  publicKeyDetails(pem, expectedKeyId);
  if (mode === 'generate') { process.stdout.write(JSON.stringify(expected) + '\n'); return; }
  const { loadNodiaAiBackupConfiguration } = await import(pathToFileURL(path.join(process.cwd(), 'scripts/nodia-ai-backups.mjs')).href);
  const actual = await loadNodiaAiBackupConfiguration(CONFIG_PATH);
  ensure(JSON.stringify(actual) === JSON.stringify(expected), 'saved_configuration_mismatch');
  process.stdout.write(JSON.stringify({ status: 'validated', key_id: expectedKeyId, database_tls_verified_configuration: true,
    capture_limits: { max_dump_bytes: expected.max_dump_bytes, timeout_seconds: expected.timeout_seconds },
    backup_requested: false, remote_calls_requested: false }) + '\n');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    const code = typeof error?.message === 'string' && /^nodia_backup_setup:[a-z0-9_]+$/u.test(error.message) ? error.message : 'nodia_backup_setup:action_failed';
    process.stderr.write(code + '\n'); process.exitCode = 1;
  });
}
