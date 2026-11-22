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
  readCalendarColor,
  readCalendarDayPatch,
  readCalendarPlan,
  readCalendarPlanPatch,
  readCalendarPlanStatus,
} from '../policies/teacher-calendar.js';
import { requireUuid, teacherError } from '../policies/teacher-validation.js';
import { TeacherCalendarStore } from '../teacher-calendar.store.js';
import { TeacherService } from '../teacher.service.js';
import type {
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
    return this.teacher.scope(actor, null, ({ manager, actor: current }) =>
      work({ manager, owner: current.actorId }),
    );
  }

  listPlans(
    actor: ActorReference,
    page: number,
    categoryId?: string,
    status: CalendarPlanStatus = 'active',
  ) {
    if (!Number.isInteger(page) || page < 1 || page > 999999999)
      teacherError('invalid_input', 400);
    const category =
      categoryId === undefined ? undefined : requireUuid(categoryId);
    const selected = readCalendarPlanStatus(status);
    return this.scope(actor, (scope) =>
      this.store.listPlans(
        scope,
        page,
        category,
        selected === 'all' ? null : selected === 'active',
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
      if (patch.category_ids && patch.category_ids.length > 0) {
        await this.store.lockCategories(scope);
        const categories = await this.store.categoriesForPlanUpdate(
          scope,
          planId,
          patch.category_ids,
        );
        if (categories.length !== patch.category_ids.length)
          teacherError('not_found', 404);
        if (
          categories.some((category) => !category.active && !category.assigned)
        )
          teacherError('calendar_category_inactive');
      }
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
      const day = await this.store.lockDay(scope, planId, dayId);
      if (!day) teacherError('not_found', 404);
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
    if (
      input.name === undefined &&
      input.color === undefined &&
      input.active === undefined
    )
      teacherError('invalid_input', 400);
    if (input.active !== undefined && typeof input.active !== 'boolean')
      teacherError('invalid_input', 400);
    const name =
      input.name === undefined
        ? undefined
        : readCalendarCategoryName(input.name);
    const color =
      input.color === undefined ? undefined : readCalendarColor(input.color);
    return this.scope(actor, async (scope) => {
      await this.store.lockCategories(scope);
      const category = await this.store.category(scope, categoryId);
      if (!category) teacherError('not_found', 404);
      if (name && name.normalized_name !== category.normalized_name) {
        const [duplicate] = await this.store.categoriesByNames(scope, [
          name.normalized_name,
        ]);
        if (duplicate) teacherError('calendar_category_duplicate');
      }
      const updated = await this.store.updateCategory(
        scope,
        categoryId,
        name ?? category,
        color ?? category.color,
        input.active ?? category.active,
      );
      if (!updated) teacherError('not_found', 404);
      return updated;
    });
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

  private async resolvePlanCategories(
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
    const ids: string[] = [];
    for (const name of plan.categories) {
      const current = existing.get(name.normalized_name);
      if (current) {
        if (!current.active) teacherError('calendar_category_inactive');
        ids.push(current.id);
      } else {
        if (!allowed.has(name.normalized_name))
          teacherError('calendar_category_required');
        const created = await this.store.createCategory(scope, name, 'violet');
        if (!created) teacherError('calendar_category_duplicate');
        ids.push(created.id);
      }
    }
    return ids;
  }
}
