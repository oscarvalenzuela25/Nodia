import { ConflictException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** Explicit SQL projections; caller owns authority, bounds, and the transaction. */
@Injectable()
export class NodiaAiSupplierOperationsService {
  async business(manager: EntityManager, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      'SELECT id::text,name,owner_id::text,is_active,updated_at::text FROM businesses WHERE id=$1 FOR SHARE',
      [id],
    );
    return rows[0] ?? null;
  }
  async provider(manager: EntityManager, business: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      'SELECT id::text,business_id::text,name,tax,CASE WHEN octet_length(fields::text)<=131072 THEN fields ELSE NULL END AS fields,octet_length(fields::text) AS fields_bytes,is_active,updated_at::text FROM providers WHERE business_id=$1 AND id=$2 FOR UPDATE',
      [business, id],
    );
    const row = rows[0];
    if (row && Number(row.fields_bytes) > 131072)
      throw new ConflictException('nodia_ai:result_too_large');
    if (row) delete row.fields_bytes;
    return row ?? null;
  }
  async contact(manager: EntityManager, provider: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      'SELECT id::text,provider_id::text,name,phone,email,schedule,description,is_active,version,updated_at::text FROM personal_info_provider WHERE provider_id=$1 AND id=$2 FOR UPDATE',
      [provider, id],
    );
    return rows[0] ?? null;
  }
}
