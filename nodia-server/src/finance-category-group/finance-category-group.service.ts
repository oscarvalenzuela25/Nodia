import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { FinanceCategoryGroup } from './entities/finance-category-group.entity.js';
import { FinanceCategoryGroupMembership } from './entities/finance-category-group-membership.entity.js';
import { FinanceCategory } from '../finance-category/entities/finance-category.entity.js';
import { FinanceQueryDto } from '../finance-common/dto/finance-query.dto.js';
import { applyFinanceQuery } from '../finance-common/finance-query.js';

@Injectable()
export class FinanceCategoryGroupService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }

  findOwned(
    actorId: string,
    id: string,
    manager = this.dataSource.manager,
    lock = false,
  ): Promise<FinanceCategoryGroup | null> {
    return manager.getRepository(FinanceCategoryGroup).findOne({
      where: { id, user_id: actorId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }

  async findPage(
    actorId: string,
    query: FinanceQueryDto,
  ): Promise<[FinanceCategoryGroup[], number]> {
    const qb = this.dataSource
      .getRepository(FinanceCategoryGroup)
      .createQueryBuilder('category_group')
      .where('category_group.user_id = :actorId', { actorId });
    applyFinanceQuery(qb, 'category_group', query, 'category-groups');
    return qb
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 10))
      .take(query.limit ?? 10)
      .getManyAndCount();
  }

  async categoryCounts(
    actorId: string,
    groupIds: string[],
  ): Promise<Map<string, number>> {
    if (groupIds.length === 0) return new Map();
    const rows = await this.dataSource
      .getRepository(FinanceCategoryGroupMembership)
      .createQueryBuilder('membership')
      .select('membership.category_group_id', 'id')
      .addSelect('COUNT(*)', 'count')
      .where('membership.user_id = :actorId', { actorId })
      .andWhere('membership.category_group_id IN (:...groupIds)', { groupIds })
      .andWhere('membership.is_active = true')
      .groupBy('membership.category_group_id')
      .getRawMany<{ id: string; count: string }>();
    return new Map(rows.map((row) => [row.id, Number(row.count)]));
  }

  categories(
    actorId: string,
    groupId: string,
    manager = this.dataSource.manager,
  ): Promise<FinanceCategory[]> {
    return manager
      .getRepository(FinanceCategory)
      .createQueryBuilder('category')
      .innerJoin(
        FinanceCategoryGroupMembership,
        'membership',
        'membership.user_id = category.user_id AND membership.category_id = category.id',
      )
      .where('category.user_id = :actorId', { actorId })
      .andWhere('membership.category_group_id = :groupId', { groupId })
      .andWhere('membership.is_active = true')
      .orderBy('category.name', 'ASC')
      .addOrderBy('category.id', 'ASC')
      .take(100)
      .getMany();
  }

  lockCategories(
    manager: EntityManager,
    actorId: string,
    categoryIds: string[],
  ): Promise<FinanceCategory[]> {
    if (categoryIds.length === 0) return Promise.resolve([]);
    return manager
      .getRepository(FinanceCategory)
      .createQueryBuilder('category')
      .where('category.user_id = :actorId', { actorId })
      .andWhere('category.id IN (:...categoryIds)', { categoryIds })
      .orderBy('category.id', 'ASC')
      .setLock('pessimistic_read')
      .getMany();
  }

  memberships(
    manager: EntityManager,
    actorId: string,
    groupId: string,
    selectedIds: string[],
  ): Promise<FinanceCategoryGroupMembership[]> {
    return (
      manager
        .getRepository(FinanceCategoryGroupMembership)
        .createQueryBuilder('membership')
        .where(
          'membership.user_id = :actorId AND membership.category_group_id = :groupId',
          { actorId, groupId },
        )
        // At most the current selection and the requested selection are needed.
        // Loading all archived memberships would grow without bound after many edits.
        .andWhere(
          selectedIds.length
            ? '(membership.is_active = true OR membership.category_id IN (:...selectedIds))'
            : 'membership.is_active = true',
          { selectedIds },
        )
        .getMany()
    );
  }

  insert(
    manager: EntityManager,
    data: Pick<FinanceCategoryGroup, 'user_id' | 'name' | 'key' | 'is_active'>,
  ): Promise<FinanceCategoryGroup> {
    const repository = manager.getRepository(FinanceCategoryGroup);
    return repository.save(repository.create(data));
  }

  save(
    manager: EntityManager,
    group: FinanceCategoryGroup,
  ): Promise<FinanceCategoryGroup> {
    return manager.getRepository(FinanceCategoryGroup).save(group);
  }

  saveMemberships(
    manager: EntityManager,
    memberships: FinanceCategoryGroupMembership[],
  ): Promise<FinanceCategoryGroupMembership[]> {
    return manager
      .getRepository(FinanceCategoryGroupMembership)
      .save(memberships);
  }

  newMembership(
    actorId: string,
    groupId: string,
    categoryId: string,
  ): FinanceCategoryGroupMembership {
    return Object.assign(new FinanceCategoryGroupMembership(), {
      user_id: actorId,
      category_group_id: groupId,
      category_id: categoryId,
      is_active: true,
    });
  }
}
