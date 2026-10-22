import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { NodiaAiAuthorizedActor } from '../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiPreference } from './entities/nodia-ai-preference.entity.js';
import {
  NODIA_AI_PREFERENCE_LIMIT,
  type NodiaAiPreferenceValue,
} from './types/preference.types.js';

export interface PreferenceReference {
  id: string;
  value_label: string | null;
  scope_label: string | null;
}
@Injectable()
export class NodiaAiPreferenceService {
  constructor(private readonly source: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.source.transaction(work);
  }
  list(manager: EntityManager, owner: string) {
    return manager
      .getRepository(NodiaAiPreference)
      .find({
        where: { owner_id: owner },
        order: { id: 'ASC' },
        take: NODIA_AI_PREFERENCE_LIMIT + 1,
      });
  }
  target(manager: EntityManager, owner: string, id: string) {
    return manager
      .getRepository(NodiaAiPreference)
      .findOneBy({ id, owner_id: owner });
  }
  async lockOwner(manager: EntityManager, owner: string) {
    await manager.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [owner]);
  }
  /** One bounded SQL projection for a page/context, with no per-preference N+1. */
  references(
    manager: EntityManager,
    actor: NodiaAiAuthorizedActor,
    routes: readonly string[],
    values: readonly (NodiaAiPreferenceValue & { id: string })[],
  ): Promise<PreferenceReference[]> {
    if (!values.length) return Promise.resolve([]);
    return manager.query(
      `SELECT x.id,
      CASE
        WHEN x.scope_key='finance' AND $4 AND f.is_active AND (f.user_id=$2 OR $3) THEN f.name
        WHEN x.key='business_id' AND $5 AND b.is_active AND (b.owner_id=$2 OR $3 OR EXISTS(SELECT 1 FROM business_collaborators bc WHERE bc.business_id=b.id AND bc.user_id=$2 AND bc.is_active)) THEN b.name
        WHEN x.key='supplier_id' AND $5 AND p.is_active AND b.is_active AND p.business_id=b.id THEN p.name
        WHEN x.scope_key='rental' AND $6 AND r.is_active AND (r.owner_id=$2 OR $3 OR EXISTS(SELECT 1 FROM rental_collaborators rc WHERE rc.property_id=r.id AND rc.user_id=$2 AND rc.is_active)) THEN r.name
        ELSE NULL END AS value_label,
      CASE WHEN x.key='supplier_id' AND $5 AND p.is_active AND b.is_active AND p.business_id=b.id THEN b.name ELSE NULL END AS scope_label
      FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,scope_key text,key text,value text,scope jsonb)
      LEFT JOIN finance_categories f ON f.id=CASE WHEN x.scope_key='finance' THEN x.value::bigint END
      LEFT JOIN providers p ON p.id=CASE WHEN x.key='supplier_id' THEN x.value::bigint END
      LEFT JOIN businesses b ON b.id=CASE WHEN x.key='business_id' THEN x.value::uuid WHEN x.key='supplier_id' THEN (x.scope->>'business_id')::uuid END
      LEFT JOIN rental_properties r ON r.id=CASE WHEN x.key='property_id' THEN x.value::bigint END`,
      [
        JSON.stringify(values),
        actor.actorId,
        actor.isSuperAdmin,
        routes.includes('/tools/finances-personal'),
        routes.includes('/tools/business'),
        routes.includes('/tools/reservations'),
      ],
    );
  }
  /** Same domain locks as native readers; authority fence is already held by caller. */
  async lockReference(manager: EntityManager, value: NodiaAiPreferenceValue) {
    if (value.scope_key === 'finance')
      await manager.query(
        'SELECT id FROM finance_categories WHERE id=$1 FOR SHARE',
        [value.value],
      );
    else if (value.key === 'property_id')
      await manager.query(
        'SELECT id FROM rental_properties WHERE id=$1 FOR SHARE',
        [value.value],
      );
    else {
      await manager.query('SELECT id FROM businesses WHERE id=$1 FOR SHARE', [
        value.key === 'business_id' ? value.value : value.scope.business_id,
      ]);
      if (value.key === 'supplier_id')
        await manager.query('SELECT id FROM providers WHERE id=$1 FOR SHARE', [
          value.value,
        ]);
    }
  }
}
