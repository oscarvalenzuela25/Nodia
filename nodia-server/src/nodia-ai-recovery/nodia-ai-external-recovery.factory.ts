import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { lstatSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { Readable } from 'node:stream';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { UpdateNodiaAiExternalStateUseCase, type ExternalStateTransport } from './use-case/update-nodia-ai-external-state.use-case.js';

export interface NodiaAiExternalRecoveryConfig {
  schema_version: 1;
  deployment_id: string;
  era_id: string;
  endpoint: string;
  bucket: string;
  access_key_id: string;
  secret_access_key: string;
  journal_encryption_key: string;
}
const fail = (code: string): never => { throw Error(`nodia_ai:recovery_${code}`); };
const status = (error: unknown): number | undefined => (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;

/** Operator secret file only; no application .env, credentials or config are logged. */
export function loadNodiaAiExternalRecoveryConfig(file: string): NodiaAiExternalRecoveryConfig {
  if (!isAbsolute(file)) return fail('configuration_invalid');
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16_384 ||
    (process.platform !== 'win32' && ((info.mode & 0o077) !== 0 || ![0, process.getuid?.()].includes(info.uid)))) return fail('configuration_invalid');
  let value: unknown;
  try { value = JSON.parse(readFileSync(file, 'utf8')); } catch { return fail('configuration_invalid'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('configuration_invalid');
  const input = value as Record<string, unknown>;
  const fields = ['schema_version', 'deployment_id', 'era_id', 'endpoint', 'bucket', 'access_key_id', 'secret_access_key', 'journal_encryption_key'];
  if (Object.keys(input).length !== fields.length || fields.some(field => !Object.hasOwn(input, field)) || input.schema_version !== 1 ||
    typeof input.deployment_id !== 'string' || !/^[a-z0-9_-]{1,48}$/u.test(input.deployment_id) ||
    typeof input.era_id !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u.test(input.era_id) ||
    ['endpoint', 'bucket', 'access_key_id', 'secret_access_key'].some(field => typeof input[field] !== 'string' || !input[field] || (input[field] as string).length > 2048)) return fail('configuration_invalid');
  if (typeof input.journal_encryption_key !== 'string' || Buffer.from(input.journal_encryption_key, 'base64').length !== 32 ||
    Buffer.from(input.journal_encryption_key, 'base64').toString('base64') !== input.journal_encryption_key) return fail('configuration_invalid');
  let endpoint: URL;
  try { endpoint = new URL(input.endpoint as string); } catch { return fail('configuration_invalid'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') return fail('configuration_invalid');
  return input as unknown as NodiaAiExternalRecoveryConfig;
}

export function createNodiaAiExternalRecovery(config: NodiaAiExternalRecoveryConfig) {
  const prefix = `nodia-ai-recovery/${config.deployment_id}`;
  const client = new S3Client({ region: 'auto', endpoint: config.endpoint,
    credentials: { accessKeyId: config.access_key_id, secretAccessKey: config.secret_access_key },
    maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: { connectionTimeout: 1000, requestTimeout: 4500 } });
  const key = `${prefix}/state.bin`;
  const encryptionKey = Buffer.from(config.journal_encryption_key, 'base64');
  const aad = Buffer.from(`nodia-ai-recovery/1:${config.era_id}:${prefix}`);
  const transport: ExternalStateTransport = {
    async read(signal) {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: signal });
        if (!(response.Body instanceof Readable) || !response.ETag || (response.ContentLength !== undefined && response.ContentLength > 8 * 1024 * 1024 + 28)) {
          if (response.Body instanceof Readable) response.Body.destroy();
          return fail('state_invalid');
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const body = response.Body;
        try {
          for await (const part of body as AsyncIterable<Uint8Array>) {
            signal.throwIfAborted();
            size += part.byteLength;
            if (size > 8 * 1024 * 1024 + 28) return fail('state_capacity');
            chunks.push(Buffer.from(part));
          }
        } finally { body.destroy(); }
        const encrypted = Buffer.concat(chunks);
        if (encrypted.length < 29) return fail('state_invalid');
        const decipher = createDecipheriv('aes-256-gcm', encryptionKey, encrypted.subarray(0, 12));
        decipher.setAAD(aad); decipher.setAuthTag(encrypted.subarray(-16));
        const bytes = Buffer.concat([decipher.update(encrypted.subarray(12, -16)), decipher.final()]);
        return { bytes, etag: response.ETag };
      } catch (error) {
        if (status(error) === 404) return null;
        throw Error('nodia_ai:recovery_read_unavailable');
      }
    },
    async compareAndSwap(bytes, previousETag, signal) {
      try {
        const nonce = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce);
        cipher.setAAD(aad);
        const body = Buffer.concat([nonce, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
        await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key,
          Body: body, ContentLength: body.length, ContentType: 'application/octet-stream',
          ...(previousETag === null ? { IfNoneMatch: '*' } : { IfMatch: previousETag }) }), { abortSignal: signal });
        return true;
      } catch (error) {
        if (status(error) === 412) return false;
        // Do not replay an uncertain PUT. A fresh identical read can attest its commit.
        try {
          const observed = await transport.read(signal);
          if (observed?.bytes.equals(bytes)) return true;
        } catch { /* Pending intent remains external; the next operation reconciles it. */ }
        throw Error('nodia_ai:recovery_write_unknown');
      }
    },
  };
  return { store: new UpdateNodiaAiExternalStateUseCase(transport, config.era_id, prefix, () => new Date(), () => client.destroy()), client, prefix };
}
