import type { GeminiExecutionEngine } from './ai.types.js';
import { observedAgenticQuota, observedWebQuota } from './gemini-quota-observation.js';

type EngineStatus = Record<string, unknown>;

export interface GeminiDualEngineStatus {
  active_engine: GeminiExecutionEngine | null;
  default_engine?: GeminiExecutionEngine;
  agentic: EngineStatus;
  web: EngineStatus;
}

const asRecord = (value: unknown): EngineStatus =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as EngineStatus)
    : {};

export const isAgenticSessionActive = (value: unknown): boolean => {
  const status = asRecord(value);
  return (
    status.available === true &&
    (status.authenticated ?? status.has_active_session) === true
  );
};

export const normalizeGeminiEngineStatus = (
  value: unknown,
): GeminiDualEngineStatus | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  const status = asRecord(value);
  const web = asRecord(status.web);
  const agentic = asRecord(status.agentic);
  const quota = observedWebQuota(web);
  const agenticQuota = observedAgenticQuota({ ...agentic, authenticated: isAgenticSessionActive(agentic) });
  const reportedEngine = status.active_engine ?? status.default_engine;
  return {
    ...status,
    active_engine:
      reportedEngine === 'web' || reportedEngine === 'agentic'
        ? reportedEngine
        : null,
    web: {
      ...web,
      available:
        typeof web.available === 'boolean'
          ? web.available
          : web.authenticated === true,
      authenticated: web.authenticated === true,
      supported_options: {
        extended_thinking: typeof asRecord(web.supported_options).extended_thinking === 'boolean'
          ? asRecord(web.supported_options).extended_thinking : null,
      },
      quota: quota?.quota ?? null,
      quotas: undefined,
      usage_info: quota?.usage ?? null,
      quota_source: quota ? 'web' : null,
      quota_observed_at: quota?.observed_at ?? null,
    },
    agentic: {
      ...agentic,
      available: agentic.available === true,
      authenticated: isAgenticSessionActive(agentic),
      quota: agenticQuota?.quota ?? null,
      quotas: undefined,
      usage_info: null,
      quota_source: agenticQuota ? 'agentic_cli' : null,
      quota_observed_at: agenticQuota?.observed_at ?? null,
    },
  };
};
