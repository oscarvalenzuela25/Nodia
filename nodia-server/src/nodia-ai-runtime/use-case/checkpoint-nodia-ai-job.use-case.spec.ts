import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';
import { runtimeProofDescriptor } from './runtime-reconciliation-descriptor.js';
import { ReleaseNodiaAiRuntimeSlotUseCase } from './release-nodia-ai-runtime-slot.use-case.js';
import type { NodiaAiRuntimeTerminalProof } from '../types/reconciliation.types.js';
import { NodiaAiKnownPreDispatchError } from '../types/worker.types.js';

const reservation = {
  resourceKey: 'fixture-profile',
  fence: '1',
  operationRef: 'fixture-operation',
};
describe('CheckpointNodiaAiJobUseCase', () => {
  function codexDispatch() {
    const f = runtimeFixture(),
      claim = f.leased();
    claim.run.selection_snapshot.mode = 'agentic';
    claim.run.context_manifest = {
      session_generation: 'b'.repeat(32),
      adapter_identity: {
        provider_key: 'openai',
        contract_version: 'nodia-ai-codex-chat/1',
        connection_id: '1',
      },
    };
    const codexReservation = {
      resourceKey: 'codex-profile:' + 'a'.repeat(64),
      fence: '1',
      operationRef: claim.attempt.id,
      sessionGeneration: 'b'.repeat(32),
      adapterIdentity: {
        providerKey: 'openai' as const,
        contractVersion: 'nodia-ai-codex-chat/1' as const,
        connectionId: '1',
      },
    };
    return {
      ...f,
      claim,
      codexReservation,
      checkpoint: new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ),
    };
  }
  it('persists the explicit Codex schema2 identity atomically with dispatch arming', async () => {
    const f = codexDispatch();
    await f.checkpoint.armDispatch(f.claim, undefined, f.codexReservation);
    const descriptorWrite = f.query.mock.calls.find(([sql]) =>
      sql.startsWith('UPDATE nodia_ai_jobs SET recovery_descriptor='),
    )!;
    expect(JSON.parse(String(descriptorWrite[1]?.[1]))).toEqual({
      schema_version: 2,
      runtime: {
        provider_key: 'openai',
        adapter_contract_version: 'nodia-ai-codex-chat/1',
        connection_id: '1',
        engine: 'agentic',
        attempt_id: f.claim.attempt.id,
        operation_ref: f.claim.attempt.id,
        resource_key: f.codexReservation.resourceKey,
        session_generation: 'b'.repeat(32),
      },
    });
    expect(
      f.query.mock.calls.filter(([sql]) =>
        sql.includes('provider_dispatches_used='),
      ),
    ).toHaveLength(1);
  });
  it.each([
    'connection',
    'manifest',
    'session',
    'prefix',
    'mode',
    'missing_identity',
    'operation',
  ])(
    'rejects mismatched Codex %s before budget or phase mutations',
    async (change) => {
      const f = codexDispatch();
      if (change === 'connection')
        f.codexReservation.adapterIdentity.connectionId = '2';
      if (change === 'manifest')
        delete f.claim.run.context_manifest.adapter_identity;
      if (change === 'session')
        f.codexReservation.sessionGeneration = 'c'.repeat(32);
      if (change === 'prefix')
        f.codexReservation.resourceKey = 'gemini-profile:' + 'a'.repeat(64);
      if (change === 'mode') f.claim.run.selection_snapshot.mode = 'api_key';
      if (change === 'missing_identity')
        Reflect.deleteProperty(f.codexReservation, 'adapterIdentity');
      if (change === 'operation')
        f.codexReservation.operationRef =
          '9aa72a4f-8039-4979-bb21-329046333789';
      await expect(
        f.checkpoint.armDispatch(f.claim, undefined, f.codexReservation),
      ).rejects.toThrow('eligibility_changed');
      expect(
        f.query.mock.calls.some(
          ([sql]) =>
            sql.includes('provider_dispatches_used=') ||
            sql.includes("phase='dispatch_armed'") ||
            sql.includes('recovery_descriptor='),
        ),
      ).toBe(false);
    },
  );
  it('preserves Gemini schema1 without manufacturing a Codex identity', async () => {
    const f = runtimeFixture(),
      claim = f.leased();
    claim.run.context_manifest.session_generation = 'b'.repeat(32);
    const r = {
      resourceKey: 'gemini-profile:' + 'a'.repeat(64),
      operationRef: claim.attempt.id,
      fence: '1',
    };
    await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ).armDispatch(claim, undefined, r);
    const call = f.query.mock.calls.find(([sql]) =>
      sql.startsWith('UPDATE nodia_ai_jobs SET recovery_descriptor='),
    )!;
    const value = JSON.parse(String(call[1]?.[1])) as {
      schema_version: number;
      runtime: object;
    };
    expect(value.schema_version).toBe(1);
    expect(Object.keys(value.runtime)).toHaveLength(5);
    expect(value.runtime).not.toHaveProperty('provider_key');
  });
  it('does not accept a Gemini terminal proof to complete an armed Codex attempt', async () => {
    const f = codexDispatch();
    f.claim.attempt.phase = 'dispatch_armed';
    f.job.recovery_descriptor = runtimeProofDescriptor({
      engine: 'agentic',
      attemptId: f.claim.attempt.id,
      operationRef: f.claim.attempt.id,
      resourceKey: f.codexReservation.resourceKey,
      sessionGeneration: f.codexReservation.sessionGeneration,
      adapterIdentity: f.codexReservation.adapterIdentity,
    });
    const persist = vi.fn();
    const proof = {
      engine: 'agentic' as const,
      attemptId: f.claim.attempt.id,
      operationRef: f.claim.attempt.id,
      resourceKey: 'gemini-profile:' + 'a'.repeat(64),
      sessionGeneration: 'b'.repeat(32),
      terminalProofId: 'b3e5e6f3-6de9-4c27-8509-2b9d01acf5ed',
      processClosed: true as const,
      outcome: 'completed' as const,
      observedAt: f.now,
    };
    await expect(
      f.checkpoint.finish(f.claim, {
        status: 'completed',
        terminalProof: proof,
        persist,
      }),
    ).rejects.toThrow('invalid_terminal_proof');
    expect(persist).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(
        ([sql]) =>
          sql.includes('active_job_id=NULL') || sql.includes("'reconcile_ack'"),
      ),
    ).toBe(false);
  });
  it('rejects an old worker after restore even if the copied lease still appears current', async () => {
    const f = runtimeFixture(),
      claim = f.leased(),
      work = vi.fn(async () => undefined);
    f.job.recovery_descriptor = { restore_quarantined: true };
    await expect(
      new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).execute(claim, work),
    ).rejects.toThrow('lease_lost');
    expect(work).not.toHaveBeenCalled();
  });
  const dispatched = () => {
    const f = runtimeFixture();
    const claim = f.leased();
    f.attempt.phase = 'dispatch_armed';
    const proof: NodiaAiRuntimeTerminalProof = {
      engine: 'agentic',
      attemptId: claim.attempt.id,
      operationRef: claim.attempt.id,
      resourceKey: 'gemini-profile:' + 'a'.repeat(64),
      sessionGeneration: 'b'.repeat(32),
      terminalProofId: 'b3e5e6f3-6de9-4c27-8509-2b9d01acf5ed',
      processClosed: true,
      outcome: 'completed',
      observedAt: f.now,
    };
    f.job.recovery_descriptor = runtimeProofDescriptor(proof);
    return {
      ...f,
      claim,
      proof,
      checkpoint: new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ),
    };
  };
  it('rejects a claimed provider failure after dispatch when its native completion proof is absent', async () => {
    const f = dispatched();
    const persist = vi.fn();
    await expect(
      f.checkpoint.finish(f.claim, {
        status: 'failed',
        errorCode: 'nodia_ai:compaction_invalid',
        persist,
      }),
    ).rejects.toThrow('terminal_proof_required');
    expect(persist).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes('active_job_id=NULL')),
    ).toBe(false);
  });
  it.each([
    { resourceKey: 'gemini-profile:' + 'c'.repeat(64) },
    { sessionGeneration: 'c'.repeat(32) },
    { attemptId: '9aa72a4f-8039-4979-bb21-329046333789' },
    { operationRef: '9aa72a4f-8039-4979-bb21-329046333789' },
    { terminalProofId: 'invalid' },
    { outcome: 'abandoned_unknown' as const },
  ])(
    'does not downgrade unknown work using an invalid/mismatched failure proof %j',
    async (change) => {
      const f = dispatched();
      const persist = vi.fn();
      await expect(
        f.checkpoint.finish(f.claim, {
          status: 'failed',
          errorCode: 'nodia_ai:compaction_invalid',
          terminalProof: { ...f.proof, ...change },
          persist,
        }),
      ).rejects.toThrow('invalid_terminal_proof');
      expect(persist).not.toHaveBeenCalled();
      expect(
        f.query.mock.calls.some(
          ([sql]) =>
            sql.includes('active_job_id=NULL') || sql.includes("'ack:'"),
        ),
      ).toBe(false);
    },
  );
  it('accepts a completed provider response whose extraction failed, releases its exact slot and queues its acknowledgement atomically', async () => {
    const f = dispatched();
    Object.defineProperty(f.manager, 'queryRunner', {
      value: { isTransactionActive: true },
    });
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args) => {
      if (sql.startsWith('SELECT recovery_descriptor'))
        return [{ recovery_descriptor: f.job.recovery_descriptor }];
      if (sql.includes('WITH changed AS (UPDATE nodia_ai_runtime_slots'))
        return [{ resource_key: f.proof.resourceKey }];
      return original(sql, args);
    });
    const release = new ReleaseNodiaAiRuntimeSlotUseCase(f.checkpoint);
    const persist = vi.fn(async (manager: EntityManager) =>
      release.execute(
        f.claim,
        {
          resourceKey: f.proof.resourceKey,
          fence: '1',
          operationRef: f.proof.operationRef,
        },
        f.proof,
        manager,
      ),
    );
    await f.checkpoint.finish(f.claim, {
      status: 'failed',
      errorCode: 'nodia_ai:compaction_invalid',
      terminalProof: f.proof,
      persist,
    });
    expect(persist).toHaveBeenCalledWith(f.manager);
    expect(f.run.state).toBe('failed');
    expect(
      f.query.mock.calls.some(
        ([sql, args]) =>
          sql.includes('WITH changed AS (UPDATE nodia_ai_runtime_slots') &&
          args?.[0] === f.proof.resourceKey,
      ),
    ).toBe(true);
    expect(
      f.query.mock.calls.some(
        ([sql, args]) =>
          sql.includes("'reconcile_ack'") &&
          args?.[1] === 'ack:' + f.claim.attempt.id,
      ),
    ).toBe(true);
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes("runtime_slots SET state='unknown'"),
      ),
    ).toBe(false);
  });
  it('persists the terminal state and revision within the existing checkpoint even when normal event slots are exhausted', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    for (let i = 0; i < 252; i++)
      f.journal.events.push({
        id: `event-${i}`,
        conversation_id: claim.run.conversation_id,
        run_id: claim.run.id,
        seq: String(i + 1),
        event_key: `existing:${i}`,
        public_payload: {},
        scope_manifest: {},
      });
    await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ).finish(claim, {
      status: 'failed',
      errorCode: 'nodia_ai:eligibility_changed',
    });
    expect(f.journal.events).toHaveLength(253);
    expect(f.journal.events.at(-1)?.public_payload).toEqual({
      kind: 'run_changed',
      payload: {
        revision: 2,
        state: 'failed',
        error: {
          code: 'nodia_ai:eligibility_changed',
          message_key: 'nodia_ai:eligibility_changed',
          field_errors: [],
          retry_action: 'none',
          correlation_id: claim.run.id,
        },
      },
    });
    expect(f.journal.events.at(-1)?.scope_manifest).toEqual({
      schema_version: 1,
      module_routes: [],
    });
  });
  it('a heartbeat renews leases without publishing progress or incrementing the public revision', async () => {
    const f = runtimeFixture();
    await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ).heartbeat(f.leased());
    expect(f.journal.events).toHaveLength(0);
    expect(f.run.revision).toBe(1);
  });
  it('requests the native finance snapshot before checkpoint validation and domain reads', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    const checkpoint = new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    );
    await checkpoint.execute(claim, async () => 'read', 'REPEATABLE READ');
    expect(f.runtime.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      'REPEATABLE READ',
    );
  });
  it('never commits an armed successful outcome without a native terminal proof', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    f.attempt.phase = 'dispatch_armed';
    const persist = vi.fn(async () => undefined);
    await expect(
      new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).finish(claim, { status: 'completed', persist }),
    ).rejects.toThrow('terminal_proof_required');
    expect(persist).not.toHaveBeenCalled();
  });
  it('closes a reserved but never armed local slot when the known preflight fails', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ).finish(claim, {
      status: 'failed',
      errorCode: 'nodia_ai:eligibility_changed',
    });
    expect(
      f.query.mock.calls.some(
        ([sql, args]) =>
          sql.includes("runtime_slots SET state='free'") &&
          args?.[2] === claim.attempt.id,
      ),
    ).toBe(true);
  });
  it('cannot arm a profile-backed mode without its durable physical reservation', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    await expect(
      new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).armDispatch(claim),
    ).rejects.toThrow('lease_lost');
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('provider_dispatches_used='),
      ),
    ).toBe(false);
  });
  it.each([
    'fence',
    'holder',
    'lease',
    'deadline',
    'epoch',
    'active_job',
    'chat_expired',
    'chat_hidden',
    'cancelled',
    'grant_revoked',
    'session_changed',
    'grant_expired',
    'operation_missing',
    'run_changed',
    'owner_changed',
  ])('rejects %s before a local effect', async (kind) => {
    const f = runtimeFixture();
    const claim = f.leased();
    if (kind === 'fence') f.job.fence = '2';
    if (kind === 'holder') f.job.lease_owner = 'other';
    if (kind === 'lease') f.job.lease_until = f.now;
    if (kind === 'deadline') f.job.deadline_at = f.now;
    if (kind === 'epoch') f.conversation.retention_epoch = '2';
    if (kind === 'active_job') f.conversation.active_job_id = null;
    if (kind === 'chat_expired') f.conversation.expires_at = f.now;
    if (kind === 'chat_hidden') f.conversation.lifecycle = 'purging';
    if (kind === 'cancelled') f.run.state = 'cancel_requested';
    if (kind === 'grant_revoked') f.grant.revoked_at = f.now;
    if (kind === 'session_changed') f.grant.session_public_id = 'other';
    if (kind === 'grant_expired') f.grant.expires_at = f.now;
    if (kind === 'operation_missing') f.grant.allowed_operations = [];
    if (kind === 'run_changed') f.job.run_id = 'another-run';
    if (kind === 'owner_changed') f.conversation.owner_id = '2';
    const effect = vi.fn();
    await expect(
      new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).execute(claim, effect),
    ).rejects.toThrow('lease_lost');
    expect(effect).not.toHaveBeenCalled();
  });
  it('revalidates authority before invoking the transaction callback', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    f.authorize.execute.mockRejectedValueOnce(Error('revoked'));
    const effect = vi.fn();
    await expect(
      new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).execute(claim, effect),
    ).rejects.toThrow('revoked');
    expect(effect).not.toHaveBeenCalled();
  });
  it('runs a permitted effect with the same fenced manager', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    const effect = vi.fn(async () => 42);
    expect(
      await new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).execute(claim, effect),
    ).toBe(42);
    expect(effect).toHaveBeenCalledWith(f.manager);
  });
  it.each(['model_id', 'connection_id', 'effort_id'])(
    'does not change the configured %s during arming',
    async (field) => {
      const f = runtimeFixture();
      const claim = f.leased();
      const selection = { ...claim.run.selection_snapshot, [field]: 'changed' };
      await expect(
        new CheckpointNodiaAiJobUseCase(
          f.runtimePort,
          f.authorization,
          f.policy,
        ).armDispatch(claim, selection),
      ).rejects.toThrow('invalid_selection');
      expect(
        f.query.mock.calls.some(([sql]) =>
          sql.includes('provider_dispatches_used='),
        ),
      ).toBe(false);
    },
  );
  it('reserves dispatch budget before persisting dispatch_armed', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ).armDispatch(claim, undefined, reservation);
    const sql = f.query.mock.calls.map(([query]) => query);
    expect(
      sql.findIndex((value) => value.includes('provider_dispatches_used=')),
    ).toBeLessThan(
      sql.findIndex((value) => value.includes("phase='dispatch_armed'")),
    );
  });
  it('validates local context in the same transaction before consuming budget or arming dispatch', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    const validate = vi.fn(async (manager: EntityManager) => {
      expect(manager).toBe(f.manager);
      throw new Error('nodia_ai:preferences_changed');
    });
    await expect(
      new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).armDispatch(claim, undefined, reservation, validate),
    ).rejects.toThrow('preferences_changed');
    expect(validate).toHaveBeenCalledOnce();
    expect(
      f.query.mock.calls.some(
        ([sql]) =>
          sql.includes('provider_dispatches_used=') ||
          sql.includes("phase='dispatch_armed'"),
      ),
    ).toBe(false);
  });
  it('does not arm when the durable dispatch budget is exhausted', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    const rejection = vi.fn<(error: NodiaAiKnownPreDispatchError) => void>();
    f.query.mockImplementation(async (sql) =>
      sql.includes('SELECT resource_key')
        ? [{ resource_key: 'fixture-profile' }]
        : [],
    );
    const error = await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    )
      .armDispatch(claim, undefined, reservation, undefined, rejection)
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(NodiaAiKnownPreDispatchError);
    expect(error).toMatchObject({ errorCode: 'nodia_ai:execution_limit' });
    expect(rejection).toHaveBeenCalledExactlyOnceWith(error);
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes("phase='dispatch_armed'"),
      ),
    ).toBe(false);
  });
  it('reports a retired routing rejection as known pre-dispatch without reserving another provider generation', async () => {
    const f = runtimeFixture(),
      claim = f.leased();
    claim.run.routing_snapshot.enabled = true;
    const rejection = vi.fn<(error: NodiaAiKnownPreDispatchError) => void>();
    const error = await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    )
      .armDispatch(claim, undefined, reservation, undefined, rejection)
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(NodiaAiKnownPreDispatchError);
    expect(rejection).toHaveBeenCalledExactlyOnceWith(error);
    expect(
      f.query.mock.calls.some(
        ([sql]) =>
          sql.includes('provider_dispatches_used=') ||
          sql.includes("phase='dispatch_armed'"),
      ),
    ).toBe(false);
  });
  it('rejects rearming a delivered attempt', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    f.attempt.phase = 'dispatch_armed';
    await expect(
      new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).armDispatch(claim),
    ).rejects.toThrow('lease_lost');
  });
  it.each([
    'inference',
    'tool_selection',
    'invoice_ocr',
    'delegated_inference',
  ])(
    'rejects retired routing in %s before dispatch budgets or arming',
    async (stage) => {
      const f = runtimeFixture(),
        claim = f.leased();
      claim.job.stage_key = stage;
      claim.run.routing_snapshot.enabled = true;
      claim.run.routing_snapshot.target = {
        selection: { ...claim.run.selection_snapshot, mode: 'agentic' },
        configuration_generation: 'fixture-config',
        session_generation: 'b'.repeat(32),
      };
      await expect(
        new CheckpointNodiaAiJobUseCase(
          f.runtimePort,
          f.authorization,
          f.policy,
        ).armDispatch(claim, undefined, reservation),
      ).rejects.toThrow('mode_retired');
      expect(
        f.query.mock.calls.some(
          ([sql]) =>
            sql.includes('provider_dispatches_used=') ||
            sql.includes('delegations_used=') ||
            sql.includes("phase='dispatch_armed'"),
        ),
      ).toBe(false);
    },
  );
  it('charges a direct Agentic OCR generation against the existing dispatch budget without delegation', async () => {
    const f = runtimeFixture(),
      claim = f.leased();
    claim.job.stage_key = 'invoice_ocr';
    await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ).armDispatch(claim, undefined, reservation);
    expect(
      f.query.mock.calls.filter(([sql]) =>
        sql.includes('provider_dispatches_used='),
      ),
    ).toHaveLength(1);
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes('delegations_used=')),
    ).toBe(false);
  });
  it('does not let direct OCR bypass the remaining dispatch budget', async () => {
    const f = runtimeFixture(),
      claim = f.leased();
    claim.job.stage_key = 'invoice_ocr';
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args) =>
      sql.includes('provider_dispatches_used=') ? [] : original(sql, args),
    );
    await expect(
      new CheckpointNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).armDispatch(claim, undefined, reservation),
    ).rejects.toThrow('execution_limit');
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes("phase='dispatch_armed'"),
      ),
    ).toBe(false);
  });
  it('keeps unknown work active and quarantines its runtime', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ).finish(claim, {
      status: 'unknown',
      errorCode: 'nodia_ai:outcome_unknown',
    });
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes('active_job_id=NULL')),
    ).toBe(false);
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes("runtime_slots SET state='unknown'"),
      ),
    ).toBe(true);
  });
  it('writes the result and next stage in the same local transaction', async () => {
    const f = runtimeFixture();
    const claim = f.leased();
    const persist = vi.fn(async () => undefined);
    await new CheckpointNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ).finish(claim, { status: 'continue', nextStage: 'inference', persist });
    expect(persist).toHaveBeenCalledWith(f.manager);
    expect(
      f.query.mock.calls.some(
        ([sql, args]) =>
          sql.includes('stage_seq=stage_seq+') &&
          args?.[1] === 'ready' &&
          args?.[2] === 'inference',
      ),
    ).toBe(true);
  });
});
