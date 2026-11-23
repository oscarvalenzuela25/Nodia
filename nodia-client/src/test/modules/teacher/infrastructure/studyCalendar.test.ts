import { expect, it } from "vitest";
import {
  calendarActivityProgress, calendarRangeLength, calendarScheduleSchema, calendarWeeks, validSourceUrl,
  type CalendarDaySummary,
} from "../../../../modules/teacher/infrastructure/studyCalendar";

function day(date: string | null, ordinal: number): CalendarDaySummary {
  return {
    id: String(ordinal), date, ordinal, title: null, minutes: null,
    activity_count: 0, completed_activity_count: 0, completed: false,
  };
}

it("counts civil dates inclusively across leap days and daylight-saving boundaries", () => {
  expect(calendarRangeLength("2028-02-28", "2028-03-01")).toBe(3);
  expect(calendarRangeLength("2026-09-05", "2026-09-07")).toBe(3);
  expect(calendarScheduleSchema.safeParse({ kind: "dated", start: "2026-04-31", end: "2026-05-01" }).success).toBe(false);
  expect(calendarScheduleSchema.safeParse({ kind: "dated", start: "2026-10-01", end: "2026-09-01" }).success).toBe(false);
});

it("groups dated days into Monday weeks while numbered days stay in consecutive blocks", () => {
  const weeks = calendarWeeks([day("2026-11-29", 1), day("2026-11-30", 2), day("2026-12-01", 3)]);
  expect(weeks.map(week => week.days.map(entry => entry.column))).toEqual([[7], [1, 2]]);
  expect(calendarWeeks([day(null, 6), day(null, 7), day(null, 8)]).map(week => week.days.map(entry => entry.column))).toEqual([[6, 7], [1]]);
});

it("derives completion solely from a nonempty set of checked activities", () => {
  expect(calendarActivityProgress([]).complete).toBe(false);
  expect(calendarActivityProgress([{ completed: true }, { completed: false }])).toEqual({ done: 1, total: 2, complete: false });
  expect(calendarActivityProgress([{ completed: true }, { completed: true }]).complete).toBe(true);
});

it("supports clean HTTPS sources without credential or path ambiguity", () => {
  expect(validSourceUrl("https://example.test/a%20b")).toBe(true);
  expect(validSourceUrl("http://example.test")).toBe(false);
  expect(validSourceUrl("https://user@example.test")).toBe(false);
  expect(validSourceUrl("https://example.test/a\\b")).toBe(false);
  expect(validSourceUrl("https://example.test/a b")).toBe(false);
});
