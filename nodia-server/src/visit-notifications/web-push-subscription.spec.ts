import { createECDH, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptScopedSecret } from '../ai-provider/helpers/ai-key-crypto.helper.js';
import { readWebPushRegistrationConfig } from './web-push-config.js';
import {
  prepareWebPushSubscription,
  validateWebPushEndpoint,
} from './web-push-subscription.js';

const publicKey = () =>
  createECDH('prime256v1').generateKeys().toString('base64url');
const configuration = () => ({
  WEB_PUSH_PUBLIC_KEY: publicKey(),
  WEB_PUSH_SUBSCRIPTION_KEY: randomBytes(32).toString('hex'),
  WEB_PUSH_ENDPOINT_HOSTS: 'fixed.push.test,*.regional.push.test',
});

describe('Web Push registration', () => {
  it.each([
    { WEB_PUSH_PUBLIC_KEY: 'wrong' },
    { WEB_PUSH_SUBSCRIPTION_KEY: undefined },
    { WEB_PUSH_ENDPOINT_HOSTS: '127.0.0.1' },
  ])('keeps incomplete or invalid configuration unavailable', (invalid) => {
    expect(
      readWebPushRegistrationConfig({ ...configuration(), ...invalid }),
    ).toBeNull();
  });

  it.each([
    'http://fixed.push.test/sub',
    'https://fixed.push.test:8000/sub',
    'https://fixed.push.test@foreign.test/sub',
    'https://foreign.test@fixed.push.test/sub',
    'https://fixed.push.test/sub#fragment',
    'https://regional.push.test/sub',
    'https://child.regional.push.test.foreign.test/sub',
  ])('rejects an unapproved endpoint: %s', (endpoint) => {
    const config = readWebPushRegistrationConfig(configuration())!;
    expect(() =>
      validateWebPushEndpoint(endpoint, config.endpointHosts),
    ).toThrow('visit_notifications:invalid_endpoint');
  });

  it('accepts exact and scoped hosts and encrypts keys for the exact account installation', () => {
    const config = readWebPushRegistrationConfig(configuration())!;
    const endpoint = 'https://child.regional.push.test/sub';
    expect(
      validateWebPushEndpoint(
        'https://fixed.push.test/sub',
        config.endpointHosts,
      ).hostname,
    ).toBe('fixed.push.test');
    const subscription = {
      endpoint,
      keys: {
        p256dh: publicKey(),
        auth: randomBytes(16).toString('base64url'),
      },
    };
    const owner = { userId: '1', installationId: 'example' };
    const prepared = prepareWebPushSubscription(
      subscription,
      config,
      owner,
      new Date(),
    );
    expect(prepared.subscription_ciphertext).not.toContain(endpoint);
    expect(
      JSON.parse(
        decryptScopedSecret(
          prepared.subscription_ciphertext,
          config.encryptionKey,
          Buffer.from('nodia-web-push/1:1:example'),
        ),
      ),
    ).toEqual(subscription);
    expect(() =>
      decryptScopedSecret(
        prepared.subscription_ciphertext,
        config.encryptionKey,
        Buffer.from('nodia-web-push/1:2:example'),
      ),
    ).toThrow();
    expect(() =>
      prepareWebPushSubscription(
        { ...subscription, keys: { ...subscription.keys, auth: 'short' } },
        config,
        owner,
        new Date(),
      ),
    ).toThrow('visit_notifications:invalid_subscription_keys');
  });
});
