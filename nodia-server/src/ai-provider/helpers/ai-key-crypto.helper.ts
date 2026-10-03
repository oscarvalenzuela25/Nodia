import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
function getMasterKey(): Buffer {
  const rawKey = process.env.AI_SECRET_MASTER_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    throw new Error(
      'AI_SECRET_MASTER_KEY must contain 64 hexadecimal characters',
    );
  }
  return Buffer.from(rawKey, 'hex');
}

function getLegacyKey(): Buffer {
  const rawKey = process.env.AI_LEGACY_MASTER_KEY || '';
  if (!rawKey) {
    throw new Error('AI_LEGACY_MASTER_KEY is required to migrate old AI keys');
  }
  return Buffer.from(rawKey.padEnd(32, '0').slice(0, 32), 'utf8');
}

export function generateFingerprint(secret: string): string {
  const fingerprintKey = createHmac('sha256', getMasterKey())
    .update('nodia-ai-fingerprint-v2')
    .digest();
  return createHmac('sha256', fingerprintKey).update(secret).digest('hex');
}

export function generateDisplayHint(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return '****';
  return `...${trimmed.slice(-4)}`;
}

export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `v2:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(':');
  const isCurrent = parts[0] === 'v2' && parts.length === 4;
  if (!isCurrent && parts.length !== 3) {
    throw new Error('Unsupported AI key ciphertext format');
  }
  const [ivHex, authTagHex, encryptedHex] = isCurrent ? parts.slice(1) : parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  if (iv.length !== 12 || authTag.length !== 16 || !encryptedHex) {
    throw new Error('Invalid AI key ciphertext');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    isCurrent ? getMasterKey() : getLegacyKey(),
    iv,
  );
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
