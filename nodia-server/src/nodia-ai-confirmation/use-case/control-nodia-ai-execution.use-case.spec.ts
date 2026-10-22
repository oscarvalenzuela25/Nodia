import 'reflect-metadata';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { QueryFailedError } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import type { NodiaAiConfirmationService } from '../nodia-ai-confirmation.service.js';
import { confirmationFixture } from './confirmation.fixture.js';
import { GetNodiaAiExecutionUseCase } from './get-nodia-ai-execution.use-case.js';
import { ControlNodiaAiExecutionUseCase } from './control-nodia-ai-execution.use-case.js';
import { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import { nodiaAiBoundExecutionBinding } from '../../nodia-ai-execution/types/bound-execution-step.js';
import { NodiaAiExecutionStep } from '../entities/nodia-ai-execution-step.entity.js';
import { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
vi.mock('../../nodia-ai-run/event-journal.js', () => ({
  appendNodiaAiExecutionEvent: vi.fn(async () => undefined),
}));

async function fixture() {
  const f = confirmationFixture();
  f.step.tool_name = 'nodia_finance_movements_prepare_create';
  const preparer = {
    ...f.preparer,
    toolName: f.step.tool_name,
    verifyPreconditions: vi.fn(async () => undefined),
  };
  const proposalValidator = new ValidateNodiaAiProposalUseCase(
    [preparer],
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
    f.policy,
    new CanonicalizeNodiaAiProposalUseCase(f.policy),
  );
  const [step] = await f.store.steps();
  step.tool_name = f.step.tool_name;
  f.execution.minimal_scope = {
    schema_version: 1,
    steps: [
      {
        step_id: f.step.id,
        tool_name: f.step.tool_name,
        contract_hash: f.step.contract_hash,
        scope: f.step.scope,
      },
    ],
  };
  step.template_hash = f.validate.hash({
    command_template: f.step.command_template,
    output_bindings: f.step.output_bindings,
    preconditions: f.step.preconditions,
  });
  const job = {
    id: randomUUID(),
    kind: 'execution',
    conversation_id: f.chat.id,
    execution_id: f.execution.id,
    state: 'ready',
    stage_key: 'execution_step',
    run_id: null,
    fence: '0',
    recovery_descriptor: null as Record<string, unknown> | null,
  };
  const queries: { sql: string; parameters: unknown[] }[] = [];
  f.manager.query = vi.fn(async (sql: string, parameters: unknown[] = []) => {
    queries.push({ sql, parameters });
    if (sql.includes('global_waiting'))
      return [{ global_waiting: '0', owner_waiting: '0' }];
    if (sql.startsWith('WITH renewed AS')) return [{ id: randomUUID() }];
    if (sql.startsWith('UPDATE nodia_ai_jobs SET')) {
      job.state = sql.includes("state='ready'") ? 'ready' : 'cancelled';
      job.fence = (BigInt(job.fence) + 1n).toString();
      if (sql.includes('recovery_descriptor=$4'))
        job.recovery_descriptor = JSON.parse(String(parameters[3])) as Record<
          string,
          unknown
        >;
    }
    if (sql.startsWith('UPDATE nodia_ai_execution_steps SET')) {
      if (sql.includes("error_code='nodia_ai:preconditions_changed'"))
        step.error_code = 'nodia_ai:preconditions_changed';
      else {
        step.state = sql.includes("state='ready'") ? 'ready' : 'cancelled';
        step.error_code = null;
      }
      if (sql.includes('recovery_descriptor=NULL'))
        step.recovery_descriptor = null;
    }
    return [];
  }) as typeof f.manager.query;
  const budget = { count: 0 };
  const store = {
    ...f.store,
    lockJobs: vi.fn(async () => [job]),
    lockExecution: vi.fn(async () => f.execution),
    lockSteps: vi.fn(async () => [step]),
    executionEventCount: vi.fn(async () => budget.count),
  };
  const typed = store as unknown as NodiaAiConfirmationService;
  const availability = new NodiaAiConfirmationAvailabilityUseCase([
    {
      toolName: preparer.toolName,
      contractHash: preparer.contractHash,
      catalogVersion: preparer.catalogVersion,
    },
  ]);
  const status = new GetNodiaAiExecutionUseCase(
    typed,
    f.get as unknown as GetNodiaAiProposalUseCase,
    f.validate,
    f.policy,
    availability,
  );
  const useCase = new ControlNodiaAiExecutionUseCase(
    typed,
    status,
    f.validate,
    proposalValidator,
    availability as never,
    f.policy,
  );
  const request = {
    client_request_id: randomUUID(),
    expected_execution_revision: f.execution.revision,
  };
  const failed = () => {
    f.execution.state = 'failed';
    job.state = 'failed';
    step.state = 'failed';
    step.error_code = 'nodia_ai:lease_lost';
    step.recovery_descriptor = {
      schema_version: 1,
      kind: 'local_transaction_rolled_back',
    };
    f.chat.active_job_id = null;
  };
  return {
    ...f,
    preparer,
    store,
    status,
    step,
    job,
    queries,
    availability,
    budget,
    useCase,
    request,
    failed,
  };
}
describe('NodiaAI human execution cancellation and same-command recovery', () => {
  it.each(['55P03', '57014'])(
    'reports bounded lock/query timeout %s as recoverable busy without a false cancellation',
    async (code) => {
      const f = await fixture();
      f.store.lockJobs.mockRejectedValueOnce(
        new QueryFailedError(
          'synthetic lock',
          [],
          Object.assign(new Error('synthetic timeout'), { code }),
        ),
      );
      await expect(
        f.useCase.execute(f.identity, f.execution.id, f.request, 'cancel'),
      ).rejects.toThrow('nodia_ai:execution_busy');
      expect(f.execution.state).toBe('queued');
      expect(f.queries.some(({ sql }) => sql.startsWith('UPDATE '))).toBe(
        false,
      );
    },
  );
  it('cancels pending work, fences its lease and releases authority without a native write', async () => {
    const f = await fixture();
    const result = await f.useCase.execute(
      f.identity,
      f.execution.id,
      f.request,
      'cancel',
    );
    expect(result).toMatchObject({
      status: 'accepted',
      execution: { state: 'cancelled', revision: 2, can_resume: false },
    });
    expect(f.job.state).toBe('cancelled');
    expect(f.job.fence).toBe('1');
    expect(f.queries.some(({ sql }) => sql.includes("phase='cancelled'"))).toBe(
      true,
    );
    expect(
      f.queries.some(({ sql }) => sql.includes('revoked_at=COALESCE')),
    ).toBe(true);
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(f.preparer.verifyPreconditions).not.toHaveBeenCalled();
  });
  it('returns already terminal on a repeated cancel even with the old expected revision', async () => {
    const f = await fixture();
    await f.useCase.execute(f.identity, f.execution.id, f.request, 'cancel');
    const count = f.queries.length;
    expect(
      await f.useCase.execute(f.identity, f.execution.id, f.request, 'cancel'),
    ).toMatchObject({
      status: 'already_terminal',
      execution: { state: 'cancelled' },
    });
    expect(
      f.queries.slice(count).some(({ sql }) => sql.startsWith('UPDATE ')),
    ).toBe(false);
  });
  it('resumes a proven rollback with its original execution, step and native identity', async () => {
    const f = await fixture();
    f.failed();
    const nativeKey = f.step.native_request_key;
    const result = await f.useCase.execute(
      f.identity,
      f.execution.id,
      f.request,
      'resume',
    );
    expect(result).toMatchObject({
      execution: {
        execution_id: f.execution.id,
        state: 'queued',
        revision: 2,
        can_resume: false,
      },
    });
    expect(f.step.native_request_key).toBe(nativeKey);
    expect(f.step.source_step_id).toBe(f.step.id);
    expect(f.job.recovery_descriptor).toMatchObject({
      schema_version: 1,
      kind: 'human_execution_resume',
      actor_id: f.actor.actorId,
      session_public_id: f.actor.sessionId,
      execution_revision: 2,
      expected_execution_revision: 1,
      client_request_id: f.request.client_request_id,
      proposal_hash: f.execution.proposal_hash,
    });
    expect(f.preparer.verifyPreconditions).toHaveBeenCalledOnce();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
  });
  it('recovers the latest resume response without renewing the grant or admitting another effect', async () => {
    const f = await fixture();
    f.failed();
    await f.useCase.execute(f.identity, f.execution.id, f.request, 'resume');
    f.preparer.verifyPreconditions.mockClear();
    const count = f.queries.length;
    expect(
      await f.useCase.execute(f.identity, f.execution.id, f.request, 'resume'),
    ).toMatchObject({ execution: { revision: 2, state: 'queued' } });
    expect(
      f.queries.slice(count).some(({ sql }) => sql.startsWith('UPDATE ')),
    ).toBe(false);
    expect(f.preparer.verifyPreconditions).not.toHaveBeenCalled();
  });
  it.each(['unknown', 'cancelled', 'running', 'queued'])(
    'never replays %s as a fresh write',
    async (state) => {
      const f = await fixture();
      f.failed();
      f.execution.state = state;
      await expect(
        f.useCase.execute(f.identity, f.execution.id, f.request, 'resume'),
      ).rejects.toThrow('nodia_ai:execution_not_resumable');
      expect(f.queries.some(({ sql }) => sql.startsWith('UPDATE '))).toBe(
        false,
      );
    },
  );
  it('requires a proven rollback rather than inferring safety from the absence of a receipt', async () => {
    const f = await fixture();
    f.failed();
    f.step.recovery_descriptor = null;
    expect(
      (await f.status.execute(f.identity, f.execution.id)).can_resume,
    ).toBe(false);
    await expect(
      f.useCase.execute(f.identity, f.execution.id, f.request, 'resume'),
    ).rejects.toThrow('nodia_ai:execution_not_resumable');
  });
  it('does not offer resume when the current execution registry no longer admits the frozen version', async () => {
    const f = await fixture();
    f.failed();
    const status = new GetNodiaAiExecutionUseCase(
      f.store as unknown as NodiaAiConfirmationService,
      f.get as unknown as GetNodiaAiProposalUseCase,
      f.validate,
      f.policy,
      new NodiaAiConfirmationAvailabilityUseCase([]),
    );
    expect((await status.execute(f.identity, f.execution.id)).can_resume).toBe(
      false,
    );
  });
  it('reserves journal space for both queued and running before renewing a grant', async () => {
    const f = await fixture();
    f.failed();
    f.budget.count = f.policy.results.outbox_events_per_activity - 5;
    expect(
      (await f.status.execute(f.identity, f.execution.id)).can_resume,
    ).toBe(false);
    await expect(
      f.useCase.execute(f.identity, f.execution.id, f.request, 'resume'),
    ).rejects.toThrow('nodia_ai:execution_limit');
    expect(f.queries.some(({ sql }) => sql.startsWith('WITH renewed AS'))).toBe(
      false,
    );
    expect(f.queries.some(({ sql }) => sql.startsWith('UPDATE '))).toBe(false);
  });
  it('accepts the exact boundary leaving four terminal events after queued and running', async () => {
    const f = await fixture();
    f.failed();
    f.budget.count = f.policy.results.outbox_events_per_activity - 6;
    expect(
      (await f.status.execute(f.identity, f.execution.id)).can_resume,
    ).toBe(true);
    expect(
      await f.useCase.execute(f.identity, f.execution.id, f.request, 'resume'),
    ).toMatchObject({ execution: { state: 'queued' } });
  });
  it('keeps a super administrator inspection of another owner read-only for resume', async () => {
    const f = await fixture();
    f.failed();
    f.actor.actorId = '2';
    f.actor.isSuperAdmin = true;
    expect(
      (await f.status.execute(f.identity, f.execution.id)).can_resume,
    ).toBe(false);
  });
  it('persists material change as non-resumable and requires a new proposal/button', async () => {
    const f = await fixture();
    f.failed();
    f.preparer.verifyPreconditions.mockRejectedValueOnce(
      new ConflictException('nodia_ai:preconditions_changed'),
    );
    await expect(
      f.useCase.execute(f.identity, f.execution.id, f.request, 'resume'),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
    expect(f.step.error_code).toBe('nodia_ai:preconditions_changed');
    expect(
      (await f.status.execute(f.identity, f.execution.id)).can_resume,
    ).toBe(false);
    expect(
      f.queries.some(({ sql }) => sql.startsWith('UPDATE nodia_ai_jobs SET')),
    ).toBe(false);
  });
  it.each(['cancel', 'resume'] as const)(
    'reauthorizes before %s or replay',
    async (operation) => {
      const f = await fixture();
      f.get.load.mockRejectedValueOnce(
        new ForbiddenException('nodia_ai:capability_denied'),
      );
      await expect(
        f.useCase.execute(f.identity, f.execution.id, f.request, operation),
      ).rejects.toThrow('nodia_ai:capability_denied');
      expect(f.store.lockJobs).not.toHaveBeenCalled();
    },
  );
  it('rejects stale revisions without modifying jobs or grants', async () => {
    const f = await fixture();
    await expect(
      f.useCase.execute(
        f.identity,
        f.execution.id,
        { ...f.request, expected_execution_revision: 4 },
        'cancel',
      ),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    expect(f.queries.some(({ sql }) => sql.startsWith('UPDATE '))).toBe(false);
  });
  it.each([
    { extra: true },
    { expected_execution_revision: 0 },
    { client_request_id: 'invalid' },
  ])('validates the strict human request: %j', async (change) => {
    const f = await fixture();
    await expect(
      f.useCase.execute(
        f.identity,
        f.execution.id,
        { ...f.request, ...change },
        'cancel',
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.get.load).not.toHaveBeenCalled();
  });
});

async function partialWorkflowFixture() {
  const f = await fixture();
  f.failed();
  f.execution.state = 'partially_completed';
  f.execution.catalog_version = f.revision.catalog_version =
    'nodia-ai-ai23-workflow/1';
  const pendingSource = f.loaded.steps[0];
  pendingSource.position = 2;
  f.step.position = 2;
  const source = Object.assign(
    new NodiaAiProposalStep(),
    structuredClone(pendingSource),
    {
      id: randomUUID(),
      position: 1,
      scope: { subject_user_id: '1' },
      command_template: { owner_id: '1', command: { amount: '12' } },
    },
  );
  source.public_step = { ...source.public_step, step_id: source.id };
  const first = Object.assign(
    new NodiaAiExecutionStep(),
    structuredClone(f.step),
    {
      id: source.id,
      source_step_id: source.id,
      position: 1,
      state: 'completed',
      minimal_scope: source.scope,
      template_hash: f.validate.hash({
        command_template: source.command_template,
        output_bindings: source.output_bindings,
        preconditions: source.preconditions,
      }),
      bound_command: {
        command_template: source.command_template,
        scope: source.scope,
        preconditions: source.preconditions,
      },
      bound_command_hash: f.validate.hash(
        nodiaAiBoundExecutionBinding(source, true),
      ),
      dispatched_at: f.now,
      completed_at: f.now,
      error_code: null,
      recovery_descriptor: null,
      minimal_receipt: {
        schema_version: 1,
        resource_key: 'finance_movements',
        resource_id: '9007199254740993',
        subject_user_id: '1',
      },
    },
  );
  f.loaded.steps.splice(0, f.loaded.steps.length, source, pendingSource);
  f.execution.minimal_scope = {
    schema_version: 1,
    steps: f.loaded.steps.map((step) => ({
      step_id: step.id,
      tool_name: step.tool_name,
      contract_hash: step.contract_hash,
      scope: step.scope,
    })),
  };
  f.store.steps.mockResolvedValue([first, f.step]);
  f.store.lockSteps.mockResolvedValue([first, f.step]);
  return { ...f, first, source, pendingSource };
}

describe('human control of partially completed workflows', () => {
  it('cancels a non-resumable failed suffix while preserving completed receipts', async () => {
    const f = await partialWorkflowFixture();
    f.step.error_code = 'nodia_ai:preconditions_changed';
    const frozen = structuredClone(f.first);
    expect(
      (await f.status.execute(f.identity, f.execution.id)).can_resume,
    ).toBe(false);
    const result = await f.useCase.execute(
      f.identity,
      f.execution.id,
      f.request,
      'cancel',
    );
    expect(result).toMatchObject({
      status: 'accepted',
      execution: { state: 'partially_completed', can_resume: false },
    });
    expect(f.step.state).toBe('cancelled');
    expect(f.first).toEqual(frozen);
    expect(result.execution.steps[0].result_refs).toEqual([
      { resource_key: 'finance_movements', id: '9007199254740993' },
    ]);
    expect(f.preparer.verifyPreconditions).not.toHaveBeenCalled();
    const revision = f.execution.revision;
    const replay = await f.useCase.execute(
      f.identity,
      f.execution.id,
      f.request,
      'cancel',
    );
    expect(replay).toMatchObject({
      status: 'already_terminal',
      execution: { state: 'partially_completed', revision },
    });
    expect(f.execution.revision).toBe(revision);
    expect(f.first).toEqual(frozen);
  });
  it('still cancels failed work when no step can resume and no effect has committed', async () => {
    const f = await fixture();
    f.failed();
    f.step.error_code = 'nodia_ai:preconditions_changed';
    const result = await f.useCase.execute(
      f.identity,
      f.execution.id,
      f.request,
      'cancel',
    );
    expect(result).toMatchObject({
      status: 'accepted',
      execution: { state: 'cancelled', can_resume: false },
    });
    expect(f.step.state).toBe('cancelled');
    expect(f.preparer.verifyPreconditions).not.toHaveBeenCalled();
  });
  it('reserves event capacity for every remaining effect before accepting resume', async () => {
    const f = await partialWorkflowFixture();
    const source = Object.assign(
      new NodiaAiProposalStep(),
      structuredClone(f.pendingSource),
      { id: randomUUID(), position: 3 },
    );
    source.public_step = { ...source.public_step, step_id: source.id };
    const pending = Object.assign(
      new NodiaAiExecutionStep(),
      structuredClone(f.step),
      {
        id: source.id,
        source_step_id: source.id,
        position: 3,
        state: 'ready',
        error_code: null,
        recovery_descriptor: null,
      },
    );
    f.loaded.steps.push(source);
    f.execution.minimal_scope.steps.push({
      step_id: source.id,
      tool_name: source.tool_name,
      contract_hash: source.contract_hash,
      scope: source.scope,
    });
    f.store.steps.mockResolvedValue([f.first, f.step, pending]);
    f.store.lockSteps.mockResolvedValue([f.first, f.step, pending]);
    f.budget.count = f.policy.results.outbox_events_per_activity - 7;
    expect(
      (await f.status.execute(f.identity, f.execution.id)).can_resume,
    ).toBe(false);
    await expect(
      f.useCase.execute(f.identity, f.execution.id, f.request, 'resume'),
    ).rejects.toThrow('nodia_ai:execution_limit');
  });
  it('rejects tampered first-bound preconditions before projecting a completed predecessor', async () => {
    const f = await partialWorkflowFixture();
    f.first.bound_command!.preconditions = { version: 'forged' };
    await expect(f.status.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    expect(f.preparer.prepare).not.toHaveBeenCalled();
  });
  it('offers same-command resume after a second local rollback while preserving the completed receipt', async () => {
    const f = await partialWorkflowFixture();
    const frozen = structuredClone(f.first);
    const before = await f.status.execute(f.identity, f.execution.id);
    expect(before.can_resume).toBe(true);
    expect(before.steps[0].result_refs).toEqual([
      { resource_key: 'finance_movements', id: '9007199254740993' },
    ]);
    const result = await f.useCase.execute(
      f.identity,
      f.execution.id,
      f.request,
      'resume',
    );
    expect(result.execution.state).toBe('queued');
    expect(f.first).toEqual(frozen);
    expect(f.preparer.verifyPreconditions).toHaveBeenCalledTimes(1);
    expect(
      f.queries.find(({ sql }) =>
        sql.startsWith("UPDATE nodia_ai_execution_steps SET state='ready'"),
      )?.sql,
    ).toContain("state<>'completed'");
  });
  it('cancels between steps and retains a visible completed result without advertising resume', async () => {
    const f = await partialWorkflowFixture();
    f.execution.state = 'queued';
    f.step.state = 'ready';
    f.step.recovery_descriptor = null;
    f.step.error_code = null;
    f.job.state = 'ready';
    const frozen = structuredClone(f.first);
    const result = await f.useCase.execute(
      f.identity,
      f.execution.id,
      f.request,
      'cancel',
    );
    expect(result.execution).toMatchObject({
      state: 'partially_completed',
      can_resume: false,
    });
    expect(result.execution.steps[0].result_refs).toEqual([
      { resource_key: 'finance_movements', id: '9007199254740993' },
    ]);
    expect(f.first).toEqual(frozen);
    expect(f.step.state).toBe('cancelled');
    expect(
      f.queries.find(({ sql }) =>
        sql.startsWith("UPDATE nodia_ai_execution_steps SET state='cancelled'"),
      )?.sql,
    ).toContain("state<>'completed'");
  });
  it('preserves rollback proof when material change requires a new proposal for the remaining work', async () => {
    const f = await partialWorkflowFixture();
    f.preparer.verifyPreconditions.mockRejectedValueOnce(
      new ConflictException('nodia_ai:preconditions_changed'),
    );
    await expect(
      f.useCase.execute(f.identity, f.execution.id, f.request, 'resume'),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
    expect(f.step.recovery_descriptor).toEqual({
      schema_version: 1,
      kind: 'local_transaction_rolled_back',
    });
    expect(
      (await f.status.execute(f.identity, f.execution.id)).can_resume,
    ).toBe(false);
    expect(f.first.state).toBe('completed');
  });
});
