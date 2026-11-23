import { ConflictException, HttpException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ActorReference } from '../authorization/authority-transaction.js';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  calendarImportFromPlan,
  readCalendarCategoryName,
  readCalendarCategoryPatch,
  readCalendarColor,
  readCalendarDayPatch,
  readCalendarPage,
  readCalendarPlan,
  readCalendarPlanPatch,
  readCalendarPlanStatus,
} from '../teacher/policies/teacher-calendar.js';
import {
  requireUuid,
  teacherError,
} from '../teacher/policies/teacher-validation.js';
import { CALENDAR_PAGE_SIZE } from '../teacher/teacher-calendar.store.js';
import type {
  CalendarActivity,
  CalendarDayFields,
  CalendarDayWrite,
  CalendarPlanSummary,
} from '../teacher/types/teacher-calendar.types.js';
import type { TeacherCalendarUseCase } from '../teacher/use-case/teacher-calendar.use-case.js';
import type {
  TeacherOperationContext,
  TeacherPreparedCommand,
  TeacherReadCandidate,
  TeacherWriteCandidate,
} from './types.js';

const planPageSize = 5;
const activityPageSize = 3;

function actor(context: TeacherOperationContext): ActorReference {
  return {
    userId: context.actorId,
    sessionId: context.sessionId,
    transaction: context.manager,
    statementTimeoutMs: context.statementTimeoutMs,
  };
}

function pageNumber(input: NodiaAiJsonObject): number {
  return input.page === undefined ? 1 : readCalendarPage(input.page);
}

function paginate<T>(items: T[], page: number, size: number) {
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    meta: {
      page,
      total_pages: Math.ceil(items.length / size),
      total: items.length,
    },
  };
}

function activityValue(
  activity: CalendarDayWrite['activities'][number],
): NodiaAiJsonObject {
  const { id, text, source, completed } = activity;
  return {
    ...(id === undefined ? {} : { id }),
    text,
    ...(source ? { source: { ...source } } : {}),
    completed,
  };
}

function planSummary(plan: CalendarPlanSummary): NodiaAiJsonObject {
  return {
    ...plan,
    categories: plan.categories.map((category) => ({ ...category })),
  };
}

export function calendarReadCandidates(
  useCase: TeacherCalendarUseCase,
): TeacherReadCandidate[] {
  return [
    {
      toolName: 'nodia_teacher_calendars_list',
      async execute(input, context) {
        const status =
          input.status === undefined
            ? 'active'
            : readCalendarPlanStatus(input.status);
        const category =
          input.category_id === undefined
            ? undefined
            : requireUuid(input.category_id);
        const { data, meta } = await useCase.listPlans(
          actor(context),
          pageNumber(input),
          category,
          status,
          planPageSize,
        );
        return { data: data.map(planSummary), meta };
      },
    },
    {
      toolName: 'nodia_teacher_calendars_get',
      async execute(input, context) {
        const page = pageNumber(input);
        const { days, ...plan } = await useCase.plan(
          actor(context),
          requireUuid(input.id),
        );
        const { items, meta } = paginate(days, page, CALENDAR_PAGE_SIZE);
        return {
          ...planSummary(plan),
          days: items.map((day) => ({ ...day })),
          meta,
        };
      },
    },
    {
      toolName: 'nodia_teacher_calendar_days_get',
      async execute(input, context) {
        const page = pageNumber(input);
        const { activities, ...day } = await useCase.day(
          actor(context),
          requireUuid(input.plan_id),
          requireUuid(input.id),
        );
        const { items, meta } = paginate(activities, page, activityPageSize);
        return { ...day, activities: items.map(activityValue), meta };
      },
    },
    {
      toolName: 'nodia_teacher_calendar_categories_list',
      async execute(input, context) {
        const { data, meta } = await useCase.categoriesPage(
          actor(context),
          pageNumber(input),
        );
        return { data: data.map((category) => ({ ...category })), meta };
      },
    },
  ];
}

function changed(): never {
  throw new ConflictException('nodia_ai:preconditions_changed');
}

function fingerprint(state: unknown): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

/** Material reads take the same locks as the native mutation and keep them until commit. */
async function verifyState(
  value: TeacherPreparedCommand,
  inspect: () => Promise<unknown>,
): Promise<void> {
  let current: unknown;
  try {
    current = await inspect();
  } catch (error) {
    if (
      error instanceof HttpException &&
      [400, 404, 409, 410].includes(error.getStatus())
    )
      changed();
    throw error;
  }
  if (fingerprint(current) !== value.preconditions.fingerprint) changed();
}

function id(input: unknown): string {
  return requireUuid(input).toLowerCase();
}

function planMutation(
  useCase: TeacherCalendarUseCase,
  kind: 'update' | 'delete',
): TeacherWriteCandidate {
  function inspect(input: NodiaAiJsonObject, context: TeacherOperationContext) {
    const { id: rawId, ...value } = input;
    return useCase.inspectPlanChange(
      actor(context),
      id(rawId),
      kind === 'delete' ? 'delete' : readCalendarPlanPatch(value),
    );
  }
  return {
    toolName: `nodia_teacher_calendars_prepare_${kind}`,
    async prepare(input, context) {
      const { id: rawId, ...value } = input;
      const planId = id(rawId);
      const patch = kind === 'delete' ? {} : readCalendarPlanPatch(value);
      const command = { id: planId, ...patch };
      const state = await inspect(command, context);
      const preview: NodiaAiJsonObject =
        kind === 'delete'
          ? {
              title: state.plan.title,
              day_count: state.plan.day_count,
              activity_count: state.activityCount,
              completed_count: state.plan.completed_count,
              categories: state.plan.categories.map(({ name }) => name),
            }
          : {
              ...patch,
              ...(patch.category_ids
                ? { categories: state.categories.map(({ name }) => name) }
                : {}),
            };
      return {
        id: planId,
        title: state.plan.title,
        command,
        preview,
        preconditions: { fingerprint: fingerprint(state) },
      };
    },
    verify(value, context) {
      return verifyState(value, () => inspect(value.command, context));
    },
    async execute(value, context) {
      const { id: rawId, ...fields } = value.command;
      const planId = id(rawId);
      if (kind === 'delete') await useCase.deletePlan(actor(context), planId);
      else
        await useCase.patchPlan(
          actor(context),
          planId,
          readCalendarPlanPatch(fields),
        );
      return { id: planId };
    },
  };
}

function nativeDayPatch(
  fields: NodiaAiJsonObject,
  revision: number,
): CalendarDayWrite {
  return readCalendarDayPatch({ ...fields, revision });
}

function dayUpdate(useCase: TeacherCalendarUseCase): TeacherWriteCandidate {
  return {
    toolName: 'nodia_teacher_calendar_days_prepare_update',
    async prepare(input, context) {
      const { plan_id: rawPlan, id: rawDay, ...fields } = input;
      const planId = id(rawPlan);
      const dayId = id(rawDay);
      const day = await useCase.inspectDayChange(actor(context), planId, dayId);
      const { revision, activities, ...patch } = nativeDayPatch(
        fields,
        day.revision,
      );
      const available = new Set(day.activities.map((activity) => activity.id));
      if (
        activities.some(
          (activity) =>
            activity.id !== undefined && !available.has(activity.id),
        )
      )
        teacherError('not_found', 404);
      const resolved = { ...patch, activities: activities.map(activityValue) };
      return {
        id: dayId,
        title: day.title ?? day.date ?? String(day.ordinal),
        command: { plan_id: planId, id: dayId, ...resolved, revision },
        preview: resolved,
        preconditions: { revision },
      };
    },
    async verify(value, context) {
      await verifyDayRevision(useCase, value, context);
    },
    async execute(value, context) {
      const { plan_id: rawPlan, id: rawDay, ...patch } = value.command;
      const day = await useCase.patchDay(
        actor(context),
        id(rawPlan),
        id(rawDay),
        readCalendarDayPatch(patch),
      );
      return { id: day.id };
    },
  };
}

async function verifyDayRevision(
  useCase: TeacherCalendarUseCase,
  value: TeacherPreparedCommand,
  context: TeacherOperationContext,
) {
  const revision = value.preconditions.revision;
  if (typeof revision !== 'number') changed();
  try {
    const day = await useCase.inspectDayChange(
      actor(context),
      id(value.command.plan_id),
      id(value.command.id),
    );
    if (day.revision !== revision) changed();
    return day;
  } catch (error) {
    if (
      error instanceof HttpException &&
      [404, 409].includes(error.getStatus())
    )
      changed();
    throw error;
  }
}

function planCreate(useCase: TeacherCalendarUseCase): TeacherWriteCandidate {
  return {
    toolName: 'nodia_teacher_calendars_prepare_create',
    async prepare(input, context) {
      const plan = readCalendarPlan(input.plan, input.new_categories);
      const expected = await useCase.inspectPlanCreation(actor(context), plan);
      const envelope = calendarImportFromPlan(plan);
      const newCategories = expected
        .filter(({ category }) => !category)
        .map(({ name }) => name.name);
      return {
        title: plan.title,
        command: { plan: envelope, new_categories: newCategories },
        preconditions: { fingerprint: fingerprint(expected) },
      };
    },
    verify(value, context) {
      return verifyState(value, () =>
        useCase.inspectPlanCreation(
          actor(context),
          readCalendarPlan(value.command.plan, value.command.new_categories),
          context.requestKey,
        ),
      );
    },
    async execute(value, context) {
      const plan = readCalendarPlan(
        value.command.plan,
        value.command.new_categories,
      );
      const created = await useCase.createPlan(actor(context), {
        request_key: context.requestKey,
        plan: calendarImportFromPlan(plan),
        new_categories: plan.newCategories.map(({ name }) => name),
      });
      return { id: created.id };
    },
  };
}

function categoryCreate(
  useCase: TeacherCalendarUseCase,
): TeacherWriteCandidate {
  return {
    toolName: 'nodia_teacher_calendar_categories_prepare_create',
    async prepare(input, context) {
      const name = readCalendarCategoryName(input.name);
      const color = readCalendarColor(input.color);
      await useCase.inspectCategoryCreation(actor(context), name);
      return {
        title: name.name,
        command: { name: name.name, color },
        preconditions: { fingerprint: fingerprint(null) },
      };
    },
    verify(value, context) {
      return verifyState(value, async () => {
        await useCase.inspectCategoryCreation(
          actor(context),
          readCalendarCategoryName(value.command.name),
        );
        return null;
      });
    },
    async execute(value, context) {
      const category = await useCase.createCategory(actor(context), {
        name: readCalendarCategoryName(value.command.name).name,
        color: readCalendarColor(value.command.color),
      });
      return { id: category.id };
    },
  };
}

function categoryUpdate(
  useCase: TeacherCalendarUseCase,
): TeacherWriteCandidate {
  function inspect(
    command: NodiaAiJsonObject,
    context: TeacherOperationContext,
  ) {
    const { id: rawId, ...fields } = command;
    const { name } = readCalendarCategoryPatch(fields);
    return useCase.inspectCategoryChange(actor(context), id(rawId), name);
  }
  return {
    toolName: 'nodia_teacher_calendar_categories_prepare_update',
    async prepare(input, context) {
      const { id: rawId, ...fields } = input;
      const categoryId = id(rawId);
      const { name, color, active } = readCalendarCategoryPatch(fields);
      const patch = {
        ...(name === undefined ? {} : { name: name.name }),
        ...(color === undefined ? {} : { color }),
        ...(active === undefined ? {} : { active }),
      };
      const command = { id: categoryId, ...patch };
      const state = await inspect(command, context);
      return {
        id: categoryId,
        title: state.name,
        command,
        preview: patch,
        preconditions: { fingerprint: fingerprint(state) },
      };
    },
    verify(value, context) {
      return verifyState(value, () => inspect(value.command, context));
    },
    async execute(value, context) {
      const { id: rawId, ...fields } = value.command;
      const { name, color, active } = readCalendarCategoryPatch(fields);
      const category = await useCase.patchCategory(actor(context), id(rawId), {
        ...(name === undefined ? {} : { name: name.name }),
        ...(color === undefined ? {} : { color }),
        ...(active === undefined ? {} : { active }),
      });
      return { id: category.id };
    },
  };
}

function activityToChange(activities: CalendarActivity[], activityId: string) {
  const target = activities.find((activity) => activity.id === activityId);
  if (!target) teacherError('not_found', 404);
  return target;
}

function completion(value: unknown): boolean {
  if (typeof value !== 'boolean') teacherError('invalid_input', 400);
  return value;
}

function activityCompletion(
  useCase: TeacherCalendarUseCase,
): TeacherWriteCandidate {
  return {
    toolName: 'nodia_teacher_calendar_activities_prepare_set_completion',
    async prepare(input, context) {
      const planId = id(input.plan_id);
      const dayId = id(input.id);
      const activityId = id(input.activity_id);
      const completed = completion(input.completed);
      const day = await useCase.inspectDayChange(actor(context), planId, dayId);
      const activity = activityToChange(day.activities, activityId);
      return {
        id: activityId,
        title: day.title ?? day.date ?? String(day.ordinal),
        command: {
          plan_id: planId,
          id: dayId,
          activity_id: activityId,
          completed,
        },
        preview: { activity: activity.text, completed },
        preconditions: { revision: day.revision },
      };
    },
    async verify(value, context) {
      await verifyDayRevision(useCase, value, context);
    },
    async execute(value, context) {
      const day = await verifyDayRevision(useCase, value, context);
      const activityId = id(value.command.activity_id);
      const activity = activityToChange(day.activities, activityId);
      const completed = completion(value.command.completed);
      if (activity.completed !== completed) {
        const fields: CalendarDayFields = {
          title: day.title,
          notes: day.notes,
          minutes: day.minutes,
        };
        await useCase.patchDay(
          actor(context),
          id(value.command.plan_id),
          day.id,
          {
            ...fields,
            revision: day.revision,
            activities: day.activities.map((entry) =>
              entry.id === activity.id ? { ...entry, completed } : entry,
            ),
          },
        );
      }
      return { id: activity.id };
    },
  };
}

export function calendarWriteCandidates(
  useCase: TeacherCalendarUseCase,
): TeacherWriteCandidate[] {
  return [
    planCreate(useCase),
    planMutation(useCase, 'update'),
    planMutation(useCase, 'delete'),
    dayUpdate(useCase),
    categoryCreate(useCase),
    categoryUpdate(useCase),
    activityCompletion(useCase),
  ];
}
