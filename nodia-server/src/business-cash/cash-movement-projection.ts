import { NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { CashMovement } from './types/cash.types.js';

export const CASH_MOVEMENT_JSON = `jsonb_build_object(
  'id', movement.id,
  'business_id', movement.business_id,
  'category_id', movement.category_id::text,
  'category', jsonb_build_object(
    'id', category.id::text, 'name', category.name, 'is_active', category.is_active
  ),
  'type', movement.type,
  'amount', movement.amount::text,
  'occurred_on', to_char(movement.occurred_on, 'YYYY-MM-DD'),
  'description', movement.description,
  'is_active', movement.is_active,
  'version', movement.version,
  'source', movement.source,
  'invoice', CASE WHEN movement.source = 'invoice'
    THEN jsonb_build_object('id', invoice.id::text, 'code', invoice.code)
    ELSE NULL END
)`;

export const CASH_MOVEMENT_DETAIL_JOINS = `
  JOIN business_cash_categories category
    ON category.id = movement.category_id AND category.business_id = movement.business_id
  LEFT JOIN invoices invoice
    ON invoice.id = movement.invoice_id AND invoice.business_id = movement.business_id`;

export async function readCashMovement(
  manager: EntityManager,
  id: string,
  businessId: string,
): Promise<CashMovement> {
  const [row] = await manager.query<{ movement: CashMovement }[]>(
    `SELECT ${CASH_MOVEMENT_JSON} AS movement
     FROM business_cash_movements movement
     ${CASH_MOVEMENT_DETAIL_JOINS}
     WHERE movement.business_id = $1 AND movement.id = $2
       AND NOT movement.withdrawn_from_invoice`,
    [businessId, id],
  );
  if (!row) throw new NotFoundException('business:resource_not_found');
  return row.movement;
}
