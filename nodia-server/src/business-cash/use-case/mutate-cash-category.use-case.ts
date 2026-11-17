import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { CreateCashCategoryDto } from '../dto/create-cash-category.dto.js';
import type { UpdateCashCategoryDto } from '../dto/update-cash-category.dto.js';
import {
  CASH_MAX_VERSION,
  normalizeCashCategoryCreate,
  normalizeCashCategoryUpdate,
  publicCashCategory,
  type CashCategoryFields,
} from '../policies/cash-category.policy.js';
import type { CashCategory } from '../types/cash.types.js';
import {
  CashWriteRejection,
  ExecuteCashMutationUseCase,
} from './execute-cash-mutation.use-case.js';

type CategoryChange = Partial<CashCategoryFields> & {
  expected_version: number;
};
const categoryColumns =
  'id, business_id, name, description, is_active, version';
const versionConflict = 'business:cash_version_conflict';

@Injectable()
export class MutateCashCategoryUseCase {
  constructor(private readonly mutation: ExecuteCashMutationUseCase) {}

  create(dto: CreateCashCategoryDto, actor: ActorReference) {
    const { request_key, business_id, normalized_name, ...fields } =
      normalizeCashCategoryCreate(dto);
    return this.mutation.execute(
      {
        requestKey: request_key,
        operation: 'category_create',
        target: { kind: 'business', id: business_id },
        intent: fields,
      },
      actor,
      async (manager) => {
        const [category] = await manager.query<CashCategory[]>(
          `INSERT INTO business_cash_categories
             (business_id, name, normalized_name, description, is_active, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING ${categoryColumns}`,
          [
            business_id,
            fields.name,
            normalized_name,
            fields.description,
            fields.is_active,
            actor.userId,
          ],
        );
        return { category: publicCashCategory(category) };
      },
    );
  }

  update(id: string, dto: UpdateCashCategoryDto, actor: ActorReference) {
    const { request_key, normalized_name, ...intent } =
      normalizeCashCategoryUpdate(dto);
    return this.mutation.execute(
      {
        requestKey: request_key,
        operation: 'category_update',
        target: { kind: 'category', id },
        intent,
      },
      actor,
      async (manager, businessId) => ({
        category: publicCashCategory(
          await this.updateCategory(manager, businessId, actor.userId, id, {
            ...intent,
            normalized_name,
          }),
        ),
      }),
    );
  }

  private async updateCategory(
    manager: EntityManager,
    businessId: string,
    actorId: string,
    id: string,
    fields: CategoryChange,
  ): Promise<CashCategory> {
    const [before] = await manager.query<
      (CashCategory & { normalized_name: string })[]
    >(
      `SELECT ${categoryColumns}, normalized_name FROM business_cash_categories
       WHERE id=$1 AND business_id=$2 FOR UPDATE`,
      [id, businessId],
    );
    if (!before)
      throw new CashWriteRejection(404, 'business:resource_not_found');
    if (before.version !== fields.expected_version)
      throw new CashWriteRejection(409, versionConflict);
    const name = fields.name ?? before.name;
    const canonical = fields.normalized_name ?? before.normalized_name;
    const description = fields.description ?? before.description;
    const active = fields.is_active ?? before.is_active;
    if (
      name === before.name &&
      canonical === before.normalized_name &&
      description === before.description &&
      active === before.is_active
    )
      return before;
    if (before.version >= CASH_MAX_VERSION)
      throw new CashWriteRejection(409, versionConflict);
    const [category] = await manager.query<CashCategory[]>(
      `WITH updated AS (
         UPDATE business_cash_categories
         SET name=$3, normalized_name=$4, description=$5, is_active=$6,
             version=version+1, updated_by=$7, updated_at=clock_timestamp()
         WHERE id=$1 AND business_id=$2
         RETURNING ${categoryColumns}
       ) SELECT * FROM updated`,
      [id, businessId, name, canonical, description, active, actorId],
    );
    return category;
  }
}
