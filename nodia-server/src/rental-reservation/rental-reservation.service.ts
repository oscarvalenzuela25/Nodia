import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { type EntityManager, type DeepPartial } from 'typeorm';
import { RentalReservation } from './entities/rental-reservation.entity.js';
import { RentalTurnover } from '../rental-turnover/entities/rental-turnover.entity.js';
import { RentalCancellationPolicy } from '../rental-cancellation-policy/entities/rental-cancellation-policy.entity.js';
import type { RentalReservationQueryDto } from './dto/rental-reservation-query.dto.js';
import { validatePeriod } from './types/rental-reservation.rules.js';
import { validateRansackEnvelope } from '../common/utils/ransack-query.builder.js';

@Injectable()
export class RentalReservationService {
  async find(
    manager: EntityManager,
    propertyId: string,
    id: string,
    lock = false,
  ): Promise<RentalReservation> {
    const row = await manager
      .getRepository(RentalReservation)
      .findOne({
        where: { property_id: propertyId, id },
        ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
      });
    if (!row) throw new NotFoundException('rental:not_found');
    return row;
  }
  save(manager: EntityManager, data: DeepPartial<RentalReservation>) {
    return manager.getRepository(RentalReservation).save(data);
  }
  async assertPolicy(
    manager: EntityManager,
    propertyId: string,
    id: string | null,
  ): Promise<void> {
    if (
      id !== null &&
      !(await manager
        .getRepository(RentalCancellationPolicy)
        .existsBy({ id, property_id: propertyId, is_active: true }))
    )
      throw new NotFoundException('rental:not_found');
  }
  async hasMoney(
    manager: EntityManager,
    propertyId: string,
    reservationId: string,
  ): Promise<boolean> {
    const rows: { exists: boolean }[] = await manager.query(
      'SELECT EXISTS(SELECT 1 FROM rental_payments WHERE property_id=$1 AND reservation_id=$2) AS exists',
      [propertyId, reservationId],
    );
    return rows[0].exists;
  }
  async list(
    manager: EntityManager,
    propertyId: string,
    query: RentalReservationQueryDto,
  ) {
    validatePeriod(query.from_on, query.to_on);
    validateRansackEnvelope(query.q);
    const qb = manager
      .getRepository(RentalReservation)
      .createQueryBuilder('r')
      .where('r.property_id=:pid', { pid: propertyId });
    if (query.active !== 'all')
      qb.andWhere('r.is_active=:active', {
        active: query.active !== 'inactive',
      });
    if (query.status_in !== undefined) {
      if (!query.status_in.length)
        return [[], 0] as [RentalReservation[], number];
      qb.andWhere('r.status IN (:...statuses)', { statuses: query.status_in });
    }
    if (query.channel_in !== undefined) {
      if (!query.channel_in.length)
        return [[], 0] as [RentalReservation[], number];
      qb.andWhere('r.channel IN (:...channels)', {
        channels: query.channel_in,
      });
    }
    if (query.from_on)
      qb.andWhere('r.check_in_on < :to AND r.check_out_on > :from', {
        from: query.from_on,
        to: query.to_on,
      });
    let sort: 'check_in_on' | 'created_at' = 'check_in_on';
    let direction: 'ASC' | 'DESC' = 'DESC';
    for (const [key, value] of Object.entries(query.q ?? {})) {
      if (typeof value !== 'string' || value.length > 255)
        throw new BadRequestException('rental:invalid_query');
      if (key === 's') {
        const match = /^(check_in_on|created_at) (asc|desc)$/.exec(value);
        if (!match) throw new BadRequestException('rental:invalid_query');
        sort = match[1] as typeof sort;
        direction = match[2].toUpperCase() as typeof direction;
      } else if (
        key === 'guest_name_cont' ||
        key === 'external_reference_cont'
      ) {
        const field =
          key === 'guest_name_cont' ? 'guest_name' : 'external_reference';
        qb.andWhere(`r.${field} ILIKE :${field}`, {
          [field]: `%${value.replace(/[\\%_]/g, '\\$&')}%`,
        });
      } else throw new BadRequestException('rental:invalid_query');
    }
    return qb
      .orderBy(`r.${sort}`, direction)
      .addOrderBy('r.id', direction)
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 10))
      .take(query.limit ?? 10)
      .getManyAndCount();
  }
  async summaries(manager: EntityManager, propertyId: string, ids: string[]) {
    if (!ids.length)
      return new Map<
        string,
        { received: bigint; refunded: bigint; turnover_id: string | null }
      >();
    const sums: {
      reservation_id: string;
      received: string;
      refunded: string;
    }[] = await manager.query(
      "SELECT reservation_id, COALESCE(SUM(amount) FILTER (WHERE type='payment'),0)::text AS received, COALESCE(SUM(amount) FILTER (WHERE type='refund'),0)::text AS refunded FROM rental_payments WHERE property_id=$1 AND reservation_id=ANY($2::bigint[]) AND status='confirmed' GROUP BY reservation_id",
      [propertyId, ids],
    );
    const turnovers = await manager
      .getRepository(RentalTurnover)
      .createQueryBuilder('t')
      .select(['t.id', 't.incoming_reservation_id'])
      .where('t.property_id=:pid AND t.incoming_reservation_id IN (:...ids)', {
        pid: propertyId,
        ids,
      })
      .getMany();
    return new Map(
      ids.map((id) => {
        const sum = sums.find((s) => s.reservation_id === id);
        return [
          id,
          {
            received: BigInt(sum?.received ?? '0'),
            refunded: BigInt(sum?.refunded ?? '0'),
            turnover_id:
              turnovers.find((t) => t.incoming_reservation_id === id)?.id ??
              null,
          },
        ] as const;
      }),
    );
  }
}
