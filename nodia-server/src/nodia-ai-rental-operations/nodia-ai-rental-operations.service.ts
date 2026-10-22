import { ConflictException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { RentalContext } from '../rental-common/types/rental.types.js';
import {
  assertBlockAvailable,
  calendarStay,
  immediateNeighbors,
} from '../rental-common/rental-calendar.rules.js';
import type { RentalReservation } from '../rental-reservation/entities/rental-reservation.entity.js';

/** All projections are bounded and consumed under the shared exclusive house lock. */
@Injectable()
export class NodiaAiRentalOperationsService {
  async property(manager: EntityManager, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,owner_id::text,name,timezone,minimum_turnover_minutes,is_active
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
  async block(manager: EntityManager, property: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,property_id::text,starts_at::text,ends_at::text,reason,notes,is_active
       FROM rental_blocks WHERE property_id=$1 AND id=$2 FOR UPDATE`,
      [property, id],
    );
    return rows[0] ?? null;
  }
  async turnover(manager: EntityManager, property: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,property_id::text,incoming_reservation_id::text,previous_reservation_id::text,
       linen_ready,cleaning_status,planned_ready_at::text,ready_at::text,same_day_approved_at::text,notes
       FROM rental_turnovers WHERE property_id=$1 AND id=$2 FOR UPDATE`,
      [property, id],
    );
    return rows[0] ?? null;
  }
  async transition(ctx: RentalContext, incomingId: string) {
    const rows: NodiaAiJsonObject[] = await ctx.manager.query(
      `SELECT id::text,property_id::text,status,to_char(check_in_on,'YYYY-MM-DD') check_in_on,
       to_char(check_out_on,'YYYY-MM-DD') check_out_on,left(check_in_time::text,5) check_in_time,
       left(check_out_time::text,5) check_out_time
       FROM rental_reservations WHERE property_id=$1 AND id=$2 FOR UPDATE`,
      [ctx.property.id, incomingId],
    );
    if (!rows[0]) return null;
    const incoming = calendarStay(
      rows[0] as unknown as RentalReservation,
      ctx.property.timezone,
    );
    const { previous } = await immediateNeighbors(ctx, incoming);
    return { incoming, previous };
  }
  async blockImpact(
    ctx: RentalContext,
    starts: Date,
    ends: Date,
    excludeId?: string,
  ) {
    await assertBlockAvailable(ctx, starts, ends, excludeId);
    const plans: NodiaAiJsonObject[] = await ctx.manager.query(
      `SELECT t.id::text,t.cleaning_status,t.planned_ready_at::text,t.ready_at::text,t.same_day_approved_at::text
       FROM rental_turnovers t JOIN rental_reservations r ON r.property_id=t.property_id AND r.id=t.incoming_reservation_id
       WHERE t.property_id=$1 AND r.status IN ('draft','confirmed')
       AND ((t.planned_ready_at >= $2 AND t.planned_ready_at < $3) OR (t.ready_at >= $2 AND t.ready_at < $3))
       ORDER BY t.id LIMIT 1001`,
      [ctx.property.id, starts, ends],
    );
    if (plans.length > 1000)
      throw new ConflictException('rental:window_too_large');
    if (plans.some((p) => p.same_day_approved_at !== null))
      throw new ConflictException('rental:turnover_required');
    return plans;
  }
}
