import { ConflictException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiProviderResource } from './types/provider-operation.types.js';
@Injectable()
export class NodiaAiProviderOperationsService {
  async target(
    manager: EntityManager,
    resource: NodiaAiProviderResource,
    id: string,
  ): Promise<NodiaAiJsonObject | null> {
    const columns =
      resource === 'ai_providers'
        ? 'id::text,catalog_id::text,name,use_api_key,use_agentic,default_mode,auto_rotate_api_keys,is_default,is_active,fields'
        : 'id::text,key,name,can_use_api_key,can_use_agentic,is_active';
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT ${columns} FROM ${resource} WHERE id=$1`,
      [id],
    );
    return rows[0] ?? null;
  }
  async catalogByKey(
    manager: EntityManager,
    key: string,
  ): Promise<NodiaAiJsonObject | null> {
    const rows: NodiaAiJsonObject[] = await manager.query(
      'SELECT id::text,key,name,can_use_api_key,can_use_agentic,is_active FROM ai_provider_catalog WHERE key=$1',
      [key],
    );
    return rows[0] ?? null;
  }
  async defaults(manager: EntityManager): Promise<NodiaAiJsonObject[]> {
    return this.bounded(
      await manager.query(
        'SELECT id::text,name,is_default FROM ai_providers WHERE is_default=true ORDER BY id LIMIT 101',
      ),
    );
  }
  async count(manager: EntityManager): Promise<number> {
    const [row]: {
      count: string;
    }[] = await manager.query(
      'SELECT count(*)::text AS count FROM ai_providers',
    );
    const count = Number(row.count);
    if (!Number.isSafeInteger(count) || count < 0)
      throw new ConflictException('nodia_ai:result_too_large');
    return count;
  }
  async translations(
    manager: EntityManager,
    id: string,
  ): Promise<NodiaAiJsonObject[]> {
    return this.bounded(
      await manager.query(
        `SELECT source_key AS key, MAX(value) FILTER(WHERE locale='es') AS es, MAX(value) FILTER(WHERE locale='en') AS en FROM translations WHERE source_entity='ai_providers' AND source_id=$1 AND is_active=true GROUP BY source_key ORDER BY source_key LIMIT 101`,
        [id],
      ),
    );
  }
  async affectedConnections(
    manager: EntityManager,
    catalogId: string,
  ): Promise<NodiaAiJsonObject[]> {
    return this.bounded(
      await manager.query(
        'SELECT id::text,name,use_api_key,use_agentic,is_active,is_default FROM ai_providers WHERE catalog_id=$1 ORDER BY id LIMIT 101',
        [catalogId],
      ),
    );
  }
  private bounded(rows: NodiaAiJsonObject[]): NodiaAiJsonObject[] {
    if (rows.length > 100)
      throw new ConflictException('nodia_ai:result_too_large');
    return rows;
  }
}
