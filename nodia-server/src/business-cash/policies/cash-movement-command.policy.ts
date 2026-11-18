import { BadRequestException } from '@nestjs/common';
import {
  assertCashFields,
  normalizeCashActivity,
  normalizeCashDescription,
  normalizeCashUuid,
  normalizeCashVersion,
  validateCashCategoryId,
} from './cash-category.policy.js';
import { isCashMovementDate } from './cash-movement-date.js';
import type { CashMovement, CashMovementType } from '../types/cash.types.js';

export const CASH_AMOUNT_PATTERN = /^[1-9][0-9]{0,12}$/;
export const CASH_CATEGORY_ID_PATTERN = /^[1-9][0-9]{0,18}$/;

const editableFields = [
  'category_id',
  'amount',
  'occurred_on',
  'description',
  'is_active',
] as const;

export type CashMovementFields = Pick<
  Extract<CashMovement, { source: 'manual' }>,
  (typeof editableFields)[number]
>;
export type CashMovementChange = Partial<CashMovementFields> & {
  expected_version: number;
};

function invalid(): never {
  throw new BadRequestException('business:cash_invalid_command');
}

function categoryId(value: unknown): string {
  if (typeof value !== 'string') return invalid();
  validateCashCategoryId(value);
  return value;
}

function amount(value: unknown): string {
  if (typeof value !== 'string' || !CASH_AMOUNT_PATTERN.test(value))
    return invalid();
  return value;
}

function date(value: unknown): string {
  if (!isCashMovementDate(value)) return invalid();
  return value;
}

export function normalizeCashMovementCreate(
  value: unknown,
): CashMovementFields & {
  request_key: string;
  business_id: string;
  type: CashMovementType;
} {
  assertCashFields(value, [
    'request_key',
    'business_id',
    'type',
    ...editableFields,
  ]);
  if (value.type !== 'income' && value.type !== 'expense') return invalid();
  return {
    request_key: normalizeCashUuid(value.request_key),
    business_id: normalizeCashUuid(value.business_id),
    type: value.type,
    category_id: categoryId(value.category_id),
    amount: amount(value.amount),
    occurred_on: date(value.occurred_on),
    description: normalizeCashDescription(value.description),
    is_active:
      value.is_active === undefined
        ? true
        : normalizeCashActivity(value.is_active),
  };
}

export function normalizeCashMovementUpdate(
  value: unknown,
): CashMovementChange & { request_key: string } {
  assertCashFields(value, [
    'request_key',
    'expected_version',
    ...editableFields,
  ]);
  if (editableFields.every((field) => value[field] === undefined))
    return invalid();
  return {
    request_key: normalizeCashUuid(value.request_key),
    expected_version: normalizeCashVersion(value.expected_version),
    ...(value.category_id === undefined
      ? {}
      : { category_id: categoryId(value.category_id) }),
    ...(value.amount === undefined ? {} : { amount: amount(value.amount) }),
    ...(value.occurred_on === undefined
      ? {}
      : { occurred_on: date(value.occurred_on) }),
    ...(value.description === undefined
      ? {}
      : { description: normalizeCashDescription(value.description) }),
    ...(value.is_active === undefined
      ? {}
      : { is_active: normalizeCashActivity(value.is_active) }),
  };
}
