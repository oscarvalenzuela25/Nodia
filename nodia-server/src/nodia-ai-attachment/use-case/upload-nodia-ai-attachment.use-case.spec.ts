import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { CreateNodiaAiAttachmentUseCase } from './create-nodia-ai-attachment.use-case.js';
import { UploadNodiaAiAttachmentUseCase } from './upload-nodia-ai-attachment.use-case.js';
import {
  attachmentIdentity,
  attachmentInput,
  attachmentPolicy,
  makeAttachmentFixture,
} from './attachment.fixture.js';

describe('UploadNodiaAiAttachmentUseCase', () => {
  async function setup() {
    const f = makeAttachmentFixture(attachmentPolicy);
    await new CreateNodiaAiAttachmentUseCase(
      f.attachments,
      f.access,
      f.policy,
    ).execute(attachmentIdentity, attachmentInput);
    return {
      ...f,
      useCase: new UploadNodiaAiAttachmentUseCase(
        f.attachments,
        f.access,
        f.inspector,
        f.storage,
        f.policy,
      ),
    };
  }
  it('spools bounded bytes, inspects, PUTs once and publishes metadata only after commit', async () => {
    const f = await setup();
    const result = await f.useCase.execute(
      attachmentIdentity,
      f.row().id,
      Readable.from([Buffer.from('test')]),
      'application/octet-stream',
      '4',
    );
    expect(result).toMatchObject({
      state: 'ready',
      media_type: 'image/png',
      byte_count: 4,
      interpretation: null,
    });
    expect(f.storageMocks.put).toHaveBeenCalledTimes(1);
    expect(
      f.attachmentMocks.queueCleanup.mock.invocationCallOrder[1],
    ).toBeLessThan(f.storageMocks.put.mock.invocationCallOrder[0]);
    expect(
      f.query.mock.calls.some((call) =>
        call[0].startsWith('DELETE FROM nodia_ai_jobs'),
      ),
    ).toBe(true);
  });
  it.each(['tes', 'test!'])(
    'rejects actual size %s without an external PUT',
    async (data) => {
      const f = await setup();
      await expect(
        f.useCase.execute(
          attachmentIdentity,
          f.row().id,
          Readable.from([Buffer.from(data)]),
          'application/octet-stream',
        ),
      ).rejects.toThrow('invalid_input');
      expect(f.storageMocks.put).not.toHaveBeenCalled();
      expect(f.row().state).toBe('rejected');
    },
  );
  it('retains cleanup after a PUT with an uncertain outcome and never retries the inference or PUT', async () => {
    const f = await setup();
    f.storageMocks.put.mockRejectedValueOnce(
      new Error('connection lost after send'),
    );
    await expect(
      f.useCase.execute(
        attachmentIdentity,
        f.row().id,
        Readable.from([Buffer.from('test')]),
        'application/octet-stream',
      ),
    ).rejects.toThrow('attachment_upload_unavailable');
    expect(f.row().state).toBe('rejected');
    expect(f.attachmentMocks.queueCleanup).toHaveBeenCalledTimes(2);
    expect(
      f.query.mock.calls.some((call) =>
        call[0].startsWith('DELETE FROM nodia_ai_jobs'),
      ),
    ).toBe(false);
    await expect(
      f.useCase.execute(
        attachmentIdentity,
        f.row().id,
        Readable.from([Buffer.from('test')]),
        'application/octet-stream',
      ),
    ).rejects.toThrow('attachment_not_ready');
    expect(f.storageMocks.put).toHaveBeenCalledTimes(1);
  });
  it('rejects parser metadata inconsistent with the claimed kind before PUT', async () => {
    const f = await setup();
    f.inspectorMocks.inspect.mockResolvedValueOnce({
      mediaType: 'application/pdf',
      pageCount: 2,
      durationSeconds: null,
      extractedText: null,
    });
    await expect(
      f.useCase.execute(
        attachmentIdentity,
        f.row().id,
        Readable.from([Buffer.from('test')]),
        'application/octet-stream',
      ),
    ).rejects.toThrow('attachment_content_invalid');
    expect(f.storageMocks.put).not.toHaveBeenCalled();
  });
  it('preserves a real PDF extraction as unreviewed data', async () => {
    const f = await setup();
    f.row().kind = 'pdf';
    f.inspectorMocks.inspect.mockResolvedValueOnce({
      mediaType: 'application/pdf',
      pageCount: 2,
      durationSeconds: null,
      extractedText: 'Contenido real',
    });
    const result = await f.useCase.execute(
      attachmentIdentity,
      f.row().id,
      Readable.from([Buffer.from('test')]),
      'application/octet-stream',
    );
    expect(result.interpretation).toEqual({
      text: 'Contenido real',
      origin: 'extracted',
      reviewed: false,
      revision: 1,
    });
  });
  it('does not publish after chat epoch changes during external PUT', async () => {
    const f = await setup();
    f.storageMocks.put.mockImplementationOnce(async () => {
      f.chat.retention_epoch = '2';
    });
    await expect(
      f.useCase.execute(
        attachmentIdentity,
        f.row().id,
        Readable.from([Buffer.from('test')]),
        'application/octet-stream',
      ),
    ).rejects.toThrow('attachment_not_ready');
    expect(f.row().state).toBe('rejected');
  });
  it('does not accept a second worker while the generation is already processing', async () => {
    const f = await setup();
    f.row().processing_started_at = f.now;
    await expect(
      f.useCase.execute(
        attachmentIdentity,
        f.row().id,
        Readable.from([Buffer.from('test')]),
        'application/octet-stream',
      ),
    ).rejects.toThrow('attachment_not_ready');
    expect(f.storageMocks.put).not.toHaveBeenCalled();
  });
  it.each(['image/png', 'application/json', undefined])(
    'rejects transport content type %s',
    async (type) => {
      const f = await setup();
      await expect(
        f.useCase.execute(
          attachmentIdentity,
          f.row().id,
          Readable.from([]),
          type,
        ),
      ).rejects.toThrow('invalid_input');
      expect(f.inspectorMocks.inspect).not.toHaveBeenCalled();
    },
  );
});
