import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { proposalFixture } from '../../nodia-ai-proposal/use-case/proposal.fixture.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import { NodiaAiExecution } from '../entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from '../entities/nodia-ai-execution-step.entity.js';
import { NodiaAiConfirmationChallenge } from '../entities/nodia-ai-confirmation-challenge.entity.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
import { ValidateNodiaAiConfirmationUseCase } from './validate-nodia-ai-confirmation.use-case.js';
/** Synthetic admission registry is test-only; production registration remains empty. */
export function confirmationFixture() {
  const f = proposalFixture();
  f.preparer.verifyPreconditions = vi.fn(async () => undefined);
  const token = 'A'.repeat(43);
  const challenge = Object.assign(new NodiaAiConfirmationChallenge(), {
    id: randomUUID(),
    proposal_id: f.proposal.id,
    proposal_revision: f.revision.revision,
    actor_id: f.actor.actorId,
    session_public_id: f.actor.sessionId,
    expected_hash: f.revision.hash,
    token_hash: createHash('sha256').update(token).digest('hex'),
    expires_at: new Date(f.now.getTime() + 120000),
    consumed_at: null,
    created_at: f.now,
  });
  const writes = { insert: vi.fn(), update: vi.fn() };
  const manager = {
    query: vi.fn(async (sql: string) =>
      sql.includes('global_waiting')
        ? [{ global_waiting: '0', owner_waiting: '0' }]
        : [],
    ),
    getRepository: vi.fn(() => writes),
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const chat = { ...f.chat, retention_epoch: '1' };
  const context = {
    manager,
    actor: f.actor,
    conversationId: chat.id,
    moduleRoutes: ['/finance'],
    statementTimeoutMs: 3000,
    maxCollectionItems: 128,
  };
  const loaded = {
    proposal: f.proposal,
    revision: f.revision,
    steps: [f.step],
    actor: f.actor,
    chat,
    now: f.now,
    context,
  };
  const get = { load: vi.fn(async () => loaded) };
  const execution = Object.assign(new NodiaAiExecution(), {
    id: randomUUID(),
    conversation_id: chat.id,
    proposal_id: f.proposal.id,
    origin_conversation_id: chat.id,
    origin_proposal_id: f.proposal.id,
    origin_proposal_revision: 1,
    proposal_hash: f.revision.hash,
    actor_id: f.actor.actorId,
    chat_owner_id: chat.owner_id,
    client_request_id: randomUUID(),
    catalog_version: f.revision.catalog_version,
    revision: 1,
    state: 'queued',
    minimal_scope: {
      schema_version: 1,
      steps: [
        {
          step_id: f.step.id,
          tool_name: f.step.tool_name,
          contract_hash: f.step.contract_hash,
          scope: f.step.scope,
        },
      ],
    },
    prior_execution_id: null,
    created_at: f.now,
    completed_at: null,
    retention_epoch: '1',
  });
  let savedSteps: NodiaAiExecutionStep[] = [];
  const store = {
    transaction: async <T>(work: (manager: EntityManager) => Promise<T>) =>
      work(manager),
    issue: vi.fn(),
    now: vi.fn(async () => f.now),
    sessionExpiry: vi.fn(async () => new Date(f.now.getTime() + 3600000)),
    challenge: vi.fn(async () => challenge),
    request: vi.fn(async (): Promise<NodiaAiExecution | null> => null),
    origin: vi.fn(async (): Promise<NodiaAiExecution | null> => null),
    execution: vi.fn(async (): Promise<NodiaAiExecution | null> => execution),
    create: vi.fn(
      async (
        _manager: EntityManager,
        _execution: NodiaAiExecution,
        steps: readonly NodiaAiExecutionStep[],
      ) => {
        savedSteps = [...steps];
      },
    ),
    steps: vi.fn(async () => savedSteps),
  };
  const validate = new ValidateNodiaAiConfirmationUseCase(
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
    new CanonicalizeNodiaAiProposalUseCase(f.policy),
  );
  savedSteps = [
    Object.assign(new NodiaAiExecutionStep(), {
      id: f.step.id,
      execution_id: execution.id,
      source_step_id: f.step.id,
      position: 1,
      tool_name: f.step.tool_name,
      template_hash: validate.hash({
        command_template: f.step.command_template,
        output_bindings: f.step.output_bindings,
        preconditions: f.step.preconditions,
      }),
      bound_command_hash: null,
      native_request_key: randomUUID(),
      state: 'ready',
      minimal_scope: f.step.scope,
      minimal_receipt: null,
      recovery_descriptor: null,
      lease_fence: '0',
      error_code: null,
      dispatched_at: null,
      completed_at: null,
    }),
  ];
  const availability = new NodiaAiConfirmationAvailabilityUseCase([
    {
      toolName: f.preparer.toolName,
      contractHash: f.preparer.contractHash,
      catalogVersion: f.revision.catalog_version,
    },
  ]);
  const request = {
    client_request_id: execution.client_request_id,
    proposal_revision: 1,
    expected_hash: f.revision.hash,
    confirmation_token: token,
  };
  return {
    ...f,
    validateProposal: f.validate,
    token,
    challenge,
    writes,
    manager,
    chat,
    context,
    loaded,
    get,
    store,
    execution,
    validate,
    availability,
    request,
  };
}
