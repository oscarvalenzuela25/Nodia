import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type { NodiaAiGeneratedImage } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { CreateNodiaAiAttachmentUseCase } from './create-nodia-ai-attachment.use-case.js';
import { UploadNodiaAiAttachmentUseCase } from './upload-nodia-ai-attachment.use-case.js';
import { ManageNodiaAiAttachmentUseCase } from './manage-nodia-ai-attachment.use-case.js';

/** Own output bound, not an advertised provider quota. Full decoding uses the existing isolated inspector. */
export const NODIA_AI_GENERATED_IMAGE_MAX_BYTES = 16 * 1024 * 1024;
export function decodeNodiaAiGeneratedImage(image: NodiaAiGeneratedImage): Buffer {
  if (!image || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mediaType) ||
      typeof image.contentBase64 !== 'string' || !/^[0-9a-f]{64}$/.test(image.sha256) ||
      !image.contentBase64.length || image.contentBase64.length > 4 * Math.ceil(NODIA_AI_GENERATED_IMAGE_MAX_BYTES / 3) ||
      image.contentBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.contentBase64))
    throw new Error('nodia_ai:invalid_generated_image');
  const bytes = Buffer.from(image.contentBase64, 'base64');
  if (!bytes.length || bytes.length > NODIA_AI_GENERATED_IMAGE_MAX_BYTES || bytes.toString('base64') !== image.contentBase64 ||
      createHash('sha256').update(bytes).digest('hex') !== image.sha256)
    throw new Error('nodia_ai:invalid_generated_image');
  return bytes;
}

/** Reuses authorized private storage, quotas, late-PUT cleanup and chat retention. */
@Injectable()
export class StoreNodiaAiGeneratedImageUseCase {
  constructor(private readonly create: CreateNodiaAiAttachmentUseCase, private readonly upload: UploadNodiaAiAttachmentUseCase,
    private readonly manage: ManageNodiaAiAttachmentUseCase) {}
  async execute(identity: NodiaAiActorReference, conversationId: string, runId: string, image: NodiaAiGeneratedImage) {
    const bytes = decodeNodiaAiGeneratedImage(image);
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[image.mediaType];
    const intent = await this.create.execute(identity, { conversation_id: conversationId, client_request_id: runId,
      kind: 'image', file_name: `generated-image.${extension}`, byte_count: bytes.length });
    try {
      const result = await this.upload.execute(identity, intent.attachment.attachment_id, Readable.from(bytes),
        'application/octet-stream', String(bytes.length));
      const stored = await this.manage.content(identity, result.attachment_id);
      if (createHash('sha256').update(stored.buffer).digest('hex') !== image.sha256 || result.media_type !== image.mediaType)
        throw new Error('nodia_ai:invalid_generated_image');
      return result;
    } catch (error) {
      // An output that fails validation/storage is never offered as an input.
      // The normal discard path records deletion ownership before removing R2 bytes.
      await this.manage.discard(identity, intent.attachment.attachment_id).catch(() => undefined);
      throw error;
    }
  }
}
