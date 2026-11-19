import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decryptSecret,
  encryptScopedSecret,
  encryptSecret,
} from '../../ai-provider/helpers/ai-key-crypto.helper.js';
import {
  decryptNewsCredential,
  encryptNewsCredential,
  personalNewsKey,
} from './personal-news-crypto.js';
import { DAILY_DEV, DEV_COMMUNITY } from './personal-news.types.js';

afterEach(() => vi.unstubAllEnvs());

describe('Personal News credential domain', () => {
  it('requires a dedicated configured key and binds ciphertext to owner and version', () => {
    vi.stubEnv('AI_SECRET_MASTER_KEY', '91'.repeat(32));
    vi.stubEnv('NEWS_PERSONAL_ENCRYPTION_KEY', undefined);
    expect(personalNewsKey()).toBeNull();
    vi.stubEnv('NEWS_PERSONAL_ENCRYPTION_KEY', 'not-a-key');
    expect(personalNewsKey()).toBeNull();
    vi.stubEnv('NEWS_PERSONAL_ENCRYPTION_KEY', '91'.repeat(32));
    const key = personalNewsKey()!;
    expect(key).toHaveLength(32);
    const secret = 'synthetic-dev-pat';
    const cipher = encryptNewsCredential(
      secret,
      key,
      DEV_COMMUNITY,
      '42',
      'generation-a',
    );
    expect(cipher).toMatch(/^scoped-v1:/u);
    expect(cipher).not.toContain(secret);
    expect(
      decryptNewsCredential(cipher, key, DEV_COMMUNITY, '42', 'generation-a'),
    ).toBe(secret);
    expect(() =>
      decryptNewsCredential(cipher, key, DEV_COMMUNITY, '43', 'generation-a'),
    ).toThrow();
    expect(() =>
      decryptNewsCredential(cipher, key, DEV_COMMUNITY, '42', 'generation-b'),
    ).toThrow();
    expect(() => decryptSecret(cipher)).toThrow();
    expect(() =>
      decryptNewsCredential(
        encryptSecret(secret),
        key,
        DEV_COMMUNITY,
        '42',
        'generation-a',
      ),
    ).toThrow();
  });

  it('preserves existing DEV ciphertext and prevents swapping credentials between providers', () => {
    const key = Buffer.from('91'.repeat(32), 'hex');
    const devKey = 'synthetic-dev-pat';
    const dailyKey = 'dda_synthetic';
    const legacyContext = Buffer.from(
      ['news', 'dev-community', '42', 'generation-a'].join('\0'),
    );
    const devCipher = encryptScopedSecret(devKey, key, legacyContext);
    const dailyCipher = encryptNewsCredential(
      dailyKey,
      key,
      DAILY_DEV,
      '42',
      'generation-a',
    );

    expect(
      decryptNewsCredential(
        devCipher,
        key,
        DEV_COMMUNITY,
        '42',
        'generation-a',
      ),
    ).toBe(devKey);
    expect(
      decryptNewsCredential(dailyCipher, key, DAILY_DEV, '42', 'generation-a'),
    ).toBe(dailyKey);
    expect(() =>
      decryptNewsCredential(devCipher, key, DAILY_DEV, '42', 'generation-a'),
    ).toThrow();
    expect(() =>
      decryptNewsCredential(
        dailyCipher,
        key,
        DEV_COMMUNITY,
        '42',
        'generation-a',
      ),
    ).toThrow();
  });

  it('preserves existing AI v2 and legacy AES-GCM envelopes', () => {
    vi.stubEnv('AI_SECRET_MASTER_KEY', '91'.repeat(32));
    vi.stubEnv('AI_LEGACY_MASTER_KEY', 'synthetic-legacy');
    const plain = 'test-compatibility-secret';
    expect(
      decryptSecret(
        'v2:030303030303030303030303:5e12f4a533c5c837f4af2a98efed14da:bea4395e0154a1926740778bcc87644d76ab014faed3e7bcdd',
      ),
    ).toBe(plain);
    expect(
      decryptSecret(
        '030303030303030303030303:7a247aac9133ea24f2ca50e76ec41b40:a6f94608b9a269e2d6b692b262e863afe5a7022ace1cb54187',
      ),
    ).toBe(plain);
    const fresh = encryptSecret(plain);
    expect(fresh).toMatch(/^v2:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/u);
    expect(decryptSecret(fresh)).toBe(plain);
  });
});
