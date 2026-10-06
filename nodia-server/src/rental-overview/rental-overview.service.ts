import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { RentalReservation } from '../rental-reservation/entities/rental-reservation.entity.js';
import { RentalTurnover } from '../rental-turnover/entities/rental-turnover.entity.js';

export interface RentalOverviewAggregates {
  received_amount: string;
  refunded_amount: string;
  paid_expenses_amount: string;
  reservation_balance_amount: string;
  refund_amount: string;
  expense_amount: string;
  draft_received_amount: string;
  draft_count: string;
  confirmed_reservations: string;
  in_progress_reservations: string;
  pending_turnovers: string;
}

@Injectable()
export class RentalOverviewService {
  async aggregate(
    manager: EntityManager,
    propertyId: string,
    from: string,
    to: string,
  ): Promise<RentalOverviewAggregates> {
    const rows: RentalOverviewAggregates[] = await manager.query(
      `
      WITH ledger AS (
        SELECT reservation_id,
          COALESCE(SUM(amount) FILTER (WHERE type='payment' AND status='confirmed'),0) AS received,
          COALESCE(SUM(amount) FILTER (WHERE type='refund' AND status='confirmed'),0) AS refunded
        FROM rental_payments WHERE property_id=$1 GROUP BY reservation_id
      ), agreements AS (
        SELECT r.*, COALESCE(l.received,0) AS received, COALESCE(l.refunded,0) AS refunded
        FROM rental_reservations r LEFT JOIN ledger l ON l.reservation_id=r.id WHERE r.property_id=$1
      )
      SELECT
        (SELECT COALESCE(SUM(amount),0)::text FROM rental_payments WHERE property_id=$1 AND status='confirmed' AND type='payment' AND occurred_on >= $2::date AND occurred_on < $3::date) AS received_amount,
        (SELECT COALESCE(SUM(amount),0)::text FROM rental_payments WHERE property_id=$1 AND status='confirmed' AND type='refund' AND occurred_on >= $2::date AND occurred_on < $3::date) AS refunded_amount,
        (SELECT COALESCE(SUM(amount),0)::text FROM rental_expenses WHERE property_id=$1 AND status='paid' AND paid_on >= $2::date AND paid_on < $3::date) AS paid_expenses_amount,
        COALESCE(SUM(total_amount::numeric-commission_amount::numeric-received) FILTER (WHERE status IN ('confirmed','in_progress','completed')),0)::text AS reservation_balance_amount,
        COALESCE(SUM(refund_amount::numeric-refunded) FILTER (WHERE status='cancelled'),0)::text AS refund_amount,
        (SELECT COALESCE(SUM(amount),0)::text FROM rental_expenses WHERE property_id=$1 AND status='pending') AS expense_amount,
        COALESCE(SUM(received) FILTER (WHERE status='draft'),0)::text AS draft_received_amount,
        COUNT(*) FILTER (WHERE status='draft' AND received>0)::text AS draft_count,
        COUNT(*) FILTER (WHERE status='confirmed')::text AS confirmed_reservations,
        COUNT(*) FILTER (WHERE status='in_progress')::text AS in_progress_reservations,
        (SELECT COUNT(*)::text FROM rental_turnovers t JOIN rental_reservations r ON r.id=t.incoming_reservation_id AND r.property_id=t.property_id
          WHERE t.property_id=$1 AND r.status IN ('confirmed','in_progress') AND (t.ready_at IS NULL OR t.cleaning_status<>'completed' OR t.linen_ready IS DISTINCT FROM TRUE)) AS pending_turnovers
      FROM agreements
    `,
      [propertyId, from, to],
    );
    if (rows.length !== 1)
      throw new Error('Invalid rental overview aggregate result');
    return rows[0];
  }

  upcoming(
    manager: EntityManager,
    propertyId: string,
    timezone: string,
    now: Date,
    direction: 'in' | 'out',
  ) {
    const dateField = direction === 'in' ? 'check_in_on' : 'check_out_on';
    const timeField = direction === 'in' ? 'check_in_time' : 'check_out_time';
    const localTime = `(r.${dateField} + r.${timeField})`;
    return manager
      .getRepository(RentalReservation)
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.guest_name',
        'r.status',
        'r.check_in_on',
        'r.check_out_on',
        'r.check_in_time',
        'r.check_out_time',
      ])
      .where('r.property_id = :propertyId AND r.status IN (:...statuses)', {
        propertyId,
        statuses: ['confirmed', 'in_progress'],
      })
      .andWhere(
        `${localTime} >= (:now::timestamptz AT TIME ZONE :timezone) AND ${localTime} <= (:now::timestamptz AT TIME ZONE :timezone) + INTERVAL '30 days'`,
        { now, timezone },
      )
      .orderBy(localTime, 'ASC')
      .addOrderBy('r.id', 'ASC')
      .take(10)
      .getMany();
  }

  pendingTurnovers(manager: EntityManager, propertyId: string) {
    return manager
      .getRepository(RentalTurnover)
      .createQueryBuilder('t')
      .innerJoin(
        RentalReservation,
        'r',
        'r.id=t.incoming_reservation_id AND r.property_id=t.property_id',
      )
      .select([
        't.id',
        't.incoming_reservation_id',
        't.previous_reservation_id',
        't.linen_ready',
        't.cleaning_status',
        't.planned_ready_at',
        't.ready_at',
        't.same_day_approved_at',
      ])
      .addSelect(['r.check_in_on', 'r.check_in_time'])
      .where('t.property_id=:propertyId AND r.status IN (:...statuses)', {
        propertyId,
        statuses: ['confirmed', 'in_progress'],
      })
      .andWhere(
        '(t.ready_at IS NULL OR t.cleaning_status <> :completed OR t.linen_ready IS DISTINCT FROM TRUE)',
        { completed: 'completed' },
      )
      .orderBy('r.check_in_on', 'ASC')
      .addOrderBy('r.check_in_time', 'ASC')
      .addOrderBy('t.id', 'ASC')
      .take(10)
      .getMany();
  }
}
