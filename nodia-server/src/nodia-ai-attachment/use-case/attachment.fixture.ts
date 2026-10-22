import { vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { NodiaAiAttachment } from '../entities/nodia-ai-attachment.entity.js';
import type { NodiaAiAttachmentService } from '../nodia-ai-attachment.service.js';
import type { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { readFileSync } from 'node:fs';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import {
  NodiaAiAttachmentStorage,
  NodiaAiAttachmentInspector,
} from '../types/attachment-ports.js';

export const attachmentIdentity = {
  userId: '1',
  sessionId: '10000000-0000-4000-8000-000000000001',
};
export const attachmentInput = {
  conversation_id: '20000000-0000-4000-8000-000000000001',
  client_request_id: '30000000-0000-4000-8000-000000000001',
  kind: 'image' as const,
  byte_count: 4,
  file_name: 'image.png',
};
export const attachmentPolicy =
  new ValidateNodiaAiRuntimePolicyUseCase().execute(
    JSON.parse(
      readFileSync(
        new URL(
          '../../nodia-ai-runtime/config/runtime-policy.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  );

export function makeAttachmentFixture(policy: NodiaAiRuntimePolicy) {
  const now = new Date();
  const chat = {
    id: attachmentInput.conversation_id,
    owner_id: '1',
    retention_epoch: '1',
    expires_at: new Date(now.getTime() + 90 * 86400_000),
  };
  let saved: NodiaAiAttachment | undefined;
  const query = vi.fn(async (sql: string) =>
    sql.includes('clock_timestamp')
      ? [{ now }]
      : sql.includes('SELECT state FROM nodia_ai_jobs')
        ? [{ state: 'ready' }]
        : [],
  );
  const repo = {
    findOne: vi.fn(async () => saved ?? null),
    find: vi.fn(async () => (saved ? [saved] : [])),
  };
  const manager = {
    query,
    getRepository: vi.fn(() => repo),
  } as unknown as EntityManager;
  const usage = {
    chat_bytes: '0',
    owner_bytes: '0',
    chat_count: '0',
    owner_uploads: '0',
    global_uploads: '0',
  };
  const attachments = {
    transaction: vi.fn(async (work: (manager: EntityManager) => unknown) =>
      work(manager),
    ),
    lockReservations: vi.fn(async () => undefined),
    usage: vi.fn(async () => usage),
    save: vi.fn(async (_m: EntityManager, row: NodiaAiAttachment) => {
      saved = row;
      return row;
    }),
    queueCleanup: vi.fn(async () => undefined),
    find: vi.fn(async () => {
      if (!saved) throw new Error('missing');
      return saved;
    }),
    bound: vi.fn(async () => false),
  };
  const access = {
    execute: vi.fn(async () => ({
      chat,
      now,
      actor: {
        actorId: '1',
        sessionId: attachmentIdentity.sessionId,
        isSuperAdmin: false,
      },
    })),
  };
  const authorize = { execute: vi.fn(async () => ({ actorId: '1' })) };
  const storage = {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => Buffer.from('test')),
    delete: vi.fn(async () => undefined),
  };
  const inspector = {
    inspect: vi.fn(async () => ({
      mediaType: 'image/png',
      pageCount: null,
      durationSeconds: null,
      extractedText: null,
    })),
  };
  return {
    now,
    chat,
    policy,
    manager,
    repo,
    query,
    usage,
    attachments: attachments as unknown as NodiaAiAttachmentService,
    attachmentMocks: attachments,
    access: access as unknown as AuthorizeNodiaAiConversationUseCase,
    accessMock: access,
    authorize: authorize as unknown as AuthorizeNodiaAiUseCase,
    storage: storage as NodiaAiAttachmentStorage,
    storageMocks: storage,
    inspector: inspector as NodiaAiAttachmentInspector,
    inspectorMocks: inspector,
    row: () => saved!,
    setRow: (row: NodiaAiAttachment) => {
      saved = row;
    },
  };
}
