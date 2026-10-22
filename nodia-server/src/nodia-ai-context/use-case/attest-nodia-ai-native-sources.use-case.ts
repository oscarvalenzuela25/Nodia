import type { EntityManager } from 'typeorm';
import type { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiAttachment } from '../../nodia-ai-attachment/entities/nodia-ai-attachment.entity.js';
import type { NodiaAiAttachmentKind } from '../../nodia-ai-attachment/types/attachment-ports.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';

export interface NodiaAiNativeSourceInput {
  readonly attachment_id: string;
  readonly kind: NodiaAiAttachmentKind;
  readonly media_type: string;
  readonly content_hash: string;
  readonly byte_count: number;
}

/** Bind bytes actually loaded for this provider attempt to immutable attachment metadata before dispatch. */
export class AttestNodiaAiNativeSourcesUseCase {
  async execute(
    manager: EntityManager,
    run: Pick<NodiaAiRun, 'conversation_id' | 'retention_epoch'>,
    inputs: readonly NodiaAiNativeSourceInput[],
  ) {
    const invalid = (): never => {
      throw new NodiaAiKnownPreDispatchError(
        'nodia_ai:attachment_source_changed',
      );
    };
    if (
      !manager.queryRunner?.isTransactionActive ||
      inputs.length > 4 ||
      new Set(inputs.map((source) => source.attachment_id)).size !==
        inputs.length
    )
      return invalid();
    const sources = [];
    for (const input of inputs) {
      const row = await manager.getRepository(NodiaAiAttachment).findOneBy({
        id: input.attachment_id,
        conversation_id: run.conversation_id,
      });
      if (
        !row ||
        row.state !== 'ready' ||
        row.retention_epoch !== run.retention_epoch ||
        !(row.expires_at instanceof Date) ||
        row.expires_at.getTime() <= Date.now() ||
        row.kind !== input.kind ||
        row.media_type !== input.media_type ||
        !/^[a-f0-9]{64}$/.test(input.content_hash) ||
        row.content_hash !== input.content_hash ||
        !Number.isSafeInteger(input.byte_count) ||
        input.byte_count <= 0 ||
        row.byte_count !== String(input.byte_count) ||
        !/^[a-f0-9-]{36}$/i.test(row.generation)
      )
        return invalid();
      sources.push({
        attachment_id: row.id,
        generation: row.generation,
        content_hash: input.content_hash,
        byte_count: input.byte_count,
        media_type: input.media_type,
        kind: input.kind,
        retention_epoch: row.retention_epoch,
      });
    }
    return sources;
  }
}
