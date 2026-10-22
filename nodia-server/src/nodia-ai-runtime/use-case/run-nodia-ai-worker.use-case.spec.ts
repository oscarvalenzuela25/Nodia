import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { RunNodiaAiWorkerUseCase } from './run-nodia-ai-worker.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';
import { RunNodiaAiStageUseCase } from './run-nodia-ai-stage.use-case.js';
import type { ClaimNodiaAiJobUseCase } from './claim-nodia-ai-job.use-case.js';
import type { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import type { RetryNodiaAiJobUseCase } from './retry-nodia-ai-job.use-case.js';
import type { NodiaAiClaim, NodiaAiStageContext } from '../types/worker.types.js';
import type { RecoverNodiaAiJobsUseCase } from './recover-nodia-ai-jobs.use-case.js';
import type { RunNodiaAiExecutionUseCase } from '../../nodia-ai-execution/use-case/run-nodia-ai-execution.use-case.js';
import type { RecoverNodiaAiExecutionsUseCase } from '../../nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case.js';

/** Explicit synthetic no-work ports keep lifecycle tests isolated from SQL. */
function idleExecutionPorts(): [
  RunNodiaAiExecutionUseCase,
  RecoverNodiaAiExecutionsUseCase,
] {
  return [
    {
      execute: vi.fn(async () => false),
    } as unknown as RunNodiaAiExecutionUseCase,
    {
      execute: vi.fn(async () => 0),
    } as unknown as RecoverNodiaAiExecutionsUseCase,
  ];
}

describe('RunNodiaAiWorkerUseCase', () => {
  it('does not report maintenance recovered when drain interrupts its checks', async () => {
    const f = runtimeFixture();
    const info = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    let finishRecovery: (() => void) | undefined;
    const recovery = { execute: vi.fn()
      .mockRejectedValueOnce(Error('synthetic outage'))
      .mockImplementationOnce(() => new Promise<number>((resolve) => {
        finishRecovery = () => resolve(0);
      })) };
    const maintenance = { execute: vi.fn(async () => 0) };
    const worker = new RunNodiaAiWorkerUseCase(
      { execute: vi.fn(async () => false) } as unknown as RunNodiaAiStageUseCase,
      recovery as unknown as RecoverNodiaAiJobsUseCase,
      maintenance,
      f.policy,
      ...idleExecutionPorts(),
      { execute: vi.fn(async () => undefined) },
    );
    try {
      worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(f.policy.timing.heartbeat_seconds * 1000);
      const stopped = worker.stop();
      expect(finishRecovery).toBeDefined();
      finishRecovery?.();
      await stopped;
      expect(maintenance.execute).toHaveBeenCalledOnce();
      expect(info.mock.calls.some(([entry]) => entry.event === 'nodia_ai_maintenance_recovered')).toBe(false);
    } finally {
      await worker.stop(); info.mockRestore(); warning.mockRestore();
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('deduplicates repeated claim outage logs and reports a later recurrence', async () => {
    const f = runtimeFixture();
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const info = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const stage = { execute: vi.fn()
      .mockRejectedValueOnce(Error('synthetic outage'))
      .mockRejectedValueOnce(Error('synthetic outage'))
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(Error('synthetic recurrence'))
      .mockResolvedValue(false) };
    const worker = new RunNodiaAiWorkerUseCase(
      stage as unknown as RunNodiaAiStageUseCase,
      { execute: vi.fn(async () => 0) } as unknown as RecoverNodiaAiJobsUseCase,
      { execute: vi.fn(async () => 0) },
      { ...f.policy, queue: { ...f.policy.queue, foreground_workers: 1 } },
      ...idleExecutionPorts(),
      { execute: vi.fn(async () => undefined) },
    );
    try {
      worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(f.policy.timing.heartbeat_seconds * 1000);
      expect(warning.mock.calls.filter(([entry]) => entry.event === 'nodia_ai_claim_unavailable')).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(f.policy.timing.heartbeat_seconds * 1000);
      expect(info).toHaveBeenCalledWith({ event: 'nodia_ai_claim_recovered' });
      await vi.advanceTimersByTimeAsync(f.policy.timing.heartbeat_seconds * 1000);
      expect(warning.mock.calls.filter(([entry]) => entry.event === 'nodia_ai_claim_unavailable')).toHaveLength(2);
    } finally {
      await worker.stop(); warning.mockRestore(); info.mockRestore();
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not starve retention or aggregate observation when recovery fails', async () => {
    const f = runtimeFixture();
    const maintenance = { execute: vi.fn(async () => 0) };
    const operations = { execute: vi.fn(async () => undefined) };
    const recoverExecutions = { execute: vi.fn(async () => 0) };
    const worker = new RunNodiaAiWorkerUseCase(
      { execute: vi.fn(async () => false) } as unknown as RunNodiaAiStageUseCase,
      { execute: vi.fn(async () => { throw new Error('synthetic recovery outage'); }) } as unknown as RecoverNodiaAiJobsUseCase,
      maintenance,
      f.policy,
      idleExecutionPorts()[0],
      recoverExecutions as unknown as RecoverNodiaAiExecutionsUseCase,
      operations,
    );
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(recoverExecutions.execute).toHaveBeenCalledOnce();
    expect(maintenance.execute).toHaveBeenCalledOnce();
    expect(operations.execute).toHaveBeenCalledOnce();
    await worker.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps foreground consumers alive when the observation dependency fails', async () => {
    const f = runtimeFixture();
    const stage = { execute: vi.fn(async () => false) };
    const operations = { execute: vi.fn(async () => { throw Error('synthetic observation outage'); }) };
    const worker = new RunNodiaAiWorkerUseCase(
      stage as unknown as RunNodiaAiStageUseCase,
      { execute: vi.fn(async () => 0) } as unknown as RecoverNodiaAiJobsUseCase,
      { execute: vi.fn(async () => 0) },
      f.policy,
      ...idleExecutionPorts(),
      operations,
    );
    worker.start();
    await vi.advanceTimersByTimeAsync(f.policy.timing.heartbeat_seconds * 1000);
    expect(stage.execute.mock.calls.length).toBeGreaterThan(f.policy.queue.foreground_workers);
    await worker.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('alternates execution and turn priority per consumer while maintaining both journals', async () => {
    const f = runtimeFixture(),
      calls: { worker: string; kind: string }[] = [];
    const stage = {
      execute: vi.fn(async (worker: string) => {
        calls.push({ worker, kind: 'turn' });
        return false;
      }),
    };
    const execution = {
      execute: vi.fn(async (worker: string) => {
        calls.push({ worker, kind: 'execution' });
        return false;
      }),
    };
    const recover = { execute: vi.fn(async () => 0) },
      recoverExecutions = { execute: vi.fn(async () => 0) },
      maintenance = { execute: vi.fn(async () => 0) };
    const worker = new RunNodiaAiWorkerUseCase(
      stage as unknown as RunNodiaAiStageUseCase,
      recover as unknown as RecoverNodiaAiJobsUseCase,
      maintenance,
      f.policy,
      execution as unknown as RunNodiaAiExecutionUseCase,
      recoverExecutions as unknown as RecoverNodiaAiExecutionsUseCase,
      { execute: vi.fn(async () => undefined) },
    );
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(f.policy.timing.heartbeat_seconds * 1000);
    for (const id of new Set(calls.map((c) => c.worker)))
      expect(calls.filter((c) => c.worker === id).map((c) => c.kind)).toEqual([
        'execution',
        'turn',
        'turn',
        'execution',
      ]);
    expect(recoverExecutions.execute).toHaveBeenCalledTimes(2);
    await worker.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('runs separate bounded foreground consumers and maintenance without duplicate starts', async () => {
    const f = runtimeFixture();
    const stage = { execute: vi.fn(async () => false) },
      recover = { execute: vi.fn(async () => 0) },
      maintenance = { execute: vi.fn(async () => 0) };
    const worker = new RunNodiaAiWorkerUseCase(
      stage as unknown as RunNodiaAiStageUseCase,
      recover as unknown as RecoverNodiaAiJobsUseCase,
      maintenance,
      f.policy,
      ...idleExecutionPorts(),
      { execute: vi.fn(async () => undefined) },
    );
    worker.start();
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(stage.execute).toHaveBeenCalledTimes(
      f.policy.queue.foreground_workers,
    );
    expect(maintenance.execute).toHaveBeenCalledTimes(1);
    await worker.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('stops claiming on drain, permits active work to finish, then closes idle loops', async () => {
    const f = runtimeFixture();
    const finish: (() => void)[] = [];
    const stage = {
      execute: vi.fn(
        async () =>
          new Promise<boolean>((resolve) => {
            finish.push(() => resolve(true));
          }),
      ),
    };
    const recover = { execute: vi.fn(async () => 0) },
      maintenance = { execute: vi.fn(async () => 0) };
    const worker = new RunNodiaAiWorkerUseCase(
      stage as unknown as RunNodiaAiStageUseCase,
      recover as unknown as RecoverNodiaAiJobsUseCase,
      maintenance,
      f.policy,
      ...idleExecutionPorts(),
      { execute: vi.fn(async () => undefined) },
    );
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    const stopped = worker.stop();
    finish.forEach((done) => done());
    await stopped;
    expect(stage.execute).toHaveBeenCalledTimes(
      f.policy.queue.foreground_workers,
    );
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts uncompleted work only after its bounded graceful drain window', async () => {
    const f = runtimeFixture();
    const signals: AbortSignal[] = [];
    const stage = {
      execute: vi.fn(async (_id: string, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<boolean>((resolve) =>
          signal.addEventListener('abort', () => resolve(true), { once: true }),
        );
      }),
    };
    const recover = { execute: vi.fn(async () => 0) },
      maintenance = { execute: vi.fn(async () => 0) };
    const worker = new RunNodiaAiWorkerUseCase(
      stage as unknown as RunNodiaAiStageUseCase,
      recover as unknown as RecoverNodiaAiJobsUseCase,
      maintenance,
      f.policy,
      ...idleExecutionPorts(),
      { execute: vi.fn(async () => undefined) },
    );
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    const stopped = worker.stop();
    await vi.advanceTimersByTimeAsync(
      (f.policy.timing.drain_seconds -
        f.policy.timing.cancellation_seconds -
        f.policy.timing.flush_seconds) *
        1000 -
        1,
    );
    expect(signals.every((signal) => !signal.aborted)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await stopped;
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([false, true])('drains the real stage lifecycle within150s with provider armed=%s', async (armed) => {
    vi.setSystemTime(new Date('2026-10-15T18:00:00Z'));
    const f = runtimeFixture();
    const claim = { execute: vi.fn().mockResolvedValueOnce(f.leased()).mockResolvedValue(null) };
    const checkpoint = {
      heartbeat: vi.fn(async () => undefined),
      armDispatch: vi.fn(async () => undefined),
      execute: vi.fn(),
      finish: vi.fn<CheckpointNodiaAiJobUseCase['finish']>().mockResolvedValue(undefined),
    };
    const handler = { catalogVersions: ['fixture-release'], execute: vi.fn(async (_claim: NodiaAiClaim, context: NodiaAiStageContext) => {
      if (armed) {
        await new Promise((resolve) => setTimeout(resolve, 15000));
        await context.armDispatch();
      }
      return new Promise<never>(() => undefined);
    }) };
    const retry = { execute: vi.fn(async () => false) };
    const stage = new RunNodiaAiStageUseCase(
      claim as unknown as ClaimNodiaAiJobUseCase,
      checkpoint as unknown as CheckpointNodiaAiJobUseCase,
      retry as unknown as RetryNodiaAiJobUseCase,
      handler,
      f.policy,
    );
    const worker = new RunNodiaAiWorkerUseCase(
      stage,
      { execute: vi.fn(async () => 0) } as unknown as RecoverNodiaAiJobsUseCase,
      { execute: vi.fn(async () => 0) },
      f.policy,
      ...idleExecutionPorts(),
      { execute: vi.fn(async () => undefined) },
    );
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    const claimsAtStop = claim.execute.mock.calls.length;
    const stopped = worker.stop();
    await vi.advanceTimersByTimeAsync(150000);
    await stopped;
    expect(checkpoint.finish.mock.calls[0]?.[1].status).toBe(armed ? 'unknown' : 'failed');
    expect(checkpoint.finish).toHaveBeenCalledOnce();
    expect(handler.execute).toHaveBeenCalledOnce();
    expect(claim.execute).toHaveBeenCalledTimes(claimsAtStop);
    expect(retry.execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
