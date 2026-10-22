import { ConflictException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { RentalContext } from '../rental-common/types/rental.types.js';
import {
  inspectAvailability,
  immediateNeighbors,
  calendarStay,
} from '../rental-common/rental-calendar.rules.js';
import {
  paymentLedgerHash,
  paymentTotals,
} from '../rental-common/rental-money.js';
import type { RentalReservation } from '../rental-reservation/entities/rental-reservation.entity.js';

/** Bounded material projections under the caller's authority and exclusive property lock. */
@Injectable()
export class NodiaAiRentalReservationService {
  async property(manager: EntityManager, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,owner_id::text,name,timezone,max_guests,minimum_turnover_minutes,is_active
       FROM rental_properties WHERE id=$1 FOR UPDATE`,
      [id],
    );
    return rows[0] ?? null;
  }
  async member(manager: EntityManager, property: string, user: string) {
    const rows: { is_active: boolean }[] = await manager.query(
      'SELECT is_active FROM rental_collaborators WHERE property_id=$1 AND user_id=$2',
      [property, user],
    );
    return rows[0]?.is_active === true;
  }
  async reservation(manager: EntityManager, property: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,property_id::text,guest_name,guest_contact,guests_count,channel,external_reference,
       to_char(check_in_on,'YYYY-MM-DD') check_in_on,to_char(check_out_on,'YYYY-MM-DD') check_out_on,
       left(check_in_time::text,5) check_in_time,left(check_out_time::text,5) check_out_time,
       nightly_rate::text,cleaning_fee::text,discount_amount::text,total_amount::text,commission_amount::text,
       deposit_amount::text,deposit_due_at::text,balance_due_at::text,cancellation_policy_id::text,
       policy_snapshot,status,cancelled_at::text,refund_amount::text,cancellation_snapshot,notes,is_active,updated_at::text
       FROM rental_reservations WHERE property_id=$1 AND id=$2 FOR UPDATE`,
      [property, id],
    );
    return rows[0] ?? null;
  }
  async money(manager: EntityManager, property: string, id: string) {
    const [row]: { has_money: boolean }[] = await manager.query(
      'SELECT EXISTS(SELECT 1 FROM rental_payments WHERE property_id=$1 AND reservation_id=$2) AS has_money',
      [property, id],
    );
    const totals = await paymentTotals(manager, property, id);
    const ledger = await paymentLedgerHash(manager, property, id);
    return {
      has_money: row.has_money,
      received: totals.received.toString(),
      refunded: totals.refunded.toString(),
      ledger,
    };
  }
  async hasMoney(manager: EntityManager, property: string, id: string) {
    const [row]: { exists: boolean }[] = await manager.query(
      'SELECT EXISTS(SELECT 1 FROM rental_payments WHERE property_id=$1 AND reservation_id=$2) AS exists',
      [property, id],
    );
    return row.exists;
  }
  async policy(manager: EntityManager, property: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      'SELECT id::text,property_id::text,name,is_active,updated_at::text FROM rental_cancellation_policies WHERE property_id=$1 AND id=$2 FOR UPDATE',
      [property, id],
    );
    if (!rows[0]) return null;
    const rules: NodiaAiJsonObject[] = await manager.query(
      'SELECT min_days_before,refund_percent::text FROM rental_cancellation_rules WHERE policy_id=$1 ORDER BY min_days_before,id LIMIT 101',
      [id],
    );
    if (rules.length > 100)
      throw new ConflictException('nodia_ai:result_too_large');
    return { ...rows[0], rules };
  }
  async calendar(ctx: RentalContext, row: RentalReservation) {
    const availability = await inspectAvailability(ctx, {
      ...row,
      ...(row.id ? { exclude_reservation_id: row.id } : {}),
    });
    const { checked_at: _checked, ...stable } = availability;
    const neighbors = await immediateNeighbors(
      ctx,
      calendarStay({ ...row, id: row.id || '0' }, ctx.property.timezone),
    );
    const ids = [row.id, neighbors.next?.id].filter((id): id is string =>
      Boolean(id),
    );
    const turnovers: NodiaAiJsonObject[] = ids.length
      ? await ctx.manager.query(
          `SELECT id::text,incoming_reservation_id::text,previous_reservation_id::text,linen_ready,cleaning_status,
       planned_ready_at::text,ready_at::text,same_day_approved_at::text,updated_at::text
       FROM rental_turnovers WHERE property_id=$1 AND incoming_reservation_id=ANY($2::bigint[]) ORDER BY id LIMIT 3`,
          [ctx.property.id, ids],
        )
      : [];
    return {
      ...stable,
      previous: neighbors.previous,
      next: neighbors.next
        ? calendarStay(neighbors.next, ctx.property.timezone)
        : null,
      turnovers,
    };
  }
  async preparation(ctx: RentalContext, row: RentalReservation) {
    const { previous } = await immediateNeighbors(
      ctx,
      calendarStay(row, ctx.property.timezone),
    );
    const turnovers: NodiaAiJsonObject[] = await ctx.manager.query(
      `SELECT id::text,incoming_reservation_id::text,previous_reservation_id::text,linen_ready,cleaning_status,
       planned_ready_at::text,ready_at::text,same_day_approved_at::text
       FROM rental_turnovers WHERE property_id=$1 AND incoming_reservation_id=$2 LIMIT 1`,
      [ctx.property.id, row.id],
    );
    return { previous, turnovers };
  }
}
