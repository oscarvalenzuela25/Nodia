import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, SelectQueryBuilder } from 'typeorm';
import type { FinanceQueryDto } from '../finance-common/dto/finance-query.dto.js';
import {
  applyFinanceMovementFilters,
  applyFinanceQuery,
} from '../finance-common/finance-query.js';
import type {
  FinanceMovementTotalsRow,
  FinanceOverviewCountsRow,
  FinanceOverviewObligationsRow,
  FinanceSummaryRow,
} from './types/finance-overview.types.js';

@Injectable()
export class FinanceOverviewService {
  constructor(private readonly dataSource: DataSource) {}

  snapshot<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction('REPEATABLE READ', operation);
  }

  movementQuery(
    userId: string,
    query: FinanceQueryDto,
    manager?: EntityManager,
  ): SelectQueryBuilder<object> {
    const qb = (manager ?? this.dataSource)
      .createQueryBuilder()
      .from('finance_movements', 'movement')
      .where('movement.user_id = :finance_user', { finance_user: userId });
    applyFinanceQuery(qb, 'movement', query, 'movements');
    applyFinanceMovementFilters(qb, 'movement', query);
    return qb.orderBy();
  }

  async totals(
    userId: string,
    query: FinanceQueryDto,
    manager?: EntityManager,
  ): Promise<FinanceMovementTotalsRow> {
    return this.movementQuery(userId, query, manager)
      .select(
        "COALESCE(SUM(movement.amount) FILTER (WHERE movement.type = 'income' AND movement.status = 'received'), 0)::text",
        'income_amount',
      )
      .addSelect(
        "COALESCE(SUM(movement.amount) FILTER (WHERE movement.type = 'expense' AND movement.status = 'paid'), 0)::text",
        'expense_amount',
      )
      .addSelect('COUNT(*)::text', 'movement_count')
      .addSelect(
        "COUNT(*) FILTER (WHERE movement.status = 'pending')::text",
        'pending_count',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE movement.status = 'cancelled')::text",
        'cancelled_count',
      )
      .getRawOne<FinanceMovementTotalsRow>()
      .then((row) => {
        if (!row) throw new Error('finance:invalid_aggregate_result');
        return row;
      });
  }

  async counts(
    userId: string,
    query: FinanceQueryDto,
    manager?: EntityManager,
  ): Promise<FinanceOverviewCountsRow> {
    const active = query.active ?? 'active';
    const activeSql = active === 'all' ? '' : ' AND is_active = :count_active';
    const qb = (manager ?? this.dataSource)
      .createQueryBuilder()
      .from('(SELECT 1)', 'anchor')
      .select(
        `(SELECT COUNT(*)::text FROM finance_categories WHERE user_id = :finance_user${activeSql})`,
        'categories',
      )
      .addSelect(
        `(SELECT COUNT(*)::text FROM finance_category_groups WHERE user_id = :finance_user${activeSql})`,
        'category_groups',
      )
      .addSelect(
        `(SELECT COUNT(*)::text FROM finance_obligations WHERE user_id = :finance_user AND type = 'loan'${activeSql})`,
        'loans',
      )
      .addSelect(
        `(SELECT COUNT(*)::text FROM finance_obligations WHERE user_id = :finance_user AND type = 'debt'${activeSql})`,
        'debts',
      )
      .setParameters({
        finance_user: userId,
        count_active: active === 'active',
      });
    const [sql, parameters] = qb.getQueryAndParameters();
    const rows: FinanceOverviewCountsRow[] = await (
      manager ?? this.dataSource
    ).query(sql, parameters);
    if (!rows[0]) throw new Error('finance:invalid_aggregate_result');
    return rows[0];
  }

  async obligationBalances(
    userId: string,
    query: FinanceQueryDto,
    manager?: EntityManager,
  ): Promise<FinanceOverviewObligationsRow> {
    const active = query.active ?? 'active';
    const qb = (manager ?? this.dataSource)
      .createQueryBuilder()
      .from('finance_obligations', 'obligation')
      .where('obligation.user_id = :finance_user', { finance_user: userId });
    if (active !== 'all')
      qb.andWhere('obligation.is_active = :obligation_active', {
        obligation_active: active === 'active',
      });
    // Aggregate all historical events once per owner; avoid one scan per obligation.
    // Neither active nor time/name filters are applied to these repayments.
    qb.leftJoin(
      `(SELECT user_id, obligation_id,
        COALESCE(SUM(amount) FILTER (WHERE type = 'income' AND status = 'received'), 0) AS loan_paid,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND status = 'paid'), 0) AS debt_paid,
        BOOL_OR(type = 'expense' AND status <> 'cancelled') AS loan_origin,
        BOOL_OR(type = 'income' AND status <> 'cancelled') AS debt_origin
        FROM finance_movements WHERE user_id = :finance_user AND obligation_id IS NOT NULL
        GROUP BY user_id, obligation_id)`,
      'history',
      'history.user_id = obligation.user_id AND history.obligation_id = obligation.id',
    );
    qb.andWhere(
      `((obligation.type = 'loan' AND history.loan_origin = TRUE) OR (obligation.type = 'debt' AND history.debt_origin = TRUE))`,
    );
    const remaining = `(obligation.amount::numeric - CASE WHEN obligation.type = 'loan' THEN history.loan_paid ELSE history.debt_paid END)`;
    const row = await qb
      .select(
        `COALESCE(SUM(${remaining}) FILTER (WHERE obligation.type = 'loan'), 0)::text`,
        'loan_remaining_amount',
      )
      .addSelect(
        `COALESCE(SUM(${remaining}) FILTER (WHERE obligation.type = 'debt'), 0)::text`,
        'debt_remaining_amount',
      )
      .getRawOne<FinanceOverviewObligationsRow>();
    if (!row) throw new Error('finance:invalid_aggregate_result');
    return row;
  }

  async summary(
    userId: string,
    catalogueQuery: FinanceQueryDto,
    movementQuery: FinanceQueryDto,
    grouped: boolean,
    manager?: EntityManager,
  ): Promise<{ rows: FinanceSummaryRow[]; total: number }> {
    const table = grouped ? 'finance_category_groups' : 'finance_categories';
    const catalog = (manager ?? this.dataSource)
      .createQueryBuilder()
      .from(table, 'catalogue')
      .where('catalogue.user_id = :catalogue_user', { catalogue_user: userId });
    applyFinanceQuery(
      catalog,
      'catalogue',
      catalogueQuery,
      grouped ? 'category-groups' : 'categories',
    );
    const countBuilder = catalog
      .clone()
      .orderBy()
      .select('COUNT(*)::text', 'total');
    const aggregate = this.movementQuery(userId, movementQuery, manager)
      .select('movement.category_id', 'category_id')
      .addSelect('movement.user_id', 'user_id')
      .addSelect('COUNT(*)', 'movement_count')
      .addSelect(
        "COALESCE(SUM(movement.amount) FILTER (WHERE movement.type = 'income' AND movement.status = 'received'), 0)",
        'income_amount',
      )
      .addSelect(
        "COALESCE(SUM(movement.amount) FILTER (WHERE movement.type = 'expense' AND movement.status = 'paid'), 0)",
        'expense_amount',
      )
      .groupBy('movement.user_id')
      .addGroupBy('movement.category_id');
    const movementParameters = aggregate.getParameters();
    // Catalogue search and financial search may both use ransack_0 with different values.
    const aggregateSql = aggregate
      .getQuery()
      .replace(
        /:(\.\.\.)?([a-z_][a-z0-9_]*)\b/gi,
        (match: string, spread: string | undefined, name: string) =>
          Object.hasOwn(movementParameters, name)
            ? `:${spread ?? ''}summary_movement_${name}`
            : match,
      );
    const prefixedParameters = Object.fromEntries(
      Object.entries(movementParameters).map(([name, value]) => [
        `summary_movement_${name}`,
        value,
      ]),
    );
    if (grouped) {
      catalog.leftJoin(
        'finance_category_group_memberships',
        'membership',
        'membership.user_id = catalogue.user_id AND membership.category_group_id = catalogue.id AND membership.is_active = TRUE',
      );
      catalog.leftJoin(
        `(${aggregateSql})`,
        'amounts',
        'amounts.user_id = catalogue.user_id AND amounts.category_id = membership.category_id',
      );
    } else {
      catalog.leftJoin(
        `(${aggregateSql})`,
        'amounts',
        'amounts.user_id = catalogue.user_id AND amounts.category_id = catalogue.id',
      );
    }
    catalog
      .setParameters(prefixedParameters)
      .select('catalogue.id::text', 'id')
      .addSelect('catalogue.name', 'name')
      .addSelect('catalogue.key', 'key')
      .addSelect('catalogue.is_active', 'is_active')
      .addSelect(
        'COALESCE(SUM(amounts.movement_count), 0)::text',
        'movement_count',
      )
      .addSelect(
        'COALESCE(SUM(amounts.income_amount), 0)::text',
        'income_amount',
      )
      .addSelect(
        'COALESCE(SUM(amounts.expense_amount), 0)::text',
        'expense_amount',
      )
      .groupBy('catalogue.id')
      .addGroupBy('catalogue.name')
      .addGroupBy('catalogue.key')
      .addGroupBy('catalogue.is_active')
      .addGroupBy('catalogue.created_at')
      .addGroupBy('catalogue.updated_at')
      .limit(catalogueQuery.limit ?? 10)
      .offset(((catalogueQuery.page ?? 1) - 1) * (catalogueQuery.limit ?? 10));
    const count = await countBuilder.getRawOne<{ total: string }>();
    const rows = await catalog.getRawMany<FinanceSummaryRow>();
    if (!count) throw new Error('finance:invalid_aggregate_result');
    const total = Number(count.total);
    if (!Number.isSafeInteger(total) || total < 0)
      throw new Error('finance:invalid_aggregate_result');
    return { rows, total };
  }
}
