import type {
  ArmedWebPushDelivery,
  WebPushDeliveryResult,
} from './web-push-delivery.store.js';
import type { WebPushOutcome } from './web-push-transport.js';

const maxAttempts = 3;
const initialBackoffMs = 15_000;
const minimumTtlMs = 1_000;

export function resolveWebPushDeliveryResult(
  outcome: WebPushOutcome,
  delivery: Pick<ArmedWebPushDelivery, 'attemptCount' | 'expiresAt'>,
  now: Date,
  jitterMs: number,
): WebPushDeliveryResult {
  if (outcome.kind === 'accepted')
    return {
      state: 'accepted',
      reason: 'accepted',
      httpStatus: outcome.status,
    };

  if (outcome.kind === 'unknown')
    return { state: 'unknown', reason: outcome.reason };

  if (outcome.kind === 'not_sent') {
    if (outcome.reason === 'expired')
      return { state: 'expired', reason: 'expired' };
    if (outcome.reason !== 'dns')
      return { state: 'failed', reason: outcome.reason };
  } else {
    const httpStatus = outcome.status;
    if (httpStatus === 404 || httpStatus === 410)
      return { state: 'failed', reason: 'subscription_gone', httpStatus };
    if (httpStatus !== 429 && httpStatus !== 503) {
      return httpStatus >= 500
        ? { state: 'unknown', reason: 'http_indeterminate', httpStatus }
        : { state: 'failed', reason: 'http_rejected', httpStatus };
    }
  }

  const metadata =
    outcome.kind === 'rejected' ? { httpStatus: outcome.status } : {};
  if (delivery.attemptCount >= maxAttempts)
    return { state: 'failed', reason: 'retry_limit', ...metadata };

  const backoffMs =
    initialBackoffMs * 2 ** (delivery.attemptCount - 1) + jitterMs;
  const retryAfterMs =
    outcome.kind === 'rejected' ? (outcome.retryAfterMs ?? 0) : 0;
  const next = now.getTime() + Math.max(backoffMs, retryAfterMs);
  if (next + minimumTtlMs > delivery.expiresAt.getTime())
    return { state: 'expired', reason: 'retry_window_elapsed', ...metadata };

  return {
    state: 'retry',
    reason: outcome.kind === 'rejected' ? 'http_rejected' : 'dns',
    nextAttemptAt: new Date(next),
    ...metadata,
  };
}
