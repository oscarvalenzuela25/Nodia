import { BadRequestException, Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { validateCivilPeriod } from '../../rental-common/rental-query.js';
import { localInstant } from '../../rental-common/rental-time.js';
import { RentalOverviewService } from '../rental-overview.service.js';
import { RentalOverviewQueryDto } from '../dto/rental-overview.dto.js';
import type { RentalReservation } from '../../rental-reservation/entities/rental-reservation.entity.js';

function exactUnsigned(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value))
    throw new Error('Invalid rental aggregate');
  return BigInt(value);
}
function safeCount(value: unknown): number {
  const count = exactUnsigned(value);
  if (count > BigInt(Number.MAX_SAFE_INTEGER))
    throw new BadRequestException('rental:window_too_large');
  return Number(count);
}
function projectUpcoming(row: RentalReservation, timezone: string) {
  return {
    id: row.id,
    guest_name: row.guest_name,
    status: row.status,
    check_in_on: row.check_in_on,
    check_out_on: row.check_out_on,
    check_in_at: localInstant(
      row.check_in_on,
      row.check_in_time,
      timezone,
    ).toISOString(),
    check_out_at: localInstant(
      row.check_out_on,
      row.check_out_time,
      timezone,
    ).toISOString(),
  };
}

@Injectable()
export class GetRentalOverviewUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly overview: RentalOverviewService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalOverviewQueryDto,
  ) {
    const query = await validateRentalDto(RentalOverviewQueryDto, input);
    validateCivilPeriod(query.from_on, query.to_on, 366);
    return this.tx.read(actorId, propertyId, async (ctx) => {
      const totals = await this.overview.aggregate(
        ctx.manager,
        propertyId,
        query.from_on,
        query.to_on,
      );
      const received = exactUnsigned(totals.received_amount);
      const refunded = exactUnsigned(totals.refunded_amount);
      const paidExpenses = exactUnsigned(totals.paid_expenses_amount);
      const checkIns = await this.overview.upcoming(
        ctx.manager,
        propertyId,
        ctx.property.timezone,
        ctx.now,
        'in',
      );
      const checkOuts = await this.overview.upcoming(
        ctx.manager,
        propertyId,
        ctx.property.timezone,
        ctx.now,
        'out',
      );
      const pending = await this.overview.pendingTurnovers(
        ctx.manager,
        propertyId,
      );
      return {
        scope: {
          property_id: propertyId,
          timezone: ctx.property.timezone,
          from_on: query.from_on,
          to_on: query.to_on,
          cash_dates: 'occurred_on_and_paid_on',
          includes_archived_history: true,
          pending_scope: 'all_current_property_records',
        },
        as_of: ctx.now.toISOString(),
        cash: {
          received_amount: received.toString(),
          refunded_amount: refunded.toString(),
          paid_expenses_amount: paidExpenses.toString(),
          net_amount: (received - refunded - paidExpenses).toString(),
        },
        pending: {
          reservation_balance_amount: exactUnsigned(
            totals.reservation_balance_amount,
          ).toString(),
          refund_amount: exactUnsigned(totals.refund_amount).toString(),
          expense_amount: exactUnsigned(totals.expense_amount).toString(),
          draft_received_amount: exactUnsigned(
            totals.draft_received_amount,
          ).toString(),
        },
        counts: {
          confirmed_reservations: safeCount(totals.confirmed_reservations),
          in_progress_reservations: safeCount(totals.in_progress_reservations),
          pending_turnovers: safeCount(totals.pending_turnovers),
          draft_count: safeCount(totals.draft_count),
        },
        upcoming_check_ins: checkIns.map((row) =>
          projectUpcoming(row, ctx.property.timezone),
        ),
        upcoming_check_outs: checkOuts.map((row) =>
          projectUpcoming(row, ctx.property.timezone),
        ),
        pending_turnovers: pending.map((row) => ({
          id: row.id,
          incoming_reservation_id: row.incoming_reservation_id,
          previous_reservation_id: row.previous_reservation_id,
          linen_ready: row.linen_ready,
          cleaning_status: row.cleaning_status,
          planned_ready_at: row.planned_ready_at?.toISOString() ?? null,
          ready_at: row.ready_at?.toISOString() ?? null,
          same_day_approved_at: row.same_day_approved_at?.toISOString() ?? null,
        })),
      };
    });
  }
}
