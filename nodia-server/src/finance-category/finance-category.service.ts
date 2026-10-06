import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { FinanceCategory } from './entities/finance-category.entity.js';
import { FinanceQueryDto } from '../finance-common/dto/finance-query.dto.js';
import { applyFinanceQuery } from '../finance-common/finance-query.js';

@Injectable()
export class FinanceCategoryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
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
  ): Promise<[FinanceCategory[], number]> {
    const qb = this.dataSource
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
}
