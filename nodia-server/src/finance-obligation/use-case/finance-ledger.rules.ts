import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import type {
  FinanceMovement,
  FinanceMovementStatus,
  FinanceMovementType,
} from '../../finance-movement/entities/finance-movement.entity.js';
import type { FinanceObligation } from '../entities/finance-obligation.entity.js';

export function requireOwned<T>(record: T | null): T {
  if (record === null) throw new NotFoundException('finance:not_found');
  return record;
}

export function requireActiveCategory(
  record: FinanceCategory | null,
): FinanceCategory {
  const category = requireOwned(record);
  if (!category.is_active)
    throw new ConflictException('finance:inactive_category');
  return category;
}

export function validateMovementState(
  type: FinanceMovementType,
  status: FinanceMovementStatus,
): void {
  const allowed =
    type === 'income'
      ? ['pending', 'received', 'cancelled']
      : type === 'expense'
        ? ['pending', 'paid', 'cancelled']
        : [];
  if (!allowed.includes(status))
    throw new BadRequestException('finance:invalid_movement_state');
}

export function validateStatusTransition(
  previous: FinanceMovementStatus,
  next: FinanceMovementStatus,
): void {
  if (previous === next) return;
  if (
    previous === 'cancelled' ||
    (previous !== 'pending' && next !== 'cancelled')
  ) {
    throw new ConflictException('finance:invalid_status_transition');
  }
}

export function isConfirmed(
  movement: Pick<FinanceMovement, 'type' | 'status'>,
): boolean {
  return movement.type === 'income'
    ? movement.status === 'received'
    : movement.status === 'paid';
}

export function repaymentType(
  obligation: FinanceObligation,
): FinanceMovementType {
  return obligation.type === 'loan' ? 'income' : 'expense';
}

export function requireInitialMovement(
  movements: FinanceMovement[],
): FinanceMovement {
  if (movements.length !== 1)
    throw new ConflictException('finance:invalid_initial_movement');
  return movements[0];
}

export function ensureRepaymentCapacity(
  obligation: FinanceObligation,
  paid: string,
  payment: Pick<FinanceMovement, 'type' | 'status' | 'amount'>,
): void {
  if (
    isConfirmed(payment) &&
    BigInt(paid) + BigInt(payment.amount) > BigInt(obligation.amount)
  ) {
    throw new ConflictException('finance:overpayment');
  }
}

export function projectObligation(
  obligation: FinanceObligation,
  initial: FinanceMovement,
  paid: string,
) {
  return {
    id: obligation.id,
    user_id: obligation.user_id,
    name: obligation.name,
    key: obligation.key,
    type: obligation.type,
    amount: obligation.amount,
    description: obligation.description,
    is_active: obligation.is_active,
    created_at: obligation.created_at,
    updated_at: obligation.updated_at,
    paid_amount: paid,
    remaining_amount:
      initial.status === 'cancelled'
        ? null
        : (BigInt(obligation.amount) - BigInt(paid)).toString(),
    initial_movement: {
      id: initial.id,
      type: initial.type,
      status: initial.status,
      amount: initial.amount,
      category_id: initial.category_id,
    },
  };
}
