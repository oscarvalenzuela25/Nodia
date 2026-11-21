import { BadRequestException } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { encryptScopedSecret } from '../ai-provider/helpers/ai-key-crypto.helper.js';
import type { SaveWebPushInstallationDto } from './dto/visit-notifications.dto.js';
import {
  decodeWebPushKey,
  readWebPushPublicKey,
  type WebPushRegistrationConfig,
} from './web-push-config.js';

export function validateWebPushEndpoint(
  value: string,
  allowed: ReadonlySet<string>,
): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new BadRequestException('visit_notifications:invalid_endpoint');
  }
  const host = endpoint.hostname;
  const authorized =
    allowed.has(host) ||
    [...allowed].some(
      (pattern) => pattern.startsWith('*.') && host.endsWith(pattern.slice(1)),
    );
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.port ||
    /[\s#\\]/.test(value) ||
    host.includes('..') ||
    !authorized
  )
    throw new BadRequestException('visit_notifications:invalid_endpoint');
  return endpoint;
}

export function prepareWebPushSubscription(
  input: SaveWebPushInstallationDto['subscription'],
  config: WebPushRegistrationConfig,
  owner: { userId: string; installationId: string },
  now: Date,
) {
  const endpoint = validateWebPushEndpoint(
    input.endpoint,
    config.endpointHosts,
  ).href;
  if (
    !readWebPushPublicKey(input.keys.p256dh) ||
    !decodeWebPushKey(input.keys.auth, 16)
  )
    throw new BadRequestException(
      'visit_notifications:invalid_subscription_keys',
    );
  const expiresAt =
    input.expirationTime == null ? null : new Date(input.expirationTime);
  if (
    expiresAt &&
    (!(expiresAt.getTime() > now.getTime()) ||
      expiresAt.getUTCFullYear() > 9999)
  )
    throw new BadRequestException('visit_notifications:expired_subscription');

  const payload = JSON.stringify({
    endpoint,
    keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
  });
  const context = Buffer.from(
    `nodia-web-push/1:${owner.userId}:${owner.installationId}`,
  );
  return {
    endpoint_fingerprint: createHash('sha256').update(endpoint).digest('hex'),
    subscription_fingerprint: createHmac('sha256', config.encryptionKey)
      .update(payload)
      .digest('hex'),
    subscription_ciphertext: encryptScopedSecret(
      payload,
      config.encryptionKey,
      context,
    ),
    expires_at: expiresAt,
  };
}
