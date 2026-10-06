import { describe, expect, it } from 'vitest';
import { getObservedWebQuota } from '../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/observations';
import type { GeminiEngineInfo } from '../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types';

const now = Date.now();
const web: GeminiEngineInfo = { engine: 'web', available: true, authenticated: true, quota_source: 'web', quota_observed_at: now / 1000,
  quota: { 'reported-category': { usage_percentage: 0, remaining: 0, total: 0 } } };

describe('Observed Web quotas', () => {
  it('preserves real zero usage and credits without fixed model categories', () => {
    expect(getObservedWebQuota(web, now)).toEqual([{ key: 'reported-category', percentage: 0, remaining: 0, total: 0 }]);
  });
  it.each([
    { quota_source: undefined }, { quota_source: 'agentic' }, { authenticated: false }, { available: false },
    { quota_observed_at: undefined }, { quota_observed_at: (now - 61000) / 1000 }, { quota_observed_at: (now + 10000) / 1000 },
    { quota: { invalid: { usage_percentage: -1 } } }, { quota: { invalid: { usage_percentage: 101 } } },
    { quota: { invalid: { usage_percentage: NaN } } }, { quota: { invalid: { usage_percentage: null } } },
    { quota: { invalid: { usage_percentage: 20, remaining: 11, total: 10 } } },
  ])('does not expose an unverified or invalid quota: %j', (override) => {
    expect(getObservedWebQuota({ ...web, ...override }, now)).toEqual([]);
  });
  it('shows only reported usage when credits are absent', () => {
    expect(getObservedWebQuota({ ...web, quota: { weekly: { window: 'weekly', usage_percentage: 45 } } }, now))
      .toEqual([{ key: 'weekly', percentage: 45, remaining: null, total: null }]);
  });
});
