import { ConflictException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** Narrow, bounded projections. The caller owns the authority barrier and transaction. */
@Injectable()
export class NodiaAiRentalConfigurationService {
  async property(manager: EntityManager, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,owner_id::text,name,location,timezone,max_guests,
      left(check_in_time::text,5) AS check_in_time,left(check_out_time::text,5) AS check_out_time,
      default_nightly_rate::text,default_deposit_percent::text,minimum_turnover_minutes,
      default_cancellation_policy_id::text,notes,is_active,updated_at::text
      FROM rental_properties WHERE id=$1 FOR UPDATE`,
      [id],
    );
    return rows[0] ?? null;
  }
  async collaborator(manager: EntityManager, property: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,property_id::text,user_id::text,position,is_active,updated_at::text
      FROM rental_collaborators WHERE property_id=$1 AND id=$2 FOR UPDATE`,
      [property, id],
    );
    return rows[0] ?? null;
  }
  async membership(manager: EntityManager, property: string, user: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,is_active FROM rental_collaborators WHERE property_id=$1 AND user_id=$2`,
      [property, user],
    );
    return rows[0] ?? null;
  }
  async user(manager: EntityManager, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      'SELECT id::text,name,is_active FROM users WHERE id=$1 FOR SHARE',
      [id],
    );
    return rows[0] ?? null;
  }
  async policy(manager: EntityManager, property: string, id: string) {
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,property_id::text,name,is_active,updated_at::text
      FROM rental_cancellation_policies WHERE property_id=$1 AND id=$2 FOR UPDATE`,
      [property, id],
    );
    if (!rows[0]) return null;
    const rules: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,min_days_before,refund_percent::text,updated_at::text
      FROM rental_cancellation_rules WHERE policy_id=$1 ORDER BY min_days_before,id LIMIT 101`,
      [id],
    );
    if (rules.length > 100)
      throw new ConflictException('nodia_ai:result_too_large');
    return { ...rows[0], rules };
  }
  async configurationReferences(
    manager: EntityManager,
    property: string,
    maximum: number,
  ) {
    const [history]: { exists: boolean }[] = await manager.query(
      `SELECT EXISTS(SELECT 1 FROM rental_reservations WHERE property_id=$1)
      OR EXISTS(SELECT 1 FROM rental_blocks WHERE property_id=$1) AS exists`,
      [property],
    );
    const [occupancy]: { max_guests: number }[] = await manager.query(
      `SELECT coalesce(max(r.guests_count),0)::int AS max_guests FROM rental_reservations r
      JOIN rental_properties p ON p.id=r.property_id WHERE r.property_id=$1 AND r.status IN ('confirmed','in_progress')
      AND (r.check_out_on+r.check_out_time) AT TIME ZONE p.timezone > clock_timestamp()`,
      [property],
    );
    const turnovers: NodiaAiJsonObject[] = await manager.query(
      `SELECT t.id::text,t.planned_ready_at::text,t.linen_ready,t.updated_at::text,
      ((previous.check_out_on+previous.check_out_time) AT TIME ZONE property.timezone)::text AS previous_out,
      ((incoming.check_in_on+incoming.check_in_time) AT TIME ZONE property.timezone)::text AS incoming_at
      FROM rental_turnovers t JOIN rental_properties property ON property.id=t.property_id
      JOIN rental_reservations incoming ON incoming.property_id=t.property_id AND incoming.id=t.incoming_reservation_id
      JOIN rental_reservations previous ON previous.property_id=t.property_id AND previous.id=t.previous_reservation_id
      WHERE t.property_id=$1 AND t.same_day_approved_at IS NOT NULL AND incoming.status IN ('confirmed','in_progress')
      AND previous.check_out_on=incoming.check_in_on
      AND (incoming.check_out_on+incoming.check_out_time) AT TIME ZONE property.timezone > clock_timestamp()
      ORDER BY t.id LIMIT $2`,
      [property, maximum + 1],
    );
    if (turnovers.length > maximum)
      throw new ConflictException('nodia_ai:result_too_large');
    return {
      has_history: history.exists,
      max_guests: occupancy.max_guests,
      turnovers,
    };
  }
}
