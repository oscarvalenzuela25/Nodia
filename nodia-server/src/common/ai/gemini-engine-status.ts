import { observedAgenticQuota } from './gemini-quota-observation.js';
type EngineStatus = Record<string, unknown>;
export interface GeminiDualEngineStatus {
  active_engine: 'agentic' | null;
  default_engine?: 'agentic';
  agentic: EngineStatus;
}
const asRecord = (value: unknown): EngineStatus => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as EngineStatus : {};
export const isAgenticSessionActive = (value: unknown): boolean => {
 const status = asRecord(value);
 return status.available === true && (status.authenticated ?? status.has_active_session) === true;
};
export const normalizeGeminiEngineStatus = (value: unknown): GeminiDualEngineStatus | null => {
 if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
 const status = asRecord(value), agentic = asRecord(status.agentic);
 const quota = observedAgenticQuota({ ...agentic, authenticated: isAgenticSessionActive(agentic) });
 return {
  default_engine: 'agentic',
  active_engine: (status.active_engine ?? status.default_engine) === 'agentic' ? 'agentic' : null,
  agentic: { ...agentic, available: agentic.available === true,
   authenticated: isAgenticSessionActive(agentic), quota: quota?.quota ?? null,
   quotas: undefined, usage_info: null, quota_source: quota ? 'agentic_cli' : null,
   quota_observed_at: quota?.observed_at ?? null },
 };
};
