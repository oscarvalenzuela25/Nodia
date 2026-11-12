import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { createBackupConfiguration, openCustody, publicKeyDetails, sealCustody, validateCustodyPayload } from '../configure-production-backups.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const keyId = sha(createPublicKey(keys.publicKey).export({ type: 'spki', format: 'der' }));
const names = ['runtime.env', 'redis.env', 'recovery.json'];
const payload = () => ({ schema_version: 1, purpose: 'nodia_configuration_custody', created_at_utc: '2026-11-11T20:00:00.000Z',
  restore_policy: 'operator_review_only', files: names.map((name, index) => {
    const bytes = Buffer.from(`synthetic-private-${index}\n$literal;|=\r\n`);
    return { name, encoding: 'base64', sha256: sha(bytes), content: bytes.toString('base64') };
  }) });
const environment = () => ({ PGSSLMODE: 'verify-full', NODIA_AI_RECOVERY_CONFIG_FILE: '/var/lib/nodia/config/recovery.json',
  POSTGRES_HOST: 'database.example.invalid', POSTGRES_PORT: '29102', POSTGRES_DB: 'synthetic_db',
  POSTGRES_USER: 'synthetic_user', POSTGRES_PASSWORD: 'synthetic-$;|password' });

test('configuration uses explicit normal environment and verified TLS without public side effects', () => {
  const result = createBackupConfiguration(environment(), 268435456, 300);
  assert.equal(result.database.password, environment().POSTGRES_PASSWORD);
  assert.deepEqual(result.database.tls, { mode: 'verify-full', root_cert_file: '/etc/ssl/certs/ca-certificates.crt' });
  assert.equal(result.pg_dump_binary, '/usr/lib/postgresql/16/bin/pg_dump');
  assert.equal(result.recovery_config, '/var/lib/nodia/config/recovery.json');
});

test('missing credentials, conninfo, socket/list host and TLS weakening are rejected', () => {
  for (const patch of [{ POSTGRES_PASSWORD: '' }, { POSTGRES_DB: 'sslmode=disable' },
    { POSTGRES_DB: 'postgresql://host/database' }, { POSTGRES_HOST: '/tmp/socket' },
    { POSTGRES_HOST: 'a,b' }, { PGSSLMODE: 'require' }, { NODIA_AI_RECOVERY_CONFIG_FILE: '/other/config' }])
    assert.throws(() => createBackupConfiguration({ ...environment(), ...patch }, 268435456, 300));
});

test('only single-block public SPKI is accepted, never private key material', () => {
  assert.equal(publicKeyDetails(keys.publicKey, keyId).id, keyId);
  for (const pem of [keys.privateKey, keys.publicKey + keys.privateKey, keys.publicKey + keys.publicKey,
    keys.publicKey.replace('PUBLIC KEY', 'CERTIFICATE')]) assert.throws(() => publicKeyDetails(pem, keyId));
  assert.throws(() => publicKeyDetails(keys.publicKey, 'a'.repeat(64)));
});

test('custody envelope restores exact bytes with synthetic off-host private key', () => {
  const original = payload();
  const encrypted = sealCustody(original, keys.publicKey, keyId);
  assert.ok(encrypted.subarray(0, 8).equals(Buffer.from('NODCFG01')));
  assert.equal(encrypted.includes(Buffer.from('synthetic-private')), false);
  assert.deepEqual(openCustody(encrypted, keys.privateKey, sha(encrypted)), original);
  const repeated = sealCustody(original, keys.publicKey, keyId);
  assert.notDeepEqual(repeated, encrypted);
});

test('modified ciphertext/header and substituted valid envelope cannot bypass pinned digest or GCM', () => {
  const encrypted = sealCustody(payload(), keys.publicKey, keyId);
  for (const offset of [15, encrypted.length - 20, encrypted.length - 1]) {
    const changed = Buffer.from(encrypted); changed[offset] ^= 1;
    assert.throws(() => openCustody(changed, keys.privateKey, sha(encrypted)));
    assert.throws(() => openCustody(changed, keys.privateKey, sha(changed)));
  }
  const replacement = sealCustody(payload(), keys.publicKey, keyId);
  assert.throws(() => openCustody(replacement, keys.privateKey, sha(encrypted)));
});

test('custody payload requires all three exact original files and matching byte hashes', () => {
  for (const mutate of [value => value.files.pop(), value => value.files[0].name = 'private-key.pem',
    value => value.files[0].sha256 = 'a'.repeat(64), value => value.extra = 'secret', value => value.purpose = 'postgres_dump']) {
    const value = payload(); mutate(value);
    assert.throws(() => validateCustodyPayload(value));
  }
});
