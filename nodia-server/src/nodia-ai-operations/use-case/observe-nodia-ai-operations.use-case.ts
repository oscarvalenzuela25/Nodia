import { Inject, Injectable } from '@nestjs/common';
import { NodiaAiOperationsService } from '../nodia-ai-operations.service.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  NODIA_AI_OPERATION_COUNTERS,
  NODIA_AI_OPERATION_AGES,
  type NodiaAiOperationsAlert,
  type NodiaAiOperationsSnapshot,
} from '../types/operations.types.js';

@Injectable()
export class ObserveNodiaAiOperationsUseCase {
  constructor(
    private readonly store: NodiaAiOperationsService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(): Promise<NodiaAiOperationsSnapshot> {
    const raw = await this.store.observe(
      this.policy.queue.wait_seconds,
      this.policy.retry.cleanup_attempts,
      this.policy.timing.read_query_seconds,
    );
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw Error('nodia_ai_operations_invalid_snapshot');
    const row = raw as Record<string, unknown>;
    const number = (key: string, nullable = false): number | null => {
      const value = row[key];
      if (nullable && value === null) return null;
      if (
        typeof value !== 'number' &&
        (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value))
      )
        throw Error('nodia_ai_operations_invalid_snapshot');
      const parsed = Number(value);
      if (
        !Number.isFinite(parsed) ||
        parsed < 0 ||
        parsed > Number.MAX_SAFE_INTEGER ||
        (!nullable && !Number.isSafeInteger(parsed))
      )
        throw Error('nodia_ai_operations_invalid_snapshot');
      return parsed;
    };
    const counters = Object.fromEntries(
      NODIA_AI_OPERATION_COUNTERS.map((key) => [key, number(key)]),
    ) as NodiaAiOperationsSnapshot['counters'];
    const ages = Object.fromEntries(
      NODIA_AI_OPERATION_AGES.map((key) => [key, number(key, true)]),
    ) as NodiaAiOperationsSnapshot['ages'];
    const observed = row.observed_at;
    if (!(observed instanceof Date) && typeof observed !== 'string')
      throw Error('nodia_ai_operations_invalid_snapshot');
    const date = new Date(observed);
    if (!Number.isFinite(date.getTime()))
      throw Error('nodia_ai_operations_invalid_snapshot');
    const alerts: NodiaAiOperationsAlert[] = [];
    if (counters.unknown_jobs > 0 || counters.unknown_slots > 0)
      alerts.push('unknown_pending');
    if (counters.restore_quarantined_jobs > 0)
      alerts.push('restore_quarantine_pending');
    for (const code of [
      'queue_wait_expired',
      'deadline_expired',
      'lease_expired',
      'cleanup_exhausted',
      'blob_cleanup_overdue',
    ] as const)
      if (counters[code] > 0) alerts.push(code);
    return {
      observed_at: date.toISOString(),
      policy_version: this.policy.policyVersion,
      counters,
      ages,
      alerts,
      database_observed: true,
      operational_state: alerts.length
        ? 'attention_required'
        : 'no_alerts_observed',
      provider_ready: null,
      external_cost: null,
    };
  }
}
