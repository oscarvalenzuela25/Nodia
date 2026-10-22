import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import {
  ensureRepaymentCapacity,
  isConfirmed,
  repaymentType,
  requireActiveCategory,
  requireInitialMovement,
  requireOwned,
  validateMovementState,
  validateStatusTransition,
} from '../../finance-obligation/use-case/finance-ledger.rules.js';
import type { UpdateFinanceMovementDto } from '../dto/update-finance-movement.dto.js';

/** Shared native validation plan. Reads/locks only; all entry points use these same ledger rules. */
export async function resolveFinanceMovementUpdate(
  ledger: FinanceLedgerService,
  manager: EntityManager,
  userId: string,
  id: string,
  dto: UpdateFinanceMovementDto,
) {
  const identity = requireOwned(
    await ledger.movement(manager, userId, id, false),
  );
  const obligation = identity.obligation_id
    ? requireOwned(
        await ledger.obligation(manager, userId, identity.obligation_id),
      )
    : null;
  const movement = requireOwned(await ledger.movement(manager, userId, id));
  const next = { ...movement };
  if (dto.name !== undefined) next.name = dto.name;
  if (dto.amount !== undefined) next.amount = dto.amount;
  if (dto.type !== undefined) next.type = dto.type;
  if (dto.status !== undefined) next.status = dto.status;
  if (dto.category_id !== undefined) next.category_id = dto.category_id;
  if (dto.is_active !== undefined) next.is_active = dto.is_active;
  validateMovementState(next.type, next.status);
  const changesOrdinaryConfirmedDirection =
    obligation === null &&
    movement.type !== next.type &&
    isConfirmed(movement) &&
    isConfirmed(next);
  if (!changesOrdinaryConfirmedDirection)
    validateStatusTransition(movement.status, next.status);
  if (obligation !== null) {
    if (next.type !== movement.type)
      throw new ConflictException('finance:immutable_linked_direction');
    const initial = requireInitialMovement(
      await ledger.initialMovements(manager, obligation),
    );
    if (movement.type !== repaymentType(obligation)) {
      if (dto.amount !== undefined && dto.amount !== movement.amount)
        throw new ConflictException('finance:edit_principal_on_obligation');
      if (
        next.status === 'cancelled' &&
        movement.status !== 'cancelled' &&
        BigInt(await ledger.confirmedPaid(manager, obligation)) > 0n
      )
        throw new ConflictException('finance:initial_has_payments');
    } else {
      const changesFinancialValue =
        next.amount !== movement.amount || next.status !== movement.status;
      if (
        changesFinancialValue &&
        next.status !== 'cancelled' &&
        initial.status === 'cancelled'
      )
        throw new ConflictException('finance:cancelled_obligation');
      if (isConfirmed(next))
        ensureRepaymentCapacity(
          obligation,
          await ledger.confirmedPaid(manager, obligation, id),
          next,
        );
    }
  }
  if (dto.category_id !== undefined && dto.category_id !== movement.category_id)
    requireActiveCategory(
      await ledger.category(manager, userId, dto.category_id),
    );
  return { movement, next, obligation };
}
