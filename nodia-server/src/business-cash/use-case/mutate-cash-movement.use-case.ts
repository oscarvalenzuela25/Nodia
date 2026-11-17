import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { readCashMovement } from '../cash-movement-projection.js';
import type { CreateCashMovementDto } from '../dto/create-cash-movement.dto.js';
import type { UpdateCashMovementDto } from '../dto/update-cash-movement.dto.js';
import {
  CASH_MAX_VERSION,
  normalizeCashUuid,
} from '../policies/cash-category.policy.js';
import {
  normalizeCashMovementCreate,
  normalizeCashMovementUpdate,
  type CashMovementChange,
  type CashMovementFields,
} from '../policies/cash-movement-command.policy.js';
import type { CashMovement, CashMovementType } from '../types/cash.types.js';
import {
  CashWriteRejection,
  ExecuteCashMutationUseCase,
} from './execute-cash-mutation.use-case.js';

type CashMovementSnapshot = CashMovementFields &
  Pick<CashMovement, 'id' | 'business_id' | 'type' | 'version'>;

const snapshotColumns = `id, business_id, category_id::text, type,
  amount::text, to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on,
  description, is_active, version`;

const versionConflict = () =>
  new CashWriteRejection(409, 'business:cash_version_conflict');
const notFound = () =>
  new CashWriteRejection(404, 'business:resource_not_found');

async function lockCategory(
  manager: EntityManager,
  businessId: string,
  categoryId: string,
) {
  const [category] = await manager.query<{ is_active: boolean }[]>(
    `SELECT is_active FROM business_cash_categories
     WHERE id=$1 AND business_id=$2 FOR SHARE`,
    [categoryId, businessId],
  );
  return category;
}

function assertAssignable(category: { is_active: boolean } | undefined): void {
  if (!category) throw notFound();
  if (!category.is_active)
    throw new CashWriteRejection(409, 'business:cash_category_inactive');
}

async function auditMovement(
  manager: EntityManager,
  actorId: string,
  before: CashMovementSnapshot | null,
  after: CashMovementSnapshot,
): Promise<void> {
  await manager.query(
    `INSERT INTO business_cash_movement_audit
       (movement_id, version, business_id, actor_id, operation, "before", "after")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
    [
      after.id,
      after.version,
      after.business_id,
      actorId,
      before ? 'movement_update' : 'movement_create',
      before ? JSON.stringify(before) : null,
      JSON.stringify(after),
    ],
  );
}

@Injectable()
export class MutateCashMovementUseCase {
  constructor(private readonly mutation: ExecuteCashMutationUseCase) {}

  create(dto: CreateCashMovementDto, actor: ActorReference) {
    const { request_key, business_id, ...intent } =
      normalizeCashMovementCreate(dto);
    return this.mutation.execute(
      {
        requestKey: request_key,
        operation: 'movement_create',
        target: { kind: 'business', id: business_id },
        intent,
      },
      actor,
      async (manager, businessId) => {
        const id = await this.insert(manager, businessId, actor.userId, intent);
        return { movement: await readCashMovement(manager, id, businessId) };
      },
    );
  }

  update(rawId: string, dto: UpdateCashMovementDto, actor: ActorReference) {
    const id = normalizeCashUuid(rawId);
    const { request_key, ...intent } = normalizeCashMovementUpdate(dto);
    return this.mutation.execute(
      {
        requestKey: request_key,
        operation: 'movement_update',
        target: { kind: 'movement', id },
        intent,
      },
      actor,
      async (manager, businessId) => {
        await this.applyChange(manager, businessId, actor.userId, id, intent);
        return { movement: await readCashMovement(manager, id, businessId) };
      },
    );
  }

  private async insert(
    manager: EntityManager,
    businessId: string,
    actorId: string,
    fields: CashMovementFields & { type: CashMovementType },
  ): Promise<string> {
    assertAssignable(
      await lockCategory(manager, businessId, fields.category_id),
    );
    const id = randomUUID();
    const [after] = await manager.query<CashMovementSnapshot[]>(
      `INSERT INTO business_cash_movements
         (id, business_id, category_id, type, amount, occurred_on, description, is_active, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       RETURNING ${snapshotColumns}`,
      [
        id,
        businessId,
        fields.category_id,
        fields.type,
        fields.amount,
        fields.occurred_on,
        fields.description,
        fields.is_active,
        actorId,
      ],
    );
    await auditMovement(manager, actorId, null, after);
    return id;
  }

  private async applyChange(
    manager: EntityManager,
    businessId: string,
    actorId: string,
    id: string,
    { expected_version, ...changes }: CashMovementChange,
  ): Promise<void> {
    // Category writers and movement writers acquire locks in the same order.
    const category =
      changes.category_id === undefined
        ? undefined
        : await lockCategory(manager, businessId, changes.category_id);
    const [before] = await manager.query<CashMovementSnapshot[]>(
      `SELECT ${snapshotColumns} FROM business_cash_movements
       WHERE id=$1 AND business_id=$2 FOR UPDATE`,
      [id, businessId],
    );
    if (!before) throw notFound();
    if (before.version !== expected_version) throw versionConflict();
    if (
      Object.entries(changes).every(
        ([field, value]) => before[field as keyof CashMovementFields] === value,
      )
    )
      return;
    if (before.version >= CASH_MAX_VERSION) throw versionConflict();
    const afterFields = { ...before, ...changes };
    if (afterFields.category_id !== before.category_id)
      assertAssignable(category);
    const [after] = await manager.query<CashMovementSnapshot[]>(
      `WITH updated AS (
         UPDATE business_cash_movements
         SET category_id=$3, amount=$4, occurred_on=$5, description=$6, is_active=$7,
             version=version+1, updated_by=$8, updated_at=clock_timestamp()
         WHERE id=$1 AND business_id=$2
         RETURNING ${snapshotColumns}
       ) SELECT * FROM updated`,
      [
        id,
        businessId,
        afterFields.category_id,
        afterFields.amount,
        afterFields.occurred_on,
        afterFields.description,
        afterFields.is_active,
        actorId,
      ],
    );
    await auditMovement(manager, actorId, before, after);
  }
}
