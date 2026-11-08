import { describe, expect, it, vi } from 'vitest';
import type { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { UpdateNodiaAiRoutingUseCase } from './update-nodia-ai-routing.use-case.js';
import {
  conversationFixture,
  testChatId,
  testIdentity,
  testNow,
} from './conversation-admission.fixture.js';
function fixture() {
  const f = conversationFixture();
  const target = {
    selection: {
      ...f.selection,
      mode: 'agentic' as const,
      model_id: 'synthetic-agentic',
      effort_id: null,
    },
    configuration_generation: 'a'.repeat(64),
    session_generation: 'b'.repeat(32),
  };
  const original = f.query.getMockImplementation()!;
  f.query.mockImplementation(async (sql) =>
    sql.includes("fields->'agentic'")
      ? [
          {
            configuration: {
              selected_model: target.selection.model_id,
              thinking_level: null,
            },
          },
        ]
      : original(sql),
  );
  const observation = {
    available: true,
    supportsMcp: true,
    observedAt: testNow,
    resourceKey: 'synthetic-agentic-profile',
    configurationGeneration: target.configuration_generation,
    sessionGeneration: target.session_generation,
  };
  const adapter = {
    observe: vi.fn(async () => observation),
    verifyConfiguration: vi.fn(async () => undefined),
  };
  const subject = new UpdateNodiaAiRoutingUseCase(
    f.service,
    f.access,
    f.project,
    adapter as unknown as NodiaAiAdapterPort,
    f.policy,
  );
  const input = {
    expected_conversation_revision: 1,
    expected_routing_revision: 1,
    enabled: true,
    target,
  };
  return { ...f, target, observation, adapter, subject, input };
}
describe('UpdateNodiaAiRoutingUseCase', () => {
  it.each([
    { enabled: true },
    { enabled: false },
    { enabled: true, target: null },
    {
      enabled: false,
      target: {
        selection: {
          connection_id: '9',
          mode: 'api_key',
          model_id: 'another',
          effort_id: null,
        },
        configuration_generation: 'a'.repeat(64),
        session_generation: 'b'.repeat(32),
      },
    },
  ])(
    'rejects retired delegation configuration before SQL or observation: %j',
    async (patch) => {
      const f = fixture();
      await expect(
        f.subject.execute(testIdentity, testChatId, { ...f.input, ...patch }),
      ).rejects.toThrow('nodia_ai:invalid_input');
      expect(f.conversations.transaction).not.toHaveBeenCalled();
      expect(f.adapter.observe).not.toHaveBeenCalled();
      expect(f.conversations.save).not.toHaveBeenCalled();
    },
  );
  it('withdraws historical consent during an active job without requiring a provider', async () => {
    const f = fixture();
    const expiry = f.chat.expires_at;
    f.chat.active_job_id = testChatId;
    f.chat.routing_enabled = true;
    f.chat.routing_target_selection = f.target;
    f.adapter.observe.mockRejectedValueOnce(new Error('offline'));
    const result = await f.subject.execute(testIdentity, testChatId, {
      ...f.input,
      enabled: false,
      target: null,
    });
    expect(result.routing).toEqual({
      schema_version: 1,
      enabled: false,
      revision: 2,
      target: null,
    });
    expect(result.revision).toBe(2);
    expect(f.chat.expires_at).toBe(expiry);
    expect(f.chat.last_owner_message_at).toBeNull();
    expect(f.adapter.observe).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('conversation.routing.updated'),
      ),
    ).toBe(true);
  });
  it.each([
    'expected_conversation_revision',
    'expected_routing_revision',
  ] as const)(
    'rejects stale %s before persisting withdrawal',
    async (field) => {
      const f = fixture();
      await expect(
        f.subject.execute(testIdentity, testChatId, {
          ...f.input,
          enabled: false,
          target: null,
          [field]: 2,
        }),
      ).rejects.toThrow('nodia_ai:revision_conflict');
      expect(f.conversations.save).not.toHaveBeenCalled();
      expect(f.adapter.observe).not.toHaveBeenCalled();
    },
  );
  it('rechecks revisions between short authority transactions before withdrawal', async () => {
    const f = fixture();
    f.conversations.transaction.mockImplementationOnce(async (work) => {
      const result = await work(f.manager);
      f.chat.revision = 2;
      return result;
    });
    await expect(
      f.subject.execute(testIdentity, testChatId, {
        ...f.input,
        enabled: false,
        target: null,
      }),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    expect(f.conversations.save).not.toHaveBeenCalled();
  });
  it('never lets super_admin withdraw consent as another chat owner', async () => {
    const f = fixture();
    f.actor.isSuperAdmin = true;
    f.chat.owner_id = '2';
    await expect(
      f.subject.execute(testIdentity, testChatId, {
        ...f.input,
        enabled: false,
        target: null,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.conversations.save).not.toHaveBeenCalled();
    expect(f.adapter.observe).not.toHaveBeenCalled();
  });
});
