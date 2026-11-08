import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { CheckModuleAccessUseCase } from '../../authorization/use-case/check-module-access.use-case.js';
import {
  SALE_PUBLIC_SELECT,
  SaleService,
  publicSale,
} from '../sale.service.js';
import { runSaleScope } from '../sale-authority.js';
import {
  normalizeSaleQuery,
  saleUuid,
  SALE_TIMEZONE,
} from '../policies/sale-policy.js';
import { compileSalesReport } from '../reporting/compile-sales-report.js';
import type {
  SaleActor,
  SaleListQuery,
  SaleView,
} from '../types/sale.types.js';
import { exactSaleQuantityReport } from '../policies/sale-quantity.js';
import { validateProductMeasurementUnit } from '../../product/product-measurement-unit.js';

function exact(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value))
    throw new InternalServerErrorException('business:sale_report_invalid');
  return value;
}
function count(value: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0)
    throw new InternalServerErrorException('business:sale_report_invalid');
  return result;
}

@Injectable()
export class ReadSalesUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly store: SaleService,
    private readonly modules: CheckModuleAccessUseCase,
  ) {}

  get(
    businessId: string,
    id: string,
    actor: SaleActor,
    manager?: EntityManager,
  ): Promise<SaleView> {
    saleUuid(id);
    return runSaleScope(
      this.source,
      this.modules,
      businessId,
      actor,
      (tx) => this.store.load(tx, businessId, id),
      manager,
    );
  }
  async list(
    businessId: string,
    value: SaleListQuery,
    actor: SaleActor,
    manager?: EntityManager,
  ) {
    const query = normalizeSaleQuery(value);
    if (query.metric !== undefined)
      throw new BadRequestException('business:sale_invalid_command');
    return runSaleScope(
      this.source,
      this.modules,
      businessId,
      actor,
      async (tx) => {
        const parameters: unknown[] = [businessId];
        const bind = (v: unknown) => {
          parameters.push(v);
          return `$${parameters.length}`;
        };
        const predicates = ['s.business_id=$1'];
        if (query.status !== undefined)
          predicates.push(`s.status=${bind(query.status)}`);
        else predicates.push("s.status<>'discarded'");
        if (query.from)
          predicates.push(
            `s.completed_at>=${bind(query.from)}::timestamptz AND s.completed_at<${bind(query.to_exclusive)}::timestamptz`,
          );
        if (query.search?.trim()) {
          const term = bind(
            `%${query.search.trim().replace(/[\\%_]/g, '\\$&')}%`,
          );
          predicates.push(`(s.id::text ILIKE ${term} ESCAPE '\\' OR EXISTS (
          SELECT 1 FROM sale_items search_item WHERE search_item.sale_id=s.id AND search_item.business_id=s.business_id
          AND (search_item.product_name_snapshot ILIKE ${term} ESCAPE '\\' OR
            search_item.product_code_snapshot ILIKE ${term} ESCAPE '\\' OR
            search_item.product_barcode_snapshot ILIKE ${term} ESCAPE '\\'))) `);
        }
        const limit = bind(query.limit),
          offset = bind((query.page - 1) * query.limit);
        // Count and page share one database snapshot; item projections never multiply the parent count.
        const rows: { total: string; data: SaleView[] }[] = await tx.query(
          `WITH filtered AS MATERIALIZED (
        SELECT s.* FROM sales s WHERE ${predicates.join(' AND ')}
      ) SELECT (SELECT count(*)::text FROM filtered) AS total, COALESCE((SELECT jsonb_agg(page ORDER BY page.updated_at DESC,page.id DESC)
        FROM (SELECT ${SALE_PUBLIC_SELECT} FROM filtered s ORDER BY s.updated_at DESC,s.id DESC
          LIMIT ${limit} OFFSET ${offset}) page),'[]'::jsonb) AS data`,
          parameters,
        );
        const total = count(exact(rows[0].total));
        return {
          data: rows[0].data.map(publicSale),
          meta: {
            total,
            total_items: total,
            page: query.page,
            limit: query.limit,
            total_pages: Math.ceil(total / query.limit),
          },
        };
      },
      manager,
    );
  }
  async receipt(
    businessId: string,
    key: string,
    actor: SaleActor,
    manager?: EntityManager,
  ) {
    saleUuid(key);
    return runSaleScope(
      this.source,
      this.modules,
      businessId,
      actor,
      async (tx) => {
        const rows: { result: SaleView | null; result_version: number }[] =
          await tx.query(
            'SELECT result,result_version FROM sale_mutation_requests WHERE business_id=$1 AND actor_id=$2 AND request_key=$3',
            [businessId, actor.userId, key],
          );
        return rows[0]?.result
          ? {
              status: 'completed' as const,
              sale: rows[0].result,
              result_version: rows[0].result_version,
            }
          : { status: 'unconfirmed' as const };
      },
      manager,
    );
  }
  async summary(
    businessId: string,
    value: SaleListQuery,
    actor: SaleActor,
    manager?: EntityManager,
  ) {
    const query = normalizeSaleQuery(value);
    if (
      query.status !== undefined ||
      query.search !== undefined ||
      query.metric !== undefined
    )
      throw new BadRequestException('business:sale_invalid_command');
    return runSaleScope(
      this.source,
      this.modules,
      businessId,
      actor,
      async (tx) => {
        const args = {
          business_id: businessId,
          from: query.from,
          to_exclusive: query.to_exclusive,
        };
        const sales = compileSalesReport('sales', args),
          items = compileSalesReport('items', args);
        const itemsSql = items.sql.replace(
          /\$(\d+)/g,
          (_, index: string) => `$${Number(index) + sales.parameters.length}`,
        );
        const rows: {
          sales: Record<string, unknown>;
          items: Record<string, unknown>[];
        }[] = await tx.query(
          `WITH sales_report AS (${sales.sql}),items_report AS (${itemsSql})
         SELECT sales_report.totals AS sales,items_report.rows AS items FROM sales_report,items_report`,
          [...sales.parameters, ...items.parameters],
        );
        const field = (
          columns: typeof sales.columns,
          key: string,
          row: Record<string, unknown>,
        ) =>
          exact(
            row[columns.find((column) => column.output_key === key)!.sql_key],
          );
        const salesCount = field(sales.columns, 'sales_count', rows[0].sales);
        const total = field(sales.columns, 'total_amount', rows[0].sales);
        const unitKey = items.columns.find(
          (column) => column.output_key === 'measurement_unit',
        )!.sql_key;
        const quantityKey = items.columns.find(
          (column) => column.output_key === 'units_sold',
        )!.sql_key;
        const quantityByUnit = rows[0].items.map((row) => {
          const unit = row[unitKey];
          validateProductMeasurementUnit(unit);
          return {
            measurement_unit: unit,
            quantity: exactSaleQuantityReport(row[quantityKey]),
          };
        });
        return {
          currency: 'CLP' as const,
          timezone: SALE_TIMEZONE,
          sales_count: salesCount,
          total_amount: total,
          // Compatibility scalar counts only products sold as individual units.
          units_sold:
            quantityByUnit.find((row) => row.measurement_unit === 'unit')
              ?.quantity ?? '0',
          quantity_by_unit: quantityByUnit,
          average_ticket:
            salesCount === '0'
              ? null
              : { numerator: total, denominator: salesCount },
        };
      },
      manager,
    );
  }
  async topProducts(
    businessId: string,
    value: SaleListQuery,
    actor: SaleActor,
    manager?: EntityManager,
  ) {
    const query = normalizeSaleQuery(value);
    if (query.status !== undefined || query.search !== undefined)
      throw new BadRequestException('business:sale_invalid_command');
    return runSaleScope(
      this.source,
      this.modules,
      businessId,
      actor,
      async (tx) => {
        const report = compileSalesReport('top', {
          business_id: businessId,
          from: query.from,
          to_exclusive: query.to_exclusive,
          metric: query.metric,
          limit: query.limit,
        });
        const idKey = report.columns.find(
          (c) => c.output_key === 'product_id',
        )!.sql_key;
        const unitKey = report.columns.find(
          (column) => column.output_key === 'measurement_unit',
        )!.sql_key;
        const parameters: unknown[] = [...report.parameters];
        const bind = (v: unknown) => {
          parameters.push(v);
          return `$${parameters.length}`;
        };
        const period = query.from
          ? `AND s.completed_at>=${bind(query.from)}::timestamptz AND s.completed_at<${bind(query.to_exclusive)}::timestamptz`
          : '';
        // Choose labels from a deterministic historical snapshot in the same filtered population and SQL snapshot.
        const rows: {
          rows: Record<string, unknown>[];
          labels: Record<string, { code: string | null; name: string }>;
        }[] = await tx.query(
          `WITH report AS (${report.sql}) SELECT report.rows,COALESCE((SELECT jsonb_object_agg(labels.product_id||':'||labels.measurement_unit,
          jsonb_build_object('code',labels.code,'name',labels.name)) FROM (
          SELECT DISTINCT ON(i.product_id,i.measurement_unit_snapshot) i.product_id::text,i.measurement_unit_snapshot AS measurement_unit,i.product_code_snapshot AS code,i.product_name_snapshot AS name
          FROM sale_items i JOIN sales s ON s.id=i.sale_id AND s.business_id=i.business_id
          WHERE i.business_id=$1 AND s.status='completed' AND EXISTS
            (SELECT 1 FROM jsonb_array_elements(report.rows) entry WHERE entry->>'${idKey}'=i.product_id::text
              AND entry->>'${unitKey}'=i.measurement_unit_snapshot)
          ${period} ORDER BY i.product_id,i.measurement_unit_snapshot,s.completed_at DESC,s.id DESC,i.position DESC
        ) labels),'{}'::jsonb) AS labels FROM report`,
          parameters,
        );
        const field = (row: Record<string, unknown>, key: string) =>
          exact(row[report.columns.find((c) => c.output_key === key)!.sql_key]);
        return {
          currency: 'CLP' as const,
          timezone: SALE_TIMEZONE,
          metric: query.metric ?? 'units',
          data: rows[0].rows.slice(0, query.limit).map((row) => {
            const id = field(row, 'product_id'),
              unit = row[unitKey];
            validateProductMeasurementUnit(unit);
            const label = rows[0].labels[`${id}:${unit}`];
            if (!label)
              throw new InternalServerErrorException(
                'business:sale_report_invalid',
              );
            return {
              product_id: id,
              code: label.code,
              name: label.name,
              measurement_unit: unit,
              units_sold: exactSaleQuantityReport(
                row[
                  report.columns.find(
                    (column) => column.output_key === 'units_sold',
                  )!.sql_key
                ],
              ),
              total_amount: field(row, 'total_amount'),
            };
          }),
        };
      },
      manager,
    );
  }
}
