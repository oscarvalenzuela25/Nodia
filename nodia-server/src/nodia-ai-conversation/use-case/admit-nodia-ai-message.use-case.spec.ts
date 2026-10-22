import { describe, expect, it, vi } from 'vitest';
import type { ManageNodiaAiAttachmentUseCase } from '../../nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.js';
import { AdmitNodiaAiMessageUseCase } from './admit-nodia-ai-message.use-case.js';
import {
  conversationFixture,
  testChatId,
  testIdentity,
  testNow,
} from './conversation-admission.fixture.js';
const input = {
  client_message_id: 'e85f40b3-387e-4de0-a83e-0c617d8751ee',
  expected_conversation_revision: 1,
  parts: [{ kind: 'text', text: 'Consulta sintética' }],
};
function setup() {
  const f = conversationFixture();
  return {
    ...f,
    subject: new AdmitNodiaAiMessageUseCase(
      f.service,
      f.access,
      f.project,
      f.runs,
      f.preparer,
      f.policy,
    ),
  };
}
describe('AdmitNodiaAiMessageUseCase', () => {
  it('admits a sealed owner message, immutable run, bounded grant and one ready context job', async () => {
    const f = setup();
    const result = await f.subject.execute(testIdentity, testChatId, input);
    expect(result?.run.selection).toEqual(f.selection);
    expect(result?.conversation_revision).toBe(2);
    expect(f.journal.events).toHaveLength(1);
    expect(f.journal.events[0].public_payload).toEqual({
      kind: 'run_accepted',
      payload: { message_id: result.message_id, run_revision: 1 },
    });
    expect(JSON.stringify(f.journal.events)).not.toContain(
      'Consulta sintética',
    );
    expect(f.chat.last_owner_message_at).toEqual(testNow);
    expect(f.chat.expires_at.toISOString()).toBe('2027-01-13T10:00:00.000Z');
    expect(f.chat.active_job_id).toBeTruthy();
    expect(f.save.mock.calls.map(([row]) => row)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'turn',
          stage_key: 'context',
          state: 'ready',
        }),
        expect.objectContaining({
          policy_version: f.policy.policyVersion,
          session_public_id: testIdentity.sessionId,
          allowed_operations: [],
        }),
      ]),
    );
    const queries = f.query.mock.calls.map(([sql]) => sql);
    expect(queries.findIndex((sql) => sql.includes('LOCK TABLE'))).toBeLessThan(
      queries.findIndex((sql) => sql.includes('foreground-admission')),
    );
  });
  it('recovers a retry before stale revision, busy state, observation and capacity checks; no retention renewal', async () => {
    const f = setup();
    const first = await f.subject.execute(testIdentity, testChatId, input);
    f.chat.revision = 5;
    const expiry = f.chat.expires_at;
    const second = await f.subject.execute(testIdentity, testChatId, {
      ...input,
      client_message_id: input.client_message_id.toUpperCase(),
    });
    expect(second).toEqual(first);
    expect(f.journal.events).toHaveLength(1);
    expect(f.preparer.observe).toHaveBeenCalledOnce();
    expect(f.preparer.prepare).toHaveBeenCalledOnce();
    expect(f.chat.expires_at).toBe(expiry);
  });
  it('rejects identity reuse for different content without another observation or insert', async () => {
    const f = setup();
    await f.subject.execute(testIdentity, testChatId, input);
    await expect(
      f.subject.execute(testIdentity, testChatId, {
        ...input,
        parts: [{ kind: 'text', text: 'Different' }],
      }),
    ).rejects.toThrow('nodia_ai:request_conflict');
    expect(f.preparer.observe).toHaveBeenCalledOnce();
  });
  it('rechecks revision after external observation before persisting anything', async () => {
    const f = setup();
    f.preparer.observe.mockImplementationOnce(async () => {
      f.chat.revision = 2;
      return { synthetic: true };
    });
    await expect(
      f.subject.execute(testIdentity, testChatId, input),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    expect(f.save).not.toHaveBeenCalled();
  });
  it('does not admit under revoked authority after observing the provider', async () => {
    const f = setup();
    f.preparer.observe.mockImplementationOnce(async () => {
      f.authorize.execute.mockRejectedValueOnce(new Error('revoked'));
      return { synthetic: true };
    });
    await expect(
      f.subject.execute(testIdentity, testChatId, input),
    ).rejects.toThrow('revoked');
    expect(f.save).not.toHaveBeenCalled();
  });
  it.each([
    { owner_waiting: '2', global_waiting: '2' },
    { owner_waiting: '0', global_waiting: '32' },
  ])(
    'rejects queue saturation without durable effects (%j)',
    async (counts) => {
      const f = setup();
      f.query.mockImplementation(async (sql) =>
        sql.includes('global_waiting') ? [counts] : [],
      );
      await expect(
        f.subject.execute(testIdentity, testChatId, input),
      ).rejects.toMatchObject({ status: 429 });
      expect(f.save).not.toHaveBeenCalled();
      expect(f.preparer.prepare).not.toHaveBeenCalled();
    },
  );
  it('rejects unavailable provider before durable message or activity changes', async () => {
    const f = setup();
    f.preparer.observe.mockRejectedValueOnce(new Error('unavailable'));
    await expect(
      f.subject.execute(testIdentity, testChatId, input),
    ).rejects.toThrow('unavailable');
    expect(f.save).not.toHaveBeenCalled();
    expect(f.chat.revision).toBe(1);
  });
  it.each(['chat', 'owner'])(
    'rejects %s text storage exhaustion without persisting an incomplete admission',
    async (kind) => {
      const f = setup();
      f.query.mockImplementation(async (sql) =>
        sql.includes('global_waiting')
          ? [{ global_waiting: '0', owner_waiting: '0' }]
          : sql.includes('chat_bytes')
            ? [
                {
                  chat_bytes:
                    kind === 'chat'
                      ? String(f.policy.admission.chat_storage_bytes)
                      : '0',
                  owner_bytes:
                    kind === 'owner'
                      ? String(f.policy.admission.owner_storage_bytes)
                      : '0',
                },
              ]
            : [],
      );
      await expect(
        f.subject.execute(testIdentity, testChatId, input),
      ).rejects.toMatchObject({ status: 429 });
      expect(f.save).not.toHaveBeenCalled();
      expect(f.preparer.prepare).not.toHaveBeenCalled();
    },
  );
  it('rejects missing attachment subsystem and unknown fields before any transaction', async () => {
    const f = setup();
    await expect(
      f.subject.execute(testIdentity, testChatId, {
        ...input,
        parts: [{ kind: 'pdf', attachment_id: testChatId }],
      }),
    ).rejects.toThrow('nodia_ai:modality_unavailable');
    await expect(
      f.subject.execute(testIdentity, testChatId, { ...input, actor_id: '2' }),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.conversations.transaction).not.toHaveBeenCalled();
  });
  it('limits combined UTF-8 bytes across individually valid text parts', async () => {
    const f = setup();
    await expect(
      f.subject.execute(testIdentity, testChatId, {
        ...input,
        parts: [
          { kind: 'text', text: 'á'.repeat(8193) },
          { kind: 'text', text: 'á'.repeat(8193) },
        ],
      }),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.conversations.transaction).not.toHaveBeenCalled();
  });
  it('rejects expired chat before observing the provider and does not revive it', async () => {
    const f = setup();
    f.chat.expires_at = testNow;
    await expect(
      f.subject.execute(testIdentity, testChatId, input),
    ).rejects.toMatchObject({ status: 410 });
    expect(f.preparer.observe).not.toHaveBeenCalled();
  });
});

describe('AI-32 attachment admission', () => {
  function attachmentSetup(
    text: string | null,
    verified: string[] = [],
    formats: string[] = verified.includes('pdf') ? ['application/pdf'] : [],
    kind: 'pdf' | 'image' | 'audio' = 'pdf',
  ) {
    const f = conversationFixture();
    const file = {
      attachment_id: testChatId,
      kind,
      text,
      metadata: {
        media_type: {
          pdf: 'application/pdf',
          image: 'image/png',
          audio: 'audio/webm',
        }[kind],
        interpretation: text ? { text, reviewed: true, revision: 1 } : null,
      },
    };
    const attachments = {
      bindForMessage: vi
        .fn()
        .mockImplementation(async () => [structuredClone(file)]),
      usageForAdmission: vi
        .fn()
        .mockResolvedValue({ chat_bytes: '0', owner_bytes: '0' }),
    };
    f.preparer.prepare.mockImplementation(async () => ({
      selection: f.selection,
      catalogVersion: 'synthetic-catalog/1',
      contextManifest: {
        schema_version: 1,
        verified_modalities: verified,
        verified_attachment_media_types: formats,
      },
      grantScope: { conversation_id: testChatId },
      allowedModules: ['2'],
      allowedOperations: [],
    }));
    const subject = new AdmitNodiaAiMessageUseCase(
      f.service,
      f.access,
      f.project,
      f.runs,
      f.preparer,
      f.policy,
      attachments as unknown as ManageNodiaAiAttachmentUseCase,
    );
    return {
      ...f,
      attachments,
      file,
      subject,
      payload: {
        ...input,
        parts: [{ kind, attachment_id: testChatId }],
      },
    };
  }
  it('freezes reviewed real text without requiring native modality and recovers the original admission', async () => {
    const f = attachmentSetup('Extracted then reviewed by owner');
    const result = await f.subject.execute(testIdentity, testChatId, f.payload);
    expect(f.insert.mock.calls[0][0][0]).toMatchObject({
      kind: 'pdf',
      attachment_id: testChatId,
      text: f.file.text,
    });
    expect(
      await f.subject.execute(testIdentity, testChatId, f.payload),
    ).toEqual(result);
    expect(f.attachments.bindForMessage).toHaveBeenCalledTimes(2);
  });
  it('rejects unreviewed files before any write when the exact kind lacks proof', async () => {
    const f = attachmentSetup(null, ['image']);
    await expect(
      f.subject.execute(testIdentity, testChatId, f.payload),
    ).rejects.toThrow('nodia_ai:attachment_review_required');
    expect(f.save).not.toHaveBeenCalled();
  });
  it('admits a native file with null interpretation only with trusted exact kind proof', async () => {
    const f = attachmentSetup(null, ['pdf']);
    await f.subject.execute(testIdentity, testChatId, f.payload);
    expect(f.insert.mock.calls[0][0][0]).toMatchObject({
      kind: 'pdf',
      attachment_id: testChatId,
      text: null,
    });
  });
  it('rejects a different format even with a trusted category summary', async () => {
    for (const [kind, proved, actual] of [
      ['image', 'image/png', 'image/jpeg'],
      ['audio', 'audio/wav', 'audio/webm'],
    ] as const) {
      const f = attachmentSetup(null, [kind], [proved], kind);
      f.file.metadata.media_type = actual;
      await expect(
        f.subject.execute(testIdentity, testChatId, f.payload),
      ).rejects.toThrow('nodia_ai:attachment_review_required');
      expect(f.save).not.toHaveBeenCalled();
      expect(f.insert).not.toHaveBeenCalled();
    }
  });
  it('keeps a legacy category-only manifest unknown rather than authorizing a native original', async () => {
    const f = attachmentSetup(null, ['pdf']);
    f.preparer.prepare.mockImplementation(async () => ({
      selection: f.selection,
      catalogVersion: 'synthetic-catalog/1',
      contextManifest: { schema_version: 1, verified_modalities: ['pdf'] },
      grantScope: { conversation_id: testChatId },
      allowedModules: ['2'],
      allowedOperations: [],
    }));
    await expect(
      f.subject.execute(testIdentity, testChatId, f.payload),
    ).rejects.toThrow('nodia_ai:attachment_review_required');
    expect(f.save).not.toHaveBeenCalled();
  });
  it('rejects revision changes during provider observation without sealing stale interpretation', async () => {
    const f = attachmentSetup('Initial review');
    f.preparer.observe.mockImplementation(async () => {
      f.file.text = 'Changed after preflight';
      return { synthetic: true };
    });
    await expect(
      f.subject.execute(testIdentity, testChatId, f.payload),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    expect(f.save).not.toHaveBeenCalled();
  });
  it('applies combined attachment and message storage quota before admission', async () => {
    const f = attachmentSetup('Reviewed');
    f.attachments.usageForAdmission.mockResolvedValue({
      chat_bytes: String(f.policy.admission.chat_storage_bytes),
      owner_bytes: '0',
    });
    await expect(
      f.subject.execute(testIdentity, testChatId, f.payload),
    ).rejects.toMatchObject({ status: 429 });
    expect(f.save).not.toHaveBeenCalled();
  });
});
