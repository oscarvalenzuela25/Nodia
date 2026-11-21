import { createHash, ECDH } from 'node:crypto';
import { isIP } from 'node:net';

export interface WebPushRegistrationConfig {
  publicKey: string;
  keyId: string;
  encryptionKey: Buffer;
  endpointHosts: ReadonlySet<string>;
}

export function decodeWebPushKey(value: unknown, size: number): Buffer | null {
  if (
    typeof value !== 'string' ||
    value.length !== Math.ceil((size * 4) / 3) ||
    !/^[\w-]+$/.test(value)
  )
    return null;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length === size && bytes.toString('base64url') === value
    ? bytes
    : null;
}

export function readWebPushPublicKey(value: unknown): Buffer | null {
  const bytes = decodeWebPushKey(value, 65);
  if (!bytes || bytes[0] !== 4) return null;
  try {
    ECDH.convertKey(bytes, 'prime256v1');
    return bytes;
  } catch {
    return null;
  }
}

function isEndpointHost(value: string): boolean {
  const host = value.startsWith('*.') ? value.slice(2) : value;
  return (
    !isIP(host) &&
    host.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
      host,
    )
  );
}

export function readWebPushRegistrationConfig(
  env: NodeJS.ProcessEnv = process.env,
): WebPushRegistrationConfig | null {
  const publicKey = env.WEB_PUSH_PUBLIC_KEY?.trim();
  const bytes = readWebPushPublicKey(publicKey);
  const secret = env.WEB_PUSH_SUBSCRIPTION_KEY?.trim();
  const hosts = env.WEB_PUSH_ENDPOINT_HOSTS?.split(',').map((host) =>
    host.trim().toLowerCase(),
  );
  if (
    !publicKey ||
    !bytes ||
    !secret ||
    !/^[a-f0-9]{64}$/i.test(secret) ||
    !hosts?.length ||
    hosts.length > 30 ||
    !hosts.every(isEndpointHost)
  )
    return null;
  return {
    publicKey,
    keyId: createHash('sha256').update(bytes).digest('hex'),
    encryptionKey: Buffer.from(secret, 'hex'),
    endpointHosts: new Set(hosts),
  };
}

export function publicWebPushConfig() {
  const config = readWebPushRegistrationConfig();
  return {
    enabled: config !== null,
    public_key: config?.publicKey ?? null,
    key_id: config?.keyId ?? null,
  };
}
