import { Temporal } from "temporal-polyfill";
import { z } from "zod";

export const calendarColors = ["violet", "green", "blue", "amber"] as const;
export const calendarMaxDays = 366;
export const calendarMaxCategories = 12;
export const calendarMaxActivities = 24;
export const calendarMaxTitle = 120;
export const calendarMaxCategoryName = 120;
export const calendarMaxActivityText = 512;
export const calendarMaxSourceLabel = 180;
export const calendarMaxSourceUrl = 2048;
export const calendarMaxMinutes = 1440;
export const calendarMaxNotes = 4000;

export function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
}

export function calendarRangeLength(start: string, end: string): number {
  if (!isCivilDate(start) || !isCivilDate(end)) return 0;
  return Temporal.PlainDate.from(start).until(end).days + 1;
}

const civilDate = z.string().refine(isCivilDate);
const nonNegative = z.number().int().nonnegative();

export const calendarScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("numbered"), days: z.number().int().min(1).max(calendarMaxDays) }),
  z.object({ kind: z.literal("dated"), start: civilDate, end: civilDate })
    .refine(({ start, end }) => {
      const length = calendarRangeLength(start, end);
      return length > 0 && length <= calendarMaxDays;
    }),
]);

export const calendarCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  color: z.enum(calendarColors),
  active: z.boolean(),
});
export const calendarCategoriesSchema = z.array(calendarCategorySchema);

const calendarSummarySchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  schedule: calendarScheduleSchema,
  categories: calendarCategoriesSchema,
  day_count: z.number().int().min(1).max(calendarMaxDays),
  completed_count: nonNegative,
});

export function validSourceUrl(value: string): boolean {
  if (!/^https:\/\//iu.test(value) || /[\\\p{White_Space}\p{Cc}]/u.test(value) || value.length > calendarMaxSourceUrl) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

const sourceSchema = z.object({ label: z.string().min(1), url: z.string().refine(validSourceUrl) });
const activitySchema = z.object({
  id: z.uuid(),
  text: z.string().min(1),
  source: sourceSchema.nullish(),
  completed: z.boolean(),
});

const calendarDaySummarySchema = z.object({
  id: z.uuid(),
  ordinal: z.number().int().min(1).max(calendarMaxDays),
  date: civilDate.nullable(),
  title: z.string().nullable(),
  minutes: z.number().int().positive().nullable(),
  activity_count: nonNegative,
  completed_activity_count: nonNegative,
  completed: z.boolean(),
}).refine(day => day.completed_activity_count <= day.activity_count && day.completed === (day.activity_count > 0 && day.completed_activity_count === day.activity_count));
export const calendarDaySchema = calendarDaySummarySchema.safeExtend({
  notes: z.string().nullable(),
  revision: z.number().int().positive(),
  activities: z.array(activitySchema),
}).refine(day => day.activities.length === day.activity_count && calendarActivityProgress(day.activities).done === day.completed_activity_count);
export const calendarPlanSchema = calendarSummarySchema.extend({
  days: z.array(calendarDaySummarySchema).min(1).max(calendarMaxDays),
}).refine(plan => plan.days.length === plan.day_count && plan.days.filter(day => day.completed).length === plan.completed_count);
export const calendarPlansSchema = z.object({
  data: z.array(calendarSummarySchema.refine(plan => plan.completed_count <= plan.day_count)),
  meta: z.object({ page: z.number().int().positive(), total_pages: nonNegative, total: nonNegative }),
});

export type CalendarCategory = z.infer<typeof calendarCategorySchema>;
export type CalendarColor = typeof calendarColors[number];
export type CalendarSchedule = z.infer<typeof calendarScheduleSchema>;
export type CalendarPlan = z.infer<typeof calendarPlanSchema>;
export type CalendarSummary = z.infer<typeof calendarSummarySchema>;
export type CalendarDay = z.infer<typeof calendarDaySchema>;
export type CalendarDaySummary = z.infer<typeof calendarDaySummarySchema>;
export type CalendarSource = z.infer<typeof sourceSchema>;
export type DayUpdate = Pick<CalendarDay, "title" | "notes" | "minutes" | "revision"> & {
  activities: { id?: string; text: string; source?: CalendarSource; completed: boolean }[];
};

export function calendarActivityProgress(activities: readonly { completed: boolean }[]) {
  const done = activities.filter(activity => activity.completed).length;
  return { done, total: activities.length, complete: activities.length > 0 && done === activities.length };
}

export function calendarWeeks(days: readonly CalendarDaySummary[]) {
  const groups: { key: string; days: { day: CalendarDaySummary; column: number }[] }[] = [];
  for (const day of days) {
    const date = day.date ? Temporal.PlainDate.from(day.date) : null;
    const column = date?.dayOfWeek ?? (day.ordinal - 1) % 7 + 1;
    const key = date?.subtract({ days: column - 1 }).toString() ?? String(Math.ceil(day.ordinal / 7));
    const last = groups.at(-1);
    const group = last?.key === key ? last : { key, days: [] };
    if (last !== group) groups.push(group);
    group.days.push({ day, column });
  }
  return groups;
}

export function formatCalendarDate(value: string, language: string, options: Intl.DateTimeFormatOptions) {
  return Temporal.PlainDate.from(value).toLocaleString(language, options);
}

export function calendarDayLabel(day: CalendarDaySummary, language: string, numbered: (ordinal: number) => string) {
  return day.date ? formatCalendarDate(day.date, language, { dateStyle: "long" }) : numbered(day.ordinal);
}
