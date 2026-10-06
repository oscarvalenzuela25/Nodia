import { Injectable } from '@nestjs/common';
import type { EntityManager, DeepPartial } from 'typeorm';
import { RentalExpense } from './entities/rental-expense.entity.js';
import { RentalReservation } from '../rental-reservation/entities/rental-reservation.entity.js';
import { RentalExpenseQueryDto } from './dto/rental-expense.dto.js';
import { applyRentalQuery } from '../rental-common/rental-query.js';

@Injectable()
export class RentalExpenseService {
  find(manager: EntityManager, propertyId: string, id: string) {
    return manager
      .getRepository(RentalExpense)
      .findOne({ where: { property_id: propertyId, id } });
  }
  reservation(manager: EntityManager, propertyId: string, id: string) {
    return manager
      .getRepository(RentalReservation)
      .findOne({ where: { property_id: propertyId, id } });
  }
  save(manager: EntityManager, row: DeepPartial<RentalExpense>) {
    return manager.getRepository(RentalExpense).save(row);
  }
  list(
    manager: EntityManager,
    propertyId: string,
    query: RentalExpenseQueryDto,
  ) {
    const qb = manager
      .getRepository(RentalExpense)
      .createQueryBuilder('expense')
      .where('expense.property_id = :propertyId', { propertyId });
    if (query.reservation_id)
      qb.andWhere('expense.reservation_id = :reservationId', {
        reservationId: query.reservation_id,
      });
    if (query.category)
      qb.andWhere('expense.category = :category', { category: query.category });
    if (query.status)
      qb.andWhere('expense.status = :status', { status: query.status });
    if (query.from_on)
      qb.andWhere(
        'expense.incurred_on >= :from AND expense.incurred_on < :to',
        { from: query.from_on, to: query.to_on },
      );
    applyRentalQuery(qb, 'expense', query, 'expenses');
    return qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }
}
