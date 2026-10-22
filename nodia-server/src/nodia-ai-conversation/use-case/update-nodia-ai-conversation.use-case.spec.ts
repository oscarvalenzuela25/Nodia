import { describe, expect, it } from 'vitest';
import { UpdateNodiaAiConversationUseCase } from './update-nodia-ai-conversation.use-case.js';
import {
  conversationFixture,
  testChatId,
  testIdentity,
} from './conversation-admission.fixture.js';
function setup() {
  const f = conversationFixture();
  return {
    ...f,
    subject: new UpdateNodiaAiConversationUseCase(
      f.service,
      f.access,
      f.project,
    ),
  };
}
describe('UpdateNodiaAiConversationUseCase', () => {
  it('changes metadata without extending retention or impersonating owner', async () => {
    const f = setup();
    const expiry = f.chat.expires_at;
    const result = await f.subject.execute(testIdentity, testChatId, {
      expected_conversation_revision: 1,
      title: null,
      is_pinned: true,
      is_archived: true,
    });
    expect(result.title).toBeNull();
    expect(result.is_pinned).toBe(true);
    expect(result.is_archived).toBe(true);
    expect(result.revision).toBe(2);
    expect(f.chat.expires_at).toBe(expiry);
    expect(f.chat.last_owner_message_at).toBeNull();
  });
  it.each([
    { expected_conversation_revision: 1 },
    { expected_conversation_revision: 1, title: '' },
    { expected_conversation_revision: 1, owner_id: '2' },
  ])('rejects absent edits and invalid metadata %j', async (input) => {
    const f = setup();
    await expect(
      f.subject.execute(testIdentity, testChatId, input),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.conversations.save).not.toHaveBeenCalled();
  });
  it('refuses stale revisions and active jobs without changes', async () => {
    const f = setup();
    await expect(
      f.subject.execute(testIdentity, testChatId, {
        expected_conversation_revision: 2,
        title: 'Later',
      }),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    f.chat.active_job_id = testChatId;
    await expect(
      f.subject.execute(testIdentity, testChatId, {
        expected_conversation_revision: 1,
        title: 'Later',
      }),
    ).rejects.toThrow('nodia_ai:conversation_busy');
    expect(f.chat.title).toBe('Synthetic chat');
  });
  it('stores exact selected preferences and invalidates previous routing without clearing history or renewal', async () => {
    const f = setup();
    f.chat.routing_enabled = true;
    f.chat.routing_target_selection = {
      selection: { ...f.selection, mode: 'token_plan_agentic' },
      configuration_generation: 'synthetic',
      session_generation: 'synthetic',
    };
    const expiry = f.chat.expires_at;
    const result = await f.subject.selection(testIdentity, testChatId, {
      expected_conversation_revision: 1,
      selection: { ...f.selection, model_id: 'synthetic-new-model' },
    });
    expect(result.selection?.model_id).toBe('synthetic-new-model');
    expect(result.routing).toEqual({
      schema_version: 1,
      enabled: false,
      revision: 2,
      target: null,
    });
    expect(f.chat.expires_at).toBe(expiry);
    expect(f.chat.next_message_seq).toBe('0');
  });
});
