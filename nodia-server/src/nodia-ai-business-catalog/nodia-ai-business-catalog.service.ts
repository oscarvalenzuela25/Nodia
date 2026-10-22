import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
export type BusinessCatalogResource =
  'businesses' | 'products' | 'product_logs';
/** Constant queries and exact timestamp text: no SQL supplied by the model. */
@Injectable()
export class NodiaAiBusinessCatalogService {
  async business(
    manager: EntityManager,
    id: string,
    write: boolean | null = false,
  ): Promise<NodiaAiJsonObject | null> {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,owner_id::text,name,has_description,is_active,updated_at::text FROM businesses WHERE id=$1${write === null ? '' : write ? ' FOR UPDATE' : ' FOR SHARE'}`,
      [id],
    );
    return rows[0] ?? null;
  }
  async target(
    manager: EntityManager,
    resource: BusinessCatalogResource,
    id: string,
  ): Promise<NodiaAiJsonObject | null> {
    if (resource === 'businesses') return this.business(manager, id, true);
    const rows: NodiaAiJsonObject[] = await manager.query(
      resource === 'products'
        ? 'SELECT id::text,business_id::text,provider_id::text,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active,updated_at::text FROM products WHERE id=$1 FOR UPDATE'
        : 'SELECT id::text,product_id::text,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,updated_at::text FROM product_logs WHERE id=$1 FOR UPDATE',
      [id],
    );
    return rows[0] ?? null;
  }
  async product(
    manager: EntityManager,
    id: string,
  ): Promise<NodiaAiJsonObject | null> {
    const rows: NodiaAiJsonObject[] = await manager.query(
      'SELECT id::text,business_id::text,provider_id::text,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active,updated_at::text FROM products WHERE id=$1 FOR SHARE',
      [id],
    );
    return rows[0] ?? null;
  }
  async provider(
    manager: EntityManager,
    id: string,
  ): Promise<NodiaAiJsonObject | null> {
    const rows: NodiaAiJsonObject[] = await manager.query(
      'SELECT id::text,business_id::text,name,is_active,updated_at::text FROM providers WHERE id=$1 FOR SHARE',
      [id],
    );
    return rows[0] ?? null;
  }
  translations(
    manager: EntityManager,
    id: string,
    limit: number,
  ): Promise<NodiaAiJsonObject[]> {
    return manager.query(
      "SELECT id::text,source_key,locale,value,is_active,updated_at::text FROM translations WHERE source_entity='businesses' AND source_id=$1 ORDER BY id LIMIT $2 FOR SHARE",
      [id, limit],
    );
  }
  collaborators(
    manager: EntityManager,
    business: string,
    limit: number,
  ): Promise<NodiaAiJsonObject[]> {
    return manager.query(
      'SELECT id::text,user_id::text,position,action_ids::text[],is_active,updated_at::text FROM business_collaborators WHERE business_id=$1 ORDER BY id LIMIT $2 FOR UPDATE',
      [business, limit],
    );
  }
  users(manager: EntityManager, ids: string[]): Promise<NodiaAiJsonObject[]> {
    return manager.query(
      'SELECT id::text,is_active,updated_at::text FROM users WHERE id=ANY($1::bigint[]) ORDER BY id',
      [ids],
    );
  }
  actions(manager: EntityManager, ids: string[]): Promise<NodiaAiJsonObject[]> {
    return manager.query(
      'SELECT id::text,key,is_active,updated_at::text FROM business_actions WHERE id=ANY($1::bigint[]) ORDER BY id FOR SHARE',
      [ids],
    );
  }
  async duplicateProduct(
    manager: EntityManager,
    business: string,
    code: string,
    exclude: string | null,
  ): Promise<boolean> {
    const rows: { exists: boolean }[] = await manager.query(
      'SELECT EXISTS(SELECT 1 FROM products WHERE business_id=$1 AND code=$2 AND ($3::bigint IS NULL OR id<>$3)) AS exists',
      [business, code, exclude],
    );
    return rows[0]?.exists === true;
  }
}
