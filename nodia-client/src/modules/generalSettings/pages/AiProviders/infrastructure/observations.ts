/** A subscription chip uses its own observation, never the API default's health. */
export function getObservedSessionStatus(info: {
  available?: boolean | null;
  authenticated?: boolean | null;
  usageAllowed?: boolean | null;
  reason?: string | null;
} | undefined): 'healthy' | 'degraded' | 'expired' | 'unverified' {
  if (info?.reason === 'codex_runtime_unverified') return 'unverified';
  if (info?.available === false || info?.usageAllowed === false) return 'degraded';
  if (info?.available === true && info.authenticated === false) return 'expired';
  return info?.available === true && info.authenticated === true ? 'healthy' : 'unverified';
}
