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
      mode: 'token_plan_agentic' as const,
      model_id: 'synthetic-agentic',
      effort_id: null,
    },
    configuration_generation: 'a'.repeat(64),
    session_generation: 'b'.repeat(32),
  };
  const original = f.query.getMockImplementation()!;
  f.query.mockImplementation(async (sql) =>
    sql.includes("fields->'token_plan_agentic'")
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
  it('saves explicit exact same-connection Agentic consent with a live verified MCP observation', async () => {
    const f = fixture(),
      expiry = f.chat.expires_at;
    const result = await f.subject.execute(testIdentity, testChatId, f.input);
    expect(result.routing).toEqual({
      schema_version: 1,
      enabled: true,
      revision: 2,
      target: f.target,
    });
    expect(result.revision).toBe(2);
    expect(f.chat.expires_at).toBe(expiry);
    expect(f.chat.last_owner_message_at).toBeNull();
    expect(f.adapter.observe).toHaveBeenCalledWith(f.target.selection);
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('conversation.routing.updated'),
      ),
    ).toBe(true);
  });
  it('withdraws consent during an active job without requiring the broken provider', async () => {
    const f = fixture();
    f.chat.active_job_id = testChatId;
    f.chat.routing_enabled = true;
    f.chat.routing_target_selection = f.target;
    f.adapter.observe.mockRejectedValueOnce(new Error('offline'));
    const result = await f.subject.execute(testIdentity, testChatId, {
      ...f.input,
      enabled: false,
      target: null,
    });
    expect(result.routing.enabled).toBe(false);
    expect(result.routing.revision).toBe(2);
    expect(f.adapter.observe).not.toHaveBeenCalled();
  });
  it('does not enable while a job has frozen the base selection', async () => {
    const f = fixture();
    f.chat.active_job_id = testChatId;
    await expect(
      f.subject.execute(testIdentity, testChatId, f.input),
    ).rejects.toThrow('nodia_ai:conversation_busy');
    expect(f.adapter.observe).not.toHaveBeenCalled();
  });
  it.each(['api_key', 'token_plan_agentic'] as const)(
    'enables only from Web, not %s',
    async (mode) => {
      const f = fixture();
      f.chat.selected_mode = mode;
      await expect(
        f.subject.execute(testIdentity, testChatId, f.input),
      ).rejects.toThrow('nodia_ai:invalid_selection');
    },
  );
  it('does not substitute an API destination or another connection', async () => {
    const f = fixture();
    for (const selection of [
      { ...f.target.selection, mode: 'api_key' },
      { ...f.target.selection, connection_id: '9' },
    ])
      await expect(
        f.subject.execute(testIdentity, testChatId, {
          ...f.input,
          target: { ...f.target, selection },
        }),
      ).rejects.toThrow('nodia_ai:invalid_selection');
    expect(f.conversations.save).not.toHaveBeenCalled();
  });
  it('requires the model/effort configured for that connection instead of the first discovered model', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql) =>
      sql.includes("fields->'token_plan_agentic'")
        ? [{ configuration: { selected_model: 'another-configured-model' } }]
        : [],
    );
    await expect(
      f.subject.execute(testIdentity, testChatId, f.input),
    ).rejects.toThrow('nodia_ai:invalid_selection');
    expect(f.adapter.observe).not.toHaveBeenCalled();
  });
  it.each(['available', 'supportsMcp'] as const)(
    'does not treat an absent %s proof as valid Agentic eligibility',
    async (field) => {
      const f = fixture();
      f.observation[field] = false;
      await expect(
        f.subject.execute(testIdentity, testChatId, f.input),
      ).rejects.toMatchObject({ status: 503 });
      expect(f.conversations.save).not.toHaveBeenCalled();
    },
  );
  it('rejects a stale or changed provider/session observation', async () => {
    const f = fixture();
    f.observation.sessionGeneration = 'changed';
    await expect(
      f.subject.execute(testIdentity, testChatId, f.input),
    ).rejects.toThrow('nodia_ai:eligibility_changed');
    expect(f.conversations.save).not.toHaveBeenCalled();
  });
  it('rejects revoked authority or a changed revision after observation', async () => {
    const f = fixture();
    f.adapter.observe.mockImplementationOnce(async () => {
      f.chat.revision = 2;
      return f.observation;
    });
    await expect(
      f.subject.execute(testIdentity, testChatId, f.input),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    expect(f.conversations.save).not.toHaveBeenCalled();
  });
  it('never lets super_admin configure consent as another chat owner', async () => {
    const f = fixture();
    f.actor.isSuperAdmin = true;
    f.chat.owner_id = '2';
    await expect(
      f.subject.execute(testIdentity, testChatId, f.input),
    ).rejects.toMatchObject({ status: 403 });
  });
});
