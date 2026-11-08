import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
/** Explicit safe columns only. Ciphertext, fingerprints and native login tokens never enter a proposal. */
@Injectable()
export class NodiaAiSecurePreparationService {
  async provider(
    manager: EntityManager,
    id: string,
  ): Promise<NodiaAiJsonObject> {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT p.id::text,p.name,p.is_active,p.use_api_key,p.use_agentic,c.key AS provider_key,c.is_active AS catalog_active,c.can_use_api_key,c.can_use_agentic FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`,
      [id],
    );
    if (!rows[0])
      throw new NotFoundException('nodia_ai:domain_target_not_found');
    return rows[0];
  }
  async keys(
    manager: EntityManager,
    providerId: string,
  ): Promise<NodiaAiJsonObject[]> {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,provider_id::text,label,sort_order,is_selected,is_active,updated_at::text FROM ai_api_keys WHERE provider_id=$1 ORDER BY id LIMIT 101`,
      [providerId],
    );
    if (rows.length > 100)
      throw new ConflictException('nodia_ai:result_too_large');
    return rows;
  }
}
