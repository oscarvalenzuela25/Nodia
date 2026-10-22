import { describe, expect, it } from 'vitest';
import { CreateNodiaAiAttachmentUseCase } from './create-nodia-ai-attachment.use-case.js';
import {
  attachmentIdentity,
  attachmentInput,
  attachmentPolicy,
  makeAttachmentFixture,
} from './attachment.fixture.js';

describe('CreateNodiaAiAttachmentUseCase', () => {
  function setup() {
    const f = makeAttachmentFixture(attachmentPolicy);
    return {
      ...f,
      useCase: new CreateNodiaAiAttachmentUseCase(
        f.attachments,
        f.access,
        f.policy,
      ),
    };
  }
  it('persists a private intent and cleanup identity before any external PUT', async () => {
    const f = setup();
    const result = await f.useCase.execute(attachmentIdentity, attachmentInput);
    expect(result.attachment).toMatchObject({
      kind: 'image',
      state: 'uploading',
      media_type: null,
      byte_count: null,
      interpretation: null,
    });
    expect(result.upload).toMatchObject({
      method: 'PUT',
      path: `/nodia-ai/attachments/${result.attachment.attachment_id}/content`,
    });
    expect(JSON.stringify(result)).not.toContain('storage_key');
    expect(f.row().storage_key).toMatch(/^nodia-ai\//);
    expect(f.attachmentMocks.queueCleanup).toHaveBeenCalledWith(
      f.manager,
      f.row(),
      f.row().expires_at,
    );
    expect(f.query.mock.calls[0][0]).toContain('lock_timeout');
  });
  it('recovers the same immutable intent before quota admission', async () => {
    const f = setup();
    const first = await f.useCase.execute(attachmentIdentity, attachmentInput);
    f.usage.owner_uploads = '1';
    expect(
      await f.useCase.execute(attachmentIdentity, attachmentInput),
    ).toEqual(first);
    expect(f.attachmentMocks.save).toHaveBeenCalledTimes(1);
  });
  it('rejects reused request identity with a different filename', async () => {
    const f = setup();
    await f.useCase.execute(attachmentIdentity, attachmentInput);
    await expect(
      f.useCase.execute(attachmentIdentity, {
        ...attachmentInput,
        file_name: 'other.png',
      }),
    ).rejects.toThrow('request_conflict');
  });
  it.each([
    'chat_bytes',
    'owner_bytes',
    'chat_count',
    'owner_uploads',
    'global_uploads',
  ] as const)(
    'enforces authoritative %s rather than browser counters',
    async (key) => {
      const f = setup();
      f.usage[key] = String(Number.MAX_SAFE_INTEGER);
      await expect(
        f.useCase.execute(attachmentIdentity, attachmentInput),
      ).rejects.toThrow(/attachment_quota|execution_limit/);
      expect(f.attachmentMocks.save).not.toHaveBeenCalled();
    },
  );
  it.each([
    { file_name: '../secret.png' },
    { file_name: 'a\u0000.png' },
    { byte_count: 20971521 },
    { byte_count: '4' },
    { kind: 'video' },
    { storage_key: 'injected' },
  ])('rejects closed or oversized input %j', async (change) => {
    const f = setup();
    await expect(
      f.useCase.execute(attachmentIdentity, { ...attachmentInput, ...change }),
    ).rejects.toThrow('invalid_input');
    expect(f.attachmentMocks.transaction).not.toHaveBeenCalled();
  });
  it('does not reserve when current chat access is denied', async () => {
    const f = setup();
    f.accessMock.execute.mockRejectedValueOnce(new Error('denied'));
    await expect(
      f.useCase.execute(attachmentIdentity, attachmentInput),
    ).rejects.toThrow('denied');
    expect(f.attachmentMocks.save).not.toHaveBeenCalled();
  });
});
