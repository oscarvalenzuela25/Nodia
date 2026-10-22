import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { validateNodiaAiDto } from '../../nodia-ai-conversation/dto/nodia-ai-validation.js';
import type { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiAttachmentService } from '../nodia-ai-attachment.service.js';
import { attachmentMetadata } from '../types/attachment-metadata.js';
import {
  NodiaAiAttachmentStorage,
  type NodiaAiAttachmentKind,
} from '../types/attachment-ports.js';
import { ReviewNodiaAiAttachmentDto } from '../dto/nodia-ai-attachment.dto.js';
import { createHash } from 'node:crypto';
import {
  NODIA_AI_DELETION_JOURNAL,
  type NodiaAiDeletionJournalPort,
} from '../../nodia-ai-recovery/types/deletion-journal.js';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
@Injectable()
export class ManageNodiaAiAttachmentUseCase {
  constructor(
    private readonly attachments: NodiaAiAttachmentService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly storage: NodiaAiAttachmentStorage,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Inject(NODIA_AI_DELETION_JOURNAL)
    private readonly deletionJournal: NodiaAiDeletionJournalPort,
  ) {}
  capabilities(identity: NodiaAiActorReference) {
    return this.attachments.transaction(async (manager) => {
      await lockAuthority(manager);
      await this.authorize.execute(identity, {}, manager);
      const a = this.policy.admission;
      return {
        limits: {
          file_bytes: a.file_bytes,
          files_per_message: a.files_per_message,
          message_files_bytes: a.message_files_bytes,
          audio_seconds: a.audio_seconds,
          pdf_pages: a.pdf_pages,
          image_pixels: a.image_pixels,
        },
        reviewed_text: true,
        native_modalities: { image: null, pdf: null, audio: null },
        native_media_types: [] as string[],
      };
    });
  }
  get(identity: NodiaAiActorReference, id: string) {
    return this.attachments.transaction(async (manager) => {
      await lockAuthority(manager);
      return this.getInTransaction(manager, identity, id);
    });
  }
  /** Metadata only: caller owns the authority transaction; no object storage access. */
  async getInTransaction(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    id: string,
    knownChat?: string,
  ) {
    return attachmentMetadata(
      await this.findAuthorized(manager, identity, id, 'read', knownChat),
    );
  }
  async content(
    identity: NodiaAiActorReference,
    id: string,
    signal?: AbortSignal,
  ) {
    const timeout = AbortSignal.timeout(
      this.policy.admission.upload_seconds * 1000,
    );
    const bounded = signal ? AbortSignal.any([signal, timeout]) : timeout;
    bounded.throwIfAborted();
    const row = await this.attachments.transaction(async (manager) => {
      await lockAuthority(manager);
      const row = await this.findAuthorized(manager, identity, id, 'read');
      if (row.state !== 'ready' || row.byte_count === null || !row.media_type)
        throw new ConflictException('nodia_ai:attachment_not_ready');
      return row;
    });
    bounded.throwIfAborted();
    const buffer = await this.storage.get(
      row.storage_key,
      Number(row.byte_count),
      bounded,
    );
    bounded.throwIfAborted();
    if (
      buffer.byteLength !== Number(row.byte_count) ||
      createHash('sha256').update(buffer).digest('hex') !== row.content_hash
    )
      throw new ConflictException('nodia_ai:attachment_content_invalid');
    // Do not release bytes after expiry or revocation while the external read was running.
    const current = await this.get(identity, id);
    bounded.throwIfAborted();
    if (current.state !== 'ready')
      throw new ConflictException('nodia_ai:attachment_not_ready');
    return { buffer, media_type: row.media_type!, file_name: row.file_name };
  }
  review(identity: NodiaAiActorReference, id: string, input: unknown) {
    const dto = validateNodiaAiDto(ReviewNodiaAiAttachmentDto, input);
    if (
      [...dto.text].some((char) => {
        const point = char.codePointAt(0)!;
        return point >= 0xd800 && point <= 0xdfff;
      }) ||
      Buffer.byteLength(dto.text) >
        this.policy.admission.message_text_utf8_bytes
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    return this.attachments.transaction(async (manager) => {
      await lockAuthority(manager);
      const row = await this.findAuthorized(manager, identity, id, 'write');
      if (row.state !== 'ready')
        throw new ConflictException('nodia_ai:attachment_not_ready');
      if (await this.attachments.bound(manager, row.id))
        throw new ConflictException('nodia_ai:attachment_already_bound');
      if (row.interpretation_revision !== dto.expected_revision)
        throw new ConflictException('nodia_ai:revision_conflict');
      await this.attachments.lockReservations(manager);
      const usage = await this.attachments.usage(
        manager,
        row.conversation_id,
        identity.userId,
        new Date(),
      );
      const delta =
        BigInt(Buffer.byteLength(dto.text)) -
        BigInt(
          row.interpretation_text === null
            ? 0
            : Buffer.byteLength(row.interpretation_text),
        );
      if (
        BigInt(usage.chat_bytes) + delta >
          BigInt(this.policy.admission.chat_storage_bytes) ||
        BigInt(usage.owner_bytes) + delta >
          BigInt(this.policy.admission.owner_storage_bytes)
      )
        throw new HttpException(
          'nodia_ai:attachment_quota',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      row.interpretation_text = dto.text;
      row.interpretation_origin = 'user_reviewed';
      row.interpretation_reviewed = true;
      row.interpretation_revision++;
      row.updated_at = new Date();
      await this.attachments.save(manager, row);
      return attachmentMetadata(row);
    });
  }
  async discard(identity: NodiaAiActorReference, id: string) {
    const intent = await this.attachments.transaction(async (manager) => {
      await lockAuthority(manager);
      const row = await this.findAuthorized(manager, identity, id, 'write');
      if (await this.attachments.bound(manager, row.id))
        throw new ConflictException('nodia_ai:attachment_already_bound');
      row.state = 'expired';
      row.interpretation_text = null;
      row.interpretation_origin = null;
      row.interpretation_reviewed = false;
      row.interpretation_revision = 0;
      const [clock]: { now: Date }[] = await manager.query(
        'SELECT clock_timestamp() now',
      );
      await this.attachments.queueCleanup(manager, row, new Date(clock.now));
      return {
        deleted_at: new Date(clock.now).toISOString(),
        resource: {
          kind: 'attachment' as const,
          conversation_id: row.conversation_id,
          attachment_id: row.id,
          storage_generations: [row.generation],
        },
      };
    });
    // Logical expiry fences binding/publication immediately. The durable cleanup
    // intent survives a crash or a lost external ACK; cleanup repeats the same
    // resource witness before physically removing either the object or its row.
    // No external I/O is held under authority/conversation/queue SQL locks.
    if (this.deletionJournal.enabled)
      await this.deletionJournal.recordResources({
        deleted_at: intent.deleted_at,
        resources: [intent.resource],
      });
    return { deleted: true as const };
  }
  /** Called inside the authoritative message admission transaction. Never performs storage or inference. */
  async usageForAdmission(
    manager: EntityManager,
    chatId: string,
    ownerId: string,
    now: Date,
    excludeRunId?: string,
  ) {
    await this.attachments.lockReservations(manager);
    return this.attachments.usage(manager, chatId, ownerId, now, excludeRunId);
  }
  async bindForMessage(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    chat: NodiaAiConversation,
    refs: readonly { kind: NodiaAiAttachmentKind; attachment_id: string }[],
    allowUnreviewed = false,
  ) {
    const limits = this.policy.admission;
    if (
      refs.length > limits.files_per_message ||
      new Set(refs.map((r) => r.attachment_id)).size !== refs.length
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    let bytes = 0;
    const output = [];
    for (const ref of refs) {
      const row = await this.findAuthorized(
        manager,
        identity,
        ref.attachment_id,
        'write',
        chat.id,
      );
      if (
        row.conversation_id !== chat.id ||
        row.retention_epoch !== chat.retention_epoch ||
        row.kind !== ref.kind ||
        row.state !== 'ready' ||
        row.byte_count === null
      )
        throw new ConflictException('nodia_ai:attachment_not_ready');
      if (
        !allowUnreviewed &&
        (!row.interpretation_reviewed || !row.interpretation_text)
      )
        throw new ConflictException('nodia_ai:attachment_review_required');
      bytes += Number(row.byte_count);
      output.push({
        attachment_id: row.id,
        kind: row.kind,
        text: row.interpretation_reviewed ? row.interpretation_text : null,
        metadata: attachmentMetadata(row),
      });
    }
    if (bytes > limits.message_files_bytes)
      throw new BadRequestException('nodia_ai:invalid_input');
    return output;
  }
  async resolveContext(
    manager: EntityManager,
    conversationId: string,
    attachmentId: string,
  ) {
    const row = await this.attachments.find(manager, attachmentId, false);
    if (
      row.conversation_id !== conversationId ||
      row.state !== 'ready' ||
      !row.interpretation_reviewed ||
      !row.interpretation_text
    )
      throw new ConflictException('nodia_ai:attachment_not_ready');
    return {
      attachment_id: row.id,
      kind: row.kind,
      text: row.interpretation_text,
      metadata: attachmentMetadata(row),
    };
  }
  private async findAuthorized(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    id: string,
    mode: 'read' | 'write',
    knownChat?: string,
  ) {
    if (typeof id !== 'string' || !uuid.test(id))
      throw new BadRequestException('nodia_ai:invalid_input');
    // Probe immutable chat identity without locking the attachment first: lock order is chat then attachment.
    const probe = await this.attachments.find(manager, id, false);
    if (knownChat && probe.conversation_id !== knownChat)
      throw new NotFoundException('nodia_ai:attachment_not_found');
    const { chat } = await this.access.execute(
      manager,
      identity,
      probe.conversation_id,
      mode,
      'attachment.read',
    );
    const row = await this.attachments.find(manager, id);
    if (row.retention_epoch !== chat.retention_epoch)
      throw new NotFoundException('nodia_ai:attachment_not_found');
    return row;
  }
}
