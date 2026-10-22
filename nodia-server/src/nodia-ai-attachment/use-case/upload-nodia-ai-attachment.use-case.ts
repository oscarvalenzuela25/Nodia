import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiAttachmentService } from '../nodia-ai-attachment.service.js';
import { NodiaAiAttachment } from '../entities/nodia-ai-attachment.entity.js';
import { attachmentMetadata } from '../types/attachment-metadata.js';
import {
  NodiaAiAttachmentInspector,
  NodiaAiAttachmentStorage,
} from '../types/attachment-ports.js';

const validTypes: Record<string, readonly string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  pdf: ['application/pdf'],
  audio: ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/mp4'],
};
@Injectable()
export class UploadNodiaAiAttachmentUseCase {
  constructor(
    private readonly attachments: NodiaAiAttachmentService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly inspector: NodiaAiAttachmentInspector,
    private readonly storage: NodiaAiAttachmentStorage,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    identity: NodiaAiActorReference,
    id: string,
    input: Readable,
    contentType: string | undefined,
    contentLength?: string,
  ) {
    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        id,
      ) ||
      contentType?.toLowerCase() !== 'application/octet-stream' ||
      (contentLength !== undefined && !/^[1-9][0-9]*$/u.test(contentLength))
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    const row = await this.attachments.transaction(async (manager) => {
      await lockAuthority(manager);
      const probe = await this.attachments.find(manager, id, false);
      const { chat, now } = await this.access.execute(
        manager,
        identity,
        probe.conversation_id,
        'write',
      );
      const attachment = await this.attachments.find(manager, id);
      if (attachment.state === 'ready') return attachment;
      if (
        attachment.state !== 'uploading' ||
        attachment.processing_started_at ||
        attachment.expires_at <= now ||
        attachment.retention_epoch !== chat.retention_epoch
      )
        throw new ConflictException('nodia_ai:attachment_not_ready');
      if (
        contentLength !== undefined &&
        BigInt(contentLength) !== BigInt(attachment.reserved_bytes)
      )
        throw new BadRequestException('nodia_ai:invalid_input');
      attachment.processing_started_at = now;
      // An immutable key remains discoverable through the last possible PUT + cancellation margin.
      attachment.write_until_at = new Date(
        now.getTime() +
          (this.policy.admission.upload_seconds +
            this.policy.timing.cancellation_seconds) *
            1000,
      );
      await this.attachments.queueCleanup(manager, attachment, now);
      return attachment;
    });
    if (row.state === 'ready') return attachmentMetadata(row);
    const signal = AbortSignal.timeout(
      this.policy.admission.upload_seconds * 1000,
    );
    let folder: string | undefined;
    try {
      folder = await mkdtemp(join(tmpdir(), 'nodia-ai-attachment-'));
      const path = join(folder, 'upload');
      let bytes = 0;
      const hash = createHash('sha256');
      await pipeline(
        input,
        new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.byteLength;
            if (bytes > Number(row.reserved_bytes))
              return callback(
                new BadRequestException('nodia_ai:invalid_input'),
              );
            hash.update(chunk);
            callback(null, chunk);
          },
        }),
        createWriteStream(path, { flags: 'wx', mode: 0o600 }),
        { signal },
      );
      if (bytes !== Number(row.reserved_bytes))
        throw new BadRequestException('nodia_ai:invalid_input');
      const metadata = await this.inspector.inspect({
        path,
        kind: row.kind,
        byteCount: bytes,
        signal,
      });
      this.validateInspection(row, metadata);
      signal.throwIfAborted();
      await this.storage.put(row.storage_key, path, metadata.mediaType, signal);
      signal.throwIfAborted();
      return await this.attachments.transaction(async (manager) => {
        await lockAuthority(manager);
        const { chat, now } = await this.access.execute(
          manager,
          identity,
          row.conversation_id,
          'write',
        );
        const latest = await this.attachments.find(manager, row.id);
        if (
          latest.state !== 'uploading' ||
          latest.generation !== row.generation ||
          latest.retention_epoch !== chat.retention_epoch ||
          latest.expires_at <= now ||
          latest.write_until_at === null ||
          now >= latest.write_until_at
        )
          throw new ConflictException('nodia_ai:attachment_not_ready');
        if (metadata.extractedText)
          await this.attachments.lockReservations(manager);
        const [cleanup]: { state: string }[] = await manager.query(
          "SELECT state FROM nodia_ai_jobs WHERE dedup_key=$1 AND kind='delete_blob' FOR UPDATE",
          [`attachment:${row.id}:${row.generation}`],
        );
        if (!cleanup || cleanup.state !== 'ready')
          throw new ConflictException('nodia_ai:attachment_not_ready');
        latest.state = 'ready';
        latest.byte_count = String(bytes);
        latest.content_hash = hash.digest('hex');
        latest.media_type = metadata.mediaType;
        latest.page_count = metadata.pageCount;
        latest.duration_seconds = metadata.durationSeconds;
        if (metadata.extractedText) {
          const usage = await this.attachments.usage(
            manager,
            row.conversation_id,
            identity.userId,
            now,
          );
          if (
            BigInt(usage.chat_bytes) +
              BigInt(Buffer.byteLength(metadata.extractedText)) >
              BigInt(this.policy.admission.chat_storage_bytes) ||
            BigInt(usage.owner_bytes) +
              BigInt(Buffer.byteLength(metadata.extractedText)) >
              BigInt(this.policy.admission.owner_storage_bytes)
          )
            throw new ConflictException('nodia_ai:attachment_quota');
          latest.interpretation_text = metadata.extractedText;
          latest.interpretation_origin = 'extracted';
          latest.interpretation_revision = 1;
        }
        latest.processing_started_at = null;
        latest.write_until_at = null;
        latest.updated_at = now;
        await this.attachments.save(manager, latest);
        await manager.query(
          "DELETE FROM nodia_ai_jobs WHERE dedup_key=$1 AND kind='delete_blob' AND state='ready'",
          [`attachment:${row.id}:${row.generation}`],
        );
        return attachmentMetadata(latest);
      });
    } catch (error) {
      // This transaction has no user effects. Preserve cleanup identity even when authority was revoked or the chat was purged.
      await this.reject(row).catch(() => undefined);
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      throw new ServiceUnavailableException(
        'nodia_ai:attachment_upload_unavailable',
      );
    } finally {
      if (folder)
        await rm(folder, { recursive: true, force: true }).catch(
          () => undefined,
        );
    }
  }
  private validateInspection(
    row: NodiaAiAttachment,
    metadata: {
      mediaType: string;
      pageCount: number | null;
      durationSeconds: number | null;
      extractedText?: string | null;
    },
  ) {
    const a = this.policy.admission;
    if (
      !metadata ||
      !validTypes[row.kind].includes(metadata.mediaType) ||
      (row.kind === 'pdf' &&
        (!Number.isSafeInteger(metadata.pageCount) ||
          metadata.pageCount! < 1 ||
          metadata.pageCount! > a.pdf_pages)) ||
      (row.kind !== 'pdf' && metadata.pageCount !== null) ||
      (row.kind === 'audio' &&
        (!Number.isFinite(metadata.durationSeconds) ||
          metadata.durationSeconds! <= 0 ||
          metadata.durationSeconds! > a.audio_seconds)) ||
      (row.kind !== 'audio' && metadata.durationSeconds !== null) ||
      (metadata.extractedText !== undefined &&
        metadata.extractedText !== null &&
        (row.kind !== 'pdf' ||
          typeof metadata.extractedText !== 'string' ||
          !/\S/u.test(metadata.extractedText) ||
          Buffer.byteLength(metadata.extractedText) >
            a.message_text_utf8_bytes))
    )
      throw new BadRequestException('nodia_ai:attachment_content_invalid');
  }
  private reject(original: NodiaAiAttachment) {
    return this.attachments.transaction(async (manager) => {
      const rows = await manager.getRepository(NodiaAiAttachment).find({
        where: { id: original.id },
        lock: { mode: 'pessimistic_write' },
      });
      const row = rows[0];
      if (
        !row ||
        row.generation !== original.generation ||
        row.state !== 'uploading'
      )
        return;
      row.state = 'rejected';
      await this.attachments.save(manager, row);
    });
  }
}
