import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { applyRansack } from '../../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../../common/utils/ransack-query.policies.js';
import { CashBusinessScope } from '../cash-business-scope.js';
import type { QueryCashCategoriesDto } from '../dto/query-cash-categories.dto.js';
import { BusinessCashCategory } from '../entities/business-cash-category.entity.js';
import { publicCashCategory } from '../policies/cash-category.policy.js';
import { normalizeCashCategoryQuery } from '../policies/cash-category-query.policy.js';
import { cashReadCount } from '../policies/cash-query.policy.js';
import type { CashCategory } from '../types/cash.types.js';

export interface CashCategoryList {
  data: CashCategory[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

@Injectable()
export class ReadCashCategoriesUseCase {
  constructor(private readonly scope: CashBusinessScope) {}

  list(
    value: QueryCashCategoriesDto,
    actor: ActorReference,
    existingManager?: EntityManager,
  ): Promise<CashCategoryList> {
    const { filters, page, limit, direction } =
      normalizeCashCategoryQuery(value);
    const read = async (manager: EntityManager) => {
      const filtered = manager
        .getRepository(BusinessCashCategory)
        .createQueryBuilder('category')
        .select('category.id', 'id')
        .addSelect('category.business_id', 'business_id')
        .addSelect('category.normalized_name', 'normalized_name');
      applyRansack(
        filtered,
        filters,
        'category',
        RANSACK_POLICIES.business_cash_category,
      );
      const [sql, parameters] = filtered.getQueryAndParameters();
      const limitParam = parameters.push(limit);
      const offsetParam = parameters.push((page - 1) * limit);

      // Count and page use the same snapshot even when the requested page is empty.
      // Serialize bigint identifiers as text before converting the rows to JSON.
      const rows: { data: CashCategory[]; total: string }[] =
        await manager.query(
          `WITH filtered AS MATERIALIZED (${sql}),
          page AS (
            SELECT * FROM filtered ORDER BY normalized_name ${direction}, id ASC
            LIMIT $${limitParam} OFFSET $${offsetParam}
          )
          SELECT (SELECT count(*)::text FROM filtered) AS total,
            COALESCE(jsonb_agg(jsonb_build_object(
              'id', category.id::text, 'business_id', category.business_id, 'name', category.name,
              'description', category.description, 'is_active', category.is_active, 'version', category.version
            ) ORDER BY page.normalized_name ${direction}, page.id ASC), '[]'::jsonb) AS data
          FROM page JOIN business_cash_categories category USING (id, business_id)`,
          parameters,
        );
      const row = rows[0];
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
      };
    };
    return this.scope.run(filters.business_id_eq, actor, read, existingManager);
  }

  detail(id: string, actor: ActorReference): Promise<CashCategory> {
    return this.scope.forCategory(id, actor, async (manager, businessId) => {
      const category = await manager
        .getRepository(BusinessCashCategory)
        .findOne({
          select: {
            id: true,
            business_id: true,
            name: true,
            description: true,
            is_active: true,
            version: true,
          },
          where: { id, business_id: businessId },
        });
      if (!category) throw new NotFoundException('business:resource_not_found');
      return publicCashCategory(category);
    });
  }
}
