import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { FinanceCategoryGroupService } from '../finance-category-group.service.js';

/** Called with the group row locked; reused by creation and replacement. */
export async function syncFinanceGroupCategories(
  service: FinanceCategoryGroupService,
  manager: EntityManager,
  actorId: string,
  groupId: string,
  categoryIds: string[],
): Promise<void> {
  const categories = await service.lockCategories(
    manager,
    actorId,
    categoryIds,
  );
  if (categories.length !== categoryIds.length)
    throw new NotFoundException('finance:category_not_found');
  const existing = await service.memberships(
    manager,
    actorId,
    groupId,
    categoryIds,
  );
  const existingByCategory = new Map(
    existing.map((membership) => [membership.category_id, membership]),
  );
  for (const category of categories) {
    if (!category.is_active && !existingByCategory.get(category.id)?.is_active)
      throw new ConflictException('finance:category_inactive');
  }
  const selected = new Set(categoryIds);
  const changes = existing.filter(
    (membership) =>
      membership.is_active !== selected.has(membership.category_id),
  );
  for (const membership of changes)
    membership.is_active = selected.has(membership.category_id);
  for (const categoryId of categoryIds) {
    if (!existingByCategory.has(categoryId))
      changes.push(service.newMembership(actorId, groupId, categoryId));
  }
  if (changes.length > 0) await service.saveMemberships(manager, changes);
}
