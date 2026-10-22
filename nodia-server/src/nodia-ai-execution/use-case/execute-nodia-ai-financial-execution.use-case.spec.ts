import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { QueryFailedError, type EntityManager } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmationFixture } from '../../nodia-ai-confirmation/use-case/confirmation.fixture.js';
import type { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import type { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import type { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import type { ExecuteNodiaAiFinanceEffectUseCase } from '../../nodia-ai-finance-effect/use-case/execute-nodia-ai-finance-effect.use-case.js';
import type { NodiaAiExecutionService } from '../nodia-ai-execution.service.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import { ExecuteNodiaAiFinancialExecutionUseCase } from './execute-nodia-ai-financial-execution.use-case.js';
import type { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import type { NodiaAiExecutionStep } from '../../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import type { StoredProposalStep } from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { nodiaAiBoundExecutionBinding } from '../types/bound-execution-step.js';
import type { NodiaAiExecutionClaim } from '../types/execution-claim.types.js';
import { DisabledNodiaAiDeletionJournal } from '../../nodia-ai-recovery/types/deletion-journal.js';

vi.mock('../../nodia-ai-run/event-journal.js', () => ({
  appendNodiaAiExecutionEvent: vi.fn(async () => undefined),
}));
afterEach(() => vi.mocked(appendNodiaAiExecutionEvent).mockReset());

function fixture() {
  const f = confirmationFixture();
  f.revision.state = 'confirmed';
  f.step.tool_name = 'nodia_finance_movements_prepare_create';
  f.step.command_template = {
    schema_version: 1,
    owner_id: '1',
    command: {
      name: 'Comida',
      amount: '9007199254740993',
      category_id: '2',
      type: 'expense',
      status: 'paid',
      obligation_id: null,
      is_active: true,
    },
    origins: {},
  };
  Object.assign(f.preparer, {
    toolName: f.step.tool_name,
    catalogVersion: f.execution.catalog_version,
  });
  const canonical = new CanonicalizeNodiaAiProposalUseCase(f.policy);
  const hash = () =>
    createHash('sha256')
      .update(
        canonical.execute({
          tool_name: f.step.tool_name,
          contract_hash: f.step.contract_hash,
          scope: f.step.scope,
          owner_id: f.step.command_template.owner_id,
          command: f.step.command_template.command,
        }),
      )
      .digest('hex');
  const step = {
    id: f.step.id,
    execution_id: f.execution.id,
    state: 'ready',
    bound_command_hash: null as string | null,
    native_request_key: randomUUID(),
    minimal_receipt: null as Record<string, string | number> | null,
    dispatched_at: null as Date | null,
    completed_at: null as Date | null,
    recovery_descriptor: null,
    lease_fence: '0',
    error_code: null,
  };
  const job = {
    id: randomUUID(),
    execution_id: f.execution.id,
    conversation_id: f.chat.id,
    run_id: null,
    kind: 'execution',
    state: 'ready',
    stage_key: 'execution_step',
    stage_seq: 1,
    lease_owner: null as string | null,
    lease_until: null as Date | null,
    attempt_count: 0,
    fence: '0',
    recovery_descriptor: null as Record<string, string | number> | null,
    available_at: f.now,
    deadline_at: new Date(f.now.getTime() + 600000),
  };
  const chat = { ...f.chat, active_job_id: job.id };
  const loaded = { ...f.loaded, chat };
  const grant = {
    id: randomUUID(),
    actor_id: f.actor.actorId,
    session_public_id: f.actor.sessionId,
    run_id: null,
    execution_id: f.execution.id,
    command_set_hash: f.execution.proposal_hash,
    policy_version: f.policy.policyVersion,
    revoked_at: null as Date | null,
    allowed_modules: ['/finance'],
    allowed_operations: [f.step.tool_name],
    allowed_scope: f.execution.minimal_scope,
    expires_at: job.deadline_at,
  };
  const get = { load: vi.fn(async () => loaded) };
  const store = {
    requiresExclusiveAuthority: vi.fn(async () => false),
    transaction: vi.fn(
      async <T>(work: (manager: EntityManager) => Promise<T>) =>
        work(f.manager),
    ),
    execution: vi.fn(async () => f.execution),
    jobs: vi.fn(async () => [job]),
    steps: vi.fn(async () => [step]),
    grants: vi.fn(async () => [grant]),
    now: vi.fn(async () => f.now),
    sessionExpiry: vi.fn(async (): Promise<Date | null> => job.deadline_at),
    hasAttempts: vi.fn(async () => false),
    confirmedBySession: vi.fn(async () => true),
    complete: vi.fn(async () => {
      f.execution.state = 'completed';
      f.execution.revision++;
      step.state = 'completed';
      step.bound_command_hash = hash();
      step.completed_at = f.now;
      step.minimal_receipt = {
        schema_version: 1,
        resource_key: 'finance_movements',
        resource_id: '42',
        subject_user_id: '1',
      };
      grant.revoked_at = f.now;
    }),
  };
  const status = {
    project: vi.fn(async () => ({
      execution_id: f.execution.id,
      state: f.execution.state,
      revision: f.execution.revision,
    })),
  };
  const validate = {
    assert: f.validate.assert.bind(f.validate),
    preparer: vi.fn(() => f.preparer),
    equal: (a: unknown, b: unknown) =>
      canonical.execute(a) === canonical.execute(b),
  };
  const effect = {
    invalidateCoreCaches: vi.fn(async () => undefined),
    execute: vi.fn<ExecuteNodiaAiFinanceEffectUseCase['execute']>(async () => ({
      id: '42',
      ownerId: '1',
    })),
  };
  const uc = new ExecuteNodiaAiFinancialExecutionUseCase(
    store as unknown as NodiaAiExecutionService,
    get as unknown as GetNodiaAiProposalUseCase,
    status as unknown as GetNodiaAiExecutionUseCase,
    validate as unknown as ValidateNodiaAiProposalUseCase,
    canonical,
    effect as unknown as ExecuteNodiaAiFinanceEffectUseCase,
    f.policy,
    new DisabledNodiaAiDeletionJournal(),
  );
  return {
    ...f,
    get,
    store,
    effect,
    uc,
    status,
    validate,
    job,
    grant,
    chat,
    loaded,
    executionStep: step,
    hash,
  };
}

describe('first confirmed financial effect coordination', () => {
  it('takes the exclusive frontier before loading a hinted Core execution and invalidates cache after SQL exits', async () => {
    const f = fixture();
    f.store.requiresExclusiveAuthority.mockResolvedValue(true);
    const order: string[] = [];
    const transaction = f.store.transaction.getMockImplementation()!;
    f.store.transaction.mockImplementation(async (work) => {
      const result = await transaction(work);
      order.push('sql-finished');
      return result;
    });
    f.effect.invalidateCoreCaches.mockImplementation(async () => {
      order.push('cache');
    });
    f.get.load.mockImplementation(async () => {
      expect(
        f.manager.query.mock.calls.some(([sql]) =>
          String(sql).includes('SHARE ROW EXCLUSIVE'),
        ),
      ).toBe(true);
      return f.loaded;
    });
    await f.uc.execute(f.identity, f.execution.id);
    expect(order).toEqual(['sql-finished', 'cache']);
  });
  it('rejects a Core step when an obsolete hint selected a shared frontier before dispatch', async () => {
    const f = fixture();
    f.step.tool_name = 'nodia_users_prepare_update';
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'exclusive_transaction_required',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  function claimed() {
    const f = fixture();
    const claim: NodiaAiExecutionClaim = {
      executionId: f.execution.id,
      identity: f.identity,
      jobId: f.job.id,
      attemptId: randomUUID(),
      workerId: randomUUID(),
      fence: '7',
    };
    f.execution.state = 'running';
    f.execution.revision = 2;
    Object.assign(f.executionStep, {
      state: 'running',
      lease_fence: claim.fence,
    });
    Object.assign(f.job, {
      state: 'leased',
      fence: claim.fence,
      lease_owner: claim.workerId,
      attempt_count: 1,
      lease_until: new Date(f.now.getTime() + 30000),
    });
    vi.mocked(f.manager.query).mockImplementation(async (sql: string) =>
      sql.includes('SELECT id FROM nodia_ai_job_attempts')
        ? [{ id: claim.attemptId }]
        : [],
    );
    return { ...f, claim };
  }
  it('executes a matching durable worker delivery and closes its exact attempt atomically', async () => {
    const f = claimed();
    await expect(
      f.uc.execute(f.identity, f.execution.id, f.claim),
    ).resolves.toMatchObject({ state: 'completed' });
    expect(f.store.complete.mock.calls[0].at(-1)).toEqual(f.claim);
    expect(f.effect.execute).toHaveBeenCalledOnce();
  });
  it.each(['holder', 'fence', 'attempt', 'expired', 'identity'] as const)(
    'rejects stale worker %s without entering the native effect',
    async (kind) => {
      const f = claimed();
      if (kind === 'holder') f.claim.workerId = randomUUID();
      if (kind === 'fence') f.claim.fence = '6';
      if (kind === 'attempt') vi.mocked(f.manager.query).mockResolvedValue([]);
      if (kind === 'expired') f.job.lease_until = f.now;
      if (kind === 'identity')
        f.claim.identity = { ...f.identity, sessionId: randomUUID() };
      await expect(
        f.uc.execute(f.identity, f.execution.id, f.claim),
      ).rejects.toThrow();
      expect(f.effect.execute).not.toHaveBeenCalled();
    },
  );
  it('accepts explicit current-session resume only with the persisted exact revision/hash marker', async () => {
    const f = claimed();
    f.execution.revision = 5;
    f.job.recovery_descriptor = {
      schema_version: 1,
      kind: 'human_execution_resume',
      actor_id: f.actor.actorId,
      session_public_id: f.actor.sessionId,
      execution_revision: 4,
      expected_execution_revision: 3,
      client_request_id: randomUUID(),
      proposal_hash: f.execution.proposal_hash,
    };
    await f.uc.execute(f.identity, f.execution.id, f.claim);
    expect(f.store.confirmedBySession).toHaveBeenCalledWith(
      f.manager,
      f.execution,
      null,
    );
    expect(f.effect.execute).toHaveBeenCalledOnce();
  });
  it('does not reinterpret an old resume marker for a different command revision', async () => {
    const f = claimed();
    f.job.recovery_descriptor = {
      schema_version: 1,
      kind: 'human_execution_resume',
      actor_id: f.actor.actorId,
      session_public_id: f.actor.sessionId,
      execution_revision: 8,
      expected_execution_revision: 7,
      client_request_id: randomUUID(),
      proposal_hash: f.execution.proposal_hash,
    };
    await expect(
      f.uc.execute(f.identity, f.execution.id, f.claim),
    ).rejects.toThrow('nodia_ai:execution_grant_invalid');
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it('keeps the exact command and money strings in the shared native manager, closing receipt and event together', async () => {
    const f = fixture();
    expect((await f.uc.execute(f.identity, f.execution.id)).state).toBe(
      'completed',
    );
    expect(f.effect.execute.mock.calls[0][0].commandTemplate).toEqual(
      f.step.command_template,
    );
    expect(f.effect.execute.mock.calls[0][1].manager).toBe(f.manager);
    expect(f.store.complete).toHaveBeenCalledWith(
      f.manager,
      f.execution,
      f.executionStep,
      f.job,
      f.grant,
      f.hash(),
      {
        schema_version: 1,
        resource_key: 'finance_movements',
        resource_id: '42',
        subject_user_id: '1',
      },
      f.now,
    );
    expect(appendNodiaAiExecutionEvent).toHaveBeenCalledWith(
      f.manager,
      expect.objectContaining({
        payload: { revision: 2, state: 'completed', error: null },
      }),
    );
  });
  it('observes an existing exact receipt without creating again after the original grant expired', async () => {
    const f = fixture();
    await f.uc.execute(f.identity, f.execution.id);
    f.grant.expires_at = new Date(0);
    await f.uc.execute(f.identity, f.execution.id);
    expect(f.effect.execute).toHaveBeenCalledOnce();
    expect(f.store.grants).toHaveBeenCalledOnce();
    expect(f.get.load).toHaveBeenCalledTimes(2);
  });
  it('reauthorizes a completed effect and denies it when current access is revoked', async () => {
    const f = fixture();
    await f.uc.execute(f.identity, f.execution.id);
    f.get.load.mockRejectedValueOnce(
      new ForbiddenException('nodia_ai:module_denied'),
    );
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:module_denied',
    );
    expect(f.effect.execute).toHaveBeenCalledOnce();
  });
  it.each(['unknown', 'running', 'cancelled', 'cancel_requested', 'failed'])(
    'never replays an execution in state %s',
    async (state) => {
      const f = fixture();
      f.execution.state = state;
      await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
        'nodia_ai:execution_conflict',
      );
      expect(f.effect.execute).not.toHaveBeenCalled();
    },
  );
  it.each(['leased', 'unknown', 'done'])(
    'rejects a job in state %s before any effect',
    async (state) => {
      const f = fixture();
      f.job.state = state;
      await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
        'nodia_ai:execution_conflict',
      );
      expect(f.effect.execute).not.toHaveBeenCalled();
    },
  );
  it('rejects a persisted attempt instead of reclaiming work with an uncertain outcome', async () => {
    const f = fixture();
    f.store.hasAttempts.mockResolvedValue(true);
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_conflict',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it('rejects a retained epoch that no longer matches the chat', async () => {
    const f = fixture();
    f.chat.retention_epoch = '2';
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_conflict',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it.each([
    'command_set_hash',
    'actor_id',
    'session_public_id',
    'policy_version',
  ])('rejects a grant with changed %s', async (field) => {
    const f = fixture();
    Object.assign(f.grant, { [field]: 'changed' });
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_grant_invalid',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it('rejects a revoked grant', async () => {
    const f = fixture();
    f.grant.revoked_at = f.now;
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_grant_invalid',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it('rejects a queued job when its exact human consumption witness is absent', async () => {
    const f = fixture();
    f.store.confirmedBySession.mockResolvedValue(false);
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_grant_invalid',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it('does not require the already consumed challenge to remain unexpired while the admitted grant is valid', async () => {
    const f = fixture();
    f.challenge.expires_at = new Date(0);
    await f.uc.execute(f.identity, f.execution.id);
    expect(f.store.confirmedBySession).toHaveBeenCalledWith(
      f.manager,
      f.execution,
      f.actor.sessionId,
    );
    expect(f.effect.execute).toHaveBeenCalledOnce();
  });
  it.each(['job', 'grant', 'session'])(
    'rejects expired %s before effect',
    async (target) => {
      const f = fixture();
      if (target === 'job') f.job.deadline_at = f.now;
      if (target === 'grant') f.grant.expires_at = f.now;
      if (target === 'session') f.store.sessionExpiry.mockResolvedValue(null);
      await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
        'nodia_ai:execution_expired',
      );
      expect(f.effect.execute).not.toHaveBeenCalled();
    },
  );
  it('does not reinterpret an admitted command merely because proposal TTL passed', async () => {
    const f = fixture();
    f.revision.expires_at = new Date(0);
    await f.uc.execute(f.identity, f.execution.id);
    expect(f.effect.execute).toHaveBeenCalledOnce();
  });
  it('rejects multiple steps before executing the first', async () => {
    const f = fixture();
    f.loaded.steps.push({ ...f.step, id: randomUUID() });
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_unsupported',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it('rejects dependencies and output bindings instead of partially interpreting the proposal', async () => {
    const f = fixture();
    f.step.output_bindings.push({ source_step_id: randomUUID() });
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_unsupported',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it('rejects a conflicting bound hash before effect', async () => {
    const f = fixture();
    f.executionStep.bound_command_hash = 'f'.repeat(64);
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_conflict',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it('propagates native precondition failure without receipt or success event', async () => {
    const f = fixture();
    f.effect.execute.mockRejectedValueOnce(
      new Error('nodia_ai:preconditions_changed'),
    );
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
    expect(f.store.complete).not.toHaveBeenCalled();
    expect(appendNodiaAiExecutionEvent).not.toHaveBeenCalled();
  });
  it('refuses a native receipt for another subject', async () => {
    const f = fixture();
    f.effect.execute.mockResolvedValueOnce({ id: '42', ownerId: '2' });
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    expect(f.store.complete).not.toHaveBeenCalled();
  });
  it('rejects expiry reached during the native transaction, allowing the shared transaction to roll back', async () => {
    const f = fixture();
    f.store.now
      .mockResolvedValueOnce(f.now)
      .mockResolvedValueOnce(f.job.deadline_at);
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_expired',
    );
    expect(f.store.complete).not.toHaveBeenCalled();
  });
  it('does not claim success or retry when the commit response is lost', async () => {
    const f = fixture();
    f.store.transaction.mockImplementationOnce(async (work) => {
      await work(f.manager);
      throw new Error('connection lost during COMMIT');
    });
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_result_unknown',
    );
    expect(f.effect.execute).toHaveBeenCalledOnce();
    expect(f.store.transaction).toHaveBeenCalledOnce();
  });
  it.each(['40001', '40P01', '23514', 'P0001'])(
    'recognizes definitive PostgreSQL rollback %s at commit without misreporting uncertainty',
    async (code) => {
      const f = fixture();
      f.store.transaction.mockImplementationOnce(async (work) => {
        await work(f.manager);
        throw new QueryFailedError(
          'COMMIT',
          [],
          Object.assign(new Error('synthetic deferred failure'), { code }),
        );
      });
      await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
        'nodia_ai:execution_conflict',
      );
      expect(f.effect.execute).toHaveBeenCalledOnce();
      expect(f.store.transaction).toHaveBeenCalledOnce();
    },
  );
  it('treats a connection SQLSTATE at commit as uncertain instead of retrying', async () => {
    const f = fixture();
    f.store.transaction.mockImplementationOnce(async (work) => {
      await work(f.manager);
      throw new QueryFailedError(
        'COMMIT',
        [],
        Object.assign(new Error('synthetic disconnected transport'), {
          code: '08006',
        }),
      );
    });
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_result_unknown',
    );
    expect(f.effect.execute).toHaveBeenCalledOnce();
  });
  it('rolls back when the own domain step budget elapses even while admission remains valid', async () => {
    const f = fixture();
    const afterBudget = new Date(
      f.now.getTime() + f.policy.timing.domain_step_seconds * 1000,
    );
    f.store.now.mockResolvedValueOnce(f.now).mockResolvedValueOnce(afterBudget);
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_expired',
    );
    expect(f.effect.execute).toHaveBeenCalledOnce();
    expect(f.store.complete).not.toHaveBeenCalled();
  });
});

/** Only the SQL boundary and native writer are simulated; all coordinator guards run. */
function workflowFixture() {
  const f = fixture();
  const business = '11111111-1111-4111-8111-111111111111';
  f.revision.catalog_version = f.execution.catalog_version =
    'nodia-ai-ai23-workflow/1';
  f.step.tool_name = 'nodia_providers_prepare_create';
  f.step.scope = { business_id: business };
  f.step.command_template = {
    schema_version: 1,
    business_id: business,
    command: { name: 'Proveedor' },
  };
  f.step.preconditions = { destination_business_id: business };
  const expectedProvider = {
    business_id: business,
    name: 'Proveedor',
    tax: 19,
    fields: {},
    is_active: true,
  };
  const contact = Object.assign(
    Object.create(Object.getPrototypeOf(f.step)),
    structuredClone(f.step),
    {
      id: randomUUID(),
      position: 2,
      tool_name: 'nodia_provider_contacts_prepare_create',
      command_template: {
        schema_version: 1,
        business_id: business,
        provider_id: null,
        command: { name: 'Contacto', request_key: randomUUID() },
      },
      output_bindings: [
        {
          target_field_key: 'provider_id',
          from_step_id: f.step.id,
          output_key: 'id',
        },
      ],
    },
  ) as NodiaAiProposalStep;
  contact.preconditions = {
    destination_business_id: business,
    provider: null,
    future_provider: {
      from_step_id: f.step.id,
      source_contract_hash: f.step.contract_hash,
      expected_provider: expectedProvider,
    },
  };
  contact.public_step = {
    ...contact.public_step,
    step_id: contact.id,
    depends_on: [f.step.id],
    output_bindings: contact.output_bindings,
  };
  f.loaded.steps.splice(0, f.loaded.steps.length, f.step, contact);
  const first = Object.assign(f.executionStep, {
    bound_command: null,
    position: 1,
    tool_name: f.step.tool_name,
  });
  const second = {
    ...first,
    id: contact.id,
    position: 2,
    tool_name: contact.tool_name,
    state: 'blocked',
    native_request_key: randomUUID(),
  };
  const steps = [first, second] as unknown as NodiaAiExecutionStep[];
  f.store.steps.mockResolvedValue(steps as never);
  f.grant.allowed_modules = ['/tools/business'];
  f.grant.allowed_operations = [contact.tool_name, f.step.tool_name].sort();
  const bindOutputs = vi.fn(
    async (
      step: StoredProposalStep,
      values: Record<string, { value: string }>,
    ) => ({
      commandTemplate: {
        ...step.commandTemplate,
        provider_id: values.provider_id.value,
      },
      scope: { ...step.scope, provider_id: values.provider_id.value },
      preconditions: {
        destination_business_id: business,
        provider: {
          ...expectedProvider,
          id: values.provider_id.value,
          updated_at: f.now.toISOString(),
        },
      },
      publicStep: step.publicStep,
    }),
  );
  const provider = {
    ...f.preparer,
    toolName: f.step.tool_name,
    catalogVersion: 'nodia-ai-ai22-business/1',
    moduleRoutes: ['/tools/business'],
    outputKeys: { id: 'provider_id' },
    bindableFields: {},
  };
  const contactPort = {
    ...provider,
    toolName: contact.tool_name,
    outputKeys: { id: 'provider_contact_id' },
    bindableFields: { provider_id: 'provider_id' },
    bindOutputs,
  };
  f.validate.preparer.mockImplementation((name: string) =>
    name === provider.toolName ? provider : contactPort,
  );
  const store = {
    ...f.store,
    bind: vi.fn(
      async (
        _manager: EntityManager,
        step: NodiaAiExecutionStep,
        bound: object,
        hash: string,
      ) => {
        step.bound_command = structuredClone(bound) as never;
        step.bound_command_hash = hash;
      },
    ),
  };
  store.complete.mockImplementation(async (...args: unknown[]) => {
    const step = args[2] as NodiaAiExecutionStep;
    const nextPosition = args[9] as number | undefined;
    step.state = 'completed';
    step.completed_at = f.now;
    step.dispatched_at = f.now;
    step.bound_command_hash = args[5] as string;
    step.minimal_receipt = args[6] as never;
    f.execution.revision++;
    f.execution.state = nextPosition === undefined ? 'completed' : 'queued';
    f.execution.completed_at = nextPosition === undefined ? f.now : null;
    f.job.state = nextPosition === undefined ? 'done' : 'ready';
    f.job.stage_seq = nextPosition ?? f.job.stage_seq;
    if (nextPosition !== undefined) steps[nextPosition - 1].state = 'ready';
    f.grant.revoked_at = nextPosition === undefined ? f.now : null;
  });
  const effect = {
    execute: vi.fn(async (step: StoredProposalStep) => ({
      id:
        step.toolName === provider.toolName
          ? '9007199254740993'
          : '9007199254740994',
      businessId: business,
    })),
  };
  const uc = new ExecuteNodiaAiFinancialExecutionUseCase(
    store as never,
    f.get as never,
    f.status as never,
    f.validate as never,
    new CanonicalizeNodiaAiProposalUseCase(f.policy),
    effect as never,
    f.policy,
    new DisabledNodiaAiDeletionJournal(),
  );
  return {
    ...f,
    store,
    uc,
    effect,
    first: steps[0],
    second: steps[1],
    contact,
    bindOutputs,
    provider,
    contactPort,
    steps,
  };
}

describe('sequential dependent local operations', () => {
  it('commits one effect per delivery, then binds the exact verified provider ID for the contact', async () => {
    const f = workflowFixture();
    await expect(
      f.uc.execute(f.identity, f.execution.id),
    ).resolves.toMatchObject({ state: 'queued' });
    expect(f.effect.execute).toHaveBeenCalledTimes(1);
    expect(f.first.state).toBe('completed');
    expect(f.second.state).toBe('ready');
    expect(f.grant.revoked_at).toBeNull();
    expect(f.job.stage_seq).toBe(2);
    expect(f.store.bind).toHaveBeenCalledTimes(1);
    await expect(
      f.uc.execute(f.identity, f.execution.id),
    ).resolves.toMatchObject({ state: 'completed' });
    expect(f.effect.execute).toHaveBeenCalledTimes(2);
    expect(f.second.bound_command?.command_template).toMatchObject({
      provider_id: '9007199254740993',
    });
    expect(f.contact.command_template.provider_id).toBeNull();
    expect(f.bindOutputs).toHaveBeenCalledOnce();
    expect(f.effect.execute.mock.calls[1][0]).toMatchObject({
      outputBindings: [],
      publicStep: { depends_on: [], output_bindings: [] },
      commandTemplate: { provider_id: '9007199254740993' },
    });
    await f.uc.execute(f.identity, f.execution.id);
    expect(f.effect.execute).toHaveBeenCalledTimes(2);
  });
  it('preserves a failed second-step binding for retry without recreating or re-resolving the provider', async () => {
    const f = workflowFixture();
    await f.uc.execute(f.identity, f.execution.id);
    f.effect.execute.mockRejectedValueOnce(new Error('synthetic rollback'));
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'synthetic rollback',
    );
    const frozen = structuredClone(f.second.bound_command);
    expect(f.first.state).toBe('completed');
    expect(f.second.minimal_receipt).toBeNull();
    expect(f.bindOutputs).toHaveBeenCalledOnce();
    await f.uc.execute(f.identity, f.execution.id);
    expect(f.second.bound_command).toEqual(frozen);
    expect(f.bindOutputs).toHaveBeenCalledOnce();
    expect(
      f.effect.execute.mock.calls.filter(
        ([step]) => step.toolName === f.provider.toolName,
      ),
    ).toHaveLength(1);
  });
  it('rechecks authority after first-bind before entering any native effect', async () => {
    const f = workflowFixture();
    f.get.load
      .mockResolvedValueOnce(f.loaded)
      .mockRejectedValueOnce(
        new ForbiddenException('nodia_ai:capability_denied'),
      );
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:capability_denied',
    );
    expect(f.store.bind).toHaveBeenCalledOnce();
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it('does not retry a first-bind commit acknowledgement loss or call the native writer', async () => {
    const f = workflowFixture();
    f.store.transaction.mockImplementationOnce(async (work) => {
      await work(f.manager);
      throw new Error('synthetic commit acknowledgement lost');
    });
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'synthetic commit acknowledgement lost',
    );
    expect(f.first.bound_command).not.toBeNull();
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
  it.each(['foreign', 'future', 'output', 'type'] as const)(
    'rejects invalid output binding %s before executing its dependent writer',
    async (kind) => {
      const f = workflowFixture();
      await f.uc.execute(f.identity, f.execution.id);
      if (kind === 'foreign')
        f.contact.output_bindings[0].from_step_id = randomUUID();
      if (kind === 'future')
        f.contact.output_bindings[0].from_step_id = f.contact.id;
      if (kind === 'output') f.contact.output_bindings[0].output_key = 'sql';
      if (kind === 'type')
        f.contactPort.bindableFields.provider_id = 'business_id';
      await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
        'nodia_ai:execution_conflict',
      );
      expect(f.effect.execute).toHaveBeenCalledOnce();
    },
  );
  it('rejects a forged predecessor receipt instead of deriving an output from domain lookup', async () => {
    const f = workflowFixture();
    await f.uc.execute(f.identity, f.execution.id);
    f.first.minimal_receipt!.business_id =
      '22222222-2222-4222-8222-222222222222';
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    expect(f.bindOutputs).not.toHaveBeenCalled();
    expect(f.effect.execute).toHaveBeenCalledOnce();
  });
  it('rejects a changed first-bound payload without invoking its writer', async () => {
    const f = workflowFixture();
    await f.uc.execute(f.identity, f.execution.id);
    f.effect.execute.mockRejectedValueOnce(new Error('synthetic rollback'));
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'synthetic rollback',
    );
    (
      f.second.bound_command!.command_template as Record<string, unknown>
    ).provider_id = '4';
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    expect(f.effect.execute).toHaveBeenCalledTimes(2);
  });
  it.each(['independent', 'dependent'] as const)(
    'rejects a changed approved %s field even with a recomputed bound hash',
    async (kind) => {
      const f = workflowFixture();
      await f.uc.execute(f.identity, f.execution.id);
      if (kind === 'dependent') {
        f.effect.execute.mockRejectedValueOnce(new Error('synthetic rollback'));
        await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
          'synthetic rollback',
        );
      }
      const step = kind === 'independent' ? f.first : f.second;
      const source = kind === 'independent' ? f.step : f.contact;
      const template = step.bound_command!.command_template as Record<
        string,
        unknown
      >;
      (template.command as Record<string, unknown>).name =
        'Altered after human confirmation';
      const materialized = {
        ...source,
        command_template: template,
        scope: step.bound_command!.scope,
        preconditions: step.bound_command!.preconditions,
      } as NodiaAiProposalStep;
      step.bound_command_hash = createHash('sha256')
        .update(
          new CanonicalizeNodiaAiProposalUseCase(f.policy).execute(
            nodiaAiBoundExecutionBinding(materialized, true),
          ),
        )
        .digest('hex');
      await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
        'nodia_ai:invalid_persisted_state',
      );
      expect(f.effect.execute).toHaveBeenCalledTimes(
        kind === 'independent' ? 1 : 2,
      );
    },
  );
  it('rejects a completed non-prefix instead of skipping backwards through the workflow', async () => {
    const f = workflowFixture();
    f.second.state = 'completed';
    await expect(f.uc.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:execution_unsupported',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
  });
});
