import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiConversation } from '../entities/nodia-ai-conversation.entity.js';
import { NodiaAiMessage } from '../entities/nodia-ai-message.entity.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { AuthorizeNodiaAiConversationUseCase } from './authorize-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiRunUseCase } from './project-nodia-ai-run.use-case.js';
import { ValidateNodiaAiSnapshotsUseCase } from './validate-nodia-ai-snapshots.use-case.js';
import { eventJournalFixture } from '../../nodia-ai-run/event-journal.fixture.js';
export const testIdentity = {
  userId: '1',
  sessionId: '8d524fcc-68dd-4c62-a183-6cf3baedc6d1',
};
export const testChatId = '15f71e5b-1a66-4a9d-8d79-dc64358adac7';
export const testNow = new Date('2026-10-15T10:00:00Z');
export function conversationFixture() {
  const raw = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-runtime-policy.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const policy: NodiaAiRuntimePolicy = {
    ...raw,
    policyVersion: raw.policy_version,
    policyHash: 'a'.repeat(64),
  };
  const selection = {
    connection_id: '2',
    mode: 'agentic' as const,
    model_id: 'synthetic-model',
    effort_id: null,
  };
  const chat: NodiaAiConversation = Object.assign(new NodiaAiConversation(), {
    id: testChatId,
    owner_id: '1',
    client_request_id: testChatId,
    creation_request_hash: 'b'.repeat(64),
    title: 'Synthetic chat',
    is_pinned: false,
    is_archived: false,
    revision: 1,
    retention_epoch: '1',
    selected_connection_id: selection.connection_id,
    selected_mode: selection.mode,
    selected_model_id: selection.model_id,
    selected_effort_id: null,
    routing_enabled: false,
    routing_revision: 1,
    routing_target_selection: null,
    active_job_id: null,
    next_message_seq: '0',
    next_event_seq: '0',
    last_owner_message_at: null,
    expires_at: new Date('2026-12-15T10:00:00Z'),
    lifecycle: 'active',
    created_at: new Date('2026-09-16T10:00:00Z'),
    updated_at: new Date('2026-09-16T10:00:00Z'),
  });
  let savedMessage: NodiaAiMessage | null = null,
    savedRun: NodiaAiRun | null = null;
  const save = vi.fn(async (entity: object) => {
    if (entity instanceof NodiaAiMessage) savedMessage = entity;
    if (entity instanceof NodiaAiRun) savedRun = entity;
    return entity;
  });
  const journal = eventJournalFixture();
  const query = vi.fn(
    async (sql: string, parameters?: unknown[]): Promise<unknown[]> => {
      const eventResult = journal.query(sql, parameters);
      if (eventResult !== undefined) return eventResult;
      return sql.includes('global_waiting')
        ? [{ global_waiting: '0', owner_waiting: '0' }]
        : sql.includes('chat_bytes')
          ? [{ chat_bytes: '0', owner_bytes: '0' }]
          : [];
    },
  );
  const insert = vi.fn(async () => undefined);
  const manager = {
    query,
    getRepository: vi.fn(() => ({ save, insert })),
  } as unknown as EntityManager;
  const conversations = {
    transaction: vi.fn((work: (value: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
    find: vi.fn(async () => chat as NodiaAiConversation | null),
    now: vi.fn(async () => testNow),
    save: vi.fn(
      async (_manager: EntityManager, value: NodiaAiConversation) => value,
    ),
    findMessageRequest: vi.fn(async () => savedMessage),
    findMessageRun: vi.fn(async () => savedRun),
    auditInspection: vi.fn(async () => undefined),
    auditInspections: vi.fn(async () => undefined),
    list: vi.fn(
      async (_manager: EntityManager, _options: unknown) =>
        [] as NodiaAiConversation[],
    ),
    messages: vi.fn(async () => [] as NodiaAiMessage[]),
    messageRuns: vi.fn(
      async () =>
        [] as {
          id: string;
          user_message_id: string;
          assistant_message_id: string | null;
        }[],
    ),
    parts: vi.fn(async () => []),
  };
  const actor = {
    actorId: '1',
    sessionId: testIdentity.sessionId,
    isSuperAdmin: false,
    modules: [{ id: '2', key: 'nodia_ai', route: '/nodia-ai' }],
  };
  const authorize = { execute: vi.fn(async () => actor) };
  const service = conversations as unknown as NodiaAiConversationService;
  const authorization = authorize as unknown as AuthorizeNodiaAiUseCase;
  const access = new AuthorizeNodiaAiConversationUseCase(
    service,
    authorization,
  );
  const project = new ProjectNodiaAiConversationUseCase();
  const runs = new ProjectNodiaAiRunUseCase(
    new ValidateNodiaAiSnapshotsUseCase(),
  );
  const preparer = {
    observe: vi.fn(async () => ({ synthetic: true })),
    prepare: vi.fn(async () => ({
      selection,
      catalogVersion: 'synthetic-catalog/1',
      contextManifest: { schema_version: 1 },
      grantScope: { conversation_id: testChatId },
      allowedModules: ['2'],
      allowedOperations: [],
    })),
  };
  return {
    policy,
    chat,
    selection,
    save,
    query,
    journal,
    insert,
    manager,
    conversations,
    actor,
    authorize,
    service,
    authorization,
    access,
    project,
    runs,
    preparer,
  };
}
