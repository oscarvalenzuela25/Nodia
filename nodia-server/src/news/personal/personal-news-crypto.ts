import { createHmac } from 'node:crypto';
import {
  decryptScopedSecret,
  encryptScopedSecret,
} from '../../ai-provider/helpers/ai-key-crypto.helper.js';
import type { PersonalNewsProvider } from './personal-news.types.js';

export function personalNewsKey(): Buffer | null {
  const raw = process.env.NEWS_PERSONAL_ENCRYPTION_KEY;
  if (!raw || !/^[0-9a-f]{64}$/iu.test(raw)) return null;
  return createHmac('sha256', Buffer.from(raw, 'hex'))
    .update('nodia-news-personal-aes-gcm-v1')
    .digest();
}

function credentialContext(
  provider: PersonalNewsProvider,
  owner: string,
  version: string,
): Buffer {
  return Buffer.from(`news\0${provider}\0${owner}\0${version}`, 'utf8');
}

export function encryptNewsCredential(
  secret: string,
  key: Buffer,
  provider: PersonalNewsProvider,
  owner: string,
  version: string,
): string {
  return encryptScopedSecret(
    secret,
    key,
    credentialContext(provider, owner, version),
  );
}

export function decryptNewsCredential(
  ciphertext: string,
  key: Buffer,
  provider: PersonalNewsProvider,
  owner: string,
  version: string,
): string {
  return decryptScopedSecret(
    ciphertext,
    key,
    credentialContext(provider, owner, version),
  );
}
