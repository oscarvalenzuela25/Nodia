import { HttpException } from '@nestjs/common';
import {
  calendarColors,
  type CalendarCategoryName,
  type CalendarColor,
  type CalendarDayFields,
  type CalendarDayWrite,
  type CalendarImportedActivity,
  type CalendarImportedDay,
  type CalendarPlanWrite,
  type CalendarSchedule,
  type CalendarSource,
} from '../types/teacher-calendar.types.js';
import { uuidPattern } from './teacher-validation.js';

export const CALENDAR_DAY_LIMIT = 366;
export const CALENDAR_CATEGORY_LIMIT = 12;
export const CALENDAR_ACTIVITY_LIMIT = 24;
const civilDayMs = 86400000;
const calendarDatePattern = /^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function invalid(field: string): never {
  throw new HttpException(
    {
      code: 'calendar_invalid_input',
      message: 'teacher:calendar_invalid_input',
      field,
    },
    400,
  );
}

function readObject(
  value: unknown,
  fields: readonly string[],
  path: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid(path);
  const object = value as Record<string, unknown>;
  const extra = Object.keys(object).find((key) => !fields.includes(key));
  if (extra !== undefined) invalid(path);
  return object;
}

function readArray(value: unknown, max: number, path: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(path);
  return value;
}

function readText(
  value: unknown,
  max: number,
  path: string,
  allowBlank = false,
): string {
  if (typeof value !== 'string') invalid(path);
  const result = value.trim();
  if (
    result.length > max ||
    (!allowBlank && result.length === 0) ||
    result.includes('\u0000') ||
    /\p{Surrogate}/u.test(result)
  )
    invalid(path);
  return result;
}

function readInt(
  value: unknown,
  min: number,
  max: number,
  path: string,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    invalid(path);
  return value;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path);
  return value;
}

export function readCalendarCategoryName(
  value: unknown,
  path = 'name',
): CalendarCategoryName {
  if (typeof value !== 'string') invalid(path);
  const name = readText(
    value.normalize('NFKC').replace(/[\p{White_Space}\uFEFF]+/gu, ' '),
    120,
    path,
  );
  return {
    name,
    normalized_name: name.toLocaleLowerCase('es').normalize('NFKC'),
  };
}

export function readCalendarColor(value: unknown): CalendarColor {
  const color = calendarColors.find((entry) => entry === value);
  return color ?? invalid('color');
}

function categoryNames(value: unknown, path: string): CalendarCategoryName[] {
  if (value === undefined) return [];
  const names = readArray(value, CALENDAR_CATEGORY_LIMIT, path).map(
    (name, index) => readCalendarCategoryName(name, `${path}.${index}`),
  );
  if (
    new Set(names.map((category) => category.normalized_name)).size !==
    names.length
  )
    invalid(path);
  return names;
}

function civilDate(value: unknown, path: string): string {
  if (typeof value !== 'string' || !calendarDatePattern.test(value))
    invalid(path);
  const timestamp = Date.parse(value);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  )
    invalid(path);
  return value;
}

function readSchedule(value: unknown): {
  schedule: CalendarSchedule;
  dayCount: number;
} {
  const base = readObject(
    value,
    ['kind', 'days', 'start', 'end'],
    'plan.schedule',
  );
  if (base.kind === 'numbered') {
    if ('start' in base || 'end' in base) invalid('plan.schedule');
    const days = readInt(
      base.days,
      1,
      CALENDAR_DAY_LIMIT,
      'plan.schedule.days',
    );
    return { schedule: { kind: 'numbered', days }, dayCount: days };
  }
  if (base.kind !== 'dated' || 'days' in base) invalid('plan.schedule');
  const start = civilDate(base.start, 'plan.schedule.start');
  const end = civilDate(base.end, 'plan.schedule.end');
  const dayCount = (Date.parse(end) - Date.parse(start)) / civilDayMs + 1;
  if (dayCount < 1 || dayCount > CALENDAR_DAY_LIMIT)
    invalid('plan.schedule.end');
  return { schedule: { kind: 'dated', start, end }, dayCount };
}

function readSource(value: unknown, path: string): CalendarSource | undefined {
  if (value === undefined) return undefined;
  const source = readObject(value, ['label', 'url'], path);
  const label = readText(source.label, 180, `${path}.label`);
  const urlPath = `${path}.url`;
  const url = readText(source.url, 2048, urlPath);
  if (!/^https:\/\//i.test(url) || /[\\\p{White_Space}\p{Cc}]/u.test(url))
    invalid(urlPath);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return invalid(urlPath);
  }
  if (parsed.username || parsed.password) invalid(urlPath);
  return { label, url };
}

function readActivity(
  value: Record<string, unknown>,
  path: string,
): CalendarImportedActivity {
  const text = readText(value.text, 512, `${path}.text`);
  const source = readSource(value.source, `${path}.source`);
  return source ? { text, source } : { text };
}

function readDayFields(
  input: Record<string, unknown>,
  path: string,
  imported: boolean,
): CalendarDayFields {
  const absent = imported ? undefined : null;
  return {
    title:
      input.title === absent
        ? null
        : readText(input.title, 120, `${path}.title`, true) || null,
    notes:
      input.notes === absent
        ? null
        : readText(input.notes, 4000, `${path}.notes`, true) || null,
    minutes:
      input.minutes === absent
        ? null
        : readInt(input.minutes, 1, 1440, `${path}.minutes`),
  };
}

function readImportDay(
  value: unknown,
  index: number,
  schedule: CalendarSchedule,
  dayCount: number,
): CalendarImportedDay {
  const path = `plan.days.${index}`;
  const contentFields = ['title', 'notes', 'minutes', 'activities'];
  const day = readObject(
    value,
    [schedule.kind === 'numbered' ? 'day' : 'date', ...contentFields],
    path,
  );
  const ordinal =
    schedule.kind === 'numbered'
      ? readInt(day.day, 1, dayCount, `${path}.day`)
      : (Date.parse(civilDate(day.date, `${path}.date`)) -
          Date.parse(schedule.start)) /
          civilDayMs +
        1;
  if (ordinal < 1 || ordinal > dayCount) invalid(`${path}.date`);
  const activities =
    day.activities === undefined
      ? []
      : readArray(
          day.activities,
          CALENDAR_ACTIVITY_LIMIT,
          `${path}.activities`,
        ).map((activity, index) => {
          const itemPath = `${path}.activities.${index}`;
          return readActivity(
            readObject(activity, ['text', 'source'], itemPath),
            itemPath,
          );
        });
  return { ordinal, ...readDayFields(day, path, true), activities };
}

export function readCalendarPlan(
  value: unknown,
  newCategories: unknown,
): CalendarPlanWrite {
  const plan = readObject(
    value,
    ['version', 'title', 'categories', 'schedule', 'days'],
    'plan',
  );
  if (plan.version !== 1) invalid('plan.version');
  const title = readText(plan.title, 120, 'plan.title');
  const { schedule, dayCount } = readSchedule(plan.schedule);
  const categories = categoryNames(plan.categories, 'plan.categories');
  const create = categoryNames(newCategories, 'new_categories');
  const selected = new Set(
    categories.map((category) => category.normalized_name),
  );
  if (create.some((category) => !selected.has(category.normalized_name)))
    invalid('new_categories');
  const entries =
    plan.days === undefined ? [] : readArray(plan.days, dayCount, 'plan.days');
  const ordinals = new Set<number>();
  const days = entries.map((entry, index) => {
    const day = readImportDay(entry, index, schedule, dayCount);
    if (ordinals.has(day.ordinal))
      invalid(
        `plan.days.${index}.${schedule.kind === 'numbered' ? 'day' : 'date'}`,
      );
    ordinals.add(day.ordinal);
    return day;
  });
  return {
    title,
    categories,
    schedule,
    dayCount,
    days: days.sort((a, b) => a.ordinal - b.ordinal),
    newCategories: create,
  };
}

export function readCalendarDayPatch(value: unknown): CalendarDayWrite {
  const input = readObject(
    value,
    ['revision', 'title', 'notes', 'minutes', 'activities'],
    'day',
  );
  const revision = readInt(input.revision, 1, 2147483647, 'revision');
  const ids = new Set<string>();
  const activities = readArray(
    input.activities,
    CALENDAR_ACTIVITY_LIMIT,
    'activities',
  ).map((value, index) => {
    const path = `activities.${index}`;
    const item = readObject(value, ['id', 'text', 'source', 'completed'], path);
    const activity = readActivity(item, path);
    const completed = readBoolean(item.completed, `${path}.completed`);
    if (item.id === undefined) return { ...activity, completed };
    if (typeof item.id !== 'string' || !uuidPattern.test(item.id))
      invalid(`${path}.id`);
    const id = item.id.toLowerCase();
    if (ids.has(id)) invalid(`${path}.id`);
    ids.add(id);
    return { id, ...activity, completed };
  });
  return { revision, ...readDayFields(input, 'day', false), activities };
}
