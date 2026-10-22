import { describe, expect, it, vi } from 'vitest';
import { ReconcileNodiaAiRuntimeUseCase } from './reconcile-nodia-ai-runtime.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';
import { runtimeProofDescriptor } from './runtime-reconciliation-descriptor.js';
import type { NodiaAiRuntimeReconciliationPort } from '../types/reconciliation.types.js';
import type { CleanupNodiaAiRuntimeProofsUseCase } from './cleanup-nodia-ai-runtime-proofs.use-case.js';
import type { NodiaAiRuntimeService } from '../nodia-ai-runtime.service.js';

function setup() {
  const f = runtimeFixture();
  f.job.state = 'unknown';
  const request = {
    engine: 'web' as const,
    attemptId: f.attempt.id,
    operationRef: f.attempt.id,
    resourceKey: 'gemini-profile:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
  };
  f.job.recovery_descriptor = runtimeProofDescriptor(request);
  f.attempt.runtime_resource_key = request.resourceKey;
  f.attempt.external_operation_ref = request.operationRef;
  const runtime = {
    ...f.runtime,
    findJob: vi.fn(async () => f.job),
    findSlot: vi.fn(async () => ({
      resource_key: request.resourceKey,
      state: 'unknown',
      fence: '1',
      external_operation_ref: request.operationRef,
    })),
  };
  const proof = {
    ...request,
    terminalProofId: '9196c349-9333-456c-99ea-3fd2a1c58325',
    processClosed: true as const,
    outcome: 'completed' as const,
    observedAt: f.now,
  };
  const native = {
    reconcile: vi.fn<NodiaAiRuntimeReconciliationPort['reconcile']>(
      async () => proof,
    ),
    acknowledge: vi.fn<NodiaAiRuntimeReconciliationPort['acknowledge']>(
      async () => undefined,
    ),
  };
  const cleanup = {
    execute: vi.fn<CleanupNodiaAiRuntimeProofsUseCase['execute']>(async () => ({
      processed: 1,
      settled: 1,
    })),
  };
  const usecase = new ReconcileNodiaAiRuntimeUseCase(
    runtime as unknown as NodiaAiRuntimeService,
    f.authorization,
    native,
    cleanup as unknown as CleanupNodiaAiRuntimeProofsUseCase,
    f.policy,
  );
  function admin() {
    f.authorize.execute.mockResolvedValue({
      actorId: '1',
      sessionId: f.grant.session_public_id!,
      isSuperAdmin: true,
      modules: [],
    });
  }
  return { ...f, runtime, request, proof, native, cleanup, usecase, admin };
}
describe('ReconcileNodiaAiRuntimeUseCase', () => {
  it('publishes the reconciled terminal revision only after the matching native proof and current operator authority', async () => {
    const f = setup();
    f.admin();
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args) => {
      if (sql.startsWith('SELECT fence::text,state,external_operation_ref'))
        return [
          {
            fence: '1',
            state: 'unknown',
            external_operation_ref: f.request.operationRef,
          },
        ];
      return original(sql, args);
    });
    await f.usecase.execute(
      { userId: '1', sessionId: f.grant.session_public_id! },
      f.job.id,
    );
    expect(f.native.reconcile).toHaveBeenCalledOnce();
    expect(f.cleanup.execute).toHaveBeenCalledWith(f.job.id);
    expect(f.journal.events).toHaveLength(1);
    expect(f.journal.events[0].public_payload).toMatchObject({
      kind: 'run_changed',
      payload: {
        revision: 2,
        state: 'failed',
        error: { code: 'nodia_ai:response_unavailable', retry_action: 'none' },
      },
    });
  });
  it('requires current administrator authority before reading an uncertain operation', async () => {
    const f = setup();
    await expect(
      f.usecase.execute(
        { userId: '1', sessionId: f.grant.session_public_id! },
        f.job.id,
      ),
    ).rejects.toThrow('super_admin_required');
    expect(f.native.reconcile).not.toHaveBeenCalled();
    expect(f.runtime.findJob).not.toHaveBeenCalled();
  });
  it('does not manufacture an identity for a historical unknown attempt', async () => {
    const f = setup();
    f.admin();
    f.job.recovery_descriptor = null;
    await expect(
      f.usecase.execute(
        { userId: '1', sessionId: f.grant.session_public_id! },
        f.job.id,
      ),
    ).rejects.toThrow('identity_missing');
    expect(f.native.reconcile).not.toHaveBeenCalled();
  });
  it('does not reconcile active, completed or ordinary ready generation work', async () => {
    const f = setup();
    f.admin();
    f.job.state = 'leased';
    await expect(
      f.usecase.execute(
        { userId: '1', sessionId: f.grant.session_public_id! },
        f.job.id,
      ),
    ).rejects.toThrow('not_pending');
    expect(f.native.reconcile).not.toHaveBeenCalled();
  });
  it.each([
    'attemptId',
    'resourceKey',
    'sessionGeneration',
    'operationRef',
    'terminalProofId',
  ])('rejects a mismatched terminal proof field %s', async (field) => {
    const f = setup();
    f.admin();
    f.native.reconcile.mockResolvedValueOnce({
      ...f.proof,
      [field]: 'mismatch',
    });
    await expect(
      f.usecase.execute(
        { userId: '1', sessionId: f.grant.session_public_id! },
        f.job.id,
      ),
    ).rejects.toThrow('invalid_terminal_proof');
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes("runtime_slots SET state='free'"),
      ),
    ).toBe(false);
  });
  it('revalidates administrator authority after waiting for native proof', async () => {
    const f = setup();
    f.admin();
    f.native.reconcile.mockImplementationOnce(async () => {
      f.authorize.execute.mockRejectedValueOnce(Error('revoked'));
      return f.proof;
    });
    await expect(
      f.usecase.execute(
        { userId: '1', sessionId: f.grant.session_public_id! },
        f.job.id,
      ),
    ).rejects.toThrow('revoked');
    expect(f.cleanup.execute).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes("runtime_slots SET state='free'"),
      ),
    ).toBe(false);
  });
  it('an authenticated operator can retry only the frozen cleanup without requesting another generation proof', async () => {
    const f = setup();
    f.admin();
    f.job.kind = 'reconcile';
    f.job.stage_key = 'reconcile_ack';
    f.job.state = 'failed';
    expect(
      await f.usecase.execute(
        { userId: '1', sessionId: f.grant.session_public_id! },
        f.job.id,
      ),
    ).toEqual({ job_id: f.job.id, resolved: true, cleanup_pending: false });
    expect(f.native.reconcile).not.toHaveBeenCalled();
    expect(f.cleanup.execute).toHaveBeenCalledWith(f.job.id, true);
  });
});
