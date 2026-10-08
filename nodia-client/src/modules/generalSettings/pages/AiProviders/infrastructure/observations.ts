import type { GeminiEngineInfo } from './types';

export function getObservedWebQuota(info: GeminiEngineInfo | undefined, now = Date.now()) {
  const observed = info?.quota_observed_at;
  if (info?.authenticated !== true || info.available !== true || info.quota_source !== 'web'
    || typeof observed !== 'number' || !Number.isFinite(observed) || observed <= 0
    || observed * 1000 > now + 5000 || now - observed * 1000 > 60000) return [];
  return Object.entries(info.quota ?? {}).flatMap(([key, value]) => {
    if (!value || typeof value.usage_percentage !== 'number' || !Number.isFinite(value.usage_percentage)
      || value.usage_percentage < 0 || value.usage_percentage > 100) return [];
    const metric = value as unknown as Record<string, unknown>;
    const remaining = metric.remaining ?? metric.remaining_credits;
    const total = metric.total;
    const validRemaining = typeof remaining === 'number' && Number.isFinite(remaining) && remaining >= 0;
    const validTotal = typeof total === 'number' && Number.isFinite(total) && total >= 0;
    if (validRemaining && validTotal && remaining > total) return [];
    return [{ key, percentage: value.usage_percentage,
      remaining: validRemaining ? remaining : null, total: validTotal ? total : null }];
  });
}
// Display aliases requested by the user; never executable model IDs or quota values.
const webQuotaLabels: Readonly<Record<string, string>> = {
  "None-11": "ai_providers:detail.quota_flash_label",
  "None-4": "ai_providers:detail.quota_pro_label",
  current_5h: "ai_providers:detail.quota_5h_label",
  weekly: "ai_providers:detail.quota_weekly_label",
};
export const getWebQuotaLabelKey = (key: string): string | null =>
  Object.hasOwn(webQuotaLabels, key) ? webQuotaLabels[key] : null;
