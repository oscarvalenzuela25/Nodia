import type { RentalReservation } from '../entities/rental-reservation.entity.js';
import { civilDays, localInstant } from '../../rental-common/rental-time.js';
export function projectReservation(
  row: RentalReservation,
  timezone: string,
  sums: { received: bigint; refunded: bigint; turnover_id: string | null },
) {
  const expected = BigInt(row.total_amount) - BigInt(row.commission_amount);
  const cancelled = row.status === 'cancelled';
  const refund = BigInt(row.refund_amount ?? '0');
  return {
    id: row.id,
    property_id: row.property_id,
    guest_name: row.guest_name,
    guest_contact: row.guest_contact,
    guests_count: row.guests_count,
    channel: row.channel,
    external_reference: row.external_reference,
    check_in_on: row.check_in_on,
    check_out_on: row.check_out_on,
    check_in_time: row.check_in_time.slice(0, 5),
    check_out_time: row.check_out_time.slice(0, 5),
    nightly_rate: row.nightly_rate,
    cleaning_fee: row.cleaning_fee,
    discount_amount: row.discount_amount,
    total_amount: row.total_amount,
    commission_amount: row.commission_amount,
    deposit_amount: row.deposit_amount,
    deposit_due_at: row.deposit_due_at?.toISOString() ?? null,
    balance_due_at: row.balance_due_at?.toISOString() ?? null,
    cancellation_policy_id: row.cancellation_policy_id,
    policy_snapshot: row.policy_snapshot,
    cancellation_snapshot: row.cancellation_snapshot,
    cancelled_at: row.cancelled_at?.toISOString() ?? null,
    refund_amount: row.refund_amount,
    status: row.status,
    notes: row.notes,
    is_active: row.is_active,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    nights: civilDays(row.check_in_on, row.check_out_on),
    check_in_at: localInstant(
      row.check_in_on,
      row.check_in_time.slice(0, 5),
      timezone,
    ).toISOString(),
    check_out_at: localInstant(
      row.check_out_on,
      row.check_out_time.slice(0, 5),
      timezone,
    ).toISOString(),
    expected_amount: expected.toString(),
    received_amount: sums.received.toString(),
    refunded_amount: sums.refunded.toString(),
    net_received_amount: (sums.received - sums.refunded).toString(),
    balance_due_amount: cancelled ? '0' : (expected - sums.received).toString(),
    refund_due_amount: cancelled ? (refund - sums.refunded).toString() : '0',
    retained_amount: cancelled ? (sums.received - refund).toString() : null,
    turnover_id: sums.turnover_id,
  };
}
