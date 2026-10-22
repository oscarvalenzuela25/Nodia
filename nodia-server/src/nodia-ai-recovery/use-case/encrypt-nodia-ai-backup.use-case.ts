import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, privateDecrypt, publicEncrypt, randomBytes, constants } from 'node:crypto';
import { Readable, Transform, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Injectable } from '@nestjs/common';
import type { NodiaAiBackupReceipt } from '../types/nodia-ai-backup.types.js';

const magic = Buffer.from('NODAI38B');
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u;
const fail = (): never => { throw Error('nodia_ai:backup_envelope_invalid'); };
const publicDetails = (pem: string) => {
  // createPublicKey(PEM) also accepts private keys. The VM boundary explicitly
  // admits one SPKI PUBLIC KEY block only, without surrounding text/extra blocks.
  if (typeof pem !== 'string' || pem.length > 16_384) return fail();
  const match = /^-----BEGIN PUBLIC KEY-----\r?\n((?:[A-Za-z0-9+/=]+\r?\n)+)-----END PUBLIC KEY-----\r?\n?$/u.exec(pem);
  if (!match) return fail();
  const body = match[1].replace(/\r?\n/gu, '');
  if (!body || /\r|\n/u.test(body)) return fail();
  const der = Buffer.from(body, 'base64');
  if (der.toString('base64') !== body) return fail();
  const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
  if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 3072) return fail();
  const canonical = key.export({ format: 'der', type: 'spki' });
  if (!canonical.equals(der)) return fail();
  return { key, id: createHash('sha256').update(canonical).digest('hex') };
};

/** The VM receives only an operator RSA public key. DEK/nonce are unique per dump.
 * Output contains ciphertext only; no source bytes are persisted by this use case. */
@Injectable()
export class EncryptNodiaAiBackupUseCase {
  keyId(publicKeyPem: string): string { return publicDetails(publicKeyPem).id; }

  async execute(input: { source: Readable; destination: Writable; public_key_pem: string; backup_id: string; max_plain_bytes: number; signal: AbortSignal }): Promise<NodiaAiBackupReceipt> {
    if (!uuid.test(input.backup_id) || !Number.isSafeInteger(input.max_plain_bytes) || input.max_plain_bytes < 1) return fail();
    input.signal.throwIfAborted();
    const { key, id } = publicDetails(input.public_key_pem);
    const dek = randomBytes(32), nonce = randomBytes(12);
    const header = Buffer.from(JSON.stringify({ schema_version: 1, backup_id: input.backup_id, algorithm: 'AES-256-GCM', wrapping: 'RSA-OAEP-SHA256', encryption_key_id: id, wrapped_key: publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, dek).toString('base64'), nonce: nonce.toString('base64') }));
    if (header.length > 8192) return fail();
    const length = Buffer.alloc(4); length.writeUInt32BE(header.length);
    const prefix = Buffer.concat([magic, length, header]);
    const cipher = createCipheriv('aes-256-gcm', dek, nonce); cipher.setAAD(prefix);
    let plainBytes = 0, cipherBytes = 0;
    const hash = createHash('sha256');
    const digest = new Transform({ transform(chunk: Buffer, _encoding, callback) { cipherBytes += chunk.length; hash.update(chunk); callback(null, chunk); } });
    async function* encrypted() {
      yield prefix;
      for await (const raw of input.source) {
        input.signal.throwIfAborted();
        if (!Buffer.isBuffer(raw) && !(raw instanceof Uint8Array)) return fail();
        const chunk = Buffer.from(raw);
        plainBytes += chunk.length;
        if (plainBytes > input.max_plain_bytes) throw Error('nodia_ai:backup_size_exceeded');
        yield cipher.update(chunk);
      }
      yield cipher.final();
      yield cipher.getAuthTag();
    }
    try {
      await pipeline(Readable.from(encrypted(), { objectMode: false }), digest, input.destination, { signal: input.signal });
      if (plainBytes === 0) throw Error('nodia_ai:backup_empty');
      return { cipher_bytes: cipherBytes, cipher_sha256: hash.digest('hex') };
    } finally { dek.fill(0); input.source.destroy(); }
  }
}

/** Operator-side decrypt into a private quarantine spool only. A failed final GCM
 * tag invalidates every output byte; callers must delete that spool, never publish it. */
@Injectable()
export class DecryptNodiaAiBackupUseCase {
  async execute(input: { source: Readable; destination: Writable; private_key_pem: string; backup_id: string; max_cipher_bytes: number; signal: AbortSignal }): Promise<{ plain_bytes: number }> {
    if (!uuid.test(input.backup_id) || !Number.isSafeInteger(input.max_cipher_bytes) || input.max_cipher_bytes < 1) return fail();
    const privateKey = createPrivateKey(input.private_key_pem);
    const expected = publicDetails(createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString()).id;
    let buffered = Buffer.alloc(0), cipherBytes = 0, plainBytes = 0;
    let decipher: ReturnType<typeof createDecipheriv> | null = null;
    let dek: Buffer | null = null;
    const decrypt = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        try {
          if (!Buffer.isBuffer(chunk)) return fail();
          cipherBytes += chunk.length;
          if (cipherBytes > input.max_cipher_bytes) throw Error('nodia_ai:backup_size_exceeded');
          buffered = Buffer.concat([buffered, chunk]);
          if (!decipher) {
            if (buffered.length < 12) { callback(); return; }
            if (!buffered.subarray(0, 8).equals(magic)) return fail();
            const size = buffered.readUInt32BE(8);
            if (size < 1 || size > 8192) return fail();
            if (buffered.length < 12 + size) { callback(); return; }
            const prefix = buffered.subarray(0, 12 + size);
            const header = JSON.parse(buffered.subarray(12, 12 + size).toString('utf8')) as Record<string, unknown>;
            const fields = ['schema_version', 'backup_id', 'algorithm', 'wrapping', 'encryption_key_id', 'wrapped_key', 'nonce'];
            if (!header || Object.keys(header).length !== fields.length || fields.some(field => !Object.hasOwn(header, field)) ||
              header.schema_version !== 1 || header.backup_id !== input.backup_id || header.algorithm !== 'AES-256-GCM' || header.wrapping !== 'RSA-OAEP-SHA256' || header.encryption_key_id !== expected ||
              typeof header.wrapped_key !== 'string' || typeof header.nonce !== 'string') return fail();
            const wrapped = Buffer.from(header.wrapped_key, 'base64'), nonce = Buffer.from(header.nonce, 'base64');
            if (wrapped.toString('base64') !== header.wrapped_key || nonce.toString('base64') !== header.nonce || nonce.length !== 12) return fail();
            dek = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, wrapped);
            if (dek.length !== 32) return fail();
            const actual = createDecipheriv('aes-256-gcm', dek, nonce); actual.setAAD(prefix);
            decipher = actual;
            buffered = buffered.subarray(12 + size);
          }
          if (buffered.length > 16) {
            const plain = decipher.update(buffered.subarray(0, buffered.length - 16));
            plainBytes += plain.length;
            this.push(plain);
            buffered = Buffer.from(buffered.subarray(-16));
          }
          callback();
        } catch (error) { callback(error instanceof Error ? error : Error('nodia_ai:backup_decrypt_failed')); }
      },
      flush(callback) {
        try {
          if (!decipher || buffered.length !== 16) return fail();
          // The algorithm was checked before creating the GCM decipher.
          (decipher as ReturnType<typeof createDecipheriv> & { setAuthTag(tag: Buffer): void }).setAuthTag(buffered);
          const tail = decipher.final(); plainBytes += tail.length; this.push(tail);
          callback();
        } catch (error) { callback(error instanceof Error ? error : Error('nodia_ai:backup_decrypt_failed')); }
      },
    });
    try {
      await pipeline(input.source, decrypt, input.destination, { signal: input.signal });
      if (plainBytes === 0) return fail();
      return { plain_bytes: plainBytes };
    } finally { if (dek) (dek as Buffer).fill(0); }
  }
}
