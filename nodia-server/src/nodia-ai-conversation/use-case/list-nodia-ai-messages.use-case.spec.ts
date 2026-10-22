import { describe, expect, it } from 'vitest';
import {
  ListNodiaAiMessagesUseCase,
  canReadNodiaAiManifest,
} from './list-nodia-ai-messages.use-case.js';
import {
  conversationFixture,
  testChatId,
  testIdentity,
  testNow,
} from './conversation-admission.fixture.js';
import { NodiaAiMessage } from '../entities/nodia-ai-message.entity.js';
describe('ListNodiaAiMessagesUseCase', () => {
  it('links both owner and assistant messages with one batched lookup without loading restricted text', async () => {
    const f = conversationFixture();
    const userId = 'ee10c18a-2272-41e8-b925-90a64f54bb31';
    const assistantId = 'ee10c18a-2272-41e8-b925-90a64f54bb32';
    const runId = 'ee10c18a-2272-41e8-b925-90a64f54bb33';
    f.conversations.messages.mockResolvedValueOnce(
      [userId, assistantId].map((id, i) =>
        Object.assign(new NodiaAiMessage(), {
          id,
          seq: String(i + 1),
          role: i === 0 ? 'user' : 'assistant',
          status: 'sealed',
          created_at: testNow,
          sealed_at: testNow,
          author_id: i === 0 ? '1' : null,
          source_scope_manifest: {
            schema_version: 1,
            module_routes: i === 0 ? [] : ['/finance'],
          },
        }),
      ),
    );
    f.conversations.messageRuns.mockResolvedValueOnce([
      { id: runId, user_message_id: userId, assistant_message_id: assistantId },
    ]);
    const result = await new ListNodiaAiMessagesUseCase(
      f.service,
      f.access,
      f.policy,
    ).execute(testIdentity, testChatId, {});
    expect(result.items.map((message) => message.run_id)).toEqual([
      runId,
      runId,
    ]);
    expect(result.items.map((message) => message.visibility)).toEqual([
      'visible',
      'restricted',
    ]);
    expect(f.conversations.messageRuns).toHaveBeenCalledExactlyOnceWith(
      f.manager,
      [userId, assistantId],
    );
    expect(f.conversations.parts).toHaveBeenCalledExactlyOnceWith(f.manager, [
      userId,
    ]);
    expect(result.items[1]).not.toHaveProperty('parts');
  });
  it('rejects ambiguous historical run associations rather than linking an arbitrary run', async () => {
    const f = conversationFixture();
    f.conversations.messages.mockResolvedValueOnce([
      Object.assign(new NodiaAiMessage(), {
        id: testChatId,
        seq: '1',
        role: 'assistant',
        status: 'sealed',
        created_at: testNow,
        source_scope_manifest: { schema_version: 1, module_routes: [] },
      }),
    ]);
    f.conversations.messageRuns.mockResolvedValueOnce([
      {
        id: 'run-a',
        user_message_id: 'other-a',
        assistant_message_id: testChatId,
      },
      {
        id: 'run-b',
        user_message_id: 'other-b',
        assistant_message_id: testChatId,
      },
    ]);
    await expect(
      new ListNodiaAiMessagesUseCase(f.service, f.access, f.policy).execute(
        testIdentity,
        testChatId,
        {},
      ),
    ).rejects.toThrow('invalid_persisted_state');
  });
  it('returns the latest bounded window chronologically and uses an older cursor isolated from forward pagination', async () => {
    const f = conversationFixture();
    const messages = [
      '9007199254740995',
      '9007199254740994',
      '9007199254740993',
    ].map((seq) =>
      Object.assign(new NodiaAiMessage(), {
        id: testChatId,
        seq,
        role: 'user',
        status: 'sealed',
        created_at: testNow,
        sealed_at: testNow,
        author_id: '1',
        source_scope_manifest: { schema_version: 1, module_routes: [] },
      }),
    );
    f.conversations.messages.mockResolvedValueOnce(messages);
    const subject = new ListNodiaAiMessagesUseCase(
      f.service,
      f.access,
      f.policy,
    );
    const page = await subject.execute(testIdentity, testChatId, {
      direction: 'backward',
      page_limit: 2,
    });
    expect(page.items.map((message) => message.seq)).toEqual([
      '9007199254740994',
      '9007199254740995',
    ]);
    await subject.execute(testIdentity, testChatId, {
      direction: 'backward',
      page_limit: 2,
      cursor: page.next_cursor,
    });
    expect(f.conversations.messages).toHaveBeenLastCalledWith(
      f.manager,
      testChatId,
      '9007199254740994',
      2,
      'backward',
    );
    await expect(
      subject.execute(testIdentity, testChatId, { cursor: page.next_cursor }),
    ).rejects.toThrow('nodia_ai:invalid_cursor');
  });
  it.each([
    {},
    null,
    { schema_version: 1, module_routes: [], secret: 'synthetic' },
    { schema_version: 1, module_routes: ['/finances/personal'] },
    { schema_version: 1, module_routes: [2] },
  ])('restricts invalid or no longer authorized manifests %j', (input) => {
    expect(canReadNodiaAiManifest(input, ['/tools/nodia-ai'])).toBe(false);
  });
  it('permits closed empty or currently authorized source manifests', () => {
    expect(
      canReadNodiaAiManifest({ schema_version: 1, module_routes: [] }, []),
    ).toBe(true);
    expect(
      canReadNodiaAiManifest(
        { schema_version: 1, module_routes: ['/tools/nodia-ai'] },
        ['/tools/nodia-ai'],
      ),
    ).toBe(true);
  });
  it('returns restricted placeholders without loading text from revoked scopes', async () => {
    const f = conversationFixture();
    const message = Object.assign(new NodiaAiMessage(), {
      id: testChatId,
      seq: '1',
      role: 'assistant',
      status: 'sealed',
      created_at: testNow,
      sealed_at: testNow,
      author_id: null,
      source_scope_manifest: {
        schema_version: 1,
        module_routes: ['/finances/personal'],
      },
    });
    f.conversations.messages.mockResolvedValueOnce([message]);
    const subject = new ListNodiaAiMessagesUseCase(
      f.service,
      f.access,
      f.policy,
    );
    const result = await subject.execute(testIdentity, testChatId, {});
    expect(result.items[0]).toEqual({
      message_id: testChatId,
      run_id: null,
      seq: '1',
      role: 'assistant',
      status: 'sealed',
      created_at: testNow.toISOString(),
      visibility: 'restricted',
    });
    expect(f.conversations.parts).toHaveBeenCalledWith(f.manager, []);
  });
  it('binds cursors to current actor/session/chat/epoch and preserves bigint sequence strings', async () => {
    const f = conversationFixture();
    const messages = ['9007199254740993', '9007199254740994'].map((seq) =>
      Object.assign(new NodiaAiMessage(), {
        id: testChatId,
        seq,
        role: 'user',
        status: 'sealed',
        created_at: testNow,
        sealed_at: testNow,
        author_id: '1',
        source_scope_manifest: { schema_version: 1, module_routes: [] },
      }),
    );
    f.conversations.messages.mockResolvedValueOnce(messages);
    const subject = new ListNodiaAiMessagesUseCase(
      f.service,
      f.access,
      f.policy,
    );
    const page = await subject.execute(testIdentity, testChatId, {
      page_limit: 1,
    });
    expect(page.items[0].seq).toBe('9007199254740993');
    await subject.execute(testIdentity, testChatId, {
      page_limit: 1,
      cursor: page.next_cursor,
    });
    expect(f.conversations.messages).toHaveBeenLastCalledWith(
      f.manager,
      testChatId,
      '9007199254740993',
      1,
    );
    f.chat.retention_epoch = '2';
    await expect(
      subject.execute(testIdentity, testChatId, {
        page_limit: 1,
        cursor: page.next_cursor,
      }),
    ).rejects.toThrow('nodia_ai:invalid_cursor');
  });
});
