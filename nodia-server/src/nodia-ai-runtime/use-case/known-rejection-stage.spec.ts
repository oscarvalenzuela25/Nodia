import { afterEach, expect, it, vi } from 'vitest';
import type { NodiaAiStageHandler } from '../types/worker.types.js';
import type { ClaimNodiaAiJobUseCase } from './claim-nodia-ai-job.use-case.js';
import type { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import type { RetryNodiaAiJobUseCase } from './retry-nodia-ai-job.use-case.js';
import { RunNodiaAiStageUseCase } from './run-nodia-ai-stage.use-case.js';
import { NodiaAiAdapterError } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { nativeDispatchRejection } from '../types/native-dispatch-rejection.js';
import { runtimeFixture } from './runtime.fixture.js';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it.each(['authenticated', 'unproved', 'unknown'] as const)('preserves %s rejection semantics after SQL arming without retry', async kind => {
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-15T18:00:00Z'));
  const f=runtimeFixture(),current=f.leased();
  const payload={attempt_id:current.attempt.id,resource_key:'gemini-profile:'+'b'.repeat(64),
    session_generation:'c'.repeat(32),configuration_generation:'d'.repeat(64)};
  const body={code:'runtime_busy',detail:'synthetic',request_id:'e'.repeat(32)};
  const rejection=nativeDispatchRejection({route:'/nodia-ai/agentic/mcp/start',payload,requestBytes:JSON.stringify(payload),
    body,responseBytes:Buffer.from(JSON.stringify(body)),status:409,requestIdHeader:body.request_id,contentType:'application/json',redirected:false})!;
  const checkpoint={heartbeat:vi.fn(async()=>undefined),armDispatch:vi.fn(async()=>undefined),
    execute:vi.fn(async(_claim,work)=>work(f.manager)),finish:vi.fn<CheckpointNodiaAiJobUseCase['finish']>().mockResolvedValue(undefined)};
  const retry={execute:vi.fn(async()=>false)};
  const handler:NodiaAiStageHandler={catalogVersions:['fixture-release'],execute:async(_claim,context)=>{
    await context.armDispatch();
    throw new NodiaAiAdapterError('runtime_busy',kind==='unknown'?'unknown':'not_dispatched',kind==='authenticated'?rejection:undefined);
  }};
  const stage=new RunNodiaAiStageUseCase({execute:vi.fn(async()=>current)} as unknown as ClaimNodiaAiJobUseCase,
    checkpoint as unknown as CheckpointNodiaAiJobUseCase,retry as unknown as RetryNodiaAiJobUseCase,handler,f.policy);
  await stage.execute(f.workerId,new AbortController().signal);
  expect(checkpoint.finish).toHaveBeenCalledWith(current,kind==='authenticated'
    ?{status:'failed',errorCode:'nodia_ai:runtime_busy',rejectionProof:rejection}
    :{status:'unknown',errorCode:'nodia_ai:outcome_unknown'});
  expect(retry.execute).not.toHaveBeenCalled();expect(checkpoint.armDispatch).toHaveBeenCalledTimes(1);
});
