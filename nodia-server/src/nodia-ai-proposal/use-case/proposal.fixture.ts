import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { NodiaAiProposal } from '../entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../entities/nodia-ai-proposal-step.entity.js';
import type { NodiaAiProposalPreparer } from '../types/proposal-preparer.types.js';
import { CanonicalizeNodiaAiProposalUseCase } from './canonicalize-nodia-ai-proposal.use-case.js';
import { ValidateNodiaAiProposalUseCase } from './validate-nodia-ai-proposal.use-case.js';
/** Explicit synthetic application fixture, never registered in production. */
export function proposalFixture() {
  const runtime = runtimeFixture();
  const policy = runtime.policy;
  const now = new Date('2026-10-16T12:00:00.000Z');
  const identity = { userId: '1', sessionId: randomUUID() };
  const actor = {
    actorId: '1',
    sessionId: identity.sessionId,
    isSuperAdmin: false,
    modules: [{ id: '1', key: 'finance', route: '/finance' }],
  };
  const chat = {
    id: randomUUID(),
    owner_id: '1',
    expires_at: new Date(now.getTime() + 86400000),
    active_job_id: null,
  };
  const proposal = Object.assign(new NodiaAiProposal(), {
    id: randomUUID(),
    conversation_id: chat.id,
    actor_id: '1',
    current_revision: 1,
    created_at: now,
  });
  const revision = Object.assign(new NodiaAiProposalRevision(), {
    proposal_id: proposal.id,
    revision: 1,
    state: 'ready',
    hash: '',
    catalog_version: 'fixture/1',
    canonicalization_version: 'jcs-rfc8785/1',
    created_at: now,
    expires_at: new Date(now.getTime() + 900000),
  });
  const id = randomUUID();
  const step = Object.assign(new NodiaAiProposalStep(), {
    id,
    proposal_id: proposal.id,
    proposal_revision: 1,
    position: 1,
    tool_name: 'nodia_fixture_prepare',
    contract_hash: 'a'.repeat(64),
    kind: 'domain_change',
    effect_key: 'fixture.create',
    scope: { subject_user_id: '1' },
    command_template: { name: 'Original' },
    preconditions: { version: '1' },
    output_bindings: [],
    public_step: {
      step_id: id,
      tool_name: 'nodia_fixture_prepare',
      kind: 'domain_change',
      effect_key: 'fixture.create',
      scope: { subject_user_id: '1' },
      target: null,
      changes: [
        {
          field_key: 'name',
          before: null,
          after: 'Original',
          before_present: false,
          after_present: true,
          origin: 'user',
        },
      ],
      depends_on: [],
      output_bindings: [],
    },
  });
  const preparer: NodiaAiProposalPreparer = {
    toolName: step.tool_name,
    contractHash: step.contract_hash,
    catalogVersion: 'fixture/1',
    moduleRoutes: ['/finance'],
    actionKeys: [],
    editableFields: { name: 'string' },
    bindableFields: {},
    outputKeys: {},
    prepare: vi.fn(),
    applyEdits: vi.fn(),
    verifyAuthority: vi.fn(async () => undefined),
    verifyPreconditions: vi.fn(async () => undefined),
  };
  const validate = new ValidateNodiaAiProposalUseCase(
    [preparer],
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
    policy,
    new CanonicalizeNodiaAiProposalUseCase(policy),
  );
  revision.hash = String(
    validate.compile(proposal, revision, [step], false).hash,
  );
  const manager = {
    query: vi.fn(async () => []),
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const store = {
    transaction: async <T>(work: (manager: EntityManager) => Promise<T>) =>
      work(manager),
    proposal: vi.fn(async () => proposal),
    revision: vi.fn(async () => revision),
    steps: vi.fn(async () => [step]),
    advance: vi.fn(),
    publishReady: vi.fn(),
  };
  const authorize = { execute: vi.fn(async () => actor) };
  const authorizeChat = { execute: vi.fn(async () => ({ actor, chat, now })) };
  return {
    policy,
    now,
    identity,
    actor,
    chat,
    proposal,
    revision,
    step,
    preparer,
    validate,
    manager,
    store,
    authorize,
    authorizeChat,
  };
}
