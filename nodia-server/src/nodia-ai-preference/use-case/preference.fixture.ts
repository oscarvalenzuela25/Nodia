import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiAccessRequirements,
  NodiaAiAuthorizedActor,
} from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type {
  ProposalPreparation,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import { NodiaAiPreference } from '../entities/nodia-ai-preference.entity.js';
import {
  preferenceScopeHash,
  type NodiaAiPreferenceValue,
} from '../types/preference.types.js';
import { BuildNodiaAiPreferenceOperationsUseCase } from './build-nodia-ai-preference-operations.use-case.js';
import { DisabledNodiaAiDeletionJournal, type NodiaAiDeletionJournalPort } from '../../nodia-ai-recovery/types/deletion-journal.js';
export function preferenceFixture(deletionJournal: NodiaAiDeletionJournalPort = new DisabledNodiaAiDeletionJournal()) {
  const rows: NodiaAiPreference[] = [],
    labels = new Map([
      ['7', 'Food'],
      ['8', 'Transport'],
    ]);
  const identity = { userId: '1', sessionId: randomUUID() };
  const actor: NodiaAiAuthorizedActor = {
    actorId: '1',
    sessionId: identity.sessionId,
    isSuperAdmin: false,
    modules: [
      { id: '1', key: 'nodia-ai', route: '/tools/nodia-ai' },
      { id: '2', key: 'finance', route: '/tools/finances-personal' },
      { id: '3', key: 'business', route: '/tools/business' },
      { id: '4', key: 'reservations', route: '/tools/reservations' },
    ],
  };
  let chatOwner = '1',
    confirmed = true;
  const repository = {
    save: vi.fn(async (row: NodiaAiPreference) => {
      const i = rows.findIndex((old) => old.id === row.id);
      if (i < 0) rows.push(row);
      else rows[i] = row;
      return row;
    }),
    delete: vi.fn(async (query: { id: string }) => {
      const index = rows.findIndex((row) => row.id === query.id);
      if (index >= 0) rows.splice(index, 1);
      return { affected: 1 };
    }),
  };
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT owner_id FROM nodia_ai_conversations'))
        return [{ owner_id: chatOwner }];
      if (sql.includes('SELECT s.id FROM nodia_ai_execution_steps'))
        return confirmed ? [{ id: randomUUID() }] : [];
      return [];
    }),
    getRepository: () => repository,
  } as unknown as EntityManager;
  const authorize = {
    execute: vi.fn(
      async (
        _identity: unknown,
        requirements: NodiaAiAccessRequirements = {},
      ) => {
        if (
          requirements.moduleRoutes?.some(
            (route) => !actor.modules.some((module) => module.route === route),
          )
        )
          throw new ForbiddenException('nodia_ai:capability_denied');
        return actor;
      },
    ),
  };
  const store = {
    transaction: async <T>(work: (manager: EntityManager) => Promise<T>) =>
      work(manager),
    target: vi.fn(
      async (_manager: EntityManager, owner: string, id: string) =>
        rows.find((row) => row.owner_id === owner && row.id === id) ?? null,
    ),
    list: vi.fn(async () => rows),
    lockOwner: vi.fn(async () => {}),
    lockReference: vi.fn(async () => {}),
    references: vi.fn(
      async (
        _manager: EntityManager,
        _actor: unknown,
        _routes: readonly string[],
        values: readonly (NodiaAiPreferenceValue & { id: string })[],
      ) =>
        values.map((value) => ({
          id: value.id,
          value_label: labels.get(value.value) ?? null,
          scope_label: value.scope.business_id ? 'Synthetic business' : null,
        })),
    ),
  };
  const context: ProposalPreparerContext = {
    manager,
    actor,
    moduleRoutes: actor.modules.map((module) => module.route),
    conversationId: randomUUID(),
    executionStepId: randomUUID(),
  };
  const build = new BuildNodiaAiPreferenceOperationsUseCase(
    store as unknown as NodiaAiPreferenceService,
    authorize as unknown as AuthorizeNodiaAiUseCase,
    deletionJournal,
  );
  const step = (
    index: number,
    prepared: ProposalPreparation,
  ): StoredProposalStep => {
    if (prepared.status !== 'ready')
      throw new Error('Synthetic ready step required');
    return {
      ...prepared,
      id: randomUUID(),
      toolName: build.operations[index].toolName,
      contractHash: build.operations[index].contractHash,
      position: 1,
      outputBindings: [],
    };
  };
  const seed = (values: Partial<NodiaAiPreference> = {}) => {
    const value = Object.assign(new NodiaAiPreference(), {
      id: randomUUID(),
      owner_id: '1',
      scope_key: 'finance',
      scope: {},
      key: 'expense_category_id',
      value: '7',
      revision: 1,
      source_conversation_id: null,
      accepted_step_id: null,
      ...values,
    });
    value.scope_hash = preferenceScopeHash(value.scope_key, value.scope);
    rows.push(value);
    return value;
  };
  const create: NodiaAiJsonObject = {
    scope_key: 'finance',
    scope: {},
    key: 'expense_category_id',
    value: '7',
  };
  return {
    identity,
    actor,
    manager,
    authorize,
    store,
    context,
    build,
    step,
    seed,
    rows,
    labels,
    repository,
    create,
    setChatOwner: (id: string) => {
      chatOwner = id;
    },
    setConfirmed: (value: boolean) => {
      confirmed = value;
    },
  };
}
