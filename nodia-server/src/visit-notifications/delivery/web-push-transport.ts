import { Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { createECDH, createHash } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import type { ClientRequest } from 'node:http';
import { request as requestHttps } from 'node:https';
import { isIP } from 'node:net';
import { checkServerIdentity } from 'node:tls';
import ipaddr from 'ipaddr.js';
import {
  generateRequestDetails,
  type PushSubscription,
  type RequestDetails,
} from 'web-push';
import { decryptScopedSecret } from '../../ai-provider/helpers/ai-key-crypto.helper.js';
import {
  decodeWebPushKey,
  readWebPushPublicKey,
  readWebPushRegistrationConfig,
} from '../web-push-config.js';
import { validateWebPushEndpoint } from '../web-push-subscription.js';

const maximumAttemptMs = 8000;
const maximumDnsMs = 2000;
const maximumTtlSeconds = 2_147_483_647;
const ipv6GlobalPrefix = ipaddr.IPv6.parse('2000::');
const ipv6ProtocolAssignments = ipaddr.IPv6.parse('2001::');
const ipv6DocumentationPrefix = ipaddr.IPv6.parse('3fff::');
const businessUuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export interface WebPushRequest {
  userId: string;
  installationId: string;
  keyId: string;
  ciphertext: string;
  notificationId: string;
  businessId: string;
  expiresAt: Date;
}

export type WebPushOutcome =
  | { kind: 'accepted'; status: number }
  | { kind: 'rejected'; status: number; retryAfterMs: number | null }
  | {
      kind: 'not_sent';
      reason:
        'expired' | 'configuration' | 'subscription' | 'dns' | 'destination';
    }
  | { kind: 'unknown'; reason: 'transport' | 'timeout' };

function readVapidSubject(value: string | undefined): string | null {
  const subject = value?.trim();
  if (!subject || subject.length > 512 || /[\s#\\]/.test(subject)) return null;
  if (subject.startsWith('mailto:')) {
    const email = subject.slice('mailto:'.length);
    return isEmail(email, { allow_utf8_local_part: false }) ? subject : null;
  }
  if (!subject.startsWith('https://')) return null;
  try {
    const url = new URL(subject);
    if (
      !url.hostname.includes('.') ||
      isIP(url.hostname) ||
      url.hostname.endsWith('.localhost') ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function readSendingConfig() {
  const registration = readWebPushRegistrationConfig();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const scalar = decodeWebPushKey(privateKey, 32);
  const subject = readVapidSubject(process.env.WEB_PUSH_SUBJECT);
  if (!registration || !privateKey || !scalar || !subject) return null;
  try {
    const identity = createECDH('prime256v1');
    identity.setPrivateKey(scalar);
    if (
      identity.getPublicKey().toString('base64url') !== registration.publicKey
    )
      return null;
  } catch {
    return null;
  }
  return { ...registration, privateKey, subject };
}

function isPublicAddress(value: string): boolean {
  const family = isIP(value);
  if (family === 4) return ipaddr.IPv4.parse(value).range() === 'unicast';
  if (family !== 6 || value.includes('%')) return false;
  const address = ipaddr.IPv6.parse(value);
  return (
    address.range() === 'unicast' &&
    address.match(ipv6GlobalPrefix, 3) &&
    !address.match(ipv6ProtocolAssignments, 23) &&
    !address.match(ipv6DocumentationPrefix, 20)
  );
}

type Resolution = { address: string } | { reason: 'dns' | 'destination' };

async function resolvePublicAddress(
  hostname: string,
  timeoutMs: number,
): Promise<Resolution> {
  const resolver = new Resolver({ timeout: timeoutMs, tries: 1 });
  let timer: NodeJS.Timeout | undefined;
  const tolerateMissingFamily = (error: NodeJS.ErrnoException): string[] => {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') return [];
    throw error;
  };
  try {
    const addresses = await Promise.race([
      Promise.all([
        resolver.resolve4(hostname).catch(tolerateMissingFamily),
        resolver.resolve6(hostname).catch(tolerateMissingFamily),
      ]).then((families) => families.flat()),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (!addresses?.length) return { reason: 'dns' };
    if (!addresses.every(isPublicAddress)) return { reason: 'destination' };
    // Prefer the first A record. Never resolve the hostname again when opening TLS.
    return { address: addresses[0] };
  } catch {
    return { reason: 'dns' };
  } finally {
    clearTimeout(timer);
    resolver.cancel();
  }
}

function readRetryAfter(value: string | undefined): number | null {
  if (value === undefined) return null;
  const header = value.trim();
  if (/^\d+$/.test(header))
    return Math.min(Number(header) * 1000, Number.MAX_SAFE_INTEGER);
  if (!/^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(header))
    return null;
  const timestamp = Date.parse(header);
  return Number.isFinite(timestamp)
    ? Math.max(0, timestamp - Date.now())
    : null;
}

function requestWindow(expiresAt: number, startedAt: number) {
  const availableMs = expiresAt - Date.now();
  const requestMs = Math.min(
    Math.floor(maximumAttemptMs - (performance.now() - startedAt)),
    availableMs - 1000,
  );
  if (requestMs <= 0) return null;
  // Reserve the entire remaining HTTP budget before setting the provider TTL.
  const ttlSeconds = Math.min(
    Math.floor((availableMs - requestMs) / 1000),
    maximumTtlSeconds,
  );
  return { requestMs, ttlSeconds };
}

function postPinned(
  endpoint: URL,
  address: string,
  details: RequestDetails & { body: Buffer },
  timeoutMs: number,
): Promise<WebPushOutcome> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const finish = (outcome: WebPushOutcome) => {
      clearTimeout(timer);
      resolve(outcome);
    };
    let request: ClientRequest;
    try {
      request = requestHttps(
        {
          hostname: address,
          port: 443,
          servername: endpoint.hostname,
          checkServerIdentity: (_hostname, certificate) =>
            checkServerIdentity(endpoint.hostname, certificate),
          rejectUnauthorized: true,
          method: 'POST',
          path: `${endpoint.pathname}${endpoint.search}`,
          headers: { ...details.headers, Host: endpoint.host },
          agent: false,
          maxHeaderSize: 16_384,
        },
        (response) => {
          const status = response.statusCode;
          if (status === undefined)
            finish({ kind: 'unknown', reason: 'transport' });
          else if (status >= 200 && status < 300)
            finish({ kind: 'accepted', status });
          else {
            finish({
              kind: 'rejected',
              status,
              retryAfterMs: readRetryAfter(response.headers['retry-after']),
            });
          }
          // Never consume or persist a push provider's response body.
          response.destroy();
        },
      );
    } catch {
      resolve({ kind: 'not_sent', reason: 'destination' });
      return;
    }
    timer = setTimeout(() => {
      finish({ kind: 'unknown', reason: 'timeout' });
      request.destroy();
    }, timeoutMs);
    request.once('error', () =>
      finish({ kind: 'unknown', reason: 'transport' }),
    );
    try {
      request.end(details.body);
    } catch {
      finish({ kind: 'unknown', reason: 'transport' });
      request.destroy();
    }
  });
}

function readStoredSubscription(
  request: WebPushRequest,
  encryptionKey: Buffer,
): PushSubscription | null {
  const context = Buffer.from(
    `nodia-web-push/1:${request.userId}:${request.installationId}`,
  );
  try {
    const value: unknown = JSON.parse(
      decryptScopedSecret(request.ciphertext, encryptionKey, context),
    );
    if (!value || typeof value !== 'object') return null;
    const { endpoint, keys } = value as { endpoint?: unknown; keys?: unknown };
    if (
      typeof endpoint !== 'string' ||
      endpoint.length > 2048 ||
      !keys ||
      typeof keys !== 'object'
    )
      return null;
    const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
    if (
      typeof p256dh !== 'string' ||
      typeof auth !== 'string' ||
      !readWebPushPublicKey(p256dh) ||
      !decodeWebPushKey(auth, 16)
    )
      return null;
    return { endpoint, keys: { p256dh, auth } };
  } catch {
    return null;
  }
}

@Injectable()
export class WebPushTransport {
  configuredKeyId(): string | null {
    return readSendingConfig()?.keyId ?? null;
  }

  async send(request: WebPushRequest): Promise<WebPushOutcome> {
    const startedAt = performance.now();
    const expiresAt = request.expiresAt.getTime();
    if (!Number.isFinite(expiresAt) || expiresAt - Date.now() <= 1000)
      return { kind: 'not_sent', reason: 'expired' };
    const config = readSendingConfig();
    if (!config || config.keyId !== request.keyId)
      return { kind: 'not_sent', reason: 'configuration' };
    const subscription = readStoredSubscription(request, config.encryptionKey);
    if (!subscription) return { kind: 'not_sent', reason: 'subscription' };
    let endpoint: URL;
    try {
      endpoint = validateWebPushEndpoint(
        subscription.endpoint,
        config.endpointHosts,
      );
    } catch {
      return { kind: 'not_sent', reason: 'destination' };
    }
    if (
      !businessUuid.test(request.businessId) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(request.notificationId) ||
      endpoint.href.startsWith('https://android.googleapis.com/gcm/send')
    )
      return { kind: 'not_sent', reason: 'destination' };

    const dnsBudget = requestWindow(expiresAt, startedAt);
    if (!dnsBudget) return { kind: 'not_sent', reason: 'expired' };
    const resolution = await resolvePublicAddress(
      endpoint.hostname,
      Math.min(maximumDnsMs, dnsBudget.requestMs),
    );
    if ('reason' in resolution)
      return { kind: 'not_sent', reason: resolution.reason };

    const payload = JSON.stringify({
      version: 1,
      kind: 'provider_visit',
      path: `/business/${request.businessId.toLowerCase()}`,
      notificationId: request.notificationId,
    });
    const topic = createHash('sha256')
      .update(request.notificationId)
      .digest('base64url')
      .slice(0, 32);
    let details: RequestDetails & { body: Buffer };
    try {
      details = generateRequestDetails(
        { ...subscription, endpoint: endpoint.href },
        payload,
        {
          contentEncoding: 'aes128gcm',
          vapidDetails: {
            publicKey: config.publicKey,
            privateKey: config.privateKey,
            subject: config.subject,
          },
          TTL: 1,
          topic,
        },
      );
    } catch {
      return { kind: 'not_sent', reason: 'subscription' };
    }
    const window = requestWindow(expiresAt, startedAt);
    if (!window) return { kind: 'not_sent', reason: 'expired' };
    details.headers.TTL = String(window.ttlSeconds);
    return postPinned(endpoint, resolution.address, details, window.requestMs);
  }
}
