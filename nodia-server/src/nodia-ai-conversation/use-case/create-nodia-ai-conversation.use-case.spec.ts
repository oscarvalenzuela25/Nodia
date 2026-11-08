import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import type {
  NodiaAiConnectionsService,
  NodiaAiConnectionConfiguration,
} from '../nodia-ai-connections.service.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiConversation } from '../entities/nodia-ai-conversation.entity.js';
import { CreateNodiaAiConversationUseCase } from './create-nodia-ai-conversation.use-case.js';
import { ValidateNodiaAiConversationInputUseCase } from './validate-nodia-ai-conversation-input.use-case.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
import { connectionFixture } from './nodia-ai-connections.fixture.js';
const identity = {
  userId: '1',
  sessionId: '8d524fcc-68dd-4c62-a183-6cf3baedc6d1',
};
const input = {
  client_request_id: '15f71e5b-1a66-4a9d-8d79-dc64358adac7',
  title: 'Chat',
};
const now = new Date('2026-10-15T10:00:00Z');
function setup() {
  const query = vi.fn().mockResolvedValue([]);
  const manager = { query } as unknown as EntityManager;
  let saved: NodiaAiConversation | null = null;
  const conversations = {
    transaction: vi.fn(
      (work: (transaction: EntityManager) => Promise<unknown>) => work(manager),
    ),
    findByRequest: vi.fn(async () => saved),
    insertIfAbsent: vi.fn(
      async (_manager: EntityManager, value: NodiaAiConversation) => {
        saved = value;
      },
    ),
    now: vi.fn(async () => now),
  };
  const authorize = {
    execute: vi.fn(async () => ({ actorId: identity.userId })),
  };
  const policy = {
    policyVersion: 'synthetic-policy/1',
    policyHash: 'a'.repeat(64),
    retentionDays: 90,
    titleUtf8Bytes: 256,
  };
  const connections = {
    findDefault: vi
      .fn<() => Promise<NodiaAiConnectionConfiguration | null>>()
      .mockResolvedValue(null),
  };
  const subject = new CreateNodiaAiConversationUseCase(
    conversations as unknown as NodiaAiConversationService,
    authorize as unknown as AuthorizeNodiaAiUseCase,
    new ValidateNodiaAiConversationInputUseCase(),
    new ProjectNodiaAiConversationUseCase(),
    policy,
    connections as unknown as NodiaAiConnectionsService,
  );
  return {
    subject,
    conversations,
    authorize,
    manager,
    query,
    policy,
    connections,
    setSaved: (value: NodiaAiConversation) => {
      saved = value;
    },
  };
}
describe('CreateNodiaAiConversationUseCase', () => {
  it('initializes a new chat from the exact saved default and keeps it stable on idempotent recovery', async () => {
    const { subject, connections } = setup();
    const { row } = connectionFixture();
    row.is_default = true;
    row.default_mode = 'api_key';
    row.fields = {
      api_key: { selected_model: 'synthetic-default', thinking_level: 'high' },
    };
    connections.findDefault.mockResolvedValue(row);
    const first = await subject.execute(identity, input);
    expect(first.selection).toEqual({
      connection_id: row.id,
      mode: 'api_key',
      model_id: 'synthetic-default',
      effort_id: 'high',
    });
    connections.findDefault.mockResolvedValue({ ...row, id: '9' });
    expect(await subject.execute(identity, input)).toEqual(first);
    expect(connections.findDefault).toHaveBeenCalledOnce();
  });
  it('honors an explicit creation selection without consulting or changing the global default', async () => {
    const { subject, connections } = setup();
    const selection = {
      connection_id: '8',
      mode: 'agentic' as const,
      model_id: 'synthetic-explicit',
      effort_id: null,
    };
    expect(
      (await subject.execute(identity, { ...input, selection })).selection,
    ).toEqual(selection);
    expect(connections.findDefault).not.toHaveBeenCalled();
  });
  it('creates an unassigned chat when the default configuration has no selected model', async () => {
    const { subject, connections } = setup();
    const { row } = connectionFixture();
    Object.assign(row, {
      is_default: true,
      default_mode: 'agentic',
      fields: { agentic: {} },
    });
    connections.findDefault.mockResolvedValue(row);
    expect((await subject.execute(identity, input)).selection).toBeNull();
  });
  it('creates a private empty chat with policy retention and no tools/routing/owner message', async () => {
    const { subject, conversations, authorize, manager, query } = setup();
    const result = await subject.execute(identity, input);
    expect(result.owner_user_id).toBe(identity.userId);
    expect(result.selection).toBeNull();
    expect(result.routing).toEqual({
      schema_version: 1,
      enabled: false,
      revision: 1,
      target: null,
    });
    expect(result.last_owner_message_at).toBeNull();
    expect(result.expires_at).toBe('2027-01-13T10:00:00.000Z');
    expect(authorize.execute).toHaveBeenCalledWith(identity, {}, manager);
    expect(conversations.insertIfAbsent).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toContain('lock_timeout');
  });
  it('returns the original exact request without renewing timestamps or inserting again', async () => {
    const { subject, conversations } = setup();
    const first = await subject.execute(identity, input);
    expect(
      await subject.execute(identity, {
        ...input,
        client_request_id: input.client_request_id.toUpperCase(),
      }),
    ).toEqual(first);
    expect(conversations.insertIfAbsent).toHaveBeenCalledOnce();
    await expect(
      subject.execute(identity, { ...input, title: 'Different request' }),
    ).rejects.toThrow('nodia_ai:request_conflict');
  });
  it('rejects caller owner and bytes beyond the installed policy before persistence', async () => {
    const { subject, conversations, policy } = setup();
    await expect(
      subject.execute(identity, { ...input, owner_id: '2' }),
    ).rejects.toThrow('nodia_ai:invalid_input');
    policy.titleUtf8Bytes = 3;
    await expect(subject.execute(identity, input)).rejects.toThrow(
      'nodia_ai:invalid_input',
    );
    expect(conversations.transaction).not.toHaveBeenCalled();
  });
  it('fails closed when current authorization fails before reading or writing a chat', async () => {
    const { subject, conversations, authorize } = setup();
    authorize.execute.mockRejectedValueOnce(new Error('auth:session_expired'));
    await expect(subject.execute(identity, input)).rejects.toThrow(
      'auth:session_expired',
    );
    expect(conversations.findByRequest).not.toHaveBeenCalled();
    expect(conversations.insertIfAbsent).not.toHaveBeenCalled();
  });
  it('hashes the canonical request independently of object insertion order', async () => {
    const { subject, conversations } = setup();
    await subject.execute(identity, input);
    const written = conversations.insertIfAbsent.mock.calls[0][1];
    expect(written.creation_request_hash).toBe(
      createHash('sha256')
        .update(
          JSON.stringify({
            client_request_id: input.client_request_id,
            title: 'Chat',
            selection: null,
          }),
        )
        .digest('hex'),
    );
  });
});
