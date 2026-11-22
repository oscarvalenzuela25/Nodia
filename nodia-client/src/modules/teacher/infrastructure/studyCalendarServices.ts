import { mainInstance } from "../../../config/api";
import {
  calendarCategorySchema, calendarDaySchema, calendarPlanSchema,
  type CalendarCategory, type CalendarPlanUpdate, type DayUpdate,
} from "./studyCalendar";
import type { StudyCalendarImportPlan } from "./studyCalendarImport";

export type CalendarCreate = { request_key: string; plan: StudyCalendarImportPlan; new_categories?: string[] };
export type CalendarCategoryUpdate = Partial<Pick<CalendarCategory, "name" | "color" | "active">>;

export async function createStudyCalendar(payload: CalendarCreate) {
  const { data } = await mainInstance.post<unknown>("/teacher/calendar/plans", payload);
  return calendarPlanSchema.parse(data);
}

export async function updateCalendarPlan(id: string, update: CalendarPlanUpdate) {
  const { data } = await mainInstance.patch<unknown>("/teacher/calendar/plans/" + id, update);
  const plan = calendarPlanSchema.parse(data);
  if (plan.id.toLowerCase() !== id.toLowerCase()) throw new Error("calendar_plan_identity_mismatch");
  return plan;
}

export async function deleteStudyCalendar(id: string) {
  const { status } = await mainInstance.delete("/teacher/calendar/plans/" + id);
  if (status !== 204) throw new Error("calendar_plan_delete_unconfirmed");
}

export async function updateStudyDay(planId: string, dayId: string, update: DayUpdate) {
  const { data } = await mainInstance.patch<unknown>("/teacher/calendar/plans/" + planId + "/days/" + dayId, update);
  return calendarDaySchema.parse(data);
}

export async function createCalendarCategory(category: Pick<CalendarCategory, "name" | "color">) {
  const { data } = await mainInstance.post<unknown>("/teacher/calendar/categories", category);
  return calendarCategorySchema.parse(data);
}

export async function updateCalendarCategory(id: string, update: CalendarCategoryUpdate) {
  const { data } = await mainInstance.patch<unknown>("/teacher/calendar/categories/" + id, update);
  return calendarCategorySchema.parse(data);
}
