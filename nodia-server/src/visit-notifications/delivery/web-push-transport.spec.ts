import {
  createDecipheriv,
  createECDH,
  createPublicKey,
  hkdfSync,
  verify,
} from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import type { PeerCertificate } from 'node:tls';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readWebPushRegistrationConfig } from '../web-push-config.js';
import { prepareWebPushSubscription } from '../web-push-subscription.js';
import { WebPushTransport, type WebPushRequest } from './web-push-transport.js';

const network = vi.hoisted(() => ({
  resolve4: vi.fn<(host: string) => Promise<string[]>>(),
  resolve6: vi.fn<(host: string) => Promise<string[]>>(),
  cancel: vi.fn<() => void>(),
  request:
    vi.fn<
      (
        options: RequestOptions,
        callback: (response: IncomingMessage) => void,
      ) => EventEmitter
    >(),
}));
vi.mock('node:dns/promises', () => ({
  Resolver: class {
    resolve4 = network.resolve4;
    resolve6 = network.resolve6;
    cancel = network.cancel;
  },
}));
vi.mock('node:https', () => ({ request: network.request }));

const now = new Date('2026-11-20T15:00:00.000Z');
const identity = createECDH('prime256v1');
identity.setPrivateKey(Buffer.alloc(32, 7));
const browser = createECDH('prime256v1');
browser.setPrivateKey(Buffer.alloc(32, 9));
const auth = Buffer.alloc(16, 11);
const owner = {
  userId: '1',
  installationId: 'ddd2a37b-c094-4cb7-8bb4-91fde0e27f09',
};
const endpoint = 'https://push.example.com/delivery/opaque-secret?q=one';
const businessId = '0d55feba-5103-4300-9c20-7c88cf85f71a';
const notificationId = '94172';

function delivery(): WebPushRequest {
  const config = readWebPushRegistrationConfig()!;
  const subscription = prepareWebPushSubscription(
    {
      endpoint,
      keys: {
        p256dh: browser.getPublicKey().toString('base64url'),
        auth: auth.toString('base64url'),
      },
    },
    config,
    owner,
    now,
  );
  return {
    ...owner,
    keyId: config.keyId,
    ciphertext: subscription.subscription_ciphertext,
    notificationId,
    businessId,
    expiresAt: new Date(now.getTime() + 60_000),
  };
}

function response(status?: number, retryAfter?: string) {
  const destroyResponse = vi.fn();
  const request = Object.assign(new EventEmitter(), {
    end: vi.fn<(body: Buffer) => void>(),
    destroy: vi.fn(),
  });
  network.request.mockImplementation((_options, callback) => {
    if (status !== undefined) {
      request.end.mockImplementation(() =>
        queueMicrotask(() =>
          callback({
            statusCode: status,
            headers: {
              'retry-after': retryAfter,
              location: 'https://redirected.example.org/',
            },
            destroy: destroyResponse,
          } as unknown as IncomingMessage),
        ),
      );
    }
    return request;
  });
  return { request, destroyResponse };
}

function decryptBrowserPayload(body: Buffer) {
  const salt = body.subarray(0, 16);
  const keyLength = body[20];
  const sender = body.subarray(21, 21 + keyLength);
  const record = body.subarray(21 + keyLength);
  const shared = browser.computeSecret(sender);
  const browserInfo = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    browser.getPublicKey(),
    sender,
  ]);
  const ikm = hkdfSync('sha256', shared, auth, browserInfo, 32);
  const key = Buffer.from(
    hkdfSync('sha256', ikm, salt, 'Content-Encoding: aes128gcm\0', 16),
  );
  const nonce = Buffer.from(
    hkdfSync('sha256', ikm, salt, 'Content-Encoding: nonce\0', 12),
  );
  const cipher = createDecipheriv('aes-128-gcm', key, nonce);
  cipher.setAuthTag(record.subarray(-16));
  const decrypted = Buffer.concat([
    cipher.update(record.subarray(0, -16)),
    cipher.final(),
  ]);
  expect(decrypted.at(-1)).toBe(2);
  return JSON.parse(decrypted.subarray(0, -1).toString('utf8'));
}

describe('Web Push protocol and pinned egress', () => {
  const transport = new WebPushTransport();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'performance'],
    });
    vi.setSystemTime(now);
    vi.stubEnv(
      'WEB_PUSH_PUBLIC_KEY',
      identity.getPublicKey().toString('base64url'),
    );
    vi.stubEnv(
      'WEB_PUSH_PRIVATE_KEY',
      identity.getPrivateKey().toString('base64url'),
    );
    vi.stubEnv('WEB_PUSH_SUBJECT', 'mailto:push@nodia.example');
    vi.stubEnv('WEB_PUSH_SUBSCRIPTION_KEY', 'aa'.repeat(32));
    vi.stubEnv('WEB_PUSH_ENDPOINT_HOSTS', 'push.example.com');
    network.resolve4.mockResolvedValue(['8.8.8.8']);
    network.resolve6.mockResolvedValue(['2606:4700:4700::1111']);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('encrypts the minimal payload, signs for the HTTPS origin and pins the validated address', async () => {
    const { request, destroyResponse } = response(201);
    await expect(transport.send(delivery())).resolves.toEqual({
      kind: 'accepted',
      status: 201,
    });
    expect(network.resolve4).toHaveBeenCalledExactlyOnceWith(
      'push.example.com',
    );
    expect(network.resolve6).toHaveBeenCalledExactlyOnceWith(
      'push.example.com',
    );
    const { headers, ...options } = network.request.mock
      .calls[0][0] as RequestOptions & { headers: Record<string, string> };
    expect(options).toMatchObject({
      hostname: '8.8.8.8',
      port: 443,
      servername: 'push.example.com',
      rejectUnauthorized: true,
      agent: false,
      method: 'POST',
      path: '/delivery/opaque-secret?q=one',
    });
    expect(headers).toMatchObject({
      Host: 'push.example.com',
      TTL: '52',
      'Content-Encoding': 'aes128gcm',
      Topic: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
    });
    expect(
      options.checkServerIdentity?.('8.8.8.8', {
        subjectaltname: 'DNS:push.example.com',
      } as PeerCertificate),
    ).toBeUndefined();
    expect(
      options.checkServerIdentity?.('8.8.8.8', {
        subjectaltname: 'IP Address:8.8.8.8',
      } as PeerCertificate),
    ).toBeInstanceOf(Error);

    const [, jwt, publicKey] = /^vapid t=(\S+),\s*k=(\S+)$/i.exec(
      headers.Authorization,
    )!;
    expect(publicKey).toBe(identity.getPublicKey().toString('base64url'));
    const [jwtHeader, jwtPayload, signature] = jwt.split('.');
    const point = identity.getPublicKey();
    const key = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: point.subarray(1, 33).toString('base64url'),
        y: point.subarray(33, 65).toString('base64url'),
      },
      format: 'jwk',
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${jwtHeader}.${jwtPayload}`),
        {
          key,
          dsaEncoding: 'ieee-p1363',
        },
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
    const claims = JSON.parse(
      Buffer.from(jwtPayload, 'base64url').toString('utf8'),
    );
    expect(claims).toMatchObject({
      aud: 'https://push.example.com',
      sub: 'mailto:push@nodia.example',
    });
    expect(claims.exp).toBeGreaterThan(now.getTime() / 1000);
    expect(claims.exp).toBeLessThanOrEqual(now.getTime() / 1000 + 24 * 3600);
    expect(decryptBrowserPayload(request.end.mock.calls[0][0])).toEqual({
      version: 1,
      kind: 'provider_visit',
      notificationId,
      path: `/business/${businessId}`,
    });
    expect(destroyResponse).toHaveBeenCalledOnce();
  });

  it('refuses a mismatched VAPID key and never opens the encrypted secret for a different installation', async () => {
    const item = delivery();
    vi.stubEnv(
      'WEB_PUSH_PRIVATE_KEY',
      browser.getPrivateKey().toString('base64url'),
    );
    expect(transport.configuredKeyId()).toBeNull();
    await expect(transport.send(item)).resolves.toEqual({
      kind: 'not_sent',
      reason: 'configuration',
    });
    vi.stubEnv(
      'WEB_PUSH_PRIVATE_KEY',
      identity.getPrivateKey().toString('base64url'),
    );
    await expect(transport.send({ ...item, userId: '2' })).resolves.toEqual({
      kind: 'not_sent',
      reason: 'subscription',
    });
    expect(network.resolve4).not.toHaveBeenCalled();
    expect(network.request).not.toHaveBeenCalled();
  });

  it.each([
    '127.0.0.1',
    '10.0.1.3',
    '169.254.169.254',
    '100.64.0.1',
    '192.0.2.1',
    '::ffff:127.0.0.1',
    '64:ff9b::a00:1',
    '2002:a00:100::1',
    'fc00::1',
    '3fff::1',
  ])(
    'blocks mixed DNS answers with special-use address %s before posting',
    async (address) => {
      network.resolve6.mockResolvedValue(['2606:4700:4700::1111', address]);
      await expect(transport.send(delivery())).resolves.toEqual({
        kind: 'not_sent',
        reason: 'destination',
      });
      expect(network.request).not.toHaveBeenCalled();
    },
  );

  it('checks the current allowlist before resolving a registered endpoint', async () => {
    const item = delivery();
    vi.stubEnv('WEB_PUSH_ENDPOINT_HOSTS', 'other.example.com');
    await expect(transport.send(item)).resolves.toEqual({
      kind: 'not_sent',
      reason: 'destination',
    });
    expect(network.resolve4).not.toHaveBeenCalled();
  });

  it('times out and cancels DNS before making any HTTPS request', async () => {
    network.resolve4.mockImplementation(() => new Promise(() => undefined));
    const result = transport.send(delivery());
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toEqual({ kind: 'not_sent', reason: 'dns' });
    expect(network.cancel).toHaveBeenCalledOnce();
    expect(network.request).not.toHaveBeenCalled();
  });

  it('requires remaining TTL and stops before POST when the visit expires during DNS', async () => {
    const item = { ...delivery(), expiresAt: new Date(now.getTime() + 1500) };
    network.resolve4.mockImplementation(async () => {
      vi.setSystemTime(new Date(now.getTime() + 700));
      return ['8.8.8.8'];
    });
    await expect(transport.send(item)).resolves.toEqual({
      kind: 'not_sent',
      reason: 'expired',
    });
    expect(network.request).not.toHaveBeenCalled();
  });

  it.each([
    [429, '2', 2000],
    [503, 'Fri, 20 Nov 2026 15:00:05 GMT', 5000],
    [410, undefined, null],
    [302, 'malformed', null],
  ] as const)(
    'returns provider HTTP %d and the retry delay without following redirects',
    async (status, header, retryAfterMs) => {
      response(status, header);
      await expect(transport.send(delivery())).resolves.toEqual({
        kind: 'rejected',
        status,
        retryAfterMs,
      });
      expect(network.request).toHaveBeenCalledOnce();
    },
  );

  it('conserves an unknown outcome after a timed-out POST and closes the request', async () => {
    const { request } = response();
    const result = transport.send(delivery());
    await vi.advanceTimersByTimeAsync(8000);
    await expect(result).resolves.toEqual({
      kind: 'unknown',
      reason: 'timeout',
    });
    expect(request.end).toHaveBeenCalledOnce();
    expect(request.destroy).toHaveBeenCalledOnce();
    expect(network.request).toHaveBeenCalledOnce();
  });
});
