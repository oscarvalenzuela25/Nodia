import { Injectable, NotFoundException } from '@nestjs/common';
import { type EntityManager } from 'typeorm';
import { RentalTurnover } from './entities/rental-turnover.entity.js';
import { RentalReservation } from '../rental-reservation/entities/rental-reservation.entity.js';
import {
  applyRentalQuery,
  validateCivilPeriod,
} from '../rental-common/rental-query.js';
import type { RentalTurnoverQueryDto } from './dto/rental-turnover-query.dto.js';
@Injectable()
export class RentalTurnoverService {
  async find(manager: EntityManager, propertyId: string, id: string) {
    const row = await manager
      .getRepository(RentalTurnover)
      .findOneBy({ property_id: propertyId, id });
    if (!row) throw new NotFoundException('rental:not_found');
    return row;
  }
  async incoming(manager: EntityManager, propertyId: string, id: string) {
    const row = await manager
      .getRepository(RentalReservation)
      .findOneBy({ property_id: propertyId, id });
    if (!row) throw new NotFoundException('rental:not_found');
    return row;
  }
  save(manager: EntityManager, row: RentalTurnover) {
    return manager.getRepository(RentalTurnover).save(row);
  }
  list(
    manager: EntityManager,
    propertyId: string,
    query: RentalTurnoverQueryDto,
  ) {
    validateCivilPeriod(query.from_on, query.to_on);
    const qb = manager
      .getRepository(RentalTurnover)
      .createQueryBuilder('t')
      .innerJoin(
        RentalReservation,
        'r',
        'r.id=t.incoming_reservation_id AND r.property_id=t.property_id',
      )
      .addSelect(['r.check_in_on'])
      .where('t.property_id=:pid', { pid: propertyId });
    applyRentalQuery(qb, 't', query, 'turnovers');
    if (!query.q?.s)
      qb.orderBy('r.check_in_on', 'ASC').addOrderBy('t.id', 'ASC');
    if (query.cleaning_status !== undefined)
      qb.andWhere('t.cleaning_status=:cleaning', {
        cleaning: query.cleaning_status,
      });
    if (query.incoming_reservation_id !== undefined)
      qb.andWhere('t.incoming_reservation_id=:incoming', {
        incoming: query.incoming_reservation_id,
      });
    if (query.linen_ready === 'unknown') qb.andWhere('t.linen_ready IS NULL');
    else if (query.linen_ready !== undefined)
      qb.andWhere('t.linen_ready=:linen', {
        linen: query.linen_ready === 'true',
      });
    if (query.from_on)
      qb.andWhere('r.check_in_on >= :from AND r.check_in_on < :to', {
        from: query.from_on,
        to: query.to_on,
      });
    return qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }
}
