import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DisabledNodiaAiDeletionJournal } from '../../nodia-ai-recovery/types/deletion-journal.js';
import type { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import { CreateNodiaAiAttachmentUseCase } from './create-nodia-ai-attachment.use-case.js';
import { ManageNodiaAiAttachmentUseCase } from './manage-nodia-ai-attachment.use-case.js';
import {
  attachmentIdentity,
  attachmentInput,
  attachmentPolicy,
  makeAttachmentFixture,
} from './attachment.fixture.js';

describe('ManageNodiaAiAttachmentUseCase', () => {
  async function setup(journal = new DisabledNodiaAiDeletionJournal()) {
    const f = makeAttachmentFixture(attachmentPolicy);
    await new CreateNodiaAiAttachmentUseCase(
      f.attachments,
      f.access,
      f.policy,
    ).execute(attachmentIdentity, attachmentInput);
    Object.assign(f.row(), {
      state: 'ready',
      byte_count: '4',
      media_type: 'image/png',
      content_hash: createHash('sha256').update('test').digest('hex'),
    });
    return {
      ...f,
      useCase: new ManageNodiaAiAttachmentUseCase(
        f.attachments,
        f.access,
        f.authorize,
        f.storage,
        f.policy,
        journal,
      ),
    };
  }
  it('stores only human-reviewed text with optimistic revision', async () => {
    const f = await setup();
    const result = await f.useCase.review(attachmentIdentity, f.row().id, {
      text: 'Descripción revisada',
      expected_revision: 0,
    });
    expect(result.interpretation).toEqual({
      text: 'Descripción revisada',
      origin: 'user_reviewed',
      reviewed: true,
      revision: 1,
    });
    await expect(
      f.useCase.review(attachmentIdentity, f.row().id, {
        text: 'Otra',
        expected_revision: 0,
      }),
    ).rejects.toThrow('revision_conflict');
  });
  it('counts UTF8 text derivatives toward chat storage quota', async () => {
    const f = await setup();
    f.usage.chat_bytes = String(f.policy.admission.chat_storage_bytes - 1);
    await expect(
      f.useCase.review(attachmentIdentity, f.row().id, {
        text: 'á',
        expected_revision: 0,
      }),
    ).rejects.toThrow('attachment_quota');
    expect(f.row().interpretation_text).toBeNull();
  });
  it('does not rewrite interpretation once a message owns the attachment', async () => {
    const f = await setup();
    f.attachmentMocks.bound.mockResolvedValue(true);
    await expect(
      f.useCase.review(attachmentIdentity, f.row().id, {
        text: 'rewrite',
        expected_revision: 0,
      }),
    ).rejects.toThrow('attachment_already_bound');
    await expect(
      f.useCase.discard(attachmentIdentity, f.row().id),
    ).rejects.toThrow('attachment_already_bound');
  });
  it('requires explicit review and binds only within the same chat and epoch', async () => {
    const f = await setup();
    const refs = [{ kind: 'image' as const, attachment_id: f.row().id }];
    await expect(
      f.useCase.bindForMessage(
        f.manager,
        attachmentIdentity,
        f.chat as NodiaAiConversation,
        refs,
      ),
    ).rejects.toThrow('attachment_review_required');
    await f.useCase.review(attachmentIdentity, f.row().id, {
      text: 'Contenido',
      expected_revision: 0,
    });
    expect(
      await f.useCase.bindForMessage(
        f.manager,
        attachmentIdentity,
        f.chat as NodiaAiConversation,
        refs,
      ),
    ).toMatchObject([{ text: 'Contenido', kind: 'image' }]);
    f.row().retention_epoch = '2';
    await expect(
      f.useCase.bindForMessage(
        f.manager,
        attachmentIdentity,
        f.chat as NodiaAiConversation,
        refs,
      ),
    ).rejects.toThrow('attachment_not_found');
  });
  it('rejects duplicate attachments and total message bytes above the policy', async () => {
    const f = await setup();
    const ref = { kind: 'image' as const, attachment_id: f.row().id };
    await expect(
      f.useCase.bindForMessage(
        f.manager,
        attachmentIdentity,
        f.chat as NodiaAiConversation,
        [ref, ref],
      ),
    ).rejects.toThrow('invalid_input');
    await f.useCase.review(attachmentIdentity, f.row().id, {
      text: 'Contenido',
      expected_revision: 0,
    });
    f.row().byte_count = String(f.policy.admission.message_files_bytes + 1);
    await expect(
      f.useCase.bindForMessage(
        f.manager,
        attachmentIdentity,
        f.chat as NodiaAiConversation,
        [ref],
      ),
    ).rejects.toThrow('invalid_input');
  });
  it('discards unbound metadata without losing durable cleanup identity', async () => {
    const f = await setup();
    expect(await f.useCase.discard(attachmentIdentity, f.row().id)).toEqual({
      deleted: true,
    });
    expect(f.row().state).toBe('expired');
    expect(f.attachmentMocks.queueCleanup).toHaveBeenCalledTimes(2);
    expect(f.storageMocks.delete).not.toHaveBeenCalled();
  });
  it('records discarded generation outside SQL before acknowledging the deletion', async () => {
    let active = false;
    const journal = Object.assign(new DisabledNodiaAiDeletionJournal(), {
      enabled: true,
      recordResources: vi.fn(async () => { expect(active).toBe(false); }),
    });
    const f = await setup(journal);
    f.attachmentMocks.transaction.mockImplementation(async work => {
      active = true;
      try { return await work(f.manager); } finally { active = false; }
    });
    await expect(f.useCase.discard(attachmentIdentity, f.row().id)).resolves.toEqual({ deleted: true });
    expect(journal.recordResources).toHaveBeenCalledWith({
      deleted_at: f.now.toISOString(),
      resources: [{ kind: 'attachment', conversation_id: f.chat.id, attachment_id: f.row().id, storage_generations: [f.row().generation] }],
    });
  });
  it('does not acknowledge uncertain journal writes and keeps the fenced cleanup intent', async () => {
    const journal = Object.assign(new DisabledNodiaAiDeletionJournal(), {
      enabled: true,
      recordResources: vi.fn().mockRejectedValue(Error('journal unavailable')),
    });
    const f = await setup(journal);
    f.row().interpretation_text = 'private derivative';
    await expect(f.useCase.discard(attachmentIdentity, f.row().id)).rejects.toThrow('journal unavailable');
    expect(f.row().state).toBe('expired');
    expect(f.row().interpretation_text).toBeNull();
    expect(f.attachmentMocks.queueCleanup).toHaveBeenCalledTimes(2);
    expect(f.storageMocks.delete).not.toHaveBeenCalled();
  });
  it('reauthorizes content after storage download before releasing private bytes', async () => {
    const f = await setup();
    f.accessMock.execute
      .mockResolvedValueOnce({
        chat: f.chat,
        now: f.now,
        actor: {
          actorId: '1',
          sessionId: attachmentIdentity.sessionId,
          isSuperAdmin: false,
        },
      })
      .mockRejectedValueOnce(new Error('revoked'));
    await expect(
      f.useCase.content(attachmentIdentity, f.row().id),
    ).rejects.toThrow('revoked');
    expect(f.storageMocks.get).toHaveBeenCalled();
  });
  it('does not read storage or SQL for an already cancelled private download', async () => {
    const f = await setup();
    const controller = new AbortController();
    controller.abort(
      new DOMException('cancelled before storage', 'AbortError'),
    );
    f.attachmentMocks.transaction.mockClear();
    await expect(
      f.useCase.content(attachmentIdentity, f.row().id, controller.signal),
    ).rejects.toThrow('cancelled before storage');
    expect(f.attachmentMocks.transaction).not.toHaveBeenCalled();
    expect(f.storageMocks.get).not.toHaveBeenCalled();
  });
  it('propagates owner cancellation into an active storage read instead of waiting for its timeout', async () => {
    const f = await setup();
    const controller = new AbortController();
    f.storageMocks.get.mockImplementation(async (...args: unknown[]) => {
      const bounded = args[2] as AbortSignal;
      const pending = new Promise<Buffer>((_resolve, reject) =>
        bounded.addEventListener('abort', () => reject(bounded.reason), {
          once: true,
        }),
      );
      controller.abort(
        new DOMException('cancelled during storage', 'AbortError'),
      );
      return pending;
    });
    f.accessMock.execute.mockClear();
    await expect(
      f.useCase.content(attachmentIdentity, f.row().id, controller.signal),
    ).rejects.toThrow('cancelled during storage');
    expect(f.storageMocks.get).toHaveBeenCalledOnce();
    expect(f.accessMock.execute).toHaveBeenCalledOnce();
  });
  it('does not release private bytes if storage resolves after cancellation', async () => {
    const f = await setup();
    const controller = new AbortController();
    f.storageMocks.get.mockImplementation(async () => {
      controller.abort(
        new DOMException('late storage completion', 'AbortError'),
      );
      return Buffer.from('test');
    });
    await expect(
      f.useCase.content(attachmentIdentity, f.row().id, controller.signal),
    ).rejects.toThrow('late storage completion');
  });
  it('reports native modalities as unknown rather than deriving availability from a provider flag', async () => {
    const f = await setup();
    expect(await f.useCase.capabilities(attachmentIdentity)).toMatchObject({
      reviewed_text: true,
      native_modalities: { image: null, pdf: null, audio: null },
      limits: { file_bytes: 20971520 },
    });
  });
});
