import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import {
  CASH_MOVEMENT_SNAPSHOT_COLUMNS,
  assertCashMovementCategoryAssignable,
  cashMovementNotFound,
  cashMovementVersionConflict,
  lockCashMovementCategory,
  recordCashMovementAudit,
  type CashMovementSnapshot,
} from '../cash-movement-persistence.js';
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
import type { CashMovementType } from '../types/cash.types.js';
import {
  CashWriteRejection,
  ExecuteCashMutationUseCase,
} from './execute-cash-mutation.use-case.js';

async function readMovementForChange(
  manager: EntityManager,
  id: string,
  businessId: string,
  lock = false,
): Promise<CashMovementSnapshot> {
  const [movement] = await manager.query<CashMovementSnapshot[]>(
    `SELECT ${CASH_MOVEMENT_SNAPSHOT_COLUMNS} FROM business_cash_movements
     WHERE id=$1 AND business_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [id, businessId],
  );
  if (!movement || movement.withdrawn_from_invoice)
    throw cashMovementNotFound();
  return movement;
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
    assertCashMovementCategoryAssignable(
      await lockCashMovementCategory(manager, businessId, fields.category_id),
    );
    const id = randomUUID();
    const [after] = await manager.query<CashMovementSnapshot[]>(
      `INSERT INTO business_cash_movements
         (id, business_id, category_id, type, amount, occurred_on, description, is_active, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       RETURNING ${CASH_MOVEMENT_SNAPSHOT_COLUMNS}`,
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
    await recordCashMovementAudit(
      manager,
      actorId,
      'movement_create',
      null,
      after,
    );
    return id;
  }

  private async applyChange(
    manager: EntityManager,
    businessId: string,
    actorId: string,
    id: string,
    { expected_version, ...changes }: CashMovementChange,
  ): Promise<void> {
    const hint = await readMovementForChange(manager, id, businessId);
    if (hint.source === 'invoice') {
      const [invoice] = await manager.query<{ id: string }[]>(
        `SELECT id FROM invoices WHERE id=$1 AND business_id=$2 FOR UPDATE`,
        [hint.invoice_id, businessId],
      );
      if (!invoice) throw cashMovementNotFound();
    }

    // An assignment takes the category lock before the movement lock.
    const category =
      hint.source === 'manual' && changes.category_id !== undefined
        ? await lockCashMovementCategory(
            manager,
            businessId,
            changes.category_id,
          )
        : undefined;
    const before = await readMovementForChange(manager, id, businessId, true);
    if (
      before.version !== expected_version ||
      before.source !== hint.source ||
      before.invoice_id !== hint.invoice_id
    )
      throw cashMovementVersionConflict();
    if (
      before.source === 'invoice' &&
      Object.keys(changes).some((field) => field !== 'is_active')
    )
      throw new CashWriteRejection(400, 'business:cash_invalid_command');
    if (
      Object.entries(changes).every(
        ([field, value]) => before[field as keyof CashMovementFields] === value,
      )
    )
      return;
    if (before.version >= CASH_MAX_VERSION) throw cashMovementVersionConflict();
    const afterFields = { ...before, ...changes };
    if (afterFields.category_id !== before.category_id)
      assertCashMovementCategoryAssignable(category);
    const [after] = await manager.query<CashMovementSnapshot[]>(
      `WITH updated AS (
         UPDATE business_cash_movements
         SET category_id=$3, amount=$4, occurred_on=$5, description=$6, is_active=$7,
             version=version+1, updated_by=$8, updated_at=clock_timestamp()
         WHERE id=$1 AND business_id=$2
         RETURNING ${CASH_MOVEMENT_SNAPSHOT_COLUMNS}
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
    await recordCashMovementAudit(
      manager,
      actorId,
      'movement_update',
      before,
      after,
    );
  }
}
