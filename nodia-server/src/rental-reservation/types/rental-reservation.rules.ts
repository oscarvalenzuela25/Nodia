import { BadRequestException, ConflictException } from '@nestjs/common';
import { civilDays, localInstant } from '../../rental-common/rental-time.js';
import type { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import type { RentalReservation } from '../entities/rental-reservation.entity.js';
import type { CreateRentalReservationDto } from '../dto/create-rental-reservation.dto.js';

export function validateAgreement(
  property: RentalProperty,
  agreement: Pick<
    CreateRentalReservationDto,
    | 'check_in_on'
    | 'check_out_on'
    | 'check_in_time'
    | 'check_out_time'
    | 'guests_count'
    | 'nightly_rate'
    | 'cleaning_fee'
    | 'discount_amount'
    | 'commission_amount'
    | 'deposit_amount'
    | 'cancellation_policy_id'
  > & {
    channel: string;
    deposit_due_at?: string | Date | null;
    balance_due_at?: string | Date | null;
  },
): string {
  const nights = civilDays(agreement.check_in_on, agreement.check_out_on);
  const starts = localInstant(
    agreement.check_in_on,
    agreement.check_in_time.slice(0, 5),
    property.timezone,
  );
  const ends = localInstant(
    agreement.check_out_on,
    agreement.check_out_time.slice(0, 5),
    property.timezone,
  );
  if (nights < 1 || nights > 366 || starts >= ends)
    throw new BadRequestException('rental:invalid_interval');
  if (agreement.guests_count > property.max_guests)
    throw new ConflictException('rental:capacity_exceeded');
  const total =
    BigInt(nights) * BigInt(agreement.nightly_rate) +
    BigInt(agreement.cleaning_fee ?? '0') -
    BigInt(agreement.discount_amount ?? '0');
  const expected = total - BigInt(agreement.commission_amount ?? '0');
  if (
    total <= 0n ||
    total > 9223372036854775807n ||
    expected <= 0n ||
    BigInt(agreement.commission_amount ?? '0') > total ||
    BigInt(agreement.deposit_amount) > expected
  )
    throw new BadRequestException('rental:invalid_amount');
  if (
    agreement.channel === 'airbnb' &&
    (agreement.cancellation_policy_id != null ||
      agreement.deposit_amount !== '0')
  )
    throw new BadRequestException('rental:invalid_platform_agreement');
  const deposit =
    agreement.deposit_due_at == null
      ? null
      : new Date(agreement.deposit_due_at);
  const balance =
    agreement.balance_due_at == null
      ? null
      : new Date(agreement.balance_due_at);
  if (
    (deposit && deposit > starts) ||
    (balance && balance > ends) ||
    (deposit && balance && deposit > balance)
  )
    throw new BadRequestException('rental:invalid_due_date');
  return total.toString();
}

export function assertPhase(
  reservation: Pick<RentalReservation, 'status'>,
  states: string[],
): void {
  if (!states.includes(reservation.status))
    throw new ConflictException('rental:invalid_transition');
}

export function validatePeriod(
  from: string | undefined,
  to: string | undefined,
): void {
  if ((from === undefined) !== (to === undefined))
    throw new BadRequestException('rental:invalid_query');
  if (from !== undefined && to !== undefined) {
    const days = civilDays(from, to);
    if (days < 1 || days > 366)
      throw new BadRequestException('rental:invalid_query');
  }
}
