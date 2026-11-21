import { describe, expect, it } from 'vitest';
import { resolveWebPushDeliveryResult } from './web-push-delivery-policy.js';
import type { WebPushOutcome } from './web-push-transport.js';

const now = new Date('2026-11-20T12:00:00.000Z');
const deadline = (ms: number) => new Date(now.getTime() + ms);

function resolve(
  outcome: WebPushOutcome,
  attemptCount = 1,
  remainingMs = 120_000,
) {
  return resolveWebPushDeliveryResult(
    outcome,
    { attemptCount, expiresAt: deadline(remainingMs) },
    now,
    800,
  );
}

describe('Web Push delivery retry and terminal states', () => {
  it('records an acceptance even if the response arrives after the expiry window', () => {
    expect(resolve({ kind: 'accepted', status: 201 }, 1, -1)).toEqual({
      state: 'accepted',
      reason: 'accepted',
      httpStatus: 201,
    });
  });

  it('honors a later Retry-After for rate limits', () => {
    expect(
      resolve({ kind: 'rejected', status: 429, retryAfterMs: 45_000 }),
    ).toEqual({
      state: 'retry',
      reason: 'http_rejected',
      httpStatus: 429,
      nextAttemptAt: deadline(45_000),
    });
  });

  it('preserves the exponential minimum for a known rejection or pre-dispatch DNS failure', () => {
    expect(
      resolve({ kind: 'rejected', status: 503, retryAfterMs: 500 }, 2),
    ).toEqual({
      state: 'retry',
      reason: 'http_rejected',
      httpStatus: 503,
      nextAttemptAt: deadline(30_800),
    });
    expect(resolve({ kind: 'not_sent', reason: 'dns' })).toEqual({
      state: 'retry',
      reason: 'dns',
      nextAttemptAt: deadline(15_800),
    });
  });

  it('requires at least a full second of TTL when the retry becomes due', () => {
    const outcome = {
      kind: 'rejected',
      status: 429,
      retryAfterMs: 45_000,
    } as const;
    expect(resolve(outcome, 1, 46_000).state).toBe('retry');
    expect(resolve(outcome, 1, 45_999)).toEqual({
      state: 'expired',
      reason: 'retry_window_elapsed',
      httpStatus: 429,
    });
    expect(resolve({ kind: 'not_sent', reason: 'expired' })).toEqual({
      state: 'expired',
      reason: 'expired',
    });
  });

  it('stops reattempting after three armed attempts', () => {
    expect(
      resolve({ kind: 'rejected', status: 503, retryAfterMs: null }, 3),
    ).toEqual({
      state: 'failed',
      reason: 'retry_limit',
      httpStatus: 503,
    });
  });

  it.each([404, 410])('recognizes HTTP %i as a gone subscription', (status) => {
    expect(resolve({ kind: 'rejected', status, retryAfterMs: null })).toEqual({
      state: 'failed',
      reason: 'subscription_gone',
      httpStatus: status,
    });
  });

  it.each([500, 502, 504])(
    'keeps HTTP %i indeterminate without replay',
    (status) => {
      expect(resolve({ kind: 'rejected', status, retryAfterMs: null })).toEqual(
        {
          state: 'unknown',
          reason: 'http_indeterminate',
          httpStatus: status,
        },
      );
    },
  );

  it('distinguishes a definitive rejection from an ambiguous timeout', () => {
    expect(
      resolve({ kind: 'rejected', status: 403, retryAfterMs: null }),
    ).toEqual({
      state: 'failed',
      reason: 'http_rejected',
      httpStatus: 403,
    });
    expect(resolve({ kind: 'unknown', reason: 'timeout' })).toEqual({
      state: 'unknown',
      reason: 'timeout',
    });
  });
});
