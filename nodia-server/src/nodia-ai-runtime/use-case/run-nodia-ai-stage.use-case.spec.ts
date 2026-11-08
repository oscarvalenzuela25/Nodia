import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { RunNodiaAiStageUseCase } from './run-nodia-ai-stage.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';
import {
  NodiaAiKnownPreDispatchError,
  type NodiaAiStageHandler,
  type NodiaAiStageContext,
  type NodiaAiStageOutcome,
} from '../types/worker.types.js';
import type { ClaimNodiaAiJobUseCase } from './claim-nodia-ai-job.use-case.js';
import type { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import type { RetryNodiaAiJobUseCase } from './retry-nodia-ai-job.use-case.js';
import type { NodiaAiRuntimeTerminalProof } from '../types/reconciliation.types.js';

function setup(execute: NodiaAiStageHandler['execute']) {
  const f = runtimeFixture(),
    current = f.leased();
  const claim = { execute: vi.fn(async () => current) };
  const checkpoint = {
    heartbeat: vi.fn(async () => undefined),
    armDispatch: vi.fn<CheckpointNodiaAiJobUseCase['armDispatch']>().mockResolvedValue(undefined),
    execute: vi.fn(async (_claim, work) => work(f.manager)),
    finish: vi
      .fn<CheckpointNodiaAiJobUseCase['finish']>()
      .mockResolvedValue(undefined),
  };
  const retry = { execute: vi.fn(async () => false) };
  const handler = {
    catalogVersions: ['fixture-release'],
    execute: vi.fn(execute),
  };
  const usecase = new RunNodiaAiStageUseCase(
    claim as unknown as ClaimNodiaAiJobUseCase,
    checkpoint as unknown as CheckpointNodiaAiJobUseCase,
    retry as unknown as RetryNodiaAiJobUseCase,
    handler,
    f.policy,
  );
  return { ...f, current, claim, checkpoint, retry, handler, usecase };
}
describe('RunNodiaAiStageUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T18:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('does not claim new work once shutdown has been requested', async () => {
    const f = setup(async () => ({ status: 'completed' }));
    const abort = new AbortController();
    abort.abort();
    expect(await f.usecase.execute(f.workerId, abort.signal)).toBe(false);
    expect(f.claim.execute).not.toHaveBeenCalled();
  });
  it('records completion and clears lifecycle timers after a known result', async () => {
    const f = setup(async () => ({ status: 'completed' }));
    expect(
      await f.usecase.execute(f.workerId, new AbortController().signal),
    ).toBe(true);
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
      status: 'completed',
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['preferences_changed', 'routing_disabled'] as const)('keeps rejected transactional %s validation a known failure without sending', async (reason) => {
    const errorCode = `nodia_ai:${reason}`;
    const f = setup(async (_claim, context) => {
      await context.armDispatch(undefined, undefined, async () => {
        throw new NodiaAiKnownPreDispatchError(errorCode);
      });
      throw new Error('must not dispatch after rejected context');
    });
    f.checkpoint.armDispatch.mockImplementation(async (_claim, _selection, _runtime, validate) => {
      await validate?.(f.manager);
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, { status: 'failed', errorCode });
    expect(f.retry.execute).not.toHaveBeenCalled();
  });
  it('treats a lost response after durable arming as unknown without replay', async () => {
    const f = setup(async (_claim, context) => {
      await context.armDispatch();
      throw Error('transport');
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
      status: 'unknown',
      errorCode: 'nodia_ai:outcome_unknown',
    });
    expect(f.retry.execute).not.toHaveBeenCalled();
    expect(f.handler.execute).toHaveBeenCalledTimes(1);
  });
  it.each(['execution_limit', 'invalid_selection'] as const)(
    'finishes a proven local %s rejection without dispatch or retry',
    async (reason) => {
      const send = vi.fn();
      const error = new NodiaAiKnownPreDispatchError(`nodia_ai:${reason}`);
      const f = setup(async (_claim, context) => {
        await context.armDispatch();
        send();
        return { status: 'completed' };
      });
      f.checkpoint.armDispatch.mockImplementation(async (_claim, _selection, _runtime, _validate, reject) => {
        reject?.(error);
        throw error;
      });
      await f.usecase.execute(f.workerId, new AbortController().signal);
      expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
        status: 'failed', errorCode: error.errorCode,
      });
      expect(send).not.toHaveBeenCalled();
      expect(f.retry.execute).not.toHaveBeenCalled();
    },
  );
  it('keeps a replaced transaction response unknown despite a prior local rejection marker', async () => {
    const f = setup(async (_claim, context) => {
      await context.armDispatch();
      return { status: 'completed' };
    });
    f.checkpoint.armDispatch.mockImplementation(async (_claim, _selection, _runtime, _validate, reject) => {
      reject?.(new NodiaAiKnownPreDispatchError('nodia_ai:execution_limit'));
      // Same type and code are insufficient: this is a different transaction response.
      throw new NodiaAiKnownPreDispatchError('nodia_ai:execution_limit');
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
      status: 'unknown', errorCode: 'nodia_ai:outcome_unknown',
    });
    expect(f.retry.execute).not.toHaveBeenCalled();
  });
  it('does not erase an earlier dispatch when a later arming is locally rejected', async () => {
    const f = setup(async (_claim, context) => {
      await context.armDispatch();
      await context.armDispatch();
      return { status: 'completed' };
    });
    f.checkpoint.armDispatch.mockResolvedValueOnce(undefined).mockImplementationOnce(async (_claim, _selection, _runtime, _validate, reject) => {
      const error = new NodiaAiKnownPreDispatchError('nodia_ai:execution_limit');
      reject?.(error);
      throw error;
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
      status: 'unknown', errorCode: 'nodia_ai:outcome_unknown',
    });
    expect(f.retry.execute).not.toHaveBeenCalled();
  });
  it.each(['cancellation', 'deadline'] as const)(
    'keeps pending SQL arming unknown on %s and prevents a late provider dispatch',
    async (reason) => {
      const send = vi.fn();
      let resolveArming: (() => void) | undefined;
      const f = setup(async (_claim, context) => {
        await context.armDispatch();
        send();
        return { status: 'completed' };
      });
      f.checkpoint.armDispatch.mockImplementation(
        async () => new Promise<void>((resolve) => { resolveArming = resolve; }),
      );
      const abort = new AbortController();
      const work = f.usecase.execute(f.workerId, abort.signal);
      await vi.advanceTimersByTimeAsync(0);
      if (reason === 'cancellation') abort.abort();
      else await vi.advanceTimersByTimeAsync(f.policy.timing.provider_dispatch_seconds * 1000);
      await work;
      expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
        status: 'unknown', errorCode: 'nodia_ai:outcome_unknown',
      });
      resolveArming!();
      await vi.advanceTimersByTimeAsync(0);
      expect(send).not.toHaveBeenCalled();
      expect(f.checkpoint.finish).toHaveBeenCalledTimes(1);
      expect(f.retry.execute).not.toHaveBeenCalled();
    },
  );
  it.each([
    new Error('SQL commit response lost'),
    new NodiaAiKnownPreDispatchError('nodia_ai:runtime_busy', true),
  ])('does not infer a validation rollback from an unproven arming rejection: %s', async (error) => {
    const send = vi.fn();
    const f = setup(async (_claim, context) => {
      await context.armDispatch();
      send();
      return { status: 'completed' };
    });
    f.checkpoint.armDispatch.mockRejectedValueOnce(error);
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
      status: 'unknown', errorCode: 'nodia_ai:outcome_unknown',
    });
    expect(send).not.toHaveBeenCalled();
    expect(f.retry.execute).not.toHaveBeenCalled();
  });
  it.each<[{ error: unknown; type: string; code: string | null; sql: string | null }]>([
    [{
      error: new Error('nodia_ai:invalid_tool_input'),
      type: 'Error',
      code: 'nodia_ai:invalid_tool_input',
      sql: null,
    }],
    [{
      error: new QueryFailedError(
        'SELECT synthetic_secret',
        ['synthetic_secret'],
        Object.assign(new Error('synthetic_secret'), { code: '22P02' }),
      ),
      type: 'QueryFailedError',
      code: null,
      sql: '22P02',
    }],
    [{
      error: {
        constructor: { name: 'synthetic_secret' },
        message: 'synthetic_secret',
        driverError: undefined,
      },
      type: 'Other',
      code: null,
      sql: null,
    }],
    [{
      error: { driverError: { code: 'synthetic_secret' } },
      type: 'Other',
      code: null,
      sql: null,
    }],
  ])(
    'logs only closed failure categories and retains unknown without replay (case %#)',
    async ({ error, type, code, sql }) => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const f = setup(async (_claim, context) => {
        await context.armDispatch();
        throw error;
      });
      await f.usecase.execute(f.workerId, new AbortController().signal);
      expect(warn.mock.calls[0]?.[0]).toMatch(
        /^nodia_ai_stage_execution_failed /,
      );
      expect(
        JSON.parse(
          String(warn.mock.calls[0]?.[0]).split(
            'nodia_ai_stage_execution_failed ',
          )[1],
        ),
      ).toEqual({
        phase: 'handler',
        dispatched: true,
        signal_aborted: false,
        lost_lease: false,
        error_type: type,
        error_code: code,
        sql_state: sql,
      });
      expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic_secret');
      expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
        status: 'unknown',
        errorCode: 'nodia_ai:outcome_unknown',
      });
      expect(f.retry.execute).not.toHaveBeenCalled();
      expect(f.handler.execute).toHaveBeenCalledOnce();
    },
  );
  it('ignores logging failure and hostile getters without changing unknown recovery', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      throw Error('synthetic_secret');
    });
    const failure = Object.defineProperty({}, 'constructor', {
      get: () => {
        throw Error('synthetic_secret');
      },
    });
    const f = setup(async (_claim, context) => {
      await context.armDispatch();
      throw failure;
    });
    expect(
      await f.usecase.execute(f.workerId, new AbortController().signal),
    ).toBe(true);
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
      status: 'unknown',
      errorCode: 'nodia_ai:outcome_unknown',
    });
    expect(f.retry.execute).not.toHaveBeenCalled();
  });
  it('does not let a handler classify armed work as a known failure', async () => {
    const f = setup(async (_claim, context) => {
      await context.armDispatch();
      return { status: 'failed', errorCode: 'nodia_ai:provider_unavailable' };
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.checkpoint.finish.mock.calls[0]?.[1]).toEqual({
      status: 'unknown',
      errorCode: 'nodia_ai:outcome_unknown',
    });
  });
  it('forwards a private completion proof on a known local extraction failure without retrying the model', async () => {
    const proof: NodiaAiRuntimeTerminalProof = {
      engine: 'agentic', attemptId: '8e687984-ebbd-46cd-977c-279207164d69',
      operationRef: '8e687984-ebbd-46cd-977c-279207164d69',
      resourceKey: 'gemini-profile:' + 'a'.repeat(64), sessionGeneration: 'b'.repeat(32),
      terminalProofId: '236d31be-2cd0-4925-977f-8930be2896c2',
      processClosed: true, outcome: 'completed', observedAt: new Date(),
    };
    const persist = vi.fn();
    const outcome: NodiaAiStageOutcome = { status: 'failed', errorCode: 'nodia_ai:compaction_invalid', terminalProof: proof, persist };
    const f = setup(async (_claim, context) => { await context.armDispatch(); return outcome; });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, outcome);
    expect(f.retry.execute).not.toHaveBeenCalled();
    expect(f.handler.execute).toHaveBeenCalledOnce();
  });
  it('retries only a typed provably pre-dispatch failure', async () => {
    const f = setup(async () => {
      throw new NodiaAiKnownPreDispatchError('nodia_ai:runtime_busy', true);
    });
    f.retry.execute.mockResolvedValueOnce(true);
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.retry.execute).toHaveBeenCalledTimes(1);
    expect(f.checkpoint.finish).not.toHaveBeenCalled();
  });
  it('hands a classified observation timeout to durable retry without arming or finishing', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const f = setup(async () => {
      throw new NodiaAiKnownPreDispatchError('nodia_ai:agentic_observation_timeout', true);
    });
    f.retry.execute.mockResolvedValueOnce(true);
    const before = structuredClone(f.current);
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.retry.execute).toHaveBeenCalledExactlyOnceWith(f.current, 'nodia_ai:agentic_observation_timeout');
    expect(f.checkpoint.armDispatch).not.toHaveBeenCalled();
    expect(f.checkpoint.finish).not.toHaveBeenCalled();
    expect(f.current).toEqual(before);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]).split('nodia_ai_stage_execution_failed ')[1]))
      .toMatchObject({ dispatched: false, error_type: 'NodiaAiKnownPreDispatchError',
        error_code: 'nodia_ai:agentic_observation_timeout', sql_state: null });
  });
  it('does not retry a classified observation error after dispatch was armed', async () => {
    const f = setup(async (_claim, context) => {
      await context.armDispatch();
      throw new NodiaAiKnownPreDispatchError('nodia_ai:agentic_observation_timeout', true);
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.retry.execute).not.toHaveBeenCalled();
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
      status: 'unknown', errorCode: 'nodia_ai:outcome_unknown',
    });
    expect(f.handler.execute).toHaveBeenCalledOnce();
  });
  it('preserves the precise known timeout once durable retries are exhausted without dispatch', async () => {
    const f = setup(async () => {
      throw new NodiaAiKnownPreDispatchError('nodia_ai:agentic_observation_timeout', true);
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.retry.execute).toHaveBeenCalledExactlyOnceWith(f.current, 'nodia_ai:agentic_observation_timeout');
    expect(f.checkpoint.armDispatch).not.toHaveBeenCalled();
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, {
      status: 'failed', errorCode: 'nodia_ai:agentic_observation_timeout',
    });
    expect(f.handler.execute).toHaveBeenCalledOnce();
  });
  it('does not retry the same typed failure once dispatch was armed', async () => {
    const f = setup(async (_claim, context) => {
      await context.armDispatch();
      throw new NodiaAiKnownPreDispatchError('nodia_ai:runtime_busy', true);
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.retry.execute).not.toHaveBeenCalled();
    expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe('unknown');
  });
  it('cleans timers and persists a safe failure for a synchronous handler exception', async () => {
    const f = setup(() => {
      throw Error('sync');
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(f.checkpoint.finish.mock.calls[0]?.[1]).toEqual({
      status: 'failed',
      errorCode: 'nodia_ai:stage_failed',
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('stops local checkpoints after cancellation even if a remote adapter settles late', async () => {
    let context: NodiaAiStageContext | undefined;
    let resolve: ((outcome: NodiaAiStageOutcome) => void) | undefined;
    const f = setup(async (_claim, ctx) => {
      context = ctx;
      await ctx.armDispatch();
      return new Promise((done) => {
        resolve = done;
      });
    });
    const abort = new AbortController();
    const work = f.usecase.execute(f.workerId, abort.signal);
    await vi.advanceTimersByTimeAsync(0);
    abort.abort();
    await work;
    await expect(context!.checkpoint(async () => 42)).rejects.toThrow(
      'lease_lost',
    );
    resolve?.({ status: 'completed' });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.checkpoint.finish).toHaveBeenCalledTimes(1);
    expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe('unknown');
  });
  it('losing heartbeat authority aborts the adapter and leaves recovery in charge', async () => {
    const f = setup(async () => new Promise(() => undefined));
    f.checkpoint.heartbeat.mockRejectedValueOnce(Error('revoked'));
    const work = f.usecase.execute(f.workerId, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(f.policy.timing.heartbeat_seconds * 1000);
    await work;
    expect(f.checkpoint.finish).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds uncooperative remote work by the provider dispatch deadline', async () => {
    const f = setup(async (_claim, context) => {
      await context.armDispatch();
      return new Promise(() => undefined);
    });
    const work = f.usecase.execute(f.workerId, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(
      f.policy.timing.provider_dispatch_seconds * 1000,
    );
    await work;
    expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe('unknown');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('gives the provider its own window after bounded preparation and the arming commit', async () => {
    const base = Date.now();
    let deadline: Date | undefined;
    const f = setup(async (_claim, context) => {
      await new Promise((resolve) => setTimeout(resolve, 15000));
      deadline = await context.armDispatch();
      await new Promise((resolve) => setTimeout(resolve, 115000));
      return { status: 'completed' };
    });
    f.checkpoint.armDispatch.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });
    const work = f.usecase.execute(f.workerId, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(120000);
    expect(f.checkpoint.finish).not.toHaveBeenCalled();
    expect(deadline?.getTime()).toBe(base + 137000);
    await vi.advanceTimersByTimeAsync(12000);
    await work;
    expect(f.checkpoint.finish).toHaveBeenCalledWith(f.current, { status: 'completed' });
    expect(f.handler.execute).toHaveBeenCalledOnce();
    expect(f.retry.execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps preparation without dispatch bounded to its existing window', async () => {
    const f = setup(async () => new Promise(() => undefined));
    const work = f.usecase.execute(f.workerId, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(120000);
    await work;
    expect(f.checkpoint.armDispatch).not.toHaveBeenCalled();
    expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe('failed');
    expect(f.retry.execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps delayed preparation and an unresolved arming commit unknown without a late send', async () => {
    const send = vi.fn();
    let commit: (() => void) | undefined;
    const f = setup(async (_claim, context) => {
      await new Promise((resolve) => setTimeout(resolve, 15000));
      await context.armDispatch();
      send();
      return { status: 'completed' };
    });
    f.checkpoint.armDispatch.mockImplementation(async () => new Promise<void>((resolve) => { commit = resolve; }));
    const work = f.usecase.execute(f.workerId, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(120000);
    await work;
    expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe('unknown');
    commit!();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).not.toHaveBeenCalled();
    expect(f.checkpoint.finish).toHaveBeenCalledOnce();
    expect(f.retry.execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['before_arm', 'after_commit'] as const)('rejects expired preparation %s even before an overdue timer gets its event-loop turn', async (phase) => {
    const send = vi.fn();
    const f = setup(async (_claim, context) => {
      if (phase === 'before_arm') vi.setSystemTime(Date.now() + 121000);
      await context.armDispatch();
      send();
      return { status: 'completed' };
    });
    f.checkpoint.armDispatch.mockImplementation(async () => {
      if (phase === 'after_commit') vi.setSystemTime(Date.now() + 121000);
    });
    await f.usecase.execute(f.workerId, new AbortController().signal);
    expect(send).not.toHaveBeenCalled();
    expect(f.checkpoint.armDispatch).toHaveBeenCalledTimes(phase === 'before_arm' ? 0 : 1);
    expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe(phase === 'before_arm' ? 'failed' : 'unknown');
    expect(f.retry.execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['preparation', 'provider'] as const)('rejects an expired %s checkpoint before and inside SQL while its timer is overdue', async (phase) => {
    for (const boundary of ['before_checkpoint', 'inside_SQL'] as const) {
      vi.setSystemTime(new Date('2026-10-15T18:00:00Z'));
      const write = vi.fn(async () => 42);
      const f = setup(async (_claim, context) => {
        if (phase === 'provider') await context.armDispatch();
        if (boundary === 'before_checkpoint') vi.setSystemTime(Date.now() + 121000);
        await context.checkpoint(write);
        return { status: 'completed' };
      });
      if (boundary === 'inside_SQL') f.checkpoint.execute.mockImplementation(async (_claim, callback) => {
        vi.setSystemTime(Date.now() + 121000);
        return callback(f.manager);
      });
      await f.usecase.execute(f.workerId, new AbortController().signal);
      expect(write).not.toHaveBeenCalled();
      expect(f.checkpoint.execute).toHaveBeenCalledTimes(boundary === 'before_checkpoint' ? 0 : 1);
      expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe(phase === 'provider' ? 'unknown' : 'failed');
      expect(f.retry.execute).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    }
  });
  it('does not renew the provider window if a handler requests a second successful arming', async () => {
    const deadlines: number[] = [];
    const base = Date.now();
    const f = setup(async (_claim, context) => {
      deadlines.push((await context.armDispatch()).getTime());
      await new Promise((resolve) => setTimeout(resolve, 60000));
      deadlines.push((await context.armDispatch()).getTime());
      return new Promise(() => undefined);
    });
    const work = f.usecase.execute(f.workerId, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(120000);
    await work;
    expect(deadlines).toEqual([base + 120000, base + 120000]);
    expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe('unknown');
    expect(f.retry.execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['job', 'run'] as const)('clamps the provider window to the original %s deadline after preparation', async (scope) => {
    const base = Date.now();
    let deadline: Date | undefined;
    const f = setup(async (_claim, context) => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      deadline = await context.armDispatch();
      return new Promise(() => undefined);
    });
    f.current[scope].deadline_at = new Date(base + 25000);
    const work = f.usecase.execute(f.workerId, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(25000);
    await work;
    expect(deadline?.getTime()).toBe(base + 25000);
    expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe('unknown');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not extend the remaining turn when the wall clock moves backwards during preparation', async () => {
    let deadline: Date | undefined;
    const f = setup(async (_claim, context) => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      vi.setSystemTime(Date.now() - 3600000);
      deadline = await context.armDispatch();
      return new Promise(() => undefined);
    });
    const base = Date.now();
    f.current.run.deadline_at = new Date(base + 25000);
    const work = f.usecase.execute(f.workerId, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(10000);
    expect(deadline?.getTime()).toBe(base - 3600000 + 25000);
    await vi.advanceTimersByTimeAsync(15000);
    await work;
    expect(f.checkpoint.finish.mock.calls[0]?.[1].status).toBe('unknown');
    expect(vi.getTimerCount()).toBe(0);
  });
});
