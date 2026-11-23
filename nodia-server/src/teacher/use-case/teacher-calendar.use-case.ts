import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import type {
  CreateCalendarCategoryDto,
  CreateCalendarPlanDto,
  PatchCalendarCategoryDto,
  PatchCalendarDayDto,
  PatchCalendarPlanDto,
} from '../dto/teacher-calendar.dto.js';
import {
  readCalendarCategoryName,
  readCalendarCategoryPatch,
  readCalendarColor,
  readCalendarDayPatch,
  readCalendarPage,
  readCalendarPlan,
  readCalendarPlanPatch,
  readCalendarPlanStatus,
} from '../policies/teacher-calendar.js';
import { requireUuid, teacherError } from '../policies/teacher-validation.js';
import {
  CALENDAR_PAGE_SIZE,
  TeacherCalendarStore,
} from '../teacher-calendar.store.js';
import { TeacherService } from '../teacher.service.js';
import type {
  CalendarCategoryName,
  CalendarPlanPatch,
  CalendarPlanStatus,
  CalendarPlanWrite,
} from '../types/teacher-calendar.types.js';

type CalendarScope = { manager: EntityManager; owner: string };

@Injectable()
export class TeacherCalendarUseCase {
  constructor(
    private readonly teacher: TeacherService,
    private readonly store: TeacherCalendarStore,
  ) {}

  private scope<T>(
    actor: ActorReference,
    work: (scope: CalendarScope) => Promise<T>,
  ): Promise<T> {
    return this.teacher.scope(
      actor,
      null,
      ({ manager, actor: current }) =>
        work({ manager, owner: current.actorId }),
      false,
      actor.transaction,
    );
  }

  listPlans(
    actor: ActorReference,
    page: number,
    categoryId?: string,
    status: CalendarPlanStatus = 'active',
    pageSize = CALENDAR_PAGE_SIZE,
  ) {
    readCalendarPage(page);
    const category =
      categoryId === undefined ? undefined : requireUuid(categoryId);
    const selected = readCalendarPlanStatus(status);
    return this.scope(actor, (scope) =>
      this.store.listPlans(
        scope,
        page,
        category,
        selected === 'all' ? null : selected === 'active',
        pageSize,
      ),
    );
  }

  plan(actor: ActorReference, planId: string) {
    requireUuid(planId);
    return this.scope(actor, (scope) => this.requirePlan(scope, planId));
  }

  day(actor: ActorReference, planId: string, dayId: string) {
    requireUuid(planId);
    requireUuid(dayId);
    return this.scope(actor, (scope) => this.requireDay(scope, planId, dayId));
  }

  createPlan(actor: ActorReference, input: CreateCalendarPlanDto) {
    const requestKey = requireUuid(input.request_key).toLowerCase();
    const plan = readCalendarPlan(input.plan, input.new_categories);
    const digest = createHash('sha256')
      .update(JSON.stringify(plan))
      .digest('hex');
    return this.scope(actor, async (scope) => {
      await this.store.lockCreationRequest(scope, requestKey);
      const existing = await this.store.findCreation(scope, requestKey);
      if (existing) {
        if (existing.request_hash === null)
          teacherError('calendar_plan_deleted', 410);
        if (existing.request_hash !== digest)
          teacherError('idempotency_conflict');
        return this.requirePlan(scope, existing.id);
      }
      const categoryIds = await this.resolvePlanCategories(scope, plan);
      const id = await this.store.createPlan(
        scope,
        requestKey,
        digest,
        plan,
        categoryIds,
      );
      return this.requirePlan(scope, id);
    });
  }

  patchPlan(
    actor: ActorReference,
    planId: string,
    input: PatchCalendarPlanDto,
  ) {
    requireUuid(planId);
    const patch = readCalendarPlanPatch(input);
    return this.scope(actor, async (scope) => {
      if (!(await this.store.lockPlan(scope, planId)))
        teacherError('not_found', 404);
      await this.validatePlanCategories(scope, planId, patch.category_ids);
      if (patch.title !== undefined || patch.active !== undefined)
        await this.store.updatePlan(scope, planId, patch);
      if (patch.category_ids !== undefined)
        await this.store.replacePlanCategories(
          scope,
          planId,
          patch.category_ids,
        );
      return this.requirePlan(scope, planId);
    });
  }

  deletePlan(actor: ActorReference, planId: string) {
    requireUuid(planId);
    return this.scope(actor, async (scope) => {
      // Read the immutable key before taking any plan row lock so create/delete
      // both serialize on the request identity before changing the plan.
      const requestKey = await this.store.planCreationKey(scope, planId);
      if (requestKey) {
        await this.store.lockCreationRequest(scope, requestKey);
        if (await this.store.deletePlan(scope, planId)) return;
      }
      if (!(await this.store.deletionRecorded(scope, planId)))
        teacherError('not_found', 404);
    });
  }

  patchDay(
    actor: ActorReference,
    planId: string,
    dayId: string,
    input: PatchCalendarDayDto,
  ) {
    requireUuid(planId);
    requireUuid(dayId);
    const { revision, activities, ...fields } = readCalendarDayPatch(input);
    return this.scope(actor, async (scope) => {
      const day = await this.requireLockedDay(scope, planId, dayId);
      if (day.revision !== revision || revision === 2147483647)
        teacherError('revision_conflict');
      const existingIds = new Set(await this.store.activityIds(scope, dayId));
      const storedActivities = activities.map((activity) => {
        if (activity.id && !existingIds.has(activity.id))
          teacherError('not_found', 404);
        return { ...activity, id: activity.id ?? randomUUID() };
      });
      const changed = await this.store.updateDay(
        scope,
        planId,
        dayId,
        revision,
        fields,
        storedActivities,
      );
      if (!changed) teacherError('revision_conflict');
      return this.requireDay(scope, planId, dayId);
    });
  }

  categories(actor: ActorReference) {
    return this.scope(actor, (scope) => this.store.categories(scope));
  }

  categoriesPage(actor: ActorReference, page: number) {
    readCalendarPage(page);
    return this.scope(actor, (scope) => this.store.categoriesPage(scope, page));
  }

  createCategory(actor: ActorReference, input: CreateCalendarCategoryDto) {
    const name = readCalendarCategoryName(input.name);
    const color = readCalendarColor(input.color);
    return this.scope(actor, async (scope) => {
      await this.store.lockCategories(scope);
      const category = await this.store.createCategory(scope, name, color);
      if (!category) teacherError('calendar_category_duplicate');
      return category;
    });
  }

  patchCategory(
    actor: ActorReference,
    categoryId: string,
    input: PatchCalendarCategoryDto,
  ) {
    requireUuid(categoryId);
    const { name, color, active } = readCalendarCategoryPatch(input);
    return this.scope(actor, async (scope) => {
      await this.store.lockCategories(scope);
      const category = await this.requireCategoryChange(
        scope,
        categoryId,
        name,
      );
      const updated = await this.store.updateCategory(
        scope,
        categoryId,
        name ?? category,
        color ?? category.color,
        active ?? category.active,
      );
      if (!updated) teacherError('not_found', 404);
      return updated;
    });
  }

  inspectPlanCreation(
    actor: ActorReference,
    plan: CalendarPlanWrite,
    requestKey?: string,
  ) {
    return this.scope(actor, async (scope) => {
      if (requestKey)
        await this.store.lockCreationRequest(
          scope,
          requireUuid(requestKey).toLowerCase(),
        );
      return this.classifyPlanCategories(scope, plan);
    });
  }

  inspectPlanChange(
    actor: ActorReference,
    id: string,
    intent: CalendarPlanPatch | 'delete',
  ) {
    requireUuid(id);
    return this.scope(actor, async (scope) => {
      if (intent === 'delete') {
        const key = await this.store.planCreationKey(scope, id);
        if (!key) teacherError('not_found', 404);
        await this.store.lockCreationRequest(scope, key);
      }
      if (
        !(await this.store.lockPlan(
          scope,
          id,
          intent === 'delete' ? 'delete' : 'patch',
        ))
      )
        teacherError('not_found', 404);
      await this.store.lockCategories(scope);
      const { days, ...plan } = await this.requirePlan(scope, id);
      const categories =
        intent === 'delete'
          ? []
          : await this.validatePlanCategories(scope, id, intent.category_ids);
      const revisions =
        intent === 'delete' ? await this.store.planDayRevisions(scope, id) : [];
      const activityCount =
        intent === 'delete'
          ? days.reduce((count, day) => count + day.activity_count, 0)
          : 0;
      return { plan, categories, revisions, activityCount };
    });
  }

  inspectDayChange(actor: ActorReference, planId: string, dayId: string) {
    requireUuid(planId);
    requireUuid(dayId);
    return this.scope(actor, async (scope) => {
      const { revision } = await this.requireLockedDay(scope, planId, dayId);
      if (revision === 2147483647) teacherError('revision_conflict');
      return this.requireDay(scope, planId, dayId);
    });
  }

  inspectCategoryCreation(actor: ActorReference, name: CalendarCategoryName) {
    return this.scope(actor, async (scope) => {
      await this.store.lockCategories(scope);
      await this.requireAvailableCategoryName(scope, name.normalized_name);
    });
  }

  inspectCategoryChange(
    actor: ActorReference,
    id: string,
    name?: CalendarCategoryName,
  ) {
    requireUuid(id);
    return this.scope(actor, async (scope) => {
      await this.store.lockCategories(scope);
      return this.requireCategoryChange(scope, id, name);
    });
  }

  private async validatePlanCategories(
    scope: CalendarScope,
    planId: string,
    categoryIds?: string[],
  ) {
    if (!categoryIds?.length) return [];
    await this.store.lockCategories(scope);
    const categories = await this.store.categoriesForPlanUpdate(
      scope,
      planId,
      categoryIds,
    );
    if (categories.length !== categoryIds.length)
      teacherError('not_found', 404);
    if (categories.some((category) => !category.active && !category.assigned))
      teacherError('calendar_category_inactive');
    return categories;
  }

  private async requireAvailableCategoryName(
    scope: CalendarScope,
    normalizedName: string,
  ) {
    const [duplicate] = await this.store.categoriesByNames(scope, [
      normalizedName,
    ]);
    if (duplicate) teacherError('calendar_category_duplicate');
  }

  private async requireCategoryChange(
    scope: CalendarScope,
    id: string,
    newName?: CalendarCategoryName,
  ) {
    const category = await this.store.category(scope, id);
    if (!category) teacherError('not_found', 404);
    if (newName && newName.normalized_name !== category.normalized_name)
      await this.requireAvailableCategoryName(scope, newName.normalized_name);
    return category;
  }

  private async requirePlan(scope: CalendarScope, id: string) {
    const plan = await this.store.plan(scope, id);
    if (!plan) teacherError('not_found', 404);
    return plan;
  }

  private async requireDay(
    scope: CalendarScope,
    planId: string,
    dayId: string,
  ) {
    const day = await this.store.day(scope, planId, dayId);
    if (!day) teacherError('not_found', 404);
    return day;
  }

  private async requireLockedDay(
    scope: CalendarScope,
    planId: string,
    dayId: string,
  ) {
    // Matches deletion's parent-first order and lets edits to distinct days proceed.
    if (!(await this.store.lockPlan(scope, planId, 'day')))
      teacherError('not_found', 404);
    const day = await this.store.lockDay(scope, planId, dayId);
    if (!day) teacherError('not_found', 404);
    return day;
  }

  private async classifyPlanCategories(
    scope: CalendarScope,
    plan: CalendarPlanWrite,
  ) {
    if (plan.categories.length === 0) return [];
    await this.store.lockCategories(scope);
    const rows = await this.store.categoriesByNames(
      scope,
      plan.categories.map((category) => category.normalized_name),
    );
    const existing = new Map(
      rows.map((category) => [category.normalized_name, category]),
    );
    const allowed = new Set(
      plan.newCategories.map((category) => category.normalized_name),
    );
    return plan.categories.map((name) => {
      const category = existing.get(name.normalized_name) ?? null;
      if (category && !category.active)
        teacherError('calendar_category_inactive');
      if (!category && !allowed.has(name.normalized_name))
        teacherError('calendar_category_required');
      return { name, category };
    });
  }

  private async resolvePlanCategories(
    scope: CalendarScope,
    plan: CalendarPlanWrite,
  ) {
    const ids: string[] = [];
    for (const { name, category } of await this.classifyPlanCategories(
      scope,
      plan,
    )) {
      const selected =
        category ?? (await this.store.createCategory(scope, name, 'violet'));
      if (!selected) teacherError('calendar_category_duplicate');
      ids.push(selected.id);
    }
    return ids;
  }
}
