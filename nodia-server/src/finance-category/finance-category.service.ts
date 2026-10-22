import {
  runFinanceScope,
  type FinanceActor,
} from '../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { FinanceCategory } from './entities/finance-category.entity.js';
import { FinanceMovement } from '../finance-movement/entities/finance-movement.entity.js';
import { FinanceCategoryGroupMembership } from '../finance-category-group/entities/finance-category-group-membership.entity.js';
import { FinanceQueryDto } from '../finance-common/dto/finance-query.dto.js';
import { applyFinanceQuery } from '../finance-common/finance-query.js';

@Injectable()
export class FinanceCategoryService {
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
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  transaction<T>(
    work: (manager: EntityManager) => Promise<T>,
    existingManager?: EntityManager,
  ): Promise<T> {
    if (existingManager) return work(existingManager);

    return this.dataSource.transaction(work);
  }

  findOwned(
    actorId: string,
    id: string,
    manager = this.dataSource.manager,
    lock = false,
  ): Promise<FinanceCategory | null> {
    return manager.getRepository(FinanceCategory).findOne({
      where: { id, user_id: actorId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }

  async findPage(
    actorId: string,
    query: FinanceQueryDto,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<[FinanceCategory[], number]> {
    const qb = manager
      .getRepository(FinanceCategory)
      .createQueryBuilder('category')
      .where('category.user_id = :actorId', { actorId });
    applyFinanceQuery(qb, 'category', query, 'categories');
    return qb
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 10))
      .take(query.limit ?? 10)
      .getManyAndCount();
  }

  insert(
    manager: EntityManager,
    data: Pick<FinanceCategory, 'user_id' | 'name' | 'key' | 'is_active'>,
  ): Promise<FinanceCategory> {
    const repository = manager.getRepository(FinanceCategory);
    return repository.save(repository.create(data));
  }

  save(
    manager: EntityManager,
    category: FinanceCategory,
  ): Promise<FinanceCategory> {
    return manager.getRepository(FinanceCategory).save(category);
  }

  hasMovements(manager: EntityManager, userId: string, id: string) {
    return manager
      .getRepository(FinanceMovement)
      .existsBy({ user_id: userId, category_id: id });
  }
  deleteMemberships(manager: EntityManager, userId: string, id: string) {
    return manager
      .getRepository(FinanceCategoryGroupMembership)
      .delete({ user_id: userId, category_id: id });
  }
  deleteOwned(manager: EntityManager, userId: string, id: string) {
    return manager
      .getRepository(FinanceCategory)
      .delete({ user_id: userId, id });
  }
}
