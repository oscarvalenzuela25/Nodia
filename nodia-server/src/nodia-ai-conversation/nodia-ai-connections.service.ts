import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
export interface NodiaAiConnectionConfiguration {
  id: string;
  label: string;
  provider_key: string;
  is_active: boolean;
  is_default: boolean;
  default_mode: string | null;
  catalog_active: boolean;
  use_api_key: boolean;
  use_agentic: boolean;
  can_use_api_key: boolean;
  can_use_agentic: boolean;
  fields: unknown;
}
/** No credential columns or credential relations are loaded by this reader. */
@Injectable()
export class NodiaAiConnectionsService {
  constructor(private readonly source: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.source.transaction(work);
  }
  list(manager: EntityManager, after: string | null, limit: number) {
    return manager.query<NodiaAiConnectionConfiguration[]>(
      `SELECT p.id::text, COALESCE(NULLIF(p.name,''),c.name) AS label,
       c.key AS provider_key,p.is_active,p.is_default,p.default_mode,c.is_active AS catalog_active,
       p.use_api_key,p.use_agentic,
       c.can_use_api_key,c.can_use_agentic,p.fields
       FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
       WHERE ($1::bigint IS NULL OR p.id>$1::bigint) ORDER BY p.id ASC LIMIT $2`,
      [after, limit + 1],
    );
  }
  async find(manager: EntityManager, id: string) {
    const rows = await manager.query<NodiaAiConnectionConfiguration[]>(
      `SELECT p.id::text, COALESCE(NULLIF(p.name,''),c.name) AS label,
       c.key AS provider_key,p.is_active,p.is_default,p.default_mode,c.is_active AS catalog_active,
       p.use_api_key,p.use_agentic,
       c.can_use_api_key,c.can_use_agentic,p.fields
       FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
       WHERE p.id=$1 FOR SHARE OF p,c`,
      [id],
    );
    return rows[0] ?? null;
  }
  async findDefault(manager: EntityManager) {
    const rows = await manager.query<NodiaAiConnectionConfiguration[]>(
      `SELECT p.id::text, COALESCE(NULLIF(p.name,''),c.name) AS label,
       c.key AS provider_key,p.is_active,p.is_default,p.default_mode,c.is_active AS catalog_active,
       p.use_api_key,p.use_agentic,
       c.can_use_api_key,c.can_use_agentic,p.fields
       FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
       WHERE p.is_default=true ORDER BY p.id ASC LIMIT 2 FOR SHARE OF p,c`,
    );
    // Historical ambiguity never selects an arbitrary connection.
    return rows.length === 1 ? rows[0] : null;
  }
}
