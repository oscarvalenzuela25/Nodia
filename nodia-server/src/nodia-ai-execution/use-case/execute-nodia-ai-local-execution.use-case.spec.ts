import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { confirmationFixture } from '../../nodia-ai-confirmation/use-case/confirmation.fixture.js';
import type { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import type { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import type { ExecuteNodiaAiLocalEffectUseCase } from '../../nodia-ai-native-effect/use-case/execute-nodia-ai-local-effect.use-case.js';
import type { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import type { ProposalPreparerContext } from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiExecutionService } from '../nodia-ai-execution.service.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import {
  NODIA_AI_DELETION_PROOF,
  type NodiaAiDeletionJournalPort,
} from '../../nodia-ai-recovery/types/deletion-journal.js';
import { ExecuteNodiaAiLocalExecutionUseCase } from './execute-nodia-ai-local-execution.use-case.js';

function fixture() {
  const f = confirmationFixture(),
    preferenceId = randomUUID();
  f.step.tool_name = 'nodia_preferences_prepare_delete';
  f.step.command_template = { id: preferenceId, expected_revision: 1 };
  f.step.scope = { subject_user_id: f.actor.actorId };
  f.revision.state = 'confirmed';
  const job = {
    id: randomUUID(),
    kind: 'execution',
    execution_id: f.execution.id,
    conversation_id: f.chat.id,
    run_id: null,
    state: 'ready',
    stage_key: 'execution_step',
    stage_seq: 1,
    lease_owner: null,
    lease_until: null,
    attempt_count: 0,
    fence: '0',
    recovery_descriptor: null,
    available_at: f.now,
    deadline_at: new Date(f.now.getTime() + 60_000),
  };
  f.chat.active_job_id = job.id;
  const grant = {
    actor_id: f.actor.actorId,
    session_public_id: f.actor.sessionId,
    run_id: null,
    execution_id: f.execution.id,
    command_set_hash: f.execution.proposal_hash,
    policy_version: f.policy.policyVersion,
    revoked_at: null as Date | null,
    allowed_modules: [...f.preparer.moduleRoutes].sort(),
    allowed_operations: [f.step.tool_name],
    allowed_scope: f.execution.minimal_scope,
    expires_at: job.deadline_at,
  };
  let inTransaction = false;
  let afterJournal: (() => void) | undefined;
  const order: string[] = [];
  const journal: NodiaAiDeletionJournalPort = {
    enabled: true,
    recordDeletions: vi.fn(),
    recordResources: vi.fn(async () => {
      expect(inTransaction).toBe(false);
      order.push('record');
      afterJournal?.();
    }),
    assertResourcesRecorded: vi.fn(async () => {
      expect(inTransaction).toBe(false);
      order.push('assert');
    }),
    confirmResources: vi.fn(async () => {
      expect(inTransaction).toBe(false);
      order.push('confirm');
    }),
  };
  vi.mocked(f.manager.query).mockImplementation(async (sql: string) => {
    if (sql === 'SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE')
      return [{ id: f.chat.id }];
    if (sql.includes('SET next_event_seq=next_event_seq+1'))
      return [{ seq: '1' }];
    return [];
  });
  const store = {
    ...f.store,
    requiresExclusiveAuthority: vi.fn(async () => false),
    transaction: async <T>(work: (manager: typeof f.manager) => Promise<T>) => {
      inTransaction = true;
      try {
        return await work(f.manager);
      } finally {
        inTransaction = false;
      }
    },
    jobs: vi.fn(async () => [job]),
    grants: vi.fn(async () => [grant]),
    hasAttempts: vi.fn(async () => false),
    confirmedBySession: vi.fn(async () => true),
    complete: vi.fn(async () => {
      order.push('atomic_receipt');
      f.execution.state = 'completed';
    }),
  };
  const status = {
    project: vi.fn(async () => ({
      execution_id: f.execution.id,
      state: f.execution.state,
    })),
  };
  const effect = {
    execute: vi.fn(async (_step: unknown, context: ProposalPreparerContext) => {
      expect(inTransaction).toBe(true);
      expect(context[NODIA_AI_DELETION_PROOF]).toEqual({
        executionStepId: f.step.id,
        preferenceId,
      });
      order.push('delete');
      return { id: preferenceId, ownerId: f.actor.actorId, revision: 2 };
    }),
    invalidateCoreCaches: vi.fn(),
  };
  const validate = {
    preparer: vi.fn(() => f.preparer),
    equal: isDeepStrictEqual,
    assert: vi.fn(),
  };
  const subject = new ExecuteNodiaAiLocalExecutionUseCase(
    store as unknown as NodiaAiExecutionService,
    f.get as unknown as GetNodiaAiProposalUseCase,
    status as unknown as GetNodiaAiExecutionUseCase,
    validate as unknown as ValidateNodiaAiProposalUseCase,
    new CanonicalizeNodiaAiProposalUseCase(f.policy),
    effect as unknown as ExecuteNodiaAiLocalEffectUseCase,
    f.policy,
    journal,
  );
  return {
    ...f,
    subject,
    journal,
    store,
    effect,
    grant,
    preferenceId,
    order,
    betweenPhases: (hook: () => void) => {
      afterJournal = hook;
    },
  };
}

describe('ExecuteNodiaAiLocalExecutionUseCase preference deletion journal', () => {
  it('records the verified target outside locks, reauthorizes, then commits one effect and confirms outside locks', async () => {
    const f = fixture();
    await expect(
      f.subject.execute(f.identity, f.execution.id),
    ).resolves.toMatchObject({ state: 'completed' });
    expect(f.order).toEqual([
      'record',
      'assert',
      'delete',
      'atomic_receipt',
      'confirm',
    ]);
    expect(f.get.load).toHaveBeenCalledTimes(2);
    expect(f.journal.recordResources).toHaveBeenCalledExactlyOnceWith({
      deleted_at: f.now.toISOString(),
      resources: [{ kind: 'preference', preference_id: f.preferenceId }],
    });
    expect(f.effect.execute).toHaveBeenCalledTimes(1);
  });

  it('does not delete when the external intent cannot be acknowledged', async () => {
    const f = fixture();
    vi.mocked(f.journal.recordResources).mockRejectedValueOnce(
      Error('synthetic_unavailable'),
    );
    await expect(f.subject.execute(f.identity, f.execution.id)).rejects.toThrow(
      'synthetic_unavailable',
    );
    expect(f.effect.execute).not.toHaveBeenCalled();
    expect(f.store.complete).not.toHaveBeenCalled();
    expect(f.journal.confirmResources).not.toHaveBeenCalled();
  });

  it('rechecks current authorization after the external write, rejecting a revoked grant without any effect', async () => {
    const f = fixture();
    f.betweenPhases(() => {
      f.grant.revoked_at = f.now;
    });
    await expect(
      f.subject.execute(f.identity, f.execution.id),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.journal.recordResources).toHaveBeenCalledTimes(1);
    expect(f.effect.execute).not.toHaveBeenCalled();
    expect(f.journal.confirmResources).not.toHaveBeenCalled();
  });

  it('preserves the completed receipt if external post-commit confirmation fails', async () => {
    const f = fixture();
    vi.mocked(f.journal.confirmResources).mockRejectedValueOnce(
      Error('synthetic_confirm_unavailable'),
    );
    await expect(
      f.subject.execute(f.identity, f.execution.id),
    ).resolves.toMatchObject({ state: 'completed' });
    expect(f.effect.execute).toHaveBeenCalledTimes(1);
    expect(f.store.complete).toHaveBeenCalledTimes(1);
    await expect(
      f.subject.execute(f.identity, f.execution.id),
    ).resolves.toMatchObject({ state: 'completed' });
    expect(f.effect.execute).toHaveBeenCalledTimes(1);
    expect(f.journal.recordResources).toHaveBeenCalledTimes(1);
  });

  it('does not journal a deletion whose frozen target preconditions are no longer valid', async () => {
    const f = fixture();
    vi.mocked(f.preparer.verifyPreconditions).mockRejectedValueOnce(
      Error('synthetic_target_changed'),
    );
    await expect(f.subject.execute(f.identity, f.execution.id)).rejects.toThrow(
      'synthetic_target_changed',
    );
    expect(f.journal.recordResources).not.toHaveBeenCalled();
    expect(f.effect.execute).not.toHaveBeenCalled();
  });

  it('does not delete if the authoritative reread fails after recording the intent', async () => {
    const f = fixture();
    vi.mocked(f.journal.assertResourcesRecorded).mockRejectedValueOnce(
      Error('synthetic_missing_authority'),
    );
    await expect(f.subject.execute(f.identity, f.execution.id)).rejects.toThrow(
      'synthetic_missing_authority',
    );
    expect(f.journal.recordResources).toHaveBeenCalledTimes(1);
    expect(f.effect.execute).not.toHaveBeenCalled();
    expect(f.journal.confirmResources).not.toHaveBeenCalled();
  });
});
