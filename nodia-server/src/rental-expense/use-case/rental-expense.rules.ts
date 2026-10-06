import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { RentalContext } from '../../rental-common/types/rental.types.js';
import { formatLocalOn } from '../../rental-common/rental-time.js';
import type { RentalExpenseService } from '../rental-expense.service.js';

export function validateExpenseDates(
  ctx: RentalContext,
  incurredOn: string,
  paidOn: string | null,
  status: string,
) {
  const today = formatLocalOn(ctx.now, ctx.property.timezone);
  if (
    incurredOn > today ||
    (status === 'paid' &&
      (paidOn === null || paidOn < incurredOn || paidOn > today)) ||
    (status !== 'paid' && paidOn !== null)
  )
    throw new BadRequestException('rental:invalid_input');
}

export async function validateExpenseAssociation(
  ctx: RentalContext,
  expenses: RentalExpenseService,
  reservationId: string | null,
) {
  if (
    reservationId !== null &&
    !(await expenses.reservation(ctx.manager, ctx.property.id, reservationId))
  )
    throw new NotFoundException('rental:not_found');
}
