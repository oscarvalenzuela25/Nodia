import {
  runFinanceScope,
  type FinanceActor,
} from '../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { FinanceMovement } from './entities/finance-movement.entity.js';
import { FinanceQueryDto } from '../finance-common/dto/finance-query.dto.js';
import {
  applyFinanceQuery,
  applyFinanceMovementFilters,
} from '../finance-common/finance-query.js';

@Injectable()
export class FinanceMovementService {
  withScope<T>(
    actor: FinanceActor,
    work: (scope: {
      manager: EntityManager;
      ownerId: string;
      actorId: string;
    }) => Promise<T>,
  ): Promise<T> {
    return runFinanceScope(this.dataSource, actor, work, 'READ COMMITTED');
  }
  constructor(private readonly dataSource: DataSource) {}

  findOne(
    userId: string,
    id: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    return manager.getRepository(FinanceMovement).findOne({
      where: { user_id: userId, id },
      relations: { category: true, obligation: true },
    });
  }

  list(
    userId: string,
    query: FinanceQueryDto,
    manager: EntityManager = this.dataSource.manager,
  ) {
    const qb = manager
      .getRepository(FinanceMovement)
      .createQueryBuilder('movement')
      .where('movement.user_id = :userId', { userId })
      .leftJoinAndSelect('movement.category', 'category')
      .leftJoinAndSelect('movement.obligation', 'obligation');
    applyFinanceQuery(qb, 'movement', query, 'movements');
    applyFinanceMovementFilters(qb, 'movement', query);
    return qb
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 10))
      .take(query.limit ?? 10)
      .getManyAndCount();
  }
}
