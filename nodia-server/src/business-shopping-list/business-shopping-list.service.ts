import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { SHOPPING_LIST_ACCENT_PATTERN } from './policies/shopping-list-content.js';
import type {
  ShoppingListCheck,
  ShoppingListDetail,
  ShoppingListItemCommand,
  ShoppingListItemIdentity,
  ShoppingListSummary,
} from './types/shopping-list.types.js';

interface ListQueryRow {
  total: number;
  items: ShoppingListSummary[];
}

interface ShoppingListCreateReceipt {
  request_hash: string;
  result: ShoppingListDetail;
}

@Injectable()
export class BusinessShoppingListService {
  async list(
    manager: EntityManager,
    businessId: string,
    { search, page, limit }: { search: string; page: number; limit: number },
  ): Promise<ListQueryRow> {
    const [row] = await manager.query<ListQueryRow[]>(
      `WITH filtered AS MATERIALIZED (
         SELECT id, name, is_active, version FROM business_shopping_lists
         WHERE business_id=$1 AND (
           $2='' OR regexp_replace(normalize(name, NFD), $5, '', 'g') ILIKE $2 ESCAPE '!'
         )
       ), entries AS (
         SELECT * FROM filtered ORDER BY name ASC, id ASC LIMIT $3 OFFSET $4
       ), counts AS (
         SELECT item.list_id, count(*)::integer AS item_count
         FROM entries JOIN business_shopping_list_items item ON item.list_id=entries.id
         WHERE item.business_id=$1 GROUP BY item.list_id
       )
       SELECT (SELECT count(*)::integer FROM filtered) AS total,
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', entries.id, 'name', entries.name, 'is_active', entries.is_active,
           'version', entries.version, 'item_count', COALESCE(counts.item_count, 0)
         ) ORDER BY entries.name ASC, entries.id ASC), '[]'::jsonb) AS items
       FROM entries LEFT JOIN counts ON counts.list_id=entries.id`,
      [
        businessId,
        search,
        limit,
        (page - 1) * limit,
        SHOPPING_LIST_ACCENT_PATTERN,
      ],
    );
    return row;
  }

  async detail(
    manager: EntityManager,
    businessId: string,
    listId: string,
  ): Promise<ShoppingListDetail | undefined> {
    const [row] = await manager.query<ShoppingListDetail[]>(
      `SELECT list.id, list.name, list.is_active, list.version, composition.item_count,
         composition.items
       FROM business_shopping_lists list
       CROSS JOIN LATERAL (
         SELECT count(*)::integer AS item_count, COALESCE(jsonb_agg(jsonb_build_object(
           'id', item.id, 'product_id', item.product_id::text,
           'name', COALESCE(product.name, item.product_name),
           'quantity', trim_scale(item.quantity)::text, 'position', item.position,
           'available', product.id IS NOT NULL, 'checked', item.checked,
           'check_version', item.check_version
         ) ORDER BY item.position ASC), '[]'::jsonb) AS items
         FROM business_shopping_list_items item
         LEFT JOIN products product ON product.id=item.product_id
           AND product.business_id=item.business_id AND product.is_active
         WHERE item.list_id=list.id AND item.business_id=list.business_id
       ) composition
       WHERE list.id=$1 AND list.business_id=$2`,
      [listId, businessId],
    );
    return row;
  }

  async lockList(
    manager: EntityManager,
    businessId: string,
    listId: string,
    forCompositionChange: boolean,
  ): Promise<{ version: number } | undefined> {
    const [row] = await manager.query<{ version: number }[]>(
      `SELECT version FROM business_shopping_lists WHERE id=$1 AND business_id=$2
       FOR ${forCompositionChange ? 'UPDATE' : 'SHARE'}`,
      [listId, businessId],
    );
    return row;
  }

  async lockCreateKey(
    manager: EntityManager,
    businessId: string,
    actorId: string,
    requestKey: string,
  ): Promise<void> {
    // A waiting transaction rereads the receipt after the preceding writer commits.
    const scope = `business-shopping-list-create:${businessId.toLowerCase()}:${actorId}:${requestKey.toLowerCase()}`;
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [scope],
    );
  }

  async findCreateReceipt(
    manager: EntityManager,
    businessId: string,
    actorId: string,
    requestKey: string,
  ): Promise<ShoppingListCreateReceipt | undefined> {
    const [row] = await manager.query<ShoppingListCreateReceipt[]>(
      `SELECT request_hash, result FROM business_shopping_list_create_requests
       WHERE business_id=$1 AND actor_id=$2 AND request_key=$3`,
      [businessId, actorId, requestKey],
    );
    return row;
  }

  async recordCreateReceipt(
    manager: EntityManager,
    businessId: string,
    actorId: string,
    requestKey: string,
    requestHash: string,
    result: ShoppingListDetail,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO business_shopping_list_create_requests
         (business_id, actor_id, request_key, list_id, request_hash, result)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        businessId,
        actorId,
        requestKey,
        result.id,
        requestHash,
        JSON.stringify(result),
      ],
    );
  }

  async insertList(
    manager: EntityManager,
    businessId: string,
    name: string,
  ): Promise<string> {
    const id = randomUUID();
    await manager.query(
      'INSERT INTO business_shopping_lists (id, business_id, name) VALUES ($1, $2, $3)',
      [id, businessId, name],
    );
    return id;
  }

  async lockAvailableProducts(
    manager: EntityManager,
    businessId: string,
    productIds: readonly string[],
  ): Promise<Map<string, string>> {
    if (productIds.length === 0) return new Map();
    const rows = await manager.query<{ id: string; name: string }[]>(
      `SELECT id::text AS id, name FROM products
       WHERE id=ANY($1::bigint[]) AND business_id=$2 AND is_active
       ORDER BY products.id FOR SHARE`,
      [productIds, businessId],
    );
    return new Map(rows.map(({ id, name }) => [id, name]));
  }

  async itemIdentities(
    manager: EntityManager,
    businessId: string,
    listId: string,
  ): Promise<ShoppingListItemIdentity[]> {
    return manager.query<ShoppingListItemIdentity[]>(
      `SELECT id, product_id::text FROM business_shopping_list_items
       WHERE list_id=$1 AND business_id=$2`,
      [listId, businessId],
    );
  }

  async replaceItems(
    manager: EntityManager,
    businessId: string,
    listId: string,
    items: readonly ShoppingListItemCommand[],
    productNames: ReadonlyMap<string, string>,
  ): Promise<void> {
    const positioned = items.map((item, position) => ({ ...item, position }));
    const retained = positioned.flatMap((item) =>
      item.item_id !== undefined ? [{ ...item, id: item.item_id }] : [],
    );
    const added = positioned.filter((item) => item.item_id === undefined);
    const retainedIds = retained.map(({ id }) => id);

    await manager.query(
      `DELETE FROM business_shopping_list_items
       WHERE list_id=$1 AND business_id=$2 AND NOT (id=ANY($3::uuid[]))`,
      [listId, businessId, retainedIds],
    );
    if (retained.length > 0) {
      await manager.query(
        `UPDATE business_shopping_list_items AS item
         SET quantity=changed.quantity, position=changed.position
         FROM unnest($3::uuid[], $4::numeric[], $5::integer[]) AS changed(id, quantity, position)
         WHERE item.list_id=$1 AND item.business_id=$2 AND item.id=changed.id
           AND (item.quantity, item.position) IS DISTINCT FROM (changed.quantity, changed.position)`,
        [
          listId,
          businessId,
          retainedIds,
          retained.map(({ quantity }) => quantity),
          retained.map(({ position }) => position),
        ],
      );
    }
    if (added.length > 0) {
      await manager.query(
        `INSERT INTO business_shopping_list_items
           (list_id, business_id, id, product_id, product_name, quantity, position)
         SELECT $1, $2, item.* FROM unnest($3::uuid[], $4::bigint[], $5::varchar[],
           $6::numeric[], $7::integer[]) AS item(id, product_id, product_name, quantity, position)`,
        [
          listId,
          businessId,
          added.map(() => randomUUID()),
          added.map(({ product_id }) => product_id),
          added.map(({ product_id }) => productNames.get(product_id)),
          added.map(({ quantity }) => quantity),
          added.map(({ position }) => position),
        ],
      );
    }
  }

  async rename(
    manager: EntityManager,
    businessId: string,
    listId: string,
    name: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE business_shopping_lists SET name=$3, version=version+1, updated_at=clock_timestamp()
       WHERE id=$1 AND business_id=$2`,
      [listId, businessId, name],
    );
  }

  async changeActivity(
    manager: EntityManager,
    businessId: string,
    listId: string,
    isActive: boolean,
  ): Promise<void> {
    await manager.query(
      `UPDATE business_shopping_lists SET is_active=$3, version=version+1, updated_at=clock_timestamp()
       WHERE id=$1 AND business_id=$2`,
      [listId, businessId, isActive],
    );
  }

  async lockCheck(
    manager: EntityManager,
    businessId: string,
    listId: string,
    itemId: string,
  ): Promise<ShoppingListCheck | undefined> {
    const [row] = await manager.query<ShoppingListCheck[]>(
      `SELECT id, checked, check_version FROM business_shopping_list_items
       WHERE list_id=$1 AND business_id=$2 AND id=$3 FOR UPDATE`,
      [listId, businessId, itemId],
    );
    return row;
  }

  async updateCheck(
    manager: EntityManager,
    businessId: string,
    listId: string,
    itemId: string,
    checked: boolean,
    actorId: string,
  ): Promise<ShoppingListCheck> {
    const [row] = await manager.query<ShoppingListCheck[]>(
      `WITH changed AS (
         UPDATE business_shopping_list_items
         SET checked=$4, check_version=check_version+1, checked_by=$5, checked_at=clock_timestamp()
         WHERE list_id=$1 AND business_id=$2 AND id=$3 RETURNING id, checked, check_version
       ) SELECT * FROM changed`,
      [listId, businessId, itemId, checked, actorId],
    );
    return row;
  }
}
