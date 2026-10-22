import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { validateNodiaAiDto } from '../../nodia-ai-conversation/dto/nodia-ai-validation.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { CreateNodiaAiAttachmentDto } from '../dto/nodia-ai-attachment.dto.js';
import { NodiaAiAttachment } from '../entities/nodia-ai-attachment.entity.js';
import { NodiaAiAttachmentService } from '../nodia-ai-attachment.service.js';
import { attachmentMetadata } from '../types/attachment-metadata.js';

@Injectable()
export class CreateNodiaAiAttachmentUseCase {
  constructor(
    private readonly attachments: NodiaAiAttachmentService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, input: unknown) {
    const dto = validateNodiaAiDto(CreateNodiaAiAttachmentDto, input);
    if (
      dto.byte_count > this.policy.admission.file_bytes ||
      [...dto.file_name].some((char) => {
        const code = char.codePointAt(0)!;
        return (
          code < 32 ||
          code === 127 ||
          (code >= 0xd800 && code <= 0xdfff) ||
          char === '/' ||
          char === '\\'
        );
      })
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    const hash = createHash('sha256')
      .update(
        JSON.stringify([
          dto.conversation_id,
          dto.kind,
          dto.byte_count,
          dto.file_name,
        ]),
      )
      .digest('hex');
    return this.attachments.transaction(async (manager) => {
      await lockAuthority(manager);
      const { chat, now } = await this.access.execute(
        manager,
        identity,
        dto.conversation_id,
        'write',
      );
      await this.attachments.lockReservations(manager);
      const prior = await manager.getRepository(NodiaAiAttachment).findOne({
        where: {
          conversation_id: chat.id,
          client_request_id: dto.client_request_id,
        },
      });
      if (prior) {
        if (prior.request_hash !== hash)
          throw new ConflictException('nodia_ai:request_conflict');
        return this.response(prior);
      }
      const usage = await this.attachments.usage(
        manager,
        chat.id,
        chat.owner_id,
        now,
      );
      const p = this.policy.admission;
      if (
        BigInt(usage.chat_bytes) + BigInt(dto.byte_count) >
          BigInt(p.chat_storage_bytes) ||
        BigInt(usage.owner_bytes) + BigInt(dto.byte_count) >
          BigInt(p.owner_storage_bytes) ||
        BigInt(usage.chat_count) >= BigInt(p.attachments_per_chat)
      )
        throw new HttpException(
          'nodia_ai:attachment_quota',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      if (
        BigInt(usage.owner_uploads) >= BigInt(p.uploads_per_owner) ||
        BigInt(usage.global_uploads) >= BigInt(p.uploads_global)
      )
        throw new HttpException(
          'nodia_ai:execution_limit',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const id = randomUUID(),
        generation = randomUUID();
      const row = Object.assign(new NodiaAiAttachment(), {
        id,
        conversation_id: chat.id,
        client_request_id: dto.client_request_id,
        request_hash: hash,
        retention_epoch: chat.retention_epoch,
        kind: dto.kind,
        state: 'uploading',
        file_name: dto.file_name,
        storage_key: `nodia-ai/${chat.id}/${id}/${generation}`,
        generation,
        reserved_bytes: String(dto.byte_count),
        byte_count: null,
        media_type: null,
        content_hash: null,
        page_count: null,
        duration_seconds: null,
        interpretation_text: null,
        interpretation_origin: null,
        interpretation_revision: 0,
        interpretation_reviewed: false,
        expires_at: new Date(
          Math.min(
            now.getTime() + p.upload_intent_seconds * 1000,
            chat.expires_at.getTime(),
          ),
        ),
        processing_started_at: null,
        write_until_at: null,
        created_at: now,
        updated_at: now,
      });
      await this.attachments.save(manager, row);
      // Even an intent whose browser never starts PUT is reclaimed after its immutable TTL.
      await this.attachments.queueCleanup(manager, row, row.expires_at);
      return this.response(row);
    });
  }
  private response(row: NodiaAiAttachment) {
    return {
      attachment: attachmentMetadata(row),
      upload: {
        method: 'PUT' as const,
        path: `/nodia-ai/attachments/${row.id}/content`,
        expires_at: row.expires_at.toISOString(),
      },
    };
  }
}
