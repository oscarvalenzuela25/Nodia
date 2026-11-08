import { Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type {
  ProductSaleRow,
  SaleItemSnapshot,
  SaleView,
} from './types/sale.types.js';

const itemProjection = `jsonb_build_object(
  'id', i.id, 'product_id', i.product_id::text, 'position', i.position, 'quantity', i.quantity,
  'product_code_snapshot', i.product_code_snapshot, 'measurement_unit_snapshot', i.measurement_unit_snapshot, 'product_barcode_snapshot', i.product_barcode_snapshot,
  'product_name_snapshot', i.product_name_snapshot, 'regular_unit_price', i.regular_unit_price::text,
  'offer_price_snapshot', i.offer_price_snapshot::text, 'is_offer_enabled_snapshot', i.is_offer_enabled_snapshot,
  'price_source', i.price_source, 'unit_price', i.unit_price::text, 'line_total', i.line_total::text,
  'product_version', i.product_version)`;
export const SALE_PUBLIC_SELECT = `s.id::text, s.business_id::text, s.status, s.currency,
  s.payment_method, s.payment_method_description, s.total_amount::text, s.version,
  s.created_at, s.updated_at, s.completed_at, s.cancelled_at, s.cancellation_reason,
  COALESCE((SELECT jsonb_agg(${itemProjection} ORDER BY i.position)
    FROM sale_items i WHERE i.business_id=s.business_id AND i.sale_id=s.id),'[]'::jsonb) AS items`;

type SaleRow = Omit<
  SaleView,
  'created_at' | 'updated_at' | 'completed_at' | 'cancelled_at'
> & {
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
  cancelled_at: Date | string | null;
};
export function publicSale(row: SaleRow): SaleView {
  const instant = (value: Date | string) =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  return {
    ...row,
    created_at: instant(row.created_at),
    updated_at: instant(row.updated_at),
    completed_at: row.completed_at === null ? null : instant(row.completed_at),
    cancelled_at: row.cancelled_at === null ? null : instant(row.cancelled_at),
  };
}

/** Persistence only; authority, state and pricing policy belong to the use cases. */
@Injectable()
export class SaleService {
  async load(
    manager: EntityManager,
    businessId: string,
    id: string,
    lock = false,
  ): Promise<SaleView> {
    if (lock) {
      // Acquire the aggregate lock before taking the snapshot used for its lines.
      // A SELECT with both FOR UPDATE and a correlated subquery can otherwise
      // recheck a new header after waiting while still projecting old lines.
      const locked: { id: string }[] = await manager.query(
        'SELECT id::text FROM sales WHERE business_id=$1 AND id=$2 FOR UPDATE',
        [businessId, id],
      );
      if (!locked[0])
        throw new NotFoundException('business:resource_not_found');
    }
    const rows: SaleRow[] = await manager.query(
      `SELECT ${SALE_PUBLIC_SELECT} FROM sales s WHERE s.business_id=$1 AND s.id=$2`,
      [businessId, id],
    );
    if (!rows[0]) throw new NotFoundException('business:resource_not_found');
    return publicSale(rows[0]);
  }
  async products(
    manager: EntityManager,
    businessId: string,
    ids: readonly string[],
  ): Promise<ProductSaleRow[]> {
    if (!ids.length) return [];
    return manager.query(
      `SELECT p.id::text,p.business_id::text,p.code,p.barcode,p.name,p.sale_price::text,p.offer_price::text,
      is_offer_enabled,cost_price::text,cost_price_tax::text,version,is_active,has_stock,measurement_unit
      FROM products p WHERE p.business_id=$1 AND p.id=ANY($2::bigint[]) ORDER BY p.id FOR SHARE`,
      [businessId, ids],
    );
  }
  async replaceItems(
    manager: EntityManager,
    businessId: string,
    saleId: string,
    items: SaleItemSnapshot[],
  ): Promise<void> {
    await manager.query(
      'DELETE FROM sale_items WHERE business_id=$1 AND sale_id=$2',
      [businessId, saleId],
    );
    if (!items.length) return;
    await manager.query(
      `INSERT INTO sale_items (id,business_id,sale_id,product_id,position,quantity,
      product_code_snapshot,measurement_unit_snapshot,product_barcode_snapshot,product_name_snapshot,regular_unit_price,offer_price_snapshot,
      is_offer_enabled_snapshot,price_source,unit_price,cost_price_snapshot,cost_price_tax_snapshot,line_total,product_version)
      SELECT x.id,$1,$2,x.product_id,x.position,x.quantity,x.product_code_snapshot,x.measurement_unit_snapshot,x.product_barcode_snapshot,
        x.product_name_snapshot,x.regular_unit_price,x.offer_price_snapshot,x.is_offer_enabled_snapshot,x.price_source,
        x.unit_price,x.cost_price_snapshot,x.cost_price_tax_snapshot,x.line_total,x.product_version
      FROM jsonb_to_recordset($3::jsonb) AS x(id uuid,product_id bigint,position integer,quantity numeric,
        product_code_snapshot varchar,measurement_unit_snapshot varchar,product_barcode_snapshot varchar,product_name_snapshot varchar,
        regular_unit_price bigint,offer_price_snapshot bigint,is_offer_enabled_snapshot boolean,price_source varchar,
        unit_price bigint,cost_price_snapshot bigint,cost_price_tax_snapshot bigint,line_total bigint,product_version integer)`,
      [businessId, saleId, JSON.stringify(items)],
    );
  }
}
