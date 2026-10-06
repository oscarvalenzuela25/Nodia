import { Injectable } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';
import { FinanceMovement } from '../finance-movement/entities/finance-movement.entity.js';
import { FinanceObligation } from './entities/finance-obligation.entity.js';
import { FinanceQueryDto } from '../finance-common/dto/finance-query.dto.js';
import { applyFinanceQuery } from '../finance-common/finance-query.js';

@Injectable()
export class FinanceObligationService {
  constructor(private readonly dataSource: DataSource) {}

  snapshot<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction('REPEATABLE READ', work);
  }

  findOne(
    userId: string,
    id: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    return manager
      .getRepository(FinanceObligation)
      .findOne({ where: { user_id: userId, id } });
  }

  list(
    userId: string,
    query: FinanceQueryDto,
    manager: EntityManager = this.dataSource.manager,
  ) {
    const qb = manager
      .getRepository(FinanceObligation)
      .createQueryBuilder('obligation')
      .where('obligation.user_id = :userId', { userId });
    applyFinanceQuery(qb, 'obligation', query, 'obligations');
    return qb
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 10))
      .take(query.limit ?? 10)
      .getManyAndCount();
  }

  async settlement(
    userId: string,
    obligations: FinanceObligation[],
    manager: EntityManager = this.dataSource.manager,
  ) {
    if (obligations.length === 0)
      return {
        initial: [] as FinanceMovement[],
        payments: [] as { obligation_id: string; amount: string }[],
      };
    const ids = obligations.map((obligation) => obligation.id);
    const initial = await manager
      .getRepository(FinanceMovement)
      .createQueryBuilder('initial')
      .innerJoin(
        FinanceObligation,
        'obligation',
        'obligation.id = initial.obligation_id AND obligation.user_id = initial.user_id',
      )
      .where(
        'initial.user_id = :userId AND initial.obligation_id IN (:...ids)',
        { userId, ids },
      )
      .andWhere(
        "((obligation.type = 'loan' AND initial.type = 'expense') OR (obligation.type = 'debt' AND initial.type = 'income'))",
      )
      .getMany();
    const payments = await manager
      .getRepository(FinanceMovement)
      .createQueryBuilder('payment')
      .innerJoin(
        FinanceObligation,
        'obligation',
        'obligation.id = payment.obligation_id AND obligation.user_id = payment.user_id',
      )
      .select('payment.obligation_id', 'obligation_id')
      .addSelect('SUM(payment.amount)::text', 'amount')
      .where({ user_id: userId, obligation_id: In(ids) })
      .andWhere(
        "((obligation.type = 'loan' AND payment.type = 'income' AND payment.status = 'received') OR (obligation.type = 'debt' AND payment.type = 'expense' AND payment.status = 'paid'))",
      )
      .groupBy('payment.obligation_id')
      .getRawMany<{ obligation_id: string; amount: string }>();
    return { initial, payments };
  }
}
