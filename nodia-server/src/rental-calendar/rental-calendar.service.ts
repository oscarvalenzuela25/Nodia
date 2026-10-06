import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { RentalReservation } from '../rental-reservation/entities/rental-reservation.entity.js';
import { RentalBlock } from '../rental-block/entities/rental-block.entity.js';
import { RentalTurnover } from '../rental-turnover/entities/rental-turnover.entity.js';

@Injectable()
export class RentalCalendarService {
  async window(
    manager: EntityManager,
    propertyId: string,
    timezone: string,
    from: string,
    to: string,
    includeNonOccupying: boolean,
  ) {
    // Civil boundaries are compared in local SQL time; midnight need not exist on a DST transition.
    const reservationsQuery = manager
      .getRepository(RentalReservation)
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.property_id',
        'r.guest_name',
        'r.check_in_on',
        'r.check_out_on',
        'r.check_in_time',
        'r.check_out_time',
        'r.channel',
        'r.status',
        'r.is_active',
      ])
      .where('r.property_id = :propertyId', { propertyId })
      .andWhere(
        '(r.check_in_on + r.check_in_time) < CAST(:to AS date) AND (r.check_out_on + r.check_out_time) > CAST(:from AS date)',
        { from, to },
      );
    if (!includeNonOccupying)
      reservationsQuery.andWhere('r.status IN (:...status)', {
        status: ['confirmed', 'in_progress', 'completed'],
      });
    const reservations = await reservationsQuery
      .orderBy('r.check_in_on', 'ASC')
      .addOrderBy('r.check_in_time', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .take(1001)
      .getMany();
    const blocks = await manager
      .getRepository(RentalBlock)
      .createQueryBuilder('b')
      .select([
        'b.id',
        'b.property_id',
        'b.starts_at',
        'b.ends_at',
        'b.reason',
        'b.is_active',
      ])
      .where('b.property_id = :propertyId AND b.is_active = true', {
        propertyId,
      })
      .andWhere(
        '(b.starts_at AT TIME ZONE :timezone) < CAST(:to AS date) AND (b.ends_at AT TIME ZONE :timezone) > CAST(:from AS date)',
        { timezone, from, to },
      )
      .orderBy('b.starts_at', 'ASC')
      .addOrderBy('b.id', 'ASC')
      .take(1001)
      .getMany();
    const ids = reservations.slice(0, 1001).map((row) => row.id);
    const turnovers = ids.length
      ? await manager
          .getRepository(RentalTurnover)
          .createQueryBuilder('t')
          .select([
            't.id',
            't.property_id',
            't.incoming_reservation_id',
            't.previous_reservation_id',
            't.linen_ready',
            't.cleaning_status',
            't.planned_ready_at',
            't.ready_at',
            't.same_day_approved_at',
          ])
          .where(
            't.property_id = :propertyId AND t.incoming_reservation_id IN (:...ids)',
            { propertyId, ids },
          )
          .orderBy('t.planned_ready_at', 'ASC', 'NULLS LAST')
          .addOrderBy('t.id', 'ASC')
          .take(1001)
          .getMany()
      : [];
    return { reservations, blocks, turnovers };
  }
}
