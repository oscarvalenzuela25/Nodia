import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { applyRansack } from '../../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../../common/utils/ransack-query.policies.js';
import { CashBusinessScope } from '../cash-business-scope.js';
import {
  CASH_MOVEMENT_JSON,
  readCashMovement,
} from '../cash-movement-projection.js';
import type { QueryCashMovementsDto } from '../dto/query-cash-movements.dto.js';
import { BusinessCashMovement } from '../entities/business-cash-movement.entity.js';
import { normalizeCashUuid } from '../policies/cash-category.policy.js';
import { cashMonthlyPeriod } from '../policies/cash-movement-date.js';
import { normalizeCashMovementQuery } from '../policies/cash-movement-query.policy.js';
import {
  CASH_INVALID_QUERY,
  cashReadCount,
} from '../policies/cash-query.policy.js';
import type {
  CashMonthlySummary,
  CashMovement,
  CashSummary,
} from '../types/cash.types.js';

const CASH_SUMMARY_COLUMNS = `
  (count(*) FILTER (WHERE type = 'income'))::text AS income_count,
  COALESCE(sum(amount) FILTER (WHERE type = 'income'), 0)::text AS income_amount,
  (count(*) FILTER (WHERE type = 'expense'))::text AS expense_count,
  COALESCE(sum(amount) FILTER (WHERE type = 'expense'), 0)::text AS expense_amount`;

interface CashSummaryRow {
  income_count: string;
  income_amount: string;
  expense_count: string;
  expense_amount: string;
}

function cashSummary(row: CashSummaryRow | undefined): CashSummary {
  if (!row)
    throw new InternalServerErrorException('business:cash_invalid_total');
  return {
    currency: 'CLP',
    income: {
      count: cashReadCount(row.income_count),
      total_amount: row.income_amount,
    },
    expense: {
      count: cashReadCount(row.expense_count),
      total_amount: row.expense_amount,
    },
  };
}

export interface CashMovementList {
  data: CashMovement[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
  summary: CashSummary;
}

@Injectable()
export class ReadCashMovementsUseCase {
  constructor(private readonly scope: CashBusinessScope) {}

  list(
    value: QueryCashMovementsDto,
    actor: ActorReference,
  ): Promise<CashMovementList> {
    const { filters, page, limit, search, order, direction } =
      normalizeCashMovementQuery(value);
    return this.scope.run(filters.business_id_eq, actor, async (manager) => {
      const filtered = manager
        .getRepository(BusinessCashMovement)
        .createQueryBuilder('movement')
        .select('movement.id', 'id')
        .addSelect('movement.business_id', 'business_id')
        .addSelect('movement.type', 'type')
        .addSelect('movement.amount', 'amount')
        .addSelect('movement.occurred_on', 'occurred_on');
      applyRansack(
        filtered,
        filters,
        'movement',
        RANSACK_POLICIES.business_cash_movement,
      );

      if (search) {
        filtered.andWhere(
          `(movement.description ILIKE :term ESCAPE '!' OR EXISTS (
             SELECT 1 FROM business_cash_categories category
             WHERE category.id = movement.category_id AND category.business_id = movement.business_id
               AND category.name ILIKE :term ESCAPE '!'
           ))`,
          { term: `%${search.replace(/[!%_]/g, '!$&')}%` },
        );
      }

      const [sql, parameters] = filtered.getQueryAndParameters();
      const limitParam = parameters.push(limit);
      const offsetParam = parameters.push((page - 1) * limit);

      // Aggregate the filtered rows before pagination, then project only the page.
      const [row] = await manager.query<
        (CashSummaryRow & { data: CashMovement[]; total: string })[]
      >(
        `WITH filtered AS MATERIALIZED (${sql}),
         page AS (
           SELECT id, business_id, ${order} FROM filtered ORDER BY ${order} ${direction}, id ${direction}
           LIMIT $${limitParam} OFFSET $${offsetParam}
         )
         SELECT count(*)::text AS total, ${CASH_SUMMARY_COLUMNS},
           COALESCE((
             SELECT jsonb_agg(${CASH_MOVEMENT_JSON} ORDER BY page.${order} ${direction}, page.id ${direction})
             FROM page
             JOIN business_cash_movements movement USING (id, business_id)
             JOIN business_cash_categories category
               ON category.id = movement.category_id AND category.business_id = movement.business_id
           ), '[]'::jsonb) AS data
         FROM filtered`,
        parameters,
      );
      if (!row)
        throw new InternalServerErrorException('business:cash_invalid_total');
      const total = cashReadCount(row.total);
      return {
        data: row.data,
        meta: {
          page,
          limit,
          total_items: total,
          total_pages: Math.ceil(total / limit),
        },
        summary: cashSummary(row),
      };
    });
  }

  detail(id: string, actor: ActorReference): Promise<CashMovement> {
    return this.scope.forMovement(
      id,
      actor,
      (manager, businessId, movementId) =>
        readCashMovement(manager, movementId, businessId),
    );
  }

  monthly(
    business: string,
    actor: ActorReference,
  ): Promise<CashMonthlySummary> {
    const businessId = normalizeCashUuid(business, CASH_INVALID_QUERY);
    return this.scope.run(businessId, actor, async (manager) => {
      const period = cashMonthlyPeriod(new Date());
      const [row] = await manager.query<CashSummaryRow[]>(
        `SELECT ${CASH_SUMMARY_COLUMNS} FROM business_cash_movements
         WHERE business_id = $1 AND is_active AND occurred_on BETWEEN $2::date AND $3::date`,
        [businessId, period.from, period.to],
      );
      return { period, summary: cashSummary(row) };
    });
  }
}
