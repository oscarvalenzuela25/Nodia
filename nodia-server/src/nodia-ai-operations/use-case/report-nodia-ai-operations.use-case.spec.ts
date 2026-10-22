import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ReportNodiaAiOperationsUseCase } from './report-nodia-ai-operations.use-case.js';
import { ObserveNodiaAiOperationsUseCase } from './observe-nodia-ai-operations.use-case.js';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import type { NodiaAiOperationsSnapshot } from '../types/operations.types.js';

function snapshot(): NodiaAiOperationsSnapshot {
  return {
    observed_at: '2026-10-20T12:00:00.000Z',
    policy_version: 'synthetic-operations-test/1',
    counters: {
      queued: 0,
      leased: 0,
      unknown_jobs: 1,
      unknown_slots: 0,
      restore_quarantined_jobs: 0,
      held_slots: 0,
      queue_wait_expired: 0,
      deadline_expired: 0,
      lease_expired: 0,
      cleanup_pending: 0,
      cleanup_exhausted: 0,
      blob_cleanup_overdue: 0,
    },
    ages: {
      oldest_queued_seconds: null,
      oldest_unknown_job_seconds: 0,
      oldest_cleanup_job_seconds: null,
    },
    alerts: ['unknown_pending'],
    operational_state: 'attention_required',
    database_observed: true,
    provider_ready: null,
    external_cost: null,
  };
}

describe('ReportNodiaAiOperationsUseCase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  function fixture() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    const policy = runtimeFixture().policy;
    const execute = vi.fn(async () => snapshot());
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    return {
      execute,
      log,
      warn,
      policy,
      useCase: new ReportNodiaAiOperationsUseCase(
        { execute } as unknown as ObserveNodiaAiOperationsUseCase,
        policy,
      ),
    };
  }
  it('coalesces concurrent heartbeats and observes only once per existing sweep interval', async () => {
    const f = fixture();
    await Promise.all(Array.from({ length: 20 }, () => f.useCase.execute()));
    await vi.advanceTimersByTimeAsync(
      f.policy.retention.sweep_seconds * 1000 - 1,
    );
    await f.useCase.execute();
    expect(f.execute).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await f.useCase.execute();
    expect(f.execute).toHaveBeenCalledTimes(2);
    expect(f.log).toHaveBeenCalledTimes(2);
    expect(f.warn).toHaveBeenCalledTimes(1);
  });
  it('records resolved alerts once without changing job state or invoking inference', async () => {
    const f = fixture();
    await f.useCase.execute();
    f.execute.mockResolvedValueOnce({
      ...snapshot(),
      counters: { ...snapshot().counters, unknown_jobs: 0 },
      ages: { ...snapshot().ages, oldest_unknown_job_seconds: null },
      alerts: [],
      operational_state: 'no_alerts_observed',
    });
    await vi.advanceTimersByTimeAsync(f.policy.retention.sweep_seconds * 1000);
    await f.useCase.execute();
    expect(f.warn).toHaveBeenLastCalledWith({
      event: 'nodia_ai_operations_alerts_changed',
      alerts: [],
      operational_state: 'no_alerts_observed',
    });
  });
  it('does not expose DB error text or announce readiness and throttles failures', async () => {
    const f = fixture();
    f.execute.mockRejectedValue(
      Error('SQL containing prompt secret and user_id'),
    );
    await f.useCase.execute();
    await f.useCase.execute();
    await vi.advanceTimersByTimeAsync(f.policy.retention.sweep_seconds * 1000);
    await f.useCase.execute();
    expect(f.warn).toHaveBeenCalledTimes(1);
    expect(f.log).not.toHaveBeenCalled();
    expect(f.warn).toHaveBeenCalledWith({
      event: 'nodia_ai_operations_unavailable',
      database_observed: false,
      provider_ready: null,
      external_cost: null,
    });
    expect(JSON.stringify(f.warn.mock.calls)).not.toContain('secret');
  });
});
