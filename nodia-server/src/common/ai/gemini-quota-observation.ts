type RecordValue = Record<string, unknown>;
const asRecord = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const finite = (value: unknown, max = Infinity): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;

function observedQuota(value: unknown, source: 'web' | 'agentic_cli', now = Date.now()) {
  const data = asRecord(value);
  const observed = finite(data.quota_observed_at);
  if (data.authenticated !== true || data.quota_source !== source || observed === null || observed <= 0 || observed * 1000 > now + 5000 || now - observed * 1000 > 60000) return null;
  const quota: RecordValue = {};
  for (const [key, raw] of Object.entries(asRecord(data.quota ?? data.quotas))) {
    const metric = asRecord(raw);
    const percentage = finite(metric.usage_percentage, 100);
    const remaining = finite(metric.remaining);
    const total = finite(metric.total);
    if (percentage === null || (remaining !== null && total !== null && remaining > total)) continue;
    quota[key] = { usage_percentage: percentage, remaining, total,
      remaining_credits: finite(metric.remaining_credits),
      reset_time: finite(metric.reset_time),
      reset_at: typeof metric.reset_at === 'string' && Number.isFinite(Date.parse(metric.reset_at)) ? metric.reset_at : null };
  }
  const usage: RecordValue = {};
  for (const key of ['current_5h', 'weekly']) {
    const metric = asRecord(asRecord(data.usage_info)[key]);
    const percentage = finite(metric.usage_percentage, 100);
    if (percentage !== null) usage[key] = { usage_percentage: percentage,
      remaining_credits: finite(metric.remaining_credits),
      reset_at: typeof metric.reset_at === 'string' && Number.isFinite(Date.parse(metric.reset_at)) ? metric.reset_at : null };
  }
  return { quota, usage, observed_at: observed };
}

export const observedWebQuota = (value: unknown, now = Date.now()) => observedQuota(value, 'web', now);
export const observedAgenticQuota = (value: unknown, now = Date.now()) => observedQuota(value, 'agentic_cli', now);
