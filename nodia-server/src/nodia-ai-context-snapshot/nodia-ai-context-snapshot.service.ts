import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LessThanOrEqual, type EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiContextSnapshot } from './entities/nodia-ai-context-snapshot.entity.js';

export interface NodiaAiSnapshotInsert {
  conversationId: string;
  throughSeq: string;
  sourceHash: string;
  summary: NodiaAiJsonObject;
  scopeManifest: NodiaAiJsonObject;
  builderContractVersion: string;
}

/** Private transactional storage. Caller verifies source proof and current scope before use. */
@Injectable()
export class NodiaAiContextSnapshotService {
  latest(manager: EntityManager, conversationId: string, throughSeq: string) {
    this.requireTransaction(manager);
    return manager.getRepository(NodiaAiContextSnapshot).findOne({
      where: {
        conversation_id: conversationId,
        through_message_seq: LessThanOrEqual(throughSeq),
      },
      order: { through_message_seq: 'DESC', revision: 'DESC' },
    });
  }

  async insert(manager: EntityManager, input: NodiaAiSnapshotInsert) {
    this.requireTransaction(manager);
    // Same durable chat lock as run checkpoints; no process-local revision counter.
    const rows: { id: string; next_message_seq: string }[] = await manager.query(
      'SELECT id,next_message_seq::text FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE',
      [input.conversationId],
    );
    if (!rows.length || !/^(0|[1-9][0-9]*)$/.test(input.throughSeq) ||
      BigInt(input.throughSeq) > BigInt(rows[0].next_message_seq))
      throw new InternalServerErrorException('nodia_ai:context_snapshot_invalid');
    const [latest]: { revision: number }[] = await manager.query(
      'SELECT COALESCE(max(revision),0)::integer AS revision FROM nodia_ai_context_snapshots WHERE conversation_id=$1',
      [input.conversationId],
    );
    if (!Number.isSafeInteger(latest.revision) || latest.revision < 0 ||
      latest.revision >= 2147483647)
      throw new InternalServerErrorException('nodia_ai:context_snapshot_invalid');
    // INSERT only: no save/upsert path can rewrite a prior artifact.
    const [entity]: NodiaAiContextSnapshot[] = await manager.query(
      `INSERT INTO nodia_ai_context_snapshots
        (id,conversation_id,revision,through_message_seq,source_hash,summary,scope_manifest,builder_contract_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,conversation_id,revision,through_message_seq::text,source_hash,summary,scope_manifest,builder_contract_version,created_at`,
      [randomUUID(), input.conversationId, latest.revision + 1,
        input.throughSeq, input.sourceHash, input.summary, input.scopeManifest,
        input.builderContractVersion],
    );
    return entity;
  }

  private requireTransaction(manager: EntityManager) {
    if (!manager.queryRunner?.isTransactionActive)
      throw new InternalServerErrorException('authorization:transaction_required');
  }
}
