import { describe, expect, it, vi } from 'vitest';
import { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';
import { runtimeProofDescriptor } from './runtime-reconciliation-descriptor.js';
import type {
  NodiaAiApiRuntimeTerminalProof,
  NodiaAiRuntimeTerminalProof,
} from '../types/reconciliation.types.js';

function fixture() {
  const f = runtimeFixture(),
    claim = f.leased();
  claim.run.selection_snapshot.mode = 'api_key';
  const identity = {
    providerKey: 'openai' as const,
    contractVersion: 'nodia-ai-api-chat/1' as const,
    connectionId: '1',
  };
  claim.run.context_manifest = {
    session_generation: 'b'.repeat(32),
    adapter_identity: {
      provider_key: identity.providerKey,
      contract_version: identity.contractVersion,
      connection_id: identity.connectionId,
    },
  };
  const reservation = {
    resourceKey: 'api-connection:' + 'a'.repeat(64),
    fence: '1',
    operationRef: claim.attempt.id,
    sessionGeneration: 'b'.repeat(32),
    adapterIdentity: identity,
  };
  const proof: NodiaAiApiRuntimeTerminalProof = {
    engine: 'api_key',
    adapterIdentity: identity,
    attemptId: claim.attempt.id,
    operationRef: claim.attempt.id,
    resourceKey: reservation.resourceKey,
    sessionGeneration: reservation.sessionGeneration,
    terminalProofId: '581a584c-38de-48be-8d09-4eef07390ca1',
    localTransportClosed: true,
    remoteOutcome: 'completed',
    outcome: 'completed',
    observedAt: f.now,
  };
  return {
    ...f,
    claim,
    reservation,
    proof,
    subject: new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ),
  };
}

describe('API durable dispatch checkpoint', () => {
  it('arms exact schema3 and consumes the first API exchange budget atomically', async () => {
    const f = fixture();
    await f.subject.armDispatch(f.claim, undefined, f.reservation);
    const writes = f.query.mock.calls;
    const budget = writes.findIndex(([sql]) =>
      sql.includes('provider_dispatches_used='),
    );
    const armed = writes.findIndex(([sql]) =>
      sql.includes("phase='dispatch_armed'"),
    );
    expect(budget).toBeGreaterThanOrEqual(0);
    expect(budget).toBeLessThan(armed);
    expect(
      writes.filter(([sql]) => sql.includes('provider_dispatches_used=')),
    ).toHaveLength(1);
    expect(
      JSON.parse(
        String(
          writes.find(([sql]) =>
            sql.startsWith('UPDATE nodia_ai_jobs SET recovery_descriptor='),
          )?.[1]?.[1],
        ),
      ),
    ).toEqual(runtimeProofDescriptor(f.proof));
  });

  it.each(['missing_identity', 'wrong_connection', 'native_prefix'] as const)(
    'rejects %s before any budget reservation',
    async (change) => {
      const f = fixture();
      if (change === 'missing_identity')
        Reflect.deleteProperty(f.reservation, 'adapterIdentity');
      if (change === 'wrong_connection')
        f.reservation.adapterIdentity.connectionId = '9';
      if (change === 'native_prefix')
        f.reservation.resourceKey = 'codex-profile:' + 'a'.repeat(64);
      await expect(
        f.subject.armDispatch(f.claim, undefined, f.reservation),
      ).rejects.toThrow('eligibility_changed');
      expect(
        f.query.mock.calls.some(([sql]) =>
          sql.includes('provider_dispatches_used='),
        ),
      ).toBe(false);
    },
  );

  it('seals a completed API proof and queues schema3 acknowledgement without native process claims', async () => {
    const f = fixture();
    f.attempt.phase = 'dispatch_armed';
    f.job.recovery_descriptor = runtimeProofDescriptor(f.proof);
    const persist = vi.fn(async () => undefined);
    await f.subject.finish(f.claim, {
      status: 'completed',
      terminalProof: f.proof,
      persist,
    });
    expect(persist).toHaveBeenCalledWith(f.manager);
    const ack = f.query.mock.calls.find(([sql]) =>
      sql.includes("'reconcile_ack'"),
    );
    const descriptor = JSON.parse(String(ack?.[1]?.[3]));
    expect(descriptor.schema_version).toBe(3);
    expect(descriptor.terminal_proof).toMatchObject({
      local_transport_closed: true,
      remote_outcome: 'completed',
    });
    expect(JSON.stringify(descriptor)).not.toContain('process_closed');
  });

  it('does not persist a success from a contradictory local/remote API proof', async () => {
    const f = fixture();
    f.attempt.phase = 'dispatch_armed';
    f.job.recovery_descriptor = runtimeProofDescriptor(f.proof);
    const persist = vi.fn(async () => undefined);
    const forged = {
      ...f.proof,
      remoteOutcome: 'unknown',
    } as NodiaAiRuntimeTerminalProof;
    await expect(
      f.subject.finish(f.claim, {
        status: 'completed',
        terminalProof: forged,
        persist,
      }),
    ).rejects.toThrow('invalid_terminal_proof');
    expect(persist).not.toHaveBeenCalled();
  });
});

it('a restored quarantined API descriptor cannot arm a request despite copied valid lease metadata', async () => {
  const f = fixture();
  f.job.recovery_descriptor = {
    ...runtimeProofDescriptor(f.proof),
    restore_quarantined: true,
  };
  await expect(
    f.subject.armDispatch(f.claim, undefined, f.reservation),
  ).rejects.toThrow('lease_lost');
  expect(
    f.query.mock.calls.some(
      ([sql]) =>
        sql.includes('provider_dispatches_used=') ||
        sql.includes("phase='dispatch_armed'"),
    ),
  ).toBe(false);
});


it('does not arm a retired mode even from a historical matching selection snapshot', async () => {
  const f = fixture(); f.claim.run.selection_snapshot.mode = 'web' as never;
  await expect(f.subject.armDispatch(f.claim, undefined, f.reservation)).rejects.toThrow('mode_retired');
  expect(f.query.mock.calls.some(([sql]) => sql.includes('provider_dispatches_used=') || sql.includes("phase='dispatch_armed'"))).toBe(false);
});
