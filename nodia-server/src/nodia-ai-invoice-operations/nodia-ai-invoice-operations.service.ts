import { ConflictException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** Explicit SQL snapshots. No input can select a table, column or storage key. */
@Injectable()
export class NodiaAiInvoiceOperationsService {
  async attachment(
    manager: EntityManager,
    id: string,
    conversationId: string,
    ownerId: string,
  ): Promise<NodiaAiJsonObject> {
    const [row]: NodiaAiJsonObject[] = await manager.query(
      `SELECT a.id::text AS attachment_id,a.conversation_id::text,a.retention_epoch::text,
      a.kind,a.file_name,a.media_type,a.byte_count::text,a.content_hash::text FROM nodia_ai_attachments a
      JOIN nodia_ai_conversations c ON c.id=a.conversation_id AND c.retention_epoch=a.retention_epoch
      WHERE a.id=$1 AND a.conversation_id=$2 AND c.owner_id=$3::bigint AND a.state='ready' AND c.lifecycle='active' AND c.expires_at>clock_timestamp()
      AND a.kind IN ('image','pdf') AND a.byte_count<=10485760 FOR SHARE OF a`,
      [id, conversationId, ownerId],
    );
    if (!row)
      throw new ConflictException('nodia_ai:invoice_attachment_unavailable');
    return row;
  }
  async target(
    manager: EntityManager,
    id: string,
    lock = false,
  ): Promise<NodiaAiJsonObject | null> {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,business_id::text,provider_id::text,code,total_amount,path_storage,data,is_active,updated_at::text
       FROM invoices WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );
    return rows[0] ?? null;
  }

  businesses(
    manager: EntityManager,
    ids: readonly string[],
  ): Promise<NodiaAiJsonObject[]> {
    return manager.query(
      `SELECT id::text,owner_id::text,name,is_active,updated_at::text FROM businesses
       WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE`,
      [ids],
    );
  }

  async provider(
    manager: EntityManager,
    id: string,
  ): Promise<NodiaAiJsonObject | null> {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,business_id::text,name,is_active,updated_at::text FROM providers WHERE id=$1 FOR SHARE`,
      [id],
    );
    return rows[0] ?? null;
  }
}
