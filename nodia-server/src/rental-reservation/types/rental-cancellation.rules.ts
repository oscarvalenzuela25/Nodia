import { BadRequestException, ConflictException } from '@nestjs/common';
import type { RentalContext } from '../../rental-common/types/rental.types.js';
import {
  paymentTotals,
  paymentLedgerHash,
  validatePolicySnapshot,
} from '../../rental-common/rental-money.js';
import {
  civilDays,
  formatLocalOn,
  localInstant,
} from '../../rental-common/rental-time.js';
import type { RentalReservation } from '../entities/rental-reservation.entity.js';
import type { PreviewRentalCancellationDto } from '../dto/reservation-commands.dto.js';
import { assertPhase } from './rental-reservation.rules.js';

export async function cancellationCalculation(
  ctx: RentalContext,
  row: RentalReservation,
  dto: PreviewRentalCancellationDto,
) {
  assertPhase(row, ['draft', 'confirmed']);
  const cancelled = new Date(dto.cancelled_at);
  const checkIn = localInstant(
    row.check_in_on,
    row.check_in_time.slice(0, 5),
    ctx.property.timezone,
  );
  if (cancelled > ctx.now || cancelled >= checkIn)
    throw new BadRequestException('rental:invalid_cancellation_time');
  const totals = await paymentTotals(ctx.manager, ctx.property.id, row.id);
  const localOn = formatLocalOn(cancelled, ctx.property.timezone);
  const days = civilDays(localOn, row.check_in_on);
  const base = {
    schema_version: 1,
    cancelled_at: cancelled.toISOString(),
    computed_at: ctx.now.toISOString(),
    timezone: ctx.property.timezone,
    check_in_on: row.check_in_on,
    cancellation_local_on: localOn,
    days_before: days,
    received_amount: totals.received.toString(),
  };
  let snapshot: Record<string, unknown>;
  let refund: bigint;
  if (row.channel === 'airbnb') {
    if (
      dto.refund_amount === undefined ||
      dto.resolution_note === undefined ||
      BigInt(dto.refund_amount) > totals.received
    )
      throw new BadRequestException('rental:invalid_refund');
    refund = BigInt(dto.refund_amount);
    if (row.status === 'draft' && totals.received === 0n) {
      if (refund !== 0n) throw new BadRequestException('rental:invalid_refund');
      snapshot = {
        ...base,
        kind: 'unpaid_draft',
        reason: 'no_received_payment',
        refund_amount: '0',
        retained_amount: '0',
      };
    } else {
      if (
        !row.policy_snapshot ||
        validatePolicySnapshot(row.policy_snapshot).kind !== 'platform' ||
        row.policy_snapshot.timezone !== ctx.property.timezone
      )
        throw new ConflictException('rental:policy_required');
      const ledger = await paymentLedgerHash(
        ctx.manager,
        ctx.property.id,
        row.id,
      );
      snapshot = {
        ...base,
        kind: 'platform',
        resolution: 'manual_external',
        resolution_note: dto.resolution_note,
        payment_count: ledger.count,
        payment_ledger_sha256: ledger.hash,
        refund_amount: refund.toString(),
        retained_amount: (totals.received - refund).toString(),
      };
    }
  } else {
    if (dto.refund_amount !== undefined || dto.resolution_note !== undefined)
      throw new BadRequestException('rental:invalid_input');
    if (row.status === 'draft' && totals.received === 0n) {
      refund = 0n;
      snapshot = {
        ...base,
        kind: 'unpaid_draft',
        reason: 'no_received_payment',
        refund_amount: '0',
        retained_amount: '0',
      };
    } else {
      const policy = row.policy_snapshot
        ? validatePolicySnapshot(row.policy_snapshot)
        : null;
      if (
        policy?.kind !== 'direct' ||
        policy.timezone !== ctx.property.timezone ||
        policy.schema_version !== 1 ||
        !Array.isArray(policy.rules) ||
        !policy.rules.length ||
        policy.rules.length > 100
      )
        throw new ConflictException('rental:policy_required');
      const rules = policy.rules
        .filter((r) => r.min_days_before <= days)
        .sort((a, b) => b.min_days_before - a.min_days_before);
      const rule = rules[0];
      if (!rule || !/^(?:0|[1-9]\d?|100)\.\d{2}$/.test(rule.refund_percent))
        throw new ConflictException('rental:policy_required');
      const [whole, fraction] = rule.refund_percent.split('.');
      const basis = BigInt(whole) * 100n + BigInt(fraction);
      if (basis > 10000n) throw new ConflictException('rental:policy_required');
      refund = (totals.received * basis) / 10000n;
      const ledger = await paymentLedgerHash(
        ctx.manager,
        ctx.property.id,
        row.id,
      );
      snapshot = {
        ...base,
        kind: 'direct',
        days_basis: 'local_calendar_days',
        refund_basis: 'confirmed_received_amount',
        rounding: 'floor_clp',
        selected_rule: rule,
        payment_count: ledger.count,
        payment_ledger_sha256: ledger.hash,
        refund_amount: refund.toString(),
        retained_amount: (totals.received - refund).toString(),
      };
    }
  }
  return {
    reservation_id: row.id,
    as_of: ctx.now.toISOString(),
    check_in_at: checkIn.toISOString(),
    cancellation_snapshot: snapshot,
    refund_amount: refund.toString(),
    balance_due_after_cancellation: '0',
    refund_due_after_cancellation: (refund - totals.refunded).toString(),
  };
}
