import { describe, expect, it, vi } from 'vitest';
import { ObserveNodiaAiOperationsUseCase } from './observe-nodia-ai-operations.use-case.js';
import {
  NODIA_AI_OPERATION_COUNTERS,
  NODIA_AI_OPERATION_AGES,
} from '../types/operations.types.js';
import { NodiaAiOperationsService } from '../nodia-ai-operations.service.js';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';

export function operationsRow() {
  return {
    observed_at: new Date('2026-10-20T12:00:00Z'),
    ...Object.fromEntries(NODIA_AI_OPERATION_COUNTERS.map((key) => [key, '0'])),
    ...Object.fromEntries(NODIA_AI_OPERATION_AGES.map((key) => [key, null])),
  };
}
describe('ObserveNodiaAiOperationsUseCase', () => {
  function fixture(row: unknown = operationsRow()) {
    const policy = runtimeFixture().policy;
    const observe = vi.fn(async () => row);
    return {
      observe,
      policy,
      useCase: new ObserveNodiaAiOperationsUseCase(
        { observe } as unknown as NodiaAiOperationsService,
        policy,
      ),
    };
  }
  it('preserves measured zero, unknown age, readiness and external cost', async () => {
    const f = fixture();
    const result = await f.useCase.execute();
    expect(result.counters.queued).toBe(0);
    expect(result.ages.oldest_queued_seconds).toBeNull();
    expect(result.provider_ready).toBeNull();
    expect(result.external_cost).toBeNull();
    expect(result.operational_state).toBe('no_alerts_observed');
    expect(f.observe).toHaveBeenCalledWith(
      f.policy.queue.wait_seconds,
      f.policy.retry.cleanup_attempts,
      f.policy.timing.read_query_seconds,
    );
  });
  it('alerts even for an unknown slot without a surviving job; never releases or retries it', async () => {
    const f = fixture({ ...operationsRow(), unknown_slots: '1' });
    expect((await f.useCase.execute()).alerts).toEqual(['unknown_pending']);
  });
  it('alerts for restored failed jobs even without unknown jobs or slots', async () => {
    const f = fixture({ ...operationsRow(), restore_quarantined_jobs: '1' });
    const result = await f.useCase.execute();
    expect(result.alerts).toEqual(['restore_quarantine_pending']);
    expect(result.operational_state).toBe('attention_required');
    expect(result.provider_ready).toBeNull();
  });
  it('uses all measured operational hazards and fractional ages without claiming an SLA', async () => {
    const f = fixture({
      ...operationsRow(),
      queue_wait_expired: '1',
      deadline_expired: '2',
      lease_expired: '3',
      cleanup_exhausted: '4',
      blob_cleanup_overdue: '5',
      oldest_cleanup_job_seconds: '86400.125',
    });
    const result = await f.useCase.execute();
    expect(result.alerts).toEqual([
      'queue_wait_expired',
      'deadline_expired',
      'lease_expired',
      'cleanup_exhausted',
      'blob_cleanup_overdue',
    ]);
    expect(result.ages.oldest_cleanup_job_seconds).toBe(86400.125);
  });
  it.each([
    undefined,
    null,
    '',
    'secret',
    -1,
    '-1',
    1.5,
    '1e3',
    '9007199254740992',
    Infinity,
    true,
  ])('rejects invalid count %s instead of fabricating zero', async (value) => {
    await expect(
      fixture({ ...operationsRow(), queued: value }).useCase.execute(),
    ).rejects.toThrow('nodia_ai_operations_invalid_snapshot');
  });
  it('drops unexpected private fields and never logs a query response', async () => {
    const result = await fixture({
      ...operationsRow(),
      prompt: 'private',
      owner_id: '123',
      storage_key: 'secret',
    }).useCase.execute();
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('owner_id');
  });
  it.each([
    null,
    [],
    {},
    { ...operationsRow(), observed_at: 'broken' },
    { ...operationsRow(), oldest_queued_seconds: undefined },
  ])('rejects malformed snapshot', async (row) => {
    await expect(fixture(row).useCase.execute()).rejects.toThrow(
      'nodia_ai_operations_invalid_snapshot',
    );
  });
  it('propagates DB outage, preserving the difference from an empty healthy snapshot', async () => {
    const f = fixture();
    f.observe.mockRejectedValueOnce(Error('database offline'));
    await expect(f.useCase.execute()).rejects.toThrow('database offline');
  });
});
