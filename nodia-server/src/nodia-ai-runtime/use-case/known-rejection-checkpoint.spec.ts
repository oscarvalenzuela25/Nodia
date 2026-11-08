import { describe, expect, it, vi } from 'vitest';
import { runtimeFixture } from './runtime.fixture.js';
import { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import { nativeDispatchRejection } from '../types/native-dispatch-rejection.js';
import { runtimeProofDescriptor } from './runtime-reconciliation-descriptor.js';
import { ReleaseNodiaAiRuntimeSlotUseCase } from './release-nodia-ai-runtime-slot.use-case.js';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner.js';

function setup() {
  const f = runtimeFixture(), claim = f.leased();
  claim.run.selection_snapshot.mode = 'agentic';
  claim.run.context_manifest.configuration_generation = 'd'.repeat(64);
  f.attempt.phase = 'dispatch_armed'; f.attempt.runtime_fence = '1';
  const request = { engine: 'agentic' as const, attemptId: claim.attempt.id, operationRef: claim.attempt.id,
    resourceKey: 'gemini-profile:' + 'b'.repeat(64), sessionGeneration: 'c'.repeat(32) };
  f.job.recovery_descriptor = runtimeProofDescriptor(request);
  const payload = { attempt_id: request.attemptId, resource_key: request.resourceKey,
    session_generation: request.sessionGeneration, configuration_generation: 'd'.repeat(64) };
  const body = { code: 'runtime_busy', detail: 'synthetic', request_id: 'e'.repeat(32) };
  const proof = nativeDispatchRejection({ route: '/nodia-ai/agentic/mcp/start', payload,
    requestBytes: JSON.stringify(payload), responseBytes: Buffer.from(JSON.stringify(body)), body, status: 409,
    requestIdHeader: body.request_id, contentType: 'application/json', redirected: false })!;
  const query = f.query.getMockImplementation()!;
  f.query.mockImplementation(async (sql, args) => {
    if (sql.includes('RETURNING resource_key')) return [{ resource_key: request.resourceKey }];
    return query(sql, args);
  });
  const checkpoint = new CheckpointNodiaAiJobUseCase(f.runtimePort, f.authorization, f.policy);
  return { ...f, claim, proof, checkpoint };
}
describe('known rejection checkpoint', () => {
  it('consumes the real TypeORM SELECT result contract instead of the UPDATE tuple', async () => {
    const wire = {command:'SELECT',rows:[{resource_key:'fixture'}],rowCount:1};
    const runner = {isReleased:false,connect:async()=>({query:async()=>wire}),
      driver:{options:{},dataSource:{logger:{logQuery(){}}}},
      broadcaster:{broadcast:async()=>undefined,broadcastAfterQueryEvent(){}}} as unknown as PostgresQueryRunner;
    expect(await PostgresQueryRunner.prototype.query.call(runner,'synthetic',[])).toEqual([{resource_key:'fixture'}]);
    wire.command='UPDATE';
    expect(await PostgresQueryRunner.prototype.query.call(runner,'synthetic',[])).toEqual([[{resource_key:'fixture'}],1]);
    const f=setup();
    await f.checkpoint.finish(f.claim,{status:'failed',errorCode:'nodia_ai:runtime_busy',rejectionProof:f.proof});
    const release=f.query.mock.calls.find(([sql])=>sql.includes('RETURNING resource_key'))!;
    expect(release[0]).toMatch(/^WITH changed AS \(UPDATE /u);
    expect(release[0]).toMatch(/\) SELECT resource_key FROM changed$/u);
  });
  it('rejects a business persistence callback or misleading error attached to a rejection', async () => {
    for (const errorCode of ['nodia_ai:runtime_busy', 'nodia_ai:stage_failed']) {
      const f = setup(), persist = vi.fn(async () => undefined);
      await expect(f.checkpoint.finish(f.claim, {status:'failed',errorCode,rejectionProof:f.proof,
        ...(errorCode === 'nodia_ai:runtime_busy' ? {persist} : {})})).rejects.toThrow('invalid_dispatch_rejection');
      expect(persist).not.toHaveBeenCalled();
      expect(f.query.mock.calls.some(([sql]) => sql.includes('RETURNING resource_key'))).toBe(false);
    }
  });
  it('accepts the same evidence through the release port without requiring a native terminal', async () => {
    const f = setup(), query = f.query.getMockImplementation()!;
    f.query.mockImplementation((sql,args) => sql === 'SELECT recovery_descriptor FROM nodia_ai_jobs WHERE id=$1'
      ? Promise.resolve([{recovery_descriptor:f.job.recovery_descriptor}]) : query(sql,args));
    await new ReleaseNodiaAiRuntimeSlotUseCase(f.checkpoint).execute(f.claim,
      {resourceKey:f.proof.resourceKey,fence:'1',operationRef:f.claim.attempt.id},f.proof);
    expect(f.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO nodia_ai_jobs'))).toBe(false);
  });
  it('fails the armed run, frees only the fenced slot and persists rejection, with no ACK job or budget refund', async () => {
    const f = setup();
    await f.checkpoint.finish(f.claim, { status: 'failed', errorCode: 'nodia_ai:runtime_busy', rejectionProof: f.proof });
    expect(f.run.state).toBe('failed');
    const calls = f.query.mock.calls;
    expect(calls.some(([sql]) => sql.includes('RETURNING resource_key') && sql.includes('fence=fence+1'))).toBe(true);
    expect(calls.some(([sql, args]) => sql.includes('recovery_descriptor=') && String(args?.[1]).includes('native_dispatch_rejected'))).toBe(true);
    expect(calls.some(([sql]) => sql.includes('INSERT INTO nodia_ai_jobs') || sql.includes('provider_dispatches_used='))).toBe(false);
  });
  it.each(['foreign_identity', 'forged', 'configuration', 'slot_fence'])('refuses %s before releasing/committing known failure', async change => {
    const f = setup();
    if (change === 'foreign_identity') f.job.recovery_descriptor!.runtime = { engine:'agentic',attempt_id:f.claim.attempt.id,
      operation_ref:f.claim.attempt.id, resource_key:'gemini-profile:'+'f'.repeat(64),session_generation:'c'.repeat(32) };
    if (change === 'configuration') f.claim.run.context_manifest.configuration_generation = 'f'.repeat(64);
    if (change === 'slot_fence') {
      const query = f.query.getMockImplementation()!;
      f.query.mockImplementation((sql, args) => sql.includes('RETURNING resource_key') ? Promise.resolve([]) : query(sql, args));
    }
    await expect(f.checkpoint.finish(f.claim, {status:'failed',errorCode:'nodia_ai:runtime_busy',
      rejectionProof: change === 'forged' ? {...f.proof} : f.proof})).rejects.toThrow();
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE nodia_ai_runs SET state='))).toBe(false);
  });
});
