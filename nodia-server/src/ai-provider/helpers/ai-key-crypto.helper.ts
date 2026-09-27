import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY = 'nodia-master-secret-key-32-bytes!!';

function getMasterKey(): Buffer {
  const rawKey = process.env.AI_SECRET_MASTER_KEY || DEFAULT_KEY;
  return Buffer.from(rawKey.padEnd(32, '0').slice(0, 32), 'utf8');
}

export function generateFingerprint(secret: string): string {
  return createHmac('sha256', 'nodia-ai-fingerprint-salt')
    .update(secret)
    .digest('hex');
}

export function generateDisplayHint(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return trimmed;
  return `...${trimmed.slice(-4)}`;
}

export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext;
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getMasterKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
