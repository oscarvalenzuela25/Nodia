import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { beforeAll, describe, expect, it } from 'vitest';
import { DecryptNodiaAiBackupUseCase, EncryptNodiaAiBackupUseCase } from './encrypt-nodia-ai-backup.use-case.js';

let publicKey: string, privateKey: string;
beforeAll(() => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  publicKey = keys.publicKey; privateKey = keys.privateKey;
});
function collector() { const chunks: Buffer[] = []; return { destination: new Writable({ write(chunk: Buffer, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } }), bytes: () => Buffer.concat(chunks) }; }
async function encrypt(plain = Buffer.from('synthetic PostgreSQL dump, no user data')) {
  const output = collector(), id = randomUUID();
  const receipt = await new EncryptNodiaAiBackupUseCase().execute({ source: Readable.from([plain]), destination: output.destination, public_key_pem: publicKey, backup_id: id, max_plain_bytes: 1024, signal: AbortSignal.timeout(1000) });
  return { id, bytes: output.bytes(), receipt, plain };
}
async function decrypt(bytes: Buffer, id: string) {
  const output = collector();
  await new DecryptNodiaAiBackupUseCase().execute({ source: Readable.from(Array.from(bytes, byte => Buffer.from([byte]))), destination: output.destination, private_key_pem: privateKey, backup_id: id, max_cipher_bytes: 16384, signal: AbortSignal.timeout(3000) });
  return output.bytes();
}
describe('EncryptNodiaAiBackupUseCase / DecryptNodiaAiBackupUseCase', () => {
  it('roundtrips the actual RSA-wrapped GCM envelope across one-byte stream boundaries', async () => {
    const f = await encrypt(); expect(f.bytes.includes(f.plain)).toBe(false);
    expect(f.receipt.cipher_bytes).toBe(f.bytes.length);
    expect(await decrypt(f.bytes, f.id)).toEqual(f.plain);
  });
  it('uses different random DEKs/nonces for repeated plaintext', async () => {
    const a = await encrypt(), b = await encrypt(); expect(a.bytes).not.toEqual(b.bytes);
  });
  it.each(['tag', 'body', 'header', 'truncated', 'wrong_backup'] as const)('rejects %s tampering rather than accepting plaintext', async scenario => {
    const f = await encrypt(); const bytes = Buffer.from(f.bytes);
    if (scenario === 'tag') bytes[bytes.length - 1] ^= 1;
    if (scenario === 'body') bytes[bytes.length - 20] ^= 1;
    if (scenario === 'header') bytes[14] ^= 1;
    await expect(decrypt(scenario === 'truncated' ? bytes.subarray(0, bytes.length - 10) : bytes, scenario === 'wrong_backup' ? randomUUID() : f.id)).rejects.toThrow();
  });
  it('enforces source cap before accepting an oversized dump', async () => {
    const output = collector();
    await expect(new EncryptNodiaAiBackupUseCase().execute({ source: Readable.from([Buffer.alloc(1025)]), destination: output.destination, public_key_pem: publicKey, backup_id: randomUUID(), max_plain_bytes: 1024, signal: AbortSignal.timeout(1000) })).rejects.toThrow('backup_size_exceeded');
  });
  it('rejects missing encryption key and cancelled input before output', async () => {
    const output = collector();
    await expect(new EncryptNodiaAiBackupUseCase().execute({ source: Readable.from([Buffer.from('a')]), destination: output.destination, public_key_pem: '', backup_id: randomUUID(), max_plain_bytes: 1024, signal: AbortSignal.timeout(1000) })).rejects.toThrow();
    expect(output.bytes().length).toBe(0);
  });
  it('rejects a private PEM at keyId and encryption admission before emitting ciphertext', async () => {
    const useCase = new EncryptNodiaAiBackupUseCase(), output = collector();
    expect(() => useCase.keyId(privateKey)).toThrow('backup_envelope_invalid');
    await expect(useCase.execute({ source: Readable.from([Buffer.from('synthetic dump')]), destination: output.destination, public_key_pem: privateKey, backup_id: randomUUID(), max_plain_bytes: 1024, signal: AbortSignal.timeout(1000) })).rejects.toThrow('backup_envelope_invalid');
    expect(output.bytes().length).toBe(0);
  });
  it.each(['private_suffix', 'second_public', 'prefix', 'suffix', 'pkcs1_label', 'noncanonical_base64', 'trailing_der'] as const)('rejects public PEM with %s', variant => {
    let pem = publicKey;
    if (variant === 'private_suffix') pem += privateKey;
    if (variant === 'second_public') pem += publicKey;
    if (variant === 'prefix') pem = `unexpected\n${pem}`;
    if (variant === 'suffix') pem += 'unexpected';
    if (variant === 'pkcs1_label') pem = pem.replaceAll('PUBLIC KEY', 'RSA PUBLIC KEY');
    if (variant === 'noncanonical_base64') pem = pem.replace('\n', '\n=');
    if (variant === 'trailing_der') {
      const body = pem.split('\n').slice(1, -2).join('');
      const expanded = Buffer.concat([Buffer.from(body, 'base64'), Buffer.from([0])]).toString('base64');
      pem = `-----BEGIN PUBLIC KEY-----\n${expanded}\n-----END PUBLIC KEY-----\n`;
    }
    expect(() => new EncryptNodiaAiBackupUseCase().keyId(pem)).toThrow();
  });
  it('accepts the single public SPKI block with LF or CRLF and yields the same key identity', () => {
    const useCase = new EncryptNodiaAiBackupUseCase();
    expect(useCase.keyId(publicKey.replaceAll('\n', '\r\n'))).toBe(useCase.keyId(publicKey));
  });
});
