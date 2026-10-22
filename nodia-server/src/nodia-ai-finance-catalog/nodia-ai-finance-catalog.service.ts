import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

export type FinanceCatalogResource =
  'finance_categories' | 'finance_category_groups';

/** Constant, owner-scoped SQL only. Snapshot rules belong to the preparer use case. */
@Injectable()
export class NodiaAiFinanceCatalogService {
  async target(
    manager: EntityManager,
    resource: FinanceCatalogResource,
    owner: string,
    id: string,
  ) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      resource === 'finance_categories'
        ? `SELECT id::text,user_id::text,name,key,is_active,updated_at::text FROM finance_categories WHERE user_id=$1 AND id=$2 FOR UPDATE`
        : `SELECT id::text,user_id::text,name,key,is_active,updated_at::text FROM finance_category_groups WHERE user_id=$1 AND id=$2 FOR UPDATE`,
      [owner, id],
    );
    return rows[0] ?? null;
  }

  async duplicate(
    manager: EntityManager,
    resource: FinanceCatalogResource,
    owner: string,
    key: string,
    id: string | null,
  ) {
    const rows: { exists: boolean }[] = await manager.query(
      resource === 'finance_categories'
        ? 'SELECT EXISTS(SELECT 1 FROM finance_categories WHERE user_id=$1 AND key=$2 AND ($3::bigint IS NULL OR id<>$3)) AS exists'
        : 'SELECT EXISTS(SELECT 1 FROM finance_category_groups WHERE user_id=$1 AND key=$2 AND ($3::bigint IS NULL OR id<>$3)) AS exists',
      [owner, key, id],
    );
    return rows[0]?.exists === true;
  }

  categories(
    manager: EntityManager,
    owner: string,
    ids: readonly string[],
  ): Promise<NodiaAiJsonObject[]> {
    return manager.query(
      `SELECT id::text,user_id::text,name,key,is_active,updated_at::text FROM finance_categories
       WHERE user_id=$1 AND id=ANY($2::bigint[]) ORDER BY id FOR SHARE`,
      [owner, ids],
    );
  }

  memberships(
    manager: EntityManager,
    resource: FinanceCatalogResource,
    owner: string,
    id: string,
    limit: number,
    selected: readonly string[] = [],
    all = true,
    lock = true,
  ): Promise<NodiaAiJsonObject[]> {
    return manager.query(
      resource === 'finance_categories'
        ? `SELECT id::text,category_group_id::text,category_id::text,is_active,updated_at::text
           FROM finance_category_group_memberships WHERE user_id=$1 AND category_id=$2 ORDER BY id LIMIT $3${lock ? ' FOR UPDATE' : ''}`
        : `SELECT id::text,category_group_id::text,category_id::text,is_active,updated_at::text
           FROM finance_category_group_memberships WHERE user_id=$1 AND category_group_id=$2 AND ($4::boolean OR is_active=true OR category_id=ANY($5::bigint[])) ORDER BY id LIMIT $3${lock ? ' FOR UPDATE' : ''}`,
      resource === 'finance_categories'
        ? [owner, id, limit]
        : [owner, id, limit, all, selected],
    );
  }

  async hasMovements(manager: EntityManager, owner: string, id: string) {
    const rows: { exists: boolean }[] = await manager.query(
      'SELECT EXISTS(SELECT 1 FROM finance_movements WHERE user_id=$1 AND category_id=$2) AS exists',
      [owner, id],
    );
    return rows[0]?.exists === true;
  }
}
