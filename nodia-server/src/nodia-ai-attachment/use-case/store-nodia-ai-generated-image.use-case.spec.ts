import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeNodiaAiGeneratedImage, NODIA_AI_GENERATED_IMAGE_MAX_BYTES, StoreNodiaAiGeneratedImageUseCase } from './store-nodia-ai-generated-image.use-case.js';
import { CreateNodiaAiAttachmentUseCase } from './create-nodia-ai-attachment.use-case.js';
import { UploadNodiaAiAttachmentUseCase } from './upload-nodia-ai-attachment.use-case.js';
import { ManageNodiaAiAttachmentUseCase } from './manage-nodia-ai-attachment.use-case.js';
import { DisabledNodiaAiDeletionJournal } from '../../nodia-ai-recovery/types/deletion-journal.js';
import { attachmentIdentity, attachmentInput, attachmentPolicy, makeAttachmentFixture } from './attachment.fixture.js';
const bytes = Buffer.from('synthetic output; full image decoding belongs to the isolated inspector');
const image = { contentBase64: bytes.toString('base64'), mediaType: 'image/png' as const,
  sha256: createHash('sha256').update(bytes).digest('hex') };
describe('generated image transport boundary', () => {
  it('preserves exact bytes and rejects URLs, corruption and alternate base64 encodings', () => {
    expect(decodeNodiaAiGeneratedImage(image)).toEqual(bytes);
    for (const contentBase64 of ['https://example.invalid/image.png', image.contentBase64 + '\n', '', 'AB=='])
      expect(() => decodeNodiaAiGeneratedImage({ ...image, contentBase64 })).toThrow('invalid_generated_image');
    expect(() => decodeNodiaAiGeneratedImage({ ...image, sha256: '0'.repeat(64) })).toThrow('invalid_generated_image');
  });
  it('bounds output before decoding', () => {
    expect(() => decodeNodiaAiGeneratedImage({ ...image, contentBase64: 'A'.repeat(4 * Math.ceil(NODIA_AI_GENERATED_IMAGE_MAX_BYTES / 3) + 4) }))
      .toThrow('invalid_generated_image');
  });
});

describe('generated image store over the real attachment use cases', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=', 'base64');
  const output = { contentBase64: png.toString('base64'), mediaType: 'image/png' as const,
    sha256: createHash('sha256').update(png).digest('hex') };
  const runId = '30000000-0000-4000-8000-000000000099';
  function fixture() {
    const f = makeAttachmentFixture(attachmentPolicy);
    let stored = Buffer.alloc(0);
    f.storageMocks.put.mockImplementation(async (...args: unknown[]) => {
      expect(typeof args[1]).toBe('string');
      stored = await readFile(String(args[1]));
    });
    f.storageMocks.get.mockImplementation(async () => stored);
    const create = new CreateNodiaAiAttachmentUseCase(f.attachments, f.access, f.policy);
    const upload = new UploadNodiaAiAttachmentUseCase(f.attachments, f.access, f.inspector, f.storage, f.policy);
    const manage = new ManageNodiaAiAttachmentUseCase(f.attachments, f.access, f.authorize, f.storage, f.policy,
      new DisabledNodiaAiDeletionJournal());
    return { ...f, create, upload, manage, stored: () => stored,
      subject: new StoreNodiaAiGeneratedImageUseCase(create, upload, manage) };
  }
  it('publishes only the same authorized chat image after PUT, readback and hash verification', async () => {
    const f = fixture();
    const result = await f.subject.execute(attachmentIdentity, attachmentInput.conversation_id, runId, output);
    expect(result).toMatchObject({ state: 'ready', media_type: 'image/png', byte_count: png.length,
      conversation_id: attachmentInput.conversation_id });
    expect(f.row().content_hash).toBe(output.sha256);
    expect(f.row().client_request_id).toBe(runId);
    expect(f.stored()).toEqual(png);
    expect(f.storageMocks.put).toHaveBeenCalledOnce();
    expect(f.storageMocks.get).toHaveBeenCalledOnce();
    expect(f.row().state).toBe('ready');
    expect(f.attachmentMocks.bound).not.toHaveBeenCalled();
    // Ready is owned/quota-accounted, not a fabricated user-reviewed text input.
    expect(f.row().interpretation_reviewed).toBe(false);
    expect(f.row().interpretation_text).toBeNull();
  });
  it('rejects bytes/hash before reserving storage or performing external I/O', async () => {
    const f = fixture();
    await expect(f.subject.execute(attachmentIdentity, attachmentInput.conversation_id, runId,
      { ...output, sha256: '0'.repeat(64) })).rejects.toThrow('invalid_generated_image');
    expect(f.attachmentMocks.save).not.toHaveBeenCalled();
    expect(f.storageMocks.put).not.toHaveBeenCalled();
    expect(f.storageMocks.get).not.toHaveBeenCalled();
  });
  it('denied conversation authority cannot reserve, PUT or release private bytes', async () => {
    const f = fixture(); f.accessMock.execute.mockRejectedValue(new ForbiddenException('synthetic denied'));
    await expect(f.subject.execute(attachmentIdentity, attachmentInput.conversation_id, runId, output)).rejects.toMatchObject({ status: 403 });
    expect(f.attachmentMocks.save).not.toHaveBeenCalled();
    expect(f.storageMocks.put).not.toHaveBeenCalled();
    expect(f.storageMocks.get).not.toHaveBeenCalled();
  });
  it('uncertain PUT preserves its cleanup witness, expires the unbound output and never PUTs again', async () => {
    const f = fixture(); f.storageMocks.put.mockRejectedValueOnce(new Error('synthetic uncertain PUT'));
    await expect(f.subject.execute(attachmentIdentity, attachmentInput.conversation_id, runId, output)).rejects.toThrow('attachment_upload_unavailable');
    expect(f.storageMocks.put).toHaveBeenCalledOnce();
    expect(f.storageMocks.get).not.toHaveBeenCalled();
    expect(f.row().state).toBe('expired');
    expect(f.attachmentMocks.queueCleanup).toHaveBeenCalled();
  });
  it.each(['GET', 'hash', 'MIME', 'reauthorization'] as const)('failed %s prevents return and leaves a cleanup-owned expired attachment', async (failure) => {
    const f = fixture();
    if (failure === 'GET') f.storageMocks.get.mockRejectedValueOnce(new Error('synthetic GET unavailable'));
    if (failure === 'hash') f.storageMocks.get.mockResolvedValueOnce(Buffer.alloc(png.length));
    if (failure === 'MIME') f.inspectorMocks.inspect.mockResolvedValueOnce({ mediaType: 'image/jpeg', pageCount: null,
      durationSeconds: null, extractedText: null });
    if (failure === 'reauthorization') f.storageMocks.get.mockImplementationOnce(async () => {
      f.accessMock.execute.mockRejectedValueOnce(new ForbiddenException('synthetic revoked during GET'));
      return f.stored();
    });
    await expect(f.subject.execute(attachmentIdentity, attachmentInput.conversation_id, runId, output)).rejects.toThrow();
    expect(f.storageMocks.put).toHaveBeenCalledOnce();
    expect(f.row().state).toBe('expired');
    expect(f.attachmentMocks.queueCleanup).toHaveBeenCalled();
  });
  it('permanent revocation never releases bytes or hides the original error when discard is also denied', async () => {
    const f = fixture();
    f.storageMocks.get.mockImplementationOnce(async () => {
      f.accessMock.execute.mockRejectedValue(new ForbiddenException('synthetic permanent revocation'));
      return f.stored();
    });
    await expect(f.subject.execute(attachmentIdentity, attachmentInput.conversation_id, runId, output))
      .rejects.toThrow('synthetic permanent revocation');
    expect(f.storageMocks.put).toHaveBeenCalledOnce();
    // An already-published ready attachment remains chat-owned, not anonymous
    // object-store garbage. Chat retention/purge owns eventual removal; this
    // test does not claim immediate physical deletion after permission loss.
    expect(f.row().state).toBe('ready');
    expect(f.row().conversation_id).toBe(attachmentInput.conversation_id);
    expect(f.row().byte_count).toBe(String(png.length));
    expect(f.storageMocks.delete).not.toHaveBeenCalled();
  });
});
