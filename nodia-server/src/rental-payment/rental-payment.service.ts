import { Injectable } from '@nestjs/common';
import type { EntityManager, DeepPartial } from 'typeorm';
import { RentalPayment } from './entities/rental-payment.entity.js';
import { RentalReservation } from '../rental-reservation/entities/rental-reservation.entity.js';
import { RentalPaymentQueryDto } from './dto/rental-payment.dto.js';
import { applyRentalQuery } from '../rental-common/rental-query.js';

@Injectable()
export class RentalPaymentService {
  find(manager: EntityManager, propertyId: string, id: string) {
    return manager
      .getRepository(RentalPayment)
      .findOne({ where: { property_id: propertyId, id } });
  }

  reservation(manager: EntityManager, propertyId: string, id: string) {
    return manager.getRepository(RentalReservation).findOne({
      where: { property_id: propertyId, id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  save(manager: EntityManager, row: DeepPartial<RentalPayment>) {
    return manager.getRepository(RentalPayment).save(row);
  }

  saveReservation(manager: EntityManager, row: RentalReservation) {
    return manager.getRepository(RentalReservation).save(row);
  }

  list(
    manager: EntityManager,
    propertyId: string,
    query: RentalPaymentQueryDto,
  ) {
    const qb = manager
      .getRepository(RentalPayment)
      .createQueryBuilder('payment')
      .where('payment.property_id = :propertyId', { propertyId });
    if (query.reservation_id)
      qb.andWhere('payment.reservation_id = :reservationId', {
        reservationId: query.reservation_id,
      });
    if (query.type) qb.andWhere('payment.type = :type', { type: query.type });
    if (query.status)
      qb.andWhere('payment.status = :status', { status: query.status });
    if (query.from_on)
      qb.andWhere(
        'payment.occurred_on >= :from AND payment.occurred_on < :to',
        { from: query.from_on, to: query.to_on },
      );
    applyRentalQuery(qb, 'payment', query, 'payments');
    return qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }
}
